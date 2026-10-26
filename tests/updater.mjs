// Updates from the dashboard, the answers WordPress gets. A fake GitHub (php -S on port 8093) answers the releases API and serves zips, so
// nothing here talks to the real GitHub. The screens people use (Plugins, Update now, Check now, version details) are tested on the clean
// site in updater-screens.mjs, because installing an update replaces the plugin folder.
import fs from 'fs';
import path from 'path';
import { php, ok, summary, WP_ROOT } from './lib.mjs';
import { startFakeGithub, PKG, FAKE_PHP } from './fake-github.mjs';

const FILE = 'wplus-addons/wplus-addons.php';
const PLUGIN_DIR = path.join(WP_ROOT, 'wp-content/plugins/wplus-addons');
const CUR = /Version:\s*(\S+)/.exec(fs.readFileSync(path.join(PLUGIN_DIR, 'wplus-addons.php'), 'utf8'))[1];
const gh = await startFakeGithub({ pluginDir: PLUGIN_DIR, current: CUR });
const { hits, resetHits, serve, release, makeZip } = gh;
const PRE = FAKE_PHP;
const run = (code) => php(PRE + code);
const J = (code) => JSON.parse(run(code));
const fresh = `delete_site_transient('wplus_addons_latest_release');`;
const ask = (ver = CUR, file = FILE) => `${fresh}$u=apply_filters('update_plugins_github.com',false,['Version'=>'${ver}'],'${file}',[]);echo json_encode($u);`;
try {
  const z = makeZip('9.9.9', 'marker-ok');
  ok('the plugin header has an Update URI on github.com (WordPress never asks wordpress.org about this plugin)', /Update URI:\s+https:\/\/github\.com\/zulfame\/wplus-addons/.test(fs.readFileSync(path.join(PLUGIN_DIR, 'wplus-addons.php'), 'utf8')));
  serve(release('v9.9.9', { digest: 'sha256:' + z.sha }));
  let u = J(ask());
  ok('a newer release is offered with its package', u && u.version === '9.9.9' && u.package === `${PKG}wplus-addons-9.9.9.zip` && u.slug === 'wplus-addons' && u.plugin === FILE, JSON.stringify(u));
  serve(release('v' + CUR)); u = J(ask());
  ok('the same version: answered (so auto-updates can be switched) but with no package', u && u.version === CUR && u.package === '', JSON.stringify(u));
  serve(release('v0.0.1')); u = J(ask());
  ok('an older release offers nothing to install', u && u.package === '', JSON.stringify(u));
  serve(release('v9.9.9', { draft: true })); const d1 = J(ask()); serve(release('v9.9.9', { pre: true })); const d2 = J(ask());
  ok('drafts and pre-releases are ignored', d1 === false && d2 === false);
  const bad = [];
  for (const [label, body] of [['odd tag', release('release-final')], ['no zip', release('v9.9.9', { assets: [] })], ['wrong zip name', release('v9.9.9', { assets: [{ name: 'other.zip', browser_download_url: PKG + 'other.zip' }] })], ['zip from another place', release('v9.9.9', { assets: [{ name: 'wplus-addons-9.9.9.zip', browser_download_url: 'https://evil.example/wplus-addons-9.9.9.zip' }] })], ['not JSON', 'oops']]) { serve(body); if (J(ask()) !== false) bad.push(label); }
  ok('unusable releases (odd tag, no zip, wrong name, package outside the repository, not JSON) are never offered', bad.length === 0, bad.join(','));
  serve(release('v9.9.9', { digest: 'sha256:' + z.sha }));
  ok('another plugin is left alone', J(ask(CUR, 'other/other.php')) === false);
  resetHits(); run(`${fresh}wplus_addons_latest_release();wplus_addons_latest_release();wplus_addons_latest_release();`); const cached = hits(); run('wplus_addons_latest_release(true);');
  ok('the answer is cached: three checks make one request; Check now forces a new one', cached === 1 && hits() === 2, `${cached} / ${hits()}`);
  serve(release('v' + CUR)); run(`${fresh}wplus_addons_latest_release(true);`); // stored: "no newer release"
  serve(release('v9.9.9', { digest: 'sha256:' + z.sha }));
  const young = J(`$u=apply_filters('update_plugins_github.com',false,['Version'=>'${CUR}'],'${FILE}',[]);echo json_encode($u);`);
  run(`$c=get_site_transient('wplus_addons_latest_release');$c['checked']=(string)(time()-3*HOUR_IN_SECONDS);set_site_transient('wplus_addons_latest_release',$c,12*HOUR_IN_SECONDS);`);
  const aged = J(`$u=apply_filters('update_plugins_github.com',false,['Version'=>'${CUR}'],'${FILE}',[]);echo json_encode($u);`);
  ok('an old stored answer never hides a new release when WordPress checks (a fresh one is reused)', young.version === CUR && aged.version === '9.9.9', `${young.version} / ${aged.version}`);
  serve('boom', 500); resetHits(); const f = J(`${fresh}$a=apply_filters('update_plugins_github.com',false,['Version'=>'${CUR}'],'${FILE}',[]);$b=apply_filters('update_plugins_github.com',false,['Version'=>'${CUR}'],'${FILE}',[]);echo json_encode([$a,$b,get_site_transient('wplus_addons_latest_release')]);`);
  ok('GitHub down (HTTP 500): no update, no error, and one request only for the next 15 minutes', f[0] === false && f[1] === false && f[2] === 'none' && hits() === 1, JSON.stringify(f));
  serve(release('v9.9.9', { digest: 'sha256:' + z.sha })); resetHits();
  const off = J(`add_filter('wplus_addons_updates_enabled','__return_false');${fresh}echo json_encode([apply_filters('update_plugins_github.com',false,['Version'=>'${CUR}'],'${FILE}',[]),wplus_addons_latest_release(true)]);`);
  ok('switched off: no network request and no update data', off[0] === false && off[1] === null && hits() === 0, JSON.stringify(off) + ' hits ' + hits());
  const ck = J(`require_once ABSPATH.'wp-admin/includes/file.php';${fresh}wplus_addons_latest_release(true);$p='${PKG}wplus-addons-9.9.9.zip';$good=wplus_addons_verify_download(false,$p);$other=wplus_addons_verify_download(false,'${PKG}x.zip');
    $s=get_site_transient('wplus_addons_latest_release');$s['sha256']=str_repeat('a',64);set_site_transient('wplus_addons_latest_release',$s,HOUR_IN_SECONDS);$bad=wplus_addons_verify_download(false,$p);
    $s['sha256']='';set_site_transient('wplus_addons_latest_release',$s,HOUR_IN_SECONDS);$none=wplus_addons_verify_download(false,$p);
    echo json_encode([is_string($good)&&is_file($good),$other,is_wp_error($bad)?$bad->get_error_code():'ok',$none,wplus_addons_verify_download('already',$p)]);`);
  ok('checksum: a match goes on, a mismatch is stopped, no checksum or another package is left to WordPress', ck[0] === true && ck[1] === false && ck[2] === 'wplus_addons_checksum' && ck[3] === false && ck[4] === 'already', JSON.stringify(ck));
  const e2e = J(`add_filter('pre_http_request',function($pre,$args,$url){ if(strpos($url,'api.wordpress.org')!==false){ return ['headers'=>[],'body'=>json_encode(['plugins'=>new stdClass,'translations'=>[],'no_update'=>new stdClass]),'response'=>['code'=>200,'message'=>'OK'],'cookies'=>[],'filename'=>null]; } return $pre; },10,3);
    ${fresh}delete_site_transient('update_plugins');wp_update_plugins();$t=get_site_transient('update_plugins');$r=$t->response['${FILE}']??null;echo json_encode([$r?$r->new_version:null,$r?$r->package:null,isset($t->no_update['${FILE}'])]);`);
  ok('WordPress\'s own plugin check puts the new version in the update list (what the Plugins screen shows)', e2e[0] === '9.9.9' && e2e[1] === `${PKG}wplus-addons-9.9.9.zip` && e2e[2] === false, JSON.stringify(e2e));
  const info = J(`${fresh}$i=apply_filters('plugins_api',false,'plugin_information',(object)['slug'=>'wplus-addons']);$o=apply_filters('plugins_api',false,'plugin_information',(object)['slug'=>'other']);echo json_encode([$i->version,$i->download_link,strpos($i->sections['changelog'],'<li><strong>New:</strong> a thing.</li>')!==false,strpos($i->sections['changelog'],'<code>thing</code>')!==false,$o]);`);
  ok('"View version details": version, download link and the release notes as a list', info[0] === '9.9.9' && info[1].endsWith('wplus-addons-9.9.9.zip') && info[2] && info[3] && info[4] === false, JSON.stringify(info).slice(0, 160));
  serve(release('v9.9.9', { digest: 'sha256:' + z.sha, body: '- New: <script>alert(1)</script> and <b>bold</b>' }));
  const xss = J(`${fresh}$i=apply_filters('plugins_api',false,'plugin_information',(object)['slug'=>'wplus-addons']);echo json_encode($i->sections['changelog']);`);
  ok('release notes can not inject markup', !/<script|<b>/.test(xss), xss);
  serve(release('v9.9.9', { digest: 'sha256:' + z.sha }));
  const box = run(`wp_set_current_user(1);switch_to_locale('en_US');${fresh}wplus_addons_latest_release(true);ob_start();wplus_addons_render_update_box();echo ob_get_clean();`);
  ok('the settings page says a version is available, with Update now (nonce) and Check now', /9\.9\.9/.test(box) && /Update now/.test(box) && /action=upgrade-plugin/.test(box) && /_wpnonce=/.test(box) && /Check now/.test(box), box.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 140));
  serve(release('v' + CUR)); const same = run(`wp_set_current_user(1);switch_to_locale('en_US');${fresh}wplus_addons_latest_release(true);ob_start();wplus_addons_render_update_box();echo ob_get_clean();`);
  ok('up to date: it says so and offers no Update button', /latest version/.test(same) && !/Update now/.test(same));
  // the real upgrades (Plugins screen, the Update now button, Check now) are tested on the clean site in updater-screens.mjs
} finally {
  gh.stop();
}
summary();
