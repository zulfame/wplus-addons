// Language: the plugin follows the language of the user (English texts, Indonesian translation), in the pages and in the scripts.
import { php, ok, summary, launch, userLocale, TOOLS, BULK } from './lib.mjs';
import fs from 'fs';
import path from 'path';
import { WP_ROOT } from './lib.mjs';

const keepModules = php('echo json_encode(get_option("wplus_addons_modules", null));');
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
  php('update_option("wplus_addons_modules", ["thumbnail"=>true,"shield"=>true]); delete_option("wplus_addons_shield");');
  const s = await open(1, '/wp-admin/options-general.php?page=wplus-security');
  const st = await s.evaluate(() => ({ tabs: [...document.querySelectorAll('.wpa-tabs a')].map((a) => a.textContent).join('|'), text: document.body.innerText }));
  ok('Settings > WPlus Security is in Indonesian (tabs, switches, login attempts)', st.tabs === 'Saklar|Pemeriksaan keamanan' && /Sembunyikan versi WordPress/.test(st.text) && /Matikan XML-RPC/.test(st.text) && /Percobaan login/.test(st.text) && /Batasi login yang gagal/.test(st.text) && /Jangan pernah kunci alamat ini/.test(st.text), st.tabs);
  await s.close();
  const c = await open(1, '/wp-admin/options-general.php?page=wplus-security&tab=check');
  const ct = await c.evaluate(() => document.body.innerText);
  ok('the Security check is in Indonesian (summary, cards, file check)', /perlu perhatian, \d+ layak dilihat, \d+ baik/.test(ct) && /WordPress (sudah terbaru|belum terbaru)/.test(ct) && /Berkas yang seharusnya rahasia/.test(ct) && /Periksa berkas sekarang/.test(ct) && !/need attention/.test(ct), ct.slice(0, 200).replace(/\s+/g, ' '));
  await c.close();
  const u = await open(1, '/wp-admin/options-general.php?page=wplus-addons');
  ok('Settings > WPlus Addons is in Indonesian too (the update box)', /Periksa sekarang/.test(await u.evaluate(() => document.body.innerText)));
  await u.close();
  restore();
  const e = await open(1, TOOLS); // administrator back on English
  ok('and in English for an English user', (await e.evaluate(() => document.getElementById('wpa-save').textContent)) === 'Save to Media Library');
  await e.close();
} finally {
  restore();
  php(keepModules === 'null' ? 'delete_option("wplus_addons_modules");' : `update_option("wplus_addons_modules", json_decode('${keepModules}', true));`);
  await browser.close();
}
summary(`page errors: ${errors.length}`);
