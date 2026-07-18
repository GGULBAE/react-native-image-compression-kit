<script setup lang="ts">
import { computed, ref } from 'vue';

const format = ref<'jpeg' | 'png' | 'webp'>('webp');
const quality = ref(80);
const maxBytes = ref<number | null>(500000);
const maxWidth = ref<number | null>(2048);
const metadata = ref<'safe' | 'strip' | 'preserve'>('safe');
const copied = ref(false);

const supportsTarget = computed(() => format.value !== 'png');
const code = computed(() => {
  const output = [
    'format: outputFormat',
    ...(format.value === 'png' ? [] : [`quality: ${quality.value}`]),
    ...(supportsTarget.value && maxBytes.value
      ? [`maxBytes: ${maxBytes.value}`]
      : []),
  ];
  const resize = maxWidth.value
    ? `\n  resize: { maxWidth: ${maxWidth.value}, mode: 'contain' },`
    : '';

  return `const requestedFormat = '${format.value}' as const;
const capabilities = await getImageCompressionCapabilities();
const canWrite = capabilities.formats.some(
  item => item.format === requestedFormat && item.output
);
const outputFormat = canWrite ? requestedFormat : 'jpeg';

const result = await compressImage({
  source: { uri: imageUri },${resize}
  output: { ${output.join(', ')} },
  metadata: '${metadata.value}',
});`;
});

async function copyCode() {
  await navigator.clipboard.writeText(code.value);
  copied.value = true;
  window.setTimeout(() => {
    copied.value = false;
  }, 1600);
}
</script>

<template>
  <section class="option-builder" aria-labelledby="option-builder-title">
    <div class="option-builder__intro">
      <p class="eyebrow">Configuration builder</p>
      <h2 id="option-builder-title">Generate capability-aware code</h2>
      <p>
        This builder produces React Native code. It does not compress an image
        in your browser.
      </p>
    </div>

    <div class="option-builder__layout">
      <form class="option-builder__form" @submit.prevent>
        <label>
          Output format
          <select v-model="format">
            <option value="webp">WebP</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
          </select>
        </label>

        <label>
          Quality
          <input v-model.number="quality" type="number" min="0" max="100" :disabled="format === 'png'" />
        </label>

        <label>
          Target bytes
          <input v-model.number="maxBytes" type="number" min="1" step="1000" :disabled="!supportsTarget" />
        </label>

        <label>
          Maximum width
          <input v-model.number="maxWidth" type="number" min="1" step="1" />
        </label>

        <label>
          Metadata policy
          <select v-model="metadata">
            <option value="safe">Safe</option>
            <option value="strip">Strip</option>
            <option value="preserve">Preserve</option>
          </select>
        </label>

        <p v-if="format === 'png'" class="option-builder__note" role="status">
          PNG ignores quality and does not support target-size compression.
        </p>
      </form>

      <div class="option-builder__output">
        <div class="option-builder__output-heading">
          <span>React Native</span>
          <button type="button" @click="copyCode">
            {{ copied ? 'Copied' : 'Copy code' }}
          </button>
        </div>
        <pre tabindex="0" aria-live="polite"><code>{{ code }}</code></pre>
      </div>
    </div>
  </section>
</template>
