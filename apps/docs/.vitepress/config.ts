import { localStudioAppRoutes } from '@localstudio/app-routes';
import { defineConfig } from 'vitepress';
import { docsNavigation } from './docsNavigation.js';

export default defineConfig({
  title: 'LocalStudio.dev - Browser-native AI design studio',
  description:
    'LocalStudio.dev is a local-first AI design studio for generating editable slides, images, translations, and image edits with browser-native Web AI.',
  base: localStudioAppRoutes.docs.base,
  cleanUrls: true,
  outDir: '../../dist/docs',
  appearance: true,
  head: [
    ['meta', { name: 'theme-color', content: '#f8f5ed' }],
    [
      'meta',
      {
        name: 'keywords',
        content:
          'LocalStudio, browser AI design studio, local-first Canva alternative, Web AI, AI slides, AI image editor, prompt to slide',
      },
    ],
    ['meta', { name: 'robots', content: 'index, follow, max-image-preview:large' }],
    ['link', { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { property: 'og:site_name', content: 'LocalStudio.dev' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'LocalStudio.dev - Browser-native AI design studio' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Generate editable slides, images, translations, and image edits locally in the browser with Web AI.',
      },
    ],
    ['meta', { property: 'og:image', content: 'https://localstudio.dev/social-preview.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'LocalStudio.dev - Browser-native AI design studio' }],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'Generate editable slides, images, translations, and image edits locally in the browser with Web AI.',
      },
    ],
    ['meta', { name: 'twitter:image', content: 'https://localstudio.dev/social-preview.png' }],
  ],
  markdown: {
    theme: {
      light: 'vitesse-light',
      dark: 'vitesse-dark',
    },
  },
  themeConfig: {
    logo: {
      light: '/localstudio-logo-black.svg',
      dark: '/localstudio-logo-white.svg',
    },
    nav: docsNavigation.nav,
    outline: {
      label: 'On this page',
    },
    search: {
      provider: 'local',
    },
    sidebar: docsNavigation.sidebar,
    socialLinks: [{ icon: 'github', link: 'https://github.com/ErickWendel/localstudio' }],
    footer: {
      message: 'Built by Erick Wendel for browser-native AI workflows.',
      copyright: 'MIT License.',
    },
  },
});
