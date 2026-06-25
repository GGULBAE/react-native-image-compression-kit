package com.imagecompressionkit

import androidx.exifinterface.media.ExifInterface
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class JpegExifMetadataTest {
  @get:Rule
  val temporaryFolder = TemporaryFolder()

  @Test
  fun safeMetadataCopiesAllowlistedExifAndFiltersSensitiveTags() {
    val sourceFile = createJpegFile("safe-source.jpg")
    val outputFile = createJpegFile("safe-output.jpg")
    writeSourceExif(sourceFile)

    val metadata = sourceFile.inputStream().use { inputStream ->
      JpegExifMetadata.read(
        inputStream = inputStream,
        exifTags = JpegExifMetadata.SAFE_EXIF_TAGS,
        width = 320,
        height = 240
      )
    }

    JpegExifMetadata.write(metadata, outputFile)

    val outputExif = ExifInterface(outputFile.absolutePath)

    assertEquals("Acme Camera Co.", outputExif.getAttribute(ExifInterface.TAG_MAKE))
    assertEquals("Acme Model 1", outputExif.getAttribute(ExifInterface.TAG_MODEL))
    assertEquals(
      "2026:06:25 12:34:56",
      outputExif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL)
    )
    assertEquals("35mm Prime", outputExif.getAttribute(ExifInterface.TAG_LENS_MODEL))
    assertEquals("UnitTest Encoder", outputExif.getAttribute(ExifInterface.TAG_SOFTWARE))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_GPS_LATITUDE))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_CAMERA_OWNER_NAME))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_BODY_SERIAL_NUMBER))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_LENS_SERIAL_NUMBER))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_USER_COMMENT))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_IMAGE_UNIQUE_ID))
    assertNormalizedOutputGeometry(outputExif, width = 320, height = 240)
  }

  @Test
  fun preserveMetadataCopiesSensitiveExifButNormalizesOutputGeometry() {
    val sourceFile = createJpegFile("preserve-source.jpg")
    val outputFile = createJpegFile("preserve-output.jpg")
    writeSourceExif(sourceFile)

    val metadata = sourceFile.inputStream().use { inputStream ->
      JpegExifMetadata.read(
        inputStream = inputStream,
        exifTags = JpegExifMetadata.PRESERVED_EXIF_TAGS,
        width = 640,
        height = 480
      )
    }

    JpegExifMetadata.write(metadata, outputFile)

    val outputExif = ExifInterface(outputFile.absolutePath)

    assertEquals("Acme Camera Co.", outputExif.getAttribute(ExifInterface.TAG_MAKE))
    assertEquals("N", outputExif.getAttribute(ExifInterface.TAG_GPS_LATITUDE_REF))
    assertNotNull(outputExif.getAttribute(ExifInterface.TAG_GPS_LATITUDE))
    assertEquals("E", outputExif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF))
    assertNotNull(outputExif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE))
    assertEquals("Owner Name", outputExif.getAttribute(ExifInterface.TAG_CAMERA_OWNER_NAME))
    assertEquals("Body-123", outputExif.getAttribute(ExifInterface.TAG_BODY_SERIAL_NUMBER))
    assertEquals("Lens-456", outputExif.getAttribute(ExifInterface.TAG_LENS_SERIAL_NUMBER))
    assertEquals("Sensitive comment", outputExif.getAttribute(ExifInterface.TAG_USER_COMMENT))
    assertEquals("Image-Unique-789", outputExif.getAttribute(ExifInterface.TAG_IMAGE_UNIQUE_ID))
    assertNormalizedOutputGeometry(outputExif, width = 640, height = 480)
  }

  @Test
  fun nullMetadataLeavesOutputExifUntouchedForStripPolicy() {
    val outputFile = createJpegFile("strip-output.jpg")

    JpegExifMetadata.write(metadata = null, outputFile = outputFile)

    val outputExif = ExifInterface(outputFile.absolutePath)

    assertNull(outputExif.getAttribute(ExifInterface.TAG_MAKE))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_GPS_LATITUDE))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_CAMERA_OWNER_NAME))
  }

  private fun createJpegFile(fileName: String): File {
    val file = temporaryFolder.newFile(fileName)
    val image = BufferedImage(12, 8, BufferedImage.TYPE_INT_RGB)

    for (x in 0 until image.width) {
      for (y in 0 until image.height) {
        image.setRGB(x, y, Color.WHITE.rgb)
      }
    }

    assertTrue(ImageIO.write(image, "jpg", file))

    return file
  }

  private fun writeSourceExif(file: File) {
    val sourceExif = ExifInterface(file.absolutePath)

    sourceExif.setAttribute(ExifInterface.TAG_MAKE, "Acme Camera Co.")
    sourceExif.setAttribute(ExifInterface.TAG_MODEL, "Acme Model 1")
    sourceExif.setAttribute(ExifInterface.TAG_DATETIME_ORIGINAL, "2026:06:25 12:34:56")
    sourceExif.setAttribute(ExifInterface.TAG_LENS_MODEL, "35mm Prime")
    sourceExif.setAttribute(ExifInterface.TAG_SOFTWARE, "UnitTest Encoder")
    sourceExif.setAttribute(
      ExifInterface.TAG_ORIENTATION,
      ExifInterface.ORIENTATION_ROTATE_90.toString()
    )
    sourceExif.setAttribute(ExifInterface.TAG_GPS_LATITUDE_REF, "N")
    sourceExif.setAttribute(ExifInterface.TAG_GPS_LATITUDE, "37/1,30/1,0/1")
    sourceExif.setAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF, "E")
    sourceExif.setAttribute(ExifInterface.TAG_GPS_LONGITUDE, "127/1,0/1,0/1")
    sourceExif.setAttribute(ExifInterface.TAG_CAMERA_OWNER_NAME, "Owner Name")
    sourceExif.setAttribute(ExifInterface.TAG_BODY_SERIAL_NUMBER, "Body-123")
    sourceExif.setAttribute(ExifInterface.TAG_LENS_SERIAL_NUMBER, "Lens-456")
    sourceExif.setAttribute(ExifInterface.TAG_USER_COMMENT, "Sensitive comment")
    sourceExif.setAttribute(ExifInterface.TAG_IMAGE_UNIQUE_ID, "Image-Unique-789")
    sourceExif.saveAttributes()
  }

  private fun assertNormalizedOutputGeometry(
    outputExif: ExifInterface,
    width: Int,
    height: Int
  ) {
    assertEquals(
      ExifInterface.ORIENTATION_NORMAL,
      outputExif.getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_UNDEFINED
      )
    )
    assertEquals(width, outputExif.getAttributeInt(ExifInterface.TAG_IMAGE_WIDTH, 0))
    assertEquals(height, outputExif.getAttributeInt(ExifInterface.TAG_IMAGE_LENGTH, 0))
    assertEquals(width, outputExif.getAttributeInt(ExifInterface.TAG_PIXEL_X_DIMENSION, 0))
    assertEquals(height, outputExif.getAttributeInt(ExifInterface.TAG_PIXEL_Y_DIMENSION, 0))
  }
}
