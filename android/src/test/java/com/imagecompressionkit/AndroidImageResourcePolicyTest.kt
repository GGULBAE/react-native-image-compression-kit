package com.imagecompressionkit

import androidx.exifinterface.media.ExifInterface
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidImageResourcePolicyTest {
  @Test
  fun plans48MPContainDecodeWithoutAllocatingFullBitmap() {
    val plan = AndroidImageResourcePolicy.createDecodePlan(
      AndroidImageBounds(8000, 6000, "image/jpeg"),
      ExifInterface.ORIENTATION_NORMAL,
      ResizeOptions(1600, 1200, ResizeMode.CONTAIN)
    )

    assertEquals(1600, plan.decodeWidth)
    assertEquals(1200, plan.decodeHeight)
    assertEquals(4, plan.inSampleSize)
    assertTrue(plan.decodeWidth.toLong() * plan.decodeHeight < ANDROID_MAX_WORKING_PIXELS)
  }

  @Test
  fun preservesCoverResolutionAndMapsOrientedAxesBackToRawDecode() {
    val plan = AndroidImageResourcePolicy.createDecodePlan(
      AndroidImageBounds(8000, 6000, "image/jpeg"),
      ExifInterface.ORIENTATION_ROTATE_90,
      ResizeOptions(1200, 1200, ResizeMode.COVER)
    )

    assertEquals(1600, plan.decodeWidth)
    assertEquals(1200, plan.decodeHeight)
    assertEquals(4, plan.inSampleSize)
    assertEquals(6000, plan.orientedWidth)
    assertEquals(8000, plan.orientedHeight)
  }

  @Test
  fun rejectsUnsafeUnboundedWorkAndSourceOverflowBeforeDecode() {
    expectResourceLimit {
      AndroidImageResourcePolicy.createDecodePlan(
        AndroidImageBounds(8000, 6000, "image/jpeg"),
        ExifInterface.ORIENTATION_NORMAL,
        null
      )
    }
    expectResourceLimit {
      AndroidImageResourcePolicy.createDecodePlan(
        AndroidImageBounds(40_000, 1, "image/png"),
        ExifInterface.ORIENTATION_NORMAL,
        ResizeOptions(1, 1, ResizeMode.CONTAIN)
      )
    }
    expectResourceLimit {
      AndroidImageResourcePolicy.createDecodePlan(
        AndroidImageBounds(20_000, 20_000, "image/png"),
        ExifInterface.ORIENTATION_NORMAL,
        ResizeOptions(1, 1, ResizeMode.CONTAIN)
      )
    }
  }

  @Test
  fun rejectsPowerOfTwoSampleWhoseActualDecodeBufferExceedsWorkingLimit() {
    val plan = AndroidImageResourcePolicy.createDecodePlan(
      AndroidImageBounds(20_000, 4_000, "image/jpeg"),
      ExifInterface.ORIENTATION_NORMAL,
      ResizeOptions(11_000, null, ResizeMode.CONTAIN)
    )

    assertEquals(1, plan.inSampleSize)
    try {
      AndroidImageResourcePolicy.validateBitmapFactoryDecode(plan)
      throw AssertionError("Expected AndroidImageResourceLimitException.")
    } catch (error: AndroidImageResourceLimitException) {
      assertTrue(error.message?.contains("80000000") == true)
    }
  }

  private fun expectResourceLimit(block: () -> Unit) {
    try {
      block()
      throw AssertionError("Expected AndroidImageResourceLimitException.")
    } catch (error: AndroidImageResourceLimitException) {
      assertTrue(error.message?.contains("limit") == true)
    }
  }
}
