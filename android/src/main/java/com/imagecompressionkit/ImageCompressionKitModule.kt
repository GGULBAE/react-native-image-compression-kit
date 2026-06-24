package com.imagecompressionkit

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

class ImageCompressionKitModule(
  reactContext: ReactApplicationContext
) : NativeImageCompressionKitSpec(reactContext) {
  override fun getName(): String = NAME

  override fun compressImage(options: ReadableMap, promise: Promise) {
    promise.reject(
      ERR_NOT_IMPLEMENTED,
      "Image compression is not implemented in the Android native stub yet."
    )
  }

  override fun getImageCompressionCapabilities(promise: Promise) {
    promise.resolve(createStubCapabilities())
  }

  private fun createStubCapabilities(): WritableMap =
    Arguments.createMap().apply {
      putString("platform", "android")
      putArray("formats", createFormatCapabilities())
      putArray("metadataPolicies", createMetadataPolicies())
      putBoolean("supportsTargetSizeCompression", false)
      putBoolean("supportsCancellation", false)
    }

  private fun createFormatCapabilities(): WritableArray =
    Arguments.createArray().apply {
      FORMATS.forEach { format ->
        pushMap(createUnavailableFormatCapability(format))
      }
    }

  private fun createUnavailableFormatCapability(format: String): WritableMap =
    Arguments.createMap().apply {
      putString("format", format)
      putBoolean("input", false)
      putBoolean("output", false)
      putBoolean("supportsAlpha", false)
      putBoolean("supportsAnimation", false)
      putArray("notes", createNotImplementedNotes())
    }

  private fun createMetadataPolicies(): WritableArray =
    Arguments.createArray().apply {
      pushString("preserve")
      pushString("safe")
      pushString("strip")
    }

  private fun createNotImplementedNotes(): WritableArray =
    Arguments.createArray().apply {
      pushString("Native codec support has not been implemented yet.")
    }

  companion object {
    const val NAME = "ImageCompressionKit"
    const val ERR_NOT_IMPLEMENTED = "ERR_NOT_IMPLEMENTED"

    private val FORMATS = arrayOf(
      "jpeg",
      "png",
      "webp",
      "heic",
      "heif",
      "avif",
      "gif"
    )
  }
}
