package com.imagecompressionkit

import android.content.Context
import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.CatalystInstance
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.JavaScriptContextHolder
import com.facebook.react.bridge.JavaScriptModule
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UIManager
import com.facebook.react.bridge.WritableMap
import com.facebook.react.turbomodule.core.interfaces.CallInvokerHolder
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
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowContentResolver
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.charset.StandardCharsets
import java.util.Base64
import java.util.function.Supplier
import kotlin.math.abs

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

  @Test
  fun compressImageAppliesExifOrientationBeforeResizeModesAndNormalizesOutputExif() {
    val module = createModule()
    val sourceFile = createOrientedJpegFile(
      width = 40,
      height = 20,
      orientation = ExifInterface.ORIENTATION_ROTATE_90
    )
    val cases = listOf(
      ResizeCase(
        resize = resizeOptions(
          mode = "contain",
          maxWidth = 16,
          maxHeight = 10
        ),
        expectedWidth = 5,
        expectedHeight = 10
      ),
      ResizeCase(
        resize = resizeOptions(
          mode = "cover",
          maxWidth = 16,
          maxHeight = 10
        ),
        expectedWidth = 16,
        expectedHeight = 10
      ),
      ResizeCase(
        resize = resizeOptions(
          mode = "stretch",
          maxWidth = 16
        ),
        expectedWidth = 16,
        expectedHeight = 40
      )
    )

    cases.forEach { case ->
      val promise = RecordingPromise()

      module.compressImage(
        compressionOptions(
          sourceFile = sourceFile,
          output = JavaOnlyMap.of(
            "format",
            "jpeg",
            "quality",
            82
          ),
          resize = case.resize,
          metadata = "safe"
        ),
        promise
      )

      val result = promise.resolvedMap()
      val outputFile = result.outputFile()

      assertJpegSignature(outputFile.readBytes())
      assertEquals("jpeg", result.getString("format"))
      assertEquals(case.expectedWidth, result.getInt("width"))
      assertEquals(case.expectedHeight, result.getInt("height"))
      assertNormalizedOutputExif(outputFile, case.expectedWidth, case.expectedHeight)
    }
  }

  @Test
  fun compressImageReadsContentUriJpegLikeFileUriAndReportsMetadata() {
    val reactContext = createReactContext()
    val module = createModule(reactContext)
    val sourceFile = createOrientedJpegFile(
      width = 32,
      height = 20,
      orientation = ExifInterface.ORIENTATION_ROTATE_90
    )
    val sourceBytes = sourceFile.readBytes()
    val contentUri = Uri.parse("content://image-compression-kit/source-${System.nanoTime()}.jpg")
    val filePromise = RecordingPromise()
    val contentPromise = RecordingPromise()

    registerContentInputStream(reactContext, contentUri, sourceBytes)

    module.compressImage(
      compressionOptions(
        sourceFile = sourceFile,
        output = JavaOnlyMap.of(
          "format",
          "jpeg",
          "quality",
          82
        ),
        metadata = "safe"
      ),
      filePromise
    )
    module.compressImage(
      compressionOptions(
        sourceUri = contentUri.toString(),
        output = JavaOnlyMap.of(
          "format",
          "jpeg",
          "quality",
          82
        ),
        metadata = "safe"
      ),
      contentPromise
    )

    val fileResult = filePromise.resolvedMap()
    val fileOutput = fileResult.outputFile()
    val contentResult = contentPromise.resolvedMap()
    val contentOutput = contentResult.outputFile()

    assertJpegSignature(contentOutput.readBytes())
    assertEquals("jpeg", contentResult.getString("format"))
    assertEquals(20, contentResult.getInt("width"))
    assertEquals(32, contentResult.getInt("height"))
    assertResultMetadataMatchesFile(fileResult, fileOutput, sourceFile)
    assertResultMetadataMatchesBytes(contentResult, contentOutput, sourceBytes.size.toLong())
    assertEquals(fileResult.getString("format"), contentResult.getString("format"))
    assertEquals(fileResult.getInt("width"), contentResult.getInt("width"))
    assertEquals(fileResult.getInt("height"), contentResult.getInt("height"))
    assertEquals(fileResult.getDouble("byteSize"), contentResult.getDouble("byteSize"), 0.0001)
    assertEquals(
      fileResult.getDouble("originalByteSize"),
      contentResult.getDouble("originalByteSize"),
      0.0001
    )
    assertEquals(
      fileResult.getDouble("compressionRatio"),
      contentResult.getDouble("compressionRatio"),
      0.0001
    )
    assertNormalizedOutputExif(contentOutput, 20, 32)
  }

  @Test
  fun compressImageRejectsUnreadableContentUriAtModuleBoundary() {
    val reactContext = createReactContext()
    val module = createModule(reactContext)
    val contentUri = Uri.parse("content://image-compression-kit/missing-${System.nanoTime()}.jpg")
    val promise = RecordingPromise()

    shadowOf(reactContext.contentResolver).registerInputStreamSupplier(
      contentUri,
      Supplier {
        throw IllegalStateException("Missing test content URI stream.")
      }
    )

    module.compressImage(
      compressionOptions(
        sourceUri = contentUri.toString(),
        output = JavaOnlyMap.of(
          "format",
          "jpeg",
          "quality",
          72
        )
      ),
      promise
    )

    assertNull(promise.resolvedValue)
    assertEquals(ImageCompressionKitModule.ERR_FILE_ACCESS, promise.rejectionCode)
    assertEquals("Android MVP could not read the source image URI.", promise.rejectionMessage)
  }

  @Test
  fun compressImageRejectsUnsupportedImageFileExtensionsAtModuleBoundary() {
    val module = createModule()
    val unsupportedCases = listOf(
      UnsupportedSourceCase(fileExtension = "avif", mimeType = "image/avif")
    )

    unsupportedCases.forEach { unsupportedCase ->
      val promise = RecordingPromise()
      val sourceFile = createInvalidImageFile(unsupportedCase.fileExtension)

      module.compressImage(
        compressionOptions(
          sourceFile = sourceFile,
          output = JavaOnlyMap.of(
            "format",
            "jpeg",
            "quality",
            72
          )
        ),
        promise
      )

      assertUnsupportedFormatRejected(promise)
    }
  }

  @Test
  fun compressImageRejectsUnsupportedContentMimeTypesAtModuleBoundary() {
    val reactContext = createReactContext()
    val module = createModule(reactContext)
    val unsupportedCases = listOf(
      UnsupportedSourceCase(fileExtension = "bin", mimeType = "image/avif")
    )

    unsupportedCases.forEach { unsupportedCase ->
      val authority = "image-compression-kit-mime-${System.nanoTime()}"
      val contentUri = Uri.parse(
        "content://$authority/source-${System.nanoTime()}.${unsupportedCase.fileExtension}"
      )
      val promise = RecordingPromise()

      registerContentInputStream(reactContext, contentUri, invalidImageBytes())
      registerContentMimeType(contentUri, unsupportedCase.mimeType)

      module.compressImage(
        compressionOptions(
          sourceUri = contentUri.toString(),
          output = JavaOnlyMap.of(
            "format",
            "jpeg",
            "quality",
            72
          )
        ),
        promise
      )

      assertUnsupportedFormatRejected(promise)
    }
  }

  @Test
  fun compressImageTreatsHeicAndHeifSourcesAsDecodeCandidatesOnSupportedSdk() {
    val reactContext = createReactContext()
    val module = createModule(reactContext)
    val cases = listOf(
      UnsupportedSourceCase(fileExtension = "heic", mimeType = "image/heic"),
      UnsupportedSourceCase(fileExtension = "heif", mimeType = "image/heif")
    )

    cases.forEach { sourceCase ->
      val filePromise = RecordingPromise()
      val contentPromise = RecordingPromise()
      val contentUri = Uri.parse(
        "content://image-compression-kit-heif-${System.nanoTime()}/source.${sourceCase.fileExtension}"
      )

      module.compressImage(
        compressionOptions(
          sourceFile = createInvalidImageFile(sourceCase.fileExtension),
          output = JavaOnlyMap.of(
            "format",
            "jpeg",
            "quality",
            72
          )
        ),
        filePromise
      )
      registerContentInputStream(reactContext, contentUri, invalidImageBytes())
      registerContentMimeType(contentUri, sourceCase.mimeType)
      module.compressImage(
        compressionOptions(
          sourceUri = contentUri.toString(),
          output = JavaOnlyMap.of(
            "format",
            "jpeg",
            "quality",
            72
          )
        ),
        contentPromise
      )

      assertDecodeFailedRejected(filePromise)
      assertDecodeFailedRejected(contentPromise)
    }
  }

  @Test
  @Config(sdk = [25])
  fun compressImageRejectsHeicAndHeifBeforeAndroidO() {
    val module = createModule()
    val cases = listOf("heic", "heif")

    cases.forEach { fileExtension ->
      val promise = RecordingPromise()

      module.compressImage(
        compressionOptions(
          sourceFile = createInvalidImageFile(fileExtension),
          output = JavaOnlyMap.of(
            "format",
            "jpeg",
            "quality",
            72
          )
        ),
        promise
      )

      assertHeicHeifSdkUnsupportedRejected(promise)
    }
  }

  @Test
  fun compressImageSeparatesUnsupportedFormatFromDecodeFailure() {
    val module = createModule()
    val unsupportedPromise = RecordingPromise()
    val decodeFailurePromise = RecordingPromise()
    val gifDecodeFailurePromise = RecordingPromise()
    val heicDecodeFailurePromise = RecordingPromise()

    module.compressImage(
      compressionOptions(
        sourceFile = createInvalidImageFile("avif"),
        output = JavaOnlyMap.of(
          "format",
          "jpeg",
          "quality",
          72
        )
      ),
      unsupportedPromise
    )
    module.compressImage(
      compressionOptions(
        sourceFile = createInvalidImageFile("jpg"),
        output = JavaOnlyMap.of(
          "format",
          "jpeg",
          "quality",
          72
        )
      ),
      decodeFailurePromise
    )
    module.compressImage(
      compressionOptions(
        sourceFile = createInvalidImageFile("gif"),
        output = JavaOnlyMap.of(
          "format",
          "jpeg",
          "quality",
          72
        )
      ),
      gifDecodeFailurePromise
    )
    module.compressImage(
      compressionOptions(
        sourceFile = createInvalidImageFile("heic"),
        output = JavaOnlyMap.of(
          "format",
          "jpeg",
          "quality",
          72
        )
      ),
      heicDecodeFailurePromise
    )

    assertUnsupportedFormatRejected(unsupportedPromise)
    assertDecodeFailedRejected(decodeFailurePromise)
    assertDecodeFailedRejected(gifDecodeFailurePromise)
    assertDecodeFailedRejected(heicDecodeFailurePromise)
  }

  @Test
  fun compressImageAcceptsGifFileAndContentSourcesAsStaticFrameWithAllImplementedOutputs() {
    val reactContext = createReactContext()
    val module = createModule(reactContext)
    val sourceFile = createSampleGifFile()
    val sourceBytes = sourceFile.readBytes()
    val contentUri = Uri.parse("content://image-compression-kit/gif-${System.nanoTime()}.gif")
    val outputCases = listOf(
      "jpeg" to ::assertJpegSignature,
      "png" to ::assertPngSignature,
      "webp" to ::assertWebpSignature
    )

    registerContentInputStream(reactContext, contentUri, sourceBytes)
    registerContentMimeType(contentUri, "image/gif")

    outputCases.forEach { (outputFormat, assertSignature) ->
      val filePromise = RecordingPromise()
      val contentPromise = RecordingPromise()

      module.compressImage(
        compressionOptions(
          sourceFile = sourceFile,
          output = JavaOnlyMap.of(
            "format",
            outputFormat,
            "quality",
            74
          ),
          metadata = "preserve"
        ),
        filePromise
      )
      module.compressImage(
        compressionOptions(
          sourceUri = contentUri.toString(),
          output = JavaOnlyMap.of(
            "format",
            outputFormat,
            "quality",
            74
          ),
          metadata = "preserve"
        ),
        contentPromise
      )

      val fileResult = filePromise.resolvedMap()
      val fileOutput = fileResult.outputFile()
      val contentResult = contentPromise.resolvedMap()
      val contentOutput = contentResult.outputFile()

      assertSignature(fileOutput.readBytes())
      assertSignature(contentOutput.readBytes())
      assertEquals(outputFormat, fileResult.getString("format"))
      assertEquals(outputFormat, contentResult.getString("format"))
      assertEquals(40, fileResult.getInt("width"))
      assertEquals(20, fileResult.getInt("height"))
      assertEquals(fileResult.getInt("width"), contentResult.getInt("width"))
      assertEquals(fileResult.getInt("height"), contentResult.getInt("height"))
      assertResultMetadataMatchesFile(fileResult, fileOutput, sourceFile)
      assertResultMetadataMatchesBytes(contentResult, contentOutput, sourceBytes.size.toLong())

      if (outputFormat == "png") {
        assertTopLeftPixelNear(fileOutput, expectedColor = 0xff336699.toInt())
        assertTopLeftPixelNear(contentOutput, expectedColor = 0xff336699.toInt())
      }
      if (outputFormat == "jpeg") {
        assertNoCopiedExifMetadata(fileOutput)
        assertNoCopiedExifMetadata(contentOutput)
      }
    }
  }

  @Test
  fun compressImageResizesGifSourceAcrossModes() {
    val module = createModule()
    val sourceFile = createSampleGifFile()
    val resizeCases = listOf(
      ResizeCase(
        resize = resizeOptions(
          mode = "contain",
          maxWidth = 16,
          maxHeight = 10
        ),
        expectedWidth = 16,
        expectedHeight = 8
      ),
      ResizeCase(
        resize = resizeOptions(
          mode = "cover",
          maxWidth = 16,
          maxHeight = 10
        ),
        expectedWidth = 16,
        expectedHeight = 10
      ),
      ResizeCase(
        resize = resizeOptions(
          mode = "stretch",
          maxWidth = 16
        ),
        expectedWidth = 16,
        expectedHeight = 20
      )
    )

    resizeCases.forEach { resizeCase ->
      val promise = RecordingPromise()

      module.compressImage(
        compressionOptions(
          sourceFile = sourceFile,
          output = JavaOnlyMap.of(
            "format",
            "png",
            "quality",
            82
          ),
          resize = resizeCase.resize
        ),
        promise
      )

      val result = promise.resolvedMap()
      val outputFile = result.outputFile()

      assertPngSignature(outputFile.readBytes())
      assertEquals("png", result.getString("format"))
      assertEquals(resizeCase.expectedWidth, result.getInt("width"))
      assertEquals(resizeCase.expectedHeight, result.getInt("height"))
      assertResultMetadataMatchesFile(result, outputFile, sourceFile)
    }
  }

  @Test
  fun compressImageHonorsJpegAndWebpMaxBytesForGifSource() {
    val module = createModule()
    val sourceFile = createSampleGifFile()
    val outputCases = listOf(
      TargetSizeCase(
        format = "jpeg",
        outputFormat = OutputFormat.JPEG,
        assertSignature = ::assertJpegSignature
      ),
      TargetSizeCase(
        format = "webp",
        outputFormat = OutputFormat.WEBP,
        assertSignature = ::assertWebpSignature
      )
    )

    outputCases.forEach { outputCase ->
      val maxBytes = calculateAchievableTargetBytes(sourceFile, outputCase.outputFormat)
      val promise = RecordingPromise()

      module.compressImage(
        compressionOptions(
          sourceFile = sourceFile,
          output = JavaOnlyMap.of(
            "format",
            outputCase.format,
            "quality",
            90,
            "maxBytes",
            maxBytes
          ),
          metadata = "preserve"
        ),
        promise
      )

      val result = promise.resolvedMap()
      val outputFile = result.outputFile()

      outputCase.assertSignature(outputFile.readBytes())
      assertTrue(outputFile.length() <= maxBytes)
      assertEquals(outputCase.format, result.getString("format"))
      assertEquals(40, result.getInt("width"))
      assertEquals(20, result.getInt("height"))
      assertResultMetadataMatchesFile(result, outputFile, sourceFile)
      if (outputCase.outputFormat == OutputFormat.JPEG) {
        assertNoCopiedExifMetadata(outputFile)
      }
    }
  }

  @Test
  fun compressImageIgnoresMetadataPoliciesForGifSource() {
    val module = createModule()
    val sourceFile = createSampleGifFile()
    val metadataPolicies = listOf("preserve", "safe", "strip")

    metadataPolicies.forEach { metadataPolicy ->
      val promise = RecordingPromise()

      module.compressImage(
        compressionOptions(
          sourceFile = sourceFile,
          output = JavaOnlyMap.of(
            "format",
            "jpeg",
            "quality",
            80
          ),
          metadata = metadataPolicy
        ),
        promise
      )

      val result = promise.resolvedMap()
      val outputFile = result.outputFile()

      assertJpegSignature(outputFile.readBytes())
      assertEquals("jpeg", result.getString("format"))
      assertEquals(40, result.getInt("width"))
      assertEquals(20, result.getInt("height"))
      assertResultMetadataMatchesFile(result, outputFile, sourceFile)
      assertNoCopiedExifMetadata(outputFile)
    }
  }

  @Test
  fun compressImageAcceptsPngAndWebpFileAndContentSourcesWithAllImplementedOutputs() {
    val reactContext = createReactContext()
    val module = createModule(reactContext)
    val sourceCases = listOf(
      SourceFormatCase(
        format = OutputFormat.PNG,
        sourceFile = createEncodedImageFile(OutputFormat.PNG, width = 22, height = 14)
      ),
      SourceFormatCase(
        format = OutputFormat.WEBP,
        sourceFile = createEncodedImageFile(OutputFormat.WEBP, width = 22, height = 14)
      )
    )
    val outputCases = listOf(
      "jpeg" to ::assertJpegSignature,
      "png" to ::assertPngSignature,
      "webp" to ::assertWebpSignature
    )

    sourceCases.forEach { sourceCase ->
      val sourceBytes = sourceCase.sourceFile.readBytes()
      val contentUri = Uri.parse(
        "content://image-compression-kit/${sourceCase.format.value}-${System.nanoTime()}"
      )

      registerContentInputStream(reactContext, contentUri, sourceBytes)

      outputCases.forEach { (outputFormat, assertSignature) ->
        val filePromise = RecordingPromise()
        val contentPromise = RecordingPromise()

        module.compressImage(
          compressionOptions(
            sourceFile = sourceCase.sourceFile,
            output = JavaOnlyMap.of(
              "format",
              outputFormat,
              "quality",
              74
            ),
            metadata = "preserve"
          ),
          filePromise
        )
        module.compressImage(
          compressionOptions(
            sourceUri = contentUri.toString(),
            output = JavaOnlyMap.of(
              "format",
              outputFormat,
              "quality",
              74
            ),
            metadata = "preserve"
          ),
          contentPromise
        )

        val fileResult = filePromise.resolvedMap()
        val fileOutput = fileResult.outputFile()
        val contentResult = contentPromise.resolvedMap()
        val contentOutput = contentResult.outputFile()

        assertSignature(fileOutput.readBytes())
        assertSignature(contentOutput.readBytes())
        assertEquals(outputFormat, fileResult.getString("format"))
        assertEquals(outputFormat, contentResult.getString("format"))
        assertEquals(22, fileResult.getInt("width"))
        assertEquals(14, fileResult.getInt("height"))
        assertEquals(fileResult.getInt("width"), contentResult.getInt("width"))
        assertEquals(fileResult.getInt("height"), contentResult.getInt("height"))
        assertResultMetadataMatchesFile(fileResult, fileOutput, sourceCase.sourceFile)
        assertResultMetadataMatchesBytes(contentResult, contentOutput, sourceBytes.size.toLong())
        assertEquals(fileResult.getDouble("byteSize"), contentResult.getDouble("byteSize"), 0.0001)
        assertEquals(
          fileResult.getDouble("compressionRatio"),
          contentResult.getDouble("compressionRatio"),
          0.0001
        )

        if (outputFormat == "jpeg") {
          assertNoCopiedExifMetadata(fileOutput)
          assertNoCopiedExifMetadata(contentOutput)
        }
      }
    }
  }

  @Test
  fun compressImageResizesPngAndWebpSourcesAcrossModes() {
    val module = createModule()
    val sourceCases = listOf(
      SourceFormatCase(
        format = OutputFormat.PNG,
        sourceFile = createEncodedImageFile(OutputFormat.PNG, width = 40, height = 20)
      ),
      SourceFormatCase(
        format = OutputFormat.WEBP,
        sourceFile = createEncodedImageFile(OutputFormat.WEBP, width = 40, height = 20)
      )
    )
    val resizeCases = listOf(
      ResizeCase(
        resize = resizeOptions(
          mode = "contain",
          maxWidth = 16,
          maxHeight = 10
        ),
        expectedWidth = 16,
        expectedHeight = 8
      ),
      ResizeCase(
        resize = resizeOptions(
          mode = "cover",
          maxWidth = 16,
          maxHeight = 10
        ),
        expectedWidth = 16,
        expectedHeight = 10
      ),
      ResizeCase(
        resize = resizeOptions(
          mode = "stretch",
          maxWidth = 16
        ),
        expectedWidth = 16,
        expectedHeight = 20
      )
    )

    sourceCases.forEach { sourceCase ->
      resizeCases.forEach { resizeCase ->
        val promise = RecordingPromise()

        module.compressImage(
          compressionOptions(
            sourceFile = sourceCase.sourceFile,
            output = JavaOnlyMap.of(
              "format",
              "jpeg",
              "quality",
              82
            ),
            resize = resizeCase.resize
          ),
          promise
        )

        val result = promise.resolvedMap()
        val outputFile = result.outputFile()

        assertJpegSignature(outputFile.readBytes())
        assertEquals("jpeg", result.getString("format"))
        assertEquals(resizeCase.expectedWidth, result.getInt("width"))
        assertEquals(resizeCase.expectedHeight, result.getInt("height"))
        assertResultMetadataMatchesFile(result, outputFile, sourceCase.sourceFile)
        assertNoCopiedExifMetadata(outputFile)
      }
    }
  }

  @Test
  fun compressImageHonorsJpegAndWebpMaxBytesForPngAndWebpSources() {
    val module = createModule()
    val sourceCases = listOf(
      SourceFormatCase(
        format = OutputFormat.PNG,
        sourceFile = createEncodedImageFile(OutputFormat.PNG, width = 96, height = 64)
      ),
      SourceFormatCase(
        format = OutputFormat.WEBP,
        sourceFile = createEncodedImageFile(OutputFormat.WEBP, width = 96, height = 64)
      )
    )
    val outputCases = listOf(
      TargetSizeCase(
        format = "jpeg",
        outputFormat = OutputFormat.JPEG,
        assertSignature = ::assertJpegSignature
      ),
      TargetSizeCase(
        format = "webp",
        outputFormat = OutputFormat.WEBP,
        assertSignature = ::assertWebpSignature
      )
    )

    sourceCases.forEach { sourceCase ->
      outputCases.forEach { outputCase ->
        val maxBytes = calculateAchievableTargetBytes(sourceCase.sourceFile, outputCase.outputFormat)
        val promise = RecordingPromise()

        module.compressImage(
          compressionOptions(
            sourceFile = sourceCase.sourceFile,
            output = JavaOnlyMap.of(
              "format",
              outputCase.format,
              "quality",
              90,
              "maxBytes",
              maxBytes
            ),
            metadata = "preserve"
          ),
          promise
        )

        val result = promise.resolvedMap()
        val outputFile = result.outputFile()

        outputCase.assertSignature(outputFile.readBytes())
        assertTrue(outputFile.length() <= maxBytes)
        assertEquals(outputCase.format, result.getString("format"))
        assertEquals(96, result.getInt("width"))
        assertEquals(64, result.getInt("height"))
        assertResultMetadataMatchesFile(result, outputFile, sourceCase.sourceFile)
        if (outputCase.outputFormat == OutputFormat.JPEG) {
          assertNoCopiedExifMetadata(outputFile)
        }
      }
    }
  }

  @Test
  fun compressImageIgnoresMetadataPoliciesForPngAndWebpSources() {
    val module = createModule()
    val sourceCases = listOf(
      SourceFormatCase(
        format = OutputFormat.PNG,
        sourceFile = createEncodedImageFile(OutputFormat.PNG, width = 24, height = 16)
      ),
      SourceFormatCase(
        format = OutputFormat.WEBP,
        sourceFile = createEncodedImageFile(OutputFormat.WEBP, width = 24, height = 16)
      )
    )
    val metadataPolicies = listOf("preserve", "safe", "strip")

    sourceCases.forEach { sourceCase ->
      metadataPolicies.forEach { metadataPolicy ->
        val promise = RecordingPromise()

        module.compressImage(
          compressionOptions(
            sourceFile = sourceCase.sourceFile,
            output = JavaOnlyMap.of(
              "format",
              "jpeg",
              "quality",
              80
            ),
            metadata = metadataPolicy
          ),
          promise
        )

        val result = promise.resolvedMap()
        val outputFile = result.outputFile()

        assertJpegSignature(outputFile.readBytes())
        assertEquals("jpeg", result.getString("format"))
        assertEquals(24, result.getInt("width"))
        assertEquals(16, result.getInt("height"))
        assertResultMetadataMatchesFile(result, outputFile, sourceCase.sourceFile)
        assertNoCopiedExifMetadata(outputFile)
      }
    }
  }

  @Test
  fun compressImageHonorsJpegAndWebpMaxBytesAndReportsFileMetadata() {
    val module = createModule()
    val sourceFile = createPatternJpegFile(width = 96, height = 64)
    val cases = listOf(
      TargetSizeCase(
        format = "jpeg",
        outputFormat = OutputFormat.JPEG,
        assertSignature = ::assertJpegSignature
      ),
      TargetSizeCase(
        format = "webp",
        outputFormat = OutputFormat.WEBP,
        assertSignature = ::assertWebpSignature
      )
    )

    cases.forEach { case ->
      val maxBytes = calculateAchievableTargetBytes(sourceFile, case.outputFormat)
      val promise = RecordingPromise()

      module.compressImage(
        compressionOptions(
          sourceFile = sourceFile,
          output = JavaOnlyMap.of(
            "format",
            case.format,
            "quality",
            90,
            "maxBytes",
            maxBytes
          )
        ),
        promise
      )

      val result = promise.resolvedMap()
      val outputFile = result.outputFile()

      case.assertSignature(outputFile.readBytes())
      assertTrue(outputFile.length() <= maxBytes)
      assertEquals(case.format, result.getString("format"))
      assertEquals(96, result.getInt("width"))
      assertEquals(64, result.getInt("height"))
      assertResultMetadataMatchesFile(result, outputFile, sourceFile)
    }
  }

  @Test
  fun compressImageFallsBackWhenMaxBytesIsTooSmallAndReportsConsistentMetadata() {
    val module = createModule()
    val sourceFile = createPatternJpegFile(width = 96, height = 64)
    val cases = listOf(
      TargetSizeCase(
        format = "jpeg",
        outputFormat = OutputFormat.JPEG,
        assertSignature = ::assertJpegSignature
      ),
      TargetSizeCase(
        format = "webp",
        outputFormat = OutputFormat.WEBP,
        assertSignature = ::assertWebpSignature
      )
    )

    cases.forEach { case ->
      val promise = RecordingPromise()

      module.compressImage(
        compressionOptions(
          sourceFile = sourceFile,
          output = JavaOnlyMap.of(
            "format",
            case.format,
            "quality",
            80,
            "maxBytes",
            1
          )
        ),
        promise
      )

      val result = promise.resolvedMap()
      val outputFile = result.outputFile()

      case.assertSignature(outputFile.readBytes())
      assertTrue(outputFile.length() > 1)
      assertEquals(case.format, result.getString("format"))
      assertEquals(96, result.getInt("width"))
      assertEquals(64, result.getInt("height"))
      assertResultMetadataMatchesFile(result, outputFile, sourceFile)
    }
  }

  private fun createReactContext(): TestReactApplicationContext =
    TestReactApplicationContext(RuntimeEnvironment.getApplication())

  private fun createModule(
    reactContext: ReactApplicationContext = createReactContext()
  ): ImageCompressionKitModule =
    ImageCompressionKitModule(
      reactContext = reactContext,
      writableMapFactory = { JavaOnlyMap() },
      writableArrayFactory = { JavaOnlyArray() }
    )

  private fun compressionOptions(
    sourceFile: File,
    output: JavaOnlyMap,
    resize: JavaOnlyMap? = null,
    metadata: String = "strip"
  ): JavaOnlyMap {
    return compressionOptions(
      sourceUri = Uri.fromFile(sourceFile).toString(),
      output = output,
      resize = resize,
      metadata = metadata
    )
  }

  private fun compressionOptions(
    sourceUri: String,
    output: JavaOnlyMap,
    resize: JavaOnlyMap? = null,
    metadata: String = "strip"
  ): JavaOnlyMap {
    val options = JavaOnlyMap.of(
      "source",
      JavaOnlyMap.of("uri", sourceUri),
      "output",
      output,
      "metadata",
      metadata
    )

    if (resize != null) {
      options.putMap("resize", resize)
    }

    return options
  }

  private fun registerContentInputStream(
    reactContext: ReactApplicationContext,
    contentUri: Uri,
    bytes: ByteArray
  ) {
    shadowOf(reactContext.contentResolver).registerInputStreamSupplier(
      contentUri,
      Supplier { ByteArrayInputStream(bytes) }
    )
  }

  private fun registerContentMimeType(
    contentUri: Uri,
    mimeType: String
  ) {
    TestMimeTypeContentProvider.register(contentUri, mimeType)
    ShadowContentResolver.registerProviderInternal(
      contentUri.authority ?: error("Content URI authority is required."),
      TestMimeTypeContentProvider()
    )
  }

  private fun resizeOptions(
    mode: String,
    maxWidth: Int? = null,
    maxHeight: Int? = null
  ): JavaOnlyMap {
    val resize = JavaOnlyMap.of("mode", mode)

    if (maxWidth != null) {
      resize.putInt("maxWidth", maxWidth)
    }
    if (maxHeight != null) {
      resize.putInt("maxHeight", maxHeight)
    }

    return resize
  }

  private fun createSampleJpegFile(
    width: Int = 16,
    height: Int = 12
  ): File {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
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

  private fun createOrientedJpegFile(
    width: Int,
    height: Int,
    orientation: Int
  ): File {
    val file = createSampleJpegFile(width = width, height = height)
    val exif = ExifInterface(file.absolutePath)

    exif.setAttribute(ExifInterface.TAG_ORIENTATION, orientation.toString())
    exif.saveAttributes()
    assertEquals(
      orientation,
      ExifInterface(file.absolutePath).getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_UNDEFINED
      )
    )

    return file
  }

  private fun createPatternJpegFile(width: Int, height: Int): File {
    val bitmap = createPatternBitmap(width, height)
    val outputStream = ByteArrayOutputStream()

    assertTrue(bitmap.compress(Bitmap.CompressFormat.JPEG, 95, outputStream))
    bitmap.recycle()

    val bytes = outputStream.toByteArray()

    assertJpegSignature(bytes)

    return temporaryFolder.newFile("pattern-${System.nanoTime()}.jpg").apply {
      writeBytes(bytes)
      assertTrue(length() > 0)
    }
  }

  private fun createInvalidImageFile(fileExtension: String): File =
    temporaryFolder.newFile("invalid-${System.nanoTime()}.$fileExtension").apply {
      writeBytes(invalidImageBytes())
      assertTrue(length() > 0)
    }

  private fun invalidImageBytes(): ByteArray =
    "not an image".toByteArray(StandardCharsets.US_ASCII)

  private fun createSampleGifFile(): File {
    val bytes = Base64.getMimeDecoder().decode(SAMPLE_GIF_BASE64)

    assertGifSignature(bytes)

    return temporaryFolder.newFile("animated-${System.nanoTime()}.gif").apply {
      writeBytes(bytes)
      assertTrue(length() > 0)
    }
  }

  private fun createEncodedImageFile(
    outputFormat: OutputFormat,
    width: Int,
    height: Int
  ): File {
    val bitmap = createPatternBitmap(width, height)
    val outputStream = ByteArrayOutputStream()

    assertTrue(
      bitmap.compress(
        outputFormat.compressFormat,
        outputFormat.compressionQuality(90),
        outputStream
      )
    )
    bitmap.recycle()

    val bytes = outputStream.toByteArray()

    when (outputFormat) {
      OutputFormat.JPEG -> assertJpegSignature(bytes)
      OutputFormat.PNG -> assertPngSignature(bytes)
      OutputFormat.WEBP -> assertWebpSignature(bytes)
    }

    return temporaryFolder.newFile(
      "${outputFormat.value}-${System.nanoTime()}.${outputFormat.fileExtension}"
    ).apply {
      writeBytes(bytes)
      assertTrue(length() > 0)
    }
  }

  private fun createPatternBitmap(width: Int, height: Int): Bitmap {
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)

    for (y in 0 until height) {
      for (x in 0 until width) {
        val red = (x * 37 + y * 17) and 0xff
        val green = (x * 11 + y * 53) and 0xff
        val blue = (x * 23 + y * 29 + (x * y)) and 0xff
        val color = 0xff000000.toInt() or (red shl 16) or (green shl 8) or blue

        bitmap.setPixel(x, y, color)
      }
    }

    return bitmap
  }

  private fun calculateAchievableTargetBytes(
    sourceFile: File,
    outputFormat: OutputFormat
  ): Long {
    val bitmap = BitmapFactory.decodeFile(sourceFile.absolutePath)

    assertNotNull(bitmap)

    try {
      val lowQualitySize = encodedSizeAtQuality(bitmap, outputFormat, quality = 35)
      val highQualitySize = encodedSizeAtQuality(bitmap, outputFormat, quality = 90)
      val targetBytes = lowQualitySize + ((highQualitySize - lowQualitySize) / 2)

      assertTrue(highQualitySize > targetBytes)
      assertTrue(targetBytes >= lowQualitySize)

      return targetBytes
    } finally {
      bitmap.recycle()
    }
  }

  private fun encodedSizeAtQuality(
    bitmap: Bitmap,
    outputFormat: OutputFormat,
    quality: Int
  ): Long {
    val outputFile = temporaryFolder.newFile(
      "target-${outputFormat.value}-$quality-${System.nanoTime()}.${outputFormat.fileExtension}"
    )

    assertTrue(
      ImageCompressionOutput.encodeBitmap(
        bitmap = bitmap,
        outputFile = outputFile,
        outputFormat = outputFormat,
        quality = quality,
        maxBytes = null
      )
    )

    return outputFile.length()
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

  private fun assertResultMetadataMatchesFile(
    result: ReadableMap,
    outputFile: File,
    sourceFile: File
  ) {
    assertResultMetadataMatchesBytes(result, outputFile, sourceFile.length())
  }

  private fun assertResultMetadataMatchesBytes(
    result: ReadableMap,
    outputFile: File,
    originalByteSize: Long
  ) {
    assertEquals(outputFile.length().toDouble(), result.getDouble("byteSize"), 0.0001)
    assertEquals(originalByteSize.toDouble(), result.getDouble("originalByteSize"), 0.0001)
    assertEquals(
      outputFile.length().toDouble() / originalByteSize.toDouble(),
      result.getDouble("compressionRatio"),
      0.0001
    )
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

  private fun assertGifSignature(bytes: ByteArray) {
    assertTrue(bytes.size >= 6)
    val header = String(bytes, 0, 6, StandardCharsets.US_ASCII)

    assertTrue(header == "GIF87a" || header == "GIF89a")
  }

  private fun assertTopLeftPixelNear(
    outputFile: File,
    expectedColor: Int
  ) {
    val bitmap = BitmapFactory.decodeFile(outputFile.absolutePath)

    assertNotNull(bitmap)

    try {
      val actualColor = bitmap.getPixel(0, 0)

      assertColorChannelNear(expectedColor, actualColor, shift = 16)
      assertColorChannelNear(expectedColor, actualColor, shift = 8)
      assertColorChannelNear(expectedColor, actualColor, shift = 0)
    } finally {
      bitmap.recycle()
    }
  }

  private fun assertColorChannelNear(
    expectedColor: Int,
    actualColor: Int,
    shift: Int
  ) {
    val expectedChannel = (expectedColor shr shift) and 0xff
    val actualChannel = (actualColor shr shift) and 0xff

    assertTrue(abs(expectedChannel - actualChannel) <= 2)
  }

  private fun assertNormalizedOutputExif(
    outputFile: File,
    width: Int,
    height: Int
  ) {
    val outputExif = ExifInterface(outputFile.absolutePath)

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

  private fun assertNoCopiedExifMetadata(outputFile: File) {
    val outputExif = ExifInterface(outputFile.absolutePath)

    assertNull(outputExif.getAttribute(ExifInterface.TAG_PIXEL_X_DIMENSION))
    assertNull(outputExif.getAttribute(ExifInterface.TAG_PIXEL_Y_DIMENSION))
    assertEquals(
      ExifInterface.ORIENTATION_UNDEFINED,
      outputExif.getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_UNDEFINED
      )
    )
  }

  private fun assertUnsupportedFormatRejected(promise: RecordingPromise) {
    assertNull(promise.resolvedValue)
    assertEquals(ImageCompressionKitModule.ERR_UNSUPPORTED_FORMAT, promise.rejectionCode)
    assertEquals(
      "Android MVP supports JPEG, PNG, WebP, GIF, HEIC, and HEIF input only.",
      promise.rejectionMessage
    )
  }

  private fun assertHeicHeifSdkUnsupportedRejected(promise: RecordingPromise) {
    assertNull(promise.resolvedValue)
    assertEquals(ImageCompressionKitModule.ERR_UNSUPPORTED_FORMAT, promise.rejectionCode)
    assertEquals(
      "Android HEIC/HEIF input requires Android 8.0+ platform decoder support.",
      promise.rejectionMessage
    )
  }

  private fun assertDecodeFailedRejected(promise: RecordingPromise) {
    assertNull(promise.resolvedValue)
    assertEquals(ImageCompressionKitModule.ERR_DECODE_FAILED, promise.rejectionCode)
    assertEquals("Android MVP could not decode the source image.", promise.rejectionMessage)
  }

  private data class ResizeCase(
    val resize: JavaOnlyMap,
    val expectedWidth: Int,
    val expectedHeight: Int
  )

  private data class TargetSizeCase(
    val format: String,
    val outputFormat: OutputFormat,
    val assertSignature: (ByteArray) -> Unit
  )

  private data class SourceFormatCase(
    val format: OutputFormat,
    val sourceFile: File
  )

  private data class UnsupportedSourceCase(
    val fileExtension: String,
    val mimeType: String
  )

  private class TestMimeTypeContentProvider : ContentProvider() {
    override fun onCreate(): Boolean =
      true

    override fun query(
      uri: Uri,
      projection: Array<out String>?,
      selection: String?,
      selectionArgs: Array<out String>?,
      sortOrder: String?
    ): Cursor? =
      null

    override fun getType(uri: Uri): String? =
      mimeTypes[uri]

    override fun insert(uri: Uri, values: ContentValues?): Uri? =
      null

    override fun delete(
      uri: Uri,
      selection: String?,
      selectionArgs: Array<out String>?
    ): Int =
      0

    override fun update(
      uri: Uri,
      values: ContentValues?,
      selection: String?,
      selectionArgs: Array<out String>?
    ): Int =
      0

    companion object {
      private val mimeTypes = mutableMapOf<Uri, String>()

      fun register(
        uri: Uri,
        mimeType: String
      ) {
        mimeTypes[uri] = mimeType
      }
    }
  }

  companion object {
    private const val SAMPLE_GIF_BASE64 =
      "R0lGODdhKAAUAJEAAAAAADNmmf///wAAACH5BAQAAAAALAAAAAAoABQAAAIajI+py+0Po5y02ouz3rz7D4biSJbmiabqihUAOw=="

    @Suppress("unused")
    private val ANDROID_REJECTED_ANIMATED_GIF_BASE64 = """
      R0lGODlhKAAUAPAAADNmmf///yH5BAAKAAAALAAAAAAoABQAAAL/BAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQIECAAAECBAgQxCBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgUAIfkEAAoAAAAsAAAAACgAFAAAAv9MmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDBhwoQJEyZMmDDEYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmTJgwYcKECRMmBQA7
    """.trimIndent()
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
