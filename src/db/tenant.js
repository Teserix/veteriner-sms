import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { randomId } from '../crypto.js';
import { migrate } from './migrate.js';

/**
 * Kiracı (klinik) veritabanları.
 * Her kliniğin verisi data/tenants/<klinik-id>.db dosyasında ayrı tutulur.
 * Bir istek yalnızca oturumdaki kullanıcının kliniğine ait dosyayı açar (clinicScope);
 * SQL sorgularının başka bir kliniğin verisine ulaşması fiziksel olarak mümkün değildir.
 */

export const TENANT_MIGRATIONS = [
  // 1: ilk şema
  `
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS owners (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    email       TEXT,
    notes       TEXT,
    sms_opt_in  INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_owners_phone ON owners(phone);
  CREATE INDEX IF NOT EXISTS idx_owners_name  ON owners(name);
  CREATE TABLE IF NOT EXISTS pets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id    INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    species     TEXT,
    breed       TEXT,
    sex         TEXT,
    birth_date  TEXT,
    notes       TEXT,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pets_owner ON pets(owner_id);
  CREATE TABLE IF NOT EXISTS reminders (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id              INTEGER NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    type                TEXT NOT NULL,
    title               TEXT NOT NULL,
    due_date            TEXT NOT NULL,
    notify_days_before  INTEGER NOT NULL DEFAULT 1,
    repeat_days         INTEGER,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','sent','done','cancelled','failed')),
    sent_at             TEXT,
    attempts            INTEGER NOT NULL DEFAULT 0,
    last_attempt_at     TEXT,
    last_error          TEXT,
    notes               TEXT,
    created_at          TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reminders_pet    ON reminders(pet_id);
  CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status, due_date);
  CREATE TABLE IF NOT EXISTS sms_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id     INTEGER,
    pet_id       INTEGER,
    reminder_id  INTEGER,
    phone        TEXT NOT NULL,
    message      TEXT NOT NULL,
    provider     TEXT NOT NULL,
    status       TEXT NOT NULL CHECK (status IN ('sent','failed')),
    provider_ref TEXT,
    error        TEXT,
    sent_by      TEXT,
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sms_created ON sms_log(created_at DESC);
  `,
  // 2: içe aktarma izi, sms_log snapshot ve tür
  `
  ALTER TABLE owners    ADD COLUMN import_batch TEXT;
  ALTER TABLE pets      ADD COLUMN import_batch TEXT;
  ALTER TABLE reminders ADD COLUMN created_by TEXT;
  ALTER TABLE sms_log   ADD COLUMN owner_name TEXT;
  ALTER TABLE sms_log   ADD COLUMN pet_name TEXT;
  ALTER TABLE sms_log   ADD COLUMN kind TEXT NOT NULL DEFAULT 'reminder';
  CREATE INDEX IF NOT EXISTS idx_sms_kind_created ON sms_log(kind, created_at);
  `,
  // 3: mevzuat uyumu — onay olay günlüğü, ret belirteci, ilgili kişi başvuruları, imha kaydı,
  //    sms_log hukuki izi, Ek-4 alanları (adres, mikroçip)
  `
  ALTER TABLE owners  ADD COLUMN address TEXT;
  ALTER TABLE owners  ADD COLUMN opt_out_token TEXT;
  ALTER TABLE pets    ADD COLUMN microchip_no TEXT;
  ALTER TABLE sms_log ADD COLUMN legal_basis TEXT;
  ALTER TABLE sms_log ADD COLUMN iys_flag TEXT;
  ALTER TABLE sms_log ADD COLUMN identity_used TEXT;
  ALTER TABLE sms_log ADD COLUMN anonymized_at TEXT;
  CREATE INDEX IF NOT EXISTS idx_sms_owner ON sms_log(owner_id);
  CREATE INDEX IF NOT EXISTS idx_owners_optout ON owners(opt_out_token);
  CREATE TABLE IF NOT EXISTS consent_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id     INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    action       TEXT NOT NULL CHECK (action IN ('grant','revoke')),
    channel      TEXT NOT NULL,
    note         TEXT,
    actor_email  TEXT,
    ip           TEXT,
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_consent_owner ON consent_events(owner_id, id DESC);
  CREATE TABLE IF NOT EXISTS subject_requests (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id         INTEGER,
    applicant_name   TEXT NOT NULL,
    applicant_phone  TEXT,
    kind             TEXT NOT NULL CHECK (kind IN ('bilgi','erisim','duzeltme','silme','itiraz')),
    channel          TEXT NOT NULL,
    received_at      TEXT NOT NULL,
    due_at           TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'acik' CHECK (status IN ('acik','kapali','reddedildi')),
    note             TEXT,
    closed_at        TEXT,
    closed_by        TEXT
  );
  CREATE TABLE IF NOT EXISTS imha_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at     TEXT NOT NULL,
    scope      TEXT NOT NULL,
    method     TEXT NOT NULL,
    row_count  INTEGER NOT NULL,
    criteria   TEXT,
    actor      TEXT
  );
  `,
];

