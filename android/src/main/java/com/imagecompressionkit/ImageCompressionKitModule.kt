package com.imagecompressionkit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileOutputStream
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

      val inputFile = fileFromLocalFileUri(uri)
      if (inputFile == null) {
        reject(
          promise,
          ERR_UNSUPPORTED_SOURCE,
          "Android JPEG MVP supports file:// image URIs only."
        )
        return
      }

      if (!inputFile.exists() || !inputFile.isFile || !inputFile.canRead()) {
        reject(
          promise,
          ERR_FILE_ACCESS,
          "Android JPEG MVP could not read the source file."
        )
        return
      }

      val bounds = decodeBounds(inputFile)
      if (bounds == null) {
        reject(
          promise,
          ERR_DECODE_FAILED,
          "Android JPEG MVP could not decode the source image."
        )
        return
      }

      if (bounds.mimeType != JPEG_MIME_TYPE) {
        reject(
          promise,
          ERR_UNSUPPORTED_FORMAT,
          "Android JPEG MVP supports JPEG input only."
        )
        return
      }

      val bitmap = BitmapFactory.decodeFile(inputFile.absolutePath)
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

      promise.resolve(createCompressionResult(inputFile, outputFile, bounds))
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
      pushString("Android JPEG quality compression MVP supports file:// sources.")
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

  private fun fileFromLocalFileUri(uri: String): File? {
    val parsed = Uri.parse(uri)
    if (parsed.scheme != "file") {
      return null
    }

    val path = parsed.path ?: return null
    return File(path)
  }

  private fun decodeBounds(file: File): ImageBounds? {
    val options = BitmapFactory.Options().apply {
      inJustDecodeBounds = true
    }

    BitmapFactory.decodeFile(file.absolutePath, options)

    if (options.outWidth <= 0 || options.outHeight <= 0) {
      return null
    }

    return ImageBounds(
      width = options.outWidth,
      height = options.outHeight,
      mimeType = options.outMimeType
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
    inputFile: File,
    outputFile: File,
    bounds: ImageBounds
  ): WritableMap {
    val originalByteSize = inputFile.length()
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
