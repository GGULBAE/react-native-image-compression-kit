package com.imagecompressionkit.example

import android.graphics.BitmapFactory
import android.net.Uri
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import android.system.StructStat
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.security.MessageDigest

class ExampleImageSourceModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "ExampleImageSource"

  @ReactMethod
  fun isDemoCaptureEnabled(promise: Promise) {
    val enabled = reactContext.getCurrentActivity()
      ?.intent
      ?.getBooleanExtra("rnick-demo-capture", false) == true
    promise.resolve(enabled)
  }

  @ReactMethod
  fun getReactNativeArchitecture(promise: Promise) {
    promise.resolve(if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) "new" else "legacy")
  }

  @ReactMethod
  fun logSmokeEvent(message: String, promise: Promise) {
    Log.i("RNICK_DEMO", message)
    promise.resolve(null)
  }

  @ReactMethod
  fun copySampleJpegToCache(promise: Promise) {
    copyAssetToCache("sample.jpg", "sample.jpg", promise)
  }

  @ReactMethod
  fun copyEconomicResilienceJpegToCache(promise: Promise) {
    copyAssetToCache(
      "kit-only-12mp-v1.jpg",
      "kit-only-12mp-v1.jpg",
      promise
    )
  }

  @ReactMethod
  fun inspectEvidenceImage(uri: String, promise: Promise) {
    try {
      val file = resolveCacheFile(uri)
      if (!file.exists()) {
        promise.resolve(Arguments.createMap().apply {
          putBoolean("exists", false)
          putDouble("byteSize", 0.0)
        })
        return
      }
      if (!isRegularNonSymlink(file)) {
        throw IllegalArgumentException("Evidence image URI must reference a regular file.")
      }

      val decodeBounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(file.absolutePath, decodeBounds)
      if (
        decodeBounds.outMimeType != "image/jpeg" ||
        decodeBounds.outWidth <= 0 ||
        decodeBounds.outHeight <= 0
      ) {
        throw IllegalArgumentException("Evidence image must be a decodable JPEG.")
      }

      promise.resolve(Arguments.createMap().apply {
        putBoolean("exists", true)
        putDouble("byteSize", file.length().toDouble())
        putString("sha256", sha256(file))
        putString("mediaType", decodeBounds.outMimeType)
        putInt("width", decodeBounds.outWidth)
        putInt("height", decodeBounds.outHeight)
      })
    } catch (error: Exception) {
      promise.reject(
        "ERR_EVIDENCE_FILE_ACCESS",
        error.message ?: "Could not inspect the evidence image.",
        error
      )
    }
  }

  @ReactMethod
  fun copyEconomicResilienceOutputForEvidence(uri: String, promise: Promise) {
    try {
      val source = resolveCacheFile(uri)
      if (!isRegularNonSymlink(source)) {
        throw IllegalArgumentException("Representative output must be a regular file.")
      }
      val outputDir = evidenceCacheDirectory()
      val outputFile = File(outputDir, "kit-only-12mp-v1-output.jpg")
      removeExistingRegularDestination(outputFile)
      writeAtomicRegularFile(outputDir, outputFile) { temporary ->
        source.inputStream().use { input ->
          temporary.outputStream().use { output -> input.copyTo(output) }
        }
      }
      promise.resolve(Uri.fromFile(outputFile).toString())
    } catch (error: Exception) {
      promise.reject(
        "ERR_EVIDENCE_FILE_ACCESS",
        error.message ?: "Could not preserve the representative evidence output.",
        error
      )
    }
  }

  private fun copyAssetToCache(assetName: String, outputName: String, promise: Promise) {
    try {
      val outputDir = evidenceCacheDirectory()
      val outputFile = File(outputDir, outputName)
      removeExistingRegularDestination(outputFile)

      writeAtomicRegularFile(outputDir, outputFile) { temporary ->
        reactContext.assets.open(assetName).use { input ->
          temporary.outputStream().use { output -> input.copyTo(output) }
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

  private fun evidenceCacheDirectory(): File {
    val cacheRoot = reactContext.cacheDir.canonicalFile
    val outputDir = File(cacheRoot, "image-compression-kit-example").absoluteFile
    if (lstatOrNull(outputDir) == null && !outputDir.mkdir()) {
      throw IllegalStateException("Could not create sample image cache directory.")
    }
    val canonicalOutputDir = outputDir.canonicalFile
    val status = lstatOrNull(outputDir)
    if (
      canonicalOutputDir.path != outputDir.path ||
      canonicalOutputDir.parentFile != cacheRoot ||
      status == null ||
      !OsConstants.S_ISDIR(status.st_mode)
    ) {
      throw IllegalStateException("Sample image cache directory must not be linked.")
    }
    return canonicalOutputDir
  }

  private fun resolveCacheFile(uriValue: String): File {
    val uri = Uri.parse(uriValue)
    if (
      uri.scheme != "file" ||
      uri.isOpaque ||
      !uri.authority.isNullOrEmpty() ||
      uri.query != null ||
      uri.fragment != null ||
      uri.path.isNullOrBlank()
    ) {
      throw IllegalArgumentException("Evidence image URI must use file://.")
    }
    val cacheRoot = reactContext.cacheDir.canonicalFile
    val requestedFile = File(requireNotNull(uri.path)).absoluteFile
    val file = requestedFile.canonicalFile
    val cachePrefix = cacheRoot.path + File.separator
    val requestedStatus = lstatOrNull(requestedFile)
    if (
      (requestedStatus != null && !OsConstants.S_ISREG(requestedStatus.st_mode)) ||
      !file.path.startsWith(cachePrefix)
    ) {
      throw IllegalArgumentException("Evidence image URI must stay inside the app cache.")
    }
    return file
  }

  private fun removeExistingRegularDestination(file: File) {
    val status = lstatOrNull(file) ?: return
    if (!OsConstants.S_ISREG(status.st_mode) || !file.delete()) {
      throw IllegalStateException("Evidence destination must be a removable regular file.")
    }
  }

  private fun writeAtomicRegularFile(
    directory: File,
    destination: File,
    write: (File) -> Unit
  ) {
    val temporary = File.createTempFile(".rnick-evidence-", ".tmp", directory)
    try {
      if (!isRegularNonSymlink(temporary)) {
        throw IllegalStateException("Evidence temporary file must be regular.")
      }
      write(temporary)
      if (!isRegularNonSymlink(temporary)) {
        throw IllegalStateException("Evidence temporary file changed during write.")
      }
      Os.rename(temporary.absolutePath, destination.absolutePath)
      if (!isRegularNonSymlink(destination)) {
        throw IllegalStateException("Evidence destination must remain a regular file.")
      }
    } finally {
      if (lstatOrNull(temporary)?.let { OsConstants.S_ISREG(it.st_mode) } == true) {
        temporary.delete()
      }
    }
  }

  private fun isRegularNonSymlink(file: File): Boolean {
    val status = lstatOrNull(file) ?: return false
    return OsConstants.S_ISREG(status.st_mode)
  }

  private fun lstatOrNull(file: File): StructStat? {
    return try {
      Os.lstat(file.absolutePath)
    } catch (error: ErrnoException) {
      if (error.errno == OsConstants.ENOENT) null else throw error
    }
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered().use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      while (true) {
        val read = input.read(buffer)
        if (read < 0) break
        if (read > 0) digest.update(buffer, 0, read)
      }
    }
    return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
  }
}
