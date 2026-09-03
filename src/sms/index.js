import { decrypt } from '../crypto.js';

/**
 * SMS sağlayıcı katmanı.
 * Her sağlayıcı: send({ to, message, sender, credentials }) => { ok, ref?, error? }
 *   to: 905XXXXXXXXX biçiminde normalize numara (sağlayıcı kendi biçimine çevirir)
 * Yeni sağlayıcı eklemek için PROVIDERS nesnesine bir giriş ekleyin.
 * provider.send() yalnızca sendSms() üzerinden, o da yalnızca sms/dispatch.js üzerinden çağrılır.
 */

const TIMEOUT_MS = 15000;

async function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const NETGSM_ERRORS = {
  '20': 'Mesaj metninde sorun var veya karakter sınırı aşıldı',
  '30': 'Kullanıcı adı/şifre hatalı ya da API erişimi/IP izni yok',
  '40': 'Mesaj başlığı (gönderici adı) sistemde tanımlı değil',
  '50': 'Abone hesabınızla İYS kontrollü gönderim yapılamaz',
  '51': 'Aboneliğinize ait İYS marka bilgisi bulunamadı',
  '60': 'Görev bulunamadı',
  '70': 'Hatalı sorgu: parametrelerden biri yanlış veya eksik',
  '80': 'Gönderim hız sınırı aşıldı',
  '85': 'Aynı numaraya 1 dakika içinde 20den fazla görev oluşturulamaz',
  '100': 'Netgsm sistem hatası',
  '101': 'Netgsm sistem hatası',
};

const ILETIMERKEZI_ERRORS = {
  400: 'Hatalı istek',
  401: 'API anahtarı/hash hatalı ya da panelden API erişimi kapalı',
  402: 'Yetersiz bakiye veya paket',
  451: 'Aynı sipariş kısa süre önce gönderildi (mükerrer)',
  452: 'Alıcı numarası geçersiz veya eksik',
  453: 'Gönderici başlığı geçersiz ya da onaysız',
  454: 'Mesaj metni boş veya geçersiz',
  466: 'Numara biçimi geçersiz',
};

