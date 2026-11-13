<script setup lang="ts">
import { computed, ref } from 'vue';
import { useData, withBase } from 'vitepress';
import type { EconomicArchiveSnapshot } from '../economicArchiveData';

withDefaults(defineProps<{ summary?: boolean }>(), { summary: false });
const { frontmatter } = useData();
const state = computed<EconomicArchiveSnapshot>(() => frontmatter.value.economicArchive ?? { kind: 'empty' });
const platform = ref<'android' | 'ios'>('android');
// Fetch the original only when someone uses the detailed image comparison.
const split = ref(0);
const selected = computed(() => state.value.kind === 'available'
  ? state.value.platforms.find(item => item.platform === platform.value) : undefined);
const reduction = computed(() => selected.value
  ? ((1 - selected.value.outputBytes / selected.value.sourceBytes) * 100).toFixed(1) : '');
const outputShare = computed(() => selected.value
  ? Math.min(100, selected.value.outputBytes / selected.value.sourceBytes * 100) : 0);
function asset(file: string) {
  return withBase(`/evidence/economic-resilience/${selected.value?.root}/${platform.value}/${file}`);
}
function size(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(2)} MB` : `${Math.round(value / 1_000)} kB`;
}
function bytes(value: number) {
  return `${new Intl.NumberFormat('en-US').format(value)} bytes`;
}
</script>

<template>
  <section class="native-comparison" :class="{ 'native-comparison--summary': summary }" aria-label="Recorded compression example">
    <template v-if="state.kind === 'available' && selected">
      <header class="native-comparison__header">
        <div><p class="eyebrow">One recorded example</p><h2>See the file size change.</h2></div>
        <div class="native-comparison__platforms" role="group" aria-label="Recorded platform">
          <button type="button" :aria-pressed="platform === 'android'" @click="platform = 'android'">Android</button>
          <button type="button" :aria-pressed="platform === 'ios'" @click="platform = 'ios'">iOS</button>
        </div>
      </header>
      <p class="native-comparison__intro">A local JPEG, resized and compressed on {{ platform === 'ios' ? 'iOS' : 'Android' }}.</p>
      <div class="native-comparison__sizes" aria-live="polite" aria-atomic="true">
        <div class="native-comparison__file">
          <div><span>Original JPEG</span><strong :title="bytes(selected.sourceBytes)">{{ size(selected.sourceBytes) }}</strong><small>{{ selected.sourceWidth }} × {{ selected.sourceHeight }} px</small></div>
          <div class="native-comparison__bar" aria-hidden="true"><span style="width: 100%"></span></div>
        </div>
        <div class="native-comparison__file native-comparison__file--output">
          <div><span>{{ platform === 'ios' ? 'iOS' : 'Android' }} output</span><strong :title="bytes(selected.outputBytes)">{{ size(selected.outputBytes) }}</strong><small>{{ selected.outputWidth }} × {{ selected.outputHeight }} px</small></div>
          <div class="native-comparison__bar" aria-hidden="true"><span :style="{ width: `${outputShare}%` }"></span></div>
        </div>
        <p class="native-comparison__saving"><strong>{{ reduction }}% smaller file</strong><span>in this sample, including resizing</span></p>
      </div>
      <p class="native-comparison__settings">JPEG quality up to {{ selected.qualityLimit }} · target {{ size(selected.targetBytes) }} · metadata stripped</p>
      <template v-if="!summary">
        <p class="native-comparison__explanation">The colored test pattern makes flipped orientation and lost detail easier to spot. Both images are displayed at the same size below; the output has fewer pixels. This is not a photo-quality benchmark.</p>
        <div class="native-comparison__image">
          <img :src="asset('output.jpg')" :alt="`${platform} compressed output of the synthetic test pattern`" :width="selected.outputWidth" :height="selected.outputHeight" decoding="async" />
          <img v-if="split > 0" class="native-comparison__original" :src="asset('source.jpg')" alt="Original synthetic test pattern" :width="selected.sourceWidth" :height="selected.sourceHeight" decoding="async" :style="{ clipPath: `inset(0 ${100 - split}% 0 0)` }" />
          <span v-show="split > 0" class="native-comparison__label native-comparison__label--source">Original</span>
          <span v-show="split < 100" class="native-comparison__label native-comparison__label--output">Output</span>
          <span v-show="split > 0 && split < 100" class="native-comparison__divider" :style="{ left: `${split}%` }" aria-hidden="true">↔</span>
        </div>
        <label class="native-comparison__slider"><span>Reveal original over output</span><input v-model.number="split" type="range" min="0" max="100" aria-label="Original and output split" /></label>
        <p class="native-comparison__exact">Original: {{ bytes(selected.sourceBytes) }} → output: {{ bytes(selected.outputBytes) }}.</p>
      </template>
      <p class="native-comparison__note">Recorded with a synthetic test image on native runtimes. Results vary by image and device. This page does not upload or compress your files.</p>
      <footer class="native-comparison__footer">
        <a v-if="summary" :href="withBase('/demo/')">View images and settings →</a>
        <template v-else><a :href="asset('source.jpg')">Original JPEG</a><a :href="asset('output.jpg')">Output JPEG</a></template>
        <a :href="state.runUrl">Source capture {{ state.sourceCommit.slice(0, 7) }} ↗</a>
      </footer>
      <p class="native-comparison__release">Captured from the 0.4.1 source candidate. Published npm latest is 0.4.0.</p>
    </template>
    <template v-else><h2>Native results</h2><p>No recorded comparison is available. Read the <a :href="withBase('/reference/economic-resilience')">evidence methodology</a>.</p></template>
  </section>
</template>
