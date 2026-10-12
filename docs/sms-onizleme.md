# SMS önizleme ve gövde düzenleme

Gönderimden önce klinik kullanıcısı **gönderilecek tam metni** görür ve yalnız gövdeyi
düzenleyebilir. Önek, kimlik satırı ve iptal satırı sunucuda her zaman eklenir;
kaldırılamaz. Önizlenen metin ile gönderilen metin aynı kaynaktan çıkar:
`src/sms/policy.js` içindeki `previewParts` / `composeFromTemplate`.

Bu belge bir hukuk görüşü değildir. Madde atıfları `docs/mevzuat-uyum-spesifikasyonu.md`
karar özetinden alınmıştır.

---

## 1. Klinik kullanıcısı: adım adım

### Listeden önizleme

1. **Hatırlatmalar** (`/hatirlatmalar`), **Özet** (`/`) veya hasta sahibi sayfasındaki
   listede bekleyen (veya başarısız) bir hatırlatmada **SMS gönder** / **Şimdi gönder**
   bağlantısına tıklayın. Bağlantı `GET /hatirlatmalar/:id/onizle` açar.
2. Ekranda üç kilitli satır ve ortada düzenlenebilir **Mesaj gövdesi** görünür:
   - üstte sabit önek `Bilgilendirme: `
   - gövde (şablondan üretilen metin; burası düzenlenir)
   - altta sabit kimlik satırı (`MERSIS:…` veya `… VKN:…`) ve iptal satırı
     (`Iptal: <adres>/ret/<klinik>.<belirteç> Tel:<klinik>`)
3. **Gönderilecek tam metin** kutusunda sağlayıcıya gidecek birleşik ileti durur.
   Yanındaki sayaç karakter, SMS parça sayısı ve kodlamayı gösterir.

### Gövdeyi düzenleme

1. Yalnız `textarea[name="body"]` alanını değiştirin. Kimlik ve iptal satırları
   yazılamaz; gövdeye `MERSIS:`, `VKN:` veya `Iptal:` yazmak sunucuda reddedilir.
2. Sayaç yazarken güncellenir (GSM-7, GSM-7 Türkçe veya Türkçe UCS-2; bkz. §3). Sınır aşılırsa veya gövde
   boşsa **Gönder** düğmesi kapanır; sunucu yine de POST’ta doğrular.
3. Şablona dönmek için **Orijinale dön**.
4. **Gönder** `POST /hatirlatmalar/:id/gonder` yollar; alanlar `_csrf` ve `body`.
   Önek ve kuyruk istek gövdesinden okunmaz, `policy.js` ekler.

Düzenleme yoksa (gövde şablonla aynıysa) denetim kaydında `edited: false` düşer;
gönderilen metin yine önizlemedeki tam metindir.

### Hızlı kayıttan «Kaydet ve SMS önizle»

1. **Hızlı kayıt** (`/hizli-kayit`) formunu doldurun (sahip, hayvan, ilk hatırlatma).
2. **Kaydet ve SMS önizle** düğmesine basın (`name="sonra"` `value="onizle"`).
3. Kayıt oluşunca tarayıcı `GET /hatirlatmalar/<yeni-id>/onizle` sayfasına gider.
   Hatırlatma eklenmediyse sahip sayfasına dönülür.

Yalnız **Kaydet** mevcut davranışı korur: sahip sayfasına yönlendirir.

---

## 2. Neler düzenlenemez ve nedeni

Kullanıcı yalnız gövdeyi yazar. Aşağıdakiler sistem tarafından eklenir, ekranda
«Sabit» işaretlidir, POST gövdesinden alınmaz.

| Parça | Biçim | Neden (mevzuat spesifikasyonu, karar özeti) |
|---|---|---|
| Önek | `Bilgilendirme: ` | «Niteliği anlaşılmıyorsa başta "bilgilendirme" ibaresi» — Yön. m.8/6 (koşullu) |
| Kimlik satırı | tacir: `MERSIS:<mersis_no>`; esnaf: `<ruhsat_isim> VKN:<tax_id>` | «Her SMS'te gönderen kimliği: tacir → MERSİS; esnaf → ad-soyad + TCKN/VKN» — Ticari İletişim ve Ticari Elektronik İletiler Hk. Yön. m.8/3 |
| İletişim bilgisi | iptal satırındaki `Tel:<klinik>` | «Her SMS'te erişilebilir iletişim bilgisi» — Yön. m.8/5 |
| İptal satırı | `Iptal: <origin>/ret/<klinik>.<belirteç> Tel:<klinik>` | «Her iletide ret imkânı; aynı kanaldan, kolay, ücretsiz; rette özgülenmiş URL kabul» — Yön. m.9/3, m.9/4 |

