// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://brishotelperu.com',
  output: 'server',
  vite: {
    plugins: [/** @type {any} */ (tailwindcss())]
  },
  integrations: [sitemap()],
  adapter: vercel({
    webAnalytics: { enabled: true }
  }),
});