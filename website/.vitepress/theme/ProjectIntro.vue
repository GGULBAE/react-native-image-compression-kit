<script setup lang="ts">
import { withBase } from 'vitepress';
import NativeComparison from './NativeComparison.vue';
</script>

<template>
  <section class="project-intro" aria-label="React Native Image Compression Kit">
    <div class="project-intro__copy">
      <p class="eyebrow">React Native Image Compression Kit</p>
      <h1>Smaller images.<br /><span>Before they upload.</span></h1>
      <p class="project-intro__description">Compress, resize, and convert local images on Android and iOS. Set a byte target, choose a metadata policy, and keep native work bounded.</p>
      <div class="project-intro__actions">
        <a class="project-link project-link--primary" :href="withBase('/guide/quick-start')">Start building <span aria-hidden="true">→</span></a>
        <a class="project-link" :href="withBase('/demo/')">Explore native results</a>
      </div>
      <div class="project-intro__install"><span aria-hidden="true">$</span><code>npm install react-native-image-compression-kit</code></div>
      <ul class="project-intro__platforms" aria-label="Supported targets"><li>Android 23+</li><li>iOS 13.4+</li><li>Expo development builds</li></ul>
      <p class="project-intro__license">MIT licensed · TypeScript API · Native codecs</p>
    </div>
    <NativeComparison />
  </section>
</template>