Gönderimden hemen önce `hasMandatoryTail` metnin `Bilgilendirme: ` ile başladığını
ve gerçek kimlik + iptal kuyruğuyla bittiğini kontrol eder; eksikse sağlayıcıya
gidilmez (`skipped: 'tail'`). Test SMS'i bu kilitten muaftır.

---

## 3. Parça hesabı

Sunucu (`src/sms/policy.js` `smsSegments`) ve istemci (`public/app.js`) aynı
mantığı kullanır. Ortak vektörler `test/fixtures/sms-segments.json` içindedir.

Kodlama kararı `policy.js` ile tutarlıdır:

- GSM 03.38 temel tablosu (1 birim) ve genişletme tablosu (`GSM7_EXT`, 2 birim)
  her zaman kullanılır. **Ç, Ö, Ü, ö, ü temel tablodadır**; 1 birimdir.
- Sağlayıcı Netgsm ise (`usesTurkishShift(settings)`: `sms_provider === 'netgsm'`;
  gönderimde Netgsm `encoding: 'TR'`) **Türkçe tek kaydırma tablosu**
  (`GSM7_TR_SHIFT`: `Ğ İ Ş ç ğ ı ş`) da kullanılır. Bu harfler 2 birim sayılır ve
  metinde en az biri varsa kodlama `gsm7tr` olur: UDH'deki 3 baytlık dil bilgisi
  yüzünden parça kapasitesi **155/149**'dur. Bu harfler yoksa kodlama `gsm7` kalır (160/153).
- Kaydırma tablosu kapalıysa (Netgsm dışı sağlayıcı) `Ğ İ Ş ç ğ ı ş` dahil, ya da
  açıkken hiçbir tabloda olmayan (ör. `Â`, emoji) **tek bir karakter** bütün mesajı
  UCS-2'ye geçirir (**70/67**; birim = UTF-16 kod birimi, vekil çift 2 birim).

| Kodlama | Tek parça | Çok parça (parça başı) | Birim |
|---|---|---|---|
| GSM-7 (`gsm7`) | 160 | 153 | temel karakter = 1; `GSM7_EXT` her karakter 2 |
| GSM-7 Türkçe (`gsm7tr`) | 155 | 149 | temel karakter = 1; `GSM7_EXT` ve `GSM7_TR_SHIFT` her karakter 2 |
| UCS-2 (`ucs2`) | 70 | 67 | UTF-16 kod birimi (istemcide `String.length`) |

`GSM7_EXT` (`policy.js` / `public/app.js`): `^ { } \ [ ~ ] | €`.
`GSM7_TR_SHIFT`: `Ğ İ Ş ç ğ ı ş`.

`SMS_LIMITS`: `{ gsm7: { single: 160, multi: 153 }, gsm7tr: { single: 155, multi: 149 }, ucs2: { single: 70, multi: 67 } }`.

Parça sayısı (`smsSegments`): her karakterin birimi `sizes` dizisine yazılır,
`units` bunların toplamıdır. 0 birim → 0 parça; `units <= single` → 1 parça.
Aksi halde parçalar `sizes` üzerinde sırayla doldurulur: karakter mevcut parçaya
sığmıyorsa (`used + u > multi`) yeni parça açılır. Böylece 2 birimlik bir karakter
(genişletme çifti, Türkçe kaydırma çifti, UCS-2 vekil çifti) **parça sınırında
bölünmez**, bütünüyle sonraki parçaya geçer; parça sayısı `Math.ceil(units / multi)`
değerinden fazla olabilir. `remainingInSegment` son parçada kalan birimdir.

### Örnek hesaplar

`test/fixtures/sms-segments.json` vektörleri. «TR» sütunu `turkishShift` seçeneğidir
(Netgsm); boşsa kapalıdır.

