# Registry Provenance and Release Evidence

## Published baseline

npm `version` and `dist-tags.latest` are `0.2.62`, published at
`2026-07-17T05:52:59.853Z`. The validated 78-file registry tarball was 56,284
bytes with integrity
`sha512-dhfg8LSOEcCyYlGsKib0E2jWt8kXCpmRNuKyCWnxrAc/0XxayBr7guCCAAuFycD0T3qaLIhzS9ZgPo7VLZgjwA==`
and shasum `c2f7aa1548ec550d9778a8f4bad87f5bba1e5724`.

The promotion used one successful `npm publish --tag latest`; no separate
dist-tag mutation was required. Annotated tag `v0.2.62` and the GitHub Release
both resolve to source commit
`43c157728ef345528053e2508e9aa9292457a55b`.

## Networked registry smoke

Run only after the exact version is published:

```bash
pnpm smoke:registry -- \
  --version 0.2.62 \
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
  --expect-version 0.2.62 \
  --expect-tag latest \
  --json
```

The verifier parses the archive in memory, rejects traversal, links, duplicate
or unsupported entries, validates canonical JSON and every declared digest and
size, and performs no npm, GitHub, or other network request.

Successful Registry Validation run
[29558617089](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29558617089)
on `refs/tags/v0.2.62` and commit
`43c157728ef345528053e2508e9aa9292457a55b` attested manifest SHA-256
`6b3b231761efd1234903f204693792c9717463efcffd48351f888886b5c1e2e0`
as [attestation 35774740](https://github.com/GGULBAE/react-native-image-compression-kit/attestations/35774740).
The provenance artifact digest is
`sha256:f76ff92c8e142a3bb2734dc60f7b332473201ee0d7350b41acf11e1c8e78bc99`;
the attestation artifact digest is
`sha256:84608ed6f02ee9681dda8006e42f243af67e1e045231392a0e1dd9af8c8ec893`.

## Offline attestation verification

```bash
pnpm verify:registry-attestation -- \
  --manifest /path/to/registry-validation/bundle-manifest.json \
  --attestation-bundle /path/to/registry-attestation/attestation.jsonl \
  --trusted-root /path/to/registry-attestation/trusted-root.jsonl \
  --expect-repository GGULBAE/react-native-image-compression-kit \
  --expect-workflow GGULBAE/react-native-image-compression-kit/.github/workflows/registry-validation.yml \
  --expect-ref refs/tags/v0.2.62 \
  --expect-head-sha 43c157728ef345528053e2508e9aa9292457a55b \
  --json
```

The pinned trusted-root SHA-256 is
`65ca537f6ed8a47fd0e560c421baa1f6c1efb8b25fc200d8c5c02c0e92eb2b9c`.
Blocked-network replay reproduced the canonical report at SHA-256
`e497952a7c67212abd71c7784ae39819002ef964a5b64968f51fd013c6972e9c`
under UTC and Asia/Seoul.

## Repository-owned archive

The v0.2.50, v0.2.55, and v0.2.62 archives live under
`evidence/npm/<version>/`. Replay one version or the complete supported set:

```bash
pnpm verify:release-evidence -- --version 0.2.62
pnpm verify:release-evidence-set -- --json
```

The v0.2.62 index pins Registry Validation run `29558617089`, source commit
`43c157728ef345528053e2508e9aa9292457a55b`, attestation `35774740`, every
retained file, and aggregate evidence SHA-256
`e5a23c12d99362d5ec3c882de3acfb161b6644e9777b16dc036e0d675cf511a6`.
With no selectors the set verifier checks v0.2.50, v0.2.55, and v0.2.62 in
stable order.

See [Acquisition](acquisition.md) for authenticated artifact download and
canonical importer handoff.
