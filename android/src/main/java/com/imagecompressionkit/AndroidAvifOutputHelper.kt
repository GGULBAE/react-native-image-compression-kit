package com.imagecompressionkit

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.ImageDecoder
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.charset.StandardCharsets

internal data class AndroidAvifOutputHelperInput(
  val cacheDir: File,
  val width: Int,
  val height: Int,
  val apiLevel: Int,
  val sdkEligible: Boolean,
  val encoderName: String?,
  val routeBlockers: List<String>,
  val helperRoute: String = AndroidAvifOutputHelper.PRODUCTION_HELPER_ROUTE
)

internal data class AndroidAvifOutputHelperResult(
  val helperRoute: String,
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
  val productionDecision: String,
  val details: List<String>
)

internal data class AndroidAvifOutputHelperOutput(
  val directBytes: ByteArray,
  val outputFormat: MediaFormat,
  val samples: List<AndroidAvifOutputHelperSample>,
  val details: List<String>
)

internal data class AndroidAvifOutputHelperSample(
  val bytes: ByteArray,
  val presentationTimeUs: Long,
  val flags: Int
)

internal data class AndroidAvifOutputHelperFileValidation(
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

internal data class AndroidAvifOutputHelperDependencies(
  val createBitmap: (width: Int, height: Int) -> Bitmap,
  val encodeBitmap: (encoderName: String, bitmap: Bitmap) -> AndroidAvifOutputHelperOutput,
  val createOutputFile: (cacheDir: File, suffix: String) -> File,
  val muxEncodedSamples: (
    outputFile: File,
    outputFormat: MediaFormat,
    samples: List<AndroidAvifOutputHelperSample>
  ) -> List<String>,
  val validateFile: (
    file: File,
    expectedWidth: Int,
    expectedHeight: Int
  ) -> AndroidAvifOutputHelperFileValidation
)

internal object AndroidAvifOutputHelper {
  const val PRODUCTION_HELPER_ROUTE =
    "Android AVIF output encode/decode-back production helper"
  const val HELPER_DISABLED_FROM_COMPRESS_IMAGE =
    "compressImage() keeps output.format='avif' on ERR_NOT_IMPLEMENTED before entering the extracted Android AVIF output helper while avif.output=false."
  const val INJECTABLE_VALIDATION_SEAM =
    "Android AVIF output helper uses injectable encoder, muxer, file, and decode-back validation dependencies for fake success/failure coverage while avif.output=false."

  fun createInput(
    cacheDir: File,
    width: Int,
    height: Int,
    routeReport: AndroidAvifOutputPrototypeReport
  ): AndroidAvifOutputHelperInput =
    AndroidAvifOutputHelperInput(
      cacheDir = cacheDir,
      width = width,
      height = height,
      apiLevel = routeReport.apiLevel,
      sdkEligible = routeReport.sdkEligible,
      encoderName = routeReport.imageAvifEncoderName,
      routeBlockers = routeReport.blockers
    )

  fun createImageAvifMediaFormat(width: Int, height: Int): MediaFormat {
    require(width > 0) { "AVIF prototype width must be positive." }
    require(height > 0) { "AVIF prototype height must be positive." }

    return MediaFormat().apply {
      setString(MediaFormat.KEY_MIME, AndroidAvifOutputPrototype.AVIF_MIME_TYPE)
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

  fun createDefaultDependencies(): AndroidAvifOutputHelperDependencies =
    AndroidAvifOutputHelperDependencies(
      createBitmap = ::createHelperBitmap,
      encodeBitmap = ::encodeBitmap,
      createOutputFile = ::createHelperFile,
      muxEncodedSamples = ::muxEncodedSamples,
      validateFile = ::validateAvifFile
    )

  fun runEncodeDecodeBack(
    input: AndroidAvifOutputHelperInput,
    dependencies: AndroidAvifOutputHelperDependencies = createDefaultDependencies()
  ): AndroidAvifOutputHelperResult {
    if (!input.sdkEligible) {
      return blockedHelperResult(
        input = input,
        attempted = false,
        blockerCode = AndroidAvifOutputPrototype.BLOCKER_CODE_SDK_UNAVAILABLE,
        blocker = "Android AVIF output encode/decode-back smoke requires Android 14+."
      )
    }

    val encoderName = input.encoderName
      ?: return blockedHelperResult(
        input = input,
        attempted = false,
        blockerCode = AndroidAvifOutputPrototype.BLOCKER_CODE_NO_IMAGE_AVIF_ENCODER,
        blocker = AndroidAvifOutputPrototype.NO_IMAGE_AVIF_ENCODER_BLOCKER
      )

    return try {
      val bitmap = dependencies.createBitmap(input.width, input.height)
      try {
        val encodedOutput = dependencies.encodeBitmap(encoderName, bitmap)
        val directFile = dependencies.createOutputFile(input.cacheDir, "direct")
        directFile.writeBytes(encodedOutput.directBytes)
        val directValidation = dependencies.validateFile(directFile, input.width, input.height)
        if (directValidation.success) {
          return directValidation.toHelperResult(
            input = input,
            encoderName = encoderName,
            route = "${AndroidAvifOutputPrototype.SMOKE_ROUTE} direct encoder output",
            details = encodedOutput.details
          )
        }

        val muxedFile = dependencies.createOutputFile(input.cacheDir, "muxed")
        val muxDetails = dependencies.muxEncodedSamples(
          muxedFile,
          encodedOutput.outputFormat,
          encodedOutput.samples
        )
        val muxedValidation = dependencies.validateFile(muxedFile, input.width, input.height)
        muxedValidation.toHelperResult(
          input = input,
          encoderName = encoderName,
          route = "${AndroidAvifOutputPrototype.SMOKE_ROUTE} via MediaMuxer.MUXER_OUTPUT_HEIF",
          details = encodedOutput.details + directValidation.details + muxDetails
        )
      } finally {
        bitmap.recycle()
      }
    } catch (error: Exception) {
      blockedHelperResult(
        input = input,
        attempted = true,
        blockerCode = AndroidAvifOutputPrototype.BLOCKER_CODE_CODEC_FAILURE,
        blocker = codecFailureBlocker(error)
      )
    }
  }

  fun classifyValidationBlocker(
    signatureValid: Boolean,
    decodeBackValid: Boolean
  ): AndroidAvifSmokeBlocker? =
    when {
      !signatureValid -> AndroidAvifSmokeBlocker(
        code = AndroidAvifOutputPrototype.BLOCKER_CODE_INVALID_SIGNATURE,
        message = AndroidAvifOutputPrototype.INVALID_SIGNATURE_BLOCKER
      )
      !decodeBackValid -> AndroidAvifSmokeBlocker(
        code = AndroidAvifOutputPrototype.BLOCKER_CODE_DECODE_BACK_FAILURE,
        message = AndroidAvifOutputPrototype.DECODE_BACK_FAILURE_BLOCKER
      )
      else -> null
    }

  fun codecFailureBlocker(error: Exception): String =
    "${AndroidAvifOutputPrototype.CODEC_FAILURE_BLOCKER_PREFIX}: ${error.javaClass.simpleName}: ${error.message ?: "no message"}"

  private fun createHelperBitmap(width: Int, height: Int): Bitmap =
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

  private fun encodeBitmap(
    encoderName: String,
    bitmap: Bitmap
  ): AndroidAvifOutputHelperOutput {
    val codec = MediaCodec.createByCodecName(encoderName)
    val samples = mutableListOf<AndroidAvifOutputHelperSample>()
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

      queueInput(codec, bitmap)
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
                    AndroidAvifOutputHelperSample(
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

      return AndroidAvifOutputHelperOutput(
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

  private fun queueInput(codec: MediaCodec, bitmap: Bitmap) {
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
    samples: List<AndroidAvifOutputHelperSample>
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
  ): AndroidAvifOutputHelperFileValidation {
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

    return AndroidAvifOutputHelperFileValidation(
      file = file,
      signatureValid = signatureValid,
      decodeBackValid = decodeBackValid,
      decodedWidth = decodedWidth,
      decodedHeight = decodedHeight,
      details = details
    )
  }

  private fun createHelperFile(cacheDir: File, suffix: String): File =
    File(
      cacheDir,
      "rnick-avif-output-smoke-${System.nanoTime()}-$suffix.avif"
    )

  private fun AndroidAvifOutputHelperFileValidation.toHelperResult(
    input: AndroidAvifOutputHelperInput,
    encoderName: String,
    route: String,
    details: List<String>
  ): AndroidAvifOutputHelperResult {
    val validationBlocker = classifyValidationBlocker(
      signatureValid = signatureValid,
      decodeBackValid = decodeBackValid
    )
    val success = validationBlocker == null

    return AndroidAvifOutputHelperResult(
      helperRoute = input.helperRoute,
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
      blockerCode = validationBlocker?.code,
      blocker = validationBlocker?.message,
      productionDecision = if (success) {
        AndroidAvifOutputPrototype.PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED
      } else {
        AndroidAvifOutputPrototype.PRODUCTION_DECISION_KEEP_DISABLED
      },
      details = listOf(INJECTABLE_VALIDATION_SEAM) + details + this.details + input.routeBlockers
    )
  }

  private fun blockedHelperResult(
    input: AndroidAvifOutputHelperInput,
    attempted: Boolean,
    blockerCode: String,
    blocker: String
  ): AndroidAvifOutputHelperResult =
    AndroidAvifOutputHelperResult(
      helperRoute = input.helperRoute,
      attempted = attempted,
      success = false,
      encoderName = input.encoderName,
      route = AndroidAvifOutputPrototype.SMOKE_ROUTE,
      outputFilePath = null,
      byteSize = 0L,
      signatureValid = false,
      decodeBackValid = false,
      decodedWidth = null,
      decodedHeight = null,
      blockerCode = blockerCode,
      blocker = blocker,
      productionDecision = AndroidAvifOutputPrototype.PRODUCTION_DECISION_KEEP_DISABLED,
      details = input.routeBlockers + INJECTABLE_VALIDATION_SEAM + HELPER_DISABLED_FROM_COMPRESS_IMAGE
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
  private const val CODEC_TIMEOUT_US = 5_000_000L
  private const val MAX_TRY_AGAIN_COUNT = 6
}
