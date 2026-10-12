import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setupEnv } from './helpers.js';

const dataDir = setupEnv();
const { migrate } = await import('../src/db/migrate.js');
const { TENANT_MIGRATIONS } = await import('../src/db/tenant.js');
const { MASTER_MIGRATIONS } = await import('../src/db/master.js');

const userVersion = (db) => db.prepare('PRAGMA user_version').get().user_version;
const columns = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
const tables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);

function freshDb(name) {
  const file = path.join(dataDir, name);
  fs.rmSync(file, { force: true });
  const db = new DatabaseSync(file, { timeout: 5000 });
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

describe('tenant migrasyonları', () => {
  test("migrasyon 5: sms_log 'simulated' kabul eder; mevcut satırlar, dizinler korunur; reminders.simulated_at", () => {
    const db = freshDb('t5.db');
    migrate(db, TENANT_MIGRATIONS.slice(0, 4)); // eski şema (v4)
    assert.equal(userVersion(db), 4);
    const ins = db.prepare(`INSERT INTO sms_log (owner_id, phone, message, provider, status, provider_ref, created_at, owner_name, kind, legal_basis, iys_flag, identity_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    ins.run(7, '905321234567', 'm1', 'netgsm', 'sent', 'r1', '2026-09-01T10:00:00Z', 'A', 'reminder', 'm6_1', '0', 'MERSIS:1');
    ins.run(8, '905321234568', 'm2', 'netgsm', 'failed', null, '2026-09-02T10:00:00Z', 'B', 'test', 'test', '0', null);
    assert.throws(() => ins.run(9, '9053', 'x', 'console', 'simulated', null, '2026-09-03T00:00:00Z', null, 'reminder', null, null, null), /CHECK/);
    const before = db.prepare('SELECT * FROM sms_log ORDER BY id').all();
    migrate(db, TENANT_MIGRATIONS);
    assert.equal(userVersion(db), TENANT_MIGRATIONS.length);
    assert.deepEqual(db.prepare('SELECT * FROM sms_log ORDER BY id').all(), before);
    ins.run(9, '905321234569', 'm3', 'console', 'simulated', null, '2026-09-03T10:00:00Z', 'C', 'reminder', 'm6_1', '0', null);
    assert.throws(() => ins.run(9, '905321234569', 'm4', 'console', 'gonderildi', null, '2026-09-03T10:00:00Z', 'C', 'reminder', null, null, null), /CHECK/);
    // AUTOINCREMENT sırası korunur (yeni satır eski en büyük id'den sonra)
    assert.equal(db.prepare("SELECT id FROM sms_log WHERE message = 'm3'").get().id, 3);
    const idx = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'sms_log'").all().map((r) => r.name);
    for (const n of ['idx_sms_created', 'idx_sms_kind_created', 'idx_sms_owner']) assert.ok(idx.includes(n), n);
    assert.ok(!tables(db).includes('sms_log_v5'));
    assert.ok(columns(db, 'reminders').includes('simulated_at'));
    // idempotent: tekrar çalıştırma şemayı ve veriyi değiştirmez
    const schema = db.prepare('SELECT sql FROM sqlite_master ORDER BY name').all();
    migrate(db, TENANT_MIGRATIONS);
    assert.deepEqual(db.prepare('SELECT sql FROM sqlite_master ORDER BY name').all(), schema);
    assert.equal(db.prepare('SELECT COUNT(*) AS c FROM sms_log').get().c, 3);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    db.close();
  });

  test('sıfırdan uygular: user_version ve sütunlar', () => {
    const db = freshDb('t1.db');
    assert.equal(userVersion(db), 0);
    const n = migrate(db, TENANT_MIGRATIONS);
    assert.equal(n, TENANT_MIGRATIONS.length);
    assert.equal(userVersion(db), TENANT_MIGRATIONS.length);
    assert.ok(columns(db, 'owners').includes('import_batch'));
    assert.ok(columns(db, 'pets').includes('import_batch'));
    assert.ok(columns(db, 'sms_log').includes('kind'));
    assert.ok(columns(db, 'sms_log').includes('owner_name'));
    assert.ok(columns(db, 'reminders').includes('created_by'));
    // migrasyon 3: mevzuat uyumu
    for (const col of ['address', 'opt_out_token']) assert.ok(columns(db, 'owners').includes(col), col);
    assert.ok(columns(db, 'pets').includes('microchip_no'));
    for (const col of ['legal_basis', 'iys_flag', 'identity_used', 'anonymized_at']) assert.ok(columns(db, 'sms_log').includes(col), col);
    for (const t of ['settings', 'owners', 'pets', 'reminders', 'sms_log', 'consent_events', 'subject_requests', 'imha_log']) assert.ok(tables(db).includes(t), t);
    db.close();
  });

  test('ikinci çalıştırma no-op', () => {
    const db = freshDb('t2.db');
    migrate(db, TENANT_MIGRATIONS);
    const before = db.prepare("SELECT sql FROM sqlite_master ORDER BY name").all();
    assert.equal(migrate(db, TENANT_MIGRATIONS), TENANT_MIGRATIONS.length);
    assert.equal(userVersion(db), TENANT_MIGRATIONS.length);
    assert.deepEqual(db.prepare("SELECT sql FROM sqlite_master ORDER BY name").all(), before);
    db.close();
  });

  test('bozuk migrasyon geri alınır; user_version değişmez', () => {
    const db = freshDb('t3.db');
    migrate(db, TENANT_MIGRATIONS);
    const bad = [...TENANT_MIGRATIONS, 'CREATE TABLE tmp_ok (id INTEGER); THIS IS NOT SQL;'];
    assert.throws(() => migrate(db, bad), new RegExp(`Migrasyon ${bad.length} uygulanamadı`));
    assert.equal(userVersion(db), TENANT_MIGRATIONS.length);
    assert.ok(!tables(db).includes('tmp_ok'), 'aynı adımdaki başarılı ifade de geri alınmalı');
    // veritabanı kullanılabilir durumda (transaction açık kalmamış)
    db.exec('BEGIN'); db.exec('COMMIT');
    // düzeltilmiş liste sonra sorunsuz uygulanır
    const fixed = [...TENANT_MIGRATIONS, 'CREATE TABLE tmp_ok (id INTEGER);'];
    assert.equal(migrate(db, fixed), fixed.length);
    assert.equal(userVersion(db), fixed.length);
    assert.ok(tables(db).includes('tmp_ok'));
    db.close();
  });
});

describe('master migrasyonları (geçici dosya)', () => {
  test('sıfırdan uygular', () => {
    const db = freshDb('m1.db');
    migrate(db, MASTER_MIGRATIONS);
    assert.equal(userVersion(db), MASTER_MIGRATIONS.length);
    assert.ok(columns(db, 'users').includes('must_change_password'));
    assert.ok(columns(db, 'clinics').includes('sms_daily_cap'));
    assert.ok(columns(db, 'sessions').includes('last_seen_at'));
    assert.ok(columns(db, 'clinics').includes('public_slug'));
    for (const t of ['clinics', 'users', 'sessions', 'audit_log', 'legal_acceptances', 'breaches']) assert.ok(tables(db).includes(t), t);
    assert.equal(migrate(db, MASTER_MIGRATIONS), MASTER_MIGRATIONS.length);
    assert.equal(userVersion(db), MASTER_MIGRATIONS.length);
    db.close();
  });

  test('bozuk migrasyon geri alınır', () => {
    const db = freshDb('m2.db');
    migrate(db, MASTER_MIGRATIONS);
    const bad = [...MASTER_MIGRATIONS, 'ALTER TABLE users ADD COLUMN x TEXT; ALTER TABLE nope ADD COLUMN y TEXT;'];
    assert.throws(() => migrate(db, bad), /Migrasyon \d+ uygulanamadı/);
    assert.equal(userVersion(db), MASTER_MIGRATIONS.length);
    assert.ok(!columns(db, 'users').includes('x'));
    db.close();
  });

  test('gerçek master.db geçici DATA_DIR içinde ve güncel sürümde', () => {
    const file = path.join(dataDir, 'master.db');
    assert.ok(fs.existsSync(file));
    const ro = new DatabaseSync(file, { readOnly: true });
    assert.equal(userVersion(ro), MASTER_MIGRATIONS.length);
    ro.close();
  });
});
