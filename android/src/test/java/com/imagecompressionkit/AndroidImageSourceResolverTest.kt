package com.imagecompressionkit

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.provider.OpenableColumns
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowContentResolver
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.nio.charset.StandardCharsets
import java.util.function.Supplier

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AndroidImageSourceResolverTest {
  @get:Rule
  val temporaryFolder = TemporaryFolder()

  @Test
  fun readsFileSizeExtensionAndStream() {
    val bytes = "file source".toByteArray(StandardCharsets.UTF_8)
    val file = temporaryFolder.newFile("source.JPEG").apply {
      writeBytes(bytes)
    }
    val source = AndroidCompressionSource.FileSource(Uri.fromFile(file), file)
    val resolver = createResolver()

    assertEquals(bytes.size.toLong(), resolver.readOriginalByteSize(source))
    assertNull(resolver.readMimeType(source))
    assertEquals("JPEG", resolver.readFileExtension(source))
    resolver.openInputStream(source).use { inputStream ->
      assertArrayEquals(bytes, inputStream.readBytes())
    }
  }

  @Test
  fun readsContentMimeExtensionAndCountedSizeWithClosedStreams() {
    val bytes = "content source bytes".toByteArray(StandardCharsets.UTF_8)
    val uri = uniqueContentUri("fallback", "image.jpg")
    val streams = mutableListOf<CloseTrackingInputStream>()
    val resolver = createResolver()

    registerProvider(uri, size = null, mimeType = "image/jpeg")
    shadowOf(RuntimeEnvironment.getApplication().contentResolver)
      .registerInputStreamSupplier(
        uri,
        Supplier {
          CloseTrackingInputStream(bytes).also(streams::add)
        }
      )

    assertEquals(bytes.size.toLong(), resolver.readOriginalByteSize(contentSource(uri)))
    assertEquals("image/jpeg", resolver.readMimeType(contentSource(uri)))
    assertEquals("jpg", resolver.readFileExtension(contentSource(uri)))
    assertTrue(streams.isNotEmpty())
    assertTrue(streams.all { it.closed })
  }

  @Test
  fun prefersOpenableSizeWithoutOpeningContentStream() {
    val uri = uniqueContentUri("sized", "source.bin")
    var opened = false
    val resolver = createResolver()

    registerProvider(uri, size = 4_096L, mimeType = "image/png")
    shadowOf(RuntimeEnvironment.getApplication().contentResolver)
      .registerInputStreamSupplier(
        uri,
        Supplier {
          opened = true
          ByteArrayInputStream(byteArrayOf(1, 2, 3))
        }
      )

    assertEquals(4_096L, resolver.readOriginalByteSize(contentSource(uri)))
    assertEquals("image/png", resolver.readMimeType(contentSource(uri)))
    assertFalse(opened)
  }

  @Test
  fun preservesStableErrorsForUnreadableFileAndContentSources() {
    val resolver = createResolver()
    val missingFile = temporaryFolder.root.resolve("missing.jpg")
    val missingFileFailure = captureSourceFailure {
      resolver.readOriginalByteSize(
        AndroidCompressionSource.FileSource(Uri.fromFile(missingFile), missingFile)
      )
    }
    val uri = uniqueContentUri("missing", "source.jpg")

    shadowOf(RuntimeEnvironment.getApplication().contentResolver)
      .registerInputStreamSupplier(
        uri,
        Supplier {
          throw IllegalStateException("Missing test stream.")
        }
      )
    val missingContentFailure = captureSourceFailure {
      resolver.readOriginalByteSize(contentSource(uri))
    }

    assertEquals("Android MVP could not read the source file.", missingFileFailure.message)
    assertEquals(
      "Android MVP could not read the source image URI.",
      missingContentFailure.message
    )
    assertTrue(missingContentFailure.cause is IllegalStateException)
  }

  private fun createResolver(): AndroidImageSourceResolver =
    AndroidImageSourceResolver(RuntimeEnvironment.getApplication().contentResolver)

  private fun contentSource(uri: Uri): AndroidCompressionSource.ContentSource =
    AndroidCompressionSource.ContentSource(uri)

  private fun uniqueContentUri(prefix: String, name: String): Uri =
    Uri.parse("content://image-source-$prefix-${System.nanoTime()}/$name")

  private fun registerProvider(
    uri: Uri,
    size: Long?,
    mimeType: String?
  ) {
    ShadowContentResolver.registerProviderInternal(
      uri.authority ?: error("Content URI authority is required."),
      ResolverTestContentProvider(size, mimeType)
    )
  }

  private fun captureSourceFailure(block: () -> Unit): AndroidImageSourceAccessException =
    try {
      block()
      throw AssertionError("Expected source access to fail.")
    } catch (error: AndroidImageSourceAccessException) {
      error
    }

  private class CloseTrackingInputStream(bytes: ByteArray) : ByteArrayInputStream(bytes) {
    var closed = false
      private set

    override fun close() {
      closed = true
      super.close()
    }
  }

  private class ResolverTestContentProvider(
    private val size: Long?,
    private val mimeType: String?
  ) : ContentProvider() {
    override fun onCreate(): Boolean = true

    override fun query(
      uri: Uri,
      projection: Array<out String>?,
      selection: String?,
      selectionArgs: Array<out String>?,
      sortOrder: String?
    ): Cursor? =
      size?.let { value ->
        MatrixCursor(arrayOf(OpenableColumns.SIZE)).apply {
          addRow(arrayOf(value))
        }
      }

    override fun getType(uri: Uri): String? = mimeType

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(
      uri: Uri,
      selection: String?,
      selectionArgs: Array<out String>?
    ): Int = 0

    override fun update(
      uri: Uri,
      values: ContentValues?,
      selection: String?,
      selectionArgs: Array<out String>?
    ): Int = 0
  }
}
