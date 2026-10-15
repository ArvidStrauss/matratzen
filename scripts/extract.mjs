// Turns reference/raw/*.html into ordered, verbatim content blocks in reference/extracted/*.json.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'node-html-parser';
import { PAGES } from './capture.mjs';

const BASE = 'https://gesunde-matratzen.de';
export const clean = (s) =>
  (s ?? '').replace(/\u00ad/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

const abs = (u) => (!u ? u : u.startsWith('http') ? u : u.startsWith('/') ? BASE + u : u);

function imgSrc(el) {
  const src = el.getAttribute('data-lazy-src') || el.getAttribute('data-src') || el.getAttribute('src');
  return src && !src.startsWith('data:') ? abs(src) : null;
}

function bgImage(el) {
  const style = el.getAttribute('style') || '';
  const m = style.match(/background-image:\s*url\(['"]?([^'")]+)/) || [];
  const lazy = el.getAttribute('data-bg') || el.getAttribute('data-bg-url');
  const url = lazy || m[1];
  return url && !url.startsWith('data:') ? abs(url) : null;
}

const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'figcaption', 'td', 'th']);
const SKIP = new Set(['script', 'style', 'noscript', 'svg', 'form']);

function walk(el, out) {
  for (const node of el.childNodes) {
    if (node.nodeType === 3) {
      const t = clean(node.text);
      if (t) out.push({ type: 'text', text: t });
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toLowerCase();
    if (SKIP.has(tag)) continue;

    const bg = bgImage(node);
    if (bg) out.push({ type: 'bg', src: bg });

    if (tag === 'img') {
      const src = imgSrc(node);
      if (src)
        out.push({
          type: 'img',
          src,
          alt: clean(node.getAttribute('alt')),
          width: Number(node.getAttribute('width')) || undefined,
          height: Number(node.getAttribute('height')) || undefined,
        });
      continue;
    }
    if (tag === 'video' || tag === 'iframe' || tag === 'source') {
      const src = node.getAttribute('src') || node.getAttribute('data-src') || node.getAttribute('data-lazy-src');
      if (tag === 'video' && node.getAttribute('poster')) out.push({ type: 'poster', src: abs(node.getAttribute('poster')) });
      if (src) out.push({ type: tag === 'iframe' ? 'iframe' : 'video', src: abs(src) });
      if (tag === 'video') walk(node, out);
      continue;
    }
    if (TEXT_TAGS.has(tag)) {
      const text = clean(node.text);
      const links = node
        .querySelectorAll('a[href]')
        .map((a) => ({ text: clean(a.text), href: abs(a.getAttribute('href')) }))
        .filter((l) => l.text);
      if (text) out.push({ type: tag, text, ...(links.length ? { links } : {}) });
      for (const img of node.querySelectorAll('img')) walk({ childNodes: [img] }, out);
      continue;
    }
    if (tag === 'a') {
      const inner = [];
      walk(node, inner);
      const text = clean(node.text);
      const href = abs(node.getAttribute('href'));
      const imgs = inner.filter((b) => b.type === 'img' || b.type === 'bg');
      if (text || imgs.length) out.push({ type: 'link', text, href, ...(imgs.length ? { images: imgs } : {}) });
      continue;
    }
    walk(node, out);
  }
}

function blocks(root) {
  const out = [];
  if (root) walk(root, out);
  return out;
}

// Top-level WPBakery rows become sections so page structure stays visible.
function sections(content) {
  if (!content) return [];
  const rows = content.querySelectorAll('.vc_row').filter((r) => !r.classList.contains('vc_inner'));
  if (!rows.length) return [{ blocks: blocks(content) }];
  return rows.map((row, i) => ({ index: i, id: row.getAttribute('id') || undefined, blocks: blocks(row) })).filter((s) => s.blocks.length);
}

function menu(ul) {
  if (!ul) return [];
  return ul.childNodes
    .filter((li) => li.nodeType === 1 && li.tagName === 'LI')
    .map((li) => {
      const a = li.querySelector('a');
      const sub = li.querySelector('ul');
      const label = clean(a?.querySelector('.menu-text')?.text ?? a?.text);
      return { label, href: abs(a?.getAttribute('href')), ...(sub ? { children: menu(sub) } : {}) };
    })
    .filter((i) => i.label);
}

async function main() {
  await mkdir('reference/extracted', { recursive: true });
  for (const key of Object.keys(PAGES)) {
    const doc = parse(await readFile(`reference/raw/${key}.html`, 'utf8'));
    const result = {
      key,
      path: PAGES[key].path,
      title: clean(doc.querySelector('title')?.text),
      metaDescription: clean(doc.querySelector('meta[name="description"]')?.getAttribute('content')),
      header: blocks(doc.querySelector('.fusion-header .fusion-logo')),
      heroNav: blocks(doc.querySelector('.volle-navi')),
      mainMenu: menu(doc.querySelector('.fusion-main-menu > ul')),
      sections: sections(doc.querySelector('.post-content')),
      sidebar: blocks(doc.querySelector('#sidebar')),
      footer: blocks(doc.querySelector('.fusion-footer')),
    };
    await writeFile(`reference/extracted/${key}.json`, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log(`${key}: ${result.sections.length} sections, ${result.mainMenu.length} menu items`);
  }
}

main();
