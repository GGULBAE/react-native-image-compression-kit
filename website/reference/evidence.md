# Product evidence metrics

These metrics turn the package's safety and predictability goals into
reviewable acceptance evidence. They help users decide whether the package fits
an integration and help maintainers detect a weakened contract.

<picture class="evidence-scorecard-picture">
  <source media="(max-width: 640px)" srcset="/evidence-scorecard-mobile.svg" />
  <img class="evidence-scorecard-image" src="/evidence-scorecard.svg" alt="v0.4.0 evidence snapshot: one of two captures passes the combined byte-budget and visual-integrity gate because the retained iOS capture is orientation-affected; other safety and build signals remain separately reported." />
</picture>

## Purpose and claim boundary

The package is not positioned as universally faster, smaller, or higher quality
than every image library. Native codecs, devices, source images, thermals, and
filesystem state make that claim indefensible from one runner capture.

The primary question is narrower: does a supported request behave according to
its declared byte-budget, failure-safety, and runtime-capability contracts?
Current figures are a v0.4.0 evidence snapshot, not production adoption or
incident-rate statistics.

> **Known v0.4.0 defect:** the retained iOS capture has a vertically inverted
> output. It remains public so the provenance record is not silently rewritten,
> but it does not count as successful visual-integrity evidence. The 0.4.1
> source candidate fixes the renderer and gates future captures with
> auto-oriented SSIM plus a vertical-flip control.

## Primary metrics

### Byte-budget attainment

**Definition:** supported cases whose completed output is at or below
`output.maxBytes`, divided by supported cases that declare an attainable target
in a versioned fixture plan.

```text
byte-budget attainment = cases with byteSize <= maxBytes / supported budget cases
```

The release target is 100% for declared attainable fixtures. An intentionally
unreachable target is measured separately: the result must be the smallest
generated candidate and its `byteSize` must make the miss observable. Output
dimensions, decode-back validity, and metadata policy are guardrails; reducing
bytes by returning the wrong geometry or an unreadable file does not count.

The current native walkthrough snapshot contains two supported cases and both
meet an 8,000-byte target. The retained v0.4.0 iOS result is vertically
inverted, however, so only 1 / 2 captures currently passes the combined byte
and visual-integrity guardrail. Neither count estimates a general success rate.

### Failure-safe completion

**Definition:** failed or cancelled calls that leave a newly published output
or temporary file. The target is exactly zero.

```text
residual-output rate = calls with a new residual output / failed or cancelled calls
```

The contract is exercised at JavaScript preflight, queued, and running abort
boundaries, Android queued/running and target-search cleanup, and iOS
target-search and post-write cleanup. A completed call remains a separate
guardrail: it must return a decodeable file whose measured bytes and dimensions
match the result object.

This is deterministic regression evidence, not a production crash-rate or
field-reliability estimate.

### Runtime capability agreement

**Definition:** exercised capability claims whose corresponding operation
behaves as reported, divided by all capability claims exercised on the same
runtime.

```text
capability agreement = matching exercised claims / exercised capability claims
```

The target is 100% within each recorded runtime. Unsupported output must remain
an explicit rejection rather than a soft success, and supported output must
decode back with the declared format behavior.

The current public walkthrough records Android and iOS capabilities before the
compression call. Unit, native, and instrumentation tests cover format routing,
but two recorded runtimes are not broad enough to publish a cross-device
agreement percentage. Expanding the device and OS matrix is required before
this becomes a representative rate.

## Driver and guardrail metrics

### Planned working-pixel reduction

For a resize request, this reports how much smaller the planned decode is than
the source pixel count.

```text
planned reduction = 1 - planned decoded pixels / source pixels
```

The deterministic Android policy fixture maps an 8,000 × 6,000 source
(48,000,000 pixels) to a 1,600 × 1,200 decode plan (1,920,000 pixels), a 96%
reduction in planned decoded pixels. The iOS native large-image suite executes
the same 48 MP to 1.92 MP request through ImageIO thumbnail downsampling.

This is not a peak-memory measurement. Resident memory must be measured
separately on representative physical devices before making an RSS or OOM-rate
claim.

### Sensitive metadata retention

The privacy guardrail counts named sensitive fixture fields that remain after a
`safe` or `strip` operation.

The Android `safe` fixture retains 0 of 7 checked sensitive fields: GPS
latitude, GPS longitude, camera owner, body serial, lens serial, user comment,
and image unique ID. On iOS, `safe` and `strip` build destination properties
without source metadata. `preserve` is measured separately because retaining
source metadata is its declared behavior.

### Packed-consumer build coverage

The v0.4.0 release matrix contains four release-required consumer
configurations—React Native 0.73 Legacy, React Native 0.86 Legacy, React Native
0.86 New Architecture, and Expo 57 / React Native 0.86 New Architecture—on
Android and iOS. All 8 / 8 platform targets passed with the packed candidate.

