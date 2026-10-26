// Security check: every judgement, with the site changed to make each one green, yellow and red; the file check with real files; it only
// reads; it only asks the site's own address; who may see it and press its button.
import fs from 'fs';
import path from 'path';
import { php, ok, summary, launch, makeUser, WP_ROOT, sleep } from './lib.mjs';

const keepModules = php('echo json_encode(get_option("wplus_addons_modules", null));');
const editor = makeUser('wpa_editor_test', 'editor');
const dummyDir = path.join(WP_ROOT, 'wp-content/plugins/wpa-dummy-plugin');
const envFile = path.join(WP_ROOT, '.env');
const logFile = path.join(WP_ROOT, 'wp-content/debug.log');
const logBefore = fs.existsSync(logFile) ? fs.readFileSync(logFile) : null;
const EN = 'switch_to_locale("en_US");';
const checks = (setup = '') => JSON.parse(php(`${EN}wp_set_current_user(1);${setup} echo json_encode(array_column(wplus_addons_health_checks(),null,"id"));`));
const origAdmin = php('$u=get_user_by("login","admin"); echo $u ? $u->ID : 0;');
const { browser, open, errors } = await launch();
try {
  php('update_option("wplus_addons_modules", ["thumbnail"=>true,"shield"=>true]);');
  // the pure judgements
  const j = JSON.parse(php('$n=strtotime("2026-10-26 12:00:00 UTC"); echo json_encode([wplus_addons_health_php_status("7.4.33",$n),wplus_addons_health_php_status("8.1.30",$n),wplus_addons_health_php_status("8.2.20",$n),wplus_addons_health_php_status("8.3.9",$n),wplus_addons_health_php_status("8.5.0",$n),wplus_addons_health_php_status("9.9.0",$n),wplus_addons_health_php_status("5.6.40",$n),wplus_addons_health_debug_status(false,true),wplus_addons_health_debug_status(true,false),wplus_addons_health_debug_status(true,true),wplus_addons_health_registration_status(false,"administrator"),wplus_addons_health_registration_status(true,"subscriber"),wplus_addons_health_registration_status(true,"contributor"),wplus_addons_health_registration_status(true,"editor"),wplus_addons_health_registration_status(true,"administrator")]);'));
  ok('PHP: an ended version is red, one that ends within six months is yellow, supported ones are green', j.slice(0, 7).join() === 'bad,bad,warn,good,good,good,bad', j.slice(0, 7).join());
  ok('debug mode: off is fine, on is yellow, shown to visitors is red', j.slice(7, 10).join() === 'good,warn,bad', j.slice(7, 10).join());
  ok('registration: closed or subscriber is fine, contributor yellow, editor or administrator red', j.slice(10).join() === 'good,good,warn,bad,bad', j.slice(10).join());
  // the site changed, one thing at a time
  let c = checks();
  ok('the list is sorted: red first, then yellow, then green', (() => { const rank = { bad: 0, warn: 1, good: 2 }; const list = Object.values(c).map((x) => rank[x.status]); return list.every((v, i) => i === 0 || list[i - 1] <= v); })());
  // 1 admin user
  if (origAdmin !== '0') php(`global $wpdb; $wpdb->update($wpdb->users,["user_login"=>"wpa-orig-admin"],["ID"=>${origAdmin}]); clean_user_cache(${origAdmin});`);
  ok('no administrator called admin: green', checks().adminuser.status === 'good');
  const tmpAdmin = parseInt(php('echo wp_insert_user(["user_login"=>"admin","user_pass"=>"x-Test-9aQ!zz","user_email"=>"wpa-admin@example.invalid","role"=>"administrator"]);'), 10);
  ok('an administrator called admin: yellow, with a link to Users', checks().adminuser.status === 'warn' && /users\.php/.test(checks().adminuser.action[1]));
  php(`require_once ABSPATH."wp-admin/includes/user.php"; wp_delete_user(${tmpAdmin});`);
  if (origAdmin !== '0') php(`global $wpdb; $wpdb->update($wpdb->users,["user_login"=>"admin"],["ID"=>${origAdmin}]); clean_user_cache(${origAdmin});`);
  // 2 plugins that are not used, and updates waiting
  fs.mkdirSync(dummyDir, { recursive: true });
  fs.writeFileSync(path.join(dummyDir, 'wpa-dummy-plugin.php'), '<?php\n/**\n * Plugin Name: Wpa Dummy Plugin\n * Version: 1.0\n */\n');
  c = checks();
  ok('a plugin that is installed but not used: yellow, and it is named', c.inactive.status === 'warn' && /Wpa Dummy Plugin/.test(c.inactive.text), c.inactive.text.slice(0, 120));
  c = checks('set_site_transient("update_plugins",(object)["last_checked"=>time(),"response"=>["wpa-dummy-plugin/wpa-dummy-plugin.php"=>(object)["new_version"=>"2.0","plugin"=>"wpa-dummy-plugin/wpa-dummy-plugin.php"]],"no_update"=>[],"translations"=>[]]);');
  ok('an update waiting for a plugin: yellow, and the plugin is named', c.updates.status === 'warn' && /Wpa Dummy Plugin/.test(c.updates.text), c.updates.text.slice(0, 120));
  php('delete_site_transient("update_plugins");');
  fs.rmSync(dummyDir, { recursive: true, force: true });
  ok('without the dummy plugin it is gone from both lists', !/Wpa Dummy/.test(checks().inactive.text) && !/Wpa Dummy/.test(checks().updates.text));
  // 3 WordPress itself
  c = checks('set_site_transient("update_core",(object)["last_checked"=>time(),"updates"=>[(object)["response"=>"upgrade","current"=>"99.0.1"]],"version_checked"=>get_bloginfo("version")]);');
  ok('a newer WordPress: yellow, and the version is named', c.core.status === 'warn' && /99\.0\.1/.test(c.core.text), c.core.text.slice(0, 100));
  php('delete_site_transient("update_core");');
  ok('no newer WordPress: green', checks().core.status === 'good');
  // 4 registration
  const reg = (open_, role) => checks(`update_option("users_can_register", ${open_}); update_option("default_role", "${role}");`).register.status;
  const keepReg = php('echo json_encode([get_option("users_can_register"), get_option("default_role")]);');
  const regs = [reg(0, 'subscriber'), reg(1, 'subscriber'), reg(1, 'author'), reg(1, 'editor')];
  const [kr, kd] = JSON.parse(keepReg); php(`update_option("users_can_register", "${kr}"); update_option("default_role", "${kd}");`);
  ok('registration through the site: closed and subscriber green, author yellow, editor red', regs.join() === 'good,good,warn,bad', regs.join());
  // 5 other plugins that do the work
  const keepActive = php('echo json_encode(get_option("active_plugins"));');
  c = checks('update_option("active_plugins", array_merge((array) get_option("active_plugins"), ["wordfence/wordfence.php","updraftplus/updraftplus.php"]));');
  php(`update_option("active_plugins", json_decode('${keepActive}', true));`);
  ok('a known security plugin and a known backup plugin are recognised by name', c.securityplugin.status === 'good' && /Wordfence/.test(c.securityplugin.text) && c.backup.status === 'good' && /UpdraftPlus/.test(c.backup.text), `${c.securityplugin.status} ${c.backup.status}`);
  ok('without them: both are yellow with a link to find one', checks().securityplugin.status === 'warn' && checks().backup.status === 'warn' && /plugin-install\.php/.test(checks().backup.action[1]));
  // 6 the switches of this tool
  php('update_option("wplus_addons_shield", ["file_edit"=>false]); update_option("wplus_addons_login", ["enabled"=>false]);');
  c = checks();
  ok('file editor open and failed logins not limited: both yellow, pointing to the switches', c.fileedit.status === 'warn' && c.login.status === 'warn' && /wplus-security/.test(c.fileedit.action[1]));
  php('update_option("wplus_addons_shield", ["file_edit"=>true]); update_option("wplus_addons_login", ["enabled"=>true,"max"=>5,"window"=>15,"lock"=>15,"proxy"=>"none","allow"=>""]);');
  c = checks();
  ok('and green when they are on', c.fileedit.status === 'good' && c.login.status === 'good');
  php('delete_option("wplus_addons_shield"); delete_option("wplus_addons_login");');
  // it only reads
  const hash = () => php('global $wpdb; echo $wpdb->get_var("SELECT MD5(GROUP_CONCAT(option_name, option_value ORDER BY option_name)) FROM $wpdb->options WHERE option_name NOT LIKE \'%transient%\'");');
  const h1 = hash(); checks(); checks(); const h2 = hash();
  ok('reading the checks changes nothing in the site settings', h1 === h2);
  ok('every action link stays inside the dashboard', Object.values(checks()).filter((x) => x.action).every((x) => x.action[1].startsWith(php('echo admin_url();'))));
  // the file check: only the site's own address, and no false alarm from a page that answers 200 to everything
  const asked = JSON.parse(php('$u=[]; add_filter("pre_http_request",function($p,$a,$url) use (&$u){ $u[]=$url; return ["headers"=>[],"body"=>"<html>Not found</html>","response"=>["code"=>200,"message"=>"OK"],"cookies"=>[],"filename"=>null]; },10,3); $r=wplus_addons_health_exposed(); echo json_encode([$u,$r["found"],home_url(),count(wplus_addons_health_exposed_paths())]);'));
  ok('the file check asks only the address of the site, and a page that says 200 to everything is not taken for a leak', asked[0].length === asked[3] && asked[3] >= 10 && asked[0].every((u) => u.startsWith(asked[2])) && asked[1].length === 0, `${asked[0].length} requests, found ${asked[1].length}`);
  const fake = JSON.parse(php('add_filter("pre_http_request",function($p,$a,$url){ $body=substr($url,-5)==="/.env" ? "DB_PASSWORD=secret\n" : "<html>x</html>"; return ["headers"=>[],"body"=>$body,"response"=>["code"=>200,"message"=>"OK"],"cookies"=>[],"filename"=>null]; },10,3); echo json_encode(wplus_addons_health_exposed()["found"]);'));
  ok('a real-looking .env is recognised', fake.length === 1 && fake[0] === '/.env', JSON.stringify(fake));
  // the page
  php('delete_transient("wplus_addons_health_files");'); // what the two checks above stored
  fs.writeFileSync(envFile, 'DB_PASSWORD=secret\nAPI_KEY=abc\n');
  fs.writeFileSync(logFile, '[26-Oct-2026 10:00:00 UTC] PHP Warning:  something in /x/y.php on line 1\n');
  const p = await open(1, '/wp-admin/options-general.php?page=wplus-security&tab=check', { wait: 1000 });
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.wpa-tabs a')].map((a) => a.textContent).join('|'));
  ok('the page has the two tabs and a summary', tabs === 'Switches|Security check' && /\d+ need attention, \d+ worth a look, \d+ fine\./.test(await p.evaluate(() => document.getElementById('wpa-health-summary').textContent)), tabs);
  ok('before the button is pressed there is no file result', !(await p.evaluate(() => !!document.querySelector('[data-check="files"]'))));
  await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 90000 }), p.click('#wpa-check-files')]);
  await sleep(500);
  const filesCard = await p.evaluate(() => { const el = document.querySelector('[data-check="files"]'); return el ? { status: el.dataset.status, text: el.innerText.replace(/\s+/g, ' ') } : null; });
  ok('with a real .env and debug.log in the site, the check says red and names both', filesCard && filesCard.status === 'bad' && /\/\.env/.test(filesCard.text) && /debug\.log/.test(filesCard.text), filesCard && filesCard.text.slice(0, 160));
  ok('the summary and the first card agree: the red one comes first', (await p.evaluate(() => document.querySelector('.wpa-check').dataset.status)) === 'bad');
  fs.rmSync(envFile, { force: true });
  if (logBefore === null) fs.rmSync(logFile, { force: true }); else fs.writeFileSync(logFile, logBefore);
  await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 90000 }), p.click('#wpa-check-files')]);
  const after = await p.evaluate(() => { const el = document.querySelector('[data-check="files"]'); return el ? { status: el.dataset.status, text: el.innerText } : null; });
  // what this copy of the site really leaks by itself (a git checkout served as a site; a debug log that already holds PHP warnings)
  const hasGit = fs.existsSync(path.join(WP_ROOT, '.git'));
  const hasLog = logBefore !== null && /PHP (Warning|Notice|Fatal|Deprecated)|^\[\d{2}-\w{3}-\d{4}/m.test(logBefore.subarray(0, 2048).toString());
  const real = hasGit || hasLog;
  ok(real ? 'after removing the test files only the real leaks of this copy are left (.git, an old debug.log), and not the .env' : 'after removing them the check is green', real ? after.status === 'bad' && !/\.env/.test(after.text) && (!hasGit || /\.git\/HEAD/.test(after.text)) && (!hasLog || /debug\.log/.test(after.text)) : after.status === 'good', JSON.stringify(after).slice(0, 200));
  await p.close();
  // who may use it
  const e = await open(editor, '/wp-admin/options-general.php?page=wplus-security&tab=check', { wait: 300 });
  ok('an editor can not see the page', /not allowed|tak diizinkan/i.test(await e.evaluate(() => document.body.innerText)));
  const run = await e.evaluate(async () => (await fetch('/wp-admin/admin-post.php?action=wplus_addons_health_files', { redirect: 'manual' })).status);
  ok('and can not run the file check', run === 403 || run === 400, String(run));
  await e.close();
  const p2 = await open(1, '/wp-admin/', { wait: 300 });
  const bad = await p2.evaluate(async () => (await fetch('/wp-admin/admin-post.php?action=wplus_addons_health_files&_wpnonce=bad', { redirect: 'manual' })).status);
  ok('the file check refuses a wrong nonce', bad === 403, String(bad));
  await p2.close();
  php('update_option("wplus_addons_modules", ["thumbnail"=>true,"shield"=>false]);');
  const closed = await open(1, '/wp-admin/options-general.php?page=wplus-security&tab=check', { wait: 300 });
  ok('with the security tool switched off the page is closed', /not allowed|tak diizinkan/i.test(await closed.evaluate(() => document.body.innerText)));
  await closed.close();
} finally {
  fs.rmSync(envFile, { force: true });
  if (logBefore === null) fs.rmSync(logFile, { force: true }); else fs.writeFileSync(logFile, logBefore);
  fs.rmSync(dummyDir, { recursive: true, force: true });
  php('delete_site_transient("update_plugins"); delete_site_transient("update_core"); delete_transient("wplus_addons_health_files");');
  php(`${keepModules === 'null' ? 'delete_option("wplus_addons_modules");' : `update_option("wplus_addons_modules", json_decode('${keepModules}', true));`} require_once ABSPATH."wp-admin/includes/user.php"; wp_delete_user(${editor});`);
  await browser.close();
}
summary(`page errors: ${errors.length}`);
