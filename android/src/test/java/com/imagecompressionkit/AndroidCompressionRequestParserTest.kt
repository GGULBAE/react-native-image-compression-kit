package com.imagecompressionkit

import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AndroidCompressionRequestParserTest {
  @Test
  fun parsesDefaultsIntoImmutableTypedRequest() {
    val request = AndroidCompressionRequestParser.parse(validOptions())

    assertTrue(request.source is AndroidCompressionSource.FileSource)
    assertEquals("file:///tmp/input.jpg", request.source.uri.toString())
    assertEquals(OutputFormat.JPEG, request.outputFormat)
    assertEquals(80, request.quality)
    assertNull(request.maxBytes)
    assertEquals(MetadataPolicy.SAFE, request.metadataPolicy)
    assertNull(request.resize)
  }

  @Test
  fun parsesExplicitValuesAndSupportedUriSchemes() {
    val request = AndroidCompressionRequestParser.parse(
      options(
        source = JavaOnlyMap.of("uri", "content://images/42"),
        output = JavaOnlyMap.of(
          "format",
          "webp",
          "quality",
          73,
          "maxBytes",
          4096
        ),
        metadata = "preserve",
        resize = JavaOnlyMap.of(
          "maxWidth",
          640,
          "maxHeight",
          480,
          "mode",
          "cover"
        )
      )
    )

    assertTrue(request.source is AndroidCompressionSource.ContentSource)
    assertEquals("content://images/42", request.source.uri.toString())
    assertEquals(OutputFormat.WEBP, request.outputFormat)
    assertEquals(73, request.quality)
    assertEquals(4096L, request.maxBytes)
    assertEquals(MetadataPolicy.PRESERVE, request.metadataPolicy)
    assertEquals(
      ResizeOptions(640, 480, ResizeMode.COVER),
      request.resize
    )
  }

  @Test
  fun keepsQualityAndIntegerBoundaries() {
    val qualityCases = listOf(
      -1.0 to 0,
      0.0 to 0,
      72.9 to 72,
      100.0 to 100,
      101.0 to 100
    )

    qualityCases.forEach { (quality, expected) ->
      val request = AndroidCompressionRequestParser.parse(
        options(
          output = JavaOnlyMap.of(
            "format",
            "jpeg",
            "quality",
            quality,
            "maxBytes",
            1.0
          ),
          resize = JavaOnlyMap.of(
            "maxWidth",
            1.0,
            "maxHeight",
            Int.MAX_VALUE.toDouble()
          )
        )
      )

      assertEquals(expected, request.quality)
      assertEquals(1L, request.maxBytes)
      assertEquals(1, request.resize?.maxWidth)
      assertEquals(Int.MAX_VALUE, request.resize?.maxHeight)
      assertEquals(ResizeMode.CONTAIN, request.resize?.mode)
    }

    val maxSafeRequest = AndroidCompressionRequestParser.parse(
      options(
        output = JavaOnlyMap.of(
          "format",
          "jpeg",
          "maxBytes",
          9007199254740991.0
        )
      )
    )
    assertEquals(9007199254740991L, maxSafeRequest.maxBytes)
  }

  @Test
  fun rejectsInvalidValuesWithStableErrorContracts() {
    val cases = listOf(
      FailureCase(
        "missing source",
        { JavaOnlyMap.of("output", validOutput()) },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression options must include source and output objects."
      ),
      FailureCase(
        "missing output format",
        { options(output = JavaOnlyMap()) },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression output.format must be one of: jpeg, png, webp, heic, heif, avif."
      ),
      FailureCase(
        "unsupported output",
        { options(output = JavaOnlyMap.of("format", "heic")) },
        ANDROID_ERR_NOT_IMPLEMENTED,
        ImageCompressionOutput.UNSUPPORTED_OUTPUT_FORMAT_MESSAGE
      ),
      FailureCase(
        "AVIF output",
        { options(output = JavaOnlyMap.of("format", "avif")) },
        ANDROID_ERR_NOT_IMPLEMENTED,
        AndroidAvifOutputPrototype.PRODUCTION_WIRING_NOT_IMPLEMENTED_MESSAGE
      ),
      FailureCase(
        "PNG target size",
        {
          options(
            output = JavaOnlyMap.of(
              "format",
              "png",
              "maxBytes",
              1
            )
          )
        },
        ANDROID_ERR_INVALID_OPTIONS,
        ImageCompressionOutput.MAX_BYTES_UNSUPPORTED_MESSAGE
      ),
      FailureCase(
        "invalid metadata",
        { options(metadata = "private") },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression metadata must be one of: preserve, safe, strip."
      ),
      FailureCase(
        "zero maxBytes",
        { options(output = JavaOnlyMap.of("format", "jpeg", "maxBytes", 0)) },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression output.maxBytes must be a positive integer."
      ),
      FailureCase(
        "fractional maxBytes",
        { options(output = JavaOnlyMap.of("format", "jpeg", "maxBytes", 1.5)) },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression output.maxBytes must be a positive integer."
      ),
      FailureCase(
        "maxBytes above safe integer",
        {
          options(
            output = JavaOnlyMap.of(
              "format",
              "jpeg",
              "maxBytes",
              9007199254740992.0
            )
          )
        },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression output.maxBytes must be a positive integer."
      ),
      FailureCase(
        "empty resize",
        { options(resize = JavaOnlyMap()) },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression resize must include maxWidth, maxHeight, or both."
      ),
      FailureCase(
        "invalid resize width",
        { options(resize = JavaOnlyMap.of("maxWidth", 0)) },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression resize.maxWidth must be a positive integer."
      ),
      FailureCase(
        "invalid resize mode",
        { options(resize = JavaOnlyMap.of("maxWidth", 1, "mode", "fill")) },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression resize.mode must be one of: contain, cover, stretch."
      ),
      FailureCase(
        "blank source URI",
        { options(source = JavaOnlyMap.of("uri", " ")) },
        ANDROID_ERR_INVALID_OPTIONS,
        "Compression source.uri must be a non-empty string."
      ),
      FailureCase(
        "unsupported source URI",
        { options(source = JavaOnlyMap.of("uri", "https://example.com/input.jpg")) },
        ANDROID_ERR_UNSUPPORTED_SOURCE,
        "Android MVP supports file:// and content:// image URIs only."
      )
    )

    cases.forEach { case ->
      val failure = parseFailure(case.options())
      assertEquals(case.name, case.code, failure.code)
      assertEquals(case.name, case.message, failure.message)
    }
  }

  @Test
  fun mapsMalformedReadableMapTypesToStableNativeFailure() {
    val nativeFailureCases = listOf(
      { options(source = "file:///tmp/input.jpg") },
      { options(output = "jpeg") },
      { options(source = JavaOnlyMap.of("uri", 42)) },
      { options(output = JavaOnlyMap.of("format", "jpeg", "quality", "high")) },
      { options(resize = "contain") },
      { options(resize = JavaOnlyMap.of("maxWidth", 1, "mode", 42)) }
    )

    nativeFailureCases.forEach { optionsFactory ->
      val failure = parseFailure(optionsFactory())
      assertEquals(ANDROID_ERR_NATIVE_OPERATION_FAILED, failure.code)
      assertEquals("Android MVP compression failed.", failure.message)
      assertTrue(failure.cause != null)
    }

    val invalidOptionTypeCases = listOf(
      options(output = JavaOnlyMap.of("format", 42)),
      options(metadata = 42),
      options(output = JavaOnlyMap.of("format", "jpeg", "maxBytes", "small")),
      options(resize = JavaOnlyMap.of("maxWidth", "wide"))
    )

    invalidOptionTypeCases.forEach { malformedOptions ->
      val failure = parseFailure(malformedOptions)
      assertEquals(ANDROID_ERR_INVALID_OPTIONS, failure.code)
      assertTrue(failure.cause != null)
    }
  }

  private fun parseFailure(options: JavaOnlyMap): AndroidCompressionRequestException =
    try {
      AndroidCompressionRequestParser.parse(options)
      fail("Expected request parsing to fail.")
      throw AssertionError("unreachable")
    } catch (error: AndroidCompressionRequestException) {
      error
    }

  private fun validOptions(): JavaOnlyMap = options()

  private fun validOutput(): JavaOnlyMap = JavaOnlyMap.of("format", "jpeg")

  private fun options(
    source: Any = JavaOnlyMap.of("uri", "file:///tmp/input.jpg"),
    output: Any = validOutput(),
    metadata: Any = "safe",
    resize: Any? = MISSING
  ): JavaOnlyMap {
    val values = mutableListOf<Any>(
      "source",
      source,
      "output",
      output,
      "metadata",
      metadata
    )
    if (resize !== MISSING) {
      values += "resize"
      values += resize ?: error("resize test value must not be null")
    }
    return JavaOnlyMap.of(*values.toTypedArray())
  }

  private data class FailureCase(
    val name: String,
    val options: () -> JavaOnlyMap,
    val code: String,
    val message: String
  )

  private object MISSING
}
