# Contributing

Thank you for helping improve React Native Image Compression Kit. Contributions
should preserve the small public API, explicit platform capability model, and
fail-closed release evidence.

## Before opening a change

- Use GitHub Discussions for integration questions and design exploration.
- Search existing issues before reporting a bug or proposing a feature.
- Report vulnerabilities through the private route in [SECURITY.md](SECURITY.md).
- Open an issue before implementing a new codec, public API, or platform claim.

## Local setup

Requirements:

- Node.js 22.13 or newer
- pnpm 11.8.0 through Corepack
- Ruby/CocoaPods and Xcode for iOS validation
- Java 21 and Android SDK 36 for Android executable validation

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm verify
pnpm example:typecheck
```

Run the example app with `pnpm example:android` or `pnpm example:ios`. See
[example/README.md](example/README.md) for platform setup and deterministic
sample instructions.

## Change expectations

- Add or update tests for observable behavior.
- Update README or website documentation when setup, support, limitations,
  verification, CI, or public behavior changes.
- Do not add install-time lifecycle scripts or broaden the npm file allowlist
  without an explicit package audit.
- Pin every remote GitHub Action to a reviewed full commit SHA.
- Do not rewrite committed release-evidence or review archives.
- Keep native format claims capability-driven and backed by executable tests.

## Required verification

```bash
pnpm verify
pnpm example:typecheck
pnpm site:check
pnpm site:build
git diff --check
pnpm pack --dry-run
```

Native or release changes require the relevant Android, iOS, consumer, and
release dry-run lanes documented in the pull request template. A pull request
must explain any unavailable local platform check so CI can remain the
executable authority.

## Commit and pull request guidance

- Keep commits focused and use behavior-oriented messages.
- Do not mix generated evidence, unrelated formatting, or dependency updates
  into feature changes.
- Complete the pull request checklist and call out public compatibility risk.
- Maintainers may ask for a smaller reproducer or split follow-up work.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
