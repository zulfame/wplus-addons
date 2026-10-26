// Run every test one after the other (they share one WordPress, so never in parallel) and print the totals.
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tests = ['updater', 'thumbnail-render', 'thumbnail-media', 'thumbnail-presets', 'thumbnail-editor', 'thumbnail-bulk', 'shield-hardening', 'shield-login', 'shield-health', 'lifecycle', 'i18n', 'updater-screens'];
let failed = 0;
for (const t of tests) {
  const r = spawnSync('node', [path.join(here, t + '.mjs')], { encoding: 'utf8', timeout: 600000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const sum = (out.match(/^SUMMARY .*$/m) || ['SUMMARY (no result)'])[0];
  const fails = out.split('\n').filter((l) => l.startsWith('FAIL'));
  console.log(`${t.padEnd(20)} ${sum}`);
  fails.forEach((l) => console.log('   ' + l.slice(0, 220)));
  if (r.status !== 0 || fails.length) failed++;
}
console.log(failed ? `${failed} test file(s) failed` : 'All tests passed');
process.exitCode = failed ? 1 : 0;
