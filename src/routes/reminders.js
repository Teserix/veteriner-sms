import { Router } from 'express';
import { requireRole } from '../auth.js';
import { pets, reminders, getSettings, legalProblems } from '../db/tenant.js';
import { sendReminderSms, buildReminderVars, ensureOptOutToken } from '../scheduler.js';
import { contentProblems, previewParts, bodyProblems, smsSegments } from '../sms/policy.js';
import { limiters } from '../ratelimit.js';
import { MAX_MESSAGE_LENGTH } from '../sms/index.js';
import { audit } from '../audit.js';
import { trim, toInt, nowIso, isValidDate, todayLocal, addDays, returnTo, withFlash, isDemoPhone, REMINDER_TYPES } from '../util.js';

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

/** Başlık SMS'e {tur} olarak girer: tarih geçerli olmalı, başlık reklam/ilaç adı/teşhis içermemeli (bkz. sms/policy.js) */
function reminderProblem(f) {
  if (!isValidDate(f.due_date)) return 'Geçerli bir tarih girin.';
  const p = contentProblems(f.title);
  return p.length ? 'Başlık SMS metnine girer: ' + p[0] : null;
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
  const problem = reminderProblem(f);
  if (problem) {
    return res.status(400).render('reminder_form', { title: 'Yeni hatırlatma', pet, reminder: null, form: req.body, error: problem });
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
  const problem = reminderProblem(f);
  if (problem) {
    return res.status(400).render('reminder_form', { title: 'Hatırlatmayı düzenle', pet, reminder: r, form: req.body, error: problem });
  }
  reminders.update(req.db, r.id, f);
  let msg = 'Hatırlatma güncellendi.';
  if (f.due_date !== r.due_date && (r.status === 'sent' || r.status === 'failed')) {
    reminders.reopen(req.db, r.id);
    msg = 'Hatırlatma güncellendi; tarih değiştiği için yeniden beklemeye alındı (SMS yeni tarihe göre gidecek).';
  }
  res.redirect(`/sahipler/${r.owner_id}?ok=` + encodeURIComponent(msg));
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

const CLOSED_STATUSES = ['sent', 'done', 'cancelled'];

/** composeMessage'in gövdeye uyguladığı boşluk normalleştirmesi (orijinal/düzenlenmiş karşılaştırması ve uzunluk için) */
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Gönderimi engelleyecek durumlar (önizlemede uyarı bandı + devre dışı düğme; sunucu korumaları yine ayrıca geçerlidir) */
function sendBlockers(settings, r) {
  const out = [];
  if (!r.sms_opt_in) out.push('Bu hasta sahibi SMS almak istemiyor (ret kaydı var).');
  if (isDemoPhone(r.owner_phone)) out.push('Bu bir demo numarası; SMS hiçbir sağlayıcıya gönderilmez.');
  const legal = legalProblems(settings);
  if (legal.length) out.push('Gönderim kilitli: Ayarlar > Hukuki kimlik eksik (' + legal[0] + ').');
  if (CLOSED_STATUSES.includes(r.status)) out.push('Bu hatırlatma için SMS zaten gönderilmiş ya da kapatılmış.');
  return out;
}

/** Önizleme ekranının modeli: mesaj policy.previewParts'tan gelir (gönderimle aynı fonksiyon); rotada yeniden kurulmaz */
function renderPreview(req, res, r, settings, { body, problems = [], status = 200 } = {}) {
  const parts = previewParts(settings, buildReminderVars(settings, r), {
    clinicId: req.user.clinicId, optOutToken: r.opt_out_token || '', bodyOverride: body,
  });
  const blockers = sendBlockers(settings, r);
  res.status(status).render('reminder_preview', {
    title: 'SMS önizleme', reminder: r, parts, problems, blockers, canSend: blockers.length === 0,
    bodyValue: body ?? parts.originalBody, maxTotal: MAX_MESSAGE_LENGTH,
  });
}

/**
 * Gönderim öncesi tam önizleme. Ret belirteci yoksa burada üretilir (ensureOptOutToken): GET'te yan etkidir ama
 * kabul edildi; böylece önizlenen iptal bağlantısı gönderilecek olanla birebir aynıdır (yer tutucu URL gösterilmez).
 */
remindersRouter.get('/hatirlatmalar/:id/onizle', (req, res) => {
  const r = reminders.get(req.db, toInt(req.params.id));
  if (!r) return notFound(res);
  r.opt_out_token = ensureOptOutToken(req.db, r.owner_id, r.opt_out_token);
  renderPreview(req, res, r, getSettings(req.db));
});

/** Elle "şimdi gönder"; isteğe bağlı 'body' alanı önizlemede düzenlenmiş gövdedir (önek/kimlik/iptal sunucuda eklenir) */
remindersRouter.post('/hatirlatmalar/:id/gonder', limiters.manualSms.middleware((req) => 'c:' + req.user.clinicId, 'Saatte en fazla 30 elle gönderim yapılabilir.'), async (req, res) => {
  let r = reminders.get(req.db, toInt(req.params.id));
  if (!r) return notFound(res);
  let back = returnTo(req, `/sahipler/${r.owner_id}`);
  if (back.startsWith(`/hatirlatmalar/${r.id}/onizle`)) back = `/sahipler/${r.owner_id}`;
  if (!r.sms_opt_in) return res.redirect(withFlash(back, 'err', 'Bu hasta sahibi SMS almak istemiyor.'));
  if (CLOSED_STATUSES.includes(r.status)) {
    return res.redirect(withFlash(back, 'err', 'Bu hatırlatma için SMS zaten gönderilmiş ya da kapatılmış.'));
  }
  const settings = getSettings(req.db);
  const clinicId = req.user.clinicId;

  let bodyOverride;
  if (typeof req.body.body === 'string') {
    r.opt_out_token = ensureOptOutToken(req.db, r.owner_id, r.opt_out_token);
    const problems = bodyProblems(req.body.body, settings, { clinicId, optOutToken: r.opt_out_token });
    if (problems.length) return renderPreview(req, res, r, settings, { body: req.body.body, problems, status: 400 });
    const original = previewParts(settings, buildReminderVars(settings, r), { clinicId, optOutToken: r.opt_out_token }).originalBody;
    if (oneLine(req.body.body) !== oneLine(original)) bodyOverride = req.body.body;
  }

  if (r.status === 'failed' || r.attempts > 0) {
    reminders.resetForRetry(req.db, r.id);
    r = reminders.get(req.db, r.id);
  }
  const result = await sendReminderSms(clinicId, req.db, settings, r, req.user.email, new Date(), { bodyOverride });
  if (result.skipped !== 'state') {
    // Denetim: yalnız uzunluk/parça/bayrak; telefon, sahip adı ve gövde metni yazılmaz
    const after = previewParts(settings, buildReminderVars(settings, r), { clinicId, optOutToken: r.opt_out_token || '', bodyOverride });
    const seg = result.message ? smsSegments(result.message) : after.segments;
    audit(req, 'reminder.sms_send', {
      clinicId, entityType: 'reminder', entityId: r.id,
      meta: {
        edited: after.edited, original_length: oneLine(after.originalBody).length, new_length: after.body.length,
        segments: seg.segments, encoding: seg.encoding, ok: !!result.ok,
      },
    });
  }
  if (result.ok) return res.redirect(withFlash(back, 'ok', 'SMS gönderildi: ' + r.owner_name));
  res.redirect(withFlash(back, 'err', 'Gönderilemedi: ' + result.error));
});
