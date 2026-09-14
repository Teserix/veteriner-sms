/**
 * Test yardımcıları. src/ modülleri process.env'i import anında okuduğu için
 * bu dosya src/ altından hiçbir şeyi statik olarak import ETMEZ; test dosyaları
 * önce setupEnv() çağırır, sonra src modüllerini dinamik import eder.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

export const TEST_SECRET = 'test-app-secret-0123456789abcdef0123456789abcdef';

/** Ortamı hazırlar: geçici DATA_DIR, .env atlanır, zamanlayıcı kapalı. Döner: dataDir */
export function setupEnv(overrides = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vet-'));
  for (const k of ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'TRUST_PROXY', 'PORT']) delete process.env[k];
  Object.assign(process.env, {
    SKIP_DOTENV: '1',
    DATA_DIR: dataDir,
    APP_SECRET: TEST_SECRET,
    APP_ORIGIN: 'http://localhost',
    NODE_ENV: 'test',
    ENABLE_SCHEDULER: '0',
    ...overrides,
  });
  return dataDir;
}

/* ---------- Çerez kavanozlu HTTP istemcisi (scripts/smoke.mjs modeli) ---------- */
export const csrfOf = (html) => /name="_csrf" value="([^"]+)"/.exec(html)?.[1];

export function createClient(base) {
  const jar = {};
  const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  function storeCookies(res) {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      const k = kv.slice(0, i);
      const v = kv.slice(i + 1);
      const maxAge = /Max-Age=(\d+)/.exec(c);
      if (maxAge && maxAge[1] === '0') delete jar[k]; else jar[k] = v;
    }
  }
  async function wrap(res) {
    storeCookies(res);
    const text = await res.text();
    return {
      status: res.status,
      location: res.headers.get('location'),
      headers: res.headers,
      setCookies: res.headers.getSetCookie?.() || [],
      text,
    };
  }
  return {
    base,
    jar,
    async get(p, extraHeaders = {}) {
      const res = await fetch(base + p, { headers: { cookie: cookieHeader(), ...extraHeaders }, redirect: 'manual' });
      return wrap(res);
    },
    /** Ham baytlar (Response.text() baştaki UTF-8 BOM'u siler; BOM denetimi için gerekli) */
    async getBytes(p, extraHeaders = {}) {
      const res = await fetch(base + p, { headers: { cookie: cookieHeader(), ...extraHeaders }, redirect: 'manual' });
      storeCookies(res);
      const bytes = new Uint8Array(await res.arrayBuffer());
      return { status: res.status, headers: res.headers, bytes, text: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) };
    },
    async post(p, data = {}, extraHeaders = {}) {
      const body = new URLSearchParams(data).toString();
      const res = await fetch(base + p, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookieHeader(), origin: base, ...extraHeaders },
        body,
        redirect: 'manual',
      });
      return wrap(res);
    },
    clear() { for (const k of Object.keys(jar)) delete jar[k]; },
  };
}

/* ---------- Uygulama ---------- */

/** initAuth + createApp().listen(0). Döner: { base, server, close } */
export async function startApp() {
  const { initAuth } = await import('../src/auth.js');
  const { createApp } = await import('../src/app.js');
  const { config } = await import('../src/config.js');
  await initAuth();
  const app = createApp();
  const server = app.listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  // Port ancak listen sonrası belli olur; Origin denetimi tam origin karşılaştırdığı için eşitle.
  config.appOrigin = base;
  const close = async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
    const { closeAll } = await import('../src/db/tenant.js');
    closeAll();
  };
  return { base, server, close };
}

export async function createSuperadmin(email, password) {
  const { users } = await import('../src/db/master.js');
  const { hashPassword } = await import('../src/auth.js');
  const r = users.create({
    clinicId: null, email: email.toLowerCase(), name: 'Süper Yönetici',
    passwordHash: await hashPassword(password), role: 'superadmin', createdAt: new Date().toISOString(),
  });
  return Number(r.lastInsertRowid);
}

/** Giriş sayfasındaki ön belirteçle giriş yapar; POST yanıtını döner */
export async function login(client, email, password, next = '/') {
  const page = await client.get('/giris');
  const token = csrfOf(page.text);
  return client.post('/giris', { _csrf: token, email, password, next });
}

