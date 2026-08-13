import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import ByteEconomicsCalculator from './ByteEconomicsCalculator.vue';
import EconomicResilienceArchive from './EconomicResilienceArchive.vue';
import OptionBuilder from './OptionBuilder.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ByteEconomicsCalculator', ByteEconomicsCalculator);
    app.component('EconomicResilienceArchive', EconomicResilienceArchive);
    app.component('OptionBuilder', OptionBuilder);
  },
} satisfies Theme;
