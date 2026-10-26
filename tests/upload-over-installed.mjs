// The one-time step for a site that has a version without dashboard updates: upload the new zip over the installed plugin
// (Plugins > Add New > Upload Plugin > "Replace current with uploaded"), exactly as a person would. Needs NEW_ZIP=<zip>.
// The settings and presets must survive and the plugin must be active afterwards. Run it on the clean site only (it replaces the folder).
import { php, ok, summary, launch, sleep } from './lib.mjs';

const zip = process.env.NEW_ZIP;
if (!zip) { console.log('set NEW_ZIP=<path of the new zip>'); process.exit(2); }
const { browser, open, errors } = await launch();
try {
  const before = php('require_once ABSPATH."wp-admin/includes/plugin.php"; echo get_plugin_data(WP_PLUGIN_DIR."/wplus-addons/wplus-addons.php",false,false)["Version"];');
  php('update_option("wplus_addons_modules",["thumbnail"=>true]); update_option("wplus_addons_thumbnail_presets",["default"=>"x","items"=>[["id"=>"x","name"=>"Kept","settings"=>[]]]]);');
  const p = await open(1, '/wp-admin/plugin-install.php?tab=upload', { wait: 800 });
  const input = await p.$('input[type=file]#pluginzip');
  await input.uploadFile(zip);
  await p.click('#install-plugin-submit');
  await p.waitForFunction(() => /already installed|Plugin installed successfully|Replace current/i.test(document.body.innerText), { timeout: 120000 });
  const text1 = await p.evaluate(() => document.body.innerText);
  ok('WordPress notices the plugin is already installed and offers to replace it', /already installed/i.test(text1) && /Replace current with uploaded/i.test(text1));
  await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 120000 }), p.evaluate(() => { [...document.querySelectorAll('a.button')].find((a) => /Replace current with uploaded/i.test(a.textContent)).click(); })]);
  await sleep(800);
  const text2 = await p.evaluate(() => document.body.innerText);
  ok('the replacement goes through without an error', /installed successfully|Plugin updated|successfully/i.test(text2) && !/error|could not|failed/i.test(text2.replace(/Plugin installation failed/g, 'x') ), text2.replace(/\s+/g, ' ').slice(0, 200));
  const after = JSON.parse(php('require_once ABSPATH."wp-admin/includes/plugin.php"; echo json_encode([get_plugin_data(WP_PLUGIN_DIR."/wplus-addons/wplus-addons.php",false,false)["Version"], is_plugin_active("wplus-addons/wplus-addons.php"), get_option("wplus_addons_modules"), wp_list_pluck(get_option("wplus_addons_thumbnail_presets")["items"],"name"), function_exists("wplus_addons_latest_release") || file_exists(WP_PLUGIN_DIR."/wplus-addons/includes/updater.php")]);'));
  ok('the new files are in place (the updater is there)', after[4] === true, JSON.stringify(after));
  ok('the plugin is still active and keeps its settings and presets', after[1] === true && after[2].thumbnail === true && after[3][0] === 'Kept', JSON.stringify(after.slice(1, 4)));
  console.log(`version before ${before}, after ${after[0]}`);
  php('delete_option("wplus_addons_modules"); delete_option("wplus_addons_thumbnail_presets");');
} finally {
  await browser.close();
}
summary(`page errors: ${errors.length}`);
