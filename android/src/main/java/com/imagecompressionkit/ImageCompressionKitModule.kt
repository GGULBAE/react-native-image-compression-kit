package com.imagecompressionkit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
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
import java.io.FileOutputStream
import java.io.InputStream
import kotlin.math.roundToInt

class ImageCompressionKitModule(
  private val reactContext: ReactApplicationContext
) : NativeImageCompressionKitSpec(reactContext) {
  override fun getName(): String = NAME

  override fun compressImage(options: ReadableMap, promise: Promise) {
    try {
      val source = readMap(options, "source")
      val output = readMap(options, "output")

      if (source == null || output == null) {
        reject(
          promise,
          ERR_INVALID_OPTIONS,
          "Compression options must include source and output objects."
        )
        return
      }

      val resize = try {
        readResizeOptions(readMap(options, "resize"))
      } catch (error: InvalidOptionsException) {
        reject(
          promise,
          ERR_INVALID_OPTIONS,
          error.message ?: "Compression resize options are invalid.",
          error
        )
        return
      }

      val outputFormat = try {
        readOutputFormat(output)
      } catch (error: InvalidOptionsException) {
        reject(
          promise,
          ERR_INVALID_OPTIONS,
          error.message ?: "Compression output.format is invalid.",
          error
        )
        return
      }

      if (outputFormat == null) {
        reject(
          promise,
          ERR_NOT_IMPLEMENTED,
          "Android JPEG MVP supports JPEG input with JPEG, PNG, and WebP output only."
        )
        return
      }

      val metadataPolicy = try {
        readMetadataPolicy(options)
      } catch (error: InvalidOptionsException) {
        reject(
          promise,
          ERR_INVALID_OPTIONS,
          error.message ?: "Compression metadata policy is invalid.",
          error
        )
        return
      }

      val maxBytes = try {
        readMaxBytes(output)
      } catch (error: InvalidOptionsException) {
        reject(
          promise,
          ERR_INVALID_OPTIONS,
          error.message ?: "Compression output.maxBytes is invalid.",
          error
        )
        return
      }

      val maxBytesValidationError = ImageCompressionOutput.maxBytesValidationError(
        outputFormat,
        maxBytes
      )
      if (maxBytesValidationError != null) {
        reject(
          promise,
          ERR_INVALID_OPTIONS,
          maxBytesValidationError
        )
        return
      }

      val quality = readQuality(output)
      val uri = if (hasValue(source, "uri")) {
        source.getString("uri")
      } else {
        null
      }
      if (uri.isNullOrBlank()) {
        reject(
          promise,
          ERR_INVALID_OPTIONS,
          "Compression source.uri must be a non-empty string."
        )
        return
      }

      val inputSource = inputSourceFromUri(uri)
      if (inputSource == null) {
        reject(
          promise,
          ERR_UNSUPPORTED_SOURCE,
          "Android JPEG MVP supports file:// and content:// image URIs only."
        )
        return
      }

      val hasJpegHeader = try {
        hasJpegHeader(inputSource)
      } catch (error: SourceAccessException) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          error.message ?: "Android JPEG MVP could not read the source image URI.",
          error
        )
        return
      }

      if (!hasJpegHeader) {
        reject(
          promise,
          ERR_UNSUPPORTED_FORMAT,
          "Android JPEG MVP supports JPEG input only."
        )
        return
      }

      val originalByteSize = try {
        readOriginalByteSize(inputSource)
      } catch (error: SourceAccessException) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          error.message ?: "Android JPEG MVP could not read the source image URI.",
          error
        )
        return
      }

      val bounds = try {
        decodeBounds(inputSource)
      } catch (error: SourceAccessException) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          error.message ?: "Android JPEG MVP could not read the source image URI.",
          error
        )
        return
      }

      if (bounds == null) {
        reject(
          promise,
          ERR_DECODE_FAILED,
          "Android JPEG MVP could not decode the source image."
        )
        return
      }

      if (bounds.mimeType != null && bounds.mimeType != JPEG_MIME_TYPE) {
        reject(
          promise,
          ERR_UNSUPPORTED_FORMAT,
          "Android JPEG MVP supports JPEG input only."
        )
        return
      }

      val bitmap = try {
        decodeBitmap(inputSource)
      } catch (error: SourceAccessException) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          error.message ?: "Android JPEG MVP could not read the source image URI.",
          error
        )
        return
      }

      if (bitmap == null) {
        reject(
          promise,
          ERR_DECODE_FAILED,
          "Android JPEG MVP could not decode the source image."
        )
        return
      }

      val exifOrientation = readExifOrientation(inputSource)
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
        val copiedExifMetadata = if (outputFormat.supportsJpegExifMetadata) {
          createCopiedExifMetadata(
            metadataPolicy,
            inputSource,
            outputDimensions
          )
        } else {
          null
        }

        didEncode = encodeBitmap(
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
          error.message ?: "Android JPEG MVP could not copy JPEG metadata.",
          error
        )
        return
      } catch (error: Exception) {
        reject(
          promise,
          ERR_ENCODE_FAILED,
          error.message ?: "Android JPEG MVP could not encode the selected output format.",
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
          "Android JPEG MVP could not encode the selected output format."
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
        "Android JPEG MVP compression failed.",
        error
      )
    }
  }

  override fun getImageCompressionCapabilities(promise: Promise) {
    promise.resolve(createStubCapabilities())
  }

  private fun createStubCapabilities(): WritableMap =
    Arguments.createMap().apply {
      putString("platform", "android")
      putArray("formats", createFormatCapabilities())
      putArray("metadataPolicies", createMetadataPolicies())
      putBoolean("supportsTargetSizeCompression", true)
      putBoolean("supportsCancellation", false)
    }

  private fun createFormatCapabilities(): WritableArray =
    Arguments.createArray().apply {
      ImageCompressionOutput.FORMAT_VALUES.forEach { format ->
        pushMap(createFormatCapability(format))
      }
    }

  private fun createFormatCapability(format: String): WritableMap {
    val capability = ImageCompressionOutput.createFormatCapability(format)

    return Arguments.createMap().apply {
      putString("format", capability.format)
      putBoolean("input", capability.input)
      putBoolean("output", capability.output)
      putBoolean("supportsAlpha", capability.supportsAlpha)
      putBoolean("supportsAnimation", capability.supportsAnimation)
      putArray("notes", createStringArray(capability.notes))
    }
  }

  private fun createMetadataPolicies(): WritableArray =
    Arguments.createArray().apply {
      pushString(METADATA_POLICY_PRESERVE)
      pushString(METADATA_POLICY_SAFE)
      pushString(METADATA_POLICY_STRIP)
    }

  private fun createStringArray(values: List<String>): WritableArray =
    Arguments.createArray().apply {
      values.forEach { value ->
        pushString(value)
      }
    }

  private fun hasValue(map: ReadableMap, key: String): Boolean =
    map.hasKey(key) && !map.isNull(key)

  private fun readMap(map: ReadableMap, key: String): ReadableMap? =
    if (hasValue(map, key)) {
      map.getMap(key)
    } else {
      null
    }

  private fun readQuality(output: ReadableMap): Int =
    if (hasValue(output, "quality")) {
      output.getDouble("quality").toInt().coerceIn(MIN_QUALITY, MAX_QUALITY)
    } else {
      DEFAULT_QUALITY
    }

  private fun readOutputFormat(output: ReadableMap): OutputFormat? {
    val value = if (hasValue(output, "format")) {
      try {
        output.getString("format")
      } catch (error: Exception) {
        throw InvalidOptionsException(
          "Compression output.format must be one of: jpeg, png, webp, heic, heif, avif.",
          error
        )
      }
    } else {
      throw InvalidOptionsException(
        "Compression output.format must be one of: jpeg, png, webp, heic, heif, avif."
      )
    }

    return ImageCompressionOutput.fromValue(value)
  }

  private fun readMetadataPolicy(options: ReadableMap): MetadataPolicy {
    val value = if (hasValue(options, "metadata")) {
      try {
        options.getString("metadata")
      } catch (error: Exception) {
        throw InvalidOptionsException(
          "Compression metadata must be one of: preserve, safe, strip.",
          error
        )
      }
    } else {
      METADATA_POLICY_SAFE
    }

    return when (value) {
      METADATA_POLICY_SAFE -> MetadataPolicy.SAFE
      METADATA_POLICY_STRIP -> MetadataPolicy.STRIP
      METADATA_POLICY_PRESERVE -> MetadataPolicy.PRESERVE
      else -> throw InvalidOptionsException(
        "Compression metadata must be one of: preserve, safe, strip."
      )
    }
  }

  private fun readMaxBytes(output: ReadableMap): Long? {
    if (!hasValue(output, "maxBytes")) {
      return null
    }

    val value = try {
      output.getDouble("maxBytes")
    } catch (error: Exception) {
      throw InvalidOptionsException("Compression output.maxBytes must be a positive integer.", error)
    }

    if (
      value.isNaN() ||
      value.isInfinite() ||
      value <= 0.0 ||
      value > MAX_SAFE_INTEGER ||
      value.toLong().toDouble() != value
    ) {
      throw InvalidOptionsException("Compression output.maxBytes must be a positive integer.")
    }

    return value.toLong()
  }

  private fun readResizeOptions(resize: ReadableMap?): ResizeOptions? {
    if (resize == null) {
      return null
    }

    val maxWidth = readOptionalPositiveInteger(resize, "maxWidth")
    val maxHeight = readOptionalPositiveInteger(resize, "maxHeight")

    if (maxWidth == null && maxHeight == null) {
      throw InvalidOptionsException(
        "Compression resize must include maxWidth, maxHeight, or both."
      )
    }

    val modeValue = if (hasValue(resize, "mode")) {
      resize.getString("mode")
    } else {
      RESIZE_MODE_CONTAIN
    }

    val mode = when (modeValue) {
      RESIZE_MODE_CONTAIN -> ResizeMode.CONTAIN
      RESIZE_MODE_COVER -> ResizeMode.COVER
      RESIZE_MODE_STRETCH -> ResizeMode.STRETCH
      else -> throw InvalidOptionsException(
        "Compression resize.mode must be one of: contain, cover, stretch."
      )
    }

    return ResizeOptions(maxWidth = maxWidth, maxHeight = maxHeight, mode = mode)
  }

  private fun readOptionalPositiveInteger(map: ReadableMap, key: String): Int? {
    if (!hasValue(map, key)) {
      return null
    }

    val value = try {
      map.getDouble(key)
    } catch (error: Exception) {
      throw InvalidOptionsException("Compression resize.$key must be a positive integer.", error)
    }

    if (
      value.isNaN() ||
      value.isInfinite() ||
      value <= 0.0 ||
      value.toInt().toDouble() != value
    ) {
      throw InvalidOptionsException("Compression resize.$key must be a positive integer.")
    }

    return value.toInt()
  }

  private fun inputSourceFromUri(uri: String): ImageInputSource? {
    val parsed = Uri.parse(uri)

    return when (parsed.scheme?.lowercase()) {
      "file" -> {
        val path = parsed.path ?: return null
        ImageInputSource.FileSource(parsed, File(path))
      }
      "content" -> ImageInputSource.ContentSource(parsed)
      else -> null
    }
  }

  private fun readOriginalByteSize(inputSource: ImageInputSource): Long =
    when (inputSource) {
      is ImageInputSource.FileSource -> {
        val inputFile = inputSource.file

        if (!inputFile.exists() || !inputFile.isFile || !inputFile.canRead()) {
          throw SourceAccessException("Android JPEG MVP could not read the source file.")
        }

        inputFile.length()
      }
      is ImageInputSource.ContentSource ->
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

  private fun countBytes(inputSource: ImageInputSource): Long =
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

  private fun hasJpegHeader(inputSource: ImageInputSource): Boolean =
    openInputStream(inputSource).use { inputStream ->
      val header = ByteArray(JPEG_HEADER_SIZE)
      var bytesRead = 0

      while (bytesRead < header.size) {
        val nextRead = inputStream.read(header, bytesRead, header.size - bytesRead)
        if (nextRead == -1) {
          return@use false
        }
        bytesRead += nextRead
      }

      header[0] == JPEG_SOI_FIRST_BYTE &&
        header[1] == JPEG_SOI_SECOND_BYTE &&
        header[2] == JPEG_MARKER_PREFIX_BYTE
    }

  private fun decodeBounds(inputSource: ImageInputSource): ImageBounds? {
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

  private fun decodeBitmap(inputSource: ImageInputSource): Bitmap? =
    openInputStream(inputSource).buffered().use { inputStream ->
      BitmapFactory.decodeStream(inputStream)
    }

  private fun readExifOrientation(inputSource: ImageInputSource): Int =
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
    inputSource: ImageInputSource,
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
        "Android JPEG MVP could not read source EXIF metadata.",
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

  private fun openInputStream(inputSource: ImageInputSource): InputStream =
    try {
      when (inputSource) {
        is ImageInputSource.FileSource -> FileInputStream(inputSource.file)
        is ImageInputSource.ContentSource ->
          reactContext.contentResolver.openInputStream(inputSource.uri)
            ?: throw SourceAccessException(
              "Android JPEG MVP could not open the source content URI."
            )
      }
    } catch (error: SourceAccessException) {
      throw error
    } catch (error: Exception) {
      throw SourceAccessException(
        "Android JPEG MVP could not read the source image URI.",
        error
      )
    }

  private fun encodeBitmap(
    bitmap: Bitmap,
    outputFile: File,
    outputFormat: OutputFormat,
    quality: Int,
    maxBytes: Long?,
    copiedExifMetadata: CopiedExifMetadata?
  ): Boolean =
    if (maxBytes == null) {
      encodeBitmapAtQuality(
        bitmap,
        outputFile,
        outputFormat,
        quality,
        copiedExifMetadata
      )
    } else {
      encodeBitmapToTargetSize(
        bitmap,
        outputFile,
        outputFormat,
        quality,
        maxBytes,
        copiedExifMetadata
      )
    }

  private fun encodeBitmapToTargetSize(
    bitmap: Bitmap,
    outputFile: File,
    outputFormat: OutputFormat,
    qualityCap: Int,
    maxBytes: Long,
    copiedExifMetadata: CopiedExifMetadata?
  ): Boolean {
    var currentQuality = qualityCap

    if (
      !encodeBitmapAtQuality(
        bitmap,
        outputFile,
        outputFormat,
        currentQuality,
        copiedExifMetadata
      )
    ) {
      return false
    }

    if (outputFile.length() <= maxBytes) {
      return true
    }

    var lowestAboveTargetQuality = currentQuality
    var lowestAboveTargetSize = outputFile.length()
    var bestWithinTargetQuality: Int? = null
    var low = MIN_QUALITY
    var high = qualityCap - 1

    while (low <= high) {
      currentQuality = (low + high) / 2

      if (
        !encodeBitmapAtQuality(
          bitmap,
          outputFile,
          outputFormat,
          currentQuality,
          copiedExifMetadata
        )
      ) {
        return false
      }

      val byteSize = outputFile.length()

      if (byteSize <= maxBytes) {
        bestWithinTargetQuality = currentQuality
        low = currentQuality + 1
      } else {
        if (byteSize < lowestAboveTargetSize) {
          lowestAboveTargetQuality = currentQuality
          lowestAboveTargetSize = byteSize
        }
        high = currentQuality - 1
      }
    }

    val finalQuality = bestWithinTargetQuality ?: lowestAboveTargetQuality

    return if (currentQuality == finalQuality) {
      true
    } else {
      encodeBitmapAtQuality(
        bitmap,
        outputFile,
        outputFormat,
        finalQuality,
        copiedExifMetadata
      )
    }
  }

  private fun encodeBitmapAtQuality(
    bitmap: Bitmap,
    outputFile: File,
    outputFormat: OutputFormat,
    quality: Int,
    copiedExifMetadata: CopiedExifMetadata?
  ): Boolean {
    val encoded = FileOutputStream(outputFile).use { outputStream ->
      bitmap.compress(
        outputFormat.compressFormat,
        outputFormat.compressionQuality(quality),
        outputStream
      )
    }

    if (!encoded) {
      return false
    }

    if (outputFormat.supportsJpegExifMetadata) {
      writeCopiedExifMetadata(copiedExifMetadata, outputFile)
    }

    return true
  }

  private fun writeCopiedExifMetadata(
    copiedExifMetadata: CopiedExifMetadata?,
    outputFile: File
  ) {
    if (copiedExifMetadata == null) {
      return
    }

    try {
      JpegExifMetadata.write(copiedExifMetadata, outputFile)
    } catch (error: Exception) {
      throw MetadataCopyException(
        "Android JPEG MVP could not write preserved EXIF metadata.",
        error
      )
    }
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

    return Arguments.createMap().apply {
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

  private data class ResizeOptions(
    val maxWidth: Int?,
    val maxHeight: Int?,
    val mode: ResizeMode
  )

  private enum class ResizeMode {
    CONTAIN,
    COVER,
    STRETCH
  }

  private enum class MetadataPolicy {
    PRESERVE,
    SAFE,
    STRIP
  }

  private sealed class ImageInputSource {
    abstract val uri: Uri

    data class FileSource(
      override val uri: Uri,
      val file: File
    ) : ImageInputSource()

    data class ContentSource(
      override val uri: Uri
    ) : ImageInputSource()
  }

  private class SourceAccessException(
    message: String,
    cause: Throwable? = null
  ) : Exception(message, cause)

  private class InvalidOptionsException(
    message: String,
    cause: Throwable? = null
  ) : Exception(message, cause)

  private class MetadataCopyException(
    message: String,
    cause: Throwable? = null
  ) : Exception(message, cause)

  companion object {
    const val NAME = "ImageCompressionKit"
    const val ERR_INVALID_OPTIONS = "ERR_INVALID_OPTIONS"
    const val ERR_UNSUPPORTED_SOURCE = "ERR_UNSUPPORTED_SOURCE"
    const val ERR_UNSUPPORTED_FORMAT = "ERR_UNSUPPORTED_FORMAT"
    const val ERR_NOT_IMPLEMENTED = "ERR_NOT_IMPLEMENTED"
    const val ERR_FILE_ACCESS = "ERR_FILE_ACCESS"
    const val ERR_DECODE_FAILED = "ERR_DECODE_FAILED"
    const val ERR_ENCODE_FAILED = "ERR_ENCODE_FAILED"
    const val ERR_NATIVE_OPERATION_FAILED = "ERR_NATIVE_OPERATION_FAILED"

    private const val JPEG_FORMAT = "jpeg"
    private const val JPEG_MIME_TYPE = "image/jpeg"
    private const val DEFAULT_QUALITY = 80
    private const val MIN_QUALITY = 0
    private const val MAX_QUALITY = 100
    private const val MAX_SAFE_INTEGER = 9007199254740991.0
    private const val STREAM_BUFFER_SIZE = 8 * 1024
    private const val JPEG_HEADER_SIZE = 3
    private const val RESIZE_MODE_CONTAIN = "contain"
    private const val RESIZE_MODE_COVER = "cover"
    private const val RESIZE_MODE_STRETCH = "stretch"
    private const val METADATA_POLICY_PRESERVE = "preserve"
    private const val METADATA_POLICY_SAFE = "safe"
    private const val METADATA_POLICY_STRIP = "strip"

    private val JPEG_SOI_FIRST_BYTE = 0xFF.toByte()
    private val JPEG_SOI_SECOND_BYTE = 0xD8.toByte()
    private val JPEG_MARKER_PREFIX_BYTE = 0xFF.toByte()

  }
}
