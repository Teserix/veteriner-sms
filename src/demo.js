import { withTransaction } from './db/migrate.js';
import { owners, pets, reminders, smsLog, getSettings, setSetting } from './db/tenant.js';
import { todayLocal, addDays, isDemoPhone } from './util.js';

/**
 * Demo verisi: tanıtım/eğitim için 20 sahip, 24 hayvan, 33 hatırlatma ve SMS geçmişi.
 *
 * - Telefonlar atanmamış 0515/0516 aralığındandır (util.js isDemoPhone); SMS çıkış noktası (sms/index.js sendSms)
 *   bu numaraları hiçbir sağlayıcıya göndermez, 'demo' sağlayıcısıyla başarılı sayar. Gerçek kişiye SMS gitmez,
 *   kredi harcanmaz; bu yüzden kliniğin zamanlayıcı ayarına DOKUNULMAZ.
 * - Kayıtlar import_batch='demo', created_by='demo', provider='demo' ile işaretlenir.
 * - Hukuki kimlik YAZILMAZ (varsayılan): gönderim kilidi klinik kendi kimliğini girene dek kapalı kalır. Sahte VKN'li
 *   kimlik yalnızca { legalIdentity: true } ile (CLI --sahte-kimlik, yerel geliştirme) yazılır; gerçek klinikte asla.
 * - Tekrar çalıştırma güvenlidir: var olan demo sahipleri (telefona göre) atlanır; yalnızca bu turda oluşturulan
 *   sahipler için hatırlatma/SMS satırı eklenir, silinmiş hayvanlar atlanır. Çift kayıt oluşmaz.
 *
 * Kullananlar: scripts/seed-demo.js (CLI) ve POST /admin/klinik/:id/demo (süper yönetici düğmesi).
 */

// [ad, e-posta, not, opt_in, hayvanlar:[ad, tür, ırk, cinsiyet, doğum]]
export const DEMO_OWNERS = [
  ['Ayşe Yılmaz', 'ayse@example.com', null, 1, [['Boncuk', 'Kedi', 'Tekir', 'Dişi', '2021-04-12'], ['Pamuk', 'Kedi', 'Van Kedisi', 'Erkek', '2019-08-03']]],
  ['Mehmet Demir', null, 'Cumartesi öğleden sonra müsait.', 1, [['Karamel', 'Köpek', 'Golden Retriever', 'Erkek', '2020-02-20']]],
  ['Zeynep Kaya', 'zeynep.kaya@example.com', null, 1, [['Zeytin', 'Köpek', 'Labrador', 'Dişi', '2022-06-15']]],
  ['Ali Çelik', null, null, 1, [['Duman', 'Kedi', 'British Shorthair', 'Erkek', '2023-01-09']]],
  ['Fatma Şahin', null, 'Kapıcıya haber verin, zil bozuk.', 1, [['Limon', 'Kuş', 'Muhabbet Kuşu', null, '2024-03-01']]],
  ['Mustafa Öztürk', 'mustafa@example.com', null, 1, [['Fıstık', 'Köpek', 'Pomeranian', 'Dişi', '2021-11-30'], ['Maya', 'Kedi', 'Scottish Fold', 'Dişi', '2022-09-18']]],
  ['Elif Aydın', null, null, 1, [['Tarçın', 'Tavşan', 'Hollanda Lop', 'Erkek', '2023-05-05']]],
  ['Hüseyin Arslan', null, null, 1, [['Şans', 'Köpek', 'Kangal', 'Erkek', '2018-07-22']]],
  ['Emine Doğan', 'emine.dogan@example.com', null, 0, [['Badem', 'Kedi', 'Tekir', 'Dişi', '2020-10-10']]],
  ['Hasan Kılıç', null, 'Yaşlı hasta, sabah saatleri.', 1, [['Bulut', 'Köpek', 'Maltese', 'Erkek', '2015-12-01']]],
  ['Hatice Aslan', null, null, 1, [['Çakıl', 'Hamster', 'Suriye Hamsterı', null, '2025-01-14']]],
  ['İbrahim Çetin', 'ibrahim@example.com', null, 1, [['Kömür', 'Kedi', 'Bombay', 'Erkek', '2022-02-02'], ['Lokum', 'Kedi', 'Tekir', 'Dişi', '2022-02-02']]],
  ['Merve Koç', null, null, 1, [['Mia', 'Köpek', 'French Bulldog', 'Dişi', '2021-03-27']]],
  ['Ahmet Kurt', null, null, 1, [['Rocky', 'Köpek', 'Rottweiler', 'Erkek', '2019-09-09']]],
  ['Selin Özdemir', 'selin@example.com', null, 1, [['Toprak', 'Köpek', 'Cocker Spaniel', 'Erkek', '2020-05-16']]],
  ['Burak Yıldız', null, null, 1, [['Venüs', 'Kedi', 'Sfenks', 'Dişi', '2023-08-08']]],
  ['Derya Polat', null, 'Köpek korkak, sakin yaklaşın.', 1, [['Yumak', 'Köpek', 'Terrier', 'Dişi', '2022-12-12']]],
  ['Emre Şimşek', 'emre@example.com', null, 1, [['Zeus', 'Köpek', 'Alman Çoban Köpeği', 'Erkek', '2021-01-01']]],
  ['Gül Erdoğan', null, null, 1, [['Ceviz', 'Kedi', 'Ankara Kedisi', 'Erkek', '2024-04-04'], ['Hera', 'Kedi', 'Tekir', 'Dişi', '2024-04-04']]],
  ['Kerem Aksoy', null, null, 1, [['Paşa', 'Köpek', 'Beagle', 'Erkek', '2020-07-07']]],
];