// Kimlik, telefon ve iptal satırı gönderimde sistemce eklenir (src/sms/policy.js); şablon yalnızca gövdedir.
const DEFAULT_TEMPLATE =
  'Sayın {sahip}, {hayvan} adlı dostunuzun {tarih} tarihinde {tur} randevusu vardır. {klinik}';

export const DEFAULT_SETTINGS = {
  clinic_name: '',
  clinic_phone: '',
  sms_provider: 'console',
  sms_sender: '',            // Netgsm/İleti Merkezi başlığı, Twilio "From" numarası
  sms_credentials: '',       // şifreli JSON
  template: DEFAULT_TEMPLATE,
  send_hour_start: '9',
  send_hour_end: '20',
  scheduler_enabled: '1',
  daily_sms_limit: '200',
  // Hukuki kimlik (Ticari İletişim Yön. m.8/3): tacir -> MERSİS, esnaf -> ad-soyad + TCKN/VKN
  legal_form: '',            // 'tacir' | 'esnaf'
  mersis_no: '',
  tax_id: '',
  ruhsat_isim: '',           // ruhsattaki işletme adı (esnafta kimlik satırında kullanılır)
  kvkk_contact_email: '',
  kvkk_contact_phone: '',
  m61_declared_at: '',       // m.6/1 beyanı: iletişim bilgisi hasta sahibince bu amaçla verildi
  retention_sms_days: '1095', // sms_log kişisel alanlarının anonimleştirilme süresi (Yön. m.13/2: en az 3 yıl)
  notice_version: '',        // klinik -> hasta sahibi aydınlatma metni sürümü
};

/** Hukuki kimlik ve beyan eksikse SMS gönderimi kilitlenir (test hariç). Sorun listesi döner. */
export function legalProblems(settings) {
  const p = [];
  const form = settings.legal_form;
  if (form !== 'tacir' && form !== 'esnaf') p.push('İşletme türü (tacir/esnaf) seçilmemiş.');
  else if (form === 'tacir' && !/^\d{16}$/.test(settings.mersis_no || '')) p.push('MERSİS numarası (16 hane) girilmemiş.');
  else if (form === 'esnaf') {
    if (!/^\d{10,11}$/.test(settings.tax_id || '')) p.push('Vergi kimlik / T.C. kimlik numarası girilmemiş.');
    if (!String(settings.ruhsat_isim || '').trim()) p.push('Ruhsattaki işletme adı girilmemiş.');
  }
  if (!String(settings.clinic_phone || '').trim()) p.push('Klinik telefonu girilmemiş (iletide erişilebilir iletişim bilgisi zorunlu).');
  if (!settings.m61_declared_at) p.push('Hasta sahibi iletişim beyanı onaylanmamış.');
  return p;
}

const cache = new Map();
const ID_RE = /^[a-f0-9]{12}$/;

export function isValidClinicId(id) {
  return ID_RE.test(String(id || ''));
}

export function tenantPath(clinicId) {
  if (!isValidClinicId(clinicId)) throw new Error('Geçersiz klinik kimliği');
  return path.join(config.dataDir, 'tenants', `${clinicId}.db`);
}

/** Klinik veritabanını açar (önbellekli), şemayı/migrasyonları uygular. */
export function openTenant(clinicId) {
  let db = cache.get(clinicId);
  if (db) return db;
  db = new DatabaseSync(tenantPath(clinicId), { timeout: 5000 });
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  migrate(db, TENANT_MIGRATIONS);
  cache.set(clinicId, db);
  return db;
}

export function closeTenant(clinicId) {
  const db = cache.get(clinicId);
  if (!db) return;
  try { db.close(); } catch { /* yoksay */ }
  cache.delete(clinicId);
}

export function tenantExists(clinicId) {
  return fs.existsSync(tenantPath(clinicId));
}

