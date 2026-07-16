package com.imagecompressionkit

import android.annotation.TargetApi
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import kotlin.math.roundToInt

class ImageCompressionKitModule(
  private val reactContext: ReactApplicationContext,
  private val writableMapFactory: () -> WritableMap = { Arguments.createMap() },
  private val writableArrayFactory: () -> WritableArray = { Arguments.createArray() }
) : NativeImageCompressionKitSpec(reactContext) {
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

      val originalByteSize = try {
        readOriginalByteSize(inputSource)
      } catch (error: SourceAccessException) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          error.message ?: "Android MVP could not read the source image URI.",
          error
        )
        return
      }
      val unsupportedInputMimeTypeHint = readUnsupportedInputMimeTypeHint(inputSource)

      if (unsupportedInputMimeTypeHint != null) {
        reject(
          promise,
          ERR_UNSUPPORTED_FORMAT,
          unsupportedInputFormatMessage(unsupportedInputMimeTypeHint)
        )
        return
      }
      val inputFormatHint = readInputFormatHint(inputSource)

      val bounds = try {
        decodeBounds(inputSource)
      } catch (error: SourceAccessException) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          error.message ?: "Android MVP could not read the source image URI.",
          error
        )
        return
      }

      val inputFormat = InputFormat.fromMimeType(bounds?.mimeType) ?: inputFormatHint
      if (inputFormat == null) {
        val errorCode = if (bounds == null) {
          ERR_DECODE_FAILED
        } else {
          ERR_UNSUPPORTED_FORMAT
        }
        val errorMessage = if (bounds == null) {
          "Android MVP could not decode the source image."
        } else {
          DEFAULT_UNSUPPORTED_INPUT_FORMAT_MESSAGE
        }

        reject(
          promise,
          errorCode,
          errorMessage
        )
        return
      }

      val bitmap = try {
        decodeBitmap(inputSource, inputFormat)
      } catch (error: SourceAccessException) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          error.message ?: "Android MVP could not read the source image URI.",
          error
        )
        return
      }

      if (bitmap == null) {
        reject(
          promise,
          ERR_DECODE_FAILED,
          "Android MVP could not decode the source image."
        )
        return
      }

      val exifOrientation = if (inputFormat.supportsJpegExifMetadata) {
        readExifOrientation(inputSource)
      } else {
        ExifInterface.ORIENTATION_NORMAL
      }
      val orientedBitmap = applyExifOrientation(bitmap, exifOrientation)
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

  private fun readOriginalByteSize(inputSource: AndroidCompressionSource): Long =
    when (inputSource) {
      is AndroidCompressionSource.FileSource -> {
        val inputFile = inputSource.file

        if (!inputFile.exists() || !inputFile.isFile || !inputFile.canRead()) {
          throw SourceAccessException("Android MVP could not read the source file.")
        }

        inputFile.length()
      }
      is AndroidCompressionSource.ContentSource ->
        queryContentByteSize(inputSource.uri)
          ?: queryContentAssetLength(inputSource.uri)
          ?: countBytes(inputSource)
    }

  private fun queryContentByteSize(uri: Uri): Long? =
    try {
      reactContext.contentResolver.query(
        uri,
        arrayOf(OpenableColumns.SIZE),
        null,
        null,
        null
      )?.use { cursor ->
        val sizeColumnIndex = cursor.getColumnIndex(OpenableColumns.SIZE)

        if (
          sizeColumnIndex >= 0 &&
          cursor.moveToFirst() &&
          !cursor.isNull(sizeColumnIndex)
        ) {
          val size = cursor.getLong(sizeColumnIndex)
          if (size >= 0L) {
            size
          } else {
            null
          }
        } else {
          null
        }
      }
    } catch (_: Exception) {
      null
    }

  private fun queryContentAssetLength(uri: Uri): Long? =
    try {
      reactContext.contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
        if (descriptor.length >= 0L) {
          descriptor.length
        } else {
          null
        }
      }
    } catch (_: Exception) {
      null
    }

  private fun countBytes(inputSource: AndroidCompressionSource): Long =
    openInputStream(inputSource).use { inputStream ->
      val buffer = ByteArray(STREAM_BUFFER_SIZE)
      var totalBytes = 0L
      var bytesRead = inputStream.read(buffer)

      while (bytesRead != -1) {
        totalBytes += bytesRead.toLong()
        bytesRead = inputStream.read(buffer)
      }

      totalBytes
    }

  private fun decodeBounds(inputSource: AndroidCompressionSource): ImageBounds? {
    val options = BitmapFactory.Options().apply {
      inJustDecodeBounds = true
    }

    openInputStream(inputSource).buffered().use { inputStream ->
      BitmapFactory.decodeStream(inputStream, null, options)
    }

    if (options.outWidth <= 0 || options.outHeight <= 0) {
      return null
    }

    return ImageBounds(
      width = options.outWidth,
      height = options.outHeight,
      mimeType = options.outMimeType
    )
  }

  private fun decodeBitmap(
    inputSource: AndroidCompressionSource,
    inputFormat: InputFormat
  ): Bitmap? =
    when {
      inputFormat.usesAvifDecodePath -> decodeAvifBitmap(inputSource)
      inputFormat.usesHeifDecodePath -> decodeHeicHeifBitmap(inputSource)
      else -> decodeBitmapFactory(inputSource)
    }

  private fun decodeBitmapFactory(inputSource: AndroidCompressionSource): Bitmap? =
    openInputStream(inputSource).buffered().use { inputStream ->
      BitmapFactory.decodeStream(inputStream)
    }

  private fun decodeHeicHeifBitmap(inputSource: AndroidCompressionSource): Bitmap? =
    when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ->
        decodeHeicHeifBitmapWithImageDecoder(inputSource)
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ->
        decodeBitmapFactory(inputSource)
      else -> null
    }

  @TargetApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
  private fun decodeAvifBitmap(inputSource: AndroidCompressionSource): Bitmap? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      decodeAvifBitmapWithImageDecoder(inputSource)
    } else {
      null
    }

  @TargetApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
  private fun decodeAvifBitmapWithImageDecoder(inputSource: AndroidCompressionSource): Bitmap? =
    try {
      ImageDecoder.decodeBitmap(createImageDecoderSource(inputSource)) { decoder, _, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
      }
    } catch (_: Exception) {
      null
    }

  @TargetApi(Build.VERSION_CODES.P)
  private fun decodeHeicHeifBitmapWithImageDecoder(inputSource: AndroidCompressionSource): Bitmap? =
    try {
      ImageDecoder.decodeBitmap(createImageDecoderSource(inputSource)) { decoder, _, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
      }
    } catch (_: Exception) {
      null
    }

  @TargetApi(Build.VERSION_CODES.P)
  private fun createImageDecoderSource(inputSource: AndroidCompressionSource): ImageDecoder.Source =
    when (inputSource) {
      is AndroidCompressionSource.FileSource -> ImageDecoder.createSource(inputSource.file)
      is AndroidCompressionSource.ContentSource ->
        ImageDecoder.createSource(reactContext.contentResolver, inputSource.uri)
    }

  private fun readUnsupportedInputMimeTypeHint(inputSource: AndroidCompressionSource): String? {
    val contentMimeType = when (inputSource) {
      is AndroidCompressionSource.FileSource -> null
      is AndroidCompressionSource.ContentSource -> queryContentMimeType(inputSource.uri)
    }

    InputFormat.fromMimeType(contentMimeType)?.let { inputFormat ->
      if (!canDecodeInputFormat(inputFormat)) {
        return inputFormat.mimeType
      }
      return null
    }

    val fileExtension = when (inputSource) {
      is AndroidCompressionSource.FileSource -> inputSource.file.extension
      is AndroidCompressionSource.ContentSource ->
        inputSource.uri.lastPathSegment?.substringAfterLast('.', "")
    }

    val extensionInputFormat = InputFormat.fromFileExtension(fileExtension)

    return if (extensionInputFormat != null && !canDecodeInputFormat(extensionInputFormat)) {
      extensionInputFormat.mimeType
    } else {
      null
    }
  }

  private fun readInputFormatHint(inputSource: AndroidCompressionSource): InputFormat? {
    val contentMimeType = when (inputSource) {
      is AndroidCompressionSource.FileSource -> null
      is AndroidCompressionSource.ContentSource -> queryContentMimeType(inputSource.uri)
    }

    InputFormat.fromMimeType(contentMimeType)?.let { inputFormat ->
      return inputFormat
    }

    val fileExtension = when (inputSource) {
      is AndroidCompressionSource.FileSource -> inputSource.file.extension
      is AndroidCompressionSource.ContentSource ->
        inputSource.uri.lastPathSegment?.substringAfterLast('.', "")
    }

    return InputFormat.fromFileExtension(fileExtension)
  }

  private fun canDecodeInputFormat(inputFormat: InputFormat): Boolean =
    when {
      inputFormat.usesAvifDecodePath ->
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
      inputFormat.usesHeifDecodePath ->
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
      else -> true
    }

  private fun unsupportedInputFormatMessage(mimeTypeHint: String): String {
    val inputFormat = InputFormat.fromMimeType(mimeTypeHint)

    return when {
      inputFormat?.usesHeifDecodePath == true ->
        "Android HEIC/HEIF input requires Android 8.0+ platform decoder support."
      inputFormat?.usesAvifDecodePath == true ->
        "Android AVIF input requires Android 14+ platform decoder support."
      else -> DEFAULT_UNSUPPORTED_INPUT_FORMAT_MESSAGE
    }
  }

  private fun queryContentMimeType(uri: Uri): String? =
    try {
      reactContext.contentResolver.getType(uri)
    } catch (_: Exception) {
      null
    }

  private fun readExifOrientation(inputSource: AndroidCompressionSource): Int =
    try {
      openInputStream(inputSource).buffered().use { inputStream ->
        ExifInterface(inputStream).getAttributeInt(
          ExifInterface.TAG_ORIENTATION,
          ExifInterface.ORIENTATION_NORMAL
        )
      }
    } catch (_: Exception) {
      ExifInterface.ORIENTATION_NORMAL
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
      openInputStream(inputSource).buffered().use { inputStream ->
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

  private fun openInputStream(inputSource: AndroidCompressionSource): InputStream =
    try {
      when (inputSource) {
        is AndroidCompressionSource.FileSource -> FileInputStream(inputSource.file)
        is AndroidCompressionSource.ContentSource ->
          reactContext.contentResolver.openInputStream(inputSource.uri)
            ?: throw SourceAccessException(
              "Android MVP could not open the source content URI."
            )
      }
    } catch (error: SourceAccessException) {
      throw error
    } catch (error: Exception) {
      throw SourceAccessException(
        "Android MVP could not read the source image URI.",
        error
      )
    }

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

  private data class ImageBounds(
    val width: Int,
    val height: Int,
    val mimeType: String?
  )

  private data class ImageDimensions(
    val width: Int,
    val height: Int
  )

  private enum class InputFormat(
    val mimeType: String,
    val mimeTypeAliases: Set<String>,
    val fileExtensions: Set<String>,
    val supportsJpegExifMetadata: Boolean,
    val usesHeifDecodePath: Boolean = false,
    val usesAvifDecodePath: Boolean = false
  ) {
    JPEG(
      mimeType = "image/jpeg",
      mimeTypeAliases = emptySet(),
      fileExtensions = setOf("jpg", "jpeg"),
      supportsJpegExifMetadata = true
    ),
    PNG(
      mimeType = "image/png",
      mimeTypeAliases = emptySet(),
      fileExtensions = setOf("png"),
      supportsJpegExifMetadata = false
    ),
    WEBP(
      mimeType = "image/webp",
      mimeTypeAliases = emptySet(),
      fileExtensions = setOf("webp"),
      supportsJpegExifMetadata = false
    ),
    GIF(
      mimeType = "image/gif",
      mimeTypeAliases = emptySet(),
      fileExtensions = setOf("gif"),
      supportsJpegExifMetadata = false
    ),
    HEIC(
      mimeType = "image/heic",
      mimeTypeAliases = setOf("image/heic-sequence"),
      fileExtensions = setOf("heic"),
      supportsJpegExifMetadata = false,
      usesHeifDecodePath = true
    ),
    HEIF(
      mimeType = "image/heif",
      mimeTypeAliases = setOf("image/heif-sequence"),
      fileExtensions = setOf("heif"),
      supportsJpegExifMetadata = false,
      usesHeifDecodePath = true
    ),
    AVIF(
      mimeType = "image/avif",
      mimeTypeAliases = emptySet(),
      fileExtensions = setOf("avif"),
      supportsJpegExifMetadata = false,
      usesAvifDecodePath = true
    );

    companion object {
      fun fromMimeType(mimeType: String?): InputFormat? {
        val normalizedMimeType = mimeType?.trim()?.lowercase() ?: return null

        return values().firstOrNull {
          it.mimeType == normalizedMimeType || normalizedMimeType in it.mimeTypeAliases
        }
      }

      fun fromFileExtension(fileExtension: String?): InputFormat? {
        val normalizedFileExtension = fileExtension?.trim()?.trimStart('.')?.lowercase()
          ?: return null

        return values().firstOrNull { normalizedFileExtension in it.fileExtensions }
      }
    }
  }

  private class SourceAccessException(
    message: String,
    cause: Throwable? = null
  ) : Exception(message, cause)

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

    private const val STREAM_BUFFER_SIZE = 8 * 1024
    private const val DEFAULT_UNSUPPORTED_INPUT_FORMAT_MESSAGE =
      "Android MVP supports JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input only."
  }
}
