# Dependabot triage

## Queue policy

Scheduled GitHub Actions proposals run weekly, group minor and patch updates,
ignore majors, and allow at most two open version-update pull requests. npm
proposals run monthly, group development minor/patch updates, group Vite,
esbuild, Lighthouse, Sentry, and OpenTelemetry security updates separately,
ignore majors, and allow at most three open version-update pull requests.
Bundler and Gradle proposals run monthly with one open pull request per
ecosystem.

Security updates remain enabled. Queue limits control scheduled version-update
noise; they are not a substitute for alert review. Required CI, Android, iOS,
compatibility, and native-demo checks remain unchanged. This reduces concurrent
runner demand without weakening a protected-branch requirement.

GitHub Action Dependabot pull requests are proposals, not trusted pin updates.
The workflow supply-chain gate rejects a changed SHA until workflows and the
canonical lock agree. A maintainer must review the release tag-to-commit path
through [Action Pin Review](action-pins.md#manual-networked-review).

## 2026-07-20 backlog disposition

The first post-launch queue mixed unrelated ecosystem upgrades and generated
nine concurrent pull requests. The maintenance decision is recorded below so
closing an automated proposal does not lose its rationale.

| PR | Proposal | Classification | Disposition |
| --- | --- | --- | --- |
| [#3](https://github.com/GGULBAE/react-native-image-compression-kit/pull/3) | `actions/setup-node` 6.5.0 to 7.0.0 | Major Action update | Close and defer to a dedicated Action Pin Review |
| [#4](https://github.com/GGULBAE/react-native-image-compression-kit/pull/4) | `actions/upload-artifact` 6.0.0 to 7.0.1 | Major Action update; native-demo check failed | Close and defer to a dedicated Action Pin Review |
| [#6](https://github.com/GGULBAE/react-native-image-compression-kit/pull/6) | `actions/deploy-pages` 4.0.5 to 5.0.0 | Major Action update | Close and defer to a dedicated Action Pin Review |
| [#7](https://github.com/GGULBAE/react-native-image-compression-kit/pull/7) | `actions/setup-java` 5.5.0 to 5.6.0 | Same-major Action proposal without reviewed lock evidence | Close; recreate only through Action Pin Review |
| [#8](https://github.com/GGULBAE/react-native-image-compression-kit/pull/8) | `xcodeproj` requirement below 1.26.0 to below 1.29.0 | Example build-tool range expansion; iOS checks incomplete | Close and defer to a focused iOS toolchain review |
| [#9](https://github.com/GGULBAE/react-native-image-compression-kit/pull/9) | `actions/attest` 4.1.1 to 4.2.0 | Same-major Action proposal without reviewed lock evidence | Close; recreate only through Action Pin Review |
| [#10](https://github.com/GGULBAE/react-native-image-compression-kit/pull/10) | Gradle wrapper 9.3.1 to 9.6.1 | Example toolchain update with required-check failures | Close and defer to a focused Android toolchain review |
| [#11](https://github.com/GGULBAE/react-native-image-compression-kit/pull/11) | Eight grouped development updates | Invalid review unit containing Babel 8 and TypeScript 7 majors | Close; replace only with compatible minor/patch groups or separate major reviews |
| [#12](https://github.com/GGULBAE/react-native-image-compression-kit/pull/12) | React 19.2.3 to 19.2.7 | Example compatibility change with required checks cancelled | Close and defer to a focused compatibility update |

The Vite/esbuild alerts are resolved in the focused dependency-security change,
not by merging the mixed PR #11. Babel 8 and TypeScript 7 remain explicitly out
of scope and must never be smuggled into a routine maintenance group.

## 2026-08-06 backlog disposition

The next queue was reviewed as four separate risk decisions. A grouped proposal
was not treated as safe merely because some of its members were routine patch
updates, and workflow SHA proposals did not bypass the Action Pin Review
contract.

| PR | Proposal | Classification | Disposition |
| --- | --- | --- | --- |
| [#33](https://github.com/GGULBAE/react-native-image-compression-kit/pull/33) | Lighthouse 13.4.1, Playwright 1.62.1, and React Native 0.86.2 toolchain packages | Invalid review unit spanning the audited Lighthouse security baseline, browser tooling, and native toolchain | Closed; keep Lighthouse 13.4.0 until its audited baseline is deliberately revised, and recreate unrelated updates as focused proposals |
| [#36](https://github.com/GGULBAE/react-native-image-compression-kit/pull/36) | `actions/attest`, `actions/setup-java`, and `gradle/actions/setup-gradle` | Workflow SHA changes without matching canonical lock and manual review evidence | Closed; recreate only through Action Pin Review with an updated `.github/actions-lock.json` |
| [#39](https://github.com/GGULBAE/react-native-image-compression-kit/pull/39) | React 19.2.3 to 19.2.8 and the compatible `@types/react` lock resolution | Focused example compatibility patch | Squash-merged as `cd55a5b87b8978f6416d2cff46a41574ae114284` after all 18 current-head checks passed |
| [#35](https://github.com/GGULBAE/react-native-image-compression-kit/pull/35) | React Native 0.86.0 to 0.86.2 | Focused example runtime compatibility patch | Squash-merged as `f2a6119070bb0c93d67730539d6e41d61582c994` after all 18 current-head checks passed |

The first RN-floor Android verification of #35 exposed a repeatable Gradle
Jetifier heap failure in the disposable compatibility consumer. Focused
prerequisite [#43](https://github.com/GGULBAE/react-native-image-compression-kit/pull/43)
raised only that generated consumer's Gradle heap and metaspace limits, added a
source contract test, and was squash-merged as
`48a53398cc0a5666f0c1a44aeda356a957f2537b`. The refreshed #35 matrix then passed
all eight Android/iOS compatibility lanes, including the RN-floor Android lane;
no protected check or dependency-security baseline was weakened.

## Review checklist

For every future proposal:

1. Identify production, peer, optional, development, example, or workflow-only
   exposure before judging urgency.
2. Split majors and toolchain contract changes from routine updates.
3. Require Action Pin Review evidence for any workflow SHA change.
4. Run the package, platform, compatibility, and site gates affected by the
   proposal; do not cancel required checks to make a queue fit.
5. Merge one coherent review unit or close it with a durable rationale here or
   in the replacing pull request.
