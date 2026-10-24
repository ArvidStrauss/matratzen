// Runs a command with Storyblok draft content (cross-platform, PowerShell has no `VAR=x cmd`).
// Usage: node scripts/storyblok/env.mjs astro dev
import { spawn } from 'node:child_process';

const [cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CONTENT_SOURCE: 'storyblok', STORYBLOK_VERSION: 'draft' },
});
child.on('exit', (code) => process.exit(code ?? 1));
