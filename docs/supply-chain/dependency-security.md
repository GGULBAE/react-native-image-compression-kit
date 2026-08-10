# Development dependency security

## Scope and exposure boundary

The 2026-07-20 audit found four open Dependabot alerts in the repository
lockfile. All four affected development-only site tooling: VitePress 1.6.4
resolved Vite 5.4.21, which resolved esbuild 0.21.5. A registry audit also found
one development-only advisory not yet shown in the repository alert queue:
Lighthouse 13.4.0 resolved Sentry 9.47.1 and `@opentelemetry/core` 1.30.1. None
of these tools is a production, optional, or peer dependency of the package.

On 2026-07-23, Dependabot also reported `shell-quote` 1.8.4 through the
example app's React Native 0.86.0 dependency graph. GitHub classified the
transitive lock path as runtime because the example app lists React Native as a
dependency. The published library still exposes React Native only as a peer and
does not include the example or lockfile, but the repository lock is patched
rather than dismissing that boundary.

On 2026-08-10, the registry audit added three high-severity development-tool
findings. The React Native CLI configuration graph resolved `js-yaml` 4.3.0,
and Metro 0.84.4 resolved `image-size` 1.2.1. `js-yaml` has a patched 4.3.1
release. The two `image-size` advisories currently mark every published
version through 2.0.2 as affected and list no patched version, while Metro's
current dependency range still resolves 1.2.1. The repository therefore
applies a narrow local patch instead of pretending an unavailable release is
safe or removing Metro's asset-size dependency.