export const PROVIDERS = {
  console: {
    label: 'Konsol (test, gerçek SMS gitmez)',
    fields: [],
    senderHelp: 'Test modunda başlık gerekmez.',
    async send({ to, message, sender }) {
      const masked = to.slice(0, 5) + '*****' + to.slice(-2);
      if (process.env.NODE_ENV === 'production') {
        console.log(`[SMS-KONSOL] -> ${masked} (${sender || 'başlıksız'}) ${message.length} karakter`);
      } else {
        console.log(`[SMS-KONSOL] -> ${masked} (${sender || 'başlıksız'}): ${message}`);
      }
      return { ok: true, ref: 'konsol-' + Date.now() };
    },
  },

  netgsm: {
    label: 'Netgsm',
    fields: [
      { key: 'usercode', label: 'Kullanıcı adı (usercode / abone no)', type: 'text' },
      { key: 'password', label: 'API şifresi', type: 'password' },
    ],
    senderHelp: 'Netgsm panelinde onaylanmış mesaj başlığı (en fazla 11 karakter, örn. VETKLINIK).',
    // Netgsm REST v2 - https://api.netgsm.com.tr/sms/rest/v2/send (Basic auth, alıcı 10 hane)
    async send({ to, message, sender, credentials }) {
      if (!credentials?.usercode || !credentials?.password) return { ok: false, error: 'Netgsm kullanıcı adı/şifre eksik' };
      if (!sender) return { ok: false, error: 'Netgsm mesaj başlığı eksik' };
      const auth = Buffer.from(`${credentials.usercode}:${credentials.password}`).toString('base64');
      try {
        const res = await fetchWithTimeout('https://api.netgsm.com.tr/sms/rest/v2/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Basic ${auth}` },
          body: JSON.stringify({
            msgheader: sender,
            encoding: 'TR',
            messages: [{ msg: message, no: to.slice(2) }], // 905XXXXXXXXX -> 5XXXXXXXXX
          }),
        });
        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text); } catch { /* düz metin */ }
        const code = String(data?.code ?? text.trim().split(/\s+/)[0] ?? '');
        if (code === '00') return { ok: true, ref: String(data?.jobid || text.trim()) };
        const desc = NETGSM_ERRORS[code] || data?.description || text.slice(0, 120) || `HTTP ${res.status}`;
        return { ok: false, error: `Netgsm ${code || res.status}: ${desc}` };
      } catch (e) {
        return { ok: false, error: 'Netgsm bağlantı hatası: ' + e.message };
      }
    },
  },

  iletimerkezi: {
    label: 'İleti Merkezi',
    fields: [
      { key: 'key', label: 'API Key', type: 'text' },
      { key: 'hash', label: 'API Hash', type: 'password' },
    ],
    senderHelp: 'İleti Merkezi panelinde onaylanmış gönderici başlığı (en fazla 11 karakter).',
    // https://api.iletimerkezi.com/v1/send-sms/json - kimlik gövdede, iys "0" = bilgilendirme
    async send({ to, message, sender, credentials }) {
      if (!credentials?.key || !credentials?.hash) return { ok: false, error: 'İleti Merkezi API key/hash eksik' };
      if (!sender) return { ok: false, error: 'İleti Merkezi gönderici başlığı eksik' };
      try {
        const res = await fetchWithTimeout('https://api.iletimerkezi.com/v1/send-sms/json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            request: {
              authentication: { key: credentials.key, hash: credentials.hash },
              order: {
                sender,
                iys: '0',
                message: { text: message, receipents: { number: [to] } },
              },
            },
          }),
        });
        const data = await res.json().catch(() => null);
        const rawCode = data?.response?.status?.code;
        if (rawCode == null) return { ok: false, error: `İleti Merkezi beklenmeyen yanıt (HTTP ${res.status})` };
        const code = Number(rawCode);
        if (code === 200) return { ok: true, ref: String(data?.response?.order?.id || '') };
        const desc = ILETIMERKEZI_ERRORS[code] || data?.response?.status?.message || `HTTP ${res.status}`;
        return { ok: false, error: `İleti Merkezi ${code}: ${desc}` };
      } catch (e) {
        return { ok: false, error: 'İleti Merkezi bağlantı hatası: ' + e.message };
      }
    },
  },

  twilio: {
    label: 'Twilio (isteğe bağlı)',
    fields: [
      { key: 'account_sid', label: 'Account SID', type: 'text' },
      { key: 'auth_token', label: 'Auth Token', type: 'password' },
    ],
    senderHelp: 'Twilio "From" numarası, +90… (E.164) biçiminde.',
    async send({ to, message, sender, credentials }) {
      if (!credentials?.account_sid || !credentials?.auth_token) return { ok: false, error: 'Twilio SID/Token eksik' };
      if (!sender) return { ok: false, error: 'Twilio gönderici numarası (From) eksik' };
      const auth = Buffer.from(`${credentials.account_sid}:${credentials.auth_token}`).toString('base64');
      const body = new URLSearchParams({ From: sender, To: '+' + to, Body: message });
      try {
        const res = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(credentials.account_sid)}/Messages.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${auth}` },
          body,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.sid) return { ok: true, ref: data.sid };
        return { ok: false, error: `Twilio hata: ${data.message || res.status}` };
      } catch (e) {
        return { ok: false, error: 'Twilio bağlantı hatası: ' + e.message };
      }
    },
  },
};

export function providerOf(name) {
  return Object.hasOwn(PROVIDERS, name) ? name : 'console';
}

/** Gönderici başlığı doğrulaması: sağlayıcıya göre */
export function senderProblem(providerName, sender) {
  const s = String(sender || '').trim();
  if (providerName === 'console' || !s) return null;
  if (providerName === 'twilio') return /^\+[1-9]\d{6,14}$/.test(s) ? null : 'Twilio göndericisi +90… (E.164) biçiminde olmalı.';
  return /^[A-Za-z0-9 ]{1,11}$/.test(s) ? null : 'Başlık en fazla 11 karakter; yalnızca harf, rakam ve boşluk içerebilir.';
}

/** Klinik ayarlarından sağlayıcı ve çözülmüş kimlik bilgilerini hazırlar */
export function resolveProvider(settings) {
  const name = providerOf(settings.sms_provider);
  let credentials = {};
  let credentialsBroken = false;
  if (settings.sms_credentials) {
    const json = decrypt(settings.sms_credentials);
    if (json) {
      try { credentials = JSON.parse(json); } catch { credentials = {}; }
    } else {
      credentialsBroken = true; // APP_SECRET değişmiş: kayıtlı bilgiler çözülemiyor
    }
  }
  return { name, provider: PROVIDERS[name], credentials, credentialsBroken, sender: String(settings.sms_sender || '').trim() };
}

/** Şablondaki {alan} yer tutucularını doldurur */
export function renderTemplate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(vars, k) && vars[k] != null ? String(vars[k]) : m));
}

export const MAX_MESSAGE_LENGTH = 460;

/** Tek bir SMS gönderir (yalnızca dispatch.js çağırır). Döner: { ok, ref, error, providerName } */
export async function sendSms(settings, to, message) {
  const { name, provider, credentials, credentialsBroken, sender } = resolveProvider(settings);
  const msg = String(message || '').trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!msg) return { ok: false, error: 'Mesaj boş', providerName: name };
  if (credentialsBroken && name !== 'console') {
    return { ok: false, error: 'Kayıtlı sağlayıcı bilgileri çözülemedi (APP_SECRET değişmiş olabilir); Ayarlar sayfasından yeniden girin.', providerName: name };
  }
  if (!/^905\d{9}$/.test(String(to))) return { ok: false, error: 'Geçersiz telefon numarası', providerName: name };
  const r = await provider.send({ to: String(to), message: msg, sender, credentials });
  return { ...r, providerName: name };
}
