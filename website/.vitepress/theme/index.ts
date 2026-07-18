import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import OptionBuilder from './OptionBuilder.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('OptionBuilder', OptionBuilder);
  },
} satisfies Theme;
