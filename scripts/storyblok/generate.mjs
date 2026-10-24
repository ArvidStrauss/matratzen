// Generates storyblok/model.json from the zod model in src/lib/schema.ts:
// - `components`: Storyblok component payloads (pushed by sync-components.mjs, minus `map`)
// - `map` per component: how a JSON field maps to its Storyblok field (read by src/lib/storyblok/convert.mjs)
// Usage: node scripts/storyblok/generate.mjs [--check]   (--check fails if model.json is out of date)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadSchemas, FOLDERS, CONTENT_TYPES } from './lib.mjs';

const { collections, parts } = loadSchemas();

// Storyblok reserves "content" as a component name.
const RESERVED = { content: 'content_section' };
const PART_NAMES = new Map([
  [parts.link, 'link'],
  [parts.image, 'image'],
  [parts.price, 'price'],
  [parts.navItem, 'nav_item'],
  [parts.card, 'card'],
  [parts.tableCell, 'table_cell'],
  [parts.seo, 'seo'],
  [parts.importSource, 'import_source'],
]);
// Long free text gets a textarea; the rest of the strings are one-line text fields.
const TEXTAREA_KEYS = new Set(['html', 'address', 'intro', 'description', 'text', 'summary', 'subheading']);
// Derived from the Storyblok story, not stored as a field.
const DERIVED = { page: ['path'] };

const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const singular = (s) =>
  s.endsWith('ies') ? s.slice(0, -3) + 'y' : /(ch|sh|x)es$/.test(s) ? s.slice(0, -2) : s.endsWith('s') && !s.endsWith('ss') ? s.slice(0, -1) : s;
const human = (s) => snake(s).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function unwrap(t) {
  let optional = false;
  let defaultValue;
  for (;;) {
    const n = t._def.typeName;
    if (n === 'ZodOptional' || n === 'ZodNullable') (optional = true), (t = t._def.innerType);
    else if (n === 'ZodDefault') (defaultValue = t._def.defaultValue()), (t = t._def.innerType);
    else if (n === 'ZodLazy') t = t._def.getter();
    else if (n === 'ZodEffects') t = t._def.schema;
    else return { t, optional, defaultValue };
  }
}
const refOf = (t) => t._def.typeName === 'ZodString' && t.description?.startsWith('reference:') && t.description.slice(10);

const components = new Map(); // name -> { component, map }
const inProgress = new Set(); // recursive models (columns hold blocks) must not re-enter a component being built
const objectNames = new Map(PART_NAMES); // zod object -> component name

/** Registers (or extends) the component `name` for zod object `obj`. */
function register(obj, name, { discriminator, extra = [], root = false } = {}) {
  let entry = components.get(name);
  // Same name for a content type and a nestable block (or two different objects) would silently merge their fields.
  if (entry && (root || entry.component.is_root)) throw new Error(`Component name "${name}" is used twice (content type vs. block)`);
  objectNames.set(obj, name);
  if (inProgress.has(name)) return name;
  inProgress.add(name);
  if (!entry) {
    entry = {
      component: { name, display_name: human(name), is_root: root, is_nestable: !root, schema: {} },
      map: { ...(discriminator && { discriminator }), fields: {} },
    };
    components.set(name, entry);
  }
  const skip = new Set([discriminator?.[0], ...(DERIVED[name] ?? [])]);
  for (const shape of [obj.shape, ...extra.map((o) => o.shape)]) {
    for (const [key, schema] of Object.entries(shape)) {
      if (skip.has(key) || entry.map.fields[key]) continue;
      const { sb, map } = field(schema, name, key);
      const sbKey = snake(key);
      if (Object.values(entry.map.fields).some((f) => f.key === sbKey)) throw new Error(`${name}: duplicate field key ${sbKey}`);
      entry.component.schema[sbKey] = { ...sb, pos: Object.keys(entry.component.schema).length, display_name: human(key) };
      entry.map.fields[key] = { key: sbKey, ...map };
    }
  }
  inProgress.delete(name);
  return name;
}

function objectName(obj, parent, key) {
  const name = objectNames.get(obj) ?? `${parent}_${snake(singular(key))}`;
  return components.has(name) ? name : register(obj, name);
}

/** Component names for the members of a discriminated union (optionally intersected with extra fields). */
function unionMembers(union, parent, extra = []) {
  const disc = union._def.discriminator;
  const prefix = union === parts.contentItem ? 'content_' : disc === 'component' ? '' : `${parent}_`;
  return union._def.options.map((opt) => {
    const value = opt.shape[disc]._def.value;
    const name = disc === 'component' ? (RESERVED[value] ?? snake(value)) : `${prefix}${snake(value)}`;
    return register(opt, name, { discriminator: [disc, value], extra });
  });
}

/** Component names a list element can be (object, union, union ∩ object). */
function elementComponents(t, parent, key) {
  const n = t._def.typeName;
  if (n === 'ZodObject') return [objectName(t, parent, key)];
  if (n === 'ZodDiscriminatedUnion') return unionMembers(t, parent);
  if (n === 'ZodIntersection') return unionMembers(unwrap(t._def.left).t, parent, [unwrap(t._def.right).t]);
  return null;
}

