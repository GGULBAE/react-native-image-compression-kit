package com.imagecompressionkit

import android.net.Uri
import com.facebook.react.bridge.ReadableMap
import java.io.File

internal const val ANDROID_ERR_INVALID_OPTIONS = "ERR_INVALID_OPTIONS"
internal const val ANDROID_ERR_UNSUPPORTED_SOURCE = "ERR_UNSUPPORTED_SOURCE"
internal const val ANDROID_ERR_NOT_IMPLEMENTED = "ERR_NOT_IMPLEMENTED"
internal const val ANDROID_ERR_NATIVE_OPERATION_FAILED = "ERR_NATIVE_OPERATION_FAILED"

internal const val METADATA_POLICY_PRESERVE = "preserve"
internal const val METADATA_POLICY_SAFE = "safe"
internal const val METADATA_POLICY_STRIP = "strip"

internal data class AndroidCompressionRequest(
  val source: AndroidCompressionSource,
  val resize: ResizeOptions?,
  val outputFormat: OutputFormat,
  val quality: Int,
  val maxBytes: Long?,
  val metadataPolicy: MetadataPolicy
)

internal sealed class AndroidCompressionSource {
  abstract val uri: Uri

  data class FileSource(
    override val uri: Uri,
    val file: File
  ) : AndroidCompressionSource()

  data class ContentSource(
    override val uri: Uri
  ) : AndroidCompressionSource()
}

internal data class ResizeOptions(
  val maxWidth: Int?,
  val maxHeight: Int?,
  val mode: ResizeMode
)

internal enum class ResizeMode {
  CONTAIN,
  COVER,
  STRETCH
}

internal enum class MetadataPolicy(val value: String) {
  PRESERVE(METADATA_POLICY_PRESERVE),
  SAFE(METADATA_POLICY_SAFE),
  STRIP(METADATA_POLICY_STRIP)
}

internal class AndroidCompressionRequestException(
  val code: String,
  message: String,
  cause: Throwable? = null
) : Exception(message, cause)

internal object AndroidCompressionRequestParser {
  fun parse(options: ReadableMap): AndroidCompressionRequest =
    try {
      parseValidatedRequest(options)
    } catch (error: AndroidCompressionRequestException) {
      throw error
    } catch (error: Exception) {
      throw AndroidCompressionRequestException(
        ANDROID_ERR_NATIVE_OPERATION_FAILED,
        "Android MVP compression failed.",
        error
      )
    }

