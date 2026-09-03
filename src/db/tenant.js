import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
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
];

const DEFAULT_TEMPLATE =
  'Sayın {sahip}, {hayvan} adlı dostunuzun {tarih} tarihinde {tur} randevusu vardır. Bilgi için: {klinik_tel} - {klinik}';

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
};

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
  create: (db, o) => db.prepare('INSERT INTO owners (name, phone, email, notes, sms_opt_in, created_at, import_batch) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(o.name, o.phone, o.email ?? null, o.notes ?? null, o.sms_opt_in ?? 1, o.created_at, o.import_batch ?? null).lastInsertRowid,
  update: (db, id, o) => db.prepare('UPDATE owners SET name = ?, phone = ?, email = ?, notes = ?, sms_opt_in = ? WHERE id = ?')
    .run(o.name, o.phone, o.email ?? null, o.notes ?? null, o.sms_opt_in ?? 1, id),
  delete: (db, id) => db.prepare('DELETE FROM owners WHERE id = ?').run(id),
  count: (db) => db.prepare('SELECT COUNT(*) AS c FROM owners').get().c,
};

/* ---------- Hayvanlar ---------- */
export const pets = {
  byOwner: (db, ownerId) => db.prepare('SELECT * FROM pets WHERE owner_id = ? ORDER BY name').all(ownerId),
  allWithOwner: (db) => db.prepare(`SELECT p.*, o.name AS owner_name, o.phone AS owner_phone, o.email AS owner_email, o.sms_opt_in
    FROM pets p JOIN owners o ON o.id = p.owner_id ORDER BY o.name, p.name`).all(),
  get: (db, id) => db.prepare(`
    SELECT p.*, o.name AS owner_name, o.phone AS owner_phone, o.sms_opt_in
    FROM pets p JOIN owners o ON o.id = p.owner_id WHERE p.id = ?`).get(id),
  create: (db, p) => db.prepare('INSERT INTO pets (owner_id, name, species, breed, sex, birth_date, notes, created_at, import_batch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.owner_id, p.name, p.species ?? null, p.breed ?? null, p.sex ?? null, p.birth_date ?? null, p.notes ?? null, p.created_at, p.import_batch ?? null).lastInsertRowid,
  update: (db, id, p) => db.prepare('UPDATE pets SET name = ?, species = ?, breed = ?, sex = ?, birth_date = ?, notes = ? WHERE id = ?')
    .run(p.name, p.species ?? null, p.breed ?? null, p.sex ?? null, p.birth_date ?? null, p.notes ?? null, id),
  delete: (db, id) => db.prepare('DELETE FROM pets WHERE id = ?').run(id),
  count: (db) => db.prepare('SELECT COUNT(*) AS c FROM pets').get().c,
};

/* ---------- Hatırlatmalar ---------- */
const REMINDER_SELECT = `
  SELECT r.*, p.name AS pet_name, p.species, o.id AS owner_id, o.name AS owner_name, o.phone AS owner_phone, o.sms_opt_in
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

export const smsLog = {
  add: (db, l) => db.prepare(`INSERT INTO sms_log (owner_id, pet_id, reminder_id, phone, message, provider, status, provider_ref, error, sent_by, created_at, owner_name, pet_name, kind)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(l.owner_id ?? null, l.pet_id ?? null, l.reminder_id ?? null, l.phone, l.message, l.provider, l.status, l.provider_ref ?? null, l.error ?? null, l.sent_by ?? null, l.created_at, l.owner_name ?? null, l.pet_name ?? null, l.kind ?? 'reminder').lastInsertRowid,
  recent: (db, limit = 200) => db.prepare(`${SMS_SELECT} ORDER BY s.id DESC LIMIT ?`).all(limit),
  byOwner: (db, ownerId) => db.prepare(`${SMS_SELECT} WHERE s.owner_id = ? ORDER BY s.id DESC LIMIT 100`).all(ownerId),
  /** Belirli bir andan itibaren gönderilen+başarısız toplamı (günlük tavan hesabı) */
  countSince: (db, sinceIso) => db.prepare('SELECT COUNT(*) AS c FROM sms_log WHERE created_at >= ?').get(sinceIso).c,
  countBetween: (db, fromIso, toIso) => {
    const rows = db.prepare('SELECT status, COUNT(*) AS c FROM sms_log WHERE created_at >= ? AND created_at < ? GROUP BY status').all(fromIso, toIso);
    const out = { sent: 0, failed: 0 };
    for (const r of rows) out[r.status] = r.c;
    return out;
  },
};
