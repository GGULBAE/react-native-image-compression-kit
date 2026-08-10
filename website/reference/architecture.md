# Product architecture

The package keeps a small TypeScript boundary in front of bounded native image
pipelines. Image bytes do not travel through JavaScript: the application passes
a local URI, native code inspects and processes it, and the promise resolves
with a completed cache-file URI and measured result metadata.

## Operation flow

1. TypeScript validates and normalizes the request.
2. A unique operation ID binds `AbortSignal` cancellation to native work.
3. The generated Codegen module, TurboModule, or Legacy `NativeModules` bridge
   resolves the platform implementation.
4. Native code checks the request, source type, dimensions, runtime codec
   capability, and resource limits.
5. Decode-time downsampling, orientation, resize, metadata policy, and encode
   run on bounded background workers.
6. A transactional cache write publishes only a completed result. Failed or
   cancelled work cleans temporary or late output.

Both platforms expose a maximum of two concurrent operations and the same named
source and working-pixel limits. Unsafe work rejects with
`ERR_RESOURCE_LIMIT`; aborts settle with `ERR_CANCELLED`.

## Capability-first behavior

A format appearing in the TypeScript union does not mean every runtime can read
or write it. Android SDK/device codecs and iOS ImageIO source/destination
registries differ, so applications should call
`getImageCompressionCapabilities()` and choose a fallback before compression.
This capability-first rule also applies to support claims in documentation.

This is also why HEIC, HEIF, and AVIF output remains unavailable instead of
being exposed as best effort. New output support must define encoder detection,
decode-back validation, metadata, target-size, cancellation, resource, and
cleanup behavior first.

## Ownership boundary

The package owns validation and native processing for a local URI. The
application owns permissions, image picking, remote downloads, durable storage,
uploads, and cache-file lifecycle after a successful result.

Read the complete
[architecture decision record](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/product-architecture.md)
for platform pipelines, trade-offs, verification ownership, and change rules.
See [capabilities and fallbacks](../guide/capabilities.md) for integration code.
