// Element tree -> content blocks. Recognised patterns become typed blocks, everything else a sanitised richText block.
import { plainText } from './html.mjs';
import { srcNodes } from './elements.mjs';
import { sanitize } from './sanitize.mjs';

export const mdPlain = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
const hasMd = (s) => mdPlain(s) !== s;
const SOLE_LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

export function slugify(s) {
  return mdPlain(s)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

const counter = () => new Map();
const bump = (m, k, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

export function createConverter({ rewrite, parser, snippets }) {
  let cur;
  const newStats = () => ({ fallbackChars: 0, patterns: counter(), reasons: counter(), dropped: [] });

  function fallback(els, reason) {
    const nodes = els.flatMap(srcNodes);
    const html = sanitize(nodes, rewrite, cur);
    cur.fallbackChars += nodes.reduce((n, x) => n + plainText(x).length, 0);
    bump(cur.reasons, reason);
    bump(cur.patterns, 'richText');
    return { component: 'richText', html, reason };
  }

  const pattern = (name) => bump(cur.patterns, name);

  function cardFrom(els, single) {
    const allowed = new Set(['badge', 'h', 'img', 'p', 'list', 'price', 'button']);
    if (!els.every((e) => allowed.has(e.t))) return;
    const of = (t) => els.filter((e) => e.t === t);
    const [h] = of('h');
    const [img] = of('img');
    const [price] = of('price');
    const [button] = of('button');
    if (of('h').length > 1 || of('img').length > 1 || of('price').length > 1 || of('button').length > 1 || of('badge').length > 1) return;
    if (h && (h.level < 2 || h.level > 4)) return;
    if (!img && !price) return;
    if (single && !price) return;
    const paras = of('p');
    let titleP;
    if (!h) {
      titleP = paras.find((p) => p.paras.length === 1 && SOLE_LINK.test(p.paras[0]));
      if (!titleP) return;
    }
    if (h && hasMd(h.text) && !h.soleHref) return;
    const [, titleLabel, titleHref] = titleP ? titleP.paras[0].match(SOLE_LINK) : [];
    const rest = paras.filter((p) => p !== titleP);
    const subtitle = rest.filter((p) => p.underline).flatMap((p) => p.paras);
    const note = rest.filter((p) => p.small && !p.underline).flatMap((p) => p.paras);
    const text = rest.filter((p) => !p.small && !p.underline).flatMap((p) => p.paras);
    const bullets = of('list')
      .filter((l) => !l.ordered)
      .flatMap((l) => l.items);
    if (of('list').some((l) => l.ordered)) return;
    return {
      eyebrow: of('badge')[0]?.text,
      title: h ? h.plain : titleLabel,
      titleTag: h ? `h${h.level}` : 'p',
      subtitle: subtitle.join(' ') || undefined,
      href: (h ? h.soleHref : titleHref) ?? img?.href,
      image: img ? { src: img.src, alt: img.alt } : undefined,
      text,
      bullets,
      price: price?.from,
      priceRegular: price?.regular,
      pricePrefix: price?.prefix || undefined,
      note: note.join(' ') || undefined,
      cta: button ? { label: button.label, href: button.href } : undefined,
    };
  }

  function mediaFrom(imgCol, textCol, imageFirst) {
    if (imgCol.els.length !== 1 || imgCol.els[0].t !== 'img') return;
    const img = imgCol.els[0];
    const els = textCol.els.filter((e) => e.t !== 'anchor');
    if (els.length !== textCol.els.length) return;
    let i = 0;
    let heading;
    if (els[0]?.t === 'h') {
      heading = els[i++];
      if (hasMd(heading.text) && !heading.soleHref) return;
      if (heading.id) return;
    }
    const body = [];
    while (els[i]?.t === 'p') body.push(...els[i++].paras);
    let bullets = [];
    if (els[i]?.t === 'list' && !els[i].ordered) bullets = els[i++].items;
    const outro = [];
    while (els[i]?.t === 'p') outro.push(...els[i++].paras);
    const ctas = [];
    while (els[i]?.t === 'button') ctas.push({ label: els[i].label, href: els[i++].href });
    if (i !== els.length || (!heading && !body.length && !bullets.length)) return;
    return {
      component: 'mediaText',
      heading: heading?.plain,
      headingLevel: heading ? `h${heading.level}` : 'h2',
      headingHref: heading?.soleHref,
      body,
      bullets,
      outro,
      image: { src: img.src, alt: img.alt },
      imageHref: img.href,
      imageFit: 'contain',
      ctas,
      reverse: imageFirst,
      tone: 'plain',
    };
  }

  function productHeaderFrom(imgCol, otherCol, imageFirst) {
    if (!imgCol.els.length || !imgCol.els.every((e) => e.t === 'img')) return;
    const prices = otherCol.els.filter((e) => e.t === 'price');
    if (prices.length !== 1 || !otherCol.els.every((e, i) => ['price', 'p', 'snippet'].includes(e.t) || (e.t === 'h' && i === 0))) return;
    if (otherCol.els.filter((e) => e.t === 'snippet').length > 1) return;
    const h = otherCol.els[0].t === 'h' ? otherCol.els[0] : undefined;
    if (h && ((hasMd(h.text) && !h.soleHref) || h.id)) return;
    const snippet = otherCol.els.find((e) => e.t === 'snippet');
    const [img, ...seals] = imgCol.els;
    return {
      component: 'productHeader',
      ...(h ? { heading: h.plain, headingLevel: `h${h.level}`, headingHref: h.soleHref } : {}),
      image: { src: img.src, alt: img.alt },
      seals: seals.map((s) => ({ src: s.src, alt: s.alt })),
      price: { from: prices[0].from, regular: prices[0].regular, prefix: prices[0].prefix },
      body: otherCol.els.filter((e) => e.t === 'p').flatMap((p) => p.paras),
      reverse: imageFirst === false,
      ...(snippet ? { snippet: registerSnippet(snippet) } : {}),
    };
  }

  // A column that repeats [title link, image, price] separated by rulers (the "Unsere Top Produkte" list).
  function cardList(raw) {
    const groups = [[]];
    for (const e of raw) (e.t === 'sep' ? groups.push([]) : groups.at(-1).push(e));
    const gs = groups.filter((g) => g.length);
    let heading;
    if (gs[0]?.length === 1 && gs[0][0].t === 'h' && gs[0][0].level === 2 && !hasMd(gs[0][0].text)) heading = gs.shift()[0].text;
    if (gs.length < 2) return;
    const cards = gs.map((g) => cardFrom(g, false));
    if (!cards.every(Boolean)) return;
    return { heading, cards };
  }

  function rowToBlocks(row) {
    const cols = row.cols.map((c) => ({ ...c, raw: c.els, els: c.els.filter((e) => e.t !== 'sep') })).filter((c) => c.els.length);
    if (!cols.length) return [];
    const cards = cols.map((c) => cardFrom(c.els, cols.length === 1));
    if (cards.every(Boolean)) {
      pattern('cardGrid');
      const w = cols[0].width ?? Math.round(12 / cols.length);
      return [{ component: 'cardGrid', columns: Math.min(4, Math.max(2, Math.round(12 / w))), imageFit: 'contain', cards }];
    }
    if (cols.length === 1) {
      const list = cardList(cols[0].raw);
      if (list) {
        pattern('cardGrid');
        return [{ component: 'cardGrid', heading: list.heading, columns: 4, imageFit: 'contain', cards: list.cards }];
      }
    }
    if (cols.length === 2) {
      for (const [a, b, first] of [[cols[0], cols[1], true], [cols[1], cols[0], false]]) {
        const header = productHeaderFrom(a, b, first);
        if (header) {
          pattern('productHeader');
          return [header];
        }
        const media = mediaFrom(a, b, first);
        if (media) {
          pattern('mediaText');
          return [media];
        }
      }
    }
    const anchor = row.id ? [{ t: 'anchor', id: row.id }] : [];
    if (cols.length === 1) return toBlocks([...anchor, ...cols[0].els]);
    // Any other multi-column row keeps its columns (main + sidebar, text | image, …); source order stays the DOM order.
    pattern('columns');
    const span = (c) => c.width ?? Math.round(12 / cols.length);
    return [{ component: 'columns', columns: cols.map((c, i) => ({ span: span(c), body: toBlocks(i === 0 ? [...anchor, ...c.els] : c.els) })) }];
  }

  function tabsBlock(e) {
    pattern('tabs');
    const ok = new Set(['content', 'mediaText', 'cardGrid', 'richText', 'table', 'columns']);
    return {
      component: 'tabs',
      tabs: e.tabs.map((t) => ({
        title: t.title,
        body: toBlocks(t.els).map((b) => {
          if (!ok.has(b.component)) throw new Error(`block "${b.component}" inside a tab is not supported by the tabs schema`);
          return b;
        }),
      })),
    };
  }

  function tableBlock(e) {
    pattern('table');
    return { component: 'table', head: e.head, rows: e.rows };
  }

  function registerSnippet(e) {
    const saved = cur;
    cur = newStats();
    const els = [];
    parser.parseChildren(e.node, els);
    const body = toBlocks(els);
    const inner = cur;
    cur = saved;
    const key = JSON.stringify(body);
    let entry = snippets.byKey.get(key);
    if (!entry) {
      entry = { name: snippets.uniqueName(nameOf(body)), body, sources: new Set(), fallbackChars: inner.fallbackChars, patterns: inner.patterns };
      snippets.byKey.set(key, entry);
    }
    entry.sources.add(cur.pageId);
    cur.fallbackChars += entry.fallbackChars;
    for (const [k, v] of entry.patterns) bump(cur.patterns, `${k} (snippet)`, v);
    bump(cur.patterns, 'snippet');
    return entry.name;
  }

  function nameOf(body) {
    for (const b of body.flatMap((b) => (b.component === 'columns' ? b.columns.flatMap((c) => c.body) : [b]))) {
      const t = b.heading || b.items?.find?.((i) => i.type === 'heading')?.text || b.items?.find?.((i) => i.type === 'button')?.link.label || b.cards?.[0]?.title;
      if (t && typeof t === 'string') return slugify(t) || 'snippet';
    }
    return 'snippet';
  }

  function testimonialsFrom(els, start) {
    const items = [];
    let i = start;
    while (i < els.length && ['stars', 'p', 'details'].includes(els[i].t)) {
      const item = { author: '', text: [] };
      if (els[i].t === 'stars') item.rating = els[i++].count || undefined;
      if (els[i]?.t === 'p' && els[i].small) item.author = els[i++].paras.join(' ');
      if (els[i]?.t !== 'details') break;
      const d = els[i++];
      item.summary = d.summary || undefined;
      item.text = d.paras.map(mdPlain);
      items.push(item);
    }
    return { items, next: i };
  }

  function toBlocks(els) {
    const out = [];
    let items = [];
    let pendingId;
    const flush = () => {
      if (items.length) {
        pattern('content');
        out.push({ component: 'content', items, tone: 'plain' });
      }
      items = [];
    };
    const add = (item) => {
      if (pendingId) Object.assign(item, { id: pendingId });
      pendingId = undefined;
      items.push(item);
    };
    for (let i = 0; i < els.length; i++) {
      const e = els[i];
      switch (e.t) {
        case 'h':
          add({ type: 'heading', level: e.level, text: e.text });
          if (e.id) items.at(-1).id = e.id;
          break;
        case 'p':
          e.paras.forEach((text) => add({ type: 'paragraph', text, lead: e.lead }));
          break;
        case 'list':
          add({ type: 'list', ordered: e.ordered, ...(e.ordered && e.start ? { start: e.start } : {}), items: e.items });
          break;
        case 'img':
          add({ type: 'image', image: { src: e.src, alt: e.alt }, ...(e.href ? { href: e.href } : {}) });
          break;
        case 'button':
          items.push({ type: 'button', link: { label: e.label, href: e.href }, style: e.style });
          break;
        case 'anchor':
          pendingId = e.id;
          break;
        case 'sep':
          break;
        case 'row':
          flush();
          out.push(...rowToBlocks(e).map((b) => (e.visibility && !b.visibility ? { ...b, visibility: e.visibility } : b)));
          break;
        case 'tabs':
          flush();
          out.push(tabsBlock(e));
          break;
        case 'table':
          flush();
          out.push(tableBlock(e));
          break;
        case 'snippet':
          flush();
          out.push({ component: 'snippet', snippet: registerSnippet(e) });
          break;
        case 'toggle': {
          flush();
          const group = [];
          while (els[i]?.t === 'toggle') group.push(els[i++]);
          i--;
          pattern('accordion');
          out.push({ component: 'accordion', items: group.map((g) => ({ title: g.title, body: g.paras, open: g.open })) });
          break;
        }
        case 'stars':
        case 'details': {
          flush();
          const { items: reviews, next } = testimonialsFrom(els, i);
          if (reviews.length) {
            pattern('testimonials');
            out.push({ component: 'testimonials', heading: '', items: reviews });
            i = next - 1;
          } else {
            out.push(fallback([e], `unrecognised ${e.t}`));
          }
          break;
        }
        default:
          flush();
          out.push(fallback([e], e.reason ?? `unrecognised ${e.t}`));
      }
    }
    flush();
    return mergeHeadings(out);
  }

  // A lone h2 (h1 for productHeader) in front of a block that has a heading slot moves into that slot.
  function mergeHeadings(blocks) {
    const out = [];
    for (const b of blocks) {
      const prev = out.at(-1);
      const h = prev?.component === 'content' && prev.items.length === 1 && prev.items[0].type === 'heading' ? prev.items[0] : undefined;
      const slot = ['accordion', 'table', 'testimonials', 'cardGrid', 'productHeader'].includes(b.component) && !b.heading;
      if (h && slot && !h.id && !hasMd(h.text) && h.level === (b.component === 'productHeader' ? 1 : 2)) {
        out.pop();
        out.push({ component: b.component, heading: h.text, ...(b.component === 'productHeader' ? { headingLevel: 'h1' } : {}), ...Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'component' && k !== 'heading')) });
      } else out.push(b);
    }
    return out;
  }

  return {
    convert(root, pageId) {
      cur = { ...newStats(), pageId };
      const els = [];
      parser.parseChildren(root, els);
      const body = toBlocks(els);
      const stats = { ...cur, totalChars: plainText(root).length };
      cur = undefined;
      return { body, stats };
    },
  };
}
