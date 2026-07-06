package com.imagecompressionkit

import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.os.Build
import java.io.File

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

internal data class AndroidAvifEncodeDecodeSmokeResult(
  val apiLevel: Int,
  val attempted: Boolean,
  val success: Boolean,
  val encoderName: String?,
  val route: String,
  val outputFilePath: String?,
  val byteSize: Long,
  val signatureValid: Boolean,
  val decodeBackValid: Boolean,
  val decodedWidth: Int?,
  val decodedHeight: Int?,
  val blockerCode: String?,
  val blocker: String?,
  val outputCanBeEnabled: Boolean,
  val productionDecision: String,
  val details: List<String>
)

internal data class AndroidAvifSmokeBlocker(
  val code: String,
  val message: String
)

internal data class AndroidAvifOutputProductionScaffold(
  val route: String,
  val reusableHelperRoute: String,
  val outputEnabled: Boolean,
  val willEnterEncodeDecodeBackHelper: Boolean,
  val notImplementedMessage: String,
  val boundaryBlockers: List<String>,
  val validationPlan: List<String>
)

internal object AndroidAvifOutputPrototype {
  const val AVIF_MIME_TYPE = "image/avif"
  const val AV1_VIDEO_MIME_TYPE = "video/av01"
  const val CANDIDATE_ROUTE = "MediaCodec image/avif encoder probe"
  const val SMOKE_ROUTE = "MediaCodec image/avif encode/decode-back smoke"
  const val PRODUCTION_WIRING_SCAFFOLD_ROUTE =
    "Android AVIF output production wiring scaffold"
  const val BLOCKER_CODE_SDK_UNAVAILABLE = "sdk_unavailable"
  const val BLOCKER_CODE_NO_IMAGE_AVIF_ENCODER = "no_image_avif_encoder"
  const val BLOCKER_CODE_CODEC_FAILURE = "codec_failure"
  const val BLOCKER_CODE_INVALID_SIGNATURE = "invalid_signature"
  const val BLOCKER_CODE_DECODE_BACK_FAILURE = "decode_back_failure"
  const val NO_IMAGE_AVIF_ENCODER_BLOCKER =
    "No image/avif encoder was discovered through MediaCodecList.findEncoderForFormat()."
  const val INVALID_SIGNATURE_BLOCKER =
    "AVIF smoke output did not pass ftyp avif/avis signature validation."
  const val DECODE_BACK_FAILURE_BLOCKER =
    "AVIF smoke output passed ftyp signature validation but failed ImageDecoder decode-back validation."
  const val CODEC_FAILURE_BLOCKER_PREFIX =
    "MediaCodec image/avif encode/decode-back smoke failed"
  const val PRODUCTION_DECISION_KEEP_DISABLED =
    "Keep Android AVIF output disabled; do not report avif.output=true or wire output.format='avif' into compressImage()."
  const val PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED =
    "Keep Android AVIF output disabled even though the AVIF smoke passed file validation; production wiring, metadata preserve, output.maxBytes, and animated AVIF boundaries are still not implemented and tested."
  const val PRODUCTION_GATE_MESSAGE =
    "AVIF output production gate remains closed until production wiring, byte-signature, ImageDecoder decode-back, metadata preserve, output.maxBytes, and animated AVIF boundaries are explicitly validated."
  const val PRODUCTION_WIRING_NOT_IMPLEMENTED_MESSAGE =
    "AVIF output is not implemented. Android AVIF output production wiring scaffold keeps output.format: 'avif' on ERR_NOT_IMPLEMENTED and does not enter the extracted Android AVIF output encode/decode-back helper while avif.output=false. metadata='preserve', output.maxBytes, and animated AVIF preservation remain blocked before helper entry."
  const val METADATA_PRESERVE_HELPER_ENTRY_BLOCKER =
    "metadata='preserve' is blocked before Android AVIF output production helper entry."
  const val OUTPUT_MAX_BYTES_HELPER_ENTRY_BLOCKER =
    "output.maxBytes is blocked before Android AVIF output production helper entry."
  const val ANIMATED_AVIF_HELPER_ENTRY_BLOCKER =
    "animated AVIF preservation is blocked before Android AVIF output production helper entry."

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
    return AndroidAvifOutputHelper.createImageAvifMediaFormat(width, height)
  }

  fun looksLikeAvifFile(bytes: ByteArray): Boolean =
    AndroidAvifOutputHelper.looksLikeAvifFile(bytes)

  fun runEncodeDecodeBackSmoke(
    cacheDir: File,
    width: Int = PROTOTYPE_WIDTH,
    height: Int = PROTOTYPE_HEIGHT,
    apiLevel: Int = Build.VERSION.SDK_INT,
    encoderFinder: (MediaFormat) -> String? = ::findEncoderForFormat
  ): AndroidAvifEncodeDecodeSmokeResult {
    val routeReport = inspectRoute(
      width = width,
      height = height,
      apiLevel = apiLevel,
      encoderFinder = encoderFinder
    )
    return AndroidAvifOutputHelper.runEncodeDecodeBack(
      AndroidAvifOutputHelper.createInput(
        cacheDir = cacheDir,
        width = width,
        height = height,
        routeReport = routeReport
      )
    ).toSmokeResult(routeReport.apiLevel)
  }

  fun classifySmokeValidationBlocker(
    signatureValid: Boolean,
    decodeBackValid: Boolean
  ): AndroidAvifSmokeBlocker? =
    AndroidAvifOutputHelper.classifyValidationBlocker(signatureValid, decodeBackValid)

  fun codecFailureBlocker(error: Exception): String =
    AndroidAvifOutputHelper.codecFailureBlocker(error)

  fun createProductionWiringScaffold(
    metadataPolicy: String,
    maxBytesRequested: Boolean
  ): AndroidAvifOutputProductionScaffold =
    AndroidAvifOutputProductionScaffold(
      route = PRODUCTION_WIRING_SCAFFOLD_ROUTE,
      reusableHelperRoute = AndroidAvifOutputHelper.PRODUCTION_HELPER_ROUTE,
      outputEnabled = false,
      willEnterEncodeDecodeBackHelper = false,
      notImplementedMessage = PRODUCTION_WIRING_NOT_IMPLEMENTED_MESSAGE,
      boundaryBlockers = createProductionBoundaryBlockers(
        metadataPolicy = metadataPolicy,
        maxBytesRequested = maxBytesRequested
      ),
      validationPlan = createValidationPlan()
    )

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
        add(NO_IMAGE_AVIF_ENCODER_BLOCKER)
      }
      add("Prototype route is not wired into compressImage() or production capability reporting.")
      add("Prototype smoke result must pass complete AVIF file signature and ImageDecoder decode-back validation before AVIF output can be enabled.")
      add("metadata='preserve' remains unsupported for AVIF output because Android ExifInterface writable metadata support is JPEG, PNG, and WebP only.")
      add("output.maxBytes remains unsupported for AVIF output until quality and size-search semantics are validated.")
      add("Animated AVIF preservation remains unsupported until the public output contract explicitly designs static-only versus animated behavior.")
      add(PRODUCTION_GATE_MESSAGE)
    }

  private fun createValidationPlan(): List<String> =
    listOf(
      "Probe MediaCodecList.findEncoderForFormat() with an image/avif MediaFormat on an API 34+ device or emulator.",
      "Encode one static 16x12 ARGB_8888 bitmap through the candidate route into an .avif cache file.",
      "Assert the result has an ftyp box with avif or avis compatible brand.",
      "Decode the result with ImageDecoder and assert dimensions match the processed bitmap.",
      "Assert metadata='preserve', output.maxBytes, and animated AVIF preservation reject with documented unsupported errors until implemented.",
      "Keep getImageCompressionCapabilities().formats.avif.output=false until the encode and decode-back smoke passes in instrumentation."
    )

  private fun createProductionBoundaryBlockers(
    metadataPolicy: String,
    maxBytesRequested: Boolean
  ): List<String> =
    buildList {
      add(PRODUCTION_DECISION_KEEP_DISABLED)
      add(PRODUCTION_GATE_MESSAGE)
      add(AndroidAvifOutputHelper.HELPER_DISABLED_FROM_COMPRESS_IMAGE)
      add(
        if (metadataPolicy == "preserve") {
          "metadata='preserve' was requested and is blocked before Android AVIF output production helper entry."
        } else {
          METADATA_PRESERVE_HELPER_ENTRY_BLOCKER
        }
      )
      add(
        if (maxBytesRequested) {
          "output.maxBytes was requested and is blocked before Android AVIF output production helper entry."
        } else {
          OUTPUT_MAX_BYTES_HELPER_ENTRY_BLOCKER
        }
      )
      add(ANIMATED_AVIF_HELPER_ENTRY_BLOCKER)
      add("Keep getImageCompressionCapabilities().formats.avif.output=false.")
    }

  private fun estimatePrototypeBitrate(width: Int, height: Int): Int =
    (width * height * 8).coerceAtLeast(MIN_PROTOTYPE_BITRATE)

  private fun AndroidAvifOutputHelperResult.toSmokeResult(apiLevel: Int): AndroidAvifEncodeDecodeSmokeResult =
    AndroidAvifEncodeDecodeSmokeResult(
      apiLevel = apiLevel,
      attempted = attempted,
      success = success,
      encoderName = encoderName,
      route = route,
      outputFilePath = outputFilePath,
      byteSize = byteSize,
      signatureValid = signatureValid,
      decodeBackValid = decodeBackValid,
      decodedWidth = decodedWidth,
      decodedHeight = decodedHeight,
      blockerCode = blockerCode,
      blocker = blocker,
      outputCanBeEnabled = false,
      productionDecision = productionDecision,
      details = details
    )

  private const val MIN_PROTOTYPE_BITRATE = 64_000
  private const val PROTOTYPE_WIDTH = 16
  private const val PROTOTYPE_HEIGHT = 12
}
