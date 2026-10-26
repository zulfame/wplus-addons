// Login attempt limit: lock after the allowed failures, even a right password is refused while locked, a good login starts the count
// again, the lock ends, the allow list, proxy headers (used only when chosen), the settings page, Unlock, who may unlock.
import { php, ok, summary, launch, makeUser, setField, BASE, sleep } from './lib.mjs';

const keep = Object.fromEntries(['wplus_addons_modules', 'wplus_addons_shield', 'wplus_addons_login', 'wplus_addons_login_state'].map((o) => [o, php(`echo json_encode(get_option("${o}", null));`)]));
const editor = makeUser('wpa_editor_test', 'editor');
const PASS = 'Right-Pass-123!';
const user = makeUser('wpa_login_user', 'subscriber');
php(`wp_set_password("${PASS}", ${user});`);
const setLogin = (o) => php(`update_option("wplus_addons_login", ${o});`);
const reset = () => php('delete_option("wplus_addons_login_state");');
const tool = (on) => php(`update_option("wplus_addons_modules", ["thumbnail"=>true,"shield"=>${on ? 'true' : 'false'}]);`);
const attempt = async (name, pass, headers = {}) => {
  const r = await fetch(BASE + '/wp-login.php?wp_lang=en_US', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'wordpress_test_cookie=WP%20Cookie%20check', ...headers }, body: `log=${encodeURIComponent(name)}&pwd=${encodeURIComponent(pass)}&wp-submit=Log+In&testcookie=1` });
  const text = await r.text(); const box = /<div id="login_error"[\s\S]*?<\/div>/.exec(text);
  return { status: r.status, ok: r.status === 302 && /wordpress_logged_in/.test(r.headers.get('set-cookie') || ''), msg: box ? box[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '' };
};
const fails = async (n, name = 'wpa_login_user', headers = {}) => { for (let i = 0; i < n; i++) await attempt(name, 'wrong-' + i, headers); };
const LOCKED = /Too many failed logins\. Try again in \d+ minutes?\./;
const { browser, open, errors } = await launch();
try {
  tool(true); php('update_option("wplus_addons_shield", ["login_msg"=>true]);'); php('delete_option("wplus_addons_login");'); reset();
  // the starting values: 5 failures lock
  await fails(4);
  ok('four failures: not locked yet, the right password works', (await attempt('wpa_login_user', PASS)).ok);
  reset();
  await fails(5);
  const lockedRight = await attempt('wpa_login_user', PASS);
  ok('the fifth failure locks: even the right password is refused now', !lockedRight.ok && LOCKED.test(lockedRight.msg), lockedRight.msg);
  const lockedUnknown = await attempt('nobody-at-all', 'x');
  ok('an unknown user name gets exactly the same message (nothing to learn)', lockedUnknown.msg === lockedRight.msg, lockedUnknown.msg);
  // a good login starts again
  reset(); await fails(3);
  ok('three failures then the right password: in', (await attempt('wpa_login_user', PASS)).ok);
  await fails(4);
  ok('and the count began again: four more failures do not lock', (await attempt('wpa_login_user', PASS)).ok);
  // the lock ends
  reset(); await fails(5);
  php('$s=get_option("wplus_addons_login_state"); foreach($s as $k=>$r){ $s[$k]["until"]=time()-5; $s[$k]["first"]=time()-3600; } update_option("wplus_addons_login_state",$s);');
  ok('when the time is over the address can log in again', (await attempt('wpa_login_user', PASS)).ok);
  // an empty form is not a failure
  reset(); for (let i = 0; i < 10; i++) await attempt('wpa_login_user', '');
  ok('an empty password does not count as a failed login', (await attempt('wpa_login_user', PASS)).ok);
  // the allow list
  reset(); setLogin('["enabled"=>true,"max"=>5,"window"=>15,"lock"=>15,"proxy"=>"none","allow"=>"127.0.0.1\\n::1"]');
  await fails(9);
  ok('an address on the allow list is never locked', (await attempt('wpa_login_user', PASS)).ok);
  // proxy: Cloudflare header, used only when chosen
  reset(); setLogin('["enabled"=>true,"max"=>5,"window"=>15,"lock"=>15,"proxy"=>"cf","allow"=>""]');
  await fails(5, 'wpa_login_user', { 'CF-Connecting-IP': '203.0.113.5' });
  const a = await attempt('wpa_login_user', PASS, { 'CF-Connecting-IP': '203.0.113.5' });
  const b = await attempt('wpa_login_user', PASS, { 'CF-Connecting-IP': '203.0.113.9' });
  ok('with the Cloudflare header chosen, only the reported address is locked, others still log in', !a.ok && LOCKED.test(a.msg) && b.ok, `${a.msg} | other ok=${b.ok}`);
  reset(); await fails(5, 'wpa_login_user', { 'CF-Connecting-IP': 'not-an-address' });
  ok('a header that is not an address is ignored (the connection address is used)', !(await attempt('wpa_login_user', PASS)).ok);
  reset(); setLogin('["enabled"=>true,"max"=>5,"window"=>15,"lock"=>15,"proxy"=>"none","allow"=>""]');
  for (let i = 0; i < 5; i++) await attempt('wpa_login_user', 'wrong', { 'CF-Connecting-IP': '198.51.100.' + (10 + i), 'X-Forwarded-For': '192.0.2.' + (10 + i) });
  const spoof = await attempt('wpa_login_user', PASS, { 'CF-Connecting-IP': '198.51.100.99' });
  ok('without a proxy chosen, fake headers do not help an attacker to escape the lock', !spoof.ok && LOCKED.test(spoof.msg), spoof.msg);
  // switched off
  reset(); setLogin('["enabled"=>false,"max"=>5,"window"=>15,"lock"=>15,"proxy"=>"none","allow"=>""]'); await fails(8);
  ok('switched off: no lock', (await attempt('wpa_login_user', PASS)).ok);
  reset(); setLogin('["enabled"=>true,"max"=>5,"window"=>15,"lock"=>15,"proxy"=>"none","allow"=>""]'); tool(false); await fails(8);
  ok('the security tool switched off: no lock either', (await attempt('wpa_login_user', PASS)).ok);
  tool(true); reset();
  // the settings page
  let p = await open(1, '/wp-admin/options-general.php?page=wplus-security');
  ok('the page shows the address the plugin sees', /The plugin sees you as (127\.0\.0\.1|::1)/.test(await p.evaluate(() => document.body.innerText)));
  await setField(p, 'login-max', '99', 'wplus-'); await setField(p, 'login-window', '10', 'wplus-'); await setField(p, 'login-lock', '0', 'wplus-'); await setField(p, 'login-proxy', 'cf', 'wplus-'); await setField(p, 'login-allow', '10.0.0.1\nnot-an-ip\n10.0.0.2\n10.0.0.1', 'wplus-');
  // the browser itself refuses 99 where 20 is the most; switch its check off to see that the server also keeps the limits
  await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.evaluate(() => { document.querySelector('form[action="options.php"]').noValidate = true; document.querySelector('#submit').click(); })]);
  const saved = JSON.parse(php('echo json_encode(get_option("wplus_addons_login"));'));
  ok('saved values are kept inside the limits, the proxy is stored, the allow list holds only real addresses once each', saved.max === 20 && saved.window === 10 && saved.lock === 1 && saved.proxy === 'cf' && saved.allow === "10.0.0.1\n10.0.0.2" && saved.enabled === true, JSON.stringify(saved));
  await p.close();
  const clean = JSON.parse(php('echo json_encode([wplus_addons_login_sanitize(["max"=>"abc","proxy"=>"evil","enabled"=>"1"]), wplus_addons_login_sanitize(null)]);'));
  ok('bad input falls back to the starting values', clean[0].max === 5 && clean[0].proxy === 'none' && clean[0].enabled === true && clean[1].max === 5 && clean[1].enabled === false, JSON.stringify(clean).slice(0, 160));
  // the locked list, Unlock and who may unlock
  setLogin('["enabled"=>true,"max"=>3,"window"=>15,"lock"=>15,"proxy"=>"none","allow"=>""]'); reset(); await fails(3);
  p = await open(1, '/wp-admin/options-general.php?page=wplus-security');
  const row = await p.evaluate(() => { const tr = document.querySelector('table.widefat tbody tr'); return tr ? tr.innerText.replace(/\s+/g, ' ') : ''; });
  ok('a locked address is listed with its failures', /(127\.0\.0\.1|::1)\s+3/.test(row), row);
  const unlockUrl = await p.evaluate(() => document.querySelector('table.widefat tbody a.button').href);
  const e = await open(editor, '/wp-admin/', { wait: 200 });
  const denied = await e.evaluate(async (u) => (await fetch(u, { redirect: 'manual' })).status, unlockUrl);
  ok('an editor can not unlock (the link answers with an error, nothing changes)', denied === 403 && !(await attempt('wpa_login_user', PASS)).ok, String(denied));
  await e.close();
  const badNonce = await p.evaluate(async () => (await fetch('/wp-admin/admin-post.php?action=wplus_addons_unlock&_wpnonce=bad', { redirect: 'manual' })).status);
  ok('Unlock with a wrong nonce is refused', badNonce === 403 || badNonce === 302 === false, String(badNonce));
  await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.click('table.widefat tbody a.button')]);
  const afterUnlock = { url: p.url(), says: /Unlocked/.test(await p.evaluate(() => document.body.innerText)), tail: (await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 160), login: await attempt('wpa_login_user', PASS) };
  ok('Unlock: the page says so and the address can log in at once', afterUnlock.says && afterUnlock.login.ok, JSON.stringify(afterUnlock));
  await p.close();
  reset(); await fails(3);
  p = await open(1, '/wp-admin/options-general.php?page=wplus-security');
  await Promise.all([p.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), p.evaluate(() => [...document.querySelectorAll('a.button')].find((a) => /Unlock all/.test(a.textContent)).click())]);
  ok('Unlock all clears the list', /No address is locked/.test(await p.evaluate(() => document.body.innerText)));
  await p.close();
  // the state stays small
  const capped = php('$s=[]; for($i=0;$i<250;$i++){ $s["k".$i]=["ip"=>"10.0.".floor($i/250).".".($i%250),"count"=>1,"first"=>time()-$i,"until"=>0]; } wplus_addons_login_save_state($s); echo count(get_option("wplus_addons_login_state"));');
  ok('the list of counts never grows past 200', parseInt(capped, 10) === 200, capped);
} finally {
  for (const [o, v] of Object.entries(keep)) php(v === 'null' ? `delete_option("${o}");` : `update_option("${o}", json_decode('${v.replace(/'/g, "\\'")}', true));`);
  php(`require_once ABSPATH."wp-admin/includes/user.php"; wp_delete_user(${editor}); wp_delete_user(${user});`);
  await browser.close();
}
summary(`page errors: ${errors.length} ${errors.slice(0, 3).join(' | ')}`);
