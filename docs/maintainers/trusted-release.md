# Trusted release runbook

The release workflow publishes one reviewed tarball through npm Trusted
Publishing OIDC and then verifies the registry artifact before finalizing an
immutable GitHub Release. No npm token is accepted by this path.

## One-time trust setup

In npm package settings, create a GitHub Actions trusted publisher with this
exact tuple:

- organization/user: `GGULBAE`
- repository: `react-native-image-compression-kit`
- workflow: `.github/workflows/release.yml`
- environment: `npm-production`

Require two-factor authentication on maintainer accounts. In GitHub, create the
protected `npm-production` environment and its manual reviewer before testing
the workflow. Never store `NODE_AUTH_TOKEN`, an npm automation token, or account
recovery codes in repository secrets.

## Release

1. Merge a reviewed release-state commit on protected `master`. It must align
   `package.json`, README, RELEASE, changelog, status manifest, site, and
   compatibility matrix for the exact release target. The manifest keeps
   `publishedNpmLatest` at the registry-observed version until publication; it
   must not claim the target is already published.
2. Record the full lowercase 40-character current `master` SHA. Confirm the
   worktree is clean, the contract-required CI/Android/iOS checks are green on
   that exact SHA, and `npm view react-native-image-compression-kit@<version>`
   is absent. The workflow rejects an older ancestor even if it was once green.
3. Dispatch `.github/workflows/release.yml` with the exact version, source SHA,
   and `confirm_publish=true`. The exact version must have a matching
   `docs/launch/v<version>-release-notes.md` file.
4. Review the compatibility and exact-artifact preflight results. Approve the
   `npm-production` deployment only if its version, SHA, tarball SHA-256/SRI,
   inventory, release state, and registry action are correct.
5. After completion, verify npm `latest`, provenance, registry consumer smoke,
   the immutable GitHub Release assets, and the `v<version>` tag source SHA.
6. Run the existing registry-validation, acquisition, import, policy-review,
   and archive procedure from [release evidence](../release-evidence/README.md).

## Non-publishing maintenance rehearsal

On 2026-07-23, protected `master` commit
`ffeeab2e43ed11558ff1921fb4cde9ffac29f889` completed
`pnpm release:dry-run` without publishing. The command ran the full repository
gate (39 test files and 392 tests), example typecheck, build and documentation
checks, package inventory and packed-README checks, a fresh React Native 0.86
consumer install/typecheck, and `pnpm publish --dry-run`. The final npm step
reported that `react-native-image-compression-kit@0.4.0` was skipped in dry-run
mode. The worktree remained clean.

This rehearsal proves the current preflight, packaging, and consumer mechanics;
it is not a release authorization or an end-to-end OIDC publish rehearsal.
Version `0.4.0` is already immutable in npm, so do not dispatch Trusted Release
to test it again. The next new version must repeat `pnpm release:dry-run` on its
exact reviewed candidate, pass the protected-master CI/Android/iOS checks, and
then use the normal `confirm_publish=true` workflow and `npm-production`
approval. Only that new-version run can prove the live trusted-publisher,
deployment, publish/resume, provenance, and GitHub Release path.

The local rehearsal host had no Java runtime or Android SDK. Repository contract
checks still passed locally, while PR #28's GitHub-hosted Android
instrumentation, iOS validation, compatibility matrix, CI, and Registry Health
checks all passed on the same source tree.

