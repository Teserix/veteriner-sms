import { Router } from 'express';
import { requireRole } from '../auth.js';
import { owners, pets, reminders, smsLog, consents, imhaLog } from '../db/tenant.js';
import { withTransaction } from '../db/migrate.js';
import { audit } from '../audit.js';
import { clientIp } from '../ratelimit.js';
import { normalizePhone, formatPhone, trim, toInt, nowIso, isValidDate, isValidEmail, escapeLike, SPECIES } from '../util.js';

export const ownersRouter = Router();

/** SMS tercihi değişikliğinin kanalı (consent_events.channel) */
export const CONSENT_CHANNELS = Object.freeze({ panel: 'Panelden (personel)', sozlu: 'Sözlü (telefon/yüz yüze)', yazili: 'Yazılı form', telefon: 'Telefonla ret talebi', ret_url: 'SMS iptal bağlantısı', ice_aktarma: 'CSV içe aktarma' });

/**
 * SMS tercihi değişince olay kaydı düşer (Ticari İletişim Yön. m.7/10, m.13/1 ispat; KVKK m.12).
 * owners.create/update ile aynı transaction içinde çağrılır.
 */
export function logConsentChange(req, db, ownerId, { before, after, channel = 'panel', note = null }) {
  if (before === after) return;
  consents.log(db, {
    owner_id: ownerId, action: after ? 'grant' : 'revoke', channel, note,
    actor_email: req?.user?.email ?? null, ip: req ? clientIp(req) : null, created_at: nowIso(),
  });
  audit(req, after ? 'consent.grant' : 'consent.revoke', { entityType: 'owner', entityId: ownerId, meta: { channel } });
}

function notFound(res) {
  return res.status(404).render('error', { title: 'Bulunamadı', message: 'Kayıt bulunamadı.' });
}

function ownerFromBody(b) {
  return {
    name: trim(b.name, 120),
    phoneRaw: trim(b.phone, 30),
    email: trim(b.email, 120) || null,
    address: trim(b.address, 300) || null,
    notes: trim(b.notes, 1000) || null,
    sms_opt_in: b.sms_opt_in === '1' ? 1 : 0,
    consent_channel: Object.hasOwn(CONSENT_CHANNELS, b.consent_channel) ? b.consent_channel : 'panel',
  };
}

function ownerProblem(f, phone) {
  if (!f.name) return 'Ad zorunlu.';
  if (!phone) return 'Geçerli bir cep telefonu girin (05xx xxx xx xx).';
  if (f.email && !isValidEmail(f.email)) return 'E-posta adresi geçersiz.';
  return null;
}

/** ISO 11784 mikroçip: 15 hane */
export function microchipProblem(v) {
  if (!v) return null;
  return /^\d{15}$/.test(v) ? null : 'Mikroçip numarası 15 haneli olmalı (ISO 11784).';
}

/* ---------- CSV dışa aktarma (yalnızca yönetici) ---------- */
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // formül enjeksiyonuna karşı
  if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

