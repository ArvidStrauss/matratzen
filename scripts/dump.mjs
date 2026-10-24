// Prints extracted content compactly (one line per block) for human/agent review.
import { readFile } from 'node:fs/promises';

const key = process.argv[2];
const part = process.argv[3] ?? 'sections';
const data = JSON.parse(await readFile(`reference/extracted/${key}.json`, 'utf8'));

const line = (b) => {
  if (b.type === 'img' || b.type === 'bg') return `  [${b.type}] ${b.src.replace('https://gesunde-matratzen.de/wp-content/uploads/', '')} ${b.width ?? ''}x${b.height ?? ''} alt="${b.alt ?? ''}"`;
  if (b.type === 'link') return `  [a] "${b.text}" -> ${b.href}${b.images ? ' imgs:' + b.images.map((i) => i.src.split('/').pop()).join(',') : ''}`;
  return `  [${b.type}] ${b.text ?? b.src}`;
};

if (part === 'menu') {
  const print = (items, d = 0) => items.forEach((i) => { console.log(`${'  '.repeat(d)}- ${i.label} -> ${i.href}`); if (i.children) print(i.children, d + 1); });
  print(data.mainMenu);
} else if (part === 'sections') {
  for (const s of data.sections) {
    console.log(`## section ${s.index}${s.id ? ' #' + s.id : ''}`);
    s.blocks.forEach((b) => console.log(line(b)));
  }
} else {
  data[part].forEach((b) => console.log(line(b)));
}
