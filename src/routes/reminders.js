import { Router } from 'express';
import { requireClinic } from '../auth.js';
import { tenantMiddleware } from './clinic.js';
import { pets, reminders, getSettings } from '../db/tenant.js';
import { sendReminderSms } from '../scheduler.js';
import { trim, toInt, nowIso, isValidDate, todayLocal, addDays, REMINDER_TYPES } from '../util.js';

export const remindersRouter = Router();
remindersRouter.use(requireClinic, tenantMiddleware);

function notFound(res) {
  return res.status(404).render('error', { title: 'Bulunamadı', message: 'Kayıt bulunamadı.' });
}

function reminderFromBody(b) {
  const type = REMINDER_TYPES[b.type] ? b.type : 'diger';
  const repeat = toInt(b.repeat_days, 0);
  return {
    type,
    title: trim(b.title, 80) || REMINDER_TYPES[type],
    due_date: trim(b.due_date, 10),
    notify_days_before: Math.min(60, Math.max(0, toInt(b.notify_days_before, 1))),
    repeat_days: repeat > 0 ? Math.min(3650, repeat) : null,
    notes: trim(b.notes, 500) || null,
  };
}

remindersRouter.get('/hatirlatmalar', (req, res) => {
  const status = ['pending', 'sent', 'done', 'cancelled', 'failed'].includes(req.query.status) ? req.query.status : '';
  const range = ['today', 'week', 'month'].includes(req.query.range) ? req.query.range : '';
  const today = todayLocal();
  let from = '';
  let to = '';
  if (range === 'today') { from = today; to = today; }
  if (range === 'week') { from = today; to = addDays(today, 7); }
  if (range === 'month') { from = today; to = addDays(today, 30); }
  res.render('reminders', {
    title: 'Hatırlatmalar',
    list: reminders.list(req.db, { status, from, to }),
    filter: { status, range },
  });
});

remindersRouter.get('/hayvanlar/:id/hatirlatma/yeni', (req, res) => {
  const pet = pets.get(req.db, toInt(req.params.id));
  if (!pet) return notFound(res);
  res.render('reminder_form', { title: 'Yeni hatırlatma', pet, reminder: null, form: { due_date: addDays(todayLocal(), 7) }, error: null });
});

remindersRouter.post('/hayvanlar/:id/hatirlatma/yeni', (req, res) => {
  const pet = pets.get(req.db, toInt(req.params.id));
  if (!pet) return notFound(res);
  const f = reminderFromBody(req.body);
  if (!isValidDate(f.due_date)) {
    return res.status(400).render('reminder_form', { title: 'Yeni hatırlatma', pet, reminder: null, form: req.body, error: 'Geçerli bir tarih girin.' });
  }
  reminders.create(req.db, { ...f, pet_id: pet.id, created_at: nowIso() });
  res.redirect(`/sahipler/${pet.owner_id}?ok=` + encodeURIComponent('Hatırlatma eklendi.'));
});

remindersRouter.get('/hatirlatmalar/:id/duzenle', (req, res) => {
  const r = reminders.get(req.db, toInt(req.params.id));
  if (!r) return notFound(res);
  const pet = pets.get(req.db, r.pet_id);
  res.render('reminder_form', { title: 'Hatırlatmayı düzenle', pet, reminder: r, form: r, error: null });
});

remindersRouter.post('/hatirlatmalar/:id/duzenle', (req, res) => {
  const r = reminders.get(req.db, toInt(req.params.id));
  if (!r) return notFound(res);
  const pet = pets.get(req.db, r.pet_id);
  const f = reminderFromBody(req.body);
  if (!isValidDate(f.due_date)) {
    return res.status(400).render('reminder_form', { title: 'Hatırlatmayı düzenle', pet, reminder: r, form: req.body, error: 'Geçerli bir tarih girin.' });
  }
  reminders.update(req.db, r.id, f);
  res.redirect(`/sahipler/${r.owner_id}?ok=` + encodeURIComponent('Hatırlatma güncellendi.'));
});

remindersRouter.post('/hatirlatmalar/:id/durum', (req, res) => {
  const r = reminders.get(req.db, toInt(req.params.id));
  if (!r) return notFound(res);
  const status = ['done', 'cancelled', 'pending'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.redirect('back');
  reminders.setStatus(req.db, r.id, status);
  res.redirect(req.get('Referer') || `/sahipler/${r.owner_id}`);
});

remindersRouter.post('/hatirlatmalar/:id/sil', (req, res) => {
  const r = reminders.get(req.db, toInt(req.params.id));
  if (!r) return notFound(res);
  reminders.delete(req.db, r.id);
  res.redirect(`/sahipler/${r.owner_id}?ok=` + encodeURIComponent('Hatırlatma silindi.'));
});

/** Elle "şimdi gönder" */
remindersRouter.post('/hatirlatmalar/:id/gonder', async (req, res) => {
  const r = reminders.get(req.db, toInt(req.params.id));
  if (!r) return notFound(res);
  const back = req.get('Referer') || `/sahipler/${r.owner_id}`;
  const sep = back.includes('?') ? '&' : '?';
  if (!r.sms_opt_in) return res.redirect(back + sep + 'err=' + encodeURIComponent('Bu hasta sahibi SMS almak istemiyor.'));
  if (r.status === 'failed') reminders.setStatus(req.db, r.id, 'pending');
  const settings = getSettings(req.db);
  const result = await sendReminderSms(req.db, settings, r, req.user.email);
  if (result.ok) return res.redirect(back + sep + 'ok=' + encodeURIComponent('SMS gönderildi: ' + r.owner_name));
  res.redirect(back + sep + 'err=' + encodeURIComponent('Gönderilemedi: ' + result.error));
});
