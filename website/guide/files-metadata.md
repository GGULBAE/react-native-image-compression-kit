# Output files and metadata

> This page tracks the 0.4.1 source candidate.
> `removeCompressionOutput(uri)` is not present in npm 0.4.0.

## Cache-file ownership

Successful compression creates a new local cache file and returns its URI. The
source is not modified.

- Treat the returned URI as temporary.
- Upload, copy, or move an output that must outlive normal cache cleanup.
- Call `removeCompressionOutput(result.uri)` when the application no longer
  needs a package-owned output.
- Do not assume a cache URI survives an OS cleanup, app reinstall, or device
  migration.
- The package does not maintain a global output registry or delete old files on
  your behalf.

```ts
const result = await compressImage(options);

try {
  await upload(result.uri);
} finally {
  await removeCompressionOutput(result.uri);
}
```

The removal API is intentionally narrow: it accepts only the generated output
URI, treats an already-missing output as success, and rejects foreign files,
source files, traversal paths, symlinks, and directories. Copy or move a result
to durable storage before removal when it must outlive the cache.

## Storage-accounting boundary

Measure the storage this application controls rather than claiming that
compression reduces total phone or gallery storage:

```text
app-owned image footprint = durable upload queue + package outputs + caches + residual files
```

The source and a newly encoded output can coexist, so transient storage may
increase during compression. A queue-size reduction applies only when the host
owns a staged source and is allowed to replace or delete it. Gallery sources,
provider-owned content, copied or moved outputs, and other durable application
files remain outside `removeCompressionOutput()`.

See [why device-side bytes matter](./byte-economics.md) for upload and storage
formulas, illustrative scenarios, and metrics that separate device, network,
and backend effects.

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
