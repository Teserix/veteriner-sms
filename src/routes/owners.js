import { Router } from 'express';
import { requireRole } from '../auth.js';
import { owners, pets, reminders, smsLog } from '../db/tenant.js';
import { audit } from '../audit.js';
import { normalizePhone, formatPhone, trim, toInt, nowIso, isValidDate, isValidEmail, escapeLike, SPECIES } from '../util.js';

export const ownersRouter = Router();

function notFound(res) {
  return res.status(404).render('error', { title: 'Bulunamadı', message: 'Kayıt bulunamadı.' });
}

function ownerFromBody(b) {
  return {
    name: trim(b.name, 120),
    phoneRaw: trim(b.phone, 30),
    email: trim(b.email, 120) || null,
    notes: trim(b.notes, 1000) || null,
    sms_opt_in: b.sms_opt_in === '1' ? 1 : 0,
  };
}

function ownerProblem(f, phone) {
  if (!f.name) return 'Ad zorunlu.';
  if (!phone) return 'Geçerli bir cep telefonu girin (05xx xxx xx xx).';
  if (f.email && !isValidEmail(f.email)) return 'E-posta adresi geçersiz.';
  return null;
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
  const header = ['Sahip', 'Telefon', 'E-posta', 'SMS', 'Hayvan', 'Tür', 'Irk', 'Cinsiyet', 'Doğum'];
  const lines = [header.join(';')];
  for (const r of rows) {
    lines.push([r.owner_name, formatPhone(r.owner_phone), r.owner_email, r.sms_opt_in ? 'Evet' : 'Hayır', r.name, r.species, r.breed, r.sex, r.birth_date].map(csvCell).join(';'));
  }
  audit(req, 'export.csv', { meta: { rows: rows.length } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="hasta-listesi.csv"');
  res.send('﻿' + lines.join('\r\n'));
});

/* ---------- Sahipler ---------- */
ownersRouter.get('/sahipler', (req, res) => {
  const q = trim(req.query.q, 60);
  res.render('owners', { title: 'Hasta Sahipleri', list: owners.list(req.db, q, escapeLike), q });
});

ownersRouter.get('/sahipler/yeni', (req, res) => {
  res.render('owner_form', { title: 'Yeni hasta sahibi', owner: null, form: {}, error: null });
});

ownersRouter.post('/sahipler/yeni', (req, res) => {
  const f = ownerFromBody(req.body);
  const phone = normalizePhone(f.phoneRaw);
  const form = { ...f, phone: f.phoneRaw };
  const problem = ownerProblem(f, phone);
  if (problem) return res.status(400).render('owner_form', { title: 'Yeni hasta sahibi', owner: null, form, error: problem });
  const existing = owners.byPhone(req.db, phone);
  if (existing) return res.status(400).render('owner_form', { title: 'Yeni hasta sahibi', owner: null, form, error: `Bu telefon zaten kayıtlı: ${existing.name}.` });
  const id = owners.create(req.db, { ...f, phone, created_at: nowIso() });
  res.redirect(`/sahipler/${id}?ok=` + encodeURIComponent('Hasta sahibi eklendi. Şimdi hayvan ekleyebilirsiniz.'));
});

ownersRouter.get('/sahipler/:id', (req, res) => {
  const id = toInt(req.params.id);
  const owner = owners.get(req.db, id);
  if (!owner) return notFound(res);
  res.render('owner_detail', {
    title: owner.name,
    owner,
    petList: pets.byOwner(req.db, id),
    reminderList: reminders.byOwner(req.db, id),
    smsList: smsLog.byOwner(req.db, id),
  });
});

ownersRouter.get('/sahipler/:id/duzenle', (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  res.render('owner_form', { title: 'Düzenle', owner, form: { ...owner, phone: formatPhone(owner.phone) }, error: null });
});

ownersRouter.post('/sahipler/:id/duzenle', (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  const f = ownerFromBody(req.body);
  const phone = normalizePhone(f.phoneRaw);
  const form = { ...f, phone: f.phoneRaw };
  const problem = ownerProblem(f, phone);
  if (problem) return res.status(400).render('owner_form', { title: 'Düzenle', owner, form, error: problem });
  const other = owners.byPhone(req.db, phone);
  if (other && other.id !== owner.id) return res.status(400).render('owner_form', { title: 'Düzenle', owner, form, error: `Bu telefon başka bir kayıtta: ${other.name}.` });
  owners.update(req.db, owner.id, { ...f, phone });
  res.redirect(`/sahipler/${owner.id}?ok=` + encodeURIComponent('Kaydedildi.'));
});

ownersRouter.post('/sahipler/:id/sil', requireRole('admin'), (req, res) => {
  const owner = owners.get(req.db, toInt(req.params.id));
  if (!owner) return notFound(res);
  owners.delete(req.db, owner.id);
  audit(req, 'owner.delete', { entityType: 'owner', entityId: owner.id });
  res.redirect('/sahipler?ok=' + encodeURIComponent('Hasta sahibi silindi.'));
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
  };
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
  if (!f.name) return res.status(400).render('pet_form', { title: 'Yeni hayvan', owner, pet: null, form: req.body, error: 'Ad zorunlu.' });
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
  if (!f.name) return res.status(400).render('pet_form', { title: 'Hayvanı düzenle', owner, pet, form: req.body, error: 'Ad zorunlu.' });
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
