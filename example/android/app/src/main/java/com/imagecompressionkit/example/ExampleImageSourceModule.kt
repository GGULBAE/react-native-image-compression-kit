package com.imagecompressionkit.example

import android.net.Uri
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class ExampleImageSourceModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "ExampleImageSource"

  @ReactMethod
  fun copySampleJpegToCache(promise: Promise) {
    try {
      val outputDir = File(reactContext.cacheDir, "image-compression-kit-example")

      if (!outputDir.exists() && !outputDir.mkdirs()) {
        promise.reject(
          "ERR_SAMPLE_FILE_ACCESS",
          "Could not create sample image cache directory."
        )
        return
      }

      val outputFile = File(outputDir, "sample.jpg")

      reactContext.assets.open("sample.jpg").use { input ->
        outputFile.outputStream().use { output ->
          input.copyTo(output)
        }
      }

      promise.resolve(Uri.fromFile(outputFile).toString())
    } catch (error: Exception) {
      promise.reject(
        "ERR_SAMPLE_FILE_ACCESS",
        error.message ?: "Could not prepare bundled sample JPEG.",
        error
      )
    }
  }
}
