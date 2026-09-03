import { decrypt } from '../crypto.js';

/**
 * SMS sağlayıcı katmanı.
 * Her sağlayıcı: send({ to, message, sender, credentials }) => { ok, ref?, error? }
 * Yeni sağlayıcı eklemek için PROVIDERS nesnesine bir giriş ekleyin.
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

export const PROVIDERS = {
  console: {
    label: 'Konsol (test, gerçek SMS gitmez)',
    fields: [],
    async send({ to, message, sender }) {
      console.log(`[SMS-KONSOL] -> ${to} (${sender || 'başlıksız'}): ${message}`);
      return { ok: true, ref: 'konsol-' + Date.now() };
    },
  },

  netgsm: {
    label: 'Netgsm',
    fields: [
      { key: 'usercode', label: 'Kullanıcı adı (usercode)', type: 'text' },
      { key: 'password', label: 'Şifre', type: 'password' },
    ],
    // Netgsm REST v2 (JSON) - https://www.netgsm.com.tr/dokuman/
    async send({ to, message, sender, credentials }) {
      if (!credentials?.usercode || !credentials?.password) return { ok: false, error: 'Netgsm kullanıcı adı/şifre eksik' };
      if (!sender) return { ok: false, error: 'Netgsm mesaj başlığı (sender) eksik' };
      const auth = Buffer.from(`${credentials.usercode}:${credentials.password}`).toString('base64');
      try {
        const res = await fetchWithTimeout('https://api.netgsm.com.tr/sms/rest/v2/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
          body: JSON.stringify({
            msgheader: sender,
            encoding: 'TR',
            messages: [{ msg: message, no: to }],
          }),
        });
        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text); } catch { /* düz metin yanıt */ }
        const code = data?.code ?? text.trim().split(/\s+/)[0];
        if (String(code) === '00') return { ok: true, ref: data?.jobid || text.trim() };
        return { ok: false, error: `Netgsm hata kodu ${code}: ${data?.description || text.slice(0, 200)}` };
      } catch (e) {
        return { ok: false, error: 'Netgsm bağlantı hatası: ' + e.message };
      }
    },
  },

  twilio: {
    label: 'Twilio',
    fields: [
      { key: 'account_sid', label: 'Account SID', type: 'text' },
      { key: 'auth_token', label: 'Auth Token', type: 'password' },
    ],
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

/** Klinik ayarlarından sağlayıcı ve çözülmüş kimlik bilgilerini hazırlar */
export function resolveProvider(settings) {
  const name = PROVIDERS[settings.sms_provider] ? settings.sms_provider : 'console';
  let credentials = {};
  if (settings.sms_credentials) {
    const json = decrypt(settings.sms_credentials);
    if (json) {
      try { credentials = JSON.parse(json); } catch { credentials = {}; }
    }
  }
  return { name, provider: PROVIDERS[name], credentials, sender: settings.sms_sender || '' };
}

/** Şablondaki {alan} yer tutucularını doldurur */
export function renderTemplate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
}

/** Tek bir SMS gönderir. Döner: { ok, ref, error, providerName } */
export async function sendSms(settings, to, message) {
  const { name, provider, credentials, sender } = resolveProvider(settings);
  const msg = String(message || '').trim().slice(0, 900);
  if (!msg) return { ok: false, error: 'Mesaj boş', providerName: name };
  const r = await provider.send({ to, message: msg, sender, credentials });
  return { ...r, providerName: name };
}
