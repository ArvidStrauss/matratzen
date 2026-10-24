// JSON content (src/content model) <-> Storyblok story content, driven by storyblok/model.json.
// Shared by the push scripts (scripts/storyblok/) and the Astro loader (loader.ts). No Node-only imports.

/** Collection -> Storyblok content type (root component). `snippet` is taken by the block that inserts a snippet group. */
export const CONTENT_TYPES = { pages: 'page', snippets: 'snippet_group', products: 'product', branches: 'branch', settings: 'settings' };
/** Collection -> Storyblok folder. Pages live at the space root, so a page's full slug is its URL path. */
export const FOLDERS = { pages: '', snippets: 'data/snippets', products: 'data/products', branches: 'data/branches', settings: 'data/settings' };
/** Story slug of the home page (path `/`). */
export const HOME_SLUG = 'home';

/** URL path of a page story: `home` -> `/`, start page of folder `a/b` -> `/a/b/`, story `a/b/c` -> `/a/b/c/`. */
export function pagePath(story) {
  if (story.full_slug === HOME_SLUG) return '/';
  // A start page's full slug is its folder (`a/b/`); drop the own slug segment in case the API returns `a/b/index`.
  const slug = story.is_startpage && !story.full_slug.endsWith('/') ? story.full_slug.replace(/\/?[^/]*$/, '') : story.full_slug;
  return `/${slug.replace(/^\/|\/$/g, '')}/`;
}

/** Collection of a story by its content type, or undefined for unknown types. */
export function collectionOf(story) {
  return Object.keys(CONTENT_TYPES).find((c) => CONTENT_TYPES[c] === story.content?.component);
}

/** Entry id of a story: the slug for data stories (= file name), the importer file name scheme for pages. */
export function entryId(collection, story) {
  if (collection !== 'pages') return story.slug;
  const path = pagePath(story);
  return path === '/' ? HOME_SLUG : path.slice(1, -1).replace(/\//g, '--');
}

export function createConverter(model) {
  const byName = new Map(model.components.map((c) => [c.name, c]));
  const get = (name) => {
    const c = byName.get(name);
    if (!c) throw new Error(`Unknown Storyblok component "${name}" (storyblok/model.json out of date?)`);
    return c;
  };

  /** Picks the union member component for a JSON value. */
  function memberFor(of, value) {
    if (of.length === 1 && !get(of[0]).map.discriminator) return of[0];
    const name = of.find((n) => {
      const d = get(n).map.discriminator;
      return d && value[d[0]] === d[1];
    });
    if (!name) throw new Error(`No component in [${of}] for ${JSON.stringify(value).slice(0, 80)}`);
    return name;
  }

  /**
   * JSON value -> Storyblok blok. `ctx.ref(collection, id)` returns a story uuid, `ctx.uid(path)` a stable `_uid`.
   */
  function toBlok(name, value, ctx, path = name) {
    const comp = get(name);
    const blok = { _uid: ctx.uid(path), component: name };
    for (const [key, f] of Object.entries(comp.map.fields)) {
      const v = value[key];
      if (v === undefined || v === null) continue;
      const p = `${path}.${key}`;
      switch (f.kind) {
        case 'text':
        case 'boolean':
          blok[f.key] = v;
          break;
        case 'number':
        case 'option':
          blok[f.key] = String(v);
          break;
        case 'lines':
          blok[f.key] = v.join('\n');
          break;
        case 'json':
          blok[f.key] = JSON.stringify(v, null, 2);
          break;
        case 'ref':
          blok[f.key] = ctx.ref(f.collection, v);
          break;
        case 'refs':
          blok[f.key] = v.map((id) => ctx.ref(f.collection, id));
          break;
        case 'one':
          blok[f.key] = [toBlok(f.of[0], v, ctx, p)];
          break;
        case 'many':
          blok[f.key] = v.map((item, i) => toBlok(memberFor(f.of, item), item, ctx, `${p}.${i}`));
          break;
        case 'wrapped':
          blok[f.key] = v.map((items, i) => toBlok(f.wrap, { items }, ctx, `${p}.${i}`));
          break;
        default:
          throw new Error(`${name}.${key}: unknown field kind ${f.kind}`);
      }
    }
    return blok;
  }

  /** Storyblok blok -> JSON value. `ctx.refId(collection, uuid)` returns the entry id of a referenced story. */
  function fromBlok(blok, ctx) {
    const comp = get(blok.component);
    const out = {};
    if (comp.map.discriminator) out[comp.map.discriminator[0]] = comp.map.discriminator[1];
    for (const [key, f] of Object.entries(comp.map.fields)) {
      const v = fromField(f, blok[f.key], ctx);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }

  function fromField(f, v, ctx) {
    const empty = v === undefined || v === null || v === '';
    const list = (items) => (items.length || f.required ? items : undefined);
    switch (f.kind) {
      case 'text':
        return v === '' && f.required ? '' : empty ? undefined : v;
      case 'boolean':
        return typeof v === 'boolean' ? v : undefined;
      case 'number':
        return empty ? undefined : Number(v);
      case 'option':
        return empty ? undefined : f.numeric ? Number(v) : v;
      case 'lines': {
        const lines = empty ? [] : String(v).split(/\r?\n/).filter((l) => l !== '');
        return list(f.numeric ? lines.map(Number) : lines);
      }
      case 'json':
        return empty ? undefined : JSON.parse(v);
      case 'ref':
        return empty ? undefined : ctx.refId(f.collection, v);
      case 'refs':
        return list(Array.isArray(v) ? v.map((uuid) => ctx.refId(f.collection, uuid)) : []);
      case 'one':
        return Array.isArray(v) && v.length ? fromBlok(v[0], ctx) : undefined;
      case 'many':
        return list(Array.isArray(v) ? v.map((b) => fromBlok(b, ctx)) : []);
      case 'wrapped':
        return list(Array.isArray(v) ? v.map((b) => fromBlok(b, ctx).items ?? []) : []);
      default:
        throw new Error(`unknown field kind ${f.kind}`);
    }
  }

  return {
    /** JSON entry data -> Storyblok story `content`. */
    toContent: (collection, data, ctx, seed) => toBlok(CONTENT_TYPES[collection], data, ctx, seed),
    /** Storyblok story -> JSON entry data (pages get their `path` from the story's position). */
    fromStory(collection, story, ctx) {
      const data = fromBlok(story.content, ctx);
      return collection === 'pages' ? { path: pagePath(story), ...data } : data;
    },
  };
}
