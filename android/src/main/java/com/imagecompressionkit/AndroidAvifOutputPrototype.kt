package com.imagecompressionkit

import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.os.Build
import java.nio.charset.StandardCharsets

internal data class AndroidAvifOutputPrototypeReport(
  val apiLevel: Int,
  val sdkEligible: Boolean,
  val imageAvifMimeType: String,
  val av1VideoMimeType: String,
  val imageAvifEncoderName: String?,
  val av1FallbackEncoderName: String?,
  val candidateRoute: String,
  val productionReady: Boolean,
  val blockers: List<String>,
  val validationPlan: List<String>
) {
  val hasImageAvifEncoder: Boolean
    get() = imageAvifEncoderName != null

  val hasCandidateRoute: Boolean
    get() = sdkEligible && hasImageAvifEncoder
}

internal object AndroidAvifOutputPrototype {
  const val AVIF_MIME_TYPE = "image/avif"
  const val AV1_VIDEO_MIME_TYPE = "video/av01"
  const val CANDIDATE_ROUTE = "MediaCodec image/avif encoder probe"
  const val PRODUCTION_GATE_MESSAGE =
    "AVIF output production gate remains closed until byte-signature, decode-back, metadata, and maxBytes behavior are validated."

  fun inspectRoute(
    width: Int,
    height: Int,
    apiLevel: Int = Build.VERSION.SDK_INT,
    encoderFinder: (MediaFormat) -> String? = ::findEncoderForFormat
  ): AndroidAvifOutputPrototypeReport {
    val sdkEligible = apiLevel >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
    val imageAvifEncoderName = if (sdkEligible) {
      findEncoderOrNull(createImageAvifMediaFormat(width, height), encoderFinder)
    } else {
      null
    }
    val av1FallbackEncoderName = if (sdkEligible) {
      findEncoderOrNull(createAv1FallbackMediaFormat(width, height), encoderFinder)
    } else {
      null
    }

    return AndroidAvifOutputPrototypeReport(
      apiLevel = apiLevel,
      sdkEligible = sdkEligible,
      imageAvifMimeType = AVIF_MIME_TYPE,
      av1VideoMimeType = AV1_VIDEO_MIME_TYPE,
      imageAvifEncoderName = imageAvifEncoderName,
      av1FallbackEncoderName = av1FallbackEncoderName,
      candidateRoute = CANDIDATE_ROUTE,
      productionReady = false,
      blockers = createBlockers(
        sdkEligible = sdkEligible,
        imageAvifEncoderName = imageAvifEncoderName
      ),
      validationPlan = createValidationPlan()
    )
  }

  fun createImageAvifMediaFormat(width: Int, height: Int): MediaFormat {
    require(width > 0) { "AVIF prototype width must be positive." }
    require(height > 0) { "AVIF prototype height must be positive." }

    return MediaFormat().apply {
      setString(MediaFormat.KEY_MIME, AVIF_MIME_TYPE)
      setInteger(MediaFormat.KEY_WIDTH, width)
      setInteger(MediaFormat.KEY_HEIGHT, height)
      setInteger(
        MediaFormat.KEY_COLOR_FORMAT,
        MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible
      )
    }
  }

  fun looksLikeAvifFile(bytes: ByteArray): Boolean {
    if (bytes.size < MIN_AVIF_SIGNATURE_BYTES) {
      return false
    }

    val boxType = String(bytes, 4, 4, StandardCharsets.US_ASCII)
    if (boxType != "ftyp") {
      return false
    }

    val brandWindow = String(
      bytes,
      8,
      minOf(bytes.size - 8, AVIF_BRAND_SCAN_BYTES),
      StandardCharsets.US_ASCII
    )

    return brandWindow.contains("avif") || brandWindow.contains("avis")
  }

  private fun createAv1FallbackMediaFormat(width: Int, height: Int): MediaFormat =
    MediaFormat.createVideoFormat(AV1_VIDEO_MIME_TYPE, width, height).apply {
      setInteger(MediaFormat.KEY_FRAME_RATE, 1)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
      setInteger(MediaFormat.KEY_BIT_RATE, estimatePrototypeBitrate(width, height))
      setInteger(
        MediaFormat.KEY_COLOR_FORMAT,
        MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible
      )
    }

  private fun findEncoderForFormat(format: MediaFormat): String? =
    MediaCodecList(MediaCodecList.REGULAR_CODECS).findEncoderForFormat(format)

  private fun findEncoderOrNull(
    format: MediaFormat,
    encoderFinder: (MediaFormat) -> String?
  ): String? =
    try {
      encoderFinder(format)
    } catch (_: IllegalArgumentException) {
      null
    } catch (_: RuntimeException) {
      null
    }

  private fun createBlockers(
    sdkEligible: Boolean,
    imageAvifEncoderName: String?
  ): List<String> =
    buildList {
      if (!sdkEligible) {
        add("Android AVIF output prototype requires Android 14+ because MediaFormat.MIMETYPE_IMAGE_AVIF was added in API 34.")
      }
      if (imageAvifEncoderName == null) {
        add("No image/avif encoder was discovered through MediaCodecList.findEncoderForFormat().")
      }
      add("Prototype does not feed Bitmap pixels into a YUV420 image encoder input buffer yet.")
      add("Prototype does not write or verify a complete AVIF still-image file from encoder output yet.")
      add("metadata='preserve' remains unsupported for AVIF output because Android ExifInterface writable metadata support is JPEG, PNG, and WebP only.")
      add("output.maxBytes remains unsupported for AVIF output until quality and size-search semantics are validated.")
      add(PRODUCTION_GATE_MESSAGE)
    }

  private fun createValidationPlan(): List<String> =
    listOf(
      "Probe MediaCodecList.findEncoderForFormat() with an image/avif MediaFormat on an API 34+ device or emulator.",
      "Encode one static 16x12 ARGB_8888 bitmap through the candidate route into an .avif cache file.",
      "Assert the result has an ftyp box with avif or avis compatible brand.",
      "Decode the result with ImageDecoder and assert dimensions match the processed bitmap.",
      "Assert metadata='preserve' and output.maxBytes reject with documented unsupported errors until implemented.",
      "Keep getImageCompressionCapabilities().formats.avif.output=false until the encode and decode-back smoke passes in instrumentation."
    )

  private fun estimatePrototypeBitrate(width: Int, height: Int): Int =
    (width * height * 8).coerceAtLeast(MIN_PROTOTYPE_BITRATE)

  private const val MIN_AVIF_SIGNATURE_BYTES = 12
  private const val AVIF_BRAND_SCAN_BYTES = 32
  private const val MIN_PROTOTYPE_BITRATE = 64_000
}
