/**
 * Basit, yalnızca-ekleme migrasyon çalıştırıcı. PRAGMA user_version = uygulanan migrasyon sayısı.
 * Uygulanmış bir migrasyon asla düzenlenmez; değişiklik için listeye yeni eleman eklenir.
 */
export function migrate(db, migrations) {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  for (let i = current; i < migrations.length; i++) {
    db.exec('BEGIN');
    try {
      db.exec(migrations[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Migrasyon ${i + 1} uygulanamadı: ${e.message}`);
    }
  }
  return migrations.length;
}

/** fn'i tek bir transaction içinde çalıştırır */
export function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
