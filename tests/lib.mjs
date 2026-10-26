// Shared helpers of the WPlus Addons tests. They drive a real WordPress with Chrome (puppeteer-core), so they need:
//   - a WordPress install with the plugin active, served at BASE_URL (default http://127.0.0.1:8091), for example
//     `PHP_CLI_SERVER_WORKERS=4 php -S 127.0.0.1:8091 -t .` from the WordPress folder
//   - puppeteer-core in WP_ROOT/node_modules (default: the WordPress folder this plugin sits in) and Chrome (CHROME_PATH)
// Every test prints PASS/FAIL lines and a last line `SUMMARY pass=N fail=M`, and exits with 1 when something failed.
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const WP_ROOT = process.env.WP_ROOT || path.resolve(here, '../../../..');
export const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8091').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HOST = new URL(BASE).hostname;

/** Run PHP inside WordPress and return what it prints. */
export const php = (code) => {
  try {
    return execFileSync('php', ['-r', 'require "wp-load.php"; ' + code], { cwd: WP_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
  } catch (e) {
    throw new Error('php failed: ' + (e.stdout || '').toString().trim().slice(0, 400) + ' ' + (e.stderr || '').toString().trim().slice(0, 400));
  }
};

const results = [];
export const ok = (name, pass, info = '') => { results.push(!!pass); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  -> ' + info : '')); };
export const summary = (extra = '') => {
  const pass = results.filter(Boolean).length, fail = results.length - pass;
  if (extra) console.log(extra);
  console.log(`SUMMARY pass=${pass} fail=${fail}`);
  process.exitCode = fail ? 1 : 0;
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Auth cookies of a user, made without a password. */
export const cookiesOf = (uid) => JSON.parse(php(`$e=time()+3600; echo json_encode([[AUTH_COOKIE,wp_generate_auth_cookie(${uid},$e,"auth")],[LOGGED_IN_COOKIE,wp_generate_auth_cookie(${uid},$e,"logged_in")]]);`));

/** Make (or reuse) a test user with a role, using English so the tests can read the texts. */
export const makeUser = (login, role) => {
  php(`if(!username_exists("${login}")) wp_create_user("${login}","x-Test-9aQ!zz","${login}@example.invalid"); $u=get_user_by("login","${login}"); $u->set_role("${role}"); update_user_meta($u->ID,"locale","en_US");`);
  return parseInt(php(`echo get_user_by("login","${login}")->ID;`), 10);
};

/** Set the language of a user (en_US, id_ID, ...); returns the function that puts the old value back. */
export const userLocale = (uid, locale) => {
  const old = JSON.stringify(php(`echo get_user_meta(${uid},"locale",true);`));
  php(`update_user_meta(${uid},"locale","${locale}");`);
  return () => php(`update_user_meta(${uid},"locale",${old});`);
};

export const launch = async () => {
  const restoreAdmin = userLocale(1, 'en_US'); // the tests read English texts; the administrator's own choice comes back at the end
  const { default: puppeteer } = await import(pathToFileURL(path.join(WP_ROOT, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).href);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const errors = [];
  /** Open a page as a user (id) at a path; accepts confirm dialogs; collects uncaught page errors. */
  const open = async (uid, url, { width = 1280, height = 1000, wait = 1200 } = {}) => {
    // every page gets its own cookie jar: the cookies of two users have the same names and would overwrite each other
    const context = await (browser.createBrowserContext ? browser.createBrowserContext() : browser.createIncognitoBrowserContext());
    const page = await context.newPage();
    page.once('close', () => { context.close().catch(() => {}); });
    await page.setViewport({ width, height });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());
    if (uid) await page.setCookie(...cookiesOf(uid).map(([name, value]) => ({ name, value, domain: HOST, path: '/' })));
    await page.goto(BASE + url, { waitUntil: 'load', timeout: 120000 });
    await sleep(wait);
    return page;
  };
  const close = browser.close.bind(browser);
  browser.close = async () => { restoreAdmin(); await close(); };
  return { browser, open, errors };
};

/** Set a form field of the Thumbnail page and fire the events the page listens to. */
export const setField = (page, id, value, prefix = 'wpa-') => page.evaluate((id, value, prefix) => { const e = document.getElementById(prefix + id); e.value = value; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, id, value, prefix);

/** Open the block editor of a post and make it ready (no welcome guide, document sidebar open). */
export const openEditor = async (open, uid, postId, options) => {
  const page = await open(uid, `/wp-admin/post.php?post=${postId}&action=edit`, { ...options, wait: 500 });
  await page.waitForFunction(() => window.wp && wp.data && wp.data.select('core/editor') && wp.data.select('core/editor').getCurrentPostId(), { timeout: 60000 });
  await page.evaluate(() => { wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false); try { wp.data.dispatch('core/edit-post').openGeneralSidebar('edit-post/document'); } catch (e) {} });
  await sleep(1500);
  return page;
};

export const TOOLS = '/wp-admin/tools.php?page=wplus-thumbnail';
export const BULK = TOOLS + '&tab=bulk';
export const attachmentCount = () => parseInt(php('echo wp_count_posts("attachment")->inherit;'), 10);
