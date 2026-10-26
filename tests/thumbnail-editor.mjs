// Block editor panel: preview from the post, one button makes the featured image, no title disables it, the default category is not a label.
import { php, ok, summary, launch, openEditor, sleep, attachmentCount } from './lib.mjs';

const before = attachmentCount();
const postId = parseInt(php('$id=wp_insert_post(["post_title"=>"Cara Mengubah Ukuran Taskbar Windows 11","post_status"=>"draft","post_excerpt"=>"Taskbar merupakan bagian dari antarmuka Windows.","post_content"=>"<!-- wp:paragraph --><p>Isi uji.</p><!-- /wp:paragraph -->","tags_input"=>["Windows","Registry"]]); echo $id;'), 10);
const emptyId = parseInt(php('echo wp_insert_post(["post_title"=>"","post_status"=>"draft","post_content"=>"<!-- wp:paragraph --><p>Tanpa judul.</p><!-- /wp:paragraph -->"]);'), 10);
const { browser, open, errors } = await launch();
const openPanel = async (p) => { await p.evaluate(() => { const b = [...document.querySelectorAll('.components-panel__body-title button')].find((x) => /Thumbnail/.test(x.textContent)); if (b && b.getAttribute('aria-expanded') === 'false') b.click(); }); await sleep(1500); };
try {
  const p = await openEditor(open, 1, postId);
  await openPanel(p);
  const panel = await p.evaluate(() => { const c = document.querySelector('.wplus-thumbnail-panel canvas'); const btn = document.querySelector('.wplus-thumbnail-panel .is-primary'); return { canvas: c ? [c.width, c.height] : null, button: btn && btn.textContent, disabled: btn && btn.disabled }; });
  ok('the panel draws a 1200 x 630 preview and offers the button', panel.canvas && panel.canvas[0] === 1200 && panel.canvas[1] === 630 && /Make the featured image/.test(panel.button) && panel.disabled === false, JSON.stringify(panel));
  await p.click('.wplus-thumbnail-panel .is-primary');
  await p.waitForFunction(() => wp.data.select('core/editor').getEditedPostAttribute('featured_media') > 0, { timeout: 60000 });
  const fm = await p.evaluate(() => wp.data.select('core/editor').getEditedPostAttribute('featured_media'));
  await sleep(800);
  ok('the button label becomes Replace once there is a picture', /Replace the featured image/.test(await p.evaluate(() => document.querySelector('.wplus-thumbnail-panel .is-primary').textContent)));
  const meta = php(`$m=get_post(${fm}); echo $m->post_parent,"|",$m->post_mime_type,"|",$m->post_title,"|",get_post_meta($m->ID,"_wp_attachment_image_alt",true),"|",$m->post_content;`);
  ok('the picture is a WebP attached to the post, with title, alt text and the excerpt as description', meta === `${postId}|image/webp|Cara Mengubah Ukuran Taskbar Windows 11|Cara Mengubah Ukuran Taskbar Windows 11|Taskbar merupakan bagian dari antarmuka Windows.`, meta);
  await p.close();
  const q = await openEditor(open, 1, emptyId); await openPanel(q);
  const empty = await q.evaluate(() => { const btn = document.querySelector('.wplus-thumbnail-panel .is-primary'); return { disabled: btn && btn.disabled, hint: (document.querySelector('.wplus-thumbnail-panel .description') || {}).textContent }; });
  ok('a post without a title can not get a picture', empty.disabled === true && /title/i.test(empty.hint || ''), JSON.stringify(empty));
  await q.close();
  const m = await openEditor(open, 1, postId, { width: 780, height: 900 }); await openPanel(m);
  ok('the preview fits a narrow screen', (await m.evaluate(() => { const c = document.querySelector('.wplus-thumbnail-panel canvas'); return c ? Math.round(c.getBoundingClientRect().width) : 0; })) > 200);
  await m.close();
} finally {
  php(`wp_delete_post(${postId},true); wp_delete_post(${emptyId},true); foreach(get_posts(["post_type"=>"attachment","numberposts"=>-1,"post_status"=>"any"]) as $a){ if(strpos($a->post_title,"Cara Mengubah Ukuran Taskbar Windows 11")===0) wp_delete_attachment($a->ID,true); } foreach(["windows","registry"] as $t){ $x=get_term_by("slug",$t,"post_tag"); if($x) wp_delete_term($x->term_id,"post_tag"); }`);
  await browser.close();
}
ok('no data left behind', attachmentCount() === before, before + ' -> ' + attachmentCount());
summary(`page errors: ${errors.length}`);
