package com.imagecompressionkit

import android.graphics.Bitmap
import android.graphics.Matrix
import androidx.exifinterface.media.ExifInterface
import java.io.Closeable
import java.util.Collections
import java.util.IdentityHashMap
import kotlin.math.roundToInt

internal data class AndroidBitmapDimensions(
  val width: Int,
  val height: Int
)

internal data class AndroidBitmapTransformationResult(
  val bitmap: Bitmap,
  val dimensions: AndroidBitmapDimensions
)

internal class AndroidOwnedBitmapTransformation internal constructor(
  val result: AndroidBitmapTransformationResult,
  private val ownership: AndroidBitmapOwnership
) : Closeable {
  override fun close() {
    ownership.close()
  }
}

internal class AndroidBitmapTransformer(
  private val recycleBitmap: (Bitmap) -> Unit = { bitmap -> bitmap.recycle() }
) {
  fun transform(
    source: Bitmap,
    exifOrientation: Int,
    resize: ResizeOptions?
  ): AndroidOwnedBitmapTransformation {
    val ownership = AndroidBitmapOwnership(recycleBitmap)
    ownership.own(source)

    try {
      val oriented = applyExifOrientation(source, exifOrientation, ownership)
      val output = resizeBitmap(oriented, resize, ownership)

      return AndroidOwnedBitmapTransformation(
        result = AndroidBitmapTransformationResult(
          bitmap = output,
          dimensions = AndroidBitmapDimensions(
            width = output.width,
            height = output.height
          )
        ),
        ownership = ownership
      )
    } catch (error: Throwable) {
      ownership.close()
      throw error
    }
  }

  private fun applyExifOrientation(
    bitmap: Bitmap,
    orientation: Int,
    ownership: AndroidBitmapOwnership
  ): Bitmap {
    val matrix = createExifOrientationMatrix(orientation) ?: return bitmap

    return ownership.own(
      Bitmap.createBitmap(
        bitmap,
        0,
        0,
        bitmap.width,
        bitmap.height,
        matrix,
        true
      )
    )
  }

  private fun createExifOrientationMatrix(orientation: Int): Matrix? {
    val matrix = Matrix()

    when (orientation) {
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL ->
        matrix.setScale(-1f, 1f)
      ExifInterface.ORIENTATION_ROTATE_180 ->
        matrix.setRotate(180f)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> {
        matrix.setRotate(180f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_TRANSPOSE -> {
        matrix.setRotate(90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_90 ->
        matrix.setRotate(90f)
      ExifInterface.ORIENTATION_TRANSVERSE -> {
        matrix.setRotate(-90f)
        matrix.postScale(-1f, 1f)
      }
      ExifInterface.ORIENTATION_ROTATE_270 ->
        matrix.setRotate(-90f)
      else -> return null
    }

    return matrix
  }

  private fun resizeBitmap(
    bitmap: Bitmap,
    resize: ResizeOptions?,
    ownership: AndroidBitmapOwnership
  ): Bitmap {
    if (resize == null) {
      return bitmap
    }

    return when (resize.mode) {
      ResizeMode.CONTAIN -> resizeContain(bitmap, resize, ownership)
      ResizeMode.COVER -> resizeCover(bitmap, resize, ownership)
      ResizeMode.STRETCH -> resizeStretch(bitmap, resize, ownership)
    }
  }

  private fun resizeContain(
    bitmap: Bitmap,
    resize: ResizeOptions,
    ownership: AndroidBitmapOwnership
  ): Bitmap {
    val scale = minOf(
      resize.maxWidth?.let { it.toDouble() / bitmap.width.toDouble() } ?: 1.0,
      resize.maxHeight?.let { it.toDouble() / bitmap.height.toDouble() } ?: 1.0,
      1.0
    )

    return createScaledBitmapIfNeeded(
      bitmap,
      scaledDimension(bitmap.width, scale),
      scaledDimension(bitmap.height, scale),
      ownership
    )
  }

  private fun resizeCover(
    bitmap: Bitmap,
    resize: ResizeOptions,
    ownership: AndroidBitmapOwnership
  ): Bitmap {
    val maxWidth = resize.maxWidth
    val maxHeight = resize.maxHeight

    if (maxWidth == null || maxHeight == null) {
      return resizeContain(bitmap, resize, ownership)
    }

    val targetWidth = maxWidth.coerceAtMost(bitmap.width)
    val targetHeight = maxHeight.coerceAtMost(bitmap.height)
    val scale = minOf(
      maxOf(
        targetWidth.toDouble() / bitmap.width.toDouble(),
        targetHeight.toDouble() / bitmap.height.toDouble()
      ),
      1.0
    )
    val scaled = createScaledBitmapIfNeeded(
      bitmap,
      scaledDimension(bitmap.width, scale),
      scaledDimension(bitmap.height, scale),
      ownership
    )
    val cropped = centerCropBitmap(
      scaled,
      targetWidth.coerceAtMost(scaled.width),
      targetHeight.coerceAtMost(scaled.height),
      ownership
    )

    if (cropped !== scaled && scaled !== bitmap) {
      ownership.release(scaled)
    }

    return cropped
  }

  private fun resizeStretch(
    bitmap: Bitmap,
    resize: ResizeOptions,
    ownership: AndroidBitmapOwnership
  ): Bitmap {
    val targetWidth = resize.maxWidth?.coerceAtMost(bitmap.width) ?: bitmap.width
    val targetHeight = resize.maxHeight?.coerceAtMost(bitmap.height) ?: bitmap.height

    return createScaledBitmapIfNeeded(
      bitmap,
      targetWidth,
      targetHeight,
      ownership
    )
  }

  private fun createScaledBitmapIfNeeded(
    bitmap: Bitmap,
    targetWidth: Int,
    targetHeight: Int,
    ownership: AndroidBitmapOwnership
  ): Bitmap {
    if (bitmap.width == targetWidth && bitmap.height == targetHeight) {
      return bitmap
    }

    return ownership.own(
      Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
    )
  }

  private fun centerCropBitmap(
    bitmap: Bitmap,
    targetWidth: Int,
    targetHeight: Int,
    ownership: AndroidBitmapOwnership
  ): Bitmap {
    if (bitmap.width == targetWidth && bitmap.height == targetHeight) {
      return bitmap
    }

    val x = ((bitmap.width - targetWidth) / 2).coerceAtLeast(0)
    val y = ((bitmap.height - targetHeight) / 2).coerceAtLeast(0)

    return ownership.own(
      Bitmap.createBitmap(bitmap, x, y, targetWidth, targetHeight)
    )
  }

  private fun scaledDimension(value: Int, scale: Double): Int =
    (value.toDouble() * scale).roundToInt().coerceAtLeast(1)
}

internal class AndroidBitmapOwnership(
  private val recycleBitmap: (Bitmap) -> Unit
) : Closeable {
  private val known = identitySet<Bitmap>()
  private val active = identitySet<Bitmap>()
  private val ownershipOrder = mutableListOf<Bitmap>()

  fun own(bitmap: Bitmap): Bitmap {
    if (known.add(bitmap)) {
      active.add(bitmap)
      ownershipOrder += bitmap
    }
    return bitmap
  }

  fun release(bitmap: Bitmap) {
    if (active.remove(bitmap)) {
      recycleBitmap(bitmap)
    }
  }

  override fun close() {
    val remaining = ownershipOrder.asReversed().filter(active::contains)
    active.clear()
    remaining.forEach(recycleBitmap)
  }

  private fun <T> identitySet(): MutableSet<T> =
    Collections.newSetFromMap(IdentityHashMap())
}
