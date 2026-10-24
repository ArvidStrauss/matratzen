// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import storyblokPreview from './src/lib/storyblok/integration.mjs';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://gesunde-matratzen.de',
  // GitHub Pages project sites live under /<repo>/; scripts/apply-base.mjs prefixes the content links after the build.
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [storyblokPreview()],
  image: {
    // Prototype hotlinks original media; later replaced by Storyblok assets (a.storyblok.com).
    domains: ['gesunde-matratzen.de'],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