| Metin | TR | Kodlama | Birim | Parça |
|---|---|---|---|---|
| 160 × `a` | | gsm7 | 160 | 1 |
| 161 × `a` | | gsm7 | 161 | 2 |
| 306 × `a` | | gsm7 | 306 | 2 |
| 307 × `a` | | gsm7 | 307 | 3 |
| 70 × `ş` | | ucs2 | 70 | 1 |
| 71 × `ş` | | ucs2 | 71 | 2 |
| 134 × `ş` | | ucs2 | 134 | 2 |
| `€` | | gsm7 | 2 | 1 |
| 80 × `€` | | gsm7 | 160 | 1 |
| `GSM7_EXT` eksi `€` (8 karakter) | | gsm7 | 16 | 1 |
| `ÇÖÜöü` | | gsm7 | 5 | 1 |
| `Merhaba ç` | | ucs2 | 9 | 1 |
| `ı` | | ucs2 | 1 | 1 |
| boş | | gsm7 | 0 | 0 |
| 152 × `a` + `€` + 152 × `a` | | gsm7 | 306 | 3 |
| 66 × `ş` + `🐶` + 66 × `ş` | | ucs2 | 134 | 3 |
| 77 × `ş` | açık | gsm7tr | 154 | 1 |
| 78 × `ş` | açık | gsm7tr | 156 | 2 |
| `ĞİŞçğışÇÖÜ` | açık | gsm7tr | 17 | 1 |
| 160 × `a` | açık | gsm7 | 160 | 1 |
| `Âş` | açık | ucs2 | 2 | 1 |

Kaydırma tablosu kapalıyken tek `ç` veya `ı` içeren bir gövde, önek ve kuyruk ASCII
olsa bile **tüm iletiyi** UCS-2'ye geçirir; SMS başına sınır 160/153 değil 70/67 olur.
Netgsm'de aynı gövde `gsm7tr` kalır (155/149; Türkçe harf 2 birim).

Sayaç metni: `<n> karakter · <n> SMS parçası · GSM-7|GSM-7 Türkçe|Türkçe (UCS-2) · parçada kalan <n>`.
Üst sınır `MAX_MESSAGE_LENGTH` = **460** (önek + gövde + kuyruk). Gövde tavanı
`MAX_BODY_LENGTH` = **320**.

---

## 4. Sunucu doğrulama (`bodyProblems`)

`POST /hatirlatmalar/:id/gonder` içinde `body` bir dizgeyse `bodyProblems` çalışır.
Sorun varsa HTTP **400**, önizleme yeniden çizilir, gönderim olmaz. Gövde **kırpılmaz**.

| Kural | Hata metni (aynen) |
|---|---|
| Boş veya yalnız boşluk | `Mesaj gövdesi boş olamaz.` |
| Satır sonu, sekme, kontrol karakteri (`U+0000`–`U+001F`, `U+007F`–`U+009F`) | `Mesaj gövdesinde satır sonu, sekme veya kontrol karakteri olamaz.` |
| Gövde > 320 karakter | `Mesaj gövdesi en fazla 320 karakter olabilir.` |
| Önek + gövde + kuyruk > 460 | `Kimlik ve iptal satırıyla birlikte mesaj 460 karakteri aşıyor (<toplam>); gövdeyi kısaltın.` |
| Gövde `MERSIS:` / `VKN:` / `Iptal:` taklidi (Türkçe harf duyarsız) | `Gövde kimlik (MERSIS/VKN) veya iptal satırı içeremez; bu satırlar sistemce eklenir.` |

Aynı çağrı şablondaki içerik politikasını da uygular (`contentProblems`): indirim,
kampanya, ilaç ticari adı, teşhis terimi vb. reddedilir. Örnek biçim:

- `"indirim" ifadesi kullanılamaz — TVHB Uyg. Yön. m.97 (maddi avantaj/özendirme ifadesi) ve Ticari İletişim Yön. m.6/1 sınırı.`

İstemci sayacı bilgi amaçlıdır; boş gövde ve 460 aşımı için
` · Gövde boş olamaz` / ` · Sınır aşıldı, gövdeyi kısaltın` ekler. Asıl ret
sunucudadır.

### Önizleme: geçersiz kayıtlı gövde

`GET /hatirlatmalar/:id/onizle` kayıtlı `body_override`’ı da `bodyProblems` ile denetler.
Sorun varsa sorun listesi kırmızı bantta görünür, `.sms-saved-override` bandı metnin
gönderileceğini söylemez («kayıtlı düzenlenmiş gövde geçersiz; bu haliyle gönderilemez ve
zamanlayıcı da göndermez») ve **Gönder** sunucuda `disabled` çizilir (`canSend` = blokaj yok
ve gövde sorunu yok). İstemci, gövde bu ilk değerde kaldıkça düğmeyi kapalı tutar
(`data-invalid-body`); gövde değiştirilince olağan sayaç denetimi geçerlidir, son söz POST’taki
sunucu denetimindedir. Gövdeden bağımsız engeller (`data-server-blocked="1"`) varken istemci
düğmeyi hiç açmaz.

### Zamanlayıcı: geçersiz kayıtlı gövde

