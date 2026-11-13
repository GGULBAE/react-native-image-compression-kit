<script setup lang="ts">
import { computed, ref } from 'vue';
import { useData, withBase } from 'vitepress';
import type { EconomicArchiveSnapshot } from '../economicArchiveData';

const { frontmatter } = useData();
const state = computed<EconomicArchiveSnapshot>(() => frontmatter.value.economicArchive ?? { kind: 'empty' });
const platform = ref<'android' | 'ios'>('android');
// Load the full-resolution original only when someone uses the comparison.
const split = ref(0);
const selected = computed(() => state.value.kind === 'available'
  ? state.value.platforms.find(item => item.platform === platform.value) : undefined);
const difference = computed(() => {
  if (!selected.value) return '';
  const change = (selected.value.outputBytes / selected.value.sourceBytes - 1) * 100;
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
});
function asset(file: string) {
  return withBase(`/evidence/economic-resilience/${selected.value?.root}/${platform.value}/${file}`);
}
function bytes(value: number) {
  return `${new Intl.NumberFormat('en-US').format(value)} B`;
}
</script>

<template>
  <section class="native-comparison" aria-label="Recorded native compression result">
    <template v-if="state.kind === 'available' && selected">
      <header class="native-comparison__header">
        <div><p class="eyebrow">Recorded native result</p><h2>Same input. Your platform.</h2></div>
        <div class="native-comparison__platforms" role="group" aria-label="Recorded platform">
          <button type="button" :aria-pressed="platform === 'android'" @click="platform = 'android'">Android</button>
          <button type="button" :aria-pressed="platform === 'ios'" @click="platform = 'ios'">iOS</button>
        </div>
      </header>
      <div class="native-comparison__image">
        <img :src="asset('output.jpg')" :alt="`${platform} compressed output of the synthetic test image`" width="1600" height="1200" decoding="async" fetchpriority="high" />
        <img v-if="split > 0" class="native-comparison__original" :src="asset('source.jpg')" alt="Original synthetic test image" width="4000" height="3000" decoding="async" :style="{ clipPath: `inset(0 ${100 - split}% 0 0)` }" />
        <span v-show="split > 0" class="native-comparison__label native-comparison__label--source">Original</span>
        <span v-show="split < 100" class="native-comparison__label native-comparison__label--output">Output</span>
        <span class="native-comparison__divider" :style="{ left: `${split}%` }" aria-hidden="true">↔</span>
      </div>
      <label class="native-comparison__slider"><span>Compare original and output</span><input v-model.number="split" type="range" min="0" max="100" aria-label="Original and output split" /></label>
      <div class="native-comparison__metrics" aria-live="polite" aria-atomic="true">
        <div><span>Original</span><strong>{{ bytes(selected.sourceBytes) }}</strong></div>
        <div><span>{{ platform === 'ios' ? 'iOS' : 'Android' }} output</span><strong>{{ bytes(selected.outputBytes) }}</strong></div>
        <div><span>Bytes in this sample</span><strong class="native-comparison__change">{{ difference }}</strong></div>
      </div>
      <p class="native-comparison__note">Synthetic test image · recorded on native runtimes. This page does not upload or compress your images. Results vary with the input and runtime.</p>
      <footer class="native-comparison__footer">
        <a :href="state.runUrl">Source capture {{ state.sourceCommit.slice(0, 7) }} ↗</a>
        <a :href="asset('source.jpg')">Original JPEG</a><a :href="asset('output.jpg')">Output JPEG</a>
      </footer>
      <p class="native-comparison__release">Source-tree observation, not a measurement of the published npm package.</p>
    </template>
    <template v-else><h2>Native results</h2><p>No recorded comparison is available. Read the <a :href="withBase('/reference/economic-resilience')">evidence methodology</a>.</p></template>
  </section>
</template>
