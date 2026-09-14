import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { migrate } from './migrate.js';

/**
 * Master veritabanı: klinikler (kiracılar), kullanıcılar, oturumlar, denetim günlüğü.
 * Kliniklere ait hasta/hatırlatma verileri burada DEĞİL, her kliniğin kendi dosyasında tutulur (tenant.js).
 */

export const MASTER_MIGRATIONS = [
  // 1: ilk şema
  `
  CREATE TABLE IF NOT EXISTS clinics (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    phone       TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    clinic_id      TEXT REFERENCES clinics(id) ON DELETE CASCADE,
    email          TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL CHECK (role IN ('superadmin','admin','staff')),
    active         INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL,
    last_login_at  TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    ip          TEXT,
    user_agent  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);
  `,
  // 2: parola zorunlu değişim, klinik SMS tavanı, denetim günlüğü
  `
  ALTER TABLE users    ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE clinics  ADD COLUMN sms_daily_cap INTEGER NOT NULL DEFAULT 300;
  ALTER TABLE clinics  ADD COLUMN updated_at TEXT;
  ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;
  CREATE TABLE IF NOT EXISTS audit_log (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at     TEXT NOT NULL,
    actor_user_id  INTEGER,
    actor_email    TEXT,
    actor_role     TEXT,
    clinic_id      TEXT,
    action         TEXT NOT NULL,
    entity_type    TEXT,
    entity_id      TEXT,
    ip             TEXT,
    meta           TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_audit_clinic ON audit_log(clinic_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action, created_at);
  `,
  // 3: mevzuat uyumu — sözleşme kabul kayıtları, veri ihlali kayıtları, kliniğin aydınlatma metni için herkese açık kısa ad
  `
  ALTER TABLE clinics ADD COLUMN public_slug TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_clinics_slug ON clinics(public_slug);
  CREATE TABLE IF NOT EXISTS legal_acceptances (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    clinic_id    TEXT,
    slug         TEXT NOT NULL,
    version      TEXT NOT NULL,
    doc_sha256   TEXT NOT NULL,
    accepted_at  TEXT NOT NULL,
    ip           TEXT,
    user_agent   TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_legal_clinic ON legal_acceptances(clinic_id, slug, id DESC);
  CREATE TABLE IF NOT EXISTS breaches (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    clinic_id             TEXT,
    detected_at           TEXT NOT NULL,
    occurred_at           TEXT,
    source                TEXT,
    affected_count        INTEGER,
    categories            TEXT,
    consequences          TEXT,
    measures              TEXT,
    clinic_notified_at    TEXT,
    kurul_notified_at     TEXT,
    subjects_notified_at  TEXT,
    created_by            TEXT,
    created_at            TEXT NOT NULL
  );
  `,
];

export const master = new DatabaseSync(path.join(config.dataDir, 'master.db'), { timeout: 5000 });
master.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
migrate(master, MASTER_MIGRATIONS);

export const clinics = {
  all: () => master.prepare('SELECT * FROM clinics ORDER BY created_at DESC').all(),
  active: () => master.prepare('SELECT * FROM clinics WHERE active = 1').all(),
  get: (id) => master.prepare('SELECT * FROM clinics WHERE id = ?').get(id),
  create: (id, name, phone, createdAt) =>
    master.prepare('INSERT INTO clinics (id, name, phone, active, created_at) VALUES (?, ?, ?, 1, ?)').run(id, name, phone, createdAt),
  setActive: (id, active) => master.prepare('UPDATE clinics SET active = ?, updated_at = ? WHERE id = ?').run(active ? 1 : 0, new Date().toISOString(), id),
  update: (id, { name, phone, smsDailyCap }) =>
    master.prepare('UPDATE clinics SET name = ?, phone = ?, sms_daily_cap = ?, updated_at = ? WHERE id = ?')
      .run(name, phone, smsDailyCap, new Date().toISOString(), id),
  delete: (id) => master.prepare('DELETE FROM clinics WHERE id = ?').run(id),
  userCount: (id) => master.prepare('SELECT COUNT(*) AS c FROM users WHERE clinic_id = ?').get(id).c,
  bySlug: (slug) => master.prepare('SELECT * FROM clinics WHERE public_slug = ?').get(slug),
  setSlug: (id, slug) => master.prepare('UPDATE clinics SET public_slug = ? WHERE id = ?').run(slug, id),
};

