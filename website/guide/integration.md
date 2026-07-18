# Image picker integration

`compressImage` accepts a local native-readable URI. It does not download
remote images and does not decode inline data URIs.

## Pass through a picker URI

Most native gallery and camera libraries return an asset with a local `uri`.
Check that value before calling the compressor:

```ts
import { compressImage } from 'react-native-image-compression-kit';

type PickedAsset = { uri?: string };

async function compressPickedAsset(asset: PickedAsset) {
  if (!asset.uri) {
    throw new Error('The picker did not return a local image URI.');
  }

  return compressImage({
    source: { uri: asset.uri },
    output: { format: 'jpeg', quality: 82 },
    metadata: 'safe',
  });
}
```

## URI behavior

- Android accepts app-readable `file://` and `content://` URIs.
- Keep temporary picker permission valid until the compression promise settles.
- iOS expects a local `file://` URI. Local content-style loading is best effort.
- `http://`, `https://`, and `data:` sources reject with
  `ERR_UNSUPPORTED_SOURCE`.
- Copy a cloud-backed or library-only asset to an application-readable local
  file before compression when the picker does not materialize one.

The output `uri` points to a new cache file. Do not overwrite or delete the
picker source while compression is running.

## Camera and privacy

Camera assets can contain location and device metadata. The default `safe`
policy avoids silently forwarding privacy-sensitive metadata. Use `strip` when
no source metadata is needed. Use `preserve` only for the documented JPEG to
JPEG case and after making an application-level privacy decision.

See [output files and metadata](./files-metadata.md) for lifecycle ownership.
