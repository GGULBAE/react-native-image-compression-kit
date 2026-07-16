package com.imagecompressionkit

import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import androidx.exifinterface.media.ExifInterface
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.nio.charset.StandardCharsets

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AndroidImageDecoderTest {
  @get:Rule
  val temporaryFolder = TemporaryFolder()

  @Test
  fun decodesJpegIntoImmutableInputInfoInStableSourceOrder() {
    val bytes = createOrientedJpegBytes(
      width = 18,
      height = 12,
      orientation = ExifInterface.ORIENTATION_ROTATE_90
    )
    val source = AndroidCompressionSource.ContentSource(
      Uri.parse("content://decoder/source.jpg")
    )
    val access = RecordingSourceAccess(
      bytes = bytes,
      mimeType = "image/jpeg",
      fileExtension = "jpg"
    )
    val result = AndroidImageDecoder(access).decode(source)
      as AndroidImageDecodeResult.Success

    try {
      assertEquals(bytes.size.toLong(), result.inputInfo.originalByteSize)
      assertEquals(AndroidImageInputFormat.JPEG, result.inputInfo.format)
      assertEquals(18, result.inputInfo.bounds?.width)
      assertEquals(12, result.inputInfo.bounds?.height)
      assertEquals("image/jpeg", result.inputInfo.bounds?.mimeType)
      assertEquals(
        ExifInterface.ORIENTATION_ROTATE_90,
        result.inputInfo.exifOrientation
      )
      assertEquals(18, result.bitmap.width)
      assertEquals(12, result.bitmap.height)
      assertEquals(
        listOf("size", "mime", "mime", "stream", "stream", "stream"),
        access.calls
      )
      assertEquals(3, access.streams.size)
      assertTrue(access.streams.all { it.closed })
    } finally {
      result.bitmap.recycle()
    }
  }

  @Test
  fun derivesSupportedFormatFromBoundsAfterMimeAndExtensionMisses() {
    val bytes = createPngBytes(width = 11, height = 7)
    val access = RecordingSourceAccess(
      bytes = bytes,
      mimeType = "application/octet-stream",
      fileExtension = "bin"
    )
    val result = AndroidImageDecoder(access).decode(
      AndroidCompressionSource.ContentSource(Uri.parse("content://decoder/source.bin"))
    ) as AndroidImageDecodeResult.Success

    try {
      assertEquals(AndroidImageInputFormat.PNG, result.inputInfo.format)
      assertEquals(11, result.inputInfo.bounds?.width)
      assertEquals(7, result.inputInfo.bounds?.height)
      assertEquals(ExifInterface.ORIENTATION_NORMAL, result.inputInfo.exifOrientation)
      assertEquals(
        listOf(
          "size",
          "mime",
          "extension",
          "mime",
          "extension",
          "stream",
          "stream"
        ),
        access.calls
      )
      assertEquals(2, access.streams.size)
      assertTrue(access.streams.all { it.closed })
    } finally {
      result.bitmap.recycle()
    }
  }

  @Test
  fun rejectsUnavailablePlatformFormatsBeforeOpeningDecodeStreams() {
    val cases = listOf(
      PlatformCase(
        format = AndroidImageInputFormat.HEIC,
        sdkInt = Build.VERSION_CODES.N_MR1,
        message = "Android HEIC/HEIF input requires Android 8.0+ platform decoder support."
      ),
      PlatformCase(
        format = AndroidImageInputFormat.HEIF,
        sdkInt = Build.VERSION_CODES.N_MR1,
        message = "Android HEIC/HEIF input requires Android 8.0+ platform decoder support."
      ),
      PlatformCase(
        format = AndroidImageInputFormat.AVIF,
        sdkInt = Build.VERSION_CODES.TIRAMISU,
        message = "Android AVIF input requires Android 14+ platform decoder support."
      )
    )

    cases.forEach { case ->
      val access = RecordingSourceAccess(
        bytes = "not decoded".toByteArray(StandardCharsets.US_ASCII),
        mimeType = case.format.mimeType,
        fileExtension = case.format.fileExtensions.first()
      )
      val result = AndroidImageDecoder(access, sdkInt = case.sdkInt).decode(
        AndroidCompressionSource.ContentSource(
          Uri.parse("content://decoder/source.${case.format.fileExtensions.first()}")
        )
      ) as AndroidImageDecodeResult.UnsupportedFormat

      assertEquals(case.message, result.message)
      assertEquals(listOf("size", "mime"), access.calls)
      assertTrue(access.streams.isEmpty())
    }
  }

  @Test
  fun treatsSupportedHeifAndAvifInputsAsDecodeCandidates() {
    val resolver = AndroidImageSourceResolver(
      RuntimeEnvironment.getApplication().contentResolver
    )
    val decoder = AndroidImageDecoder(resolver, sdkInt = Build.VERSION_CODES.VANILLA_ICE_CREAM)

    listOf("heic", "heif", "avif").forEach { extension ->
      val file = temporaryFolder.newFile("invalid-${System.nanoTime()}.$extension").apply {
        writeText("not an image", StandardCharsets.US_ASCII)
      }
      val result = decoder.decode(
        AndroidCompressionSource.FileSource(Uri.fromFile(file), file)
      )

      assertTrue(result === AndroidImageDecodeResult.DecodeFailed)
    }
  }

  private fun createOrientedJpegBytes(
    width: Int,
    height: Int,
    orientation: Int
  ): ByteArray {
    val file = temporaryFolder.newFile("oriented-${System.nanoTime()}.jpg")
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    bitmap.eraseColor(0xff336699.toInt())

    file.outputStream().use { outputStream ->
      assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG, 90, outputStream))
    }
    bitmap.recycle()

    ExifInterface(file.absolutePath).apply {
      setAttribute(ExifInterface.TAG_ORIENTATION, orientation.toString())
      saveAttributes()
    }
    return file.readBytes()
  }

  private fun createPngBytes(width: Int, height: Int): ByteArray {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    bitmap.eraseColor(0xff224466.toInt())
    val outputStream = ByteArrayOutputStream()

    assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream))
    bitmap.recycle()
    return outputStream.toByteArray()
  }

  private data class PlatformCase(
    val format: AndroidImageInputFormat,
    val sdkInt: Int,
    val message: String
  )

  private class RecordingSourceAccess(
    private val bytes: ByteArray,
    private val mimeType: String?,
    private val fileExtension: String?
  ) : AndroidImageSourceAccess {
    val calls = mutableListOf<String>()
    val streams = mutableListOf<CloseTrackingInputStream>()

    override fun readOriginalByteSize(source: AndroidCompressionSource): Long {
      calls += "size"
      return bytes.size.toLong()
    }

    override fun readMimeType(source: AndroidCompressionSource): String? {
      calls += "mime"
      return mimeType
    }

    override fun readFileExtension(source: AndroidCompressionSource): String? {
      calls += "extension"
      return fileExtension
    }

    override fun openInputStream(source: AndroidCompressionSource): InputStream {
      calls += "stream"
      return CloseTrackingInputStream(bytes).also(streams::add)
    }

    override fun createImageDecoderSource(
      source: AndroidCompressionSource
    ): ImageDecoder.Source {
      calls += "image-decoder-source"
      throw AssertionError("ImageDecoder source was not expected for this case.")
    }
  }

  private class CloseTrackingInputStream(bytes: ByteArray) : ByteArrayInputStream(bytes) {
    var closed = false
      private set

    override fun close() {
      closed = true
      super.close()
    }
  }
}
