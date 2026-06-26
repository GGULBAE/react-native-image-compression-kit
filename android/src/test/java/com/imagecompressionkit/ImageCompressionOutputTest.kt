package com.imagecompressionkit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.ByteArrayOutputStream
import java.nio.charset.StandardCharsets

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ImageCompressionOutputTest {
  @get:Rule
  val temporaryFolder = TemporaryFolder()

  @Test
  fun outputFormatsCreateMatchingResultFormatAndFileExtensions() {
    val cases = listOf(
      OutputFormat.JPEG to ".jpg",
      OutputFormat.PNG to ".png",
      OutputFormat.WEBP to ".webp"
    )

    cases.forEach { (outputFormat, expectedExtension) ->
      val outputFile = ImageCompressionOutput.createOutputFile(
        cacheDir = temporaryFolder.root,
        outputFormat = outputFormat
      )
      outputFile.writeBytes(ByteArray(128) { 1 })

      val result = ImageCompressionOutput.createResultMetadata(
        originalByteSize = 256,
        outputFile = outputFile,
        dimensions = CompressionOutputDimensions(width = 80, height = 60),
        outputFormat = outputFormat
      )

      assertTrue(outputFile.name.endsWith(expectedExtension))
      assertTrue(result.uri.endsWith(expectedExtension))
      assertEquals(outputFormat.value, result.format)
      assertEquals(80, result.width)
      assertEquals(60, result.height)
      assertEquals(128L, result.byteSize)
      assertEquals(256L, result.originalByteSize)
      assertEquals(0.5, result.compressionRatio, 0.0001)
    }
  }

  @Test
  @GraphicsMode(GraphicsMode.Mode.NATIVE)
  fun encodedOutputsContainExpectedByteSignaturesAndResultMetadataMatchesFile() {
    val sampleJpegBytes = createSampleJpegBytes()
    val bitmap = decodeSampleJpegBitmap(sampleJpegBytes)
    val cases = listOf(
      OutputFormat.JPEG,
      OutputFormat.PNG,
      OutputFormat.WEBP
    )

    cases.forEach { outputFormat ->
      val outputFile = ImageCompressionOutput.createOutputFile(
        cacheDir = temporaryFolder.root,
        outputFormat = outputFormat
      )

      assertTrue(
        ImageCompressionOutput.encodeBitmap(
          bitmap = bitmap,
          outputFile = outputFile,
          outputFormat = outputFormat,
          quality = 72,
          maxBytes = null
        )
      )

      val result = ImageCompressionOutput.createResultMetadata(
        originalByteSize = sampleJpegBytes.size.toLong(),
        outputFile = outputFile,
        dimensions = CompressionOutputDimensions(
          width = bitmap.width,
          height = bitmap.height
        ),
        outputFormat = outputFormat
      )
      val outputBytes = outputFile.readBytes()

      when (outputFormat) {
        OutputFormat.JPEG -> assertJpegSignature(outputBytes)
        OutputFormat.PNG -> assertPngSignature(outputBytes)
        OutputFormat.WEBP -> assertWebpSignature(outputBytes)
      }
      assertEquals(outputFile.length(), result.byteSize)
      assertEquals(
        outputFile.length().toDouble() / sampleJpegBytes.size.toDouble(),
        result.compressionRatio,
        0.0001
      )
    }

    bitmap.recycle()
  }

  @Test
  fun capabilitiesExposeJpegPngWebpGifInputsAndJpegPngWebpOutputsOnly() {
    val capabilities = ImageCompressionOutput.FORMAT_VALUES.associateWith {
      ImageCompressionOutput.createFormatCapability(it)
    }

    assertEquals(
      listOf("jpeg", "png", "webp", "heic", "heif", "avif", "gif"),
      ImageCompressionOutput.FORMAT_VALUES.toList()
    )

    assertCapability(
      capability = capabilities.getValue("jpeg"),
      input = true,
      output = true
    )
    assertCapability(
      capability = capabilities.getValue("png"),
      input = true,
      output = true
    )
    assertCapability(
      capability = capabilities.getValue("webp"),
      input = true,
      output = true
    )
    assertTrue(
      capabilities.getValue("jpeg").notes.any {
        it == "PNG, WebP, and GIF sources are decoded without copying EXIF metadata."
      }
    )
    assertCapability(
      capability = capabilities.getValue("heic"),
      input = false,
      output = false
    )
    assertHeicHeifCapabilityNotes(
      capability = capabilities.getValue("heic"),
      formatLabel = "HEIC"
    )
    assertCapability(
      capability = capabilities.getValue("heif"),
      input = false,
      output = false
    )
    assertHeicHeifCapabilityNotes(
      capability = capabilities.getValue("heif"),
      formatLabel = "HEIF"
    )
    assertCapability(
      capability = capabilities.getValue("avif"),
      input = false,
      output = false
    )
    assertCapability(
      capability = capabilities.getValue("gif"),
      input = true,
      output = false
    )
    assertTrue(
      capabilities.getValue("gif").notes.any {
        it == "Android MVP decodes GIF file:// and content:// sources as a static first frame."
      }
    )
    assertTrue(
      capabilities.getValue("gif").notes.any {
        it == "Animated GIF preservation is not implemented."
      }
    )
    assertTrue(
      capabilities.getValue("gif").notes.any {
        it == "GIF output is not implemented."
      }
    )
    assertTrue(
      capabilities.getValue("png").notes.any {
        it == "Android MVP supports PNG file:// and content:// sources."
      }
    )
    assertTrue(
      capabilities.getValue("png").notes.any {
        it == "PNG output ignores quality and does not support target-size maxBytes."
      }
    )
    assertTrue(
      capabilities.getValue("webp").notes.any {
        it == "Android MVP supports WebP file:// and content:// sources."
      }
    )
    assertTrue(
      capabilities.getValue("webp").notes.any {
        it == "WebP target-size compression supports maxBytes by adjusting WebP quality."
      }
    )
  }

  @Test
  fun pngRejectsMaxBytesButWebpAndJpegAllowIt() {
    assertNull(
      ImageCompressionOutput.maxBytesValidationError(
        outputFormat = OutputFormat.JPEG,
        maxBytes = 10_000
      )
    )
    assertNull(
      ImageCompressionOutput.maxBytesValidationError(
        outputFormat = OutputFormat.WEBP,
        maxBytes = 10_000
      )
    )
    assertNull(
      ImageCompressionOutput.maxBytesValidationError(
        outputFormat = OutputFormat.PNG,
        maxBytes = null
      )
    )
    assertEquals(
      ImageCompressionOutput.MAX_BYTES_UNSUPPORTED_MESSAGE,
      ImageCompressionOutput.maxBytesValidationError(
        outputFormat = OutputFormat.PNG,
        maxBytes = 10_000
      )
    )
  }

  @Test
  fun outputFormatsMapToAndroidCompressFormatsAndQualityRules() {
    assertEquals(Bitmap.CompressFormat.JPEG, OutputFormat.JPEG.compressFormat)
    assertEquals(Bitmap.CompressFormat.PNG, OutputFormat.PNG.compressFormat)
    assertEquals(Bitmap.CompressFormat.WEBP_LOSSY, OutputFormat.WEBP.compressFormat)
    assertEquals(72, OutputFormat.JPEG.compressionQuality(72))
    assertEquals(72, OutputFormat.WEBP.compressionQuality(72))
    assertEquals(100, OutputFormat.PNG.compressionQuality(1))
  }

  private fun assertCapability(
    capability: CompressionFormatCapability,
    input: Boolean,
    output: Boolean
  ) {
    assertEquals(input, capability.input)
    assertEquals(output, capability.output)
    assertFalse(capability.supportsAlpha)
    assertFalse(capability.supportsAnimation)
    assertTrue(capability.notes.isNotEmpty())
  }

  private fun assertHeicHeifCapabilityNotes(
    capability: CompressionFormatCapability,
    formatLabel: String
  ) {
    assertTrue(
      capability.notes.any {
        it == "$formatLabel input is currently disabled and rejected with ERR_UNSUPPORTED_FORMAT."
      }
    )
    assertTrue(
      capability.notes.any {
        it == "Android platform HEIF decode support is available on Android 8.0+ when device codecs are present."
      }
    )
    assertTrue(
      capability.notes.any {
        it == "Planned Android route: use ImageDecoder on API 28+ and evaluate BitmapFactory fallback on API 26-27."
      }
    )
    assertTrue(
      capability.notes.any {
        it == "$formatLabel output is not implemented."
      }
    )
  }

  private fun createSampleJpegBytes(): ByteArray {
    val bitmap = Bitmap.createBitmap(16, 12, Bitmap.Config.ARGB_8888)
    bitmap.eraseColor(0xff336699.toInt())

    val outputStream = ByteArrayOutputStream()
    assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG, 90, outputStream))
    bitmap.recycle()

    val bytes = outputStream.toByteArray()
    assertJpegSignature(bytes)
    return bytes
  }

  private fun decodeSampleJpegBitmap(bytes: ByteArray): Bitmap {
    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)

    assertTrue(bitmap != null)
    return bitmap!!
  }

  private fun assertJpegSignature(bytes: ByteArray) {
    assertTrue(bytes.size >= 3)
    assertEquals(0xff.toByte(), bytes[0])
    assertEquals(0xd8.toByte(), bytes[1])
    assertEquals(0xff.toByte(), bytes[2])
  }

  private fun assertPngSignature(bytes: ByteArray) {
    val signature = byteArrayOf(
      0x89.toByte(),
      0x50.toByte(),
      0x4e.toByte(),
      0x47.toByte(),
      0x0d.toByte(),
      0x0a.toByte(),
      0x1a.toByte(),
      0x0a.toByte()
    )

    assertTrue(bytes.size >= signature.size)
    signature.forEachIndexed { index, value ->
      assertEquals(value, bytes[index])
    }
  }

  private fun assertWebpSignature(bytes: ByteArray) {
    assertTrue(bytes.size >= 12)
    assertEquals("RIFF", String(bytes, 0, 4, StandardCharsets.US_ASCII))
    assertEquals("WEBP", String(bytes, 8, 4, StandardCharsets.US_ASCII))
  }
}
