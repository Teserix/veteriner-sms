import { owners, pets } from '../db/tenant.js';
import { withTransaction } from '../db/migrate.js';
import { normalizePhone, formatPhone, isValidEmail, nowIso, trim } from '../util.js';
import { normalizeSpecies, normalizeSex, normalizeDate } from './mapping.js';

export const ACTION_LABELS = Object.freeze({
  new_owner: 'Yeni sahip',
  add_pet: 'Mevcut sahibe hayvan',
  skip_duplicate: 'Zaten kayıtlı',
  error: 'Hata',
});

const petKey = (name) => String(name || '').toLocaleLowerCase('tr-TR').trim();

/**
 * classifyRows(db, rows, mapping) -> satır başına karar.
 * Aynı telefon (veritabanında ya da dosyada daha önce) -> hayvan adı yeni ise add_pet, değilse skip_duplicate.
 */
export function classifyRows(db, rows, mapping) {
  const cell = (row, field) => {
    const idx = mapping[field];
    return idx == null || idx < 0 ? '' : String(row[idx] ?? '').trim();
  };
  const seen = new Map(); // phone -> { ownerName, petKeys:Set, existingId|null }
  const out = [];

  rows.forEach((row, i) => {
    const r = {
      rowNo: i + 2, // 1 = başlık satırı
      owner_name: trim(cell(row, 'owner_name'), 120),
      phoneRaw: cell(row, 'phone'),
      phone: null,
      phoneFormatted: '',
      email: trim(cell(row, 'email'), 120) || null,
      owner_notes: trim(cell(row, 'owner_notes'), 1000) || null,
      pet_name: trim(cell(row, 'pet_name'), 80),
      species: normalizeSpecies(cell(row, 'species')),
      breed: trim(cell(row, 'breed'), 80) || null,
      sex: normalizeSex(cell(row, 'sex')),
      birth_date: null,
      pet_notes: trim(cell(row, 'pet_notes'), 1000) || null,
      action: 'error',
      reason: '',
    };
    const problems = [];
    const notes = [];
    r.phone = normalizePhone(r.phoneRaw);
    if (!r.owner_name) problems.push('Sahip adı boş');
    if (!r.phone) problems.push(r.phoneRaw ? 'Geçersiz cep telefonu' : 'Telefon boş');
    if (!r.pet_name) problems.push('Hayvan adı boş');
    if (r.email && !isValidEmail(r.email)) problems.push('E-posta geçersiz');
    const birthRaw = cell(row, 'birth_date');
    if (birthRaw) {
      r.birth_date = normalizeDate(birthRaw);
      if (!r.birth_date) notes.push('Doğum tarihi anlaşılamadı, boş bırakıldı');
    }
    if (r.phone) r.phoneFormatted = formatPhone(r.phone);

    if (problems.length) {
      r.action = 'error';
      r.reason = problems.join('; ');
      out.push(r);
      return;
    }

    let entry = seen.get(r.phone);
    if (!entry) {
      const existing = owners.byPhone(db, r.phone);
      entry = {
        ownerName: existing ? existing.name : r.owner_name,
        existingId: existing ? existing.id : null,
        petKeys: new Set(existing ? pets.byOwner(db, existing.id).map((p) => petKey(p.name)) : []),
        fromDb: Boolean(existing),
        firstRow: r.rowNo,
      };
      seen.set(r.phone, entry);
      if (!existing) {
        r.action = 'new_owner';
        entry.petKeys.add(petKey(r.pet_name));
        r.reason = notes.join('; ');
        out.push(r);
        return;
      }
    }
    const key = petKey(r.pet_name);
    if (entry.petKeys.has(key)) {
      r.action = 'skip_duplicate';
      notes.unshift(entry.fromDb ? `Bu hayvan zaten kayıtlı (sahip: ${entry.ownerName})` : `Dosyada satır ${entry.firstRow} ile aynı`);
    } else {
      entry.petKeys.add(key);
      r.action = 'add_pet';
      notes.unshift(entry.fromDb ? `Mevcut sahibe eklenecek: ${entry.ownerName}` : `Aynı telefon satır ${entry.firstRow} ile birleştirilecek`);
    }
    r.reason = notes.join('; ');
    out.push(r);
  });
  return out;
}

export function summarize(classified) {
  const c = { new_owner: 0, add_pet: 0, skip_duplicate: 0, error: 0 };
  for (const r of classified) c[r.action] = (c[r.action] || 0) + 1;
  return c;
}

/**
 * applyImport(db, classified, { batchToken, createdBy }) -> { owners, pets, skipped, errors }
 * Tek transaction. Önizleme ile onay arasında veri değişmiş olabilir; telefon/hayvan tekrar kontrol edilir.
 * createdBy yalnızca çağıranın denetim kaydı içindir (sahip/hayvan tablolarında sütunu yoktur).
 */
export function applyImport(db, classified, { batchToken = null } = {}) {
  const at = nowIso();
  return withTransaction(db, () => {
    const counts = { owners: 0, pets: 0, skipped: 0, errors: 0 };
    const cache = new Map(); // phone -> { id, petKeys }
    for (const r of classified) {
      if (r.action === 'error') { counts.errors++; continue; }
      if (r.action === 'skip_duplicate') { counts.skipped++; continue; }
      let o = cache.get(r.phone);
      if (!o) {
        const existing = owners.byPhone(db, r.phone);
        if (existing) {
          o = { id: existing.id, petKeys: new Set(pets.byOwner(db, existing.id).map((p) => petKey(p.name))) };
        } else {
          const id = owners.create(db, { name: r.owner_name, phone: r.phone, email: r.email, notes: r.owner_notes, sms_opt_in: 1, created_at: at, import_batch: batchToken });
          o = { id, petKeys: new Set() };
          counts.owners++;
        }
        cache.set(r.phone, o);
      }
      const key = petKey(r.pet_name);
      if (o.petKeys.has(key)) { counts.skipped++; continue; }
      pets.create(db, { owner_id: o.id, name: r.pet_name, species: r.species, breed: r.breed, sex: r.sex, birth_date: r.birth_date, notes: r.pet_notes, created_at: at, import_batch: batchToken });
      o.petKeys.add(key);
      counts.pets++;
    }
    return counts;
  });
}
