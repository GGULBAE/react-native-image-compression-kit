package com.imagecompressionkit

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.ImageDecoder
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaCodecList
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.Build
import java.io.ByteArrayOutputStream
import java.io.File
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
  val blocker: String?,
  val details: List<String>
)

internal object AndroidAvifOutputPrototype {
  const val AVIF_MIME_TYPE = "image/avif"
  const val AV1_VIDEO_MIME_TYPE = "video/av01"
  const val CANDIDATE_ROUTE = "MediaCodec image/avif encoder probe"
  const val SMOKE_ROUTE = "MediaCodec image/avif encode/decode-back smoke"
  const val PRODUCTION_GATE_MESSAGE =
    "AVIF output production gate remains closed until production wiring, byte-signature, ImageDecoder decode-back, metadata preserve, output.maxBytes, and animated AVIF boundaries are explicitly validated."

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
    if (!routeReport.sdkEligible) {
      return blockedSmokeResult(
        report = routeReport,
        attempted = false,
        blocker = "Android AVIF output encode/decode-back smoke requires Android 14+."
      )
    }

    val encoderName = routeReport.imageAvifEncoderName
      ?: return blockedSmokeResult(
        report = routeReport,
        attempted = false,
        blocker = "No image/avif encoder was discovered through MediaCodecList.findEncoderForFormat()."
      )

    return try {
      val bitmap = createPrototypeBitmap(width, height)
      try {
        val encodedOutput = encodePrototypeBitmap(encoderName, bitmap)
        val directFile = createSmokeFile(cacheDir, "direct")
        directFile.writeBytes(encodedOutput.directBytes)
        val directValidation = validateAvifFile(directFile, width, height)
        if (directValidation.success) {
          return directValidation.toSmokeResult(
            report = routeReport,
            encoderName = encoderName,
            route = "$SMOKE_ROUTE direct encoder output",
            details = encodedOutput.details
          )
        }

        val muxedFile = createSmokeFile(cacheDir, "muxed")
        val muxDetails = muxEncodedSamples(
          outputFile = muxedFile,
          outputFormat = encodedOutput.outputFormat,
          samples = encodedOutput.samples
        )
        val muxedValidation = validateAvifFile(muxedFile, width, height)
        muxedValidation.toSmokeResult(
          report = routeReport,
          encoderName = encoderName,
          route = "$SMOKE_ROUTE via MediaMuxer.MUXER_OUTPUT_HEIF",
          details = encodedOutput.details + directValidation.details + muxDetails
        )
      } finally {
        bitmap.recycle()
      }
    } catch (error: Exception) {
      blockedSmokeResult(
        report = routeReport,
        attempted = true,
        blocker = "MediaCodec image/avif encode/decode-back smoke failed: ${error.javaClass.simpleName}: ${error.message ?: "no message"}"
      )
    }
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

  private fun estimatePrototypeBitrate(width: Int, height: Int): Int =
    (width * height * 8).coerceAtLeast(MIN_PROTOTYPE_BITRATE)

