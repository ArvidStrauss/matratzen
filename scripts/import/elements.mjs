// Parses WPBakery-rendered HTML into a flat element tree: rows/columns plus typed leaf elements.
// Every element keeps its source `node`, so any element can still be emitted through the sanitised fallback.
import { imgSrc, inlineParagraphs, plainText } from './html.mjs';

const BLOCK_SELECTOR = 'p,div,h1,h2,h3,h4,h5,h6,ul,ol,li,table,img,figure,iframe,video,details,form,hr';
const INLINE_TAGS = new Set(['a', 'strong', 'b', 'em', 'i', 'u', 'span', 'small', 'font', 'sup', 'sub', 'br', 'mark']);
const SKIP_CLASSES = ['vc_empty_space', 'upb_color', 'vc_hidden'];
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'link', 'meta', 'hr', 'br']);

export const srcNodes = (e) => e.nodes ?? [e.node];

export function parseEuro(text) {
  const m = text.match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}|-))?/);
  if (!m) return undefined;
  return Number(m[1].replace(/\./g, '')) + (m[2] && m[2] !== '-' ? Number(m[2]) / 10 ** m[2].length : 0);
}

export function createParser({ rewrite, notes }) {
  const el = (t, node, props = {}) => ({ t, node, ...props });
  const hasBlock = (n) => !!n.querySelector(BLOCK_SELECTOR);
  const isInline = (n) => n.nodeType === 3 || (n.nodeType === 1 && INLINE_TAGS.has(n.tagName.toLowerCase()) && !hasBlock(n) && !n.querySelector('img'));
  const cls = (n, c) => n.classList?.contains(c);
  const anyCls = (n, re) => n.classList?.value.some((c) => re.test(c));

  function parseButton(a) {
    const label = plainText(a.querySelector('.ubtn-text') ?? a);
    const href = rewrite(a.getAttribute('href'));
    if (!label || !href) return undefined;
    return { label, href, style: anyCls(a, /^fusion-button-blau/) || cls(a, 'ubtn-link') ? 'primary' : 'secondary' };
  }

  const isButtonLink = (a) => a.tagName?.toLowerCase() === 'a' && (anyCls(a, /^(fusion-button|button-flat)/) || cls(a, 'ubtn-link'));

  function parseHeading(n) {
    const paras = inlineParagraphs(n, rewrite, notes);
    const text = paras.join(' ');
    const links = n.querySelectorAll('a[href]');
    const only = links.length === 1 && plainText(links[0]) === plainText(n) ? links[0] : undefined;
    return el('h', n, { level: Number(n.tagName[1]), text, plain: plainText(n), id: n.getAttribute('id') || undefined, soleHref: only ? rewrite(only.getAttribute('href')) : undefined });
  }

  function parsePrice(n) {
    const del = n.querySelector('.price-detailseite-del, .price-del');
    const regular = del ? parseEuro(plainText(del)) : undefined;
    const full = plainText(n);
    const rest = del ? full.replace(plainText(del), '').trim() : full;
    const m = rest.match(/^(\D*?)\s*(\d[\d.,-]*)/);
    const from = m ? parseEuro(m[2]) : undefined;
    if (from === undefined) return undefined;
    return el('price', n, { from, regular, prefix: m[1].trim(), text: full });
  }

  function parseP(n, out) {
    if (anyCls(n, /^price(-detailseite)?$/)) {
      const price = parsePrice(n);
      if (price) return out.push(price);
    }
    if (n.querySelector('.shortcode-star-rating')) {
      return out.push(el('stars', n, { count: n.querySelectorAll('.dashicons-star-filled').length }));
    }
    if (n.querySelector('table') || (n.querySelector('img') && !plainText(n))) return parseChildren(n, out);
    const named = n.querySelector('a[name], a[id]');
    if (named && !plainText(n)) return out.push(el('anchor', n, { id: named.getAttribute('name') || named.getAttribute('id') }));
    const buttons = n.querySelectorAll('a').filter(isButtonLink);
    if (buttons.length && plainText(n) === plainText(buttons[0]) && buttons.length === 1) {
      const b = parseButton(buttons[0]);
      if (b) return out.push(el('button', n, b));
    }
    if (n.querySelector('.offer') && plainText(n) === plainText(n.querySelector('.offer'))) return out.push(el('badge', n, { text: plainText(n) }));
    const paras = inlineParagraphs(n, rewrite, notes);
    if (paras.length) out.push(el('p', n, { paras, lead: cls(n, 'lead'), small: cls(n, 'p-klein') || cls(n.parentNode, 'p-klein'), underline: cls(n, 'underline') }));
    for (const img of n.querySelectorAll('img')) parseChildren({ childNodes: [img] }, out);
  }

  function parseList(n, out) {
    const items = n.querySelectorAll('li');
    if (n.querySelector('li ul, li ol') || items.some((li) => li.querySelector('p, div, img, table'))) return out.push(el('raw', n, { reason: 'complex list' }));
    out.push(el('list', n, { ordered: n.tagName.toLowerCase() === 'ol', items: items.map((li) => inlineParagraphs(li, rewrite, notes).join(' ')).filter(Boolean), id: n.getAttribute('id') || undefined }));
  }

  function parseTable(n, out) {
    const cell = (c) => ({ text: inlineParagraphs(c, rewrite, notes), images: c.querySelectorAll('img').map((i) => ({ src: imgSrc(i), alt: i.getAttribute('alt') ?? '' })).filter((i) => i.src) });
    const head = n.querySelectorAll('thead tr').flatMap((tr) => tr.querySelectorAll('th, td').map(cell));
    const rows = n.querySelectorAll('tbody tr').map((tr) => tr.querySelectorAll('th, td').map(cell));
    out.push(el('table', n, { head, rows }));
  }

  function parseToggle(n, out) {
    const body = n.querySelector('.vc_toggle_content');
    const kids = [];
    parseChildren(body, kids);
    const paras = kids.flatMap((k) => (k.t === 'p' ? k.paras : []));
    if (kids.some((k) => k.t !== 'p')) return out.push(el('raw', n, { reason: 'toggle with non-text content' }));
    out.push(el('toggle', n, { title: inlineParagraphs(n.querySelector('.vc_toggle_title h4, .vc_toggle_title'), rewrite, notes).join(' '), paras, open: cls(n, 'vc_toggle_active') }));
  }

  function parseDetails(n, out) {
    const summary = n.querySelector('summary');
    const rest = n.childNodes.filter((c) => c !== summary);
    const paras = inlineParagraphs({ childNodes: rest }, rewrite, notes);
    out.push(el('details', n, { summary: summary ? inlineParagraphs(summary, rewrite, notes).join(' ') : '', paras }));
  }

  function parseTabs(n, out) {
    const panels = n.querySelectorAll('.vc_tta-panel').filter((p) => p.closest('.vc_tta-tabs') === n);
    const tabs = panels.map((p) => {
      const els = [];
      parseChildren(p.querySelector('.vc_tta-panel-body'), els);
      return { title: plainText(p.querySelector('.vc_tta-panel-title')), els };
    });
    out.push(el('tabs', n, { tabs }));
  }

  function parseRow(n, out) {
    const cols = [];
    const find = (node, depth) => {
      for (const c of node.childNodes ?? []) {
        if (c.nodeType !== 1) continue;
        if (cls(c, 'vc_column_container')) cols.push(c);
        else if (depth < 3 && !cls(c, 'vc_row')) find(c, depth + 1);
      }
    };
    find(n, 0);
    if (!cols.length) return parseChildren(n, out);
    const parsed = cols.map((c) => {
      const els = [];
      parseChildren(c, els);
      const w = c.classList.value.map((k) => k.match(/^vc_col-sm-(\d+)$/)?.[1]).find(Boolean);
      return { width: w ? Number(w) : undefined, els };
    });
    out.push(el('row', n, { cols: parsed.filter((c) => c.els.some((e) => e.t !== 'sep')), id: n.getAttribute('id') || undefined }));
  }

  function parseNode(n, out) {
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag) || SKIP_CLASSES.some((c) => cls(n, c))) return;
    if (cls(n, 'vc_separator')) return out.push({ t: 'sep' });
    if (cls(n, 'vc_row')) return parseRow(n, out);
    if (cls(n, 'vc_tta-tabs')) return parseTabs(n, out);
    if (cls(n, 'vc_toggle')) return parseToggle(n, out);
    if (cls(n, 'templatera_shortcode')) return out.push(el('snippet', n));
    if (/^h[1-6]$/.test(tag)) return plainText(n) ? out.push(parseHeading(n)) : undefined;
    if (tag === 'p') return parseP(n, out);
    if (tag === 'ul' || tag === 'ol') return parseList(n, out);
    if (tag === 'table') return parseTable(n, out);
    if (tag === 'details') return parseDetails(n, out);
    if (tag === 'img') {
      const src = imgSrc(n);
      if (!src) return;
      const link = n.parentNode?.tagName?.toLowerCase() === 'a' ? rewrite(n.parentNode.getAttribute('href')) : undefined;
      return out.push(el('img', n, { src, alt: n.getAttribute('alt') ?? '', href: link }));
    }
    if (tag === 'a') {
      if (isButtonLink(n)) {
        const b = parseButton(n);
        if (b) return out.push(el('button', n, b));
      }
      if (n.querySelector('img')) return parseChildren(n, out);
      return parseInlineRun([n], out);
    }
    if (['iframe', 'video', 'form', 'object', 'embed', 'audio', 'svg'].includes(tag)) return out.push(el('raw', n, { reason: tag }));
    if (cls(n, 'p-klein') && !n.querySelector('div')) {
      const paras = inlineParagraphs(n, rewrite, notes);
      return paras.length ? out.push(el('p', n, { paras, lead: false, small: true, underline: false })) : undefined;
    }
    parseChildren(n, out);
  }

  function parseInlineRun(nodes, out) {
    const paras = inlineParagraphs({ childNodes: nodes }, rewrite, notes);
    if (paras.length) out.push({ t: 'p', nodes, paras, lead: false, small: false, underline: false });
  }

  function parseChildren(node, out) {
    let run = [];
    const flush = () => {
      if (run.some((r) => r.text.trim())) parseInlineRun(run, out);
      run = [];
    };
    for (const c of node.childNodes ?? []) {
      if (isInline(c)) run.push(c);
      else {
        flush();
        parseNode(c, out);
      }
    }
    flush();
  }

  return { parseChildren, parseButton };
}
