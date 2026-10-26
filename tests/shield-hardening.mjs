// Light security hardening, the switches: what a visitor and an administrator really get with every switch off, every switch on, with the
// tool switched off, with the starting values, and who may open the page.
import { php, ok, summary, launch, makeUser, BASE, sleep } from './lib.mjs';

const keepModules = php('echo json_encode(get_option("wplus_addons_modules", null));');
const keepShield = php('echo json_encode(get_option("wplus_addons_shield", null));');
const editor = makeUser('wpa_editor_test', 'editor');
const postId = parseInt(php('echo wp_insert_post(["post_title"=>"Shield test post","post_author"=>1,"post_status"=>"publish","ping_status"=>"open","comment_status"=>"open"]);'), 10);
const names = ['version', 'file_edit', 'headers', 'login_msg', 'users', 'xmlrpc'];
const setShield = (on) => php(`update_option("wplus_addons_shield", [${names.map((n) => `"${n}"=>${on}`).join(',')}]);`);
const enableTool = (on) => php(`update_option("wplus_addons_modules", ["thumbnail"=>true,"shield"=>${on ? 'true' : 'false'}]);`);
const get = async (url, init = {}) => { const r = await fetch(BASE + url, { redirect: 'manual', ...init }); const text = await r.text(); return { status: r.status, headers: r.headers, text }; };
const xmlrpc = async () => { const r = await get('/xmlrpc.php', { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName><params></params></methodCall>' }); return { status: r.status, body: r.text }; };
const loginMessage = async () => { const r = await get('/wp-login.php?wp_lang=en_US', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: 'wordpress_test_cookie=WP%20Cookie%20check' }, body: 'log=nobody-here&pwd=wrong&wp-submit=Log+In&testcookie=1' }); const box = /<div id="login_error"[\s\S]*?<\/div>/.exec(r.text); return box ? box[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '(no error box)'; };
const snapshot = async () => {
  const home = await get('/'); const html = home.text;
  const single = await get('/?p=' + postId);
  const author = await get('/?author=1');
  const rest = await get('/?rest_route=/wp/v2/users');
  let idx = (await get('/wp-sitemap.xml')).text;
  if (!/sitemap/.test(idx)) idx = (await get('/?sitemap=index')).text; // sites with plain permalinks
  return { generator: /<meta name="generator"/.test(html), rsd: /rel="EditURI"/.test(html), pingback: !!single.headers.get('x-pingback'), nosniff: home.headers.get('x-content-type-options') === 'nosniff', frame: home.headers.get('x-frame-options') === 'SAMEORIGIN', referrer: home.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', authorTo: author.headers.get('location') || '', authorStatus: author.status, authorLeak: /\bauthor-[a-z0-9_-]+/i.test(author.text), restStatus: rest.status, sitemapUsers: /sitemap[^"<]*users/.test(idx), xml: await xmlrpc(), login: await loginMessage() };
};
const { browser, open, errors } = await launch();
try {
  // every switch off
  enableTool(true); setShield(false);
  const off = await snapshot();
  ok('all off: the page still has the generator tag, the RSD link and the pingback header', off.generator && off.rsd && off.pingback, JSON.stringify({ g: off.generator, r: off.rsd, p: off.pingback }));
  ok('all off: no safety headers', !off.nosniff && !off.frame && !off.referrer);
  ok('all off: ?author=1 shows or leads to the author page, the REST users list is open, the sitemap lists users', ((off.authorStatus === 301 && !/^https?:\/\/[^/]+\/?$/.test(off.authorTo)) || off.authorLeak) && off.restStatus === 200 && off.sitemapUsers, `${off.authorStatus} ${off.authorTo} rest ${off.restStatus} sitemap ${off.sitemapUsers}`);
  ok('all off: XML-RPC answers and the login page tells which part was wrong', off.xml.status === 200 && /system\.listMethods/.test(off.xml.body) && /unknown|not registered|invalid username/i.test(off.login), `${off.xml.status} | ${off.login.slice(0, 160)}`);
  // every switch on
  setShield(true);
  const on = await snapshot();
  ok('all on: no generator tag, no RSD link, no pingback header', !on.generator && !on.rsd && !on.pingback, JSON.stringify({ g: on.generator, r: on.rsd, p: on.pingback }));
  ok('all on: the three safety headers are sent', on.nosniff && on.frame && on.referrer);
  ok('all on: ?author=1 goes to the home page, the REST users list and the sitemap users are gone', on.authorStatus === 301 && /^https?:\/\/[^/]+\/?$/.test(on.authorTo) && on.restStatus === 404 && !on.sitemapUsers, `${on.authorStatus} ${on.authorTo} rest ${on.restStatus} sitemap ${on.sitemapUsers}`);
  ok('all on: XML-RPC is closed for every call, even the ones that need no login', on.xml.status === 403 && /disabled/i.test(on.xml.body) && !/system\.listMethods/.test(on.xml.body), `${on.xml.status} ${on.xml.body.slice(0, 120).replace(/\s+/g, ' ')}`);
  ok('all on: one message for a wrong user and a wrong password', /user name or the password is not right/i.test(on.login) && !/unknown|not registered/i.test(on.login), on.login.slice(0, 160));
  // what an administrator still can do
  const admin = await open(1, '/wp-admin/options-general.php?page=wplus-security');
  const nonce = await admin.evaluate(async () => (await fetch('/wp-admin/admin-ajax.php?action=rest-nonce')).text());
  const users = await admin.evaluate(async (n) => (await fetch('/?rest_route=/wp/v2/users', { headers: { 'X-WP-Nonce': n } })).status, nonce);
  ok('all on: a logged-in administrator still reads the users list in the REST API', users === 200, String(users));
  const edit = await open(1, '/wp-admin/theme-editor.php', { wait: 400 });
  ok('all on: the theme file editor is closed even for the administrator', /not allowed|tak diizinkan/i.test(await edit.evaluate(() => document.body.innerText)));
  await edit.close();
  // the starting values (nothing saved yet)
  php('delete_option("wplus_addons_shield");');
  const start = await snapshot();
  ok('starting values: the safe switches are on and XML-RPC is left on (apps need it)', !start.generator && start.nosniff && start.restStatus === 404 && start.xml.status === 200 && /system\.listMethods/.test(start.xml.body), JSON.stringify({ g: start.generator, n: start.nosniff, r: start.restStatus, x: start.xml.status }));
  // the tool switched off: the saved switches do nothing
  setShield(true); enableTool(false);
  const gone = await snapshot();
  ok('tool switched off: nothing is changed on the site and the Security page is closed', gone.generator && gone.restStatus === 200 && !gone.nosniff && gone.xml.status === 200);
  const closed = await open(1, '/wp-admin/options-general.php?page=wplus-security', { wait: 300 });
  ok('tool switched off: Settings > WPlus Security does not open', /not allowed|tak diizinkan/i.test(await closed.evaluate(() => document.body.innerText)));
  await closed.close();
  // the page
  enableTool(true); setShield(false);
  const page = await open(1, '/wp-admin/options-general.php?page=wplus-security');
  const rows = await page.evaluate(() => [...document.querySelectorAll('input[name^="wplus_addons_shield["]')].map((i) => i.name.replace(/.*\[(.*)\]/, '$1') + ':' + i.checked).join());
  ok('the page lists the six switches, all off as saved', rows === names.map((n) => n + ':false').join(), rows);
  ok('the XML-RPC switch warns about the apps that need it', /mobile app|Jetpack/i.test(await page.evaluate(() => document.body.innerText)));
  await page.evaluate(() => { document.getElementById('wplus-shield-headers').checked = true; document.getElementById('wplus-shield-version').checked = true; });
  await Promise.all([page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }), page.evaluate(() => document.querySelector('#submit').click())]);
  const saved = JSON.parse(php('echo json_encode(get_option("wplus_addons_shield"));'));
  ok('saving from the page stores exactly the ticked switches', saved.headers === true && saved.version === true && saved.file_edit === false && saved.users === false && saved.xmlrpc === false && Object.keys(saved).length === 6, JSON.stringify(saved));
  await page.close();
  const clean = JSON.parse(php('echo json_encode(wplus_addons_shield_sanitize(["version"=>"1","evil"=>"1","xmlrpc"=>"0"]));'));
  ok('unknown switches are dropped, values become true or false', clean.version === true && clean.xmlrpc === false && !('evil' in clean) && Object.keys(clean).length === 6, JSON.stringify(clean));
  const ed = await open(editor, '/wp-admin/options-general.php?page=wplus-security', { wait: 300 });
  ok('an editor can not open the page', /not allowed|tak diizinkan/i.test(await ed.evaluate(() => document.body.innerText)));
  await ed.close();
} finally {
  php(`wp_delete_post(${postId},true); ${keepModules === 'null' ? 'delete_option("wplus_addons_modules");' : `update_option("wplus_addons_modules", json_decode('${keepModules}', true));`} ${keepShield === 'null' ? 'delete_option("wplus_addons_shield");' : `update_option("wplus_addons_shield", json_decode('${keepShield}', true));`} require_once ABSPATH."wp-admin/includes/user.php"; wp_delete_user(${editor});`);
  await browser.close();
}
summary(`page errors: ${errors.length}`);