// Hatırlatma planı: [sahipIdx, hayvanIdx, tür, başlık, gün(+/-), notify, repeat, durum, ek]
const PLAN = [
  // Bugün gönderilecekler (bekliyor)
  [0, 0, 'asi', 'Kuduz aşısı', 1, 1, 365, 'pending'],
  [1, 0, 'asi', 'Karma aşı', 0, 0, 365, 'pending'],
  [3, 0, 'parazit', 'İç parazit', 2, 2, 90, 'pending'],
  [12, 0, 'kontrol', 'Yıllık kontrol', 1, 1, 365, 'pending'],
  // Yarın gönderilecekler
  [2, 0, 'asi', 'Kuduz aşısı', 2, 1, 365, 'pending'],
  [5, 1, 'parazit', 'Dış parazit damlası', 1, 0, 30, 'pending'],
  [17, 0, 'kontrol', 'Kalça kontrolü', 3, 2, null, 'pending'],
  // Yaklaşan 7 gün
  [4, 0, 'kontrol', 'Tüy ve gaga kontrolü', 4, 1, 180, 'pending'],
  [6, 0, 'asi', 'Miksomatozis aşısı', 5, 1, 365, 'pending'],
  [9, 0, 'kontrol', 'Böbrek değerleri kontrolü', 6, 2, 90, 'pending'],
  [13, 0, 'asi', 'Kuduz aşısı', 7, 1, 365, 'pending'],
  [15, 0, 'kisirlastirma', 'Kısırlaştırma öncesi muayene', 7, 3, null, 'pending'],
  // Daha ileri
  [10, 0, 'kontrol', 'Diş kontrolü', 14, 2, 180, 'pending'],
  [11, 0, 'asi', 'Lösemi aşısı', 21, 3, 365, 'pending'],
  [11, 1, 'asi', 'Lösemi aşısı', 21, 3, 365, 'pending'],
  [18, 0, 'asi', 'Karma aşı (yavru, 3. doz)', 12, 1, null, 'pending'],
  [18, 1, 'asi', 'Karma aşı (yavru, 3. doz)', 12, 1, null, 'pending'],
  [19, 0, 'parazit', 'Kalp kurdu ilacı', 25, 2, 30, 'pending'],
  // Süresi geçmiş (bekliyor ama 3 günden eski)
  [7, 0, 'asi', 'Kuduz aşısı', -6, 1, 365, 'pending'],
  [16, 0, 'kontrol', 'Dikiş kontrolü', -9, 0, null, 'pending'],
  // Gönderilemeyen
  [14, 0, 'asi', 'Kuduz aşısı', -1, 1, 365, 'failed', { attempts: 3, last_error: 'İleti Merkezi 452: Alıcı numarası geçersiz veya eksik' }],
  // SMS gönderilmiş (geçmiş)
  [0, 1, 'asi', 'Karma aşı', -2, 1, 365, 'sent', { sentDay: -3 }],
  [2, 0, 'parazit', 'İç parazit', -10, 1, 90, 'sent', { sentDay: -11 }],
  [5, 0, 'kontrol', 'Yıllık kontrol', -5, 2, 365, 'sent', { sentDay: -7 }],
  [8, 0, 'asi', 'Kuduz aşısı', -20, 1, 365, 'sent', { sentDay: -21 }],
  [13, 0, 'parazit', 'Dış parazit', -15, 0, 30, 'sent', { sentDay: -15 }],
  // Tamamlanan / iptal
  [1, 0, 'parazit', 'Dış parazit', -30, 1, 30, 'done', { sentDay: -31 }],
  [9, 0, 'asi', 'Kuduz aşısı', -40, 1, 365, 'done', { sentDay: -41 }],
  [12, 0, 'asi', 'Karma aşı', -35, 1, 365, 'done', { sentDay: -36 }],
  [3, 0, 'kisirlastirma', 'Kısırlaştırma', -12, 3, null, 'cancelled'],
];

