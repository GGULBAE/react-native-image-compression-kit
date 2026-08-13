<script setup lang="ts">
import { computed, ref } from 'vue';
import { calculateByteEconomics } from './byteEconomics';

const acceptedCount = ref(1_000_000);
const packageInputBytes = ref(4_000_000);
const acceptedOutputBytes = ref(500_000);
const matchedBaselineBytes = ref<number | ''>('');
const retentionDays = ref(30);
const ownsStagingSource = ref(false);
const storagePrice = ref(0.015);

const scenario = computed(() => {
  try {
    return {
      error: null,
      results: calculateByteEconomics({
        acceptedCount: Number(acceptedCount.value),
        packageInputBytesPerAccepted: Number(packageInputBytes.value),
        acceptedOutputBytesPerAccepted: Number(acceptedOutputBytes.value),
        matchedBaselineBytesPerAccepted:
          matchedBaselineBytes.value === ''
            ? null
            : Number(matchedBaselineBytes.value),
        retentionDays: Number(retentionDays.value),
        ownsStagingSource: ownsStagingSource.value,
        storagePricePerDecimalGbMonth: Number(storagePrice.value),
      }),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Check the scenario inputs.',
      results: null,
    };
  }
});

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function formatBytes(value: number) {
  const absolute = Math.abs(value);
  const units = [
    ['TB', 1_000_000_000_000],
    ['GB', 1_000_000_000],
    ['MB', 1_000_000],
    ['kB', 1_000],
  ] as const;
  const unit = units.find(([, size]) => absolute >= size);
  if (!unit) return `${integer.format(absolute)} B`;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(absolute / unit[1])} ${unit[0]}`;
}

function formatMoney(value: number) {
  const absolute = Math.abs(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: absolute > 0 && absolute < 0.01 ? 4 : 2,
    maximumFractionDigits: absolute > 0 && absolute < 0.01 ? 4 : 2,
  }).format(absolute);
}

function describeByteDifference(value: number) {
  if (value > 0) return `${formatBytes(value)} less`;
  if (value < 0) return `${formatBytes(value)} more`;
  return 'No difference';
}

function describeCostDifference(value: number) {
  if (value > 0) return `${formatMoney(value)} less`;
  if (value < 0) return `${formatMoney(value)} more`;
  return 'No difference';
}
</script>

<template>
  <section class="option-builder byte-calculator" aria-labelledby="byte-calculator-title">
    <div class="option-builder__intro">
      <p class="eyebrow">Local scenario calculator</p>
      <h2 id="byte-calculator-title">Separate the byte boundaries</h2>
      <p>
        Change the assumptions below to inspect each quantity independently.
        This calculator does not transmit or persist your inputs; values stay in
        this page's browser memory and reset on refresh.
      </p>
    </div>

    <div class="option-builder__layout byte-calculator__layout">
      <form class="option-builder__form" @submit.prevent>
        <label for="accepted-count">
          Accepted output count
          <input
            id="accepted-count"
            v-model.number="acceptedCount"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
          />
        </label>

        <label for="package-input-bytes">
          Package input bytes / accepted image
          <input
            id="package-input-bytes"
            v-model.number="packageInputBytes"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
          />
        </label>

        <label for="accepted-output-bytes">
          Accepted output bytes / accepted image
          <input
            id="accepted-output-bytes"
            v-model.number="acceptedOutputBytes"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
          />
        </label>

        <label for="matched-baseline-bytes">
          Matched current-pipeline transfer / accepted image
          <input
            id="matched-baseline-bytes"
            v-model.number="matchedBaselineBytes"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            placeholder="Optional; include retries"
            aria-describedby="matched-baseline-note"
          />
          <small id="matched-baseline-note">
            Leave blank unless the cohort and acceptance policy are comparable.
          </small>
        </label>

        <label for="retention-days">
          Retention days
          <input
            id="retention-days"
            v-model.number="retentionDays"
            type="number"
            min="0"
            step="0.1"
            inputmode="decimal"
          />
        </label>

        <label for="storage-price">
          Byte storage price · USD / decimal GB-month
          <input
            id="storage-price"
            v-model.number="storagePrice"
            type="number"
            min="0"
            step="0.001"
            inputmode="decimal"
          />
        </label>

        <label class="byte-calculator__toggle" for="owns-staging-source">
          <input
            id="owns-staging-source"
            v-model="ownsStagingSource"
            type="checkbox"
          />
          <span>App owns the staging source and may replace or delete it</span>
        </label>
      </form>

      <div class="byte-calculator__output" aria-live="polite">
        <div class="byte-calculator__output-heading">
          <strong>Scenario results</strong>
          <span>Decimal bytes · 30-day month</span>
        </div>

        <p v-if="scenario.error" class="byte-calculator__error" role="alert">
          {{ scenario.error }}
        </p>

        <div v-else-if="scenario.results" class="byte-calculator__results">
          <article>
            <span>Source → accepted output</span>
            <strong>{{ describeByteDifference(scenario.results.sourceToOutputByteDelta) }}</strong>
            <p>
              Signed package input/output difference: positive means fewer
              bytes and negative means growth. This is not an incremental
              transfer claim.
            </p>
          </article>

          <article>
            <span>Matched transfer difference</span>
            <strong v-if="scenario.results.matchedTransferDifferenceBytes === null">
              Baseline required
            </strong>
            <strong v-else>
              {{ describeByteDifference(scenario.results.matchedTransferDifferenceBytes) }}
            </strong>
            <p>
              Baseline transfer minus one full accepted-output transfer. Include
              partial and retry bytes in both measured paths before reporting a
              real product effect.
            </p>
          </article>

          <article>
            <span>App-owned staging replacement</span>
            <template v-if="scenario.results.stagingReplacementDifferenceBytes === null">
              <strong>Not applicable</strong>
              <p>
                Gallery/provider source remains. The generated output adds
                {{ formatBytes(scenario.results.retainedOutputBytes) }} until the
                app removes it.
              </p>
            </template>
            <template v-else>
              <strong>
                {{ describeByteDifference(scenario.results.stagingReplacementDifferenceBytes) }}
              </strong>
              <p>
                {{ describeCostDifference(scenario.results.stagingReplacementStorageCostDifference ?? 0) }}
                at the entered byte-storage price, only if the staging source may
                be deleted.
              </p>
            </template>
          </article>

          <article>
            <span>Retained accepted outputs</span>
            <strong>{{ formatBytes(scenario.results.retainedOutputBytes) }}</strong>
            <p>
              {{ formatMoney(scenario.results.retainedOutputStorageCost) }} for
              the entered retention and byte-storage rate.
            </p>
          </article>

          <article class="byte-calculator__result-wide">
            <span>Count-priced object and request costs</span>
            <strong>Unchanged, not zero</strong>
            <p>
              {{ integer.format(scenario.results.unchangedObjectCount) }} objects
              and {{ integer.format(scenario.results.unchangedWriteRequestCount) }}
              assumed writes in either scenario. Delivery, transformations,
              requests, free tiers, tax, and discounts are not priced here.
            </p>
          </article>
        </div>
      </div>
    </div>

    <details class="byte-calculator__assumptions">
      <summary>Calculation assumptions and date boundary</summary>
      <ul>
        <li>Per-image byte values are scenario averages across accepted outputs.</li>
        <li>
          The new transfer path assumes one complete accepted-output upload. If
          it retries or partially transfers, use measured bytes for both paths.
        </li>
        <li>
          Storage is prorated over a 30-day month with 1 decimal GB equal to
          1,000,000,000 bytes and one retained output per accepted image.
        </li>
        <li>
          The sample $0.015 rate is an editable input, not a live quote. Pricing
          and model assumptions were last reviewed on 2026-08-13; replace it
          with the byte-priced rate that applies to your bill.
        </li>
      </ul>
    </details>
  </section>
</template>
