<script setup lang="ts">
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';
import type { EconomicArchiveSnapshot } from '../economicArchiveData';

const { frontmatter } = useData();
const state = computed<EconomicArchiveSnapshot>(() =>
  frontmatter.value.economicArchive ?? { kind: 'empty' }
);

function asset(root: string, platform: string, file: string) {
  return withBase(`/evidence/economic-resilience/${root}/${platform}/${file}`);
}

function archive(root: string, platform: string) {
  return withBase(`/evidence/economic-resilience/${root}/artifacts/${platform}.zip`);
}

function bytes(value: number) {
  return `${new Intl.NumberFormat('en-US').format(value)} B`;
}
</script>

<template>
  <section v-if="state.kind === 'empty'" class="economic-archive-state economic-archive-state--empty">
    <p class="economic-evidence-state">Methodology preview · no archived capture</p>
    <p>
      No exact-master source-tree capture has been added to this public archive yet.
      The contracts below are an acceptance method, not a package release or a measured product result.
    </p>
  </section>

  <section v-else-if="state.kind === 'available'" class="economic-archive-state">
    <div class="economic-archive-heading">
      <div>
        <p class="economic-evidence-state">Archived source-tree capture · {{ state.count }} immutable commit<span v-if="state.count !== 1">s</span></p>
        <h2>Latest retained observation</h2>
      </div>
      <a :href="state.runUrl" rel="noreferrer">Open workflow run ↗</a>
    </div>
    <p class="economic-archive-sha">
      Exact master SHA <code>{{ state.sourceCommit }}</code> · run
      {{ state.runId }} attempt {{ state.runAttempt }}
    </p>

    <div class="economic-observation-grid">
      <article v-for="item in state.platforms" :key="item.platform">
        <header>
          <span>{{ item.platform }}</span>
          <strong>{{ bytes(item.outputBytes) }}</strong>
          <small>retained output from {{ bytes(item.sourceBytes) }} source</small>
        </header>
        <img
          :src="asset(item.root, item.platform, 'output.jpg')"
          :alt="`${item.platform} retained 1,600 by 1,200 JPEG output`"
          loading="lazy"
        />
        <dl>
          <div><dt>Signed byte difference</dt><dd>{{ bytes(item.sourceToOutputByteDifference) }}</dd></div>
          <div><dt>Upright SSIM</dt><dd>{{ item.uprightSimilarity }}</dd></div>
          <div><dt>Vertical-flip control</dt><dd>{{ item.verticalFlipSimilarity }}</dd></div>
          <div><dt>Output cleanup</dt><dd>{{ item.removedPackageOutputs }} of {{ item.attemptedPackageOutputs }} removed · {{ bytes(item.residualPackageOutputBytes) }} residual</dd></div>
        </dl>
        <nav aria-label="Retained evidence assets">
          <a :href="asset(item.root, item.platform, 'source.jpg')">Source JPEG</a>
          <a :href="asset(item.root, item.platform, 'output.jpg')">Output JPEG</a>
          <a :href="asset(item.root, item.platform, 'economic-resilience.json')">Evidence JSON</a>
          <a :href="archive(item.root, item.platform)">Original artifact ZIP</a>
        </nav>
      </article>
    </div>
    <p class="economic-archive-boundary">
      This is a source-to-output observation. The source remains, the matched transfer baseline is null,
      and the cost claim is null; no avoided-transfer or currency result is inferred.
    </p>
  </section>

  <section v-else class="economic-archive-state economic-archive-state--invalid" role="alert">
    <p class="economic-evidence-state">Archive data unavailable</p>
    <p>The static evidence inventory could not be resolved. The repository verification gate rejects this state.</p>
  </section>
</template>
