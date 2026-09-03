import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

/**
 * Kiracı (klinik) veritabanları.
 * Her kliniğin verisi data/tenants/<klinik-id>.db dosyasında ayrı tutulur.
 * Bir istek yalnızca oturumdaki kullanıcının kliniğine ait dosyayı açar;
 * SQL sorgularının başka bir kliniğin verisine ulaşması fiziksel olarak mümkün değildir.
 */

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS owners (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,             -- 905XXXXXXXXX
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
    due_date            TEXT NOT NULL,            -- YYYY-MM-DD
    notify_days_before  INTEGER NOT NULL DEFAULT 1,
    repeat_days         INTEGER,                  -- NULL = tekrar yok
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
    sent_by      TEXT,                            -- 'zamanlayici' veya kullanıcı e-postası
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sms_created ON sms_log(created_at DESC);
`;

const DEFAULT_TEMPLATE =
  'Sayın {sahip}, {hayvan} adlı dostunuzun {tarih} tarihinde {tur} randevusu vardır. Bilgi için: {klinik_tel} - {klinik}';

export const DEFAULT_SETTINGS = {
  clinic_name: '',
  clinic_phone: '',
  sms_provider: 'console',
  sms_sender: '',            // Netgsm başlığı / Twilio "From" numarası
  sms_credentials: '',       // şifreli JSON
  template: DEFAULT_TEMPLATE,
  send_hour_start: '9',
  send_hour_end: '20',
  scheduler_enabled: '1',
};

const cache = new Map();
const ID_RE = /^[a-f0-9]{12}$/;

export function tenantPath(clinicId) {
  if (!ID_RE.test(clinicId)) throw new Error('Geçersiz klinik kimliği');
  return path.join(config.dataDir, 'tenants', `${clinicId}.db`);
}

/** Klinik veritabanını açar (önbellekli) ve şemayı hazırlar. */
export function openTenant(clinicId) {
  let db = cache.get(clinicId);
  if (db) return db;
  db = new DatabaseSync(tenantPath(clinicId));
  db.exec(SCHEMA);
  cache.set(clinicId, db);
  return db;
}

export function tenantExists(clinicId) {
  return fs.existsSync(tenantPath(clinicId));
}

export function closeAll() {
  for (const db of cache.values()) {
    try { db.close(); } catch { /* yoksay */ }
  }
  cache.clear();
}

/* ---------- Ayarlar ---------- */
export function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s;
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? '' : String(value));
}

/* ---------- Sahipler ---------- */
export const owners = {
  list: (db, q = '') => {
    if (q) {
      const like = `%${q}%`;
      const digits = q.replace(/\D/g, '');
      const phoneLike = digits ? `%${digits}%` : like;
      return db.prepare(`
        SELECT o.*, (SELECT COUNT(*) FROM pets p WHERE p.owner_id = o.id) AS pet_count
        FROM owners o WHERE o.name LIKE ? OR o.phone LIKE ? ORDER BY o.name LIMIT 300`).all(like, phoneLike);
    }
    return db.prepare(`
      SELECT o.*, (SELECT COUNT(*) FROM pets p WHERE p.owner_id = o.id) AS pet_count
      FROM owners o ORDER BY o.name LIMIT 300`).all();
  },
  get: (db, id) => db.prepare('SELECT * FROM owners WHERE id = ?').get(id),
  create: (db, o) => db.prepare('INSERT INTO owners (name, phone, email, notes, sms_opt_in, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(o.name, o.phone, o.email, o.notes, o.sms_opt_in, o.created_at).lastInsertRowid,
  update: (db, id, o) => db.prepare('UPDATE owners SET name = ?, phone = ?, email = ?, notes = ?, sms_opt_in = ? WHERE id = ?')
    .run(o.name, o.phone, o.email, o.notes, o.sms_opt_in, id),
  delete: (db, id) => db.prepare('DELETE FROM owners WHERE id = ?').run(id),
  count: (db) => db.prepare('SELECT COUNT(*) AS c FROM owners').get().c,
};

/* ---------- Hayvanlar ---------- */
export const pets = {
  byOwner: (db, ownerId) => db.prepare('SELECT * FROM pets WHERE owner_id = ? ORDER BY name').all(ownerId),
  get: (db, id) => db.prepare(`
    SELECT p.*, o.name AS owner_name, o.phone AS owner_phone, o.sms_opt_in
    FROM pets p JOIN owners o ON o.id = p.owner_id WHERE p.id = ?`).get(id),
  create: (db, p) => db.prepare('INSERT INTO pets (owner_id, name, species, breed, sex, birth_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.owner_id, p.name, p.species, p.breed, p.sex, p.birth_date, p.notes, p.created_at).lastInsertRowid,
  update: (db, id, p) => db.prepare('UPDATE pets SET name = ?, species = ?, breed = ?, sex = ?, birth_date = ?, notes = ? WHERE id = ?')
    .run(p.name, p.species, p.breed, p.sex, p.birth_date, p.notes, id),
  delete: (db, id) => db.prepare('DELETE FROM pets WHERE id = ?').run(id),
  count: (db) => db.prepare('SELECT COUNT(*) AS c FROM pets').get().c,
};

/* ---------- Hatırlatmalar ---------- */
const REMINDER_SELECT = `
  SELECT r.*, p.name AS pet_name, p.species, o.id AS owner_id, o.name AS owner_name, o.phone AS owner_phone, o.sms_opt_in
  FROM reminders r
  JOIN pets p ON p.id = r.pet_id
  JOIN owners o ON o.id = p.owner_id`;

export const reminders = {
  get: (db, id) => db.prepare(`${REMINDER_SELECT} WHERE r.id = ?`).get(id),
  byPet: (db, petId) => db.prepare(`${REMINDER_SELECT} WHERE r.pet_id = ? ORDER BY r.due_date DESC`).all(petId),
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
  due: (db, today) => db.prepare(`${REMINDER_SELECT}
    WHERE r.status = 'pending'
      AND date(r.due_date, '-' || r.notify_days_before || ' days') <= date(?)
    ORDER BY r.due_date`).all(today),
  upcoming: (db, from, to) => db.prepare(`${REMINDER_SELECT}
    WHERE r.status IN ('pending','sent') AND r.due_date BETWEEN ? AND ? ORDER BY r.due_date`).all(from, to),
  create: (db, r) => db.prepare(`INSERT INTO reminders (pet_id, type, title, due_date, notify_days_before, repeat_days, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(r.pet_id, r.type, r.title, r.due_date, r.notify_days_before, r.repeat_days, r.notes, r.created_at).lastInsertRowid,
  update: (db, id, r) => db.prepare(`UPDATE reminders SET type = ?, title = ?, due_date = ?, notify_days_before = ?, repeat_days = ?, notes = ? WHERE id = ?`)
    .run(r.type, r.title, r.due_date, r.notify_days_before, r.repeat_days, r.notes, id),
  setStatus: (db, id, status) => db.prepare('UPDATE reminders SET status = ? WHERE id = ?').run(status, id),
  markSent: (db, id, at) => db.prepare(`UPDATE reminders SET status = 'sent', sent_at = ?, attempts = attempts + 1, last_attempt_at = ?, last_error = NULL WHERE id = ?`).run(at, at, id),
  markAttemptFailed: (db, id, at, error, maxAttempts) => db.prepare(`
    UPDATE reminders SET attempts = attempts + 1, last_attempt_at = ?, last_error = ?,
      status = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE status END
    WHERE id = ?`).run(at, error, maxAttempts, id),
  delete: (db, id) => db.prepare('DELETE FROM reminders WHERE id = ?').run(id),
  countByStatus: (db) => db.prepare('SELECT status, COUNT(*) AS c FROM reminders GROUP BY status').all(),
};

/* ---------- SMS Günlüğü ---------- */
export const smsLog = {
  add: (db, l) => db.prepare(`INSERT INTO sms_log (owner_id, pet_id, reminder_id, phone, message, provider, status, provider_ref, error, sent_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(l.owner_id ?? null, l.pet_id ?? null, l.reminder_id ?? null, l.phone, l.message, l.provider, l.status, l.provider_ref ?? null, l.error ?? null, l.sent_by ?? null, l.created_at),
  recent: (db, limit = 200) => db.prepare(`
    SELECT s.*, o.name AS owner_name, p.name AS pet_name
    FROM sms_log s LEFT JOIN owners o ON o.id = s.owner_id LEFT JOIN pets p ON p.id = s.pet_id
    ORDER BY s.id DESC LIMIT ?`).all(limit),
  byOwner: (db, ownerId) => db.prepare('SELECT * FROM sms_log WHERE owner_id = ? ORDER BY id DESC LIMIT 100').all(ownerId),
  countSince: (db, sinceIso) => db.prepare(`SELECT status, COUNT(*) AS c FROM sms_log WHERE created_at >= ? GROUP BY status`).all(sinceIso),
};
