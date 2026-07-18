# Registry Provenance and Release Evidence

## Published baseline

npm `version` and `dist-tags.latest` are `0.3.0`, published at
`2026-07-18T11:25:58.408Z`. The validated 79-file registry tarball was 58,780
bytes with integrity
`sha512-+ZxzGYC1aJz1Bdw71jDmCKpA+dBpAEiY1oOozLA43Ykgkm4LMXyzk1JH9HMci3qqIRsdNQGmsebBQNhzmSxzLQ==`
and shasum `516f7a150d8f13bf794000f39516950370ba418d`.

The promotion used one successful `npm publish --tag latest`; no separate
dist-tag mutation was required. Immutable tag `v0.3.0` and the GitHub Release
both resolve to source commit
`f8ad71f14ac50dac9dc433a46ee4e9a6d7e1bca7`.

## Networked registry smoke

Run only after the exact version is published:

```bash
pnpm smoke:registry -- \
  --version 0.3.0 \
  --expect-tag latest \
  --json \
  --artifact-dir registry-validation
```

The command validates registry metadata, downloads the real tarball, checks
integrity/shasum and package contents, installs it into a clean temporary React
Native consumer, and atomically writes exactly:

- `registry-provenance.json`
- byte-identical `stdout.json`
- `package.tgz`
- `bundle-manifest.json`

## Offline provenance verification

```bash
pnpm verify:registry-provenance -- \
  --artifact-dir /path/to/registry-validation \
  --expect-package react-native-image-compression-kit \
  --expect-version 0.3.0 \
  --expect-tag latest \
  --json
```

The verifier parses the archive in memory, rejects traversal, links, duplicate
or unsupported entries, validates canonical JSON and every declared digest and
size, and performs no npm, GitHub, or other network request.

Successful Registry Validation run
[29643434413](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29643434413)
on `refs/tags/v0.3.0` and commit
`f8ad71f14ac50dac9dc433a46ee4e9a6d7e1bca7` attested manifest SHA-256
`870ff069977d7bfe9193f92b00aca0e625e2c163aebf094cdb56b13ec6df3d60`
as [attestation 35958617](https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35958617).
The provenance artifact digest is
`sha256:039964a14923ea9f51af8a9568cdea0d1c7cdbbcc3954147f6b59d8054fdb997`;
the attestation artifact digest is
`sha256:1d3826a6e17c102a1ab2bb053ae24a996051e464e496bb853ca002d9e6975274`.

## Offline attestation verification

```bash
pnpm verify:registry-attestation -- \
  --manifest /path/to/registry-validation/bundle-manifest.json \
  --attestation-bundle /path/to/registry-attestation/attestation.jsonl \
  --trusted-root /path/to/registry-attestation/trusted-root.jsonl \
  --expect-repository GGULBAE/react-native-image-compression-kit \
  --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml \
  --expect-ref refs/tags/v0.3.0 \
  --expect-head-sha f8ad71f14ac50dac9dc433a46ee4e9a6d7e1bca7 \
  --json
```

The pinned trusted-root SHA-256 is
`65ca537f6ed8a47fd0e560c421baa1f6c1efb8b25fc200d8c5c02c0e92eb2b9c`.
Blocked-network replay reproduced the canonical report at SHA-256
`490a2202c4e69da356a8844803e64b067cc3992a437690b63738637c30e347ef`
under UTC and Asia/Seoul.

## Repository-owned archive

The v0.2.50, v0.2.55, v0.2.62, and v0.3.0 archives live under
`evidence/npm/<version>/`. Replay one version or the complete supported set:

```bash
pnpm verify:release-evidence -- --version 0.3.0
pnpm verify:release-evidence-set -- --json
```

The v0.3.0 index pins Registry Validation run `29643434413`, source commit
`f8ad71f14ac50dac9dc433a46ee4e9a6d7e1bca7`, attestation `35958617`, every
retained file, and aggregate evidence SHA-256
`201d16d7845212fa115674deacb6766ea03b2d6982a43036f40f110ee652550e`.
With no selectors the set verifier checks v0.2.50, v0.2.55, v0.2.62, and
v0.3.0 in stable order.

See [Acquisition](acquisition.md) for authenticated artifact download and
canonical importer handoff.