export function closeAll() {
  for (const id of [...cache.keys()]) closeTenant(id);
}

/* ---------- Ayarlar ---------- */
export function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (Object.hasOwn(DEFAULT_SETTINGS, r.key)) s[r.key] = r.value;
  return s;
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? '' : String(value));
}

/* ---------- Sahipler ---------- */
const OWNER_LIST = `SELECT o.*, (SELECT COUNT(*) FROM pets p WHERE p.owner_id = o.id) AS pet_count FROM owners o`;

export const owners = {
  list: (db, q = '', escapeLike = (s) => s) => {
    if (q) {
      const like = `%${escapeLike(q)}%`;
      const digits = q.replace(/\D/g, '');
      const phoneLike = digits ? `%${digits}%` : like;
      return db.prepare(`${OWNER_LIST} WHERE o.name LIKE ? ESCAPE '\\' OR o.phone LIKE ? ESCAPE '\\' ORDER BY o.name LIMIT 300`).all(like, phoneLike);
    }
    return db.prepare(`${OWNER_LIST} ORDER BY o.name LIMIT 300`).all();
  },
  all: (db) => db.prepare('SELECT * FROM owners ORDER BY name').all(),
  get: (db, id) => db.prepare('SELECT * FROM owners WHERE id = ?').get(id),
  byPhone: (db, phone) => db.prepare('SELECT * FROM owners WHERE phone = ?').get(phone),
  create: (db, o) => db.prepare('INSERT INTO owners (name, phone, email, notes, sms_opt_in, created_at, import_batch, address, opt_out_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(o.name, o.phone, o.email ?? null, o.notes ?? null, o.sms_opt_in ?? 1, o.created_at, o.import_batch ?? null, o.address ?? null, o.opt_out_token ?? randomId(16)).lastInsertRowid,
  update: (db, id, o) => db.prepare('UPDATE owners SET name = ?, phone = ?, email = ?, notes = ?, sms_opt_in = ?, address = ? WHERE id = ?')
    .run(o.name, o.phone, o.email ?? null, o.notes ?? null, o.sms_opt_in ?? 1, o.address ?? null, id),
  setOptIn: (db, id, value) => db.prepare('UPDATE owners SET sms_opt_in = ? WHERE id = ?').run(value ? 1 : 0, id),
  /** İçe aktarmada mevcut sahibin BOŞ olan e-posta/not alanlarını doldurur; dolu alanlara dokunmaz */
  fillEmpty: (db, id, { email = null, notes = null }) => db.prepare(
    `UPDATE owners SET email = COALESCE(NULLIF(email, ''), ?), notes = COALESCE(NULLIF(notes, ''), ?) WHERE id = ?`).run(email, notes, id),
  delete: (db, id) => db.prepare('DELETE FROM owners WHERE id = ?').run(id),
  count: (db) => db.prepare('SELECT COUNT(*) AS c FROM owners').get().c,
  /* --- Ret belirteci (SMS'teki iptal bağlantısı) --- */
  byOptOutToken: (db, token) => db.prepare('SELECT * FROM owners WHERE opt_out_token = ?').get(token),
  setOptOutToken: (db, id, token) => db.prepare('UPDATE owners SET opt_out_token = ? WHERE id = ?').run(token, id),
  /**
   * Anonimleştirme (KVKK m.7, İmha Yön. m.10): ad/iletişim alanları silinir, satır ve kimlik korunur.
   * phone NOT NULL olduğundan yönlendirilemez yer tutucu yazılır. Hayvan ve hatırlatmalar CASCADE ile gider.
   */
  anonymize: (db, id) => db.prepare(`UPDATE owners SET name = '[silindi]', phone = ?, email = NULL, notes = NULL, address = NULL,
    sms_opt_in = 0, opt_out_token = NULL WHERE id = ?`).run(`sil-${id}`, id),
};

/* ---------- Onay olayları (Ticari İletişim Yön. m.7/10, m.13/1 ispat; KVKK m.12 hesap verebilirlik) ---------- */
export const consents = {
  log: (db, e) => db.prepare('INSERT INTO consent_events (owner_id, action, channel, note, actor_email, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(e.owner_id, e.action, e.channel, e.note ?? null, e.actor_email ?? null, e.ip ?? null, e.created_at).lastInsertRowid,
  history: (db, ownerId) => db.prepare('SELECT * FROM consent_events WHERE owner_id = ? ORDER BY id DESC LIMIT 50').all(ownerId),
  last: (db, ownerId) => db.prepare('SELECT * FROM consent_events WHERE owner_id = ? ORDER BY id DESC LIMIT 1').get(ownerId),
};

/* ---------- İlgili kişi başvuruları (KVKK m.13; Başvuru Tebliği m.6/5: en geç 30 gün) ---------- */
export const SUBJECT_REQUEST_KINDS = Object.freeze({
  bilgi: 'Bilgi talebi', erisim: 'Verilerine erişim', duzeltme: 'Düzeltme', silme: 'Silme / yok etme', itiraz: 'İtiraz',
});

export const subjectRequests = {
  create: (db, r) => db.prepare(`INSERT INTO subject_requests (owner_id, applicant_name, applicant_phone, kind, channel, received_at, due_at, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(r.owner_id ?? null, r.applicant_name, r.applicant_phone ?? null, r.kind, r.channel, r.received_at, r.due_at, r.note ?? null).lastInsertRowid,
  get: (db, id) => db.prepare('SELECT * FROM subject_requests WHERE id = ?').get(id),
  list: (db) => db.prepare(`SELECT * FROM subject_requests ORDER BY CASE status WHEN 'acik' THEN 0 ELSE 1 END, due_at ASC, id DESC LIMIT 300`).all(),
  openCount: (db) => db.prepare(`SELECT COUNT(*) AS c FROM subject_requests WHERE status = 'acik'`).get().c,
  close: (db, id, { status, closedBy, closedAt, note }) => db.prepare(
    `UPDATE subject_requests SET status = ?, closed_by = ?, closed_at = ?, note = COALESCE(?, note) WHERE id = ? AND status = 'acik'`)
    .run(status, closedBy, closedAt, note ?? null, id).changes,
};

/* ---------- İmha kaydı (İmha Yön. m.7/3: en az 3 yıl saklanır; asla silinmez) ---------- */
export const imhaLog = {
  add: (db, r) => db.prepare('INSERT INTO imha_log (run_at, scope, method, row_count, criteria, actor) VALUES (?, ?, ?, ?, ?, ?)')
    .run(r.run_at, r.scope, r.method, r.row_count, r.criteria ?? null, r.actor ?? null).lastInsertRowid,
  recent: (db, limit = 100) => db.prepare('SELECT * FROM imha_log ORDER BY id DESC LIMIT ?').all(limit),
  lastRunAt: (db, scope) => db.prepare('SELECT run_at FROM imha_log WHERE scope = ? ORDER BY id DESC LIMIT 1').get(scope)?.run_at ?? null,
};

/* ---------- Hayvanlar ---------- */
export const pets = {
  byOwner: (db, ownerId) => db.prepare('SELECT * FROM pets WHERE owner_id = ? ORDER BY name').all(ownerId),
  allWithOwner: (db) => db.prepare(`SELECT p.*, o.name AS owner_name, o.phone AS owner_phone, o.email AS owner_email, o.address AS owner_address, o.sms_opt_in
    FROM pets p JOIN owners o ON o.id = p.owner_id ORDER BY o.name, p.name`).all(),
  get: (db, id) => db.prepare(`
    SELECT p.*, o.name AS owner_name, o.phone AS owner_phone, o.sms_opt_in
    FROM pets p JOIN owners o ON o.id = p.owner_id WHERE p.id = ?`).get(id),
  create: (db, p) => db.prepare('INSERT INTO pets (owner_id, name, species, breed, sex, birth_date, notes, created_at, import_batch, microchip_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.owner_id, p.name, p.species ?? null, p.breed ?? null, p.sex ?? null, p.birth_date ?? null, p.notes ?? null, p.created_at, p.import_batch ?? null, p.microchip_no ?? null).lastInsertRowid,
  update: (db, id, p) => db.prepare('UPDATE pets SET name = ?, species = ?, breed = ?, sex = ?, birth_date = ?, notes = ?, microchip_no = ? WHERE id = ?')
    .run(p.name, p.species ?? null, p.breed ?? null, p.sex ?? null, p.birth_date ?? null, p.notes ?? null, p.microchip_no ?? null, id),
  delete: (db, id) => db.prepare('DELETE FROM pets WHERE id = ?').run(id),
  count: (db) => db.prepare('SELECT COUNT(*) AS c FROM pets').get().c,
};

/* ---------- Hatırlatmalar ---------- */
const REMINDER_SELECT = `
  SELECT r.*, p.name AS pet_name, p.species, o.id AS owner_id, o.name AS owner_name, o.phone AS owner_phone, o.sms_opt_in, o.opt_out_token
  FROM reminders r
  JOIN pets p ON p.id = r.pet_id
  JOIN owners o ON o.id = p.owner_id`;

/** Bekleyen hatırlatmalar için bildirim tarihi = due_date - notify_days_before. Eski (3 günden fazla geçmiş) olanlar gönderilmez. */
const DUE_WHERE = `r.status = 'pending'
      AND date(r.due_date, '-' || r.notify_days_before || ' days') <= date(?)
      AND date(r.due_date) >= date(?, '-3 days')`;

export const reminders = {
  get: (db, id) => db.prepare(`${REMINDER_SELECT} WHERE r.id = ?`).get(id),
  byOwner: (db, ownerId) => db.prepare(`${REMINDER_SELECT} WHERE o.id = ? ORDER BY r.due_date DESC`).all(ownerId),
  list: (db, { status = '', from = '', to = '' } = {}) => {
    const where = [];
    const params = [];
    if (status) { where.push('r.status = ?'); params.push(status); }
    if (from) { where.push('r.due_date >= ?'); params.push(from); }
    if (to) { where.push('r.due_date <= ?'); params.push(to); }
    const sql = `${REMINDER_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY r.due_date ASC LIMIT 500`;
    return db.prepare(sql).all(...params);
  },
  /** Bugün SMS'i gönderilmesi gereken bekleyen hatırlatmalar */
  due: (db, today) => db.prepare(`${REMINDER_SELECT} WHERE ${DUE_WHERE} ORDER BY r.due_date`).all(today, today),
  /** Belirli bir günde bildirim tarihi gelecek bekleyenler (panel: "Yarın") */
  dueOn: (db, date) => db.prepare(`${REMINDER_SELECT}
    WHERE r.status = 'pending' AND date(r.due_date, '-' || r.notify_days_before || ' days') = date(?) ORDER BY r.due_date`).all(date),
  /** Süresi geçmiş: bekliyor ama zamanlayıcının artık göndermeyeceği kadar eski */
  overdue: (db, today) => db.prepare(`${REMINDER_SELECT}
    WHERE r.status = 'pending' AND date(r.due_date) < date(?, '-3 days') ORDER BY r.due_date DESC LIMIT 100`).all(today),
  upcoming: (db, from, to) => db.prepare(`${REMINDER_SELECT}
    WHERE r.status IN ('pending','sent') AND r.due_date BETWEEN ? AND ? ORDER BY r.due_date`).all(from, to),
  create: (db, r) => db.prepare(`INSERT INTO reminders (pet_id, type, title, due_date, notify_days_before, repeat_days, notes, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.pet_id, r.type, r.title, r.due_date, r.notify_days_before, r.repeat_days ?? null, r.notes ?? null, r.created_at, r.created_by ?? null).lastInsertRowid,
  update: (db, id, r) => db.prepare(`UPDATE reminders SET type = ?, title = ?, due_date = ?, notify_days_before = ?, repeat_days = ?, notes = ? WHERE id = ?`)
    .run(r.type, r.title, r.due_date, r.notify_days_before, r.repeat_days ?? null, r.notes ?? null, id),
  setStatus: (db, id, status) => db.prepare('UPDATE reminders SET status = ? WHERE id = ?').run(status, id),
  resetForRetry: (db, id) => db.prepare(`UPDATE reminders SET status = 'pending', attempts = 0, last_error = NULL, last_attempt_at = NULL WHERE id = ?`).run(id),
  /** Tarih değişince gönderilmiş/başarısız hatırlatmayı yeniden beklemeye alır */
  reopen: (db, id) => db.prepare(`UPDATE reminders SET status = 'pending', attempts = 0, last_error = NULL, last_attempt_at = NULL, sent_at = NULL WHERE id = ?`).run(id),
  /** Gönderimden hemen önce iz bırakır: çökme/yeniden başlatmada aynı hatırlatma 4 saat içinde tekrar gönderilmez */
  claim: (db, id, at) => db.prepare(`UPDATE reminders SET last_attempt_at = ? WHERE id = ? AND status = 'pending'`).run(at, id).changes,
  setLastAttempt: (db, id, value) => db.prepare('UPDATE reminders SET last_attempt_at = ? WHERE id = ?').run(value, id),
  existsPending: (db, petId, title, dueDate) =>
    Boolean(db.prepare(`SELECT 1 FROM reminders WHERE pet_id = ? AND title = ? AND due_date = ? AND status = 'pending' LIMIT 1`).get(petId, title, dueDate)),
  /** Kalıcı olarak başarısız olanlar (panelde gösterilir) */
  failedList: (db) => db.prepare(`${REMINDER_SELECT} WHERE r.status = 'failed' ORDER BY r.due_date DESC LIMIT 100`).all(),
  markSent: (db, id, at) => db.prepare(`UPDATE reminders SET status = 'sent', sent_at = ?, attempts = attempts + 1, last_attempt_at = ?, last_error = NULL WHERE id = ?`).run(at, at, id),
  markAttemptFailed: (db, id, at, error, maxAttempts) => db.prepare(`
    UPDATE reminders SET attempts = attempts + 1, last_attempt_at = ?, last_error = ?,
      status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE status END
    WHERE id = ?`).run(at, error, maxAttempts, id),
  delete: (db, id) => db.prepare('DELETE FROM reminders WHERE id = ?').run(id),
  countByStatus: (db) => db.prepare('SELECT status, COUNT(*) AS c FROM reminders GROUP BY status').all(),
};

/* ---------- SMS Günlüğü ---------- */
const SMS_SELECT = `
  SELECT s.*, (o.id IS NOT NULL) AS owner_exists,
         COALESCE(o.name, s.owner_name) AS owner_name_display,
         COALESCE(p.name, s.pet_name) AS pet_name_display
  FROM sms_log s LEFT JOIN owners o ON o.id = s.owner_id LEFT JOIN pets p ON p.id = s.pet_id`;

/** Anonimleştirilmiş satırda kişisel alanlar yerine bu yer tutucular kalır (sayım/durum bilgisi korunur) */
const SCRUB_SQL = `UPDATE sms_log SET phone = '', message = '[anonim]', owner_name = NULL, pet_name = NULL, anonymized_at = ?`;

export const smsLog = {
  add: (db, l) => db.prepare(`INSERT INTO sms_log (owner_id, pet_id, reminder_id, phone, message, provider, status, provider_ref, error, sent_by, created_at, owner_name, pet_name, kind, legal_basis, iys_flag, identity_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(l.owner_id ?? null, l.pet_id ?? null, l.reminder_id ?? null, l.phone, l.message, l.provider, l.status, l.provider_ref ?? null, l.error ?? null, l.sent_by ?? null, l.created_at, l.owner_name ?? null, l.pet_name ?? null, l.kind ?? 'reminder', l.legal_basis ?? null, l.iys_flag ?? null, l.identity_used ?? null).lastInsertRowid,
  recent: (db, limit = 200) => db.prepare(`${SMS_SELECT} ORDER BY s.id DESC LIMIT ?`).all(limit),
  byOwner: (db, ownerId) => db.prepare(`${SMS_SELECT} WHERE s.owner_id = ? ORDER BY s.id DESC LIMIT 100`).all(ownerId),
  allByOwner: (db, ownerId) => db.prepare('SELECT * FROM sms_log WHERE owner_id = ? ORDER BY id').all(ownerId),
  /** Sahip silinince/anonimleşince kişisel alanlar temizlenir; satır (sayım, durum, sağlayıcı referansı) kalır */
  scrubOwner: (db, ownerId, at) => db.prepare(`${SCRUB_SQL} WHERE owner_id = ? AND anonymized_at IS NULL`).run(at, ownerId).changes,
  /** Saklama süresi dolan satırların kişisel alanları temizlenir (periyodik imha) */
  scrubOlderThan: (db, cutoffIso, at) => db.prepare(`${SCRUB_SQL} WHERE created_at < ? AND anonymized_at IS NULL`).run(at, cutoffIso).changes,
  /** Belirli bir andan itibaren gönderilen+başarısız toplamı (günlük tavan hesabı) */
  countSince: (db, sinceIso) => db.prepare('SELECT COUNT(*) AS c FROM sms_log WHERE created_at >= ?').get(sinceIso).c,
  countBetween: (db, fromIso, toIso) => {
    const rows = db.prepare('SELECT status, COUNT(*) AS c FROM sms_log WHERE created_at >= ? AND created_at < ? GROUP BY status').all(fromIso, toIso);
    const out = { sent: 0, failed: 0 };
    for (const r of rows) out[r.status] = r.c;
    return out;
  },
};
