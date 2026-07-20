package com.imagecompressionkit

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Future
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadFactory
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class ImageCompressionKitModule(
  private val reactContext: ReactApplicationContext,
  private val writableMapFactory: () -> WritableMap = { Arguments.createMap() },
  private val writableArrayFactory: () -> WritableArray = { Arguments.createArray() },
  private val workerExecutor: ExecutorService = createWorkerExecutor(),
  private val operationObserver: (String, Boolean) -> Unit = { _, _ -> }
) : NativeImageCompressionKitSpec(reactContext) {
  private val imageSourceResolver = AndroidImageSourceResolver(reactContext.contentResolver)
  private val imageDecoder = AndroidImageDecoder(imageSourceResolver)
  private val bitmapTransformer = AndroidBitmapTransformer()
  private val operations = ConcurrentHashMap<String, CompressionOperation>()
  private val cancelledBeforeRegistration = ConcurrentHashMap.newKeySet<String>()
  private val invalidated = AtomicBoolean(false)

  override fun getName(): String = NAME

  override fun compressImage(options: ReadableMap, promise: Promise) {
    val request = try {
      AndroidCompressionRequestParser.parse(options)
    } catch (error: AndroidCompressionRequestException) {
      promise.reject(error.code, error.message ?: "Android compression failed.", error)
      return
    }

    val operation = CompressionOperation(request.operationId, promise)
    if (invalidated.get() || cancelledBeforeRegistration.remove(request.operationId)) {
      operation.cancel()
      return
    }
    if (operations.putIfAbsent(request.operationId, operation) != null) {
      operation.reject(
        ERR_INVALID_OPTIONS,
        "Compression operationId must be unique while an operation is active."
      )
      return
    }

    try {
      operation.future = workerExecutor.submit { executeCompression(request, operation) }
    } catch (error: RejectedExecutionException) {
      operations.remove(request.operationId, operation)
      operation.reject(
        ERR_RESOURCE_LIMIT,
        "The bounded compression queue is full. Retry after an active operation completes.",
        error
      )
    }
  }

  override fun cancelCompression(operationId: String) {
    val operation = operations[operationId]
    if (operation == null) {
      cancelledBeforeRegistration += operationId
      return
    }
    operation.cancel()
    operations.remove(operationId, operation)
    (workerExecutor as? ThreadPoolExecutor)?.purge()
  }

  override fun invalidate() {
    if (invalidated.compareAndSet(false, true)) {
      operations.values.forEach(CompressionOperation::cancel)
      operations.clear()
      cancelledBeforeRegistration.clear()
      workerExecutor.shutdownNow()
    }
    super.invalidate()
  }

  override fun getImageCompressionCapabilities(promise: Promise) {
    promise.resolve(createCapabilities())
  }

  private fun executeCompression(
    request: AndroidCompressionRequest,
    operation: CompressionOperation
  ) {
    var transaction: CompressionOutputTransaction? = null
    var keepPublishedOutput = false

    try {
      operationObserver(request.operationId, true)
      operation.checkCancellation()
      val decodedInput = when (val decodeResult = imageDecoder.decode(
        request.source,
        request.resize,
        operation::checkCancellation
      )) {
        is AndroidImageDecodeResult.Success -> decodeResult
        is AndroidImageDecodeResult.UnsupportedFormat -> throw CompressionFailure(
          ERR_UNSUPPORTED_FORMAT,
          decodeResult.message
        )
        AndroidImageDecodeResult.DecodeFailed -> throw CompressionFailure(
          ERR_DECODE_FAILED,
          "Android could not decode the source image."
        )
      }

      bitmapTransformer.transform(
        decodedInput.bitmap,
        decodedInput.inputInfo.exifOrientation,
        request.resize,
        opaque = request.outputFormat == OutputFormat.JPEG
      ).use { ownedTransformation ->
        operation.checkCancellation()
        val transformed = ownedTransformation.result
        val copiedExifMetadata = if (
          decodedInput.inputInfo.format.supportsJpegExifMetadata &&
          request.outputFormat.supportsJpegExifMetadata
        ) {
          createCopiedExifMetadata(
            request.metadataPolicy,
            request.source,
            transformed.dimensions
          )
        } else {
          null
        }

        operation.checkCancellation()
        transaction = ImageCompressionOutput.createOutputTransaction(
          reactContext.cacheDir,
          request.outputFormat,
          request.operationId
        )
        val didEncode = try {
          ImageCompressionOutput.encodeBitmap(
            transformed.bitmap,
            transaction!!.temporaryFile,
            request.outputFormat,
            request.quality,
            request.maxBytes,
            copiedExifMetadata,
            operation::checkCancellation
          )
        } catch (error: AndroidCompressionCancelledException) {
          throw error
        } catch (error: Exception) {
          throw CompressionFailure(
            ERR_ENCODE_FAILED,
            error.message ?: "Android could not encode the selected output format.",
            error
          )
        }
        if (!didEncode) {
          throw CompressionFailure(
            ERR_ENCODE_FAILED,
            "Android could not encode the selected output format."
          )
        }

        operation.checkCancellation()
        val outputFile = transaction!!.commit()
        operation.checkCancellation()
        val result = createCompressionResult(
          decodedInput.inputInfo.originalByteSize,
          outputFile,
          transformed.dimensions,
          request.outputFormat
        )
        keepPublishedOutput = operation.resolve(result)
      }
    } catch (error: AndroidCompressionCancelledException) {
      operation.reject(ERR_CANCELLED, CANCELLED_MESSAGE)
    } catch (error: AndroidImageResourceLimitException) {
      operation.reject(ERR_RESOURCE_LIMIT, error.message ?: RESOURCE_LIMIT_MESSAGE, error)
    } catch (error: OutOfMemoryError) {
      operation.reject(ERR_RESOURCE_LIMIT, RESOURCE_LIMIT_MESSAGE, error)
    } catch (error: AndroidImageSourceAccessException) {
      operation.reject(
        ERR_FILE_ACCESS,
        error.message ?: "Android could not read the source image URI.",
        error
      )
    } catch (error: MetadataCopyException) {
      operation.reject(ERR_ENCODE_FAILED, error.message ?: "Android could not copy JPEG metadata.", error)
    } catch (error: CompressionFailure) {
      operation.reject(error.code, error.message ?: "Android compression failed.", error.cause)
    } catch (error: Exception) {
      operation.reject(ERR_NATIVE_OPERATION_FAILED, "Android compression failed.", error)
    } finally {
      transaction?.cleanup(deleteCommittedOutput = !keepPublishedOutput)
      operations.remove(request.operationId, operation)
      operationObserver(request.operationId, false)
    }
  }

  private fun createCapabilities(): WritableMap = writableMapFactory().apply {
    putString("platform", "android")
    putArray("formats", createFormatCapabilities())
    putArray("metadataPolicies", createMetadataPolicies())
    putBoolean("supportsTargetSizeCompression", true)
    putBoolean("supportsCancellation", true)
    putInt("maxConcurrentOperations", ANDROID_MAX_CONCURRENT_OPERATIONS)
    putBoolean("supportsDecodeDownsampling", true)
    putMap("resourceLimits", writableMapFactory().apply {
      putInt("maxSourceDimension", ANDROID_MAX_SOURCE_DIMENSION)
      putDouble("maxSourcePixels", ANDROID_MAX_SOURCE_PIXELS.toDouble())
      putDouble("maxWorkingPixels", ANDROID_MAX_WORKING_PIXELS.toDouble())
    })
  }

  private fun createFormatCapabilities(): WritableArray = writableArrayFactory().apply {
    ImageCompressionOutput.FORMAT_VALUES.forEach { format ->
      val capability = ImageCompressionOutput.createFormatCapability(format)
      pushMap(writableMapFactory().apply {
        putString("format", capability.format)
        putBoolean("input", capability.input)
        putBoolean("output", capability.output)
        putBoolean("supportsAlpha", capability.supportsAlpha)
        putBoolean("supportsAnimation", capability.supportsAnimation)
        putArray("notes", writableArrayFactory().apply {
          capability.notes.forEach(::pushString)
        })
      })
    }
  }

  private fun createMetadataPolicies(): WritableArray = writableArrayFactory().apply {
    pushString(METADATA_POLICY_PRESERVE)
    pushString(METADATA_POLICY_SAFE)
    pushString(METADATA_POLICY_STRIP)
  }

  private fun createCopiedExifMetadata(
    metadataPolicy: MetadataPolicy,
    inputSource: AndroidCompressionSource,
    dimensions: AndroidBitmapDimensions
  ): CopiedExifMetadata? {
    val exifTags = when (metadataPolicy) {
      MetadataPolicy.PRESERVE -> JpegExifMetadata.PRESERVED_EXIF_TAGS
      MetadataPolicy.SAFE -> JpegExifMetadata.SAFE_EXIF_TAGS
      MetadataPolicy.STRIP -> return null
    }
    try {
      imageSourceResolver.openInputStream(inputSource).buffered().use { inputStream ->
        return JpegExifMetadata.read(inputStream, exifTags, dimensions.width, dimensions.height)
      }
    } catch (error: Exception) {
      throw MetadataCopyException("Android could not read source EXIF metadata.", error)
    }
  }

  private fun createCompressionResult(
    originalByteSize: Long,
    outputFile: File,
    dimensions: AndroidBitmapDimensions,
    outputFormat: OutputFormat
  ): WritableMap {
    val result = ImageCompressionOutput.createResultMetadata(
      originalByteSize,
      outputFile,
      CompressionOutputDimensions(dimensions.width, dimensions.height),
      outputFormat
    )
    return writableMapFactory().apply {
      putString("uri", result.uri)
      putString("format", result.format)
      putInt("width", result.width)
      putInt("height", result.height)
      putDouble("byteSize", result.byteSize.toDouble())
      putDouble("originalByteSize", result.originalByteSize.toDouble())
      putDouble("compressionRatio", result.compressionRatio)
    }
  }

  private class CompressionOperation(
    val id: String,
    private val promise: Promise
  ) {
    private val cancelled = AtomicBoolean(false)
    private val settled = AtomicBoolean(false)
    @Volatile var future: Future<*>? = null
      set(value) {
        field = value
        if (cancelled.get()) value?.cancel(true)
      }

    fun checkCancellation() {
      if (cancelled.get() || Thread.currentThread().isInterrupted) {
        throw AndroidCompressionCancelledException()
      }
    }

    fun cancel() {
      if (settled.get()) return
      cancelled.set(true)
      future?.cancel(true)
      reject(ERR_CANCELLED, CANCELLED_MESSAGE)
    }

    fun resolve(value: WritableMap): Boolean {
      if (cancelled.get()) return false
      if (!settled.compareAndSet(false, true)) return false
      promise.resolve(value)
      return true
    }

    fun reject(code: String, message: String, throwable: Throwable? = null): Boolean {
      if (!settled.compareAndSet(false, true)) return false
      promise.reject(code, message, throwable)
      return true
    }
  }

  private class AndroidCompressionCancelledException : RuntimeException()
  private class CompressionFailure(val code: String, message: String, cause: Throwable? = null) :
    Exception(message, cause)
  private class MetadataCopyException(message: String, cause: Throwable? = null) :
    Exception(message, cause)

  companion object {
    const val NAME = "ImageCompressionKit"
    const val ERR_INVALID_OPTIONS = ANDROID_ERR_INVALID_OPTIONS
    const val ERR_UNSUPPORTED_SOURCE = ANDROID_ERR_UNSUPPORTED_SOURCE
    const val ERR_UNSUPPORTED_FORMAT = "ERR_UNSUPPORTED_FORMAT"
    const val ERR_NOT_IMPLEMENTED = ANDROID_ERR_NOT_IMPLEMENTED
    const val ERR_FILE_ACCESS = "ERR_FILE_ACCESS"
    const val ERR_DECODE_FAILED = "ERR_DECODE_FAILED"
    const val ERR_ENCODE_FAILED = "ERR_ENCODE_FAILED"
    const val ERR_RESOURCE_LIMIT = ANDROID_ERR_RESOURCE_LIMIT
    const val ERR_CANCELLED = ANDROID_ERR_CANCELLED
    const val ERR_NATIVE_OPERATION_FAILED = ANDROID_ERR_NATIVE_OPERATION_FAILED
    private const val MAX_QUEUED_OPERATIONS = 64
    private const val CANCELLED_MESSAGE = "Image compression was cancelled."
    private const val RESOURCE_LIMIT_MESSAGE =
      "Image compression exceeded the configured memory resource limit."

    internal fun createWorkerExecutor(): ExecutorService {
      val sequence = AtomicInteger(0)
      val threadFactory = ThreadFactory { runnable ->
        Thread(runnable, "ImageCompressionKit-${sequence.incrementAndGet()}").apply {
          isDaemon = true
        }
      }
      return ThreadPoolExecutor(
        ANDROID_MAX_CONCURRENT_OPERATIONS,
        ANDROID_MAX_CONCURRENT_OPERATIONS,
        0L,
        TimeUnit.MILLISECONDS,
        ArrayBlockingQueue(MAX_QUEUED_OPERATIONS),
        threadFactory,
        ThreadPoolExecutor.AbortPolicy()
      )
    }
  }
}
