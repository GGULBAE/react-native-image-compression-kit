package com.imagecompressionkit

import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

internal data class CompressionOutputDimensions(
  val width: Int,
  val height: Int
)

internal data class CompressionOutputResultMetadata(
  val uri: String,
  val format: String,
  val width: Int,
  val height: Int,
  val byteSize: Long,
  val originalByteSize: Long,
  val compressionRatio: Double
)

internal data class CompressionFormatCapability(
  val format: String,
  val input: Boolean,
  val output: Boolean,
  val supportsAlpha: Boolean,
  val supportsAnimation: Boolean,
  val notes: List<String>
)

internal enum class OutputFormat(
  val value: String,
  val fileExtension: String,
  val supportsTargetSizeCompression: Boolean,
  val supportsJpegExifMetadata: Boolean
) {
  JPEG(
    value = "jpeg",
    fileExtension = "jpg",
    supportsTargetSizeCompression = true,
    supportsJpegExifMetadata = true
  ),
  PNG(
    value = "png",
    fileExtension = "png",
    supportsTargetSizeCompression = false,
    supportsJpegExifMetadata = false
  ),
  WEBP(
    value = "webp",
    fileExtension = "webp",
    supportsTargetSizeCompression = true,
    supportsJpegExifMetadata = false
  );

  val compressFormat: Bitmap.CompressFormat
    get() = when (this) {
      JPEG -> Bitmap.CompressFormat.JPEG
      PNG -> Bitmap.CompressFormat.PNG
      WEBP -> webpCompressFormat()
    }

  fun compressionQuality(quality: Int): Int =
    if (this == PNG) {
      100
    } else {
      quality
    }

  @Suppress("DEPRECATION")
  private fun webpCompressFormat(): Bitmap.CompressFormat =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Bitmap.CompressFormat.WEBP_LOSSY
    } else {
      Bitmap.CompressFormat.WEBP
    }

  companion object {
    fun fromValue(value: String?): OutputFormat? =
      values().firstOrNull { it.value == value }
  }
}

internal object ImageCompressionOutput {
  const val MAX_BYTES_UNSUPPORTED_MESSAGE =
    "Android MVP supports output.maxBytes for JPEG and WebP output only."

  val FORMAT_VALUES = arrayOf(
    JPEG_FORMAT,
    PNG_FORMAT,
    WEBP_FORMAT,
    "heic",
    "heif",
    "avif",
    "gif"
  )

  fun fromValue(value: String?): OutputFormat? =
    OutputFormat.fromValue(value)

  fun maxBytesValidationError(
    outputFormat: OutputFormat,
    maxBytes: Long?
  ): String? =
    if (maxBytes != null && !outputFormat.supportsTargetSizeCompression) {
      MAX_BYTES_UNSUPPORTED_MESSAGE
    } else {
      null
    }

  fun createOutputFile(cacheDir: File, outputFormat: OutputFormat): File {
    val outputDir = File(cacheDir, OUTPUT_DIRECTORY_NAME)
    if (!outputDir.exists()) {
      outputDir.mkdirs()
    }

    return File(
      outputDir,
      "compressed-${System.currentTimeMillis()}-${UUID.randomUUID()}.${outputFormat.fileExtension}"
    )
  }

  fun encodeBitmap(
    bitmap: Bitmap,
    outputFile: File,
    outputFormat: OutputFormat,
    quality: Int,
    maxBytes: Long?,
    copiedExifMetadata: CopiedExifMetadata? = null
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

  fun createResultMetadata(
    originalByteSize: Long,
    outputFile: File,
    dimensions: CompressionOutputDimensions,
    outputFormat: OutputFormat
  ): CompressionOutputResultMetadata {
    val byteSize = outputFile.length()

    return CompressionOutputResultMetadata(
      uri = Uri.fromFile(outputFile).toString(),
      format = outputFormat.value,
      width = dimensions.width,
      height = dimensions.height,
      byteSize = byteSize,
      originalByteSize = originalByteSize,
      compressionRatio = if (originalByteSize > 0L) {
        byteSize.toDouble() / originalByteSize.toDouble()
      } else {
        1.0
      }
    )
  }

  fun createFormatCapability(format: String): CompressionFormatCapability {
    val outputFormat = OutputFormat.fromValue(format)
    val isSupportedInput = outputFormat != null

    return CompressionFormatCapability(
      format = format,
      input = isSupportedInput,
      output = outputFormat != null,
      supportsAlpha = false,
      supportsAnimation = false,
      notes = when (outputFormat) {
        OutputFormat.JPEG -> jpegFormatNotes()
        OutputFormat.PNG -> pngFormatNotes()
        OutputFormat.WEBP -> webpFormatNotes()
        else -> notImplementedNotes()
      }
    )
  }

  private fun notImplementedNotes(): List<String> =
    listOf("Native codec support has not been implemented yet.")

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
    try {
      JpegExifMetadata.write(copiedExifMetadata, outputFile)
    } catch (error: Exception) {
      throw IllegalStateException(
        "Android MVP could not write preserved EXIF metadata.",
        error
      )
    }
  }

  private fun jpegFormatNotes(): List<String> =
    listOf(
      "Android MVP supports JPEG file:// and content:// sources.",
      "EXIF orientation is applied before resize and selected output encoding.",
      "Resize supports contain, cover, and stretch modes with maxWidth and maxHeight.",
      "Target-size compression supports maxBytes by adjusting JPEG quality.",
      "Metadata preserve copies supported JPEG source EXIF attributes into JPEG output.",
      "Metadata safe copies privacy-filtered JPEG source EXIF attributes.",
      "Metadata safe excludes GPS/location, owner/serial, maker note, user comment, and XMP.",
      "Metadata preserve normalizes output EXIF orientation after pixels are transformed.",
      "Metadata strip re-encodes JPEG output without preserving source metadata.",
      "PNG and WebP sources are decoded without copying EXIF metadata."
    )

  private fun pngFormatNotes(): List<String> =
    listOf(
      "Android MVP supports PNG file:// and content:// sources.",
      "Android can encode decoded JPEG, PNG, or WebP input to PNG output.",
      "PNG output ignores quality and does not support target-size maxBytes.",
      "Non-JPEG output does not preserve source EXIF metadata."
    )

  private fun webpFormatNotes(): List<String> =
    listOf(
      "Android MVP supports WebP file:// and content:// sources.",
      "Android can encode decoded JPEG, PNG, or WebP input to WebP output.",
      "WebP target-size compression supports maxBytes by adjusting WebP quality.",
      "Non-JPEG output does not preserve source EXIF metadata.",
      "Animated WebP input or output is not implemented."
    )

  private const val JPEG_FORMAT = "jpeg"
  private const val PNG_FORMAT = "png"
  private const val WEBP_FORMAT = "webp"
  private const val OUTPUT_DIRECTORY_NAME = "image-compression-kit"
  private const val MIN_QUALITY = 0
}
