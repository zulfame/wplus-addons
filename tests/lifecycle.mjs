// The life of the plugin: tools can be switched off and on, an unavailable tool can not be switched on, deactivating and activating is clean,
// and deleting the plugin removes its settings.
import { php, ok, summary, launch, openEditor, TOOLS, BULK } from './lib.mjs';

const keep = php('echo json_encode(get_option("wplus_addons_modules", null));');
const { browser, open, errors } = await launch();
let postId = 0;
try {
  postId = parseInt(php('echo wp_insert_post(["post_title"=>"Lifecycle test","post_status"=>"draft"]);'), 10);
  const state = async (url) => { const p = await open(1, url, { wait: 600 }); const t = await p.evaluate(() => document.body.innerText.slice(0, 6000)); const menu = await p.evaluate(() => !![...document.querySelectorAll('#adminmenu a')].find((a) => /page=wplus-thumbnail/.test(a.getAttribute('href') || ''))); await p.close(); return { text: t, menu }; };
  php('delete_option("wplus_addons_modules");');
  let s = await state(TOOLS);
  ok('on a fresh install the thumbnail tool is on (Tools menu and page)', s.menu && /Thumbnail generator/.test(s.text), s.text.slice(0, 60).replace(/\n/g, " "));
  php('update_option("wplus_addons_modules", ["thumbnail"=>false,"shield"=>false]);');
  s = await state(TOOLS);
  ok('switched off: no menu entry and the page is closed', !s.menu && !/Thumbnail generator/.test(s.text), s.text.slice(0, 80).replace(/\n/g, " "));
  s = await state(BULK);
  ok('switched off: the Bulk tab is closed too', !/Make the pictures/.test(s.text));
  const e = await openEditor(open, 1, postId);
  ok('switched off: the editor has no Thumbnail panel', (await e.evaluate(() => typeof window.wplusThumbEditor)) === 'undefined');
  await e.close();
  php('update_option("wplus_addons_modules", ["thumbnail"=>true]);');
  const e2 = await openEditor(open, 1, postId);
  ok('switched on again: the editor panel is back', (await e2.evaluate(() => typeof window.wplusThumbEditor)) === 'object');
  await e2.close();
  const clean = JSON.parse(php('echo json_encode(wplus_addons_sanitize_modules(["thumbnail"=>"1","shield"=>"1","evil"=>"1"]));'));
  ok('an unavailable tool can not be switched on, unknown tools are dropped', clean.thumbnail === true && clean.shield === false && !('evil' in clean), JSON.stringify(clean));
  const cycle = php('require_once ABSPATH."wp-admin/includes/plugin.php"; deactivate_plugins("wplus-addons/wplus-addons.php"); $off=is_plugin_active("wplus-addons/wplus-addons.php"); $r=activate_plugin("wplus-addons/wplus-addons.php"); echo json_encode([$off,is_wp_error($r),is_plugin_active("wplus-addons/wplus-addons.php")]);');
  ok('deactivating and activating gives no error', cycle === '[false,false,true]', cycle);
  const gone = php('update_option("wplus_addons_modules",["thumbnail"=>true]); update_option("wplus_addons_thumbnail_presets",["default"=>"a","items"=>[["id"=>"a","name"=>"A","settings"=>[]]]]); define("WP_UNINSTALL_PLUGIN","wplus-addons/wplus-addons.php"); include WP_PLUGIN_DIR."/wplus-addons/uninstall.php"; echo json_encode([get_option("wplus_addons_modules",null),get_option("wplus_addons_thumbnail_presets",null)]);');
  ok('deleting the plugin removes its settings', gone === '[null,null]', gone);
} finally {
  php(`${keep === 'null' ? 'delete_option("wplus_addons_modules");' : `update_option("wplus_addons_modules", json_decode('${keep}', true));`} ${postId ? `wp_delete_post(${postId},true);` : ''}`);
  await browser.close();
}
summary(`page errors: ${errors.length}`);
