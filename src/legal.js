import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { sha256 } from './crypto.js';

/**
 * Hukuki metinler: docs/legal/<slug>-v<sürüm>.md dosyalarından açılışta okunur, sha256'ları hesaplanır.
 * Kabul kaydı (legal_acceptances) sürüm + sha256 ile tutulur; metin değişirse sürüm artırılır ve
 * klinik yöneticisi yeni sürümü yeniden kabul eder (legalAcceptanceGate).
 * Markdown çevirici kasıtlı olarak küçüktür (başlık, paragraf, liste, kalın, bağlantı); HTML önce kaçışlanır.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LEGAL_DIR = path.join(__dirname, '..', 'docs', 'legal');

/** slug -> { title, version, accept: yöneticinin kabul etmesi zorunlu mu, public: giriş gerektirmez mi } */
const MANIFEST = {
  'kullanim-kosullari': { title: 'Kullanım Koşulları', version: '1', accept: false, public: true },
  'abonelik-sozlesmesi': { title: 'Abonelik Sözleşmesi', version: '1', accept: true, public: true },
  'veri-isleyen-eki': { title: 'Kişisel Veri İşleme Eki (Veri İşleyen Sözleşmesi)', version: '1', accept: true, public: true },
  'aydinlatma-teserix': { title: 'KVKK Aydınlatma Metni (Kullanıcılar)', version: '1', accept: false, public: true },
  'aydinlatma-klinik-sablon': { title: 'KVKK Aydınlatma Metni (Hasta Sahipleri) — Şablon', version: '1', accept: false, public: false },
  'cerez': { title: 'Çerez Bildirimi', version: '1', accept: false, public: true },
};

function loadDoc(slug, m) {
  const file = path.join(LEGAL_DIR, `${slug}-v${m.version}.md`);
  const body = fs.readFileSync(file, 'utf8');
  return { slug, ...m, file, body, sha256: sha256(body) };
}

export const LEGAL_DOCS = Object.freeze(Object.fromEntries(Object.entries(MANIFEST).map(([slug, m]) => [slug, loadDoc(slug, m)])));
export const ACCEPT_REQUIRED = Object.freeze(Object.values(LEGAL_DOCS).filter((d) => d.accept).map((d) => d.slug));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function inline(s) {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // yalnızca http(s) ve göreli bağlantılar
  t = t.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  return t;
}

/** Küçük, güvenli Markdown -> HTML */
export function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // 'ul' | 'ol'
  let table = 0;   // tabloda kaçıncı satır (0 = tablo açık değil)
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const flushTable = () => { if (table) { out.push('</tbody></table></div>'); table = 0; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) { flushPara(); flushList(); flushTable(); continue; }
    if (line.startsWith('|')) {
      flushPara(); flushList();
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => inline(c.trim()));
      if (!table) { out.push('<div class="table-wrap"><table class="small"><thead><tr>' + cells.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'); table = 1; }
      else { out.push('<tr>' + cells.map((c) => `<td>${c}</td>`).join('') + '</tr>'); table++; }
      continue;
    }
    flushTable();
    if (h) { flushPara(); flushList(); const n = Math.min(4, h[1].length + 1); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
    if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) { flushList(); list = kind; out.push(`<${kind}>`); }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flushPara(); flushList(); flushTable();
  return out.join('\n');
}

/** {yer_tutucu} alanlarını doldurur; bilinmeyenler boş kalır (metinde çıplak süslü parantez kalmasın) */
export function fillPlaceholders(text, vars) {
  return String(text || '').replace(/\{([a-z_]+)\}/g, (m, k) => (Object.hasOwn(vars, k) && vars[k] != null ? String(vars[k]) : ''));
}

/** Teserix şirket bilgileri (config.company) yer tutucuları */
export function companyVars() {
  const c = config.company;
  return {
    sirket_unvan: c.name, sirket_vkn: c.taxId, sirket_mersis: c.mersis, sirket_sicil: c.tradeRegistryNo, sirket_adres: c.address,
    sirket_eposta: c.email, sirket_telefon: c.phone, sirket_kep: c.kep, uygulama_adresi: config.appOrigin, yer_saglayici: c.hostingProvider,
  };
}

/** Belgeyi HTML olarak verir; şirket yer tutucuları doldurulur */
export function renderDoc(slug, extraVars = {}) {
  const d = LEGAL_DOCS[slug];
  if (!d) return null;
  return { ...d, html: renderMarkdown(fillPlaceholders(d.body, { ...companyVars(), ...extraVars })) };
}
