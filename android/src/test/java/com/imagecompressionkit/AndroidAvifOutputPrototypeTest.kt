package com.imagecompressionkit

import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.os.Build
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AndroidAvifOutputPrototypeTest {
  @Test
  fun imageAvifMediaFormatUsesStillImageMimeAndFlexibleYuvInput() {
    val format = AndroidAvifOutputPrototype.createImageAvifMediaFormat(
      width = 16,
      height = 12
    )

    assertEquals(
      AndroidAvifOutputPrototype.AVIF_MIME_TYPE,
      format.getString(MediaFormat.KEY_MIME)
    )
    assertEquals(16, format.getInteger(MediaFormat.KEY_WIDTH))
    assertEquals(12, format.getInteger(MediaFormat.KEY_HEIGHT))
    assertEquals(
      MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible,
      format.getInteger(MediaFormat.KEY_COLOR_FORMAT)
    )
  }

  @Test
  fun inspectRouteFindsInjectedImageEncoderButKeepsProductionGateClosed() {
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

    assertTrue(report.sdkEligible)
    assertTrue(report.hasImageAvifEncoder)
    assertTrue(report.hasCandidateRoute)
    assertEquals("c2.android.avif.encoder", report.imageAvifEncoderName)
    assertEquals("c2.android.av1.encoder", report.av1FallbackEncoderName)
    assertEquals(AndroidAvifOutputPrototype.CANDIDATE_ROUTE, report.candidateRoute)
    assertFalse(report.productionReady)
    assertTrue(report.blockers.any { it.contains("not wired into compressImage()") })
    assertTrue(report.blockers.any { it.contains("ImageDecoder decode-back validation") })
    assertTrue(report.blockers.any { it.contains("metadata='preserve'") })
    assertTrue(report.blockers.any { it.contains("output.maxBytes") })
    assertTrue(
      report.validationPlan.any {
        it == "Decode the result with ImageDecoder and assert dimensions match the processed bitmap."
      }
    )
  }

  @Test
  fun inspectRouteBelowApi34DoesNotProbeEncoderAndReportsSdkBlocker() {
    var probeCount = 0
    val report = AndroidAvifOutputPrototype.inspectRoute(
      width = 16,
      height = 12,
      apiLevel = Build.VERSION_CODES.TIRAMISU,
      encoderFinder = {
        probeCount += 1
        "unexpected"
      }
    )

    assertFalse(report.sdkEligible)
    assertFalse(report.hasImageAvifEncoder)
    assertFalse(report.hasCandidateRoute)
    assertNull(report.imageAvifEncoderName)
    assertNull(report.av1FallbackEncoderName)
    assertEquals(0, probeCount)
    assertTrue(report.blockers.any { it.contains("requires Android 14+") })
  }

  @Test
  fun avifSignatureRecognizesFtypAvifOrAvisBrandOnly() {
    val avifBytes = byteArrayOf(
      0x00.toByte(),
      0x00.toByte(),
      0x00.toByte(),
      0x1c.toByte(),
      'f'.code.toByte(),
      't'.code.toByte(),
      'y'.code.toByte(),
      'p'.code.toByte(),
      'a'.code.toByte(),
      'v'.code.toByte(),
      'i'.code.toByte(),
      'f'.code.toByte(),
      0x00.toByte(),
      0x00.toByte(),
      0x00.toByte(),
      0x00.toByte()
    )
    val avisBytes = avifBytes.copyOf().also {
      it[11] = 's'.code.toByte()
    }
    val pngBytes = byteArrayOf(
      0x89.toByte(),
      0x50.toByte(),
      0x4e.toByte(),
      0x47.toByte(),
      0x0d.toByte(),
      0x0a.toByte(),
      0x1a.toByte(),
      0x0a.toByte()
    )

    assertTrue(AndroidAvifOutputPrototype.looksLikeAvifFile(avifBytes))
    assertTrue(AndroidAvifOutputPrototype.looksLikeAvifFile(avisBytes))
    assertFalse(AndroidAvifOutputPrototype.looksLikeAvifFile(pngBytes))
    assertFalse(AndroidAvifOutputPrototype.looksLikeAvifFile(ByteArray(4)))
  }

  @Test
  fun smokeBelowApi34ReportsSdkBlockerWithoutAttempting() {
    val result = AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke(
      cacheDir = createTempCacheDir(),
      apiLevel = Build.VERSION_CODES.TIRAMISU,
      encoderFinder = {
        throw AssertionError("Encoder finder must not run below API 34.")
      }
    )

    assertFalse(result.attempted)
    assertFalse(result.success)
    assertFalse(result.outputCanBeEnabled)
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_SDK_UNAVAILABLE, result.blockerCode)
    assertEquals(AndroidAvifOutputPrototype.SMOKE_ROUTE, result.route)
    assertTrue(result.blocker?.contains("requires Android 14+") == true)
    assertEquals(AndroidAvifOutputPrototype.PRODUCTION_DECISION_KEEP_DISABLED, result.productionDecision)
    assertTrue(result.details.any { it.contains("requires Android 14+") })
  }

  @Test
  fun smokeOnApi34WithoutImageEncoderReportsBlockerWithoutAttempting() {
    val result = AndroidAvifOutputPrototype.runEncodeDecodeBackSmoke(
      cacheDir = createTempCacheDir(),
      apiLevel = Build.VERSION_CODES.UPSIDE_DOWN_CAKE,
      encoderFinder = { null }
    )

    assertFalse(result.attempted)
    assertFalse(result.success)
    assertFalse(result.outputCanBeEnabled)
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_NO_IMAGE_AVIF_ENCODER, result.blockerCode)
    assertEquals(AndroidAvifOutputPrototype.SMOKE_ROUTE, result.route)
    assertTrue(result.blocker?.contains("No image/avif encoder") == true)
    assertEquals(AndroidAvifOutputPrototype.NO_IMAGE_AVIF_ENCODER_BLOCKER, result.blocker)
    assertEquals(AndroidAvifOutputPrototype.PRODUCTION_DECISION_KEEP_DISABLED, result.productionDecision)
    assertTrue(result.details.any { it.contains("No image/avif encoder") })
  }

  @Test
  fun smokeValidationClassifiesInvalidSignatureAndDecodeBackFailures() {
    val invalidSignature = AndroidAvifOutputPrototype.classifySmokeValidationBlocker(
      signatureValid = false,
      decodeBackValid = false
    )
    val decodeBackFailure = AndroidAvifOutputPrototype.classifySmokeValidationBlocker(
      signatureValid = true,
      decodeBackValid = false
    )
    val success = AndroidAvifOutputPrototype.classifySmokeValidationBlocker(
      signatureValid = true,
      decodeBackValid = true
    )

    assertNotNull(invalidSignature)
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_INVALID_SIGNATURE, invalidSignature?.code)
    assertEquals(AndroidAvifOutputPrototype.INVALID_SIGNATURE_BLOCKER, invalidSignature?.message)
    assertNotNull(decodeBackFailure)
    assertEquals(AndroidAvifOutputPrototype.BLOCKER_CODE_DECODE_BACK_FAILURE, decodeBackFailure?.code)
    assertEquals(AndroidAvifOutputPrototype.DECODE_BACK_FAILURE_BLOCKER, decodeBackFailure?.message)
    assertNull(success)
  }

  @Test
  fun codecFailureBlockerKeepsStableProductionDecisionMessage() {
    val blocker = AndroidAvifOutputPrototype.codecFailureBlocker(
      IllegalStateException("codec exploded")
    )

    assertEquals(
      "${AndroidAvifOutputPrototype.CODEC_FAILURE_BLOCKER_PREFIX}: IllegalStateException: codec exploded",
      blocker
    )
  }

  private fun createTempCacheDir(): File =
    createTempFile(prefix = "rnick-avif-output-smoke", suffix = "cache").let { file ->
      file.delete()
      file.mkdirs()
      file
    }
}
