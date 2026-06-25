package com.imagecompressionkit

import android.graphics.Bitmap
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
  fun capabilitiesExposeJpegInputAndJpegPngWebpOutputsOnly() {
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
      input = false,
      output = true
    )
    assertCapability(
      capability = capabilities.getValue("webp"),
      input = false,
      output = true
    )
    assertCapability(
      capability = capabilities.getValue("heic"),
      input = false,
      output = false
    )
    assertCapability(
      capability = capabilities.getValue("heif"),
      input = false,
      output = false
    )
    assertCapability(
      capability = capabilities.getValue("avif"),
      input = false,
      output = false
    )
    assertCapability(
      capability = capabilities.getValue("gif"),
      input = false,
      output = false
    )
    assertTrue(
      capabilities.getValue("png").notes.any {
        it == "PNG output ignores quality and does not support target-size maxBytes."
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
}
