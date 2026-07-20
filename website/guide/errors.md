# Errors and troubleshooting

```ts
import {
  compressImage,
  ImageCompressionKitError,
  type ImageCompressionKitErrorCode,
} from 'react-native-image-compression-kit';

try {
  await compressImage(options);
} catch (error) {
  if (error instanceof ImageCompressionKitError) {
    const code: ImageCompressionKitErrorCode = error.code;
    console.warn(code, error.message);
  }
}
```

| Code | Typical cause | Recovery |
| --- | --- | --- |
| `ERR_INVALID_OPTIONS` | Invalid quality, size, format, resize, or metadata value | Validate application input before retrying. |
| `ERR_UNSUPPORTED_SOURCE` | Remote/data URI or unreadable URI kind | Materialize a local readable file or picker URI. |
| `ERR_UNSUPPORTED_FORMAT` | Runtime cannot decode or encode the selected format | Query capabilities and choose a fallback. |
| `ERR_NATIVE_MODULE_UNAVAILABLE` | Native app was not rebuilt after install | Reinstall pods if needed and rebuild the binary. |
| `ERR_NOT_IMPLEMENTED` | Requested output or behavior is intentionally unavailable | Use a documented supported output. |
| `ERR_FILE_ACCESS` | Permission, security scope, or cache write failure | Keep URI access alive and verify available storage. |
| `ERR_DECODE_FAILED` | Corrupt, incomplete, or unsupported input bytes | Validate or re-materialize the source image. |
| `ERR_ENCODE_FAILED` | Runtime encoder failed | Check capabilities, target size, and output format. |
| `ERR_RESOURCE_LIMIT` | Source dimensions/pixels or required decoded work exceed the native limit | Add smaller resize bounds or reject the source before retrying. |
| `ERR_CANCELLED` | The optional abort control cancelled queued or running work | Treat as an expected user-flow outcome; retry only with a new request. |
| `ERR_NATIVE_OPERATION_FAILED` | Unclassified native failure | Record sanitized context and open a reproducible bug. |

## Cancellation

Cancellation is settle-once on both platforms. Native code checks between
decode, transform, target-size quality probes, encode, and output publication.
Cancelled and failed operations remove operation-specific temporary files.

## Native module unavailable

Metro reloads JavaScript but cannot add native code. Stop the application,
clean when necessary, install iOS pods, and rebuild Android or iOS.

## A picker URI stops working

Compress before the picker revokes temporary access. On Android, keep any
persistable permission or copy the content URI into application storage. On
iOS, request a materialized file URL from the picker.

## Target size is not reached

The target is not a promise that every source can satisfy. Add resize bounds,
choose JPEG/WebP, lower the quality ceiling, or accept the smallest generated
result and enforce an application-level rejection threshold.

For support routing, see the repository [support policy](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/SUPPORT.md).
