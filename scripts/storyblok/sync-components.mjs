// Creates or updates the Storyblok components from storyblok/model.json (by name). Never deletes components.
// Usage: node scripts/storyblok/sync-components.mjs [--dry-run]
import { isDeepStrictEqual } from 'node:util';
import { loadModel, mapi } from './lib.mjs';

const dryRun = process.argv.includes('--dry-run');
const { model } = await loadModel();
const api = mapi();
const existing = new Map((await api.get('/components')).components.map((c) => [c.name, c]));

// Storyblok adds its own keys (field ids, timestamps); only compare what we set.
const subset = (ours, theirs) =>
  ours && typeof ours === 'object' && !Array.isArray(ours)
    ? Object.keys(ours).every((k) => subset(ours[k], theirs?.[k]))
    : isDeepStrictEqual(ours, theirs);
// A field removed from the model must trigger an update too.
const sameFields = (ours, theirs) => isDeepStrictEqual(Object.keys(ours.schema).sort(), Object.keys(theirs.schema ?? {}).sort());

const counts = { created: 0, updated: 0, unchanged: 0 };
for (const { map, ...component } of model.components) {
  const current = existing.get(component.name);
  if (current && subset(component, current) && sameFields(component, current)) {
    counts.unchanged++;
    continue;
  }
  console.log(`${current ? 'update' : 'create'} ${component.name}`);
  if (!dryRun) {
    if (current) await api.put(`/components/${current.id}`, { component: { ...component, id: current.id } });
    else await api.post('/components', { component });
  }
  counts[current ? 'updated' : 'created']++;
}
const extra = [...existing.keys()].filter((n) => !model.components.some((c) => c.name === n));
console.log(`${dryRun ? '[dry run] ' : ''}components: ${JSON.stringify(counts)}`);
if (extra.length) console.log(`In Storyblok but not in the model (left untouched): ${extra.join(', ')}`);