This confirms installation and native build compatibility only. It does not
claim that every intermediate React Native version, OS version, device codec,
or application dependency graph was exercised.

## Evidence charts

<div class="evidence-chart-grid">
  <figure class="evidence-chart" aria-labelledby="byte-budget-chart-title">
    <figcaption id="byte-budget-chart-title">Output against the 8,000 B ceiling</figcaption>
    <p class="evidence-chart__note">Separate source fixtures; utilization is not a quality comparison.</p>
    <div class="evidence-bar">
      <div class="evidence-bar__header"><span>Android</span><strong>2,264 B · 28.3%</strong></div>
      <div class="evidence-bar__track" aria-hidden="true"><span class="evidence-bar__fill evidence-bar__fill--android"></span></div>
    </div>
    <div class="evidence-bar">
      <div class="evidence-bar__header"><span>iOS · affected</span><strong>2,353 B · 29.4%</strong></div>
      <div class="evidence-bar__track" aria-hidden="true"><span class="evidence-bar__fill evidence-bar__fill--ios"></span></div>
    </div>
    <div class="evidence-bar__axis" aria-hidden="true"><span>0 B</span><span>8,000 B ceiling</span></div>
  </figure>
  <figure class="evidence-chart" aria-labelledby="pixel-plan-chart-title">
    <figcaption id="pixel-plan-chart-title">Large-image planned decoded pixels</figcaption>
    <p class="evidence-chart__note">Pixel plan only; this is not a peak-memory measurement.</p>
    <div class="evidence-bar">
      <div class="evidence-bar__header"><span>Source</span><strong>48 MP · 100%</strong></div>
      <div class="evidence-bar__track" aria-hidden="true"><span class="evidence-bar__fill evidence-bar__fill--source"></span></div>
    </div>
    <div class="evidence-bar">
      <div class="evidence-bar__header"><span>Planned decode</span><strong>1.92 MP · 4%</strong></div>
      <div class="evidence-bar__track" aria-hidden="true"><span class="evidence-bar__fill evidence-bar__fill--planned"></span></div>
    </div>
    <div class="evidence-bar__callout">96% fewer planned pixels</div>
  </figure>
</div>

## Current evidence snapshot

| Signal | v0.4.0 observation | Source |
| --- | --- | --- |
| Native byte + visual-integrity cases | 1 / 2 valid; both are under 8,000 B, but v0.4.0 iOS is vertically inverted | [Native walkthrough](../demo/index.md) |
| Android output | 2,264 B, 28.3% budget utilization, 16.7% of source bytes | <a href="/react-native-image-compression-kit/demo/manifest.json">Demo manifest</a> |
| iOS output | 2,353 B and under budget, but visual integrity failed because the pixel layout is vertically inverted | <a href="/react-native-image-compression-kit/demo/manifest.json">Demo manifest</a> |
| 48 MP resize plan | 1.92 MP planned decode, 96% planned-pixel reduction | [Android resource-policy test](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/android/src/test/java/com/imagecompressionkit/AndroidImageResourcePolicyTest.kt) |
| Cancellation cleanup | Zero residual output is the asserted invariant; JavaScript, Android, and iOS cleanup tests pass | [Verification architecture](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/verification-architecture.md) |
| Sensitive metadata fixture | Android `safe`: 0 of 7 named sensitive fields retained; iOS `safe`/`strip`: no source metadata copied | [Android metadata test](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/android/src/test/java/com/imagecompressionkit/JpegExifMetadataTest.kt) |
| Packed-consumer targets | 8 / 8 native builds passed | [Compatibility matrix](./compatibility.md) |

Android and iOS demo compression ratios must not be compared: the source
fixtures have different byte sizes. Budget utilization shows distance from the
requested ceiling for that exact fixture; lower utilization does not by itself
mean better visual quality.

## Interpretation limits

- Two native demo cases do not establish a general byte-budget success rate.
- Planned pixels are not peak resident memory.
- Deterministic cleanup tests are not production incident telemetry.
- Compatibility builds are not a device-codec census.
- Byte size without a perceptual metric such as SSIM or DSSIM does not establish image-quality superiority.
- The retained v0.4.0 iOS capture is defect evidence, not a valid quality or
  byte-budget success once visual integrity is included.
- The exact-plan timing benchmark is an environment-bound observation and is
  documented separately from these product-contract metrics.

## Reproduce the evidence

```bash
pnpm verify:demo-evidence
pnpm test:coverage
pnpm verify
pnpm fixtures:compatibility:check
pnpm example:android-unit-test
pnpm example:ios:large-image-test
pnpm example:ios:metadata-test
```

See the [benchmark methodology](https://github.com/GGULBAE/react-native-image-compression-kit/blob/master/docs/benchmarks/README.md)
for raw timing samples, comparator boundaries, and the prohibition on universal
performance claims.
