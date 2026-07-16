package com.imagecompressionkit

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File

class ImageCompressionKitModule(
  private val reactContext: ReactApplicationContext,
  private val writableMapFactory: () -> WritableMap = { Arguments.createMap() },
  private val writableArrayFactory: () -> WritableArray = { Arguments.createArray() }
) : NativeImageCompressionKitSpec(reactContext) {
  private val imageSourceResolver = AndroidImageSourceResolver(
    reactContext.contentResolver
  )
  private val imageDecoder = AndroidImageDecoder(imageSourceResolver)
  private val bitmapTransformer = AndroidBitmapTransformer()

  override fun getName(): String = NAME

  override fun compressImage(options: ReadableMap, promise: Promise) {
    try {
      val request = try {
        AndroidCompressionRequestParser.parse(options)
      } catch (error: AndroidCompressionRequestException) {
        reject(promise, error.code, error.message ?: "Android MVP compression failed.", error)
        return
      }
      val inputSource = request.source
      val decodedInput = try {
        when (val decodeResult = imageDecoder.decode(inputSource)) {
          is AndroidImageDecodeResult.Success -> decodeResult
          is AndroidImageDecodeResult.UnsupportedFormat -> {
            reject(promise, ERR_UNSUPPORTED_FORMAT, decodeResult.message)
            return
          }
          AndroidImageDecodeResult.DecodeFailed -> {
            reject(promise, ERR_DECODE_FAILED, "Android MVP could not decode the source image.")
            return
          }
        }
      } catch (error: AndroidImageSourceAccessException) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          error.message ?: "Android MVP could not read the source image URI.",
          error
        )
        return
      }
      val inputInfo = decodedInput.inputInfo
      val transformation = bitmapTransformer.transform(
        decodedInput.bitmap,
        inputInfo.exifOrientation,
        request.resize
      )
      val compressionResult = transformation.use { ownedTransformation ->
        val transformed = ownedTransformation.result
        val outputFile = ImageCompressionOutput.createOutputFile(
          reactContext.cacheDir,
          request.outputFormat
        )
        val didEncode = try {
          val copiedExifMetadata = if (
            inputInfo.format.supportsJpegExifMetadata &&
            request.outputFormat.supportsJpegExifMetadata
          ) {
            createCopiedExifMetadata(
              request.metadataPolicy,
              inputSource,
              transformed.dimensions
            )
          } else {
            null
          }

          ImageCompressionOutput.encodeBitmap(
            transformed.bitmap,
            outputFile,
            request.outputFormat,
            request.quality,
            request.maxBytes,
            copiedExifMetadata
          )
        } catch (error: MetadataCopyException) {
          reject(
            promise,
            ERR_ENCODE_FAILED,
            error.message ?: "Android MVP could not copy JPEG metadata.",
            error
          )
          return
        } catch (error: Exception) {
          reject(
            promise,
            ERR_ENCODE_FAILED,
            error.message ?: "Android MVP could not encode the selected output format.",
            error
          )
          return
        }

        if (!didEncode) {
          reject(
            promise,
            ERR_ENCODE_FAILED,
            "Android MVP could not encode the selected output format."
          )
          return
        }

        createCompressionResult(
          inputInfo.originalByteSize,
          outputFile,
          transformed.dimensions,
          request.outputFormat
        )
      }
      promise.resolve(compressionResult)
    } catch (error: Exception) {
      reject(
        promise,
        ERR_NATIVE_OPERATION_FAILED,
        "Android MVP compression failed.",
        error
      )
    }
  }

  override fun getImageCompressionCapabilities(promise: Promise) {
    promise.resolve(createStubCapabilities())
  }

  private fun createStubCapabilities(): WritableMap =
    writableMapFactory().apply {
      putString("platform", "android")
      putArray("formats", createFormatCapabilities())
      putArray("metadataPolicies", createMetadataPolicies())
      putBoolean("supportsTargetSizeCompression", true)
      putBoolean("supportsCancellation", false)
    }

  private fun createFormatCapabilities(): WritableArray =
    writableArrayFactory().apply {
      ImageCompressionOutput.FORMAT_VALUES.forEach { format ->
        pushMap(createFormatCapability(format))
      }
    }

  private fun createFormatCapability(format: String): WritableMap {
    val capability = ImageCompressionOutput.createFormatCapability(format)

    return writableMapFactory().apply {
      putString("format", capability.format)
      putBoolean("input", capability.input)
      putBoolean("output", capability.output)
      putBoolean("supportsAlpha", capability.supportsAlpha)
      putBoolean("supportsAnimation", capability.supportsAnimation)
      putArray("notes", createStringArray(capability.notes))
    }
  }

  private fun createMetadataPolicies(): WritableArray =
    writableArrayFactory().apply {
      pushString(METADATA_POLICY_PRESERVE)
      pushString(METADATA_POLICY_SAFE)
      pushString(METADATA_POLICY_STRIP)
    }

  private fun createStringArray(values: List<String>): WritableArray =
    writableArrayFactory().apply {
      values.forEach { value ->
        pushString(value)
      }
    }

  private fun createCopiedExifMetadata(
    metadataPolicy: MetadataPolicy,
    inputSource: AndroidCompressionSource,
    dimensions: AndroidBitmapDimensions
  ): CopiedExifMetadata? {
    val exifTags = when (metadataPolicy) {
      MetadataPolicy.PRESERVE -> JpegExifMetadata.PRESERVED_EXIF_TAGS
      MetadataPolicy.SAFE -> JpegExifMetadata.SAFE_EXIF_TAGS
      MetadataPolicy.STRIP -> return null
    }

    try {
      imageSourceResolver.openInputStream(inputSource).buffered().use { inputStream ->
        return JpegExifMetadata.read(
          inputStream = inputStream,
          exifTags = exifTags,
          width = dimensions.width,
          height = dimensions.height
        )
      }
    } catch (error: Exception) {
      throw MetadataCopyException(
        "Android MVP could not read source EXIF metadata.",
        error
      )
    }
  }

  private fun createCompressionResult(
    originalByteSize: Long,
    outputFile: File,
    dimensions: AndroidBitmapDimensions,
    outputFormat: OutputFormat
  ): WritableMap {
    val outputResult = ImageCompressionOutput.createResultMetadata(
      originalByteSize = originalByteSize,
      outputFile = outputFile,
      dimensions = CompressionOutputDimensions(
        width = dimensions.width,
        height = dimensions.height
      ),
      outputFormat = outputFormat
    )

    return writableMapFactory().apply {
      putString("uri", outputResult.uri)
      putString("format", outputResult.format)
      putInt("width", outputResult.width)
      putInt("height", outputResult.height)
      putDouble("byteSize", outputResult.byteSize.toDouble())
      putDouble("originalByteSize", outputResult.originalByteSize.toDouble())
      putDouble("compressionRatio", outputResult.compressionRatio)
    }
  }

  private fun reject(
    promise: Promise,
    code: String,
    message: String,
    throwable: Throwable? = null
  ) {
    promise.reject(code, message, throwable)
  }

  private class MetadataCopyException(
    message: String,
    cause: Throwable? = null
  ) : Exception(message, cause)

  companion object {
    const val NAME = "ImageCompressionKit"
    const val ERR_INVALID_OPTIONS = ANDROID_ERR_INVALID_OPTIONS
    const val ERR_UNSUPPORTED_SOURCE = ANDROID_ERR_UNSUPPORTED_SOURCE
    const val ERR_UNSUPPORTED_FORMAT = "ERR_UNSUPPORTED_FORMAT"
    const val ERR_NOT_IMPLEMENTED = ANDROID_ERR_NOT_IMPLEMENTED
    const val ERR_FILE_ACCESS = "ERR_FILE_ACCESS"
    const val ERR_DECODE_FAILED = "ERR_DECODE_FAILED"
    const val ERR_ENCODE_FAILED = "ERR_ENCODE_FAILED"
    const val ERR_NATIVE_OPERATION_FAILED = ANDROID_ERR_NATIVE_OPERATION_FAILED
  }
}