/** Oturumlu bir sayfadan CSRF belirtecini alır (/sifre her rol için erişilebilir) */
export async function csrfFor(client, p = '/sifre') {
  const r = await client.get(p);
  return csrfOf(r.text);
}

export async function logout(client) {
  const csrf = await csrfFor(client);
  return client.post('/cikis', { _csrf: csrf });
}

/** Geçici parolayla giriş + zorunlu parola değişimi */
export async function loginAndChangePassword(client, email, tempPassword, newPassword, { acceptContracts = true } = {}) {
  const r = await login(client, email, tempPassword);
  if (!(r.status === 302 && String(r.location).startsWith('/sifre'))) {
    throw new Error(`geçici parolayla giriş beklenmedik: ${r.status} ${r.location}`);
  }
  const csrf = await csrfFor(client, '/sifre');
  const c = await client.post('/sifre', { _csrf: csrf, current: tempPassword, password: newPassword, password2: newPassword });
  if (c.status !== 302) throw new Error(`parola değişimi başarısız: ${c.status}`);
  // Klinik yöneticisi ilk girişte sözleşmeyi kabul etmeden klinik ekranlarına giremez (legalAcceptanceGate)
  if (acceptContracts) {
    const probe = await client.get('/sozlesme');
    if (probe.status === 200 && /name="accept_/.test(probe.text)) await acceptLegal(client);
  }
  return c;
}

/** Süper yönetici oturumuyla klinik oluşturur; döner { id } */
export async function createClinicViaHttp(client, { name, phone = '', adminName = 'Yönetici', adminEmail, adminPassword, legalReady = true }) {
  const csrf = await csrfFor(client, '/admin');
  const r = await client.post('/admin/klinik', {
    _csrf: csrf, clinic_name: name, clinic_phone: phone, admin_name: adminName, admin_email: adminEmail, admin_password: adminPassword,
  });
  if (r.status !== 302) throw new Error(`klinik oluşturulamadı: ${r.status}`);
  const page = await client.get('/admin');
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const id = new RegExp(`/admin/klinik/([a-f0-9]{12})"><strong>${esc}</strong>`).exec(page.text)?.[1];
  if (!id) throw new Error('klinik kimliği listede bulunamadı');
  // Varsayılan: gönderim kilidini açan hukuki kimlik ayarları yazılır (testler SMS akışına odaklanabilsin)
  if (legalReady) await makeLegalReady(id, { clinic_phone: phone || LEGAL_SETTINGS.clinic_phone });
  return { id };
}

/** Giriş sınırlayıcısını sıfırlar (aynı süreçteki testler birbirini kilitlemesin) */
export async function resetLoginLimiter() {
  const { limiters } = await import('../src/ratelimit.js');
  limiters.login._hits.clear();
}

/* ---------- Mevzuat uyumu (hukuki kimlik, sözleşme kabulü) ---------- */

/** Gönderim kilidini açan asgari ayarlar: tacir + MERSİS + telefon + m.6/1 beyanı */
export const LEGAL_SETTINGS = Object.freeze({
  legal_form: 'tacir', mersis_no: '0123456789012345', clinic_phone: '0212 555 00 00', m61_declared_at: '2026-01-01T00:00:00.000Z',
});

/** Klinik veritabanına hukuki kimlik ayarlarını yazar (dispatch'in "legal" kilidi açılır) */
export async function makeLegalReady(clinicId, extra = {}) {
  const { openTenant, setSetting } = await import('../src/db/tenant.js');
  const db = openTenant(clinicId);
  for (const [k, v] of Object.entries({ ...LEGAL_SETTINGS, ...extra })) setSetting(db, k, v);
  return db;
}

/** Klinik yöneticisi oturumuyla /sozlesme'deki bekleyen belgeleri kabul eder */
export async function acceptLegal(client) {
  const page = await client.get('/sozlesme');
  if (page.status !== 200) throw new Error(`/sozlesme beklenmedik: ${page.status} ${page.location}`);
  const csrf = csrfOf(page.text);
  const data = { _csrf: csrf };
  for (const m of page.text.matchAll(/name="(accept_[a-z-]+)"/g)) data[m[1]] = '1';
  const r = await client.post('/sozlesme', data);
  if (r.status !== 302) throw new Error(`sözleşme kabulü başarısız: ${r.status}`);
  return r;
}
