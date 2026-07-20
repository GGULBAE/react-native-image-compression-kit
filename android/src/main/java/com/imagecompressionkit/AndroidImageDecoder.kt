package com.imagecompressionkit

import android.annotation.TargetApi
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.os.Build
import androidx.exifinterface.media.ExifInterface

internal data class AndroidImageInputInfo(
  val originalByteSize: Long,
  val format: AndroidImageInputFormat,
  val bounds: AndroidImageBounds?,
  val exifOrientation: Int
)

internal data class AndroidImageBounds(
  val width: Int,
  val height: Int,
  val mimeType: String?
)

internal sealed class AndroidImageDecodeResult {
  data class Success(
    val bitmap: Bitmap,
    val inputInfo: AndroidImageInputInfo
  ) : AndroidImageDecodeResult()

  data class UnsupportedFormat(
    val message: String
  ) : AndroidImageDecodeResult()

  object DecodeFailed : AndroidImageDecodeResult()
}

internal class AndroidImageDecoder(
  private val sourceAccess: AndroidImageSourceAccess,
  private val sdkInt: Int = Build.VERSION.SDK_INT
) {
  fun decode(
    source: AndroidCompressionSource,
    resize: ResizeOptions? = null,
    cancellationCheck: () -> Unit = {}
  ): AndroidImageDecodeResult {
    cancellationCheck()
    val originalByteSize = sourceAccess.readOriginalByteSize(source)
    val unsupportedInputMimeTypeHint = readUnsupportedInputMimeTypeHint(source)

    if (unsupportedInputMimeTypeHint != null) {
      return AndroidImageDecodeResult.UnsupportedFormat(
        unsupportedInputFormatMessage(unsupportedInputMimeTypeHint)
      )
    }

    val inputFormatHint = readInputFormatHint(source)
    val bounds = decodeBounds(source)
    val inputFormat = AndroidImageInputFormat.fromMimeType(bounds?.mimeType)
      ?: inputFormatHint

    if (inputFormat == null) {
      return if (bounds == null) {
        AndroidImageDecodeResult.DecodeFailed
      } else {
        AndroidImageDecodeResult.UnsupportedFormat(
          DEFAULT_UNSUPPORTED_INPUT_FORMAT_MESSAGE
        )
      }
    }

    val exifOrientation = if (inputFormat.supportsJpegExifMetadata) {
      readExifOrientation(source)
    } else {
      ExifInterface.ORIENTATION_NORMAL
    }
    val decodePlan = AndroidImageResourcePolicy.createDecodePlan(
      bounds ?: return AndroidImageDecodeResult.DecodeFailed,
      exifOrientation,
      resize
    )
    cancellationCheck()
    val bitmap = decodeBitmap(source, inputFormat, decodePlan)
      ?: return AndroidImageDecodeResult.DecodeFailed
    try {
      cancellationCheck()
    } catch (error: Throwable) {
      bitmap.recycle()
      throw error
    }

    return AndroidImageDecodeResult.Success(
      bitmap = bitmap,
      inputInfo = AndroidImageInputInfo(
        originalByteSize = originalByteSize,
        format = inputFormat,
        bounds = bounds,
        exifOrientation = exifOrientation
      )
    )
  }

  private fun decodeBounds(source: AndroidCompressionSource): AndroidImageBounds? {
    val options = BitmapFactory.Options().apply {
      inJustDecodeBounds = true
    }

    sourceAccess.openInputStream(source).buffered().use { inputStream ->
      BitmapFactory.decodeStream(inputStream, null, options)
    }

    if (options.outWidth <= 0 || options.outHeight <= 0) {
      return null
    }

    return AndroidImageBounds(
      width = options.outWidth,
      height = options.outHeight,
      mimeType = options.outMimeType
    )
  }

  private fun decodeBitmap(
    source: AndroidCompressionSource,
    inputFormat: AndroidImageInputFormat,
    decodePlan: AndroidDecodePlan
  ): Bitmap? =
    when {
      inputFormat.usesAvifDecodePath -> decodeAvifBitmap(source, decodePlan)
      inputFormat.usesHeifDecodePath -> decodeHeicHeifBitmap(source, decodePlan)
      else -> decodeBitmapFactory(source, decodePlan)
    }

  private fun decodeBitmapFactory(
    source: AndroidCompressionSource,
    decodePlan: AndroidDecodePlan
  ): Bitmap? {
    AndroidImageResourcePolicy.validateBitmapFactoryDecode(decodePlan)
    return sourceAccess.openInputStream(source).buffered().use { inputStream ->
      BitmapFactory.decodeStream(
        inputStream,
        null,
        BitmapFactory.Options().apply {
          inSampleSize = decodePlan.inSampleSize
        }
      )
    }
  }

  private fun decodeHeicHeifBitmap(
    source: AndroidCompressionSource,
    decodePlan: AndroidDecodePlan
  ): Bitmap? =
    when {
      sdkInt >= Build.VERSION_CODES.P -> decodeBitmapWithImageDecoder(source, decodePlan)
      sdkInt >= Build.VERSION_CODES.O -> decodeBitmapFactory(source, decodePlan)
      else -> null
    }

  @TargetApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
  private fun decodeAvifBitmap(
    source: AndroidCompressionSource,
    decodePlan: AndroidDecodePlan
  ): Bitmap? =
    if (sdkInt >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      decodeBitmapWithImageDecoder(source, decodePlan)
    } else {
      null
    }

  @TargetApi(Build.VERSION_CODES.P)
  private fun decodeBitmapWithImageDecoder(
    source: AndroidCompressionSource,
    decodePlan: AndroidDecodePlan
  ): Bitmap? =
    try {
      ImageDecoder.decodeBitmap(sourceAccess.createImageDecoderSource(source)) { decoder, _, _ ->
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        if (
          decodePlan.decodeWidth < decodePlan.sourceBounds.width ||
          decodePlan.decodeHeight < decodePlan.sourceBounds.height
        ) {
          decoder.setTargetSize(decodePlan.decodeWidth, decodePlan.decodeHeight)
        }
      }
    } catch (_: Exception) {
      null
    }

  private fun readUnsupportedInputMimeTypeHint(
    source: AndroidCompressionSource
  ): String? {
    val mimeType = sourceAccess.readMimeType(source)

    AndroidImageInputFormat.fromMimeType(mimeType)?.let { inputFormat ->
      if (!canDecodeInputFormat(inputFormat)) {
        return inputFormat.mimeType
      }
      return null
    }

    val extensionInputFormat = AndroidImageInputFormat.fromFileExtension(
      sourceAccess.readFileExtension(source)
    )

    return if (
      extensionInputFormat != null &&
      !canDecodeInputFormat(extensionInputFormat)
    ) {
      extensionInputFormat.mimeType
    } else {
      null
    }
  }

  private fun readInputFormatHint(
    source: AndroidCompressionSource
  ): AndroidImageInputFormat? {
    AndroidImageInputFormat.fromMimeType(sourceAccess.readMimeType(source))
      ?.let { inputFormat -> return inputFormat }

    return AndroidImageInputFormat.fromFileExtension(
      sourceAccess.readFileExtension(source)
    )
  }

  private fun canDecodeInputFormat(inputFormat: AndroidImageInputFormat): Boolean =
    when {
      inputFormat.usesAvifDecodePath ->
        sdkInt >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
      inputFormat.usesHeifDecodePath ->
        sdkInt >= Build.VERSION_CODES.O
      else -> true
    }

  private fun unsupportedInputFormatMessage(mimeTypeHint: String): String {
    val inputFormat = AndroidImageInputFormat.fromMimeType(mimeTypeHint)

    return when {
      inputFormat?.usesHeifDecodePath == true ->
        "Android HEIC/HEIF input requires Android 8.0+ platform decoder support."
      inputFormat?.usesAvifDecodePath == true ->
        "Android AVIF input requires Android 14+ platform decoder support."
      else -> DEFAULT_UNSUPPORTED_INPUT_FORMAT_MESSAGE
    }
  }

  private fun readExifOrientation(source: AndroidCompressionSource): Int =
    try {
      sourceAccess.openInputStream(source).buffered().use { inputStream ->
        ExifInterface(inputStream).getAttributeInt(
          ExifInterface.TAG_ORIENTATION,
          ExifInterface.ORIENTATION_NORMAL
        )
      }
    } catch (_: Exception) {
      ExifInterface.ORIENTATION_NORMAL
    }

  companion object {
    private const val DEFAULT_UNSUPPORTED_INPUT_FORMAT_MESSAGE =
      "Android MVP supports JPEG, PNG, WebP, GIF, HEIC, HEIF, and AVIF input only."
  }
}

internal enum class AndroidImageInputFormat(
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
    fun fromMimeType(mimeType: String?): AndroidImageInputFormat? {
      val normalizedMimeType = mimeType?.trim()?.lowercase() ?: return null

      return values().firstOrNull {
        it.mimeType == normalizedMimeType || normalizedMimeType in it.mimeTypeAliases
      }
    }

    fun fromFileExtension(fileExtension: String?): AndroidImageInputFormat? {
      val normalizedFileExtension = fileExtension?.trim()?.trimStart('.')?.lowercase()
        ?: return null

      return values().firstOrNull { normalizedFileExtension in it.fileExtensions }
    }
  }
}
