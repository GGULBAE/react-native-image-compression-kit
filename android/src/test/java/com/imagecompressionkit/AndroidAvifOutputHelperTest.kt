package com.imagecompressionkit

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
    assertTrue(result.details.any { it == AndroidAvifOutputHelper.HELPER_DISABLED_FROM_COMPRESS_IMAGE })
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
    assertTrue(result.details.any { it.contains("No image/avif encoder") })
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

  private fun createTempCacheDir(): File =
    createTempFile(prefix = "rnick-avif-output-helper", suffix = "cache").let { file ->
      file.delete()
      file.mkdirs()
      file
    }
}
