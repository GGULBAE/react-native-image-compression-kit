package com.imagecompressionkit

import android.annotation.TargetApi
import android.content.ContentResolver
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import java.io.FileInputStream
import java.io.InputStream

internal interface AndroidImageSourceAccess {
  fun readOriginalByteSize(source: AndroidCompressionSource): Long

  fun readMimeType(source: AndroidCompressionSource): String?

  fun readFileExtension(source: AndroidCompressionSource): String?

  fun openInputStream(source: AndroidCompressionSource): InputStream

  @TargetApi(Build.VERSION_CODES.P)
  fun createImageDecoderSource(source: AndroidCompressionSource): ImageDecoder.Source
}

internal class AndroidImageSourceResolver(
  private val contentResolver: ContentResolver
) : AndroidImageSourceAccess {
  override fun readOriginalByteSize(source: AndroidCompressionSource): Long =
    when (source) {
      is AndroidCompressionSource.FileSource -> {
        val inputFile = source.file

        if (!inputFile.exists() || !inputFile.isFile || !inputFile.canRead()) {
          throw AndroidImageSourceAccessException(
            "Android MVP could not read the source file."
          )
        }

        inputFile.length()
      }
      is AndroidCompressionSource.ContentSource ->
        queryContentByteSize(source.uri)
          ?: queryContentAssetLength(source.uri)
          ?: countBytes(source)
    }

  override fun readMimeType(source: AndroidCompressionSource): String? =
    when (source) {
      is AndroidCompressionSource.FileSource -> null
      is AndroidCompressionSource.ContentSource -> queryContentMimeType(source.uri)
    }

  override fun readFileExtension(source: AndroidCompressionSource): String? =
    when (source) {
      is AndroidCompressionSource.FileSource -> source.file.extension
      is AndroidCompressionSource.ContentSource ->
        source.uri.lastPathSegment?.substringAfterLast('.', "")
    }

  override fun openInputStream(source: AndroidCompressionSource): InputStream =
    try {
      when (source) {
        is AndroidCompressionSource.FileSource -> FileInputStream(source.file)
        is AndroidCompressionSource.ContentSource ->
          contentResolver.openInputStream(source.uri)
            ?: throw AndroidImageSourceAccessException(
              "Android MVP could not open the source content URI."
            )
      }
    } catch (error: AndroidImageSourceAccessException) {
      throw error
    } catch (error: Exception) {
      throw AndroidImageSourceAccessException(
        "Android MVP could not read the source image URI.",
        error
      )
    }

  @TargetApi(Build.VERSION_CODES.P)
  override fun createImageDecoderSource(
    source: AndroidCompressionSource
  ): ImageDecoder.Source =
    when (source) {
      is AndroidCompressionSource.FileSource -> ImageDecoder.createSource(source.file)
      is AndroidCompressionSource.ContentSource ->
        ImageDecoder.createSource(contentResolver, source.uri)
    }

  private fun queryContentByteSize(uri: Uri): Long? =
    try {
      contentResolver.query(
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
      contentResolver.openAssetFileDescriptor(uri, "r")?.use { descriptor ->
        if (descriptor.length >= 0L) {
          descriptor.length
        } else {
          null
        }
      }
    } catch (_: Exception) {
      null
    }

  private fun queryContentMimeType(uri: Uri): String? =
    try {
      contentResolver.getType(uri)
    } catch (_: Exception) {
      null
    }

  private fun countBytes(source: AndroidCompressionSource): Long =
    openInputStream(source).use { inputStream ->
      val buffer = ByteArray(STREAM_BUFFER_SIZE)
      var totalBytes = 0L
      var bytesRead = inputStream.read(buffer)

      while (bytesRead != -1) {
        totalBytes += bytesRead.toLong()
        bytesRead = inputStream.read(buffer)
      }

      totalBytes
    }

  companion object {
    private const val STREAM_BUFFER_SIZE = 8 * 1024
  }
}

internal class AndroidImageSourceAccessException(
  message: String,
  cause: Throwable? = null
) : Exception(message, cause)
