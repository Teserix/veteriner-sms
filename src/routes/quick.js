import { Router } from 'express';
import { owners, pets, reminders } from '../db/tenant.js';
import { withTransaction } from '../db/migrate.js';
import { normalizePhone, trim, toInt, nowIso, isValidDate, isValidEmail, addDays, todayLocal, REMINDER_TYPES, SPECIES } from '../util.js';

/** Hızlı kayıt: sahip + hayvan + ilk hatırlatma tek formda */
export const quickRouter = Router();

function defaults() {
  return { type: 'asi', notify_days_before: 1, due_date: addDays(todayLocal(), 7), species: 'Kedi', sms_opt_in: '1', add_reminder: '1' };
}

quickRouter.get('/hizli-kayit', (req, res) => {
  res.render('quick_form', { title: 'Hızlı kayıt', form: defaults(), error: null });
});

quickRouter.post('/hizli-kayit', (req, res) => {
  const b = req.body;
  // Onay kutuları: işaretsiz kutu hiç gönderilmez; yeniden çizimde kullanıcının seçimi korunsun
  const form = { ...defaults(), ...b, sms_opt_in: b.sms_opt_in === '1' ? '1' : '0', add_reminder: b.add_reminder === '1' ? '1' : '0' };
  const err = (m) => res.status(400).render('quick_form', { title: 'Hızlı kayıt', form, error: m });

  const ownerName = trim(b.owner_name, 120);
  const phone = normalizePhone(b.phone);
  const email = trim(b.email, 120);
  const petName = trim(b.pet_name, 80);
  const species = SPECIES.includes(b.species) ? b.species : 'Diğer';
  const sex = ['Dişi', 'Erkek'].includes(b.sex) ? b.sex : null;
  const addReminder = b.add_reminder === '1';
  const type = Object.hasOwn(REMINDER_TYPES, b.type) ? b.type : 'asi';
  const title = trim(b.title, 80) || REMINDER_TYPES[type];
  const dueDate = trim(b.due_date, 10);
  const notify = Math.min(60, Math.max(0, toInt(b.notify_days_before, 1)));
  const repeat = toInt(b.repeat_days, 0);

  if (!ownerName) return err('Hasta sahibinin adı zorunlu.');
  if (!phone) return err('Geçerli bir cep telefonu girin (05xx xxx xx xx).');
  if (email && !isValidEmail(email)) return err('E-posta adresi geçersiz.');
  if (!petName) return err('Hayvanın adı zorunlu.');
  if (addReminder && !isValidDate(dueDate)) return err('Hatırlatma için geçerli bir tarih girin.');

  const at = nowIso();
  const result = withTransaction(req.db, () => {
    let owner = owners.byPhone(req.db, phone);
    let ownerCreated = false;
    if (!owner) {
      const id = owners.create(req.db, { name: ownerName, phone, email: email || null, notes: null, sms_opt_in: b.sms_opt_in === '1' ? 1 : 0, created_at: at });
      owner = { id };
      ownerCreated = true;
    }
    const petId = pets.create(req.db, { owner_id: owner.id, name: petName, species, breed: trim(b.breed, 80) || null, sex, birth_date: isValidDate(b.birth_date) ? b.birth_date : null, notes: null, created_at: at });
    if (addReminder) {
      reminders.create(req.db, { pet_id: petId, type, title, due_date: dueDate, notify_days_before: notify, repeat_days: repeat > 0 ? Math.min(3650, repeat) : null, notes: null, created_at: at, created_by: req.user.email });
    }
    return { ownerId: owner.id, ownerCreated };
  });

  const msg = result.ownerCreated ? 'Kayıt oluşturuldu.' : 'Bu telefon zaten kayıtlıydı; hayvan mevcut hasta sahibine eklendi.';
  res.redirect(`/sahipler/${result.ownerId}?ok=` + encodeURIComponent(msg));
});
