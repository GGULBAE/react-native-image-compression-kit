package com.imagecompressionkit

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import com.facebook.react.bridge.CatalystInstance
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.JavaScriptModule
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.charset.StandardCharsets

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ImageCompressionKitModuleTest {
  @get:Rule
  val temporaryFolder = TemporaryFolder()

  @Test
  fun compressImageCreatesJpegPngAndWebpOutputsWithExpectedResultMetadata() {
    val module = createModule()
    val sourceFile = createSampleJpegFile()
    val cases = listOf(
      "jpeg" to ::assertJpegSignature,
      "png" to ::assertPngSignature,
      "webp" to ::assertWebpSignature
    )

    cases.forEach { (format, assertSignature) ->
      val promise = RecordingPromise()

      module.compressImage(
        compressionOptions(
          sourceFile = sourceFile,
          output = JavaOnlyMap.of(
            "format",
            format,
            "quality",
            72
          )
        ),
        promise
      )

      val result = promise.resolvedMap()
      val outputFile = result.outputFile()
      val outputBytes = outputFile.readBytes()

      assertNull(promise.rejectionCode)
      assertSignature(outputBytes)
      assertEquals(format, result.getString("format"))
      assertEquals(16, result.getInt("width"))
      assertEquals(12, result.getInt("height"))
      assertEquals(outputFile.length().toDouble(), result.getDouble("byteSize"), 0.0001)
      assertEquals(sourceFile.length().toDouble(), result.getDouble("originalByteSize"), 0.0001)
      assertEquals(
        outputFile.length().toDouble() / sourceFile.length().toDouble(),
        result.getDouble("compressionRatio"),
        0.0001
      )
    }
  }

  @Test
  fun compressImageRejectsPngMaxBytesAtModuleBoundary() {
    val module = createModule()
    val promise = RecordingPromise()

    module.compressImage(
      compressionOptions(
        sourceFile = createSampleJpegFile(),
        output = JavaOnlyMap.of(
          "format",
          "png",
          "quality",
          72,
          "maxBytes",
          10_000
        )
      ),
      promise
    )

    assertNull(promise.resolvedValue)
    assertEquals(ImageCompressionKitModule.ERR_INVALID_OPTIONS, promise.rejectionCode)
    assertEquals(ImageCompressionOutput.MAX_BYTES_UNSUPPORTED_MESSAGE, promise.rejectionMessage)
  }

  private fun createModule(): ImageCompressionKitModule =
    ImageCompressionKitModule(
      TestReactApplicationContext(RuntimeEnvironment.getApplication())
    )

  private fun compressionOptions(
    sourceFile: File,
    output: JavaOnlyMap
  ): JavaOnlyMap =
    JavaOnlyMap.of(
      "source",
      JavaOnlyMap.of("uri", Uri.fromFile(sourceFile).toString()),
      "output",
      output,
      "metadata",
      "strip"
    )

  private fun createSampleJpegFile(): File {
    val bitmap = Bitmap.createBitmap(16, 12, Bitmap.Config.ARGB_8888)
    bitmap.eraseColor(0xff336699.toInt())

    val outputStream = ByteArrayOutputStream()
    assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG, 90, outputStream))
    bitmap.recycle()

    val bytes = outputStream.toByteArray()
    assertJpegSignature(bytes)

    return temporaryFolder.newFile("source-${System.nanoTime()}.jpg").apply {
      writeBytes(bytes)
      assertTrue(length() > 0)
    }
  }

  private fun RecordingPromise.resolvedMap(): ReadableMap {
    assertNull(rejectionCode)
    assertNotNull(resolvedValue)

    return resolvedValue as ReadableMap
  }

  private fun ReadableMap.outputFile(): File {
    val uri = Uri.parse(getString("uri"))

    assertEquals("file", uri.scheme)
    return File(uri.path ?: error("Output URI must contain a file path.")).also {
      assertTrue(it.exists())
      assertTrue(it.length() > 0)
    }
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

  private class TestReactApplicationContext(context: Context) : ReactApplicationContext(context) {
    override fun <T : JavaScriptModule> getJSModule(jsInterface: Class<T>): T =
      throw UnsupportedOperationException("JS modules are not needed in module unit tests.")

    override fun <T : NativeModule> hasNativeModule(nativeModuleInterface: Class<T>): Boolean =
      false

    override fun getNativeModules(): Collection<NativeModule> =
      emptyList()

    override fun <T : NativeModule> getNativeModule(nativeModuleInterface: Class<T>): T? =
      null

    override fun getNativeModule(moduleName: String): NativeModule? =
      null

    override fun getCatalystInstance(): CatalystInstance =
      throw UnsupportedOperationException("CatalystInstance is not needed in module unit tests.")

    override fun hasActiveCatalystInstance(): Boolean =
      false

    override fun hasActiveReactInstance(): Boolean =
      false

    override fun hasCatalystInstance(): Boolean =
      false

    override fun hasReactInstance(): Boolean =
      false
  }

  private class RecordingPromise : Promise {
    var resolvedValue: Any? = null
      private set
    var rejectionCode: String? = null
      private set
    var rejectionMessage: String? = null
      private set
    var rejectionThrowable: Throwable? = null
      private set

    override fun resolve(value: Any?) {
      resolvedValue = value
    }

    override fun reject(code: String?, message: String?) {
      recordRejection(code, message, null)
    }

    override fun reject(code: String?, throwable: Throwable?) {
      recordRejection(code, throwable?.message, throwable)
    }

    override fun reject(code: String?, message: String?, throwable: Throwable?) {
      recordRejection(code, message, throwable)
    }

    override fun reject(throwable: Throwable) {
      recordRejection(null, throwable.message, throwable)
    }

    override fun reject(throwable: Throwable, userInfo: WritableMap) {
      recordRejection(null, throwable.message, throwable)
    }

    override fun reject(code: String?, userInfo: WritableMap) {
      recordRejection(code, null, null)
    }

    override fun reject(code: String?, throwable: Throwable?, userInfo: WritableMap) {
      recordRejection(code, throwable?.message, throwable)
    }

    override fun reject(code: String?, message: String?, userInfo: WritableMap) {
      recordRejection(code, message, null)
    }

    override fun reject(
      code: String?,
      message: String?,
      throwable: Throwable?,
      userInfo: WritableMap?
    ) {
      recordRejection(code, message, throwable)
    }

    @Deprecated(
      message = "Prefer passing a module-specific error code to JS.",
      replaceWith = ReplaceWith("reject(code, message)")
    )
    override fun reject(message: String) {
      recordRejection(null, message, null)
    }

    private fun recordRejection(
      code: String?,
      message: String?,
      throwable: Throwable?
    ) {
      rejectionCode = code
      rejectionMessage = message
      rejectionThrowable = throwable
    }
  }
}
