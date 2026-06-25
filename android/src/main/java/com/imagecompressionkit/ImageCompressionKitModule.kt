package com.imagecompressionkit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
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
import java.util.UUID

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

      if (hasValue(options, "resize")) {
        reject(
          promise,
          ERR_NOT_IMPLEMENTED,
          "Android JPEG MVP does not implement resize yet."
        )
        return
      }

      if (hasValue(output, "maxBytes")) {
        reject(
          promise,
          ERR_NOT_IMPLEMENTED,
          "Android JPEG MVP does not implement target-size compression yet."
        )
        return
      }

      val format = if (hasValue(output, "format")) {
        output.getString("format")
      } else {
        null
      }
      if (format != JPEG_FORMAT) {
        reject(
          promise,
          ERR_NOT_IMPLEMENTED,
          "Android JPEG MVP only implements JPEG output."
        )
        return
      }

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

      val quality = readQuality(output)
      val outputFile = createOutputFile()
      val didEncode = encodeJpeg(bitmap, outputFile, quality)
      bitmap.recycle()

      if (!didEncode) {
        reject(
          promise,
          ERR_ENCODE_FAILED,
          "Android JPEG MVP could not encode the JPEG output."
        )
        return
      }

      promise.resolve(createCompressionResult(originalByteSize, outputFile, bounds))
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
      putBoolean("supportsTargetSizeCompression", false)
      putBoolean("supportsCancellation", false)
    }

  private fun createFormatCapabilities(): WritableArray =
    Arguments.createArray().apply {
      FORMATS.forEach { format ->
        pushMap(createFormatCapability(format))
      }
    }

  private fun createFormatCapability(format: String): WritableMap =
    Arguments.createMap().apply {
      val isJpeg = format == JPEG_FORMAT

      putString("format", format)
      putBoolean("input", isJpeg)
      putBoolean("output", isJpeg)
      putBoolean("supportsAlpha", false)
      putBoolean("supportsAnimation", false)
      putArray(
        "notes",
        if (isJpeg) {
          createJpegMvpNotes()
        } else {
          createNotImplementedNotes()
        }
      )
    }

  private fun createMetadataPolicies(): WritableArray =
    Arguments.createArray().apply {
      pushString("preserve")
      pushString("safe")
      pushString("strip")
    }

  private fun createNotImplementedNotes(): WritableArray =
    Arguments.createArray().apply {
      pushString("Native codec support has not been implemented yet.")
    }

  private fun createJpegMvpNotes(): WritableArray =
    Arguments.createArray().apply {
      pushString("Android JPEG quality compression MVP supports file:// and content:// sources.")
      pushString("Resize, metadata policies, and target-size compression are not implemented yet.")
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

  private fun createOutputFile(): File {
    val outputDir = File(reactContext.cacheDir, OUTPUT_DIRECTORY_NAME)
    if (!outputDir.exists()) {
      outputDir.mkdirs()
    }

    return File(
      outputDir,
      "compressed-${System.currentTimeMillis()}-${UUID.randomUUID()}.jpg"
    )
  }

  private fun encodeJpeg(bitmap: Bitmap, outputFile: File, quality: Int): Boolean =
    FileOutputStream(outputFile).use { outputStream ->
      bitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
    }

  private fun createCompressionResult(
    originalByteSize: Long,
    outputFile: File,
    bounds: ImageBounds
  ): WritableMap {
    val byteSize = outputFile.length()

    return Arguments.createMap().apply {
      putString("uri", Uri.fromFile(outputFile).toString())
      putString("format", JPEG_FORMAT)
      putInt("width", bounds.width)
      putInt("height", bounds.height)
      putDouble("byteSize", byteSize.toDouble())
      putDouble("originalByteSize", originalByteSize.toDouble())
      putDouble(
        "compressionRatio",
        if (originalByteSize > 0L) {
          byteSize.toDouble() / originalByteSize.toDouble()
        } else {
          1.0
        }
      )
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
    private const val OUTPUT_DIRECTORY_NAME = "image-compression-kit"
    private const val DEFAULT_QUALITY = 80
    private const val MIN_QUALITY = 0
    private const val MAX_QUALITY = 100
    private const val STREAM_BUFFER_SIZE = 8 * 1024
    private const val JPEG_HEADER_SIZE = 3

    private val JPEG_SOI_FIRST_BYTE = 0xFF.toByte()
    private val JPEG_SOI_SECOND_BYTE = 0xD8.toByte()
    private val JPEG_MARKER_PREFIX_BYTE = 0xFF.toByte()

    private val FORMATS = arrayOf(
      "jpeg",
      "png",
      "webp",
      "heic",
      "heif",
      "avif",
      "gif"
    )
  }
}
