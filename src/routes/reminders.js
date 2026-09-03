import { Router } from 'express';
import { requireRole } from '../auth.js';
import { pets, reminders, getSettings } from '../db/tenant.js';
import { sendReminderSms } from '../scheduler.js';
import { limiters } from '../ratelimit.js';
import { trim, toInt, nowIso, isValidDate, todayLocal, addDays, returnTo, withFlash, REMINDER_TYPES } from '../util.js';

export const remindersRouter = Router();

function notFound(res) {
  return res.status(404).render('error', { title: 'Bulunamadı', message: 'Kayıt bulunamadı.' });
}

function reminderFromBody(b) {
  const type = Object.hasOwn(REMINDER_TYPES, b.type) ? b.type : 'diger';
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
  reminders.create(req.db, { ...f, pet_id: pet.id, created_at: nowIso(), created_by: req.user.email });
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
  const back = returnTo(req, `/sahipler/${r.owner_id}`);
  const status = ['done', 'cancelled', 'pending'].includes(req.body.status) ? req.body.status : null;
  if (!status) return res.redirect(withFlash(back, 'err', 'Geçersiz durum.'));
  if (status === 'pending') reminders.resetForRetry(req.db, r.id);
  else reminders.setStatus(req.db, r.id, status);
  res.redirect(withFlash(back, 'ok', 'Durum güncellendi.'));
});

remindersRouter.post('/hatirlatmalar/:id/sil', requireRole('admin'), (req, res) => {
  const r = reminders.get(req.db, toInt(req.params.id));
  if (!r) return notFound(res);
  reminders.delete(req.db, r.id);
  res.redirect(`/sahipler/${r.owner_id}?ok=` + encodeURIComponent('Hatırlatma silindi.'));
});

/** Elle "şimdi gönder" */
remindersRouter.post('/hatirlatmalar/:id/gonder', limiters.manualSms.middleware((req) => 'c:' + req.user.clinicId, 'Saatte en fazla 30 elle gönderim yapılabilir.'), async (req, res) => {
  let r = reminders.get(req.db, toInt(req.params.id));
  if (!r) return notFound(res);
  const back = returnTo(req, `/sahipler/${r.owner_id}`);
  if (!r.sms_opt_in) return res.redirect(withFlash(back, 'err', 'Bu hasta sahibi SMS almak istemiyor.'));
  if (r.status === 'sent' || r.status === 'done' || r.status === 'cancelled') {
    return res.redirect(withFlash(back, 'err', 'Bu hatırlatma için SMS zaten gönderilmiş ya da kapatılmış.'));
  }
  if (r.status === 'failed' || r.attempts > 0) {
    reminders.resetForRetry(req.db, r.id);
    r = reminders.get(req.db, r.id);
  }
  const settings = getSettings(req.db);
  const result = await sendReminderSms(req.user.clinicId, req.db, settings, r, req.user.email);
  if (result.ok) return res.redirect(withFlash(back, 'ok', 'SMS gönderildi: ' + r.owner_name));
  res.redirect(withFlash(back, 'err', 'Gönderilemedi: ' + result.error));
});