Automatic Registry Health is the daily drift monitor. It reads
`publishedNpmLatest`, compares the live npm metadata/tarball/consumer result to
the matching committed archive, has `contents: read` only, uses no environment,
and creates no provenance or attestation. Registry Validation is the separate
manual, `workflow_dispatch`-only path through protected `npm-production`; run
it for the published version and expected dist-tag only when fresh provenance,
attestation, and deployment evidence is required. Neither path publishes or
changes registry, Git tag, or GitHub Release state; see
[registry provenance](../release-evidence/registry-provenance.md#automatic-registry-health).

## Registry Health operational acceptance

Registry Health first reached `master` through
[PR #24](https://github.com/GGULBAE/react-native-image-compression-kit/pull/24)
at `ad63a6139f85e74d1e0d563e0ae0eb5822c724ad`. The manual acceptance run was
[29811124837](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29811124837),
triggered by `workflow_dispatch` on that exact commit. The first daily run was
[29895649740](https://github.com/GGULBAE/react-native-image-compression-kit/actions/runs/29895649740),
triggered by `schedule` on the same commit. GitHub created it at
`2026-07-22T06:05:03Z`, after the `03:17Z` cron target. Both runs completed
successfully with npm 12.0.1 and resolved `publishedNpmLatest`, requested
version, resolved version, and `latest` to `0.4.0`.

Each run uploaded exactly one artifact containing only `registry-health.json`:

- manual: `registry-health-0.4.0-29811124837`, artifact ID `8487459150`, ZIP
  SHA-256 `e7581ce957adc720fc0d81386f5be5fd35729c77b1bd29351b98650247a0d2f5`
- scheduled: `registry-health-0.4.0-29895649740`, artifact ID `8519872681`, ZIP
  SHA-256 `2f439ff1fe35348baf4d91a716e35f7224dbae18b816aecde82a56cc8aa6bd9c`

The ZIP transport digests differ, but the downloaded canonical reports are
byte-identical. Their shared report SHA-256 is
`0c396eddb2bd7e72f9edb553b35ace2d4d963ac86d6401b095ca582bc6ff0c47`;
each report's `status` is `passed`, every check is `true`, `drift` is empty, and
`error` is `null`. In both jobs the successful Step Summary step read that same
run's canonical report and reported the same package/version/tag, publish
timestamp, SRI, shasum, tarball SHA-256, package shape, README, forbidden-file,
and consumer-smoke identity.

Both job logs record only `Contents: read` plus GitHub's implicit
`Metadata: read`; the workflow declares no environment and neither run created
a deployment. A `github-pages` deployment exists on the same commit because
the independent Pages run `29811112682` ran after the merge; its deployment
status links to the Pages job, predates the scheduled run, and is not Registry
Health output. Post-run deployment, issue, issue-comment, and commit-comment
queries were empty. Attestation lookups for the canonical report and scheduled
artifact ZIP digests returned no subjects. The workflow steps and permissions
also provide no provenance, attestation, issue, or external-message path.

Replay a downloaded canonical report without registry or GitHub access after
the explicit `gh run download` acquisition step:

```bash
health_run_id=29895649740 # use 29811124837 to replay the manual run
health_version="$(node -p "require('./docs/release-status.json').publishedNpmLatest")"
acceptance_dir="$(mktemp -d)"

gh run download "$health_run_id" \
  --name "registry-health-${health_version}-${health_run_id}" \
  --dir "$acceptance_dir/download"
mkdir "$acceptance_dir/live"
cp "evidence/npm/${health_version}/provenance/registry-provenance.json" \
  "$acceptance_dir/live/registry-provenance.json"
cp "evidence/npm/${health_version}/provenance/package.tgz" \
  "$acceptance_dir/live/package.tgz"
pnpm verify:registry-health -- \
  --live-artifact-dir "$acceptance_dir/live" \
  --json \
  --report-file "$acceptance_dir/replayed-registry-health.json" \
  > "$acceptance_dir/stdout.json"
cmp "$acceptance_dir/download/registry-health.json" \
  "$acceptance_dir/replayed-registry-health.json"
cmp "$acceptance_dir/replayed-registry-health.json" \
  "$acceptance_dir/stdout.json"
shasum -a 256 "$acceptance_dir/download/registry-health.json"
```

For each manual or scheduled run, investigate in this order:

1. Confirm event, conclusion, `master` head SHA, and the `0.4.0` release handoff
   before trusting any artifact.
2. Read the npm-version assertion and `GITHUB_TOKEN Permissions` log group;
   reject extra token scopes, an environment, or a Registry Health deployment.
3. Require exactly one run artifact and exactly one `registry-health.json`, then
   hash it before replay.
4. Compare every Step Summary identity value to the report and require all
   checks to be `true`, empty `drift`, and a null error.
5. Perform the offline replay above. If it differs, preserve both byte streams
   and determine whether the report, release handoff, or committed evidence is
   inconsistent.
6. Attribute any same-SHA deployment through its deployment-status `log_url`,
   and audit newly created issues/comments. Registry Health has no authority to
   create provenance, attestations, deployments, issues, or messages.

## Resume semantics

The workflow has only three publication decisions:

- `publish`: the exact version is absent, so the verified tarball may publish.
- `resume`: the version exists and its registry integrity exactly matches the
  preflight tarball; skip npm publish and finish provenance/release verification.
- `blocked`: the version or integrity differs, source/status is wrong, or a gate
  failed. Stop and investigate. Never overwrite or recreate the version.

A failed run after npm accepted the tarball is resumed with the same version and
source SHA. A new commit creates a different artifact and cannot resume that
publication.

The registry smoke normalizes npm 11 and npm 12 JSON transports. Exact
`npm view --json` may be an object/scalar or a single-item array, while
`npm pack --json` may be a one-item array or a package-name-keyed object.
Zero, multiple, incomplete, or otherwise ambiguous results fail closed. This
normalization is required before interpreting registry version, dist-tag, or
tarball identity; retrying an invalid transport shape does not make it safe.

## Failure and rollback

For a Registry Health failure, inspect the canonical report first, confirm the
`docs/release-status.json` and `evidence/npm/<version>` handoff, then compare
exact npm metadata and tarball identity with npm 12.0.1. The failure grants no
mutation authority: do not republish, change `latest`, move a tag, edit a
GitHub Release, or rewrite evidence to make the monitor green.

- Before npm publish: fix through a new reviewed commit; discard an incomplete
  draft release only if it contains no public evidence that must be retained.
- After npm publish: npm and immutable release artifacts are append-only. If the
  release is unsafe, use `npm deprecate` with an actionable message, publish a
  forward hotfix from protected source, and use a Security Advisory when needed.
- Never move a version tag, replace a tarball, delete provenance, rewrite release
  evidence, or reuse a semantic version.
- If OIDC trust fails, verify the exact npm tuple, environment, default branch,
  workflow filename, and id-token permission. Do not fall back to a token.

The post-publish handoff artifact is temporary transport evidence. The canonical
long-term record remains the npm registry, immutable GitHub Release, protected
tag, and imported release-evidence set.