  private fun parseValidatedRequest(options: ReadableMap): AndroidCompressionRequest {
    val source = readMap(options, "source")
    val output = readMap(options, "output")

    if (source == null || output == null) {
      invalidOptions("Compression options must include source and output objects.")
    }

    val resize = readResizeOptions(readMap(options, "resize"))
    val outputFormatValue = readOutputFormatValue(output)
    val outputFormat = ImageCompressionOutput.fromValue(outputFormatValue)

    if (
      outputFormat == null &&
      !ImageCompressionOutput.isAvifOutputFormat(outputFormatValue)
    ) {
      requestError(
        ANDROID_ERR_NOT_IMPLEMENTED,
        ImageCompressionOutput.UNSUPPORTED_OUTPUT_FORMAT_MESSAGE
      )
    }

    val metadataPolicy = readMetadataPolicy(options)
    val maxBytes = readMaxBytes(output)

    if (outputFormat == null) {
      val avifScaffold = AndroidAvifOutputPrototype.createProductionWiringScaffold(
        metadataPolicy = metadataPolicy.value,
        maxBytesRequested = maxBytes != null
      )
      requestError(
        ANDROID_ERR_NOT_IMPLEMENTED,
        avifScaffold.notImplementedMessage
      )
    }

    val maxBytesValidationError = ImageCompressionOutput.maxBytesValidationError(
      outputFormat,
      maxBytes
    )
    if (maxBytesValidationError != null) {
      invalidOptions(maxBytesValidationError)
    }

    val quality = readQuality(output)
    val uri = if (hasValue(source, "uri")) {
      source.getString("uri")
    } else {
      null
    }
    if (uri.isNullOrBlank()) {
      invalidOptions("Compression source.uri must be a non-empty string.")
    }

    val inputSource = inputSourceFromUri(uri)
      ?: requestError(
        ANDROID_ERR_UNSUPPORTED_SOURCE,
        "Android MVP supports file:// and content:// image URIs only."
      )

    return AndroidCompressionRequest(
      source = inputSource,
      resize = resize,
      outputFormat = outputFormat,
      quality = quality,
      maxBytes = maxBytes,
      metadataPolicy = metadataPolicy
    )
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

  private fun readOutputFormatValue(output: ReadableMap): String? {
    return if (hasValue(output, "format")) {
      try {
        output.getString("format")
      } catch (error: Exception) {
        invalidOptions(OUTPUT_FORMAT_MESSAGE, error)
      }
    } else {
      invalidOptions(OUTPUT_FORMAT_MESSAGE)
    }
  }

  private fun readMetadataPolicy(options: ReadableMap): MetadataPolicy {
    val value = if (hasValue(options, "metadata")) {
      try {
        options.getString("metadata")
      } catch (error: Exception) {
        invalidOptions(METADATA_POLICY_MESSAGE, error)
      }
    } else {
      METADATA_POLICY_SAFE
    }

    return when (value) {
      METADATA_POLICY_SAFE -> MetadataPolicy.SAFE
      METADATA_POLICY_STRIP -> MetadataPolicy.STRIP
      METADATA_POLICY_PRESERVE -> MetadataPolicy.PRESERVE
      else -> invalidOptions(METADATA_POLICY_MESSAGE)
    }
  }

  private fun readMaxBytes(output: ReadableMap): Long? {
    if (!hasValue(output, "maxBytes")) {
      return null
    }

    val value = try {
      output.getDouble("maxBytes")
    } catch (error: Exception) {
      invalidOptions(MAX_BYTES_MESSAGE, error)
    }

    if (
      value.isNaN() ||
      value.isInfinite() ||
      value <= 0.0 ||
      value > MAX_SAFE_INTEGER ||
      value.toLong().toDouble() != value
    ) {
      invalidOptions(MAX_BYTES_MESSAGE)
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
      invalidOptions("Compression resize must include maxWidth, maxHeight, or both.")
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
      else -> invalidOptions(RESIZE_MODE_MESSAGE)
    }

    return ResizeOptions(maxWidth = maxWidth, maxHeight = maxHeight, mode = mode)
  }

  private fun readOptionalPositiveInteger(map: ReadableMap, key: String): Int? {
    if (!hasValue(map, key)) {
      return null
    }

    val message = "Compression resize.$key must be a positive integer."
    val value = try {
      map.getDouble(key)
    } catch (error: Exception) {
      invalidOptions(message, error)
    }

    if (
      value.isNaN() ||
      value.isInfinite() ||
      value <= 0.0 ||
      value.toInt().toDouble() != value
    ) {
      invalidOptions(message)
    }

    return value.toInt()
  }

  private fun inputSourceFromUri(uri: String): AndroidCompressionSource? {
    val parsed = Uri.parse(uri)

    return when (parsed.scheme?.lowercase()) {
      "file" -> {
        val path = parsed.path ?: return null
        AndroidCompressionSource.FileSource(parsed, File(path))
      }
      "content" -> AndroidCompressionSource.ContentSource(parsed)
      else -> null
    }
  }

  private fun invalidOptions(
    message: String,
    cause: Throwable? = null
  ): Nothing = requestError(ANDROID_ERR_INVALID_OPTIONS, message, cause)

  private fun requestError(
    code: String,
    message: String,
    cause: Throwable? = null
  ): Nothing = throw AndroidCompressionRequestException(code, message, cause)

  private const val DEFAULT_QUALITY = 80
  private const val MIN_QUALITY = 0
  private const val MAX_QUALITY = 100
  private const val MAX_SAFE_INTEGER = 9007199254740991.0
  private const val RESIZE_MODE_CONTAIN = "contain"
  private const val RESIZE_MODE_COVER = "cover"
  private const val RESIZE_MODE_STRETCH = "stretch"
  private const val OUTPUT_FORMAT_MESSAGE =
    "Compression output.format must be one of: jpeg, png, webp, heic, heif, avif."
  private const val METADATA_POLICY_MESSAGE =
    "Compression metadata must be one of: preserve, safe, strip."
  private const val MAX_BYTES_MESSAGE =
    "Compression output.maxBytes must be a positive integer."
  private const val RESIZE_MODE_MESSAGE =
    "Compression resize.mode must be one of: contain, cover, stretch."
}
