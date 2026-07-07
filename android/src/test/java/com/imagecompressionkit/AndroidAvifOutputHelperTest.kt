package com.imagecompressionkit

import android.graphics.Bitmap
import android.media.MediaFormat
import android.os.Build
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.nio.charset.StandardCharsets

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AndroidAvifOutputHelperTest {
  @Test
  fun helperInputPreservesRouteReportAndProductionHelperBoundary() {
    val report = AndroidAvifOutputPrototype.inspectRoute(
      width = 16,
      height = 12,
      apiLevel = Build.VERSION_CODES.UPSIDE_DOWN_CAKE,
      encoderFinder = { format ->
        when (format.getString(MediaFormat.KEY_MIME)) {
          AndroidAvifOutputPrototype.AVIF_MIME_TYPE -> "c2.android.avif.encoder"
          AndroidAvifOutputPrototype.AV1_VIDEO_MIME_TYPE -> "c2.android.av1.encoder"
          else -> null
        }
      }
    )

    val input = AndroidAvifOutputHelper.createInput(
      cacheDir = createTempCacheDir(),
      width = 16,
      height = 12,
      routeReport = report
    )

    assertEquals(AndroidAvifOutputHelper.PRODUCTION_HELPER_ROUTE, input.helperRoute)
    assertEquals(16, input.width)
    assertEquals(12, input.height)
    assertEquals(Build.VERSION_CODES.UPSIDE_DOWN_CAKE, input.apiLevel)
    assertTrue(input.sdkEligible)
    assertEquals("c2.android.avif.encoder", input.encoderName)
    assertTrue(input.routeBlockers.any { it.contains("not wired into compressImage()") })
  }

  @Test
  fun helperBelowApi34ReportsSdkBlockerWithoutAttemptingCodec() {
    val input = AndroidAvifOutputHelper.createInput(
      cacheDir = createTempCacheDir(),
      width = 16,
      height = 12,
      routeReport = AndroidAvifOutputPrototype.inspectRoute(
        width = 16,
        height = 12,
        apiLevel = Build.VERSION_CODES.TIRAMISU,
        encoderFinder = {
          throw AssertionError("Encoder finder must not run below API 34.")
        }
      )
    )

    val result = AndroidAvifOutputHelper.runEncodeDecodeBack(input)

    assertEquals(AndroidAvifOutputHelper.PRODUCTION_HELPER_ROUTE, result.helperRoute)
    assertFalse(result.attempted)
    assertFalse(result.success)
    assertNull(result.encoderName)
    assertEquals(AndroidAvifOutputPrototype.SMOKE_ROUTE, result.route)
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_SDK_UNAVAILABLE, result.blockerCode)
    assertTrue(result.blocker?.contains("requires Android 14+") == true)
    assertEquals(AndroidAvifOutputPrototype.PRODUCTION_DECISION_KEEP_DISABLED, result.productionDecision)
    assertBlockedResultDetailsOrder(input, result.details)
  }

  @Test
  fun helperWithoutImageEncoderReportsStableNoEncoderBlocker() {
    val input = AndroidAvifOutputHelper.createInput(
      cacheDir = createTempCacheDir(),
      width = 16,
      height = 12,
      routeReport = AndroidAvifOutputPrototype.inspectRoute(
        width = 16,
        height = 12,
        apiLevel = Build.VERSION_CODES.UPSIDE_DOWN_CAKE,
        encoderFinder = { null }
      )
    )

    val result = AndroidAvifOutputHelper.runEncodeDecodeBack(input)

    assertEquals(AndroidAvifOutputHelper.PRODUCTION_HELPER_ROUTE, result.helperRoute)
    assertFalse(result.attempted)
    assertFalse(result.success)
    assertNull(result.encoderName)
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_NO_IMAGE_AVIF_ENCODER, result.blockerCode)
    assertEquals(AndroidAvifOutputPrototype.NO_IMAGE_AVIF_ENCODER_BLOCKER, result.blocker)
    assertEquals(AndroidAvifOutputPrototype.PRODUCTION_DECISION_KEEP_DISABLED, result.productionDecision)
    assertBlockedResultDetailsOrder(input, result.details)
  }

  @Test
  fun helperUsesInjectedEncoderMuxerAndValidatorForInvalidSignatureBlocker() {
    val cacheDir = createTempCacheDir()
    val input = createEligibleHelperInput(cacheDir)
    val calls = mutableListOf<String>()
    val outputFiles = mutableMapOf<String, File>()
    val directBytes = "not-an-avif".toByteArray(StandardCharsets.US_ASCII)
    val muxedBytes = "muxed-but-not-avif".toByteArray(StandardCharsets.US_ASCII)

    val result = AndroidAvifOutputHelper.runEncodeDecodeBack(
      input = input,
      dependencies = AndroidAvifOutputHelperDependencies(
        createBitmap = { width, height ->
          calls.add("bitmap:$width:$height")
          Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        },
        encodeBitmap = { encoderName, bitmap ->
          calls.add("encode:$encoderName:${bitmap.width}x${bitmap.height}")
          AndroidAvifOutputHelperOutput(
            directBytes = directBytes,
            outputFormat = AndroidAvifOutputHelper.createImageAvifMediaFormat(
              bitmap.width,
              bitmap.height
            ),
            samples = listOf(
              AndroidAvifOutputHelperSample(
                bytes = "fake-sample".toByteArray(StandardCharsets.US_ASCII),
                presentationTimeUs = 0L,
                flags = 0
              )
            ),
            details = listOf("Injected fake encoder bytes")
          )
        },
        createOutputFile = { directory, suffix ->
          calls.add("file:$suffix")
          File(directory, "fake-$suffix.avif").also { outputFiles[suffix] = it }
        },
        muxEncodedSamples = { outputFile, _, samples ->
          calls.add("mux:${outputFile.name}:${samples.size}")
          outputFile.writeBytes(muxedBytes)
          listOf("Injected fake muxer bytes")
        },
        validateFile = { file, _, _ ->
          val signatureValid = AndroidAvifOutputHelper.looksLikeAvifFile(file.readBytes())
          val decodeBackValid = false
          calls.add("validate:${file.name}:$signatureValid")
          AndroidAvifOutputHelperFileValidation(
            file = file,
            signatureValid = signatureValid,
            decodeBackValid = decodeBackValid,
            decodedWidth = null,
            decodedHeight = null,
            details = listOf(
              validationProvenanceDetail(
                label = if (file.name.contains("muxed")) "Muxed validation" else "Direct validation",
                file = file,
                signatureValid = signatureValid,
                decodeBackValid = decodeBackValid
              )
            )
          )
        }
      )
    )

    val directFile = outputFiles.getValue("direct")
    val muxedFile = outputFiles.getValue("muxed")

    assertTrue(result.attempted)
    assertFalse(result.success)
    assertEquals("fake.avif.encoder", result.encoderName)
    assertEquals(
      "${AndroidAvifOutputPrototype.SMOKE_ROUTE} via MediaMuxer.MUXER_OUTPUT_HEIF",
      result.route
    )
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_INVALID_SIGNATURE, result.blockerCode)
    assertEquals(AndroidAvifOutputPrototype.INVALID_SIGNATURE_BLOCKER, result.blocker)
    assertFalse(result.signatureValid)
    assertFalse(result.decodeBackValid)
    assertEquals(muxedFile.absolutePath, result.outputFilePath)
    assertFalse(result.outputFilePath == directFile.absolutePath)
    assertTrue(directFile.exists())
    assertTrue(muxedFile.exists())
    assertEquals(directBytes.size.toLong(), directFile.length())
    assertEquals(muxedBytes.size.toLong(), muxedFile.length())
    assertEquals(muxedFile.length(), result.byteSize)
    assertValidationResultDetailsOrder(
      input = input,
      details = result.details,
      expectedCoreDetails = listOf(
        "Injected fake encoder bytes",
        validationProvenanceDetail(
          label = "Direct validation",
          file = directFile,
          signatureValid = false,
          decodeBackValid = false
        ),
        "Injected fake muxer bytes",
        validationProvenanceDetail(
          label = "Muxed validation",
          file = muxedFile,
          signatureValid = false,
          decodeBackValid = false
        )
      )
    )
    assertTrue(calls.containsAll(listOf("bitmap:16:12", "file:direct", "file:muxed")))
    assertTrue(calls.any { it == "validate:fake-direct.avif:false" })
    assertTrue(calls.any { it == "validate:fake-muxed.avif:false" })
  }

  @Test
  fun helperUsesInjectedMuxedDecodeBackSuccessForPassedSmokeContract() {
    val cacheDir = createTempCacheDir()
    val input = createEligibleHelperInput(cacheDir)
    val calls = mutableListOf<String>()
    val outputFiles = mutableMapOf<String, File>()
    val directBytes = "direct-not-avif".toByteArray(StandardCharsets.US_ASCII)
    val muxedBytes = fakeAvifBytes()

    val result = AndroidAvifOutputHelper.runEncodeDecodeBack(
      input = input,
      dependencies = AndroidAvifOutputHelperDependencies(
        createBitmap = { width, height ->
          calls.add("bitmap:$width:$height")
          Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        },
        encodeBitmap = { encoderName, bitmap ->
          calls.add("encode:$encoderName:${bitmap.width}x${bitmap.height}")
          AndroidAvifOutputHelperOutput(
            directBytes = directBytes,
            outputFormat = AndroidAvifOutputHelper.createImageAvifMediaFormat(
              bitmap.width,
              bitmap.height
            ),
            samples = listOf(
              AndroidAvifOutputHelperSample(
                bytes = "muxable-fake-sample".toByteArray(StandardCharsets.US_ASCII),
                presentationTimeUs = 33333L,
                flags = 0
              )
            ),
            details = listOf("Injected success-contract encoder bytes")
          )
        },
        createOutputFile = { directory, suffix ->
          calls.add("file:$suffix")
          File(directory, "success-$suffix.avif").also { outputFiles[suffix] = it }
        },
        muxEncodedSamples = { outputFile, _, samples ->
          calls.add("mux:${outputFile.name}:${samples.size}")
          outputFile.writeBytes(muxedBytes)
          listOf("Injected muxed ftyp avif bytes")
        },
        validateFile = { file, expectedWidth, expectedHeight ->
          val signatureValid = AndroidAvifOutputHelper.looksLikeAvifFile(file.readBytes())
          val isMuxedOutput = file.name.contains("muxed")
          val decodeBackValid = isMuxedOutput
          calls.add("validate:${file.name}:$signatureValid:$isMuxedOutput")
          AndroidAvifOutputHelperFileValidation(
            file = file,
            signatureValid = signatureValid,
            decodeBackValid = decodeBackValid,
            decodedWidth = if (isMuxedOutput) expectedWidth else null,
            decodedHeight = if (isMuxedOutput) expectedHeight else null,
            details = listOf(
              validationProvenanceDetail(
                label = if (isMuxedOutput) "Muxed validation" else "Direct validation",
                file = file,
                signatureValid = signatureValid,
                decodeBackValid = decodeBackValid
              )
            )
          )
        }
      )
    )

    val directFile = outputFiles.getValue("direct")
    val muxedFile = outputFiles.getValue("muxed")

    assertTrue(result.attempted)
    assertTrue(result.success)
    assertEquals("fake.avif.encoder", result.encoderName)
    assertEquals(
      "${AndroidAvifOutputPrototype.SMOKE_ROUTE} via MediaMuxer.MUXER_OUTPUT_HEIF",
      result.route
    )
    assertEquals(muxedFile.absolutePath, result.outputFilePath)
    assertFalse(result.outputFilePath == directFile.absolutePath)
    assertTrue(directFile.exists())
    assertTrue(muxedFile.exists())
    assertEquals(directBytes.size.toLong(), directFile.length())
    assertEquals(muxedBytes.size.toLong(), muxedFile.length())
    assertEquals(muxedFile.length(), result.byteSize)
    assertTrue(result.signatureValid)
    assertTrue(result.decodeBackValid)
    assertEquals(16, result.decodedWidth)
    assertEquals(12, result.decodedHeight)
    assertNull(result.blockerCode)
    assertNull(result.blocker)
    assertEquals(
      AndroidAvifOutputPrototype.PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED,
      result.productionDecision
    )
    assertValidationResultDetailsOrder(
      input = input,
      details = result.details,
      expectedCoreDetails = listOf(
        "Injected success-contract encoder bytes",
        validationProvenanceDetail(
          label = "Direct validation",
          file = directFile,
          signatureValid = false,
          decodeBackValid = false
        ),
        "Injected muxed ftyp avif bytes",
        validationProvenanceDetail(
          label = "Muxed validation",
          file = muxedFile,
          signatureValid = true,
          decodeBackValid = true
        )
      )
    )
    assertTrue(calls.containsAll(listOf("bitmap:16:12", "file:direct", "file:muxed")))
    assertTrue(calls.any { it == "validate:success-direct.avif:false:false" })
    assertTrue(calls.any { it == "validate:success-muxed.avif:true:true" })
  }

  @Test
  fun helperUsesInjectedDirectDecodeBackSuccessAndSkipsMuxer() {
    val cacheDir = createTempCacheDir()
    val input = createEligibleHelperInput(cacheDir)
    val calls = mutableListOf<String>()
    val outputFiles = mutableMapOf<String, File>()
    val directBytes = fakeAvifBytes()

    val result = AndroidAvifOutputHelper.runEncodeDecodeBack(
      input = input,
      dependencies = AndroidAvifOutputHelperDependencies(
        createBitmap = { width, height ->
          calls.add("bitmap:$width:$height")
          Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        },
        encodeBitmap = { encoderName, bitmap ->
          calls.add("encode:$encoderName:${bitmap.width}x${bitmap.height}")
          AndroidAvifOutputHelperOutput(
            directBytes = directBytes,
            outputFormat = AndroidAvifOutputHelper.createImageAvifMediaFormat(
              bitmap.width,
              bitmap.height
            ),
            samples = listOf(
              AndroidAvifOutputHelperSample(
                bytes = "must-not-be-muxed".toByteArray(StandardCharsets.US_ASCII),
                presentationTimeUs = 33333L,
                flags = 0
              )
            ),
            details = listOf("Injected direct ftyp avif bytes")
          )
        },
        createOutputFile = { directory, suffix ->
          calls.add("file:$suffix")
          File(directory, "direct-success-$suffix.avif").also { outputFiles[suffix] = it }
        },
        muxEncodedSamples = { _, _, _ ->
          throw AssertionError("Muxer must not run after direct validation success.")
        },
        validateFile = { file, expectedWidth, expectedHeight ->
          val signatureValid = AndroidAvifOutputHelper.looksLikeAvifFile(file.readBytes())
          val decodeBackValid = signatureValid
          calls.add("validate:${file.name}:$signatureValid")
          AndroidAvifOutputHelperFileValidation(
            file = file,
            signatureValid = signatureValid,
            decodeBackValid = decodeBackValid,
            decodedWidth = if (signatureValid) expectedWidth else null,
            decodedHeight = if (signatureValid) expectedHeight else null,
            details = listOf(
              validationProvenanceDetail(
                label = "Direct validation",
                file = file,
                signatureValid = signatureValid,
                decodeBackValid = decodeBackValid
              )
            )
          )
        }
      )
    )

    val directFile = outputFiles.getValue("direct")

    assertTrue(result.attempted)
    assertTrue(result.success)
    assertEquals("fake.avif.encoder", result.encoderName)
    assertEquals(
      "${AndroidAvifOutputPrototype.SMOKE_ROUTE} direct encoder output",
      result.route
    )
    assertEquals(directFile.absolutePath, result.outputFilePath)
    assertTrue(directFile.exists())
    assertEquals(directBytes.size.toLong(), directFile.length())
    assertEquals(directFile.length(), result.byteSize)
    assertTrue(result.signatureValid)
    assertTrue(result.decodeBackValid)
    assertEquals(16, result.decodedWidth)
    assertEquals(12, result.decodedHeight)
    assertNull(result.blockerCode)
    assertNull(result.blocker)
    assertEquals(
      AndroidAvifOutputPrototype.PRODUCTION_DECISION_SMOKE_PASSED_KEEP_DISABLED,
      result.productionDecision
    )
    assertValidationResultDetailsOrder(
      input = input,
      details = result.details,
      expectedCoreDetails = listOf(
        "Injected direct ftyp avif bytes",
        validationProvenanceDetail(
          label = "Direct validation",
          file = directFile,
          signatureValid = true,
          decodeBackValid = true
        )
      )
    )
    assertTrue(calls.containsAll(listOf("bitmap:16:12", "file:direct")))
    assertTrue(calls.any { it == "validate:direct-success-direct.avif:true" })
    assertFalse(outputFiles.containsKey("muxed"))
    assertFalse(calls.contains("file:muxed"))
    assertFalse(calls.any { it.startsWith("mux:") })
  }

  @Test
  fun helperUsesInjectedValidatorForDecodeBackFailureBlocker() {
    val cacheDir = createTempCacheDir()
    val input = createEligibleHelperInput(cacheDir)
    val outputFiles = mutableMapOf<String, File>()
    val avifBytes = fakeAvifBytes()

    val result = AndroidAvifOutputHelper.runEncodeDecodeBack(
      input = input,
      dependencies = AndroidAvifOutputHelperDependencies(
        createBitmap = { width, height ->
          Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        },
        encodeBitmap = { _, bitmap ->
          AndroidAvifOutputHelperOutput(
            directBytes = avifBytes,
            outputFormat = AndroidAvifOutputHelper.createImageAvifMediaFormat(
              bitmap.width,
              bitmap.height
            ),
            samples = listOf(
              AndroidAvifOutputHelperSample(
                bytes = avifBytes,
                presentationTimeUs = 0L,
                flags = 0
              )
            ),
            details = listOf("Injected ftyp avif bytes")
          )
        },
        createOutputFile = { directory, suffix ->
          File(directory, "decode-$suffix.avif").also { outputFiles[suffix] = it }
        },
        muxEncodedSamples = { outputFile, _, _ ->
          outputFile.writeBytes(avifBytes)
          listOf("Injected muxed ftyp avif bytes")
        },
        validateFile = { file, expectedWidth, expectedHeight ->
          val signatureValid = AndroidAvifOutputHelper.looksLikeAvifFile(file.readBytes())
          AndroidAvifOutputHelperFileValidation(
            file = file,
            signatureValid = signatureValid,
            decodeBackValid = false,
            decodedWidth = expectedWidth,
            decodedHeight = expectedHeight - 1,
            details = listOf(
              validationProvenanceDetail(
                label = if (file.name.contains("muxed")) "Muxed validation" else "Direct validation",
                file = file,
                signatureValid = signatureValid,
                decodeBackValid = false
              )
            )
          )
        }
      )
    )

    val directFile = outputFiles.getValue("direct")
    val muxedFile = outputFiles.getValue("muxed")

    assertTrue(result.attempted)
    assertFalse(result.success)
    assertTrue(result.signatureValid)
    assertFalse(result.decodeBackValid)
    assertEquals(16, result.decodedWidth)
    assertEquals(11, result.decodedHeight)
    assertEquals(muxedFile.absolutePath, result.outputFilePath)
    assertFalse(result.outputFilePath == directFile.absolutePath)
    assertTrue(directFile.exists())
    assertTrue(muxedFile.exists())
    assertEquals(avifBytes.size.toLong(), directFile.length())
    assertEquals(avifBytes.size.toLong(), muxedFile.length())
    assertEquals(muxedFile.length(), result.byteSize)
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_DECODE_BACK_FAILURE, result.blockerCode)
    assertEquals(AndroidAvifOutputPrototype.DECODE_BACK_FAILURE_BLOCKER, result.blocker)
    assertEquals(AndroidAvifOutputPrototype.PRODUCTION_DECISION_KEEP_DISABLED, result.productionDecision)
    assertValidationResultDetailsOrder(
      input = input,
      details = result.details,
      expectedCoreDetails = listOf(
        "Injected ftyp avif bytes",
        validationProvenanceDetail(
          label = "Direct validation",
          file = directFile,
          signatureValid = true,
          decodeBackValid = false
        ),
        "Injected muxed ftyp avif bytes",
        validationProvenanceDetail(
          label = "Muxed validation",
          file = muxedFile,
          signatureValid = true,
          decodeBackValid = false
        )
      )
    )
  }

  @Test
  fun helperUsesInjectedEncoderFailureForCodecFailureResult() {
    val cacheDir = createTempCacheDir()
    val input = createEligibleHelperInput(cacheDir)

    val result = AndroidAvifOutputHelper.runEncodeDecodeBack(
      input = input,
      dependencies = AndroidAvifOutputHelperDependencies(
        createBitmap = { width, height ->
          Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        },
        encodeBitmap = { _, _ ->
          throw IllegalStateException("injected codec failure")
        },
        createOutputFile = { _, _ ->
          throw AssertionError("Output files must not be created after encoder failure.")
        },
        muxEncodedSamples = { _, _, _ ->
          throw AssertionError("Muxer must not run after encoder failure.")
        },
        validateFile = { _, _, _ ->
          throw AssertionError("Validator must not run after encoder failure.")
        }
      )
    )

    assertTrue(result.attempted)
    assertFalse(result.success)
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_CODEC_FAILURE, result.blockerCode)
    assertEquals(
      "${AndroidAvifOutputPrototype.CODEC_FAILURE_BLOCKER_PREFIX}: IllegalStateException: injected codec failure",
      result.blocker
    )
    assertNull(result.outputFilePath)
    assertFalse(result.signatureValid)
    assertFalse(result.decodeBackValid)
    assertEquals(AndroidAvifOutputPrototype.PRODUCTION_DECISION_KEEP_DISABLED, result.productionDecision)
    assertBlockedResultDetailsOrder(input, result.details)
  }

  @Test
  fun helperClassifiesValidationAndCodecFailuresWithProductionDecisionBlockers() {
    val invalidSignature = AndroidAvifOutputHelper.classifyValidationBlocker(
      signatureValid = false,
      decodeBackValid = false
    )
    val decodeBackFailure = AndroidAvifOutputHelper.classifyValidationBlocker(
      signatureValid = true,
      decodeBackValid = false
    )
    val codecBlocker = AndroidAvifOutputHelper.codecFailureBlocker(
      IllegalStateException("codec exploded")
    )

    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_INVALID_SIGNATURE, invalidSignature?.code)
    assertEquals(AndroidAvifOutputPrototype.INVALID_SIGNATURE_BLOCKER, invalidSignature?.message)
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_DECODE_BACK_FAILURE, decodeBackFailure?.code)
    assertEquals(AndroidAvifOutputPrototype.DECODE_BACK_FAILURE_BLOCKER, decodeBackFailure?.message)
    assertEquals(
      "${AndroidAvifOutputPrototype.CODEC_FAILURE_BLOCKER_PREFIX}: IllegalStateException: codec exploded",
      codecBlocker
    )
  }

  private fun createEligibleHelperInput(cacheDir: File): AndroidAvifOutputHelperInput =
    AndroidAvifOutputHelper.createInput(
      cacheDir = cacheDir,
      width = 16,
      height = 12,
      routeReport = AndroidAvifOutputPrototype.inspectRoute(
        width = 16,
        height = 12,
        apiLevel = Build.VERSION_CODES.UPSIDE_DOWN_CAKE,
        encoderFinder = { format ->
          when (format.getString(MediaFormat.KEY_MIME)) {
            AndroidAvifOutputPrototype.AVIF_MIME_TYPE -> "fake.avif.encoder"
            else -> null
          }
        }
      )
    )

  private fun createTempCacheDir(): File =
    createTempFile(prefix = "rnick-avif-output-helper", suffix = "cache").let { file ->
      file.delete()
      file.mkdirs()
      file
    }

  private fun assertValidationResultDetailsOrder(
    input: AndroidAvifOutputHelperInput,
    details: List<String>,
    expectedCoreDetails: List<String>
  ) {
    assertTrue(input.routeBlockers.isNotEmpty())
    assertEquals(
      listOf(AndroidAvifOutputHelper.INJECTABLE_VALIDATION_SEAM) +
        expectedCoreDetails +
        input.routeBlockers,
      details
    )
  }

  private fun assertBlockedResultDetailsOrder(
    input: AndroidAvifOutputHelperInput,
    details: List<String>
  ) {
    assertTrue(input.routeBlockers.isNotEmpty())
    assertEquals(
      input.routeBlockers +
        AndroidAvifOutputHelper.INJECTABLE_VALIDATION_SEAM +
        AndroidAvifOutputHelper.HELPER_DISABLED_FROM_COMPRESS_IMAGE,
      details
    )
  }

  private fun validationProvenanceDetail(
    label: String,
    file: File,
    signatureValid: Boolean,
    decodeBackValid: Boolean
  ): String =
    "$label ${file.name}: ${file.length()} byte(s), " +
      "signatureValid=$signatureValid, decodeBackValid=$decodeBackValid"

  private fun fakeAvifBytes(): ByteArray =
    byteArrayOf(0, 0, 0, 24) +
      "ftypavif".toByteArray(StandardCharsets.US_ASCII) +
      byteArrayOf(0, 0, 0, 0) +
      "avif".toByteArray(StandardCharsets.US_ASCII)
}
