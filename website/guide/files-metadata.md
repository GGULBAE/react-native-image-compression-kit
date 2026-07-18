# Output files and metadata

## Cache-file ownership

Successful compression creates a new local cache file and returns its URI. The
source is not modified.

- Treat the returned URI as temporary.
- Upload, copy, or move an output that must outlive normal cache cleanup.
- Delete outputs when the application no longer needs them.
- Do not assume a cache URI survives an OS cleanup, app reinstall, or device
  migration.
- The package does not maintain a global output registry or delete old files on
  your behalf.

## Metadata policies

| Policy | Behavior |
| --- | --- |
| `safe` | Default. Avoids forwarding privacy-sensitive source metadata. Android copies a filtered JPEG EXIF allowlist; iOS re-encodes without source metadata. |
| `strip` | Re-encodes without copying source metadata. |
| `preserve` | Supported only for JPEG source to JPEG output. Orientation is rendered into pixels and normalized. |

The application remains responsible for its own consent, retention, upload,
and privacy disclosures. Verify output metadata if legal or product policy
requires stronger guarantees than the package contract.

## Byte metrics

- `originalByteSize` is the native-readable source byte count.
- `byteSize` is the encoded output byte count.
- `compressionRatio` is `byteSize / originalByteSize`.

Pixel dimensions and byte size answer different questions; resizing can reduce
both, while a format-only conversion may produce a larger output.
