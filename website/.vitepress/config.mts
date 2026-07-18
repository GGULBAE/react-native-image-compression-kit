import { defineConfig } from 'vitepress';

const repository =
  'https://github.com/GGULBAE/react-native-image-compression-kit';
const site = 'https://ggulbae.github.io/react-native-image-compression-kit/';

export default defineConfig({
  title: 'React Native Image Compression Kit',
  description:
    'Capability-aware native image compression, resize, and format conversion for React Native.',
  lang: 'en-US',
  base: '/react-native-image-compression-kit/',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: site },
  markdown: {
    theme: {
      light: 'github-dark-high-contrast',
      dark: 'github-dark-high-contrast',
    },
  },
  head: [
    ['meta', { name: 'theme-color', content: '#111827' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'React Native Image Compression Kit' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Predictable native image compression with explicit platform capabilities.',
      },
    ],
    ['meta', { property: 'og:image', content: `${site}social-card.svg` }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'icon', href: '/react-native-image-compression-kit/logo.svg' }],
  ],
  transformPageData(pageData) {
    const route = pageData.relativePath
      .replace(/(^|\/)index\.md$/, '$1')
      .replace(/\.md$/, '');
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push([
      'link',
      { rel: 'canonical', href: new URL(route, site).toString() },
    ]);
  },
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Image Compression Kit',
    nav: [
      { text: 'Guide', link: '/guide/installation' },
      { text: 'API', link: '/reference/api' },
      { text: 'Native demo', link: '/demo/' },
      { text: 'Compatibility', link: '/reference/compatibility' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: [
      {
        text: 'Get started',
        items: [
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Image picker integration', link: '/guide/integration' },
          { text: 'Compression recipes', link: '/guide/recipes' },
        ],
      },
      {
        text: 'Use safely',
        items: [
          { text: 'Capabilities and fallbacks', link: '/guide/capabilities' },
          { text: 'Output files and metadata', link: '/guide/files-metadata' },
          { text: 'Errors and troubleshooting', link: '/guide/errors' },
          { text: 'Testing and mocking', link: '/guide/testing' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Public API', link: '/reference/api' },
          { text: 'Compatibility matrix', link: '/reference/compatibility' },
          { text: 'Native result demo', link: '/demo/' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: repository }],
    search: { provider: 'local' },
    editLink: {
      pattern: `${repository}/edit/master/website/:path`,
      text: 'Edit this page on GitHub',
    },
    footer: {
      message: 'Native output claims are capability-driven and evidence-backed.',
      copyright: 'Released under the MIT License.',
    },
  },
});