`src/scheduler.js` `sendReminderSms`, `bodyOverride` verilmediğinde (zamanlayıcı ya da sağlayıcı
hatasından sonraki otomatik tekrar) hatırlatmadaki kayıtlı `body_override`’ı kullanır ve kilit
içinde taze kayıtla `bodyProblems` denetimi yapar. Kayıtlı gövde sonradan geçersizleşmişse (ör.
şablon ya da içerik kuralı değişti, gövdeye `MERSIS:`/`Iptal:` taklidi ya da kontrol karakteri
girmiş) iki kolay yol bilerek seçilmemiştir. **Şablona sessizce dönülmez**: kullanıcı önizlemede
belirli bir metni onaylamıştır; onun yerine başka bir metin gitmesi, «önizlenen = gönderilen»
güvencesini bozar ve kimsenin onaylamadığı bir ileti gönderilmiş olur. **Geçersiz metin de
gönderilmez**: `bodyProblems` kimlik/iptal satırı taklidini, kontrol karakterlerini ve uzunluk
aşımını reddeder; bunlar her SMS’te tek ve doğru kimlik satırı ile ret (iptal) imkânı
zorunluluğunu (Ticari İletişim Yön. m.8/3, m.9/3–4; KVKK/İYS — bkz.
`docs/mevzuat-uyum-spesifikasyonu.md` ve §2) zayıflatır. Bunun yerine
`reminders.markAttemptFailed` çağrılır: `last_error` «Kayıtlı düzenlenmiş gövde geçersiz: …»
olarak yazılır, deneme sayacı artar ve `MAX_ATTEMPTS` (3) sonunda durum `failed` olur (tekrarlı
hatırlatmada sonraki tekrar yine oluşturulur). Böylece kayıt **Gönderilemeyenler** listesinde
görünür, bir insan önizlemede gövdeyi düzeltir ya da «Orijinale dön»le şablona döner; deneme
sayacı ise her zamanlayıcı turunda aynı geçersiz gövdenin sonsuza dek yeniden denenmesini önler.

---

## 5. Denetim kaydı

Elle gönderim (atlanan `state` hariç) `master.db` `audit_log` satırına yazılır.

- `action`: `reminder.sms_send`
- `entity_type`: `reminder`
- `entity_id`: hatırlatma kimliği
- `clinic_id`: klinik kimliği

`meta` alanları:

| Alan | Anlam |
|---|---|
| `edited` | gövde şablondan üretilen orijinalden farklıysa `true` |
| `original_length` | orijinal gövdenin (boşluklar tek satıra indirilmiş) karakter sayısı |
| `new_length` | gönderilen gövdenin karakter sayısı |
| `segments` | tam metnin SMS parça sayısı (`smsSegments`) |
| `encoding` | `gsm7`, `gsm7tr` veya `ucs2` |
| `ok` | sağlayıcı çağrısı başarılıysa `true` |

**Tutulmayanlar:** telefon numarası, sahip adı, gövde metni, tam SMS metni.
Kişisel veri denetim kaydına yazılmaz (`src/audit.js`).

---

## 6. Korunan sınırlar

Bu özellik mevcut korumaları değiştirmez.

| Koruma | Davranış |
|---|---|
| Elle gönderim hız sınırı | `POST /hatirlatmalar/:id/gonder` klinik başına saatte **30** (`limiters.manualSms`, 60 dakika). 31. istek HTTP **429**, gövde: `Saatte en fazla 30 elle gönderim yapılabilir.` |
| Opt-out | `sms_opt_in` kapalıysa önizlemede: `Bu hasta sahibi SMS almak istemiyor (ret kaydı var).` Gönder düğmesi kapalı. POST: `Bu hasta sahibi SMS almak istemiyor.` |
| Demo numara | Atanmamış `0515` / `0516` aralığı (`isDemoPhone`, normalize `90515…` / `90516…`). Önizleme: `Bu bir demo numarası; SMS hiçbir sağlayıcıya gönderilmez.` Sağlayıcıya gidilmez. |
| Kiracı yalıtımı | Başka kliniğin `/hatirlatmalar/:id/onizle` ve `/gonder` istekleri **404**. |
| CSRF | `POST` `_csrf` olmadan **403**. |
| Kapalı hatırlatma | `sent` / `done` / `cancelled` ise: `Bu hatırlatma için SMS zaten gönderilmiş ya da kapatılmış.` |

Hukuki kimlik eksikse önizleme ve gönderim kilitlenir:
`Gönderim kilitli: Ayarlar > Hukuki kimlik eksik (…)` (`legalProblems`).
