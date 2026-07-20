package com.imagecompressionkit

import androidx.exifinterface.media.ExifInterface
import kotlin.math.ceil
import kotlin.math.roundToInt

internal const val ANDROID_MAX_SOURCE_DIMENSION = 32_768
internal const val ANDROID_MAX_SOURCE_PIXELS = 100_000_000L
internal const val ANDROID_MAX_WORKING_PIXELS = 25_000_000L
internal const val ANDROID_MAX_CONCURRENT_OPERATIONS = 2
internal const val ANDROID_ERR_RESOURCE_LIMIT = "ERR_RESOURCE_LIMIT"
internal const val ANDROID_ERR_CANCELLED = "ERR_CANCELLED"

internal class AndroidImageResourceLimitException(message: String) : Exception(message)

internal data class AndroidDecodePlan(
  val sourceBounds: AndroidImageBounds,
  val orientedWidth: Int,
  val orientedHeight: Int,
  val decodeWidth: Int,
  val decodeHeight: Int,
  val inSampleSize: Int
)

internal object AndroidImageResourcePolicy {
  fun createDecodePlan(
    bounds: AndroidImageBounds,
    exifOrientation: Int,
    resize: ResizeOptions?
  ): AndroidDecodePlan {
    validateSource(bounds)

    val swapsAxes = exifOrientation in setOf(
      ExifInterface.ORIENTATION_TRANSPOSE,
      ExifInterface.ORIENTATION_ROTATE_90,
      ExifInterface.ORIENTATION_TRANSVERSE,
      ExifInterface.ORIENTATION_ROTATE_270
    )
    val orientedWidth = if (swapsAxes) bounds.height else bounds.width
    val orientedHeight = if (swapsAxes) bounds.width else bounds.height
    val decodeOriented = requiredDecodeDimensions(
      orientedWidth,
      orientedHeight,
      resize
    )
    validateWorkingPixels(decodeOriented)

    val decodeWidth = if (swapsAxes) decodeOriented.height else decodeOriented.width
    val decodeHeight = if (swapsAxes) decodeOriented.width else decodeOriented.height
    var sampleSize = 1
    while (
      bounds.width / (sampleSize * 2) >= decodeWidth &&
      bounds.height / (sampleSize * 2) >= decodeHeight
    ) {
      sampleSize *= 2
    }

    return AndroidDecodePlan(
      sourceBounds = bounds,
      orientedWidth = orientedWidth,
      orientedHeight = orientedHeight,
      decodeWidth = decodeWidth,
      decodeHeight = decodeHeight,
      inSampleSize = sampleSize
    )
  }

  fun validateBitmapFactoryDecode(plan: AndroidDecodePlan) {
    val sampledWidth = ceilDivide(plan.sourceBounds.width, plan.inSampleSize)
    val sampledHeight = ceilDivide(plan.sourceBounds.height, plan.inSampleSize)
    val sampledPixels = sampledWidth.toLong() * sampledHeight.toLong()
    if (sampledPixels > ANDROID_MAX_WORKING_PIXELS) {
      throw AndroidImageResourceLimitException(
        "The nearest safe BitmapFactory sample would decode ${sampledPixels} pixels, " +
          "above the ${ANDROID_MAX_WORKING_PIXELS}-pixel working limit. " +
          "Provide smaller resize dimensions."
      )
    }
  }

  private fun validateSource(bounds: AndroidImageBounds) {
    if (
      bounds.width <= 0 ||
      bounds.height <= 0 ||
      bounds.width > ANDROID_MAX_SOURCE_DIMENSION ||
      bounds.height > ANDROID_MAX_SOURCE_DIMENSION
    ) {
      throw AndroidImageResourceLimitException(
        "Source image dimensions exceed the supported limit of " +
          "${ANDROID_MAX_SOURCE_DIMENSION}px per axis."
      )
    }

    val sourcePixels = bounds.width.toLong() * bounds.height.toLong()
    if (sourcePixels > ANDROID_MAX_SOURCE_PIXELS) {
      throw AndroidImageResourceLimitException(
        "Source image exceeds the ${ANDROID_MAX_SOURCE_PIXELS}-pixel limit."
      )
    }
  }

  private fun validateWorkingPixels(dimensions: AndroidBitmapDimensions) {
    val workingPixels = dimensions.width.toLong() * dimensions.height.toLong()
    if (workingPixels > ANDROID_MAX_WORKING_PIXELS) {
      throw AndroidImageResourceLimitException(
        "Requested image work exceeds the ${ANDROID_MAX_WORKING_PIXELS}-pixel limit. " +
          "Provide smaller resize dimensions."
      )
    }
  }

  private fun requiredDecodeDimensions(
    width: Int,
    height: Int,
    resize: ResizeOptions?
  ): AndroidBitmapDimensions {
    if (resize == null) {
      return AndroidBitmapDimensions(width, height)
    }

    if (
      resize.mode == ResizeMode.COVER &&
      resize.maxWidth != null &&
      resize.maxHeight != null
    ) {
      val targetWidth = resize.maxWidth.coerceAtMost(width)
      val targetHeight = resize.maxHeight.coerceAtMost(height)
      val scale = minOf(
        maxOf(
          targetWidth.toDouble() / width.toDouble(),
          targetHeight.toDouble() / height.toDouble()
        ),
        1.0
      )
      return AndroidBitmapDimensions(
        ceil(width * scale).toInt().coerceAtLeast(targetWidth),
        ceil(height * scale).toInt().coerceAtLeast(targetHeight)
      )
    }

    if (resize.mode == ResizeMode.STRETCH) {
      return AndroidBitmapDimensions(
        resize.maxWidth?.coerceAtMost(width) ?: width,
        resize.maxHeight?.coerceAtMost(height) ?: height
      )
    }

    val scale = minOf(
      resize.maxWidth?.let { it.toDouble() / width.toDouble() } ?: 1.0,
      resize.maxHeight?.let { it.toDouble() / height.toDouble() } ?: 1.0,
      1.0
    )
    return AndroidBitmapDimensions(
      (width * scale).roundToInt().coerceAtLeast(1),
      (height * scale).roundToInt().coerceAtLeast(1)
    )
  }

  private fun ceilDivide(value: Int, divisor: Int): Int =
    (value + divisor - 1) / divisor
}