/* ---------- Sözleşme kabulleri (TBK m.21 ispat; 6563 m.11/3: 10 yıl saklanır, imha edilmez) ---------- */
export const legalAcceptances = {
  add: (r) => master.prepare(`INSERT INTO legal_acceptances (user_id, clinic_id, slug, version, doc_sha256, accepted_at, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(r.user_id, r.clinic_id ?? null, r.slug, r.version, r.doc_sha256, r.accepted_at, r.ip ?? null, r.user_agent ?? null).lastInsertRowid,
  latest: (clinicId, slug) => master.prepare('SELECT * FROM legal_acceptances WHERE clinic_id = ? AND slug = ? ORDER BY id DESC LIMIT 1').get(clinicId, slug),
  byClinic: (clinicId) => master.prepare('SELECT * FROM legal_acceptances WHERE clinic_id = ? ORDER BY id DESC LIMIT 50').all(clinicId),
};

/* ---------- Veri ihlali kayıtları (KVKK m.12/5; Kurul 2019/10: 72 saat, kayıt altına alınır) ---------- */
export const breaches = {
  add: (r) => master.prepare(`INSERT INTO breaches (clinic_id, detected_at, occurred_at, source, affected_count, categories, consequences, measures,
    clinic_notified_at, kurul_notified_at, subjects_notified_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(r.clinic_id ?? null, r.detected_at, r.occurred_at ?? null, r.source ?? null, r.affected_count ?? null, r.categories ?? null, r.consequences ?? null,
      r.measures ?? null, r.clinic_notified_at ?? null, r.kurul_notified_at ?? null, r.subjects_notified_at ?? null, r.created_by ?? null, r.created_at).lastInsertRowid,
  get: (id) => master.prepare('SELECT * FROM breaches WHERE id = ?').get(id),
  all: () => master.prepare('SELECT * FROM breaches ORDER BY id DESC LIMIT 200').all(),
  setNotified: (id, field, at) => {
    if (!['clinic_notified_at', 'kurul_notified_at', 'subjects_notified_at'].includes(field)) throw new Error('Geçersiz alan');
    return master.prepare(`UPDATE breaches SET ${field} = ? WHERE id = ?`).run(at, id).changes;
  },
};

export const users = {
  count: () => master.prepare('SELECT COUNT(*) AS c FROM users').get().c,
  byEmail: (email) => master.prepare('SELECT * FROM users WHERE email = ?').get(email),
  byId: (id) => master.prepare('SELECT * FROM users WHERE id = ?').get(id),
  byClinic: (clinicId) => master.prepare(
    'SELECT id, email, name, role, active, created_at, last_login_at, must_change_password FROM users WHERE clinic_id = ? ORDER BY created_at').all(clinicId),
  create: ({ clinicId, email, name, passwordHash, role, createdAt, mustChangePassword = 0 }) =>
    master.prepare('INSERT INTO users (clinic_id, email, name, password_hash, role, active, created_at, must_change_password) VALUES (?, ?, ?, ?, ?, 1, ?, ?)')
      .run(clinicId, email, name, passwordHash, role, createdAt, mustChangePassword ? 1 : 0),
  setPassword: (id, hash, mustChange = 0) =>
    master.prepare('UPDATE users SET password_hash = ?, must_change_password = ? WHERE id = ?').run(hash, mustChange ? 1 : 0, id),
  setActive: (id, active) => master.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id),
  setRole: (id, role) => master.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id),
  touchLogin: (id, at) => master.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(at, id),
  delete: (id) => master.prepare('DELETE FROM users WHERE id = ?').run(id),
};

export const sessions = {
  create: ({ id, userId, csrf, createdAt, expiresAt, ip, userAgent }) =>
    master.prepare('INSERT INTO sessions (id, user_id, csrf, created_at, expires_at, ip, user_agent, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, csrf, createdAt, expiresAt, ip, userAgent, createdAt),
  get: (id) => master.prepare(`
    SELECT s.id AS session_id, s.csrf, s.expires_at,
           u.id AS user_id, u.email, u.name, u.role, u.clinic_id, u.active AS user_active, u.must_change_password,
           c.name AS clinic_name, c.active AS clinic_active
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN clinics c ON c.id = u.clinic_id
    WHERE s.id = ?`).get(id),
  touch: (id, at) => master.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(at, id),
  delete: (id) => master.prepare('DELETE FROM sessions WHERE id = ?').run(id),
  deleteForUser: (userId) => master.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId),
  purgeExpired: (nowIso) => master.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso),
};

export const auditLog = {
  add: (r) => master.prepare(`INSERT INTO audit_log (created_at, actor_user_id, actor_email, actor_role, clinic_id, action, entity_type, entity_id, ip, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(r.created_at, r.actor_user_id ?? null, r.actor_email ?? null, r.actor_role ?? null, r.clinic_id ?? null, r.action, r.entity_type ?? null, r.entity_id ?? null, r.ip ?? null, r.meta ?? null),
  recent: (limit = 200, clinicId = null) => clinicId
    ? master.prepare('SELECT * FROM audit_log WHERE clinic_id = ? ORDER BY id DESC LIMIT ?').all(clinicId, limit)
    : master.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit),
  existsSince: (clinicId, action, sinceIso) =>
    Boolean(master.prepare('SELECT 1 FROM audit_log WHERE clinic_id = ? AND action = ? AND created_at >= ? LIMIT 1').get(clinicId, action, sinceIso)),
  /** Saklama süresi dolan satırlarda kişiyi tanımlayan alanlar maskelenir; olay kaydı kalır */
  maskOlderThan: (cutoffIso) => master.prepare(
    `UPDATE audit_log SET actor_email = '[anonim]', ip = NULL WHERE created_at < ? AND actor_email IS NOT NULL AND actor_email NOT IN ('[anonim]', 'sistem')`).run(cutoffIso).changes,
};
