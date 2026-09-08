#!/usr/bin/env node
/**
 * PWA ikonlarını üretir. Bağımlılık yoktur: SVG metni burada oluşturulur,
 * PNG'ye çevirme işini macOS'un yerleşik `sips` aracı yapar.
 *
 *   node scripts/make-icons.js
 *
 * Betik idempotenttir; her çalıştırmada public/icons/ altındaki dosyaları
 * baştan üretir. Üretilen dosyalar depoya dahildir (git ignore edilmez).
 *
 * Tasarım: --primary (#0f766e) zemin, ortada beyaz pati izi (4 parmak
 * yastığı + avuç). Marka emojisi 🐾 ile uyumludur.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'icons');

const PRIMARY = '#0f766e';
const PAW = '#ffffff';

/* ---------- Pati geometrisi (512x512 tuvalde, ham koordinatlar) ----------
 * Ham pati sınırlayıcı kutusu: x 63..449, y 98..447
 * → merkez (256, 272.5), genişlik 386, yükseklik 349, yarı köşegen ~260
 * Ölçek katsayısı `scale` bu ham çizimi tuval merkezine oturtur.
 */
const PAW_CX = 256;
const PAW_CY = 272.5;

const TOES = [
  { cx: 112, cy: 252, rx: 46, ry: 58, rot: -28 },
  { cx: 196, cy: 160, rx: 46, ry: 62, rot: -10 },
  { cx: 316, cy: 160, rx: 46, ry: 62, rot: 10 },
  { cx: 400, cy: 252, rx: 46, ry: 58, rot: 28 },
];

// Avuç yastığı: üstü geniş, altı hafif çentikli yuvarlak blob
const PALM = [
  'M 256,258',
  'C 316,258 366,292 372,342',
  'C 378,392 340,438 292,446',
  'C 272,449 264,438 256,438',
  'C 248,438 240,449 220,446',
  'C 172,438 134,392 140,342',
  'C 146,292 196,258 256,258',
  'Z',
].join(' ');

/**
 * Tek bir ikon SVG'si üretir.
 * @param {object} o
 * @param {number} o.radius  Zemin köşe yarıçapı (0 = tam kare, kenardan kenara)
 * @param {number} o.scale   Pati ölçeği (1 = ham boyut, 386px genişlik)
 * @returns {string} SVG kaynağı
 */
function svgIcon({ radius, scale }) {
  const toes = TOES
    .map((t) => `    <ellipse cx="${t.cx}" cy="${t.cy}" rx="${t.rx}" ry="${t.ry}" transform="rotate(${t.rot} ${t.cx} ${t.cy})"/>`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Veteriner SMS">
  <title>Veteriner SMS</title>
  <rect width="512" height="512"${radius ? ` rx="${radius}" ry="${radius}"` : ''} fill="${PRIMARY}"/>
  <g fill="${PAW}" transform="translate(256 256) scale(${scale}) translate(${-PAW_CX} ${-PAW_CY})">
${toes}
    <path d="${PALM}"/>
  </g>
</svg>
`;
}

/* ---------- Varyantlar ----------
 * any      : yuvarlatılmış kare zemin, kenarlara yakın dolgun pati
 * maskable : tam kare zemin; içerik merkezdeki %80 güvenli alanda kalır
 *            (yarı köşegen 260 * 0.78 ≈ 203 < 204.8 = 512 * 0.4)
 * apple    : tam kare + tam opak zemin; köşe yuvarlatmayı iOS yapar,
 *            bu yüzden pati biraz daha küçük tutulur
 */
const SVG_ANY = svgIcon({ radius: 96, scale: 1.15 });
const SVG_MASKABLE = svgIcon({ radius: 0, scale: 0.78 });
const SVG_APPLE = svgIcon({ radius: 0, scale: 1.0 });

const PNGS = [
  { file: 'icon-192.png', size: 192, svg: SVG_ANY },
  { file: 'icon-512.png', size: 512, svg: SVG_ANY },
  { file: 'maskable-512.png', size: 512, svg: SVG_MASKABLE },
  { file: 'apple-touch-icon.png', size: 180, svg: SVG_APPLE },
];

function main() {
  if (os.platform() !== 'darwin') {
    console.error('Bu betik PNG üretimi için macOS `sips` aracına ihtiyaç duyar.');
    console.error('Üretilmiş ikonlar zaten public/icons/ altında; yeniden üretmeye gerek yok.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Kaynak SVG (favicon): keskin, her boyutta ölçeklenir
  const faviconPath = path.join(OUT_DIR, 'favicon.svg');
  fs.writeFileSync(faviconPath, SVG_ANY);
  console.log('yazıldı:', path.relative(ROOT, faviconPath));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vetsms-icons-'));
  try {
    for (const { file, size, svg } of PNGS) {
      const src = path.join(tmp, `${file}.svg`);
      const out = path.join(OUT_DIR, file);
      fs.writeFileSync(src, svg);
      fs.rmSync(out, { force: true }); // idempotent: sips var olan dosyanın üzerine yazmayı sevmez
      execFileSync('sips', ['-s', 'format', 'png', src, '--out', out, '-Z', String(size)], { stdio: 'ignore' });
      const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out], { encoding: 'utf8' });
      const w = /pixelWidth: (\d+)/.exec(dims)?.[1];
      const h = /pixelHeight: (\d+)/.exec(dims)?.[1];
      if (Number(w) !== size || Number(h) !== size) {
        throw new Error(`${file} beklenen ${size}x${size} yerine ${w}x${h} üretildi`);
      }
      console.log('yazıldı:', path.relative(ROOT, out), `${w}x${h}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('Tamam. İkonlar hazır:', path.relative(ROOT, OUT_DIR));
}

main();