The 2026-07-23 Registry Health runner audit exposed a separate high-severity
warning while `pnpm/action-setup` installed the repository's pinned pnpm
11.7.0 CLI. GitHub Advisory
[GHSA-qrv3-253h-g69c](https://github.com/advisories/GHSA-qrv3-253h-g69c)
allows a crafted env-lockfile `configDependencies` name to create a symlink
outside `node_modules/.pnpm-config`, even with lifecycle scripts disabled.
This is a repository and CI toolchain boundary rather than a dependency shipped
in the library tarball, so the pinned CLI is upgraded instead of dismissing the
runner warning.

The vulnerable behavior required a development server, with the Vite findings
further depending on Windows UNC handling or a network-exposed development
server. The library runtime does not start such a server. The npm tarball also
excludes `docs/`, `website/`, `scripts/`, `test/`, `evidence/`, and the pnpm
lock/workspace files. This reduces consumer exposure, but does not justify
retaining a vulnerable repository lock resolution.

## Advisory disposition

| Advisory | Severity | Affected lock | First patched | Affected condition | Disposition |
| --- | --- | --- | --- | --- | --- |
| [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) / CVE-2026-53632 | Medium | Vite 5.4.21 | 6.4.3 | Windows UNC/NTLM behavior in the development server | Resolved by Vite 6.4.3 |
| [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) / CVE-2026-53571 | High | Vite 5.4.21 | 6.4.3 | Network-exposed development server `server.fs.deny` bypass | Resolved by Vite 6.4.3 |
| [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) / CVE-2026-39365 | Medium | Vite 5.4.21 | 6.4.2 | Network-exposed development server source-map traversal | Resolved by Vite 6.4.3 |
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | Medium | esbuild 0.21.5 | 0.25.0 | esbuild serve-mode cross-origin source access | Resolved by esbuild 0.25.12 |
| [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) / CVE-2026-54285 | Medium | `@opentelemetry/core` 1.30.1 | 2.8.0 | Oversized inbound W3C Baggage allocation | Resolved by 2.9.0 through Sentry 10.66.0 |
| [GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv) / CVE-2026-13311 | High | `shell-quote` 1.8.4 | 1.9.0 | Quadratic-complexity denial of service in `parse()` | Resolved by scoped 1.10.0 override |
| [GHSA-qrv3-253h-g69c](https://github.com/advisories/GHSA-qrv3-253h-g69c) | High | pnpm CLI 11.7.0 | 11.8.0 | Crafted env lockfile can escape the config-dependency symlink directory | Resolved by pinning pnpm 11.8.0 |
| [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | High | `js-yaml` 4.3.0 | 4.3.1 | Quadratic `!!omap` key-uniqueness scan can block the event loop | Resolved by scoped 4.3.1 override |
| [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) / CVE-2025-71330 | High | `image-size` 1.2.1 | None published | Zero-length ICNS entry can prevent parser progress | Mitigated by reviewed local progress-validation patch and executable regression test |
| [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) / CVE-2025-71329 | High | `image-size` 1.2.1 | None published | Zero-size JXL/HEIF box can prevent parser progress | The resolved 1.2.1 bytes already advance by an eight-byte header; pinned by patch hash and executable regression test |

This table records the repository state that triggered the maintenance work; it
does not change the advisory policy or dismiss alerts without a patched lock.

## Reviewed resolution

VitePress remains on the latest reviewed stable 1.6.4 release. A root pnpm
override applies only to its Vite edge. Lighthouse remains on stable 13.4.0;
its Sentry edge uses 10.66.0, matching the Sentry 10 dependency family already
adopted by Lighthouse's upstream prerelease line. React Native remains on
0.86.2 while only the vulnerable `react-devtools-core` shell parser edge is
overridden:

```yaml
auditConfig:
  ignoreGhsas:
    - GHSA-5p2g-fcmc-qvqq
    - GHSA-w3rx-r6r6-pgpr

overrides:
  "cosmiconfig@9.0.2>js-yaml": "4.3.1"
  "lighthouse@13.4.0>@sentry/node": "10.66.0"
  "postcss": "8.5.23"
  "react-devtools-core@6.1.5>shell-quote": "1.10.0"
  "vitepress@1.6.4>vite": "6.4.3"

patchedDependencies:
  image-size@1.2.1: patches/image-size@1.2.1.patch
```

The repository, Docker image, contributor setup, and example setup pin pnpm
11.8.0. Every active workflow installs that exact package with npm into a
runner-temporary prefix, disables package lifecycle scripts, adds only its
`bin` directory to the job path, and asserts the resulting version. This avoids
the vulnerable pnpm 11.7.0 bootstrap embedded in `pnpm/action-setup@v6`.
Historical release evidence, legacy snapshots, and signed action-review
fixtures retain the pnpm version captured when they were produced. The
resulting dependency graphs are VitePress 1.6.4 to Vite
6.4.3 to esbuild 0.25.12,
Lighthouse 13.4.0 to Sentry 10.66.0 to `@opentelemetry/core` 2.9.0, and
React DevTools Core 6.1.5 to `shell-quote` 1.10.0. Vitest keeps its independent
Vite 8 resolution. The React Native CLI configuration edge resolves
`js-yaml` 4.3.1. Metro retains `image-size` 1.2.1 with a repository-owned patch
that rejects ICNS entries shorter than their eight-byte header. Its existing
shared JXL/HEIF box scanner advances by at least eight bytes when a box reports
size zero. A subprocess regression test places a one-second ceiling around the
crafted inputs, so a regression to non-termination fails promptly instead of
hanging CI. This avoids adopting a VitePress/Lighthouse prerelease,
changing React Native, or changing package runtime dependencies, public APIs,
native code, React Native support, or codec behavior.

The two exact `image-size` GHSA identifiers are listed under
`auditConfig.ignoreGhsas` because pnpm 11.8 cannot infer that a
`patchedDependencies` artifact fixes the reported vulnerable version. The
offline gate requires exactly those two identifiers, the patch path, the patch
SHA-256, its required guards, and the matching lock snapshot. Missing or extra
ignores fail. `pnpm audit --json` must exit successfully with an empty
`advisories` object; its aggregate metadata can still count the two explicitly
ignored high findings until the registry publishes a fixed version. Any other
advisory remains visible and fails the networked audit.

The lock update is accepted only when the documentation site builds and passes
its structural and browser quality gates. `pnpm peers check` still reports the
pre-existing `search-insights` peer from VitePress's bundled Algolia path. This
site does not configure Algolia search, and the override neither adds nor uses
that integration.

## Offline semantic gate

Run:

```bash
pnpm verify:dependency-security -- --json
pnpm why vite esbuild @opentelemetry/core shell-quote js-yaml image-size
pnpm audit --json
pnpm site:check
pnpm site:build
pnpm site:quality
```

The offline verifier checks the exact reviewed pnpm, VitePress, and Lighthouse
manifest versions and scoped overrides; every Vite, esbuild, OpenTelemetry
Core, `shell-quote`, PostCSS, and `js-yaml` lock resolution against its minimum;
the exact `image-size` version, patch bytes, lock binding, and audit-ignore set;
and absence of these tools from production dependency fields. Mutation tests
prove that a vulnerable pnpm pin, missing override, changed patch, altered
ignore set, unpatched lock snapshot, vulnerable resolution, or production
exposure fails. The executable parser test proves malformed ICNS and box input
terminates. The package contract additionally rejects
`pnpm/action-setup`, requires every active workflow to use the reviewed direct
bootstrap, and requires the reproducible Android container to use the same CLI
version.
`pnpm audit` is the separate networked registry cross-check and must expose no
unreviewed advisory before merge.

## Override exit criteria

Remove or change an override, patch, or audit exception only in a dedicated
dependency review when all of
the following are true:

1. Stable VitePress and Lighthouse releases natively resolve dependency
   versions that satisfy the advisory floors.
2. A published `image-size` version fixes both reviewed loop advisories and the
   Metro dependency graph can consume it; then remove the local patch and both
   exact audit exceptions together.
3. The lock contains no vulnerable parallel resolution.
4. `pnpm verify`, the site gates, and the required GitHub checks pass.
5. This document and the semantic verifier are updated together to describe
   the new graph instead of silently relaxing a minimum.