const bloks = (of, extra = {}) => ({ type: 'bloks', restrict_type: '', restrict_components: true, component_whitelist: of, ...extra });
const refField = (collection, multi) => ({
  type: multi ? 'options' : 'option',
  source: 'internal_stories',
  folder_slug: `${FOLDERS[collection]}/`,
  filter_content_type: [CONTENT_TYPES[collection]],
});

function field(schema, parent, key) {
  const { t, optional, defaultValue } = unwrap(schema);
  const required = !optional && defaultValue === undefined;
  const base = required ? { required: true } : {};
  const def = defaultValue !== undefined && typeof defaultValue !== 'object' ? { default_value: String(defaultValue) } : {};
  const n = t._def.typeName;
  const out = (sb, map) => ({ sb: { ...sb, ...base, ...def }, map: { ...map, ...(required && { required: true }) } });

  const ref = refOf(t);
  if (ref) return out(refField(ref, false), { kind: 'ref', collection: ref });
  if (n === 'ZodString') return out({ type: t === parts.md || TEXTAREA_KEYS.has(key) ? 'textarea' : 'text' }, { kind: 'text' });
  if (n === 'ZodNumber') {
    const int = t._def.checks.some((c) => c.kind === 'int');
    return out({ type: 'number', decimals: int ? 0 : 2, ...(t._def.checks.some((c) => c.kind === 'min' && c.value === 0) && { min_value: 0 }) }, { kind: 'number' });
  }
  if (n === 'ZodBoolean') return out({ type: 'boolean' }, { kind: 'boolean' });
  if (n === 'ZodEnum' || n === 'ZodLiteral' || (n === 'ZodUnion' && t._def.options.every((o) => o._def.typeName === 'ZodLiteral'))) {
    const values = n === 'ZodEnum' ? t._def.values : n === 'ZodLiteral' ? [t._def.value] : t._def.options.map((o) => o._def.value);
    const numeric = values.every((v) => typeof v === 'number');
    return out(
      { type: 'option', exclude_empty_option: required || defaultValue !== undefined, options: values.map((v) => ({ name: String(v), value: String(v) })) },
      { kind: 'option', ...(numeric && { numeric: true }) },
    );
  }
  if (n === 'ZodRecord' || n === 'ZodUnknown' || n === 'ZodAny') {
    return out({ type: 'textarea', description: 'JSON' }, { kind: 'json' });
  }
  if (n === 'ZodObject') {
    const name = objectName(t, parent, key);
    return out(bloks([name], { maximum: 1 }), { kind: 'one', of: [name] });
  }
  if (n === 'ZodArray') {
    const el = unwrap(t._def.type).t;
    const elRef = refOf(el);
    if (elRef) return out(refField(elRef, true), { kind: 'refs', collection: elRef });
    if (el._def.typeName === 'ZodString') return out({ type: 'textarea', description: 'One entry per line' }, { kind: 'lines' });
    if (el._def.typeName === 'ZodNumber') return out({ type: 'textarea', description: 'One number per line' }, { kind: 'lines', numeric: true });
    if (el._def.typeName === 'ZodArray') {
      // List of lists (table rows): each inner list becomes a wrapper block with an `items` field.
      const wrap = `${parent}_${snake(singular(key))}`;
      const inner = elementComponents(unwrap(el._def.type).t, wrap, 'items');
      if (!components.has(wrap)) {
        components.set(wrap, {
          component: { name: wrap, display_name: human(wrap), is_root: false, is_nestable: true, schema: { items: { ...bloks(inner), pos: 0, display_name: 'Items' } } },
          map: { fields: { items: { key: 'items', kind: 'many', of: inner } } },
        });
      }
      return out(bloks([wrap]), { kind: 'wrapped', wrap });
    }
    const of = elementComponents(el, parent, key);
    if (of) return out(bloks(of), { kind: 'many', of });
  }
  throw new Error(`${parent}.${key}: no Storyblok mapping for ${n}`);
}

for (const [collection, schema] of Object.entries(collections)) register(schema, CONTENT_TYPES[collection], { root: true });

const model = {
  $comment: 'Generated by scripts/storyblok/generate.mjs from src/lib/schema.ts. Do not edit.',
  contentTypes: CONTENT_TYPES,
  folders: FOLDERS,
  components: [...components.values()]
    .sort((a, b) => a.component.name.localeCompare(b.component.name))
    .map(({ component, map }) => ({ ...component, map })),
};
const json = JSON.stringify(model, null, 2) + '\n';
const target = 'storyblok/model.json';

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== json) {
    console.error(`${target} is out of date: run npm run storyblok:generate`);
    process.exit(1);
  }
  console.log(`${target} is up to date (${model.components.length} components)`);
} else {
  await mkdir('storyblok', { recursive: true });
  await writeFile(target, json);
  console.log(`Wrote ${target}: ${model.components.length} components`);
}
