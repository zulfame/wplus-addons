// Language: the plugin follows the language of the user (English texts, Indonesian translation), in the pages and in the scripts.
import { php, ok, summary, launch, userLocale, TOOLS, BULK } from './lib.mjs';
import fs from 'fs';
import path from 'path';
import { WP_ROOT } from './lib.mjs';

const { browser, open, errors } = await launch();
const restore = userLocale(1, 'id_ID');
try {
  const mo = path.join(WP_ROOT, 'wp-content/plugins/wplus-addons/languages/wplus-addons-id_ID.mo');
  ok('the Indonesian translation file exists', fs.existsSync(mo) && fs.statSync(mo).size > 4000);
  const p = await open(1, TOOLS);
  const t = await p.evaluate(() => ({ tabs: [...document.querySelectorAll('.wpa-tabs a')].map((a) => a.textContent).join(), labels: [...document.querySelectorAll('.wpa-field label')].map((l) => l.textContent).join('|'), save: document.getElementById('wpa-save').textContent, preset: document.getElementById('wpa-preset').options[0].textContent }));
  ok('the Generator page is in Indonesian', t.tabs === 'Pembuat,Massal' && /Judul/.test(t.labels) && /Deskripsi/.test(t.labels) && t.save === 'Simpan ke Pustaka Media' && /Kustom/.test(t.preset), JSON.stringify(t));
  await p.close();
  const b = await open(1, BULK);
  const bt = await b.evaluate(() => document.body.innerText);
  ok('the Bulk tab is in Indonesian', /Buat gambarnya/.test(bt) && /Pengaturan terakhir saya/.test(bt), bt.slice(0, 80));
  await b.close();
  restore();
  const e = await open(1, TOOLS); // administrator back on English
  ok('and in English for an English user', (await e.evaluate(() => document.getElementById('wpa-save').textContent)) === 'Save to Media Library');
  await e.close();
} finally {
  restore();
  await browser.close();
}
summary(`page errors: ${errors.length}`);
