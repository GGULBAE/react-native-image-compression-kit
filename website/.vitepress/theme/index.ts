import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import ByteEconomicsCalculator from './ByteEconomicsCalculator.vue';
import EconomicResilienceArchive from './EconomicResilienceArchive.vue';
import OptionBuilder from './OptionBuilder.vue';
import NativeComparison from './NativeComparison.vue';
import ProjectIntro from './ProjectIntro.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ByteEconomicsCalculator', ByteEconomicsCalculator);
    app.component('EconomicResilienceArchive', EconomicResilienceArchive);
    app.component('OptionBuilder', OptionBuilder);
    app.component('NativeComparison', NativeComparison);
    app.component('ProjectIntro', ProjectIntro);
  },
} satisfies Theme;
