package com.imagecompressionkit

import android.graphics.Bitmap
import androidx.exifinterface.media.ExifInterface
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.util.IdentityHashMap

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AndroidBitmapTransformerTest {
  @Test
  fun appliesAllEightExifOrientations() {
    val sourceRows = listOf(
      listOf(RED, GREEN, BLUE),
      listOf(CYAN, MAGENTA, YELLOW)
    )
    val cases = listOf(
      OrientationCase(
        ExifInterface.ORIENTATION_NORMAL,
        sourceRows
      ),
      OrientationCase(
        ExifInterface.ORIENTATION_FLIP_HORIZONTAL,
        listOf(
          listOf(BLUE, GREEN, RED),
          listOf(YELLOW, MAGENTA, CYAN)
        )
      ),
      OrientationCase(
        ExifInterface.ORIENTATION_ROTATE_180,
        listOf(
          listOf(YELLOW, MAGENTA, CYAN),
          listOf(BLUE, GREEN, RED)
        )
      ),
      OrientationCase(
        ExifInterface.ORIENTATION_FLIP_VERTICAL,
        listOf(
          listOf(CYAN, MAGENTA, YELLOW),
          listOf(RED, GREEN, BLUE)
        )
      ),
      OrientationCase(
        ExifInterface.ORIENTATION_TRANSPOSE,
        listOf(
          listOf(RED, CYAN),
          listOf(GREEN, MAGENTA),
          listOf(BLUE, YELLOW)
        )
      ),
      OrientationCase(
        ExifInterface.ORIENTATION_ROTATE_90,
        listOf(
          listOf(CYAN, RED),
          listOf(MAGENTA, GREEN),
          listOf(YELLOW, BLUE)
        )
      ),
      OrientationCase(
        ExifInterface.ORIENTATION_TRANSVERSE,
        listOf(
          listOf(YELLOW, BLUE),
          listOf(MAGENTA, GREEN),
          listOf(CYAN, RED)
        )
      ),
      OrientationCase(
        ExifInterface.ORIENTATION_ROTATE_270,
        listOf(
          listOf(BLUE, YELLOW),
          listOf(GREEN, MAGENTA),
          listOf(RED, CYAN)
        )
      )
    )

    cases.forEach { case ->
      val source = createBitmap(sourceRows)
      val transformation = AndroidBitmapTransformer().transform(
        source = source,
        exifOrientation = case.orientation,
        resize = null
      )
      val output = transformation.result.bitmap

      assertEquals(case.expectedRows.first().size, transformation.result.dimensions.width)
      assertEquals(case.expectedRows.size, transformation.result.dimensions.height)
      assertBitmapRows(case.orientation, output, case.expectedRows)

      transformation.close()
      assertTrue(source.isRecycled)
      assertTrue(output.isRecycled)
    }
  }

  @Test
  fun keepsIdentityAndNoUpscaleRequestsAsSameBitmap() {
    val cases = listOf<ResizeOptions?>(
      null,
      ResizeOptions(maxWidth = 20, maxHeight = 20, mode = ResizeMode.CONTAIN),
      ResizeOptions(maxWidth = 20, maxHeight = 20, mode = ResizeMode.COVER),
      ResizeOptions(maxWidth = 20, maxHeight = 20, mode = ResizeMode.STRETCH)
    )

    cases.forEach { resize ->
      val recycleCounts = IdentityHashMap<Bitmap, Int>()
      val transformer = AndroidBitmapTransformer { bitmap ->
        recycleCounts[bitmap] = (recycleCounts[bitmap] ?: 0) + 1
      }
      val source = createSolidBitmap(width = 6, height = 4)
      val transformation = transformer.transform(
        source,
        ExifInterface.ORIENTATION_NORMAL,
        resize
      )

      assertSame(source, transformation.result.bitmap)
      assertEquals(AndroidBitmapDimensions(6, 4), transformation.result.dimensions)
      transformation.close()
      transformation.close()
      assertEquals(1, recycleCounts[source])

      source.recycle()
    }
  }

  @Test
  fun resizesContainCoverAndStretchWithStableDimensions() {
    val cases = listOf(
      ResizeCase(
        ResizeOptions(maxWidth = 3, maxHeight = 3, mode = ResizeMode.CONTAIN),
        AndroidBitmapDimensions(3, 2)
      ),
      ResizeCase(
        ResizeOptions(maxWidth = 3, maxHeight = 3, mode = ResizeMode.COVER),
        AndroidBitmapDimensions(3, 3)
      ),
      ResizeCase(
        ResizeOptions(maxWidth = 3, maxHeight = 3, mode = ResizeMode.STRETCH),
        AndroidBitmapDimensions(3, 3)
      )
    )

    cases.forEach { case ->
      val source = createSolidBitmap(width = 6, height = 4)
      val transformation = AndroidBitmapTransformer().transform(
        source,
        ExifInterface.ORIENTATION_NORMAL,
        case.resize
      )
      val output = transformation.result.bitmap

      assertEquals(case.expectedDimensions, transformation.result.dimensions)
      assertEquals(case.expectedDimensions.width, output.width)
      assertEquals(case.expectedDimensions.height, output.height)
      transformation.close()
      assertTrue(source.isRecycled)
      assertTrue(output.isRecycled)
    }
  }

  @Test
  fun centerCropUsesTheCenteredSourceRegion() {
    val sourceRows = listOf(
      listOf(RED, GREEN, BLUE, CYAN, MAGENTA, YELLOW),
      listOf(BLACK, WHITE, GRAY, ORANGE, PURPLE, BROWN)
    )
    val source = createBitmap(sourceRows)
    val transformation = AndroidBitmapTransformer().transform(
      source,
      ExifInterface.ORIENTATION_NORMAL,
      ResizeOptions(maxWidth = 2, maxHeight = 2, mode = ResizeMode.COVER)
    )
    val output = transformation.result.bitmap

    assertEquals(AndroidBitmapDimensions(2, 2), transformation.result.dimensions)
    assertBitmapRows(
      ExifInterface.ORIENTATION_NORMAL,
      output,
      listOf(
        listOf(BLUE, CYAN),
        listOf(GRAY, ORANGE)
      )
    )

    transformation.close()
    assertTrue(source.isRecycled)
    assertTrue(output.isRecycled)
  }

  @Test
  fun recyclesOriginalRotatedScaledAndCroppedBitmapsExactlyOnce() {
    val recycleCounts = IdentityHashMap<Bitmap, Int>()
    val recycleOrder = mutableListOf<Bitmap>()
    val transformer = AndroidBitmapTransformer { bitmap ->
      recycleCounts[bitmap] = (recycleCounts[bitmap] ?: 0) + 1
      recycleOrder += bitmap
    }
    val source = createSolidBitmap(width = 6, height = 4)
    val transformation = transformer.transform(
      source,
      ExifInterface.ORIENTATION_ROTATE_90,
      ResizeOptions(maxWidth = 3, maxHeight = 3, mode = ResizeMode.COVER)
    )
    val output = transformation.result.bitmap

    assertEquals(AndroidBitmapDimensions(3, 3), transformation.result.dimensions)
    assertEquals(1, recycleOrder.size)
    assertFalse(recycleOrder.first() === source)
    assertFalse(recycleOrder.first() === output)

    transformation.close()
    transformation.close()

    assertEquals(4, recycleOrder.size)
    assertEquals(4, recycleCounts.size)
    assertTrue(recycleCounts.values.all { count -> count == 1 })
    assertSame(output, recycleOrder[1])
    assertSame(source, recycleOrder.last())

    recycleCounts.keys.forEach { bitmap ->
      if (!bitmap.isRecycled) {
        bitmap.recycle()
      }
    }
  }

  private fun createBitmap(rows: List<List<Int>>): Bitmap {
    val bitmap = Bitmap.createBitmap(
      rows.first().size,
      rows.size,
      Bitmap.Config.ARGB_8888
    )

    rows.forEachIndexed { y, row ->
      row.forEachIndexed { x, color ->
        bitmap.setPixel(x, y, color)
      }
    }
    return bitmap
  }

  private fun createSolidBitmap(width: Int, height: Int): Bitmap =
    Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).apply {
      eraseColor(0xff336699.toInt())
    }

  private fun assertBitmapRows(
    orientation: Int,
    bitmap: Bitmap,
    expectedRows: List<List<Int>>
  ) {
    assertEquals("orientation=$orientation width", expectedRows.first().size, bitmap.width)
    assertEquals("orientation=$orientation height", expectedRows.size, bitmap.height)
    expectedRows.forEachIndexed { y, row ->
      row.forEachIndexed { x, expectedColor ->
        assertEquals(
          "orientation=$orientation pixel=($x,$y)",
          expectedColor,
          bitmap.getPixel(x, y)
        )
      }
    }
  }

  private data class OrientationCase(
    val orientation: Int,
    val expectedRows: List<List<Int>>
  )

  private data class ResizeCase(
    val resize: ResizeOptions,
    val expectedDimensions: AndroidBitmapDimensions
  )

  companion object {
    private val RED = 0xffff0000.toInt()
    private val GREEN = 0xff00ff00.toInt()
    private val BLUE = 0xff0000ff.toInt()
    private val CYAN = 0xff00ffff.toInt()
    private val MAGENTA = 0xffff00ff.toInt()
    private val YELLOW = 0xffffff00.toInt()
    private val BLACK = 0xff000000.toInt()
    private val WHITE = 0xffffffff.toInt()
    private val GRAY = 0xff777777.toInt()
    private val ORANGE = 0xffff8800.toInt()
    private val PURPLE = 0xff8844cc.toInt()
    private val BROWN = 0xff663300.toInt()
  }
}
