// Content Delivery API (EU region): all stories of the space. Never logs the token.
const CACHE_MS = 5000;

/**
 * All stories (`version`: `draft` needs the preview token, `published` the public token).
 * Cached for a few seconds so the five collection loaders share one fetch.
 */
export function fetchStories({ token, version }) {
  const key = `${version}`;
  const cache = (globalThis.__storyblokStories ??= new Map());
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = fetchAll(token, version);
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

async function fetchAll(token, version) {
  const stories = [];
  // `cv` busts the CDN cache, so a build right after publishing sees the new content.
  const cv = Date.now();
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ version, per_page: '100', page: String(page), cv: String(cv) });
    const res = await fetch(`https://api.storyblok.com/v2/cdn/stories?${params}&token=${encodeURIComponent(token)}`);
    if (!res.ok) throw new Error(`Storyblok CDN ${version} stories page ${page}: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    stories.push(...data.stories);
    if (!data.stories.length || stories.length >= Number(res.headers.get('total') ?? stories.length)) return stories;
  }
}
