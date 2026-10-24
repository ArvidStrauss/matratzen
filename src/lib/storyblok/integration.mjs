// Storyblok Visual Editor preview for `astro dev` (active with CONTENT_SOURCE=storyblok + STORYBLOK_VERSION=draft):
// - serves https (the Visual Editor only embeds https previews), via @vitejs/plugin-basic-ssl (self-signed)
// - inside the editor iframe, loads the Storyblok bridge; on save/publish it refetches the content and reloads the page
// Production builds are untouched: no bridge, published content only.
import basicSsl from '@vitejs/plugin-basic-ssl';

try {
  process.loadEnvFile('.env');
} catch {}

const REFRESH = '/_storyblok/refresh';
const LOADERS = ['pages', 'snippets', 'products', 'branches', 'settings'].map((c) => `storyblok-${c}`);

const bridge = `
if (window.self !== window.top) {
  const s = document.createElement('script');
  s.src = 'https://app.storyblok.com/f/storyblok-v2-latest.js';
  s.onload = () => {
    new window.StoryblokBridge().on(['change', 'published'], async () => {
      await fetch(${JSON.stringify(REFRESH)}, { method: 'POST' });
      location.reload();
    });
  };
  document.head.append(s);
}`;

/** @returns {import('astro').AstroIntegration} */
export default function storyblokPreview() {
  const enabled = process.env.CONTENT_SOURCE === 'storyblok' && process.env.STORYBLOK_VERSION === 'draft';
  return {
    name: 'storyblok-preview',
    hooks: {
      'astro:config:setup': ({ command, injectScript, updateConfig, logger }) => {
        if (command !== 'dev' || !enabled) return;
        updateConfig({ vite: { plugins: [basicSsl()] } });
        injectScript('page', bridge);
        logger.info('Storyblok preview: https, draft content, bridge active in the Visual Editor');
      },
      'astro:server:setup': ({ server, refreshContent }) => {
        if (!enabled || !refreshContent) return;
        server.middlewares.use(REFRESH, async (req, res) => {
          if (req.method !== 'POST') return void (res.statusCode = 405), res.end();
          await refreshContent({ loaders: LOADERS });
          res.end('ok');
        });
      },
    },
  };
}
