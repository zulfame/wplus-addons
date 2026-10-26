// The picture itself: every layout, mode, alignment and size, with full, partly empty and extreme texts. Each one must be drawn,
// have the chosen size, not be blank, and follow the theme color; the three layouts must differ.
import { ok, summary, launch, TOOLS } from './lib.mjs';

const { browser, open, errors } = await launch();
try {
  const p = await open(1, TOOLS);
  const out = await p.evaluate(() => {
    const full = { title: 'Cara Mengubah Ukuran Taskbar Windows 11 Menjadi Lebih Kecil', description: 'Taskbar merupakan bagian dari antarmuka Windows yang digunakan untuk membuka aplikasi.', org: 'ZULFAME Blog', tag1: 'Windows', tag2: 'Registry' };
    const cases = { full, onlyTitle: { title: 'Hanya judul' }, noDescription: { ...full, description: '' }, noTags: { ...full, tag1: '', tag2: '' }, nothing: { title: '' }, spaces: { title: ' ', description: ' ', org: ' ', tag1: ' ', tag2: ' ' },
      veryLong: { ...full, title: 'Panduan Lengkap Cara Mengubah Ukuran Taskbar, Menu Start, dan Ikon Sistem pada Windows 11 Melalui Registry Editor untuk Pemula dan Pengguna Mahir ' + 'x '.repeat(40), description: 'Penjelasan sangat panjang '.repeat(30) }, longWords: { ...full, title: 'Supercalifragilisticexpialidocious_Supercalifragilisticexpialidocious_Banget', org: 'NamaOrganisasiYangSangatPanjangSekaliSampaiMelebihiLebarGambar'.repeat(2), tag1: 'TagYangSangatPanjangSekaliSampaiMelebihiLebar', tag2: 'LainnyaPanjangJuga' } };
    const sizes = { '1200x630': [1200, 630], '1280x720': [1280, 720], '1200x900': [1200, 900], '1080x1080': [1080, 1080] };
    const rows = []; const hash = {};
    const sample = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const seen = new Set(); let sum = 0; for (let i = 0; i < d.length; i += 4 * 97) { seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); sum += d[i] + d[i + 1] + d[i + 2]; } return { colors: seen.size, sum }; };
    for (const layout of ['minimal', 'dots', 'panel']) for (const mode of ['light', 'dark']) for (const align of ['left', 'center', 'right']) for (const [name, c] of Object.entries(cases)) {
      const canvas = document.createElement('canvas'); let err = '';
      try { WPlusThumb.render(canvas, { layout, mode, align, accent: '#2563eb', width: 1200, height: 630, font: 'sans-serif', ...c }); } catch (e) { err = String(e); }
      const s = sample(canvas); rows.push({ layout, mode, align, name, err, w: canvas.width, h: canvas.height, colors: s.colors });
      if (name === 'full' && align === 'left') hash[layout + mode] = s.sum;
    }
    const sizeRows = Object.entries(sizes).map(([k, [w, h]]) => { const canvas = document.createElement('canvas'); WPlusThumb.render(canvas, { layout: 'minimal', width: w, height: h, accent: '#2563eb', font: 'sans-serif', ...full }); return [k, canvas.width, canvas.height]; });
    const accents = ['#2563eb', '#16a34a', '#db2777', '#f97316'].map((accent) => { const out = {}; for (const layout of ['minimal', 'dots', 'panel']) for (const mode of ['light', 'dark']) { const canvas = document.createElement('canvas'); WPlusThumb.render(canvas, { layout, mode, width: 1200, height: 630, accent, font: 'sans-serif', ...full }); out[layout + mode] = sample(canvas).sum; } return out; });
    return { rows, hash, sizeRows, accents };
  });
  const bad = out.rows.filter((r) => r.err || r.w !== 1200 || r.h !== 630 || r.colors < 3);
  ok(`${out.rows.length} drawings (3 layouts x 2 modes x 3 alignments x 8 texts): none fails, all 1200 x 630 and none blank`, bad.length === 0, JSON.stringify(bad.slice(0, 3)));
  ok('every ratio gives its size', out.sizeRows.every(([k, w, h]) => k === `${w}x${h}`), JSON.stringify(out.sizeRows));
  const distinct = new Set(Object.values(out.hash)).size;
  ok('the layouts and modes look different from each other', distinct === Object.keys(out.hash).length, JSON.stringify(out.hash));
  const follows = Object.keys(out.accents[0]).every((k) => new Set(out.accents.map((a) => a[k])).size === out.accents.length);
  ok('every layout and mode follows the theme color (four colors give four different pictures)', follows);
} finally {
  await browser.close();
}
summary(`page errors: ${errors.length}`);
