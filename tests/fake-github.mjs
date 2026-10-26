// A fake GitHub for the update tests: a php -S server that answers /releases/latest from a state file and serves zips under /dl/.
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync, spawn } from 'child_process';
import { sleep } from './lib.mjs';

export const PORT = 8093;
export const API = `http://127.0.0.1:${PORT}/releases/latest`;
export const PKG = `http://127.0.0.1:${PORT}/dl/`;

export const startFakeGithub = async ({ pluginDir, current }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpa-fakegh-'));
  fs.mkdirSync(path.join(dir, 'dl'));
  fs.writeFileSync(path.join(dir, 'router.php'), `<?php
$f = '${dir}'; $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($uri === '/releases/latest') { file_put_contents($f . '/hits.log', "hit\\n", FILE_APPEND); $s = json_decode(file_get_contents($f . '/state.json'), true); http_response_code($s['status']); header('Content-Type: application/json'); echo $s['body']; return true; }
if (strpos($uri, '/dl/') === 0 && is_file($f . $uri)) { header('Content-Type: application/zip'); readfile($f . $uri); return true; }
http_response_code(404);`);
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ status: 404, body: '' }));
  const server = spawn('php', ['-S', `127.0.0.1:${PORT}`, path.join(dir, 'router.php')], { stdio: 'ignore' });
  await sleep(800);
  const hitsFile = path.join(dir, 'hits.log');
  return {
    dir,
    hits: () => (fs.existsSync(hitsFile) ? fs.readFileSync(hitsFile, 'utf8').split('\n').filter(Boolean).length : 0),
    resetHits: () => fs.rmSync(hitsFile, { force: true }),
    serve: (body, status = 200) => fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ status, body })),
    release: (tag, o = {}) => { const v = tag.replace(/^v/, ''); return JSON.stringify({ tag_name: tag, draft: !!o.draft, prerelease: !!o.pre, published_at: '2026-10-27T08:00:00Z', html_url: 'https://github.com/zulfame/wplus-addons/releases/tag/' + tag, body: o.body ?? '- New: a thing.\n- Fix: another `thing`.', assets: o.assets ?? [{ name: `wplus-addons-${v}.zip`, browser_download_url: `${PKG}wplus-addons-${v}.zip`, ...(o.digest ? { digest: o.digest } : {}) }] }); },
    /** A zip of the plugin folder as it is now, with another version number (and a marker file), for installing through WordPress. */
    makeZip: (version, extra = '') => {
      const b = path.join(dir, 'build-' + version); fs.mkdirSync(b, { recursive: true });
      execFileSync('rsync', ['-a', '--exclude', '.git', '--exclude', 'dist', '--exclude', 'tests', '--exclude', 'marker.txt', pluginDir + '/', b + '/wplus-addons/']);
      const main = path.join(b, 'wplus-addons', 'wplus-addons.php');
      const text = fs.readFileSync(main, 'utf8').replace(/(Version:\s+)\S+/, `$1${version}`).replace(/('WPLUS_ADDONS_VERSION', ')[^']+(')/, `$1${version}$2`);
      fs.writeFileSync(main, text);
      if (extra) fs.writeFileSync(path.join(b, 'wplus-addons', 'marker.txt'), extra);
      const zip = path.join(dir, 'dl', `wplus-addons-${version}.zip`);
      execFileSync('zip', ['-qr', zip, 'wplus-addons'], { cwd: b });
      return { zip, sha: crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex') };
    },
    stop: () => { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
};

/** PHP that points the plugin at the fake GitHub (for php() calls). */
export const FAKE_PHP = `add_filter('wplus_addons_update_api_url',function(){return '${API}';});add_filter('wplus_addons_update_package_prefix',function(){return '${PKG}';});add_filter('http_request_host_is_external','__return_true');add_filter('http_allowed_safe_ports',function($p){$p[]=${PORT};return $p;});`;

/** A must-use plugin that does the same for web requests (so the screens talk to the fake GitHub); and takes it away again. */
export const installFakeMuPlugin = (wpRoot) => {
  const dir = path.join(wpRoot, 'wp-content/mu-plugins'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'wpa-fake-github.php');
  fs.writeFileSync(file, `<?php // test only: the update tests talk to a fake GitHub\n${FAKE_PHP}\nadd_filter('pre_http_request',function($pre,$args,$url){ if(strpos($url,'api.wordpress.org')!==false){ $body=strpos($url,'/themes/')!==false?['themes'=>new stdClass,'translations'=>[],'no_update'=>new stdClass]:(strpos($url,'/core/')!==false?['offers'=>[],'translations'=>[]]:['plugins'=>new stdClass,'translations'=>[],'no_update'=>new stdClass]); return ['headers'=>[],'body'=>json_encode($body),'response'=>['code'=>200,'message'=>'OK'],'cookies'=>[],'filename'=>null]; } return $pre; },10,3);\n`);
  return () => fs.rmSync(file, { force: true });
};
