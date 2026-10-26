// Generator page: WebP is the default, the export is a real WebP or PNG file, Save puts it in the Media Library with title/alt/description,
// and only people who may upload files can use the page or the REST endpoint.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { php, ok, summary, launch, setField, sleep, makeUser, attachmentCount, TOOLS } from './lib.mjs';

const before = attachmentCount();
const sub = makeUser('wpa_sub_test', 'subscriber');
const dl = fs.mkdtempSync(path.join(os.tmpdir(), 'wpa-dl-'));
const { browser, open, errors } = await launch();
try {
  const p = await open(1, TOOLS);
  await p.evaluate(() => { try { localStorage.removeItem('wplusThumb.v1'); } catch (e) {} });
  await p.reload({ waitUntil: 'load' }); await sleep(1200);
  ok('WebP is the default file type', (await p.evaluate(() => document.getElementById('wpa-format').value)) === 'webp');
  ok('the tabs are there', (await p.evaluate(() => [...document.querySelectorAll('.wpa-tabs a')].map((a) => a.textContent).join())) === 'Generator,Bulk');
  const cdp = await p.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl, browserContextId: p.browserContext().id });
  await setField(p, 'title', 'Uji Ekspor Media'); await setField(p, 'description', 'Deskripsi uji untuk gambar.'); await sleep(500);
  await p.click('#wpa-export'); await sleep(1500);
  await p.select('#wpa-format', 'png'); await p.click('#wpa-export'); await sleep(1500);
  const files = fs.readdirSync(dl);
  const head = (f) => fs.readFileSync(path.join(dl, f)).subarray(0, 12).toString('latin1');
  const webp = files.find((f) => f.endsWith('.webp')), png = files.find((f) => f.endsWith('.png'));
  ok('the export is a real WebP file named after the title', webp === 'uji-ekspor-media-thumbnail.webp' && head(webp).startsWith('RIFF') && head(webp).endsWith('WEBP'), JSON.stringify(files));
  ok('the PNG export is a real PNG file', !!png && head(png).includes('PNG'));
  ok('WebP is much lighter than PNG for the same picture', fs.statSync(path.join(dl, webp)).size * 3 < fs.statSync(path.join(dl, png)).size, `${fs.statSync(path.join(dl, webp)).size} vs ${fs.statSync(path.join(dl, png)).size}`);
  await p.select('#wpa-format', 'webp');
  await p.click('#wpa-save'); await p.waitForFunction(() => document.getElementById('wpa-message').querySelector('a'), { timeout: 30000 });
  const att = php('$a=get_posts(["post_type"=>"attachment","numberposts"=>1,"post_status"=>"inherit","orderby"=>"ID","order"=>"DESC"])[0]; $m=wp_get_attachment_metadata($a->ID); echo $a->post_mime_type,"|",$a->post_title,"|",get_post_meta($a->ID,"_wp_attachment_image_alt",true),"|",$a->post_content,"|",$m["width"],"x",$m["height"],"|",count($m["sizes"])>0?"sizes":"nosizes";');
  ok('Save adds a 1200 x 630 WebP with title, alt text, description and sizes', att === 'image/webp|Uji Ekspor Media|Uji Ekspor Media|Deskripsi uji untuk gambar.|1200x630|sizes', att);
  await p.close();
  const s = await open(sub, TOOLS);
  ok('a subscriber is turned away from the page', /not allowed|tak diizinkan/i.test(await s.evaluate(() => document.body.innerText)));
  const rest = await s.evaluate(async () => { const r = await fetch('/?rest_route=/wp/v2/media', { method: 'POST', headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename=x.png' }, body: new Blob([new Uint8Array([137, 80, 78, 71])]) }); return r.status; });
  ok('a subscriber can not upload through REST', rest === 401 || rest === 403, String(rest));
  await s.close();
  const v = await open(0, '/', { wait: 300 });
  const visitor = await v.evaluate(async () => { const r = await fetch('/?rest_route=/wp/v2/media', { method: 'POST', headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename=x.png' }, body: new Blob([new Uint8Array([137, 80, 78, 71])]) }); return r.status; });
  ok('a visitor can not upload through REST', visitor === 401 || visitor === 403, String(visitor));
  await v.close();
} finally {
  php(`foreach(get_posts(["post_type"=>"attachment","numberposts"=>-1,"post_status"=>"any"]) as $a){ if(strpos($a->post_title,"Uji Ekspor Media")===0) wp_delete_attachment($a->ID,true); } require_once ABSPATH."wp-admin/includes/user.php"; wp_delete_user(${sub});`);
  fs.rmSync(dl, { recursive: true, force: true });
  await browser.close();
}
ok('no data left behind', attachmentCount() === before, before + ' -> ' + attachmentCount());
summary(`page errors: ${errors.length}`);