/** Klinikte demo dışı (gerçek) sahip kaydı sayısı; süper yönetici düğmesi bunlar varken yüklemeyi reddeder. */
export function nonDemoOwnerCount(db) {
  return db.prepare(`SELECT COUNT(*) AS c FROM owners WHERE import_batch IS NULL OR import_batch <> 'demo'`).get().c;
}

/**
 * Demo verisini yükler; { owners, pets, reminders, sms, skipped, legalIdentity } döner.
 * Tek işlemde (BEGIN IMMEDIATE) çalışır; hata olursa hiçbir kayıt kalmaz.
 */
export function seedDemo(db, { legalIdentity = false } = {}) {
  const today = todayLocal();
  const T = (d) => addDays(today, d);
  const ts = (dayOffset, hour = 10) => new Date(`${T(dayOffset)}T${String(hour).padStart(2, '0')}:00:00+03:00`).toISOString();
  let seq = 0;
  const phone = () => `9051${5 + (seq % 2)}${String(1000100 + seq++).slice(-7)}`;

  const settings = getSettings(db);
  const template = settings.template;
  const msg = (ownerName, petName, dueDate, title) => template
    .replace('{sahip}', ownerName).replace('{hayvan}', petName)
    .replace('{tarih}', dueDate.split('-').reverse().join('.')).replace('{tur}', title)
    .replace('{klinik}', settings.clinic_name || 'Klinik').replace('{klinik_tel}', settings.clinic_phone || '');

  const added = withTransaction(db, () => {
    const ownerIds = [];
    const petIds = [];
    const created = new Set(); // bu turda oluşturulan sahip indeksleri; plan yalnızca bunlar için işlenir
    const out = { owners: 0, pets: 0, reminders: 0, sms: 0, skipped: 0, legalIdentity: false };
    const createdAt = ts(-45);
    for (const [name, email, notes, optIn, petList] of DEMO_OWNERS) {
      const p = phone();
      if (!isDemoPhone(p)) throw new Error('demo telefonu atanmamış aralıkta değil: ' + p);
      const existing = owners.byPhone(db, p);
      if (existing) { out.skipped++; ownerIds.push(existing.id); petIds.push(pets.byOwner(db, existing.id).map((x) => x.id)); continue; }
      const id = owners.create(db, { name, phone: p, email, notes, sms_opt_in: optIn, created_at: createdAt, import_batch: 'demo' });
      ownerIds.push(id); out.owners++; created.add(ownerIds.length - 1);
      const ids = [];
      for (const [pn, species, breed, sex, birth] of petList) {
        ids.push(pets.create(db, { owner_id: id, name: pn, species, breed, sex, birth_date: birth, notes: null, created_at: createdAt, import_batch: 'demo' }));
        out.pets++;
      }
      petIds.push(ids);
    }
    if (out.owners === 0) return out;

    const phoneOf = (ownerId) => db.prepare('SELECT phone FROM owners WHERE id = ?').get(ownerId).phone;
    for (const [oi, pi, type, title, day, notify, repeat, status, extra = {}] of PLAN) {
      if (!created.has(oi)) continue; // atlanan (zaten var olan) sahibe ikinci kez hatırlatma yazılmaz
      const petId = petIds[oi][pi];
      if (!petId) continue; // hayvan silinmişse plan satırı atlanır
      const owner = DEMO_OWNERS[oi];
      const petName = owner[4][pi][0];
      const due = T(day);
      const rid = reminders.create(db, { pet_id: petId, type, title, due_date: due, notify_days_before: notify, repeat_days: repeat, notes: null, created_at: createdAt, created_by: 'demo' });
      out.reminders++;
      if (status === 'sent' || status === 'done') {
        const sentAt = ts(extra.sentDay ?? day - notify, 9 + (rid % 6));
        db.prepare(`UPDATE reminders SET status = ?, sent_at = ?, attempts = 1, last_attempt_at = ? WHERE id = ?`).run(status, sentAt, sentAt, rid);
        smsLog.add(db, { owner_id: ownerIds[oi], pet_id: petId, reminder_id: rid, phone: phoneOf(ownerIds[oi]), message: msg(owner[0], petName, due, title), provider: 'demo', status: 'sent', provider_ref: 'demo-' + rid, sent_by: 'zamanlayici', created_at: sentAt, owner_name: owner[0], pet_name: petName, kind: 'reminder' });
        out.sms++;
        if (repeat && status === 'done') {
          reminders.create(db, { pet_id: petId, type, title, due_date: addDays(due, repeat), notify_days_before: notify, repeat_days: repeat, notes: null, created_at: sentAt, created_by: 'tekrar' });
          out.reminders++;
        }
      } else if (status === 'failed') {
        const at = ts(day - notify, 11);
        db.prepare(`UPDATE reminders SET status = 'failed', attempts = ?, last_attempt_at = ?, last_error = ? WHERE id = ?`).run(extra.attempts, at, extra.last_error, rid);
        for (let i = 0; i < extra.attempts; i++) {
          smsLog.add(db, { owner_id: ownerIds[oi], pet_id: petId, reminder_id: rid, phone: phoneOf(ownerIds[oi]), message: msg(owner[0], petName, due, title), provider: 'demo', status: 'failed', error: extra.last_error, sent_by: 'zamanlayici', created_at: ts(day - notify, 9 + i * 4), owner_name: owner[0], pet_name: petName, kind: 'reminder' });
          out.sms++;
        }
      } else if (status === 'cancelled') {
        reminders.setStatus(db, rid, 'cancelled');
      }
    }
    // Bir test SMS kaydı (bir kez)
    if (!db.prepare(`SELECT 1 FROM sms_log WHERE provider_ref = 'demo-test' LIMIT 1`).get()) {
      smsLog.add(db, { phone: '905150001001', message: `Test mesajı - ${settings.clinic_name || 'Klinik'}`, provider: 'demo', status: 'sent', provider_ref: 'demo-test', sent_by: 'demo', created_at: ts(-40, 15), kind: 'test' });
      out.sms++;
    }
    return out;
  });

  // Sahte hukuki kimlik: YALNIZCA açıkça istenirse (yerel geliştirme). Gerçek klinikte Ayarlar > Hukuki kimlik'ten
  // gerçek bilgiler girilir; m61_declared_at kliniğin kendi beyanıdır, buradan yazıldığında çağıran denetim kaydı düşmeli.
  if (legalIdentity && !settings.legal_form) {
    if (!settings.clinic_phone) setSetting(db, 'clinic_phone', '0212 555 00 00');
    setSetting(db, 'legal_form', 'esnaf');
    setSetting(db, 'tax_id', '1234567890');
    setSetting(db, 'ruhsat_isim', settings.clinic_name || 'Demo Veteriner');
    setSetting(db, 'm61_declared_at', new Date().toISOString());
    added.legalIdentity = true;
  }
  return added;
}