  private fun createPrototypeBitmap(width: Int, height: Int): Bitmap =
    Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
      for (y in 0 until height) {
        for (x in 0 until width) {
          val red = ((x * 255) / (width - 1).coerceAtLeast(1))
          val green = ((y * 255) / (height - 1).coerceAtLeast(1))
          val blue = if ((x + y) % 2 == 0) 48 else 208
          setPixel(x, y, Color.rgb(red, green, blue))
        }
      }
    }

  private fun encodePrototypeBitmap(
    encoderName: String,
    bitmap: Bitmap
  ): EncodedAvifOutput {
    val codec = MediaCodec.createByCodecName(encoderName)
    val samples = mutableListOf<EncodedSample>()
    val directBytes = ByteArrayOutputStream()
    val details = mutableListOf("Encoder: $encoderName")
    var outputFormat: MediaFormat? = null

    try {
      codec.configure(
        createImageAvifMediaFormat(bitmap.width, bitmap.height),
        null,
        null,
        MediaCodec.CONFIGURE_FLAG_ENCODE
      )
      codec.start()

      queuePrototypeInput(codec, bitmap)
      val bufferInfo = MediaCodec.BufferInfo()
      var sawOutputEnd = false
      var tryAgainCount = 0

      while (!sawOutputEnd && tryAgainCount < MAX_TRY_AGAIN_COUNT) {
        when (val outputIndex = codec.dequeueOutputBuffer(bufferInfo, CODEC_TIMEOUT_US)) {
          MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            outputFormat = codec.outputFormat
            details.add("Output format changed: $outputFormat")
          }
          MediaCodec.INFO_TRY_AGAIN_LATER -> {
            tryAgainCount += 1
          }
          MediaCodec.INFO_OUTPUT_BUFFERS_CHANGED -> Unit
          else -> {
            if (outputIndex >= 0) {
              tryAgainCount = 0
              val outputBuffer = codec.getOutputBuffer(outputIndex)
                ?: throw IllegalStateException("MediaCodec returned a null AVIF output buffer.")
              if (bufferInfo.size > 0) {
                val sampleBytes = ByteArray(bufferInfo.size)
                val previousPosition = outputBuffer.position()
                val previousLimit = outputBuffer.limit()
                outputBuffer.position(bufferInfo.offset)
                outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                outputBuffer.get(sampleBytes)
                outputBuffer.position(previousPosition)
                outputBuffer.limit(previousLimit)
                directBytes.write(sampleBytes)

                if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                  samples.add(
                    EncodedSample(
                      bytes = sampleBytes,
                      presentationTimeUs = bufferInfo.presentationTimeUs,
                      flags = bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM.inv()
                    )
                  )
                }
              }

              sawOutputEnd =
                (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
              codec.releaseOutputBuffer(outputIndex, false)
            }
          }
        }
      }

      if (!sawOutputEnd) {
        throw IllegalStateException("Timed out waiting for AVIF encoder output EOS.")
      }
      if (directBytes.size() == 0) {
        throw IllegalStateException("AVIF encoder produced no output bytes.")
      }
      if (samples.isEmpty()) {
        throw IllegalStateException("AVIF encoder produced no muxable media samples.")
      }

      if (outputFormat == null) {
        outputFormat = codec.outputFormat
        details.add("Output format after EOS: $outputFormat")
      }

      return EncodedAvifOutput(
        directBytes = directBytes.toByteArray(),
        outputFormat = outputFormat
          ?: throw IllegalStateException("AVIF encoder did not expose an output format."),
        samples = samples,
        details = details
      )
    } finally {
      try {
        codec.stop()
      } catch (_: RuntimeException) {
        // The codec can already be stopped after configure/start failures.
      }
      codec.release()
    }
  }

  private fun queuePrototypeInput(codec: MediaCodec, bitmap: Bitmap) {
    val inputIndex = codec.dequeueInputBuffer(CODEC_TIMEOUT_US)
    if (inputIndex < 0) {
      throw IllegalStateException("Timed out waiting for an AVIF encoder input buffer.")
    }

    val inputCapacity = codec.getInputBuffer(inputIndex)?.capacity()
      ?: estimateYuv420Size(bitmap.width, bitmap.height)
    val inputImage = codec.getInputImage(inputIndex)
      ?: throw IllegalStateException("AVIF encoder did not expose a writable YUV input image.")

    writeBitmapToYuv420Image(bitmap, inputImage)
    codec.queueInputBuffer(
      inputIndex,
      0,
      inputCapacity,
      0L,
      MediaCodec.BUFFER_FLAG_END_OF_STREAM
    )
  }

  private fun writeBitmapToYuv420Image(bitmap: Bitmap, image: Image) {
    val planes = image.planes
    require(planes.size >= 3) { "YUV420 input image must expose three planes." }

    val yPlane = planes[0]
    val uPlane = planes[1]
    val vPlane = planes[2]

    for (y in 0 until bitmap.height) {
      for (x in 0 until bitmap.width) {
        val color = bitmap.getPixel(x, y)
        val red = Color.red(color)
        val green = Color.green(color)
        val blue = Color.blue(color)
        putPlaneByte(yPlane, x, y, rgbToY(red, green, blue))

        if (x % 2 == 0 && y % 2 == 0) {
          val chromaX = x / 2
          val chromaY = y / 2
          putPlaneByte(uPlane, chromaX, chromaY, rgbToU(red, green, blue))
          putPlaneByte(vPlane, chromaX, chromaY, rgbToV(red, green, blue))
        }
      }
    }
  }

  private fun putPlaneByte(
    plane: Image.Plane,
    x: Int,
    y: Int,
    value: Byte
  ) {
    val index = y * plane.rowStride + x * plane.pixelStride
    if (index < plane.buffer.limit()) {
      plane.buffer.put(index, value)
    }
  }

  private fun muxEncodedSamples(
    outputFile: File,
    outputFormat: MediaFormat,
    samples: List<EncodedSample>
  ): List<String> {
    val details = mutableListOf("Muxer output format: $outputFormat")
    val muxer = MediaMuxer(
      outputFile.absolutePath,
      MediaMuxer.OutputFormat.MUXER_OUTPUT_HEIF
    )

    try {
      val trackIndex = muxer.addTrack(outputFormat)
      muxer.start()
      samples.forEach { sample ->
        val info = MediaCodec.BufferInfo().apply {
          set(
            0,
            sample.bytes.size,
            sample.presentationTimeUs,
            sample.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG.inv()
          )
        }
        muxer.writeSampleData(trackIndex, sample.bytes.toByteBuffer(), info)
      }
      muxer.stop()
      details.add("Muxed ${samples.size} AVIF sample(s) into ${outputFile.name}.")
    } finally {
      muxer.release()
    }

    return details
  }

  private fun validateAvifFile(
    file: File,
    expectedWidth: Int,
    expectedHeight: Int
  ): AvifFileValidation {
    val bytes = if (file.exists()) file.readBytes() else ByteArray(0)
    val signatureValid = looksLikeAvifFile(bytes)
    var decodedWidth: Int? = null
    var decodedHeight: Int? = null
    val details = mutableListOf(
      "${file.name}: ${bytes.size} byte(s), signatureValid=$signatureValid"
    )
    val decodeBackValid = if (signatureValid) {
      try {
        val source = ImageDecoder.createSource(file)
        val decodedBitmap = ImageDecoder.decodeBitmap(source) { decoder, _, _ ->
          decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
        try {
          decodedWidth = decodedBitmap.width
          decodedHeight = decodedBitmap.height
          decodedBitmap.width == expectedWidth && decodedBitmap.height == expectedHeight
        } finally {
          decodedBitmap.recycle()
        }
      } catch (error: Exception) {
        details.add("ImageDecoder decode-back failed: ${error.javaClass.simpleName}: ${error.message ?: "no message"}")
        false
      }
    } else {
      false
    }

    return AvifFileValidation(
      file = file,
      signatureValid = signatureValid,
      decodeBackValid = decodeBackValid,
      decodedWidth = decodedWidth,
      decodedHeight = decodedHeight,
      details = details
    )
  }

  private fun createSmokeFile(cacheDir: File, suffix: String): File =
    File(
      cacheDir,
      "rnick-avif-output-smoke-${System.nanoTime()}-$suffix.avif"
    )

  private fun AvifFileValidation.toSmokeResult(
    report: AndroidAvifOutputPrototypeReport,
    encoderName: String,
    route: String,
    details: List<String>
  ): AndroidAvifEncodeDecodeSmokeResult {
    val success = signatureValid && decodeBackValid
    val blocker = if (success) {
      null
    } else {
      "AVIF smoke did not produce a file that passed ftyp avif/avis signature and ImageDecoder decode-back validation."
    }

    return AndroidAvifEncodeDecodeSmokeResult(
      apiLevel = report.apiLevel,
      attempted = true,
      success = success,
      encoderName = encoderName,
      route = route,
      outputFilePath = file.absolutePath,
      byteSize = if (file.exists()) file.length() else 0L,
      signatureValid = signatureValid,
      decodeBackValid = decodeBackValid,
      decodedWidth = decodedWidth,
      decodedHeight = decodedHeight,
      blocker = blocker,
      details = details + this.details
    )
  }

  private fun blockedSmokeResult(
    report: AndroidAvifOutputPrototypeReport,
    attempted: Boolean,
    blocker: String
  ): AndroidAvifEncodeDecodeSmokeResult =
    AndroidAvifEncodeDecodeSmokeResult(
      apiLevel = report.apiLevel,
      attempted = attempted,
      success = false,
      encoderName = report.imageAvifEncoderName,
      route = SMOKE_ROUTE,
      outputFilePath = null,
      byteSize = 0L,
      signatureValid = false,
      decodeBackValid = false,
      decodedWidth = null,
      decodedHeight = null,
      blocker = blocker,
      details = report.blockers
    )

  private fun ByteArray.toByteBuffer() =
    java.nio.ByteBuffer.wrap(this)

  private fun estimateYuv420Size(width: Int, height: Int): Int =
    ((width * height * 3) / 2).coerceAtLeast(1)

  private fun rgbToY(red: Int, green: Int, blue: Int): Byte =
    clampToByte(((66 * red + 129 * green + 25 * blue + 128) shr 8) + 16)

  private fun rgbToU(red: Int, green: Int, blue: Int): Byte =
    clampToByte(((-38 * red - 74 * green + 112 * blue + 128) shr 8) + 128)

  private fun rgbToV(red: Int, green: Int, blue: Int): Byte =
    clampToByte(((112 * red - 94 * green - 18 * blue + 128) shr 8) + 128)

  private fun clampToByte(value: Int): Byte =
    value.coerceIn(0, 255).toByte()

  private const val MIN_AVIF_SIGNATURE_BYTES = 12
  private const val AVIF_BRAND_SCAN_BYTES = 32
  private const val MIN_PROTOTYPE_BITRATE = 64_000
  private const val CODEC_TIMEOUT_US = 5_000_000L
  private const val MAX_TRY_AGAIN_COUNT = 6
  private const val PROTOTYPE_WIDTH = 16
  private const val PROTOTYPE_HEIGHT = 12

  private data class EncodedAvifOutput(
    val directBytes: ByteArray,
    val outputFormat: MediaFormat,
    val samples: List<EncodedSample>,
    val details: List<String>
  )

  private data class EncodedSample(
    val bytes: ByteArray,
    val presentationTimeUs: Long,
    val flags: Int
  )

  private data class AvifFileValidation(
    val file: File,
    val signatureValid: Boolean,
    val decodeBackValid: Boolean,
    val decodedWidth: Int?,
    val decodedHeight: Int?,
    val details: List<String>
  ) {
    val success: Boolean
      get() = signatureValid && decodeBackValid
  }
}
