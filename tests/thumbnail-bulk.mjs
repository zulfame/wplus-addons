// Bulk tab: lists posts without a featured image, makes the ticked ones, skips what changed, can stop, respects permissions.
import { php, ok, summary, launch, attachmentCount, makeUser, BULK } from './lib.mjs';

const before = attachmentCount();
const author = makeUser('wpa_author_b', 'author');
const mk = (title, status, extra = '') => parseInt(php(`echo wp_insert_post(["post_title"=>"${title}","post_status"=>"${status}","post_content"=>"<!-- wp:paragraph --><p>Isi ${title} yang cukup panjang untuk deskripsi otomatis.</p><!-- /wp:paragraph -->"${extra}]);`), 10);
const p1 = mk('Uji Massal Satu', 'publish', ',"tags_input"=>["Alfa","Beta"]'), p2 = mk('Uji Massal Dua', 'publish'), p3 = mk('Uji Massal Tiga', 'draft'), p4 = mk('Uji Massal Empat', 'publish'), pNoTitle = mk('', 'draft'), pHas = mk('Uji Massal Sudah Ada', 'publish');
const pAuthor = parseInt(php(`echo wp_insert_post(["post_title"=>"Uji Massal Milik Penulis","post_status"=>"draft","post_author"=>${author}]);`), 10);
// a picture to give to a post (a clean site has none): made here, removed at the end because its title starts with "Uji Massal"
const existing = parseInt(php('require_once ABSPATH."wp-admin/includes/file.php"; require_once ABSPATH."wp-admin/includes/media.php"; require_once ABSPATH."wp-admin/includes/image.php"; $t=wp_tempnam("x.png"); $im=imagecreatetruecolor(400,200); imagefill($im,0,0,imagecolorallocate($im,30,90,200)); imagepng($im,$t); $id=media_handle_sideload(["name"=>"uji-massal-contoh.png","tmp_name"=>$t,"type"=>"image/png","size"=>filesize($t),"error"=>0],0,"Uji Massal Gambar Contoh"); echo $id;'), 10);
php(`set_post_thumbnail(${pHas}, ${existing});`);
const thumb = (id) => parseInt(php(`echo (int) get_post_thumbnail_id(${id});`), 10);
const { browser, open, errors } = await launch();
try {
  let p = await open(1, BULK, { wait: 1500 });
  const listed = await p.evaluate(() => [...document.querySelectorAll('.wpa-bulk-table tbody tr')].map((tr) => [parseInt(tr.dataset.id, 10), tr.querySelector('.wpb-pick').disabled]));
  const ids = listed.map((r) => r[0]);
  ok('posts without a featured image are listed', [p1, p2, p3, p4, pNoTitle, pAuthor].every((i) => ids.includes(i)), ids.length + ' rows');
  ok('a post that already has a featured image is not listed', !ids.includes(pHas));
  ok('a post without a title can not be ticked', listed.find((r) => r[0] === pNoTitle)[1] === true);
  const tick = (list) => p.evaluate((list) => { document.querySelectorAll('.wpb-pick').forEach((b) => { b.checked = list.includes(parseInt(b.value, 10)); }); document.querySelector('.wpa-bulk-table tbody').dispatchEvent(new Event('change', { bubbles: true })); }, list);
  php(`set_post_thumbnail(${p4}, ${existing});`); // gets one while the page is open
  await tick([p1, p2, p4]);
  const prev = await p.evaluate(() => { const c = document.getElementById('wpb-canvas'); return [c.width, c.height]; });
  ok('the preview is drawn', prev[0] === 1200 && prev[1] === 630, prev.join('x'));
  ok('Stop is hidden while nothing runs', await p.evaluate(() => getComputedStyle(document.getElementById('wpb-stop')).display === 'none'));
  await p.click('#wpb-start'); await p.waitForFunction(() => document.getElementById('wpb-progress').value >= 3, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 800));
  const t1 = thumb(p1), t2 = thumb(p2), t3 = thumb(p3), t4 = thumb(p4);
  ok('ticked posts got a featured image', t1 > 0 && t2 > 0 && t1 !== existing && t2 !== existing, `${t1} ${t2}`);
  ok('an unticked post is untouched', t3 === 0);
  ok('a post that got a picture meanwhile is skipped, not replaced', t4 === existing, String(t4));
  const meta = php(`foreach([${t1},${t2}] as $id){ $a=get_post($id); echo $a->post_parent,"|",$a->post_mime_type,"|",$a->post_title,"|",get_post_meta($id,"_wp_attachment_image_alt",true),";"; }`);
  ok('pictures are WebP, attached to their post, titled and with alt text', meta.includes(`${p1}|image/webp|Uji Massal Satu|Uji Massal Satu;`) && meta.includes(`${p2}|image/webp|Uji Massal Dua|Uji Massal Dua;`), meta);
  const cells = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wpa-bulk-table tbody tr')].map((tr) => [tr.dataset.id, tr.querySelector('.wpb-result').textContent.trim()])));
  ok('the result column tells what happened', /^\S+ #\d+$/.test(cells[p1]) && cells[p1] !== cells[p4] && cells[p4].length > 5, JSON.stringify([cells[p1], cells[p4]]));
  await tick([p3]); await p.evaluate(() => { document.getElementById('wpb-start').click(); document.getElementById('wpb-stop').click(); });
  await p.waitForFunction(() => !document.getElementById('wpb-start').disabled || document.getElementById('wpb-stop').hidden, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1000));
  ok('Stop ends the run and leaves the post alone', thumb(p3) === 0);
  await p.close();
  const a = await open(author, BULK, { wait: 1500 });
  const mine = await a.evaluate(() => [...document.querySelectorAll('.wpa-bulk-table tbody tr')].map((tr) => parseInt(tr.dataset.id, 10)));
  ok('an author lists only own posts', mine.includes(pAuthor) && !mine.includes(p3) && !mine.includes(p2), JSON.stringify(mine));
  const denied = await a.evaluate(async (id) => { try { await wp.apiFetch({ path: '/wp/v2/posts/' + id, method: 'POST', data: { featured_media: 0 } }); return 'allowed'; } catch (e) { return e.code; } }, p2);
  ok("an author can not change someone else's post through REST", denied !== 'allowed', denied);
  await a.close();
  const n = await open(1, BULK, { width: 390, wait: 1500 });
  const fit = await n.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, tabs: document.querySelectorAll('.wpa-tabs a').length }));
  ok('two tabs and no sideways scroll at 390px', fit.tabs === 2 && fit.sw <= fit.cw + 2, JSON.stringify(fit));
  await n.close();
} finally {
  php(`foreach([${p1},${p2},${p3},${p4},${pNoTitle},${pHas},${pAuthor}] as $id) wp_delete_post($id,true); foreach(get_posts(["post_type"=>"attachment","numberposts"=>-1,"post_status"=>"any"]) as $a){ if(strpos($a->post_title,"Uji Massal")===0) wp_delete_attachment($a->ID,true); } foreach(["alfa","beta"] as $t){ $x=get_term_by("slug",$t,"post_tag"); if($x) wp_delete_term($x->term_id,"post_tag"); } require_once ABSPATH."wp-admin/includes/user.php"; wp_delete_user(${author});`);
  await browser.close();
}
ok('no data left behind (media library back to its size)', attachmentCount() === before, before + ' -> ' + attachmentCount());
summary(`page errors: ${errors.length}`);
