package com.imagecompressionkit

import android.graphics.Bitmap
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import kotlin.math.roundToInt

class ImageCompressionKitModule(
  private val reactContext: ReactApplicationContext,
  private val writableMapFactory: () -> WritableMap = { Arguments.createMap() },
  private val writableArrayFactory: () -> WritableArray = { Arguments.createArray() }
) : NativeImageCompressionKitSpec(reactContext) {
  private val imageSourceResolver = AndroidImageSourceResolver(
    reactContext.contentResolver
  )
  private val imageDecoder = AndroidImageDecoder(imageSourceResolver)

  override fun getName(): String = NAME

  override fun compressImage(options: ReadableMap, promise: Promise) {
    try {
      val request = try {
        AndroidCompressionRequestParser.parse(options)
      } catch (error: AndroidCompressionRequestException) {
        reject(
          promise,
          error.code,
          error.message ?: "Android MVP compression failed.",
          error
        )
        return
      }
      val inputSource = request.source
      val resize = request.resize
      val outputFormat = request.outputFormat
      val quality = request.quality
      val maxBytes = request.maxBytes
      val metadataPolicy = request.metadataPolicy

      val decodeResult = try {
        imageDecoder.decode(inputSource)
      } catch (error: AndroidImageSourceAccessException) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          error.message ?: "Android MVP could not read the source image URI.",
          error
        )
        return
      }
      val decodedInput = when (decodeResult) {
        is AndroidImageDecodeResult.Success -> decodeResult
        is AndroidImageDecodeResult.UnsupportedFormat -> {
          reject(
            promise,
            ERR_UNSUPPORTED_FORMAT,
            decodeResult.message
          )
          return
        }
        AndroidImageDecodeResult.DecodeFailed -> {
          reject(
            promise,
            ERR_DECODE_FAILED,
            "Android MVP could not decode the source image."
          )
          return
        }
      }
      val inputInfo = decodedInput.inputInfo
      val originalByteSize = inputInfo.originalByteSize
      val inputFormat = inputInfo.format
      val bitmap = decodedInput.bitmap
      val orientedBitmap = applyExifOrientation(bitmap, inputInfo.exifOrientation)
      val processedBitmap = resizeBitmap(orientedBitmap, resize)
      val outputDimensions = ImageDimensions(
        width = processedBitmap.width,
        height = processedBitmap.height
      )
      val outputFile = ImageCompressionOutput.createOutputFile(
        reactContext.cacheDir,
        outputFormat
      )
      val didEncode: Boolean

      try {
        val copiedExifMetadata = if (
          inputFormat.supportsJpegExifMetadata &&
          outputFormat.supportsJpegExifMetadata
        ) {
          createCopiedExifMetadata(
            metadataPolicy,
            inputSource,
            outputDimensions
          )
        } else {
          null
        }

        didEncode = ImageCompressionOutput.encodeBitmap(
          processedBitmap,
          outputFile,
          outputFormat,
          quality,
          maxBytes,
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
      } finally {
        if (processedBitmap !== orientedBitmap) {
          processedBitmap.recycle()
        }
        if (orientedBitmap !== bitmap) {
          orientedBitmap.recycle()
        }
        bitmap.recycle()
      }

      if (!didEncode) {
        reject(
          promise,
          ERR_ENCODE_FAILED,
          "Android MVP could not encode the selected output format."
        )
        return
      }

      promise.resolve(
        createCompressionResult(
          originalByteSize,
          outputFile,
          outputDimensions,
          outputFormat
        )
      )
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
    dimensions: ImageDimensions
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

  private fun applyExifOrientation(bitmap: Bitmap, orientation: Int): Bitmap {
    val matrix = createExifOrientationMatrix(orientation) ?: return bitmap

    return Bitmap.createBitmap(
      bitmap,
      0,
      0,
      bitmap.width,
      bitmap.height,
      matrix,
      true
    )
  }

  private fun createExifOrientationMatrix(orientation: Int): Matrix? {
    val matrix = Matrix()

    when (orientation) {
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL ->
        matrix.setScale(-1f, 1f)
      ExifInterface.ORIENTATION_ROTATE_180 ->
        matrix.setRotate(180f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> {
        matrix.setRotate(180f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.setRotate(90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_90 ->
        matrix.setRotate(90f)
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.setRotate(-90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_270 ->
        matrix.setRotate(-90f)
      else -> return null
    }

    return matrix
  }

  private fun resizeBitmap(bitmap: Bitmap, resize: ResizeOptions?): Bitmap {
    if (resize == null) {
      return bitmap
    }

    return when (resize.mode) {
      ResizeMode.CONTAIN -> resizeContain(bitmap, resize)
      ResizeMode.COVER -> resizeCover(bitmap, resize)
      ResizeMode.STRETCH -> resizeStretch(bitmap, resize)
    }
  }

  private fun resizeContain(bitmap: Bitmap, resize: ResizeOptions): Bitmap {
    val scale = minOf(
      resize.maxWidth?.let { it.toDouble() / bitmap.width.toDouble() } ?: 1.0,
      resize.maxHeight?.let { it.toDouble() / bitmap.height.toDouble() } ?: 1.0,
      1.0
    )

    return createScaledBitmapIfNeeded(
      bitmap,
      scaledDimension(bitmap.width, scale),
      scaledDimension(bitmap.height, scale)
    )
  }

  private fun resizeCover(bitmap: Bitmap, resize: ResizeOptions): Bitmap {
    val maxWidth = resize.maxWidth
    val maxHeight = resize.maxHeight

    if (maxWidth == null || maxHeight == null) {
      return resizeContain(bitmap, resize)
    }

    val targetWidth = maxWidth.coerceAtMost(bitmap.width)
    val targetHeight = maxHeight.coerceAtMost(bitmap.height)
    val scale = minOf(
      maxOf(
        targetWidth.toDouble() / bitmap.width.toDouble(),
        targetHeight.toDouble() / bitmap.height.toDouble()
      ),
      1.0
    )
    val scaled = createScaledBitmapIfNeeded(
      bitmap,
      scaledDimension(bitmap.width, scale),
      scaledDimension(bitmap.height, scale)
    )
    val cropped = centerCropBitmap(
      scaled,
      targetWidth.coerceAtMost(scaled.width),
      targetHeight.coerceAtMost(scaled.height)
    )

    if (cropped !== scaled && scaled !== bitmap) {
      scaled.recycle()
    }

    return cropped
  }

  private fun resizeStretch(bitmap: Bitmap, resize: ResizeOptions): Bitmap {
    val targetWidth = resize.maxWidth?.coerceAtMost(bitmap.width) ?: bitmap.width
    val targetHeight = resize.maxHeight?.coerceAtMost(bitmap.height) ?: bitmap.height

    return createScaledBitmapIfNeeded(bitmap, targetWidth, targetHeight)
  }

  private fun createScaledBitmapIfNeeded(
    bitmap: Bitmap,
    targetWidth: Int,
    targetHeight: Int
  ): Bitmap {
    if (bitmap.width == targetWidth && bitmap.height == targetHeight) {
      return bitmap
    }

    return Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
  }

  private fun centerCropBitmap(
    bitmap: Bitmap,
    targetWidth: Int,
    targetHeight: Int
  ): Bitmap {
    if (bitmap.width == targetWidth && bitmap.height == targetHeight) {
      return bitmap
    }

    val x = ((bitmap.width - targetWidth) / 2).coerceAtLeast(0)
    val y = ((bitmap.height - targetHeight) / 2).coerceAtLeast(0)

    return Bitmap.createBitmap(bitmap, x, y, targetWidth, targetHeight)
  }

  private fun scaledDimension(value: Int, scale: Double): Int =
    (value.toDouble() * scale).roundToInt().coerceAtLeast(1)

  private fun createCompressionResult(
    originalByteSize: Long,
    outputFile: File,
    dimensions: ImageDimensions,
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

  private data class ImageDimensions(
    val width: Int,
    val height: Int
  )

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
