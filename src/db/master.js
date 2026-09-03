import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

/**
 * Master veritabanı: klinikler (kiracılar), kullanıcılar ve oturumlar.
 * Kliniklere ait hasta/hatırlatma verileri burada DEĞİL, her kliniğin
 * kendi dosyasında tutulur (bkz. tenant.js).
 */
export const master = new DatabaseSync(path.join(config.dataDir, 'master.db'));

master.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

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
    id          TEXT PRIMARY KEY,          -- sha256(token)
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    ip          TEXT,
    user_agent  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_exp  ON sessions(expires_at);
`);

export const clinics = {
  all: () => master.prepare('SELECT * FROM clinics ORDER BY created_at DESC').all(),
  active: () => master.prepare('SELECT * FROM clinics WHERE active = 1').all(),
  get: (id) => master.prepare('SELECT * FROM clinics WHERE id = ?').get(id),
  create: (id, name, phone, createdAt) =>
    master.prepare('INSERT INTO clinics (id, name, phone, active, created_at) VALUES (?, ?, ?, 1, ?)').run(id, name, phone, createdAt),
  setActive: (id, active) => master.prepare('UPDATE clinics SET active = ? WHERE id = ?').run(active ? 1 : 0, id),
  update: (id, name, phone) => master.prepare('UPDATE clinics SET name = ?, phone = ? WHERE id = ?').run(name, phone, id),
  userCount: (id) => master.prepare('SELECT COUNT(*) AS c FROM users WHERE clinic_id = ?').get(id).c,
};

export const users = {
  count: () => master.prepare('SELECT COUNT(*) AS c FROM users').get().c,
  byEmail: (email) => master.prepare('SELECT * FROM users WHERE email = ?').get(email),
  byId: (id) => master.prepare('SELECT * FROM users WHERE id = ?').get(id),
  byClinic: (clinicId) => master.prepare('SELECT id, email, name, role, active, created_at, last_login_at FROM users WHERE clinic_id = ? ORDER BY created_at').all(clinicId),
  create: ({ clinicId, email, name, passwordHash, role, createdAt }) =>
    master.prepare('INSERT INTO users (clinic_id, email, name, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
      .run(clinicId, email, name, passwordHash, role, createdAt),
  setPassword: (id, hash) => master.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id),
  setActive: (id, active) => master.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id),
  setRole: (id, role) => master.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id),
  touchLogin: (id, at) => master.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(at, id),
  delete: (id) => master.prepare('DELETE FROM users WHERE id = ?').run(id),
};

export const sessions = {
  create: ({ id, userId, csrf, createdAt, expiresAt, ip, userAgent }) =>
    master.prepare('INSERT INTO sessions (id, user_id, csrf, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, userId, csrf, createdAt, expiresAt, ip, userAgent),
  get: (id) => master.prepare(`
    SELECT s.id AS session_id, s.csrf, s.expires_at,
           u.id AS user_id, u.email, u.name, u.role, u.clinic_id, u.active AS user_active,
           c.name AS clinic_name, c.active AS clinic_active
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN clinics c ON c.id = u.clinic_id
    WHERE s.id = ?`).get(id),
  delete: (id) => master.prepare('DELETE FROM sessions WHERE id = ?').run(id),
  deleteForUser: (userId) => master.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId),
  purgeExpired: (nowIso) => master.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso),
};
