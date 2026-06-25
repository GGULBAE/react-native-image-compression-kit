package com.imagecompressionkit

import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.util.Base64
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
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

    file.writeBytes(Base64.getMimeDecoder().decode(SAMPLE_JPEG_BASE64))
    assertTrue(file.length() > 0)
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
    assertEquals(width, outputExif.getAttributeInt(ExifInterface.TAG_PIXEL_X_DIMENSION, 0))
    assertEquals(height, outputExif.getAttributeInt(ExifInterface.TAG_PIXEL_Y_DIMENSION, 0))
  }

  companion object {
    private const val SAMPLE_JPEG_BASE64 =
      "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAABKADAAQAAAABAAAABAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgABAAEAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+r/h78LPAfijwfp+u67pn2m+ufN8yTzpk3bJXRflR1UYVQOBXaf8KN+Fv/QE/wDJm5/+O1d+D3/JOdI/7eP/AEfJXplfxnxP4n8S4XMsThsNmdeFOFScYxjWqKMYqTSjFKSSSWiS0S0R9twZwrlePyfB47HYWnVrVaVOc5zhGUpylFOUpSablKTbbbbbbbbuf//Z"
  }
}
