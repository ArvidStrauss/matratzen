// Visual comparison old vs. new: full-page screenshots of the live page and the local build (`npm run preview`) for
// every imported page below --group, cut into side-by-side tiles (live left, new right) in .screens/<page>/.
// Usage: node scripts/screens.mjs --group=/lattenroste/ [--viewport=mobile|desktop] [--base=http://localhost:4321]
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;
const group = arg('group', '/');
const base = arg('base', 'http://localhost:4321');
const viewports = { mobile: { width: 390, height: 844, isMobile: true }, desktop: { width: 1280, height: 900, isMobile: false } };
const vpName = arg('viewport', 'mobile');
const vp = viewports[vpName];
const TILE = vpName === 'mobile' ? 1400 : 1000;
const GAP = 16;

const pages = [];
for (const f of await readdir('src/content/pages')) {
  const page = JSON.parse(await readFile(join('src/content/pages', f), 'utf8'));
  if (page.source && page.path.startsWith(group)) pages.push(page);
}

// Scroll through the page so lazy images load, then shoot it tile by tile (one full-page shot fails above ~16,000 px).
async function shoot(context, url) {
  const tab = await context.newPage();
  await tab.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await tab.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    // Images still loading get 5 s; lazy images that never start must not block the run.
    const loaded = Promise.all([...document.images].map((img) => img.complete || new Promise((r) => (img.onload = img.onerror = r))));
    await Promise.race([loaded, new Promise((r) => setTimeout(r, 5000))]);
    window.scrollTo(0, 0);
  });
  await tab.waitForLoadState('networkidle');
  const height = await tab.evaluate(() => document.documentElement.scrollHeight);
  const tiles = [];
  for (let top = 0; top < height; top += TILE) {
    tiles.push(await tab.screenshot({ fullPage: true, clip: { x: 0, y: top, width: vp.width, height: Math.min(TILE, height - top) } }));
  }
  await tab.close();
  return { height, tiles };
}

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, deviceScaleFactor: 1, locale: 'de-DE' });
for (const page of pages) {
  const dir = join('.screens', page.path.replace(/^\/|\/$/g, '').replace(/\//g, '--') || 'home', vpName);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const [live, next] = await Promise.all([shoot(context, page.source.link), shoot(context, base + page.path)]);
  const tiles = Math.max(live.tiles.length, next.tiles.length);
  for (let i = 0; i < tiles; i++) {
    const [l, n] = [live.tiles[i], next.tiles[i]];
    await sharp({ create: { width: vp.width * 2 + GAP, height: TILE, channels: 3, background: '#ff00ff' } })
      .composite([l && { input: l, left: 0, top: 0 }, n && { input: n, left: vp.width + GAP, top: 0 }].filter(Boolean))
      .png()
      .toFile(join(dir, `${String(i + 1).padStart(2, '0')}.png`));
  }
  console.log(`${page.path.padEnd(72)} live ${String(live.height).padStart(5)} px, new ${String(next.height).padStart(5)} px, ${tiles} tiles`);
}
await browser.close();
