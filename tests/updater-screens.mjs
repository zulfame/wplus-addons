// The update screens, the way a person uses them, against a fake GitHub: the Update now button on Settings > WPlus Addons, the
// Plugins screen (update notice, version details, Update now), Check now, a wrong checksum. Installing an update replaces the plugin
// folder, so this only runs on the clean site (tests/clean-site.sh), never on a git checkout, and it is the last test of run-all.
import fs from 'fs';
import path from 'path';
import { php, ok, summary, launch, sleep, WP_ROOT } from './lib.mjs';
import { startFakeGithub, installFakeMuPlugin } from './fake-github.mjs';

const PLUGIN_DIR = path.join(WP_ROOT, 'wp-content/plugins/wplus-addons');
if (fs.existsSync(path.join(PLUGIN_DIR, '.git'))) {
  console.log('SKIP: the plugin folder here is a git checkout; run this on the clean site (tests/clean-site.sh)');
  process.exit(0);
}
const FILE = 'wplus-addons/wplus-addons.php';
const SETTINGS = '/wp-admin/options-general.php?page=wplus-addons';
const version = () => php('require_once ABSPATH."wp-admin/includes/plugin.php"; echo get_plugin_data(WP_PLUGIN_DIR."/' + FILE + '",false,false)["Version"];');
const active = () => php('require_once ABSPATH."wp-admin/includes/plugin.php"; echo is_plugin_active("' + FILE + '") ? "yes" : "no";') === 'yes';
const marker = () => fs.existsSync(path.join(PLUGIN_DIR, 'marker.txt')) ? fs.readFileSync(path.join(PLUGIN_DIR, 'marker.txt'), 'utf8') : '';
const reset = () => php('delete_site_transient("wplus_addons_latest_release"); delete_site_transient("update_plugins");');
const waitVersion = async (v, ms = 90000) => { const end = Date.now() + ms; while (Date.now() < end) { if (version() === v) return true; await sleep(1000); } return false; };

const CUR = version();
const gh = await startFakeGithub({ pluginDir: PLUGIN_DIR, current: CUR });
const removeMu = installFakeMuPlugin(WP_ROOT);
const { browser, open, errors } = await launch();
php('update_option("wplus_addons_modules",["thumbnail"=>true]); update_option("wplus_addons_thumbnail_presets",["default"=>"x","items"=>[["id"=>"x","name"=>"Kept","settings"=>[]]]]);');
const text = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
try {
  // 1) a wrong checksum is refused
  const bad = gh.makeZip('9.9.7', 'must-not-arrive');
  gh.serve(gh.release('v9.9.7', { digest: 'sha256:' + 'b'.repeat(64) })); reset();
  let p = await open(1, SETTINGS);
  ok('the settings page offers version 9.9.7', /Version 9\.9\.7 is available/.test(await text(p)));
  await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 120000 }), p.evaluate(() => [...document.querySelectorAll('a.button-primary')].find((a) => /Update now/.test(a.textContent)).click())]);
  await sleep(1500);
  const refused = await text(p);
  ok('a wrong checksum is refused with a clear message; nothing changes', /does not match its checksum/.test(refused) && version() === CUR && marker() === '' && active(), refused.slice(0, 160));
  await p.close();
  // 2) the Update now button of the settings page
  const z1 = gh.makeZip('9.9.9', 'marker-9.9.9');
  gh.serve(gh.release('v9.9.9', { digest: 'sha256:' + z1.sha })); reset();
  p = await open(1, SETTINGS);
  ok('the settings page says version 9.9.9 is available and what you have', /Version 9\.9\.9 is available/.test(await text(p)) && new RegExp(`You have version ${CUR.replace(/\./g, '\\.')}`).test(await text(p)));
  await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 120000 }), p.evaluate(() => [...document.querySelectorAll('a.button-primary')].find((a) => /Update now/.test(a.textContent)).click())]);
  await waitVersion('9.9.9'); await sleep(5000); // the plugin is switched back on by the page itself, a moment after the update
  ok('Update now installs the new version and the plugin is active again', version() === '9.9.9' && marker() === 'marker-9.9.9' && active(), `${version()} active=${active()}`);
  ok('settings and presets survive the update', JSON.stringify(JSON.parse(php('echo json_encode(get_option("wplus_addons_modules"));'))) === '{"thumbnail":true}' && php('echo get_option("wplus_addons_thumbnail_presets")["items"][0]["name"];') === 'Kept');
  await p.close();
  // 3) the Plugins screen: update notice, version details, Update now (the screen updates in place)
  const z2 = gh.makeZip('9.9.10', 'marker-9.9.10');
  gh.serve(gh.release('v9.9.10', { digest: 'sha256:' + z2.sha, body: '- New: a visible thing.\n- Fix: a `quiet` thing.' })); reset();
  p = await open(1, '/wp-admin/plugins.php', { wait: 1500 });
  const row = await p.evaluate((file) => { const tr = document.querySelector(`tr.plugin-update-tr[data-plugin="${file}"]`); return tr ? tr.innerText.replace(/\s+/g, ' ') : ''; }, FILE);
  ok('the Plugins screen shows the update notice with a details link and an update link', /new version of WPlus Addons available/i.test(row) && /View version 9\.9\.10 details/i.test(row) && /update now/i.test(row), row.slice(0, 200));
  const autoToggle = await p.evaluate((file) => !!document.querySelector(`tr[data-plugin="${file}"] .toggle-auto-update`), FILE);
  ok('automatic updates can be switched on for the plugin', autoToggle);
  await p.evaluate((file) => document.querySelector(`tr.plugin-update-tr[data-plugin="${file}"] .update-link`).click(), FILE);
  ok('Update now on the Plugins screen installs 9.9.10', await waitVersion('9.9.10') && marker() === 'marker-9.9.10');
  await sleep(1500);
  ok('the plugin stays active after the update on the Plugins screen', active());
  await p.close();
  // 4) version details window
  reset();
  p = await open(1, '/wp-admin/plugin-install.php?tab=plugin-information&plugin=wplus-addons&section=changelog', { wait: 800 });
  const info = await text(p);
  ok('the version details window shows the plugin and the release notes', /WPlus Addons/.test(info) && /9\.9\.10/.test(info) && /a visible thing/.test(info), info.slice(0, 200));
  await p.close();
  // 5) Check now
  gh.serve(gh.release('v9.9.11', { digest: 'sha256:' + gh.makeZip('9.9.11', 'x').sha })); // newer, but the stored answer still says 9.9.10
  p = await open(1, SETTINGS);
  ok('before Check now the page shows what it knew (up to date)', /latest version/.test(await text(p)));
  await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.evaluate(() => [...document.querySelectorAll('a.button')].find((a) => /Check now/.test(a.textContent)).click())]);
  const after = await text(p);
  ok('Check now asks again: "Checked just now" and the new version is offered', /Checked just now/.test(after) && /Version 9\.9\.11 is available/.test(after), after.slice(0, 160));
  await p.close();
} finally {
  removeMu();
  gh.stop();
  await browser.close();
}
summary(`page errors: ${errors.length}`);