ownersRouter.get('/sahipler/disa-aktar.csv', requireRole('admin'), (req, res) => {
  const rows = pets.allWithOwner(req.db);
  const header = ['Sahip', 'Telefon', 'E-posta', 'Adres', 'SMS', 'Hayvan', 'Tür', 'Irk', 'Cinsiyet', 'Doğum', 'Mikroçip'];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push([r.owner_name, formatPhone(r.owner_phone), r.owner_email, r.owner_address, r.sms_opt_in ? 'Evet' : 'Hayır', r.name, r.species, r.breed, r.sex, r.birth_date, r.microchip_no].map(csvCell).join(';'));
  }
  audit(req, 'export.csv', { meta: { rows: rows.length } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="hasta-listesi.csv"');
  res.send('﻿' + lines.join('\r\n'));
});

/* ---------- Sahipler ---------- */
ownersRouter.get('/sahipler', (req, res) => {
  const q = trim(req.query.q, 60);
  if (q) audit(req, 'owner.search'); // erişim kaydı (Rehber §3.2); aranan metin yazılmaz
  res.render('owners', { title: 'Hasta Sahipleri', list: owners.list(req.db, q, escapeLike), q });
});

ownersRouter.get('/sahipler/yeni', (req, res) => {
  res.render('owner_form', { title: 'Yeni hasta sahibi', owner: null, form: { sms_opt_in: 1 }, channels: CONSENT_CHANNELS, error: null });
});

ownersRouter.post('/sahipler/yeni', (req, res) => {
  const f = ownerFromBody(req.body);
  const phone = normalizePhone(f.phoneRaw);
  const form = { ...f, phone: f.phoneRaw };
  const problem = ownerProblem(f, phone);
  if (problem) return res.status(400).render('owner_form', { title: 'Yeni hasta sahibi', owner: null, form, channels: CONSENT_CHANNELS, error: problem });
  const existing = owners.byPhone(req.db, phone);
  if (existing) return res.status(400).render('owner_form', { title: 'Yeni hasta sahibi', owner: null, form, channels: CONSENT_CHANNELS, error: `Bu telefon zaten kayıtlı: ${existing.name}.` });
  const id = withTransaction(req.db, () => {
    const newId = owners.create(req.db, { ...f, phone, created_at: nowIso() });
    logConsentChange(req, req.db, newId, { before: null, after: f.sms_opt_in, channel: f.consent_channel });
    return newId;
  });
  res.redirect(`/sahipler/${id}?ok=` + encodeURIComponent('Hasta sahibi eklendi. Şimdi hayvan ekleyebilirsiniz.'));
});

ownersRouter.get('/sahipler/:id', (req, res) => {
  const id = toInt(req.params.id);
  const owner = owners.get(req.db, id);
  if (!owner) return notFound(res);
  audit(req, 'owner.view', { entityType: 'owner', entityId: id });
  res.render('owner_detail', {
    title: owner.name,
    owner,
    petList: pets.byOwner(req.db, id),
    reminderList: reminders.byOwner(req.db, id),
    smsList: smsLog.byOwner(req.db, id),
    consentList: consents.history(req.db, id),
    channels: CONSENT_CHANNELS,
    anonymized: owner.name === '[silindi]',
  });
});

ownersRouter.get('/sahipler/:id/duzenle', (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  res.render('owner_form', { title: 'Düzenle', owner, form: { ...owner, phone: formatPhone(owner.phone) }, channels: CONSENT_CHANNELS, error: null });
});

ownersRouter.post('/sahipler/:id/duzenle', (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  const f = ownerFromBody(req.body);
  const phone = normalizePhone(f.phoneRaw);
  const form = { ...f, phone: f.phoneRaw };
  const problem = ownerProblem(f, phone);
  if (problem) return res.status(400).render('owner_form', { title: 'Düzenle', owner, form, channels: CONSENT_CHANNELS, error: problem });
  const other = owners.byPhone(req.db, phone);
  if (other && other.id !== owner.id) return res.status(400).render('owner_form', { title: 'Düzenle', owner, form, channels: CONSENT_CHANNELS, error: `Bu telefon başka bir kayıtta: ${other.name}.` });
  withTransaction(req.db, () => {
    owners.update(req.db, owner.id, { ...f, phone });
    logConsentChange(req, req.db, owner.id, { before: owner.sms_opt_in, after: f.sms_opt_in, channel: f.consent_channel });
  });
  res.redirect(`/sahipler/${owner.id}?ok=` + encodeURIComponent('Kaydedildi.'));
});

/** Tek tıkla ret (personel de yapabilir): hasta sahibi telefonla/yüz yüze "SMS istemiyorum" dediğinde */
ownersRouter.post('/sahipler/:id/ret', (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  const channel = req.body.channel === 'sozlu' ? 'sozlu' : 'telefon';
  withTransaction(req.db, () => {
    owners.setOptIn(req.db, owner.id, 0);
    logConsentChange(req, req.db, owner.id, { before: owner.sms_opt_in, after: 0, channel, note: trim(req.body.note, 200) || null });
  });
  res.redirect(`/sahipler/${owner.id}?ok=` + encodeURIComponent('Hatırlatma SMS\'leri durduruldu; ret kaydı tutuldu.'));
});

/* ---------- İlgili kişi hakları: dışa aktarma (KVKK m.11/b), silme ve anonimleştirme (m.7) ---------- */
function ownerBundle(db, id) {
  const owner = owners.get(db, id);
  if (!owner) return null;
  return {
    exported_at: nowIso(),
    owner: { ...owner, opt_out_token: undefined, phone_formatted: formatPhone(owner.phone) },
    pets: pets.byOwner(db, id),
    reminders: reminders.byOwner(db, id).map((r) => ({ ...r, owner_phone: undefined, opt_out_token: undefined })),
    sms_log: smsLog.allByOwner(db, id),
    consent_events: consents.history(db, id),
  };
}

ownersRouter.get('/sahipler/:id/veri.json', requireRole('admin'), (req, res) => {
  const id = toInt(req.params.id);
  const bundle = ownerBundle(req.db, id);
  if (!bundle) return notFound(res);
  audit(req, 'owner.export', { entityType: 'owner', entityId: id, meta: { format: 'json' } });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hasta-sahibi-${id}.json"`);
  res.send(JSON.stringify(bundle, null, 2));
});

ownersRouter.get('/sahipler/:id/veri.csv', requireRole('admin'), (req, res) => {
  const id = toInt(req.params.id);
  const b = ownerBundle(req.db, id);
  if (!b) return notFound(res);
  audit(req, 'owner.export', { entityType: 'owner', entityId: id, meta: { format: 'csv' } });
  const lines = [];
  const row = (...cells) => lines.push(cells.map(csvCell).join(';'));
  row('Bölüm', 'Alan', 'Değer');
  for (const [k, v] of Object.entries(b.owner)) if (v !== undefined) row('Sahip', k, v);
  for (const p of b.pets) for (const [k, v] of Object.entries(p)) row(`Hayvan #${p.id}`, k, v);
  for (const r of b.reminders) for (const [k, v] of Object.entries(r)) if (v !== undefined) row(`Hatırlatma #${r.id}`, k, v);
  for (const s of b.sms_log) for (const [k, v] of Object.entries(s)) row(`SMS #${s.id}`, k, v);
  for (const c of b.consent_events) for (const [k, v] of Object.entries(c)) row(`SMS tercihi #${c.id}`, k, v);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hasta-sahibi-${id}.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});

/** Silme: sahip, hayvanları ve hatırlatmaları silinir; SMS kayıtlarındaki kişisel alanlar temizlenir, satır kalır (Yön. m.13/2) */
ownersRouter.post('/sahipler/:id/sil', requireRole('admin'), (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  const at = nowIso();
  withTransaction(req.db, () => {
    const scrubbed = smsLog.scrubOwner(req.db, owner.id, at);
    owners.delete(req.db, owner.id);
    imhaLog.add(req.db, { run_at: at, scope: 'owner', method: 'sil', row_count: 1, criteria: `owner_id=${owner.id}; sms_log anonim=${scrubbed}`, actor: req.user.email });
  });
  audit(req, 'owner.delete', { entityType: 'owner', entityId: owner.id });
  res.redirect('/sahipler?ok=' + encodeURIComponent('Hasta sahibi silindi; SMS kayıtlarındaki kişisel bilgiler anonimleştirildi.'));
});

/** Anonimleştirme: kayıt kimliği ve sayımlar kalır, kişiyi tanımlayan her alan gider */
ownersRouter.post('/sahipler/:id/anonimlestir', requireRole('admin'), (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  const at = nowIso();
  withTransaction(req.db, () => {
    const scrubbed = smsLog.scrubOwner(req.db, owner.id, at);
    for (const p of pets.byOwner(req.db, owner.id)) pets.delete(req.db, p.id); // hatırlatmalar CASCADE
    owners.anonymize(req.db, owner.id);
    imhaLog.add(req.db, { run_at: at, scope: 'owner', method: 'anonim', row_count: 1, criteria: `owner_id=${owner.id}; sms_log anonim=${scrubbed}`, actor: req.user.email });
  });
  audit(req, 'owner.anonymize', { entityType: 'owner', entityId: owner.id });
  res.redirect(`/sahipler/${owner.id}?ok=` + encodeURIComponent('Kayıt anonimleştirildi.'));
});

/* ---------- Hayvanlar ---------- */
function petFromBody(b) {
  const species = SPECIES.includes(b.species) ? b.species : 'Diğer';
  const sex = ['Dişi', 'Erkek'].includes(b.sex) ? b.sex : null;
  const birth = trim(b.birth_date, 10);
  return {
    name: trim(b.name, 80),
    species,
    breed: trim(b.breed, 80) || null,
    sex,
    birth_date: isValidDate(birth) ? birth : null,
    notes: trim(b.notes, 1000) || null,
    microchip_no: trim(b.microchip_no, 20).replace(/\s/g, '') || null,
  };
}

function petProblem(f) {
  if (!f.name) return 'Ad zorunlu.';
  return microchipProblem(f.microchip_no);
}

ownersRouter.get('/sahipler/:id/hayvan/yeni', (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  res.render('pet_form', { title: 'Yeni hayvan', owner, pet: null, form: {}, error: null });
});

ownersRouter.post('/sahipler/:id/hayvan/yeni', (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  const f = petFromBody(req.body);
  const problem = petProblem(f);
  if (problem) return res.status(400).render('pet_form', { title: 'Yeni hayvan', owner, pet: null, form: req.body, error: problem });
  const petId = pets.create(req.db, { ...f, owner_id: owner.id, created_at: nowIso() });
  res.redirect(`/hayvanlar/${petId}/hatirlatma/yeni?ok=` + encodeURIComponent('Hayvan eklendi. İsterseniz hemen bir hatırlatma oluşturun.'));
});

ownersRouter.get('/hayvanlar/:id/duzenle', (req, res) => {
  const pet = pets.get(req.db, toInt(req.params.id));
  if (!pet) return notFound(res);
  const owner = owners.get(req.db, pet.owner_id);
  res.render('pet_form', { title: 'Hayvanı düzenle', owner, pet, form: pet, error: null });
});

ownersRouter.post('/hayvanlar/:id/duzenle', (req, res) => {
  const pet = pets.get(req.db, toInt(req.params.id));
  if (!pet) return notFound(res);
  const owner = owners.get(req.db, pet.owner_id);
  const f = petFromBody(req.body);
  const problem = petProblem(f);
  if (problem) return res.status(400).render('pet_form', { title: 'Hayvanı düzenle', owner, pet, form: req.body, error: problem });
  pets.update(req.db, pet.id, f);
  res.redirect(`/sahipler/${pet.owner_id}?ok=` + encodeURIComponent('Kaydedildi.'));
});

ownersRouter.post('/hayvanlar/:id/sil', requireRole('admin'), (req, res) => {
  const pet = pets.get(req.db, toInt(req.params.id));
  if (!pet) return notFound(res);
  pets.delete(req.db, pet.id);
  audit(req, 'pet.delete', { entityType: 'pet', entityId: pet.id });
  res.redirect(`/sahipler/${pet.owner_id}?ok=` + encodeURIComponent('Hayvan silindi.'));
});
