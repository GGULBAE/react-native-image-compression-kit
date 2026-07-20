package com.imagecompressionkit

import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.CatalystInstance
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.JavaScriptContextHolder
import com.facebook.react.bridge.JavaScriptModule
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UIManager
import com.facebook.react.bridge.WritableMap
import com.facebook.react.turbomodule.core.interfaces.CallInvokerHolder
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class ImageCompressionKitHeicHeifInstrumentationTest {
  private val logTag = "RNICK_AVIF_OUTPUT_SMOKE"

  @Test
  fun compressesCommittedHeicHeifAndAvifSamplesToJpegPngAndWebp() {
    assertTrue(
      "Codec instrumentation validation must run on API 34+ to exercise AVIF ImageDecoder.",
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
    )

    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val testContext = instrumentation.context
    val targetContext = instrumentation.targetContext.applicationContext
    val module = ImageCompressionKitModule(
      reactContext = TestReactApplicationContext(targetContext),
      writableMapFactory = { JavaOnlyMap() },
      writableArrayFactory = { JavaOnlyArray() }
    )
    val sources = listOf(
      "heic-heif/sample.heic",
      "heic-heif/sample.heif",
      "avif/sample.avif"
    )
    val outputs = listOf(
      OutputCase("jpeg", ::assertJpegSignature),
      OutputCase("png", ::assertPngSignature),
      OutputCase("webp", ::assertWebpSignature)
    )

    sources.forEach { assetPath ->
      val sourceFile = copyAssetToCache(testContext, targetContext, assetPath)

      outputs.forEach { outputCase ->
        val promise = RecordingPromise()

        module.compressImage(
          compressionOptions(
            sourceFile = sourceFile,
            output = JavaOnlyMap.of(
              "format",
              outputCase.format,
              "quality",
              82
            )
          ),
          promise
        )

        val result = promise.resolvedMap()
        val outputFile = result.outputFile()

        outputCase.assertSignature(outputFile.readBytes())
        assertBitmapDimensions(outputFile, width = 16, height = 12)
        assertEquals(outputCase.format, result.getString("format"))
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
  }

  @Test
  fun probesAndroidAvifOutputEncoderPrototypeRoute() {
    assertTrue(
      "AVIF output prototype route probe must run on API 34+.",
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
    )

    val report = AndroidAvifOutputPrototype.inspectRoute(width = 16, height = 12)

    assertTrue(report.sdkEligible)
    assertEquals(AndroidAvifOutputPrototype.AVIF_MIME_TYPE, report.imageAvifMimeType)
    assertEquals(AndroidAvifOutputPrototype.CANDIDATE_ROUTE, report.candidateRoute)
    assertTrue(report.validationPlan.any { it.contains("ImageDecoder") })
    assertTrue(
      report.blockers.any {
        it == AndroidAvifOutputPrototype.PRODUCTION_GATE_MESSAGE
      }
    )

    if (report.hasImageAvifEncoder) {
      assertTrue(report.hasCandidateRoute)
    } else {
      assertTrue(
        report.blockers.any {
          it.contains("No image/avif encoder was discovered")
        }
      )
    }

    assertFalse(report.productionReady)
  }

  @Test
  fun attemptsAndroidAvifOutputEncodeDecodeBackSmoke() {
    assertTrue(
      "AVIF output encode/decode-back smoke must run on API 34+.",
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
    )

    val targetContext = InstrumentationRegistry
      .getInstrumentation()
      .targetContext
      .applicationContext
    val result = AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke(targetContext.cacheDir)

    Log.i(logTag, result.toString())
    assertTrue(result.route.contains(AndroidAvifOutputPrototype.SMOKE_ROUTE))
    assertFalse(result.outputCanBeEnabled)
    assertTrue(result.productionDecision.contains("Keep Android AVIF output disabled"))
    assertAvifOutputCapabilityRemainsFalse(targetContext)

    if (result.success) {
      assertTrue(result.attempted)
      assertTrue(result.signatureValid)
      assertTrue(result.decodeBackValid)
      assertNull(result.blockerCode)
      assertNull(result.blocker)
      assertEquals(16, result.decodedWidth)
      assertEquals(12, result.decodedHeight)
      assertNotNull(result.outputFilePath)
      val outputFile = File(result.outputFilePath ?: error("Smoke output path is required."))
      assertTrue(outputFile.exists())
      assertTrue(outputFile.length() > 0)
      assertTrue(AndroidAvifOutputPrototype.looksLikeAvifFile(outputFile.readBytes()))
    } else {
      assertNotNull(result.blockerCode)
      assertNotNull(result.blocker)
      assertTrue(
        result.blockerCode == AndroidAvifOutputPrototype.BLOCKER_CODE_NO_IMAGE_AVIF_ENCODER ||
          result.blockerCode == AndroidAvifOutputPrototype.BLOCKER_CODE_CODEC_FAILURE ||
          result.blockerCode == AndroidAvifOutputPrototype.BLOCKER_CODE_INVALID_SIGNATURE ||
          result.blockerCode == AndroidAvifOutputPrototype.BLOCKER_CODE_DECODE_BACK_FAILURE
      )
    }
  }

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

  private fun copyAssetToCache(
    testContext: Context,
    targetContext: Context,
    assetPath: String
  ): File {
    val outputFile = File(
      targetContext.cacheDir,
      "rnick-heic-heif-${System.nanoTime()}-${assetPath.substringAfterLast('/')}"
    )

    testContext.assets.open(assetPath).use { inputStream ->
      outputFile.outputStream().use { outputStream ->
        inputStream.copyTo(outputStream)
      }
    }

    assertTrue(outputFile.exists())
    assertTrue(outputFile.length() > 0)

    return outputFile
  }

  private fun RecordingPromise.resolvedMap(): ReadableMap {
    assertTrue(completion.await(30, TimeUnit.SECONDS))
    assertNull(rejectionMessage, rejectionCode)
    assertNull(rejectionMessage)
    assertNull(rejectionThrowable)
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

  private fun assertBitmapDimensions(
    outputFile: File,
    width: Int,
    height: Int
  ) {
    val bitmap = BitmapFactory.decodeFile(outputFile.absolutePath)

    assertNotNull(bitmap)

    try {
      assertEquals(width, bitmap.width)
      assertEquals(height, bitmap.height)
    } finally {
      bitmap.recycle()
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

  private fun assertAvifOutputCapabilityRemainsFalse(targetContext: Context) {
    val module = ImageCompressionKitModule(
      reactContext = TestReactApplicationContext(targetContext),
      writableMapFactory = { JavaOnlyMap() },
      writableArrayFactory = { JavaOnlyArray() }
    )
    val promise = RecordingPromise()

    module.getImageCompressionCapabilities(promise)

    val capabilities = promise.resolvedMap()
    val avifCapability = findFormatCapability(
      capabilities.getArray("formats") ?: error("Capabilities must include formats."),
      "avif"
    )

    assertTrue(avifCapability.getBoolean("input"))
    assertFalse(avifCapability.getBoolean("output"))
  }

  private fun findFormatCapability(
    formats: ReadableArray,
    format: String
  ): ReadableMap {
    for (index in 0 until formats.size()) {
      val capability = formats.getMap(index)
      if (capability?.getString("format") == format) {
        return capability
      }
    }

    error("Missing $format format capability.")
  }

  private data class OutputCase(
    val format: String,
    val assertSignature: (ByteArray) -> Unit
  )

  private class TestReactApplicationContext(context: Context) : ReactApplicationContext(context) {
    override fun <T : JavaScriptModule> getJSModule(jsInterface: Class<T>): T =
      throw UnsupportedOperationException("JS modules are not needed in instrumentation tests.")

    override fun <T : NativeModule> hasNativeModule(nativeModuleInterface: Class<T>): Boolean =
      false

    override fun getNativeModules(): Collection<NativeModule> =
      emptyList()

    override fun <T : NativeModule> getNativeModule(nativeModuleInterface: Class<T>): T? =
      null

    override fun getNativeModule(moduleName: String): NativeModule? =
      null

    override fun getCatalystInstance(): CatalystInstance =
      throw UnsupportedOperationException("CatalystInstance is not needed in instrumentation tests.")

    override fun destroy() = Unit

    override fun handleException(e: Exception) {
      throw RuntimeException(e)
    }

    override fun hasActiveCatalystInstance(): Boolean =
      false

    override fun hasActiveReactInstance(): Boolean =
      false

    override fun hasCatalystInstance(): Boolean =
      false

    override fun hasReactInstance(): Boolean =
      false

    @Suppress("DEPRECATION")
    override fun isBridgeless(): Boolean =
      false

    override fun getJavaScriptContextHolder(): JavaScriptContextHolder? =
      null

    override fun getJSCallInvokerHolder(): CallInvokerHolder? =
      null

    @Suppress("DEPRECATION")
    override fun getFabricUIManager(): UIManager? =
      null

    override fun getSourceURL(): String? =
      null

    override fun registerSegment(segmentId: Int, path: String, callback: Callback) = Unit
  }

  private class RecordingPromise : Promise {
    val completion = CountDownLatch(1)
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
      completion.countDown()
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
      completion.countDown()
    }
  }
}
