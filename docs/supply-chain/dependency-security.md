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

This table records the repository state that triggered the maintenance work; it
does not change the advisory policy or dismiss alerts without a patched lock.

## Reviewed resolution

VitePress remains on the latest reviewed stable 1.6.4 release. A root pnpm
override applies only to its Vite edge. Lighthouse remains on stable 13.4.0;
its Sentry edge uses 10.66.0, matching the Sentry 10 dependency family already
adopted by Lighthouse's upstream prerelease line. React Native remains on
0.86.0 while only the vulnerable `react-devtools-core` shell parser edge is
overridden:

```yaml
overrides:
  "lighthouse@13.4.0>@sentry/node": "10.66.0"
  "react-devtools-core@6.1.5>shell-quote": "1.10.0"
  "vitepress@1.6.4>vite": "6.4.3"
```

The resulting graphs are VitePress 1.6.4 to Vite 6.4.3 to esbuild 0.25.12,
Lighthouse 13.4.0 to Sentry 10.66.0 to `@opentelemetry/core` 2.9.0, and
React DevTools Core 6.1.5 to `shell-quote` 1.10.0. Vitest keeps its independent
Vite 8.0.16 resolution. This avoids adopting a VitePress/Lighthouse prerelease,
changing React Native, or changing package runtime dependencies, public APIs,
native code, React Native support, or codec behavior.

The lock update is accepted only when the documentation site builds and passes
its structural and browser quality gates. `pnpm peers check` still reports the
pre-existing `search-insights` peer from VitePress's bundled Algolia path. This
site does not configure Algolia search, and the override neither adds nor uses
that integration.

## Offline semantic gate

Run:

```bash
pnpm verify:dependency-security -- --json
pnpm why vite esbuild @opentelemetry/core shell-quote
pnpm audit --json
pnpm site:check
pnpm site:build
pnpm site:quality
```

The offline verifier checks the exact reviewed VitePress/Lighthouse manifest
versions and scoped overrides, every Vite, esbuild, and OpenTelemetry Core lock
resolution plus every `shell-quote` lock resolution against the minimum safe
versions, presence of the reviewed Vite and shell-quote resolutions, and
absence of these tools from production dependency fields. Mutation tests prove
that a missing override, vulnerable resolution, or production exposure fails.
`pnpm audit` is the separate networked registry cross-check and must report zero
advisories before merge.

## Override exit criteria

Remove or change the override only in a dedicated dependency review when all of
the following are true:

1. Stable VitePress and Lighthouse releases natively resolve dependency
   versions that satisfy the advisory floors.
2. The lock contains no vulnerable parallel resolution.
3. `pnpm verify`, the site gates, and the required GitHub checks pass.
4. This document and the semantic verifier are updated together to describe
   the new graph instead of silently relaxing a minimum.
