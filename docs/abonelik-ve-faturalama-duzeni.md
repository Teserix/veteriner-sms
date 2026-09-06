# Abonelik geliri, faturalama ve tahsilat düzeni

**Kapsam:** Teserix / veteriner-sms için aylık gelir modeli, resmi düzen ve uygulama tasarımı. Tarih: 6 Eylül 2026. **Bu belge hukuki veya mali görüş değildir.** `[teyit]` işaretli her madde muhasebeci (SMMM) ve/veya avukat onayı gerektirir. Rakamlar kaynaklardan alındı ve 6 Eylül 2026'da yeniden doğrulandı; `(varsayım)` işaretli olanlar bu belgede üretilmiş tahminlerdir; `(doğrulanamadı)` işaretli olanlar kaynakla desteklenemedi.

---

## 1) Kısa cevap

1. **Kliniği yazılım aboneliğiyle bağlarsın, SMS'le değil.** Klinik kendi İleti Merkezi/Netgsm hesabını kullanır, SMS faturasını sağlayıcı keser; Teserix yalnızca "yazılım hizmet bedeli" faturalar. Böylece 5809 s.K. m.60/4 kontör yeniden satışı riski oluşmaz ve SMS bedeli senin cirona girmez [24][32].
2. **Fatura kalemi:** "Veteriner SMS hatırlatma yazılımı aylık kullanım bedeli – <plan> <ay>", %20 KDV `[teyit]` [7].
3. **Fiyat KDV hariç konumlanır** (B2B normu; klinik KDV'yi indirir): 349 / 599 / 999 TL/ay, yıllık peşinde 10 ay ücreti `(varsayım)`.
4. **Gelirin %95+'ı abonelikten gelir.** SMS komisyonu klinik başına ayda ≈4-110 TL (tipik 10.000'lik paketle ≈10-15 TL); fiyatlamanın dayanağı olamaz [27][28].
5. **Şirket yapısı:** başlangıçta şahıs işletmesi (işletme hesabı esası). 29 yaşını doldurmadıysan ve ilk kez mükellef oluyorsan genç girişimci istisnası 3 yıl boyunca yıllık 400.000 TL kazancı gelir vergisinden istisna eder (Bağ-Kur prim desteği 1.1.2026'dan itibaren kalktı) `[teyit]` [2]. Hasılat 1,2 milyon TL'yi (2026 VUK 177/2 haddi) aşınca bilanço esasına geçilir; Ltd'yi o noktada, ortak/yatırımcı gerekince veya sorumluluk sınırı için değerlendir [3][8].
6. **Fatura zamanı:** aylık dönem sonunu izleyen 7 gün içinde (VUK 231/5); yıllık peşinde tek fatura (KDV hemen doğar) veya avans + aylık 1/12 — kararı muhasebeci versin `[teyit]` [9].
7. **e-Belge:** işletme hesabında 2026'da vergiler dahil 3.000 TL üstü faturalar e-Arşiv, 1.1.2027'den itibaren tümü; GİB portalı ücretsiz. İnternet satışında 500 bin TL hasılat eşiği ARPA 500 TL ile ≈80 klinikte aşılır; e-Fatura hazırlığına 30-40 klinikte başla `[teyit]` [10][11].
8. **Tahsilat:** ilk 10 klinikte havale/EFT + açıklama kodu + süper yönetici "ödendi"; sonra iyzico Abonelik (kart saklama, otomatik çekim; ilk 3 ay yalnız komisyon, sonra 199 TL/ay + komisyon) [13].
9. **Sözleşme:** klinik tüketici değildir (6502 m.3); otomatik yenileme, 7 gün vade, 7 gün grace, askı, 30 gün sonra pasif — web onay kutusuyla kurulur, damga vergisi doğmaz `[teyit]` [14][16].
10. **Nakit başabaş ≈ 9 klinik** (ARPA 500 TL, sabit gider ≈4.200 TL/ay, Bağ-Kur hariç) `(varsayım)`; 30 klinikte ≈ +10.800 TL/ay, 100 klinikte ≈ +45.700 TL/ay (SMS komisyonu dahil; komisyonsuz ≈ +10.400 / +44.400).

---

## 2) Gelir modeli

### Paketler (KDV hariç; yıllık peşin = 10 ay ücreti, %16,7 indirim) `(varsayım)`

| Paket | İçerik | Aylık | Yıllık peşin | Hedef klinik |
|---|---|---|---|---|
| **Başlangıç** | 1 kullanıcı, aylık 500 hatırlatmaya kadar, tek şablon, aşı/kontrol/parazit hatırlatma, e-posta destek | 349 TL | 3.490 TL | Tek hekimli, 1-2 personel |
| **Klinik** | 3 kullanıcı, aylık 2.000 hatırlatma, çoklu şablon, Excel/CSV içe aktarım, teslim raporu ve sağlayıcı bakiye uyarısı, WhatsApp/telefon destek | 599 TL | 5.990 TL | 2-5 personel (ana hedef) |
| **Klinik+** | Sınırsız kullanıcı ve hatırlatma, çoklu şube, öncelikli destek, aylık performans raporu, veri aktarımı dahil | 999 TL | 9.990 TL | Çok şubeli / yoğun klinik |

Ortak: 14 gün kartsız deneme; isteğe bağlı veri aktarımı 1.500 TL tek seferlik (ilk 10 "kurucu klinik" için ücretsiz + 12 ay fiyat sabitleme).

**Her fiyat tablosunda ve sözleşmede zorunlu ifade:** "SMS ücreti pakete dahil değildir; kliniğin kendi İleti Merkezi/Netgsm hesabından, sağlayıcı tarafından doğrudan kliniğe faturalanır (≈0,09-0,38 TL/SMS, paket büyüklüğüne göre; KDV+ÖİV dahil). Teserix yalnızca yazılım hizmeti faturalar." [27][28]

### Fiyat gerekçesi (çapalar)

- **Rakip:** Kolayvet (tam klinik yazılımı) yıllık ödemede 5.990 / 11.900 / 25.990 TL/yıl (≈499 / 992 / 2.166 TL/ay), aylık ödemede 999 / 1.990 / 4.990 TL/ay, pakete göre 1.000-10.000 hediye SMS, 14 gün deneme, KDV durumu belirtilmemiş [20]. BulutVet 1.000 TL+KDV/ay veya 4.750 TL+KDV/yıl, 14 gün deneme [21]. SmartVet, PratikVet, Vetran, selfVet vb. için açık fiyat **bulunamadı** (teklife dayalı). DoldurKabı ücretsiz; aşı hatırlatıcı ve push bildirim var, SMS hatırlatma listelenmiyor [22]. Teserix dar kapsamlı olduğu için Kolayvet Standart'ın altında/çevresinde konumlanmalı.
- **Komşu sektör:** kuaför randevu 419 TL/ay (Asistan Panel) - 999 TL/ay (Piyzi Pro; Piyzi pazar aralığını 700-3.500 TL/ay veriyor); diş kliniği 1.200 TL+KDV/ay, yıllık 12.000 TL+KDV ("2 ay ücretsiz", Dental Asistanım) [23]. 1-5 kişilik hizmet işletmeleri 400-1.200 TL/ay bandını normal görüyor.
- **Değer argümanı:** İstanbul Veteriner Hekimler Odası 2026 alt sınır tarifesinde kedi/köpek muayenesi 1.750 TL (klinikler bunun üzerine çıkabilir; Dr. hekim muayenesi 2.900 TL) [29]; ayda 1 kurtarılan randevu Klinik paketini fazlasıyla öder.
- **Yıllık indirim:** Türkiye veteriner SaaS'ında %50-60 (Kolayvet %50, BulutVet %60; aylık fiyatı çapa olarak yüksek yazma taktiği) [20][21]; uluslararası norm %10-25, en yaygını %17 ("2 ay bedava"); yıllık plan müşterileri aylık planlara göre yaklaşık 3 kat daha az churn ediyor [30]. Teserix dürüst aylık fiyat + "2 ay bedava" yıllık önerir.
- **Maliyet tabanı:** klinik başına değişken maliyet neredeyse sıfır (SQLite/klinik, tek Hetzner sunucu 100 kliniğe yeter); fiyat maliyetten değil değerden türetildi.

### Komisyon geliri

Netgsm bayilik: gerçek kişi (vergi levhası + imza beyannamesi) bayi olabilir; bayi panelinde görünen kazanca %20 KDV eklenerek komisyon faturası kesilir, ödeme her ayın 25'i; oran yalnızca bayi panelinde, kamuya açık **bulunamadı** [24]. İleti Merkezi'nin güncel bayilik/komisyon sayfası **bulunamadı** [32]. Klinik ayda 500-1.500 SMS atarsa harcaması paket büyüklüğüne göre 44-540 TL (10.000'lik paket 0,088-0,16 TL, 500-1.000'lik paket 0,36-0,40 TL); %10-20 komisyonla Teserix'e ayda ≈4-110 TL/klinik `(oran varsayım; komisyonun vergiler hariç matrah üzerinden hesaplanması olası)` [27][28]. Komisyonun asıl değeri ticari değil: resmi "iş ortağı" statüsü ve kliniğe indirimli SMS.

---

## 3) Birim ekonomi

**Varsayımlar `(varsayım)`:** ARPA 500 TL/ay KDV hariç (paket karması + yıllık indirim sonrası); %50 müşteri yıllık havale (komisyonsuz), kalanı iyzico %3 (pazarlık varsayımı; liste %4,29) + 0,25 TL + 199 TL/ay paket; sabit gider 4.189 TL/ay = Hetzner CX23 + IPv4 + yedek + alan adı ≈446 TL [31] + Paraşüt e-Portal (1.800 TL+KDV tek seferlik ÷ 12 ≈ 150 TL) [12] + SMMM İstanbul işletme defteri 3.593 TL [4]; 100 klinikte ikinci sunucu (≈893 TL). Klinik başına aylık 1.000 SMS, komisyon %15, birim 0,088 TL (İleti Merkezi yeni abone fiyatı: 10.000 SMS 879 TL) [27].

| Kalem (TL/ay) | 10 klinik | 30 klinik | 100 klinik |
|---|---|---|---|
| Abonelik geliri (KDV hariç) | 5.000 | 15.000 | 50.000 |
| SMS komisyonu (tahmini) | 132 | 396 | 1.320 |
| Sunucu + alan adı | 446 | 446 | 893 |
| Paraşüt / e-belge | 150 | 150 | 150 |
| Mali müşavir | 3.593 | 3.593 | 3.593 |
| Ödeme komisyonu (iyzico) | 275 | 428 | 962 |
| **Net nakit (Bağ-Kur hariç)** | **≈ +668** | **≈ +10.780** | **≈ +45.720** |
| Bağ-Kur 4/b (başka işte 4/a değilsen) [5] | −10.157 | −10.157 | −10.157 |
| **Net nakit (Bağ-Kur dahil)** | ≈ −9.490 | ≈ +620 | ≈ +35.560 |
| Kurucu destek zamanı (30/20/15 dk/klinik × 600 TL/saat) | −3.000 | −6.000 | −15.000 |
| Marj (Bağ-Kur hariç, komisyon dahil) | %13 | %70 | %89 |

- Nakit başabaş ≈ 9 klinik (Bağ-Kur hariç); Bağ-Kur ödeniyorsa ≈ 29 klinik. Mali müşavir mevcut şirketinde zaten ödeniyorsa batık maliyettir; o halde 10 klinikte ≈ +4.260 TL/ay.
- iyzico liste oranı (%4,29) pazarlıkla düşmezse ödeme komisyonu 10 klinikte ≈307 TL, 100 klinikte ≈1.285 TL olur (+%5 BSMV); net nakit 10 klinikte ≈ +636 TL'ye iner.
- **Yıllık peşin nakit etkisi** (Klinik paketi 5.990 TL/yıl, tüm klinikler yıllık): 10 → 59.900 TL, 30 → 179.700 TL, 100 → 599.000 TL peşin (KDV hariç). Peşin tek fatura kesilirse KDV'nin tamamı o ay ödenir (KDVK 10/b); gelir dönemsellikle 12 aya yayılır `[teyit]` [9].
- Vergi (şahıs, istisnasız, kazanç 450.000 TL örneği, 2026 tarifesi): 28.500 + 42.000 + 13.500 ≈ 84.000 TL/yıl; genç girişimci istisnasıyla (450.000 − 400.000) × %15 ≈ 7.500 TL; Ltd'de KV %25 (112.500) + kâr dağıtım stopajı %15 (50.625) ≈ 163.000 TL `[teyit]` [1][3].
- Churn: SMB SaaS aylık %2-4 (Livmo) / %3-8 (PM Toolkit); %2'de ortalama müşteri ömrü ≈50 ay, LTV ≈25.000 TL; %4'te ≈25 ay, LTV ≈12.500 TL [30] `(uluslararası benchmark)`.

---

## 4) Resmi düzen

### Şirket türü `[teyit]`

| Ölçüt | Şahıs işletmesi (işletme hesabı) | Limited şirket |
|---|---|---|
| Kuruluş | Vergi dairesi kaydı, düşük maliyet | Sermaye 50.000 TL (1.1.2024'ten itibaren) + kuruluş ≈30-42,5 bin TL [3] |
| Vergi | GV tarifesi %15-40 (2026: 190k'ya kadar %15, 400k'ya kadar %20, 1M'ye kadar %27, 5,3M'ye kadar %35, üstü %40) [1] | KV %25 + kâr dağıtım stopajı %15 (9286 s. CBK, RG 22.12.2024) → efektif ≈%36 [3] |
| Genç girişimci istisnası | 29 yaşını doldurmamış, ilk mükellefiyet: 3 yıl × 400.000 TL kazanç GV istisnası (tutar = tarifenin 2. dilimi); Bağ-Kur prim desteği 7566 s.K. ile 1.1.2026'dan itibaren kaldırıldı [2] | Ortaklar yararlanamaz (GVK mük. 20 metninden çıkarım; kaynak açılamadı) `[teyit]` |
| Muhasebe (İstanbul 2026 asgari) | 3.593 TL/ay (işçisiz, işletme hesabı) [4] | 7.985 TL/ay (bilanço, 1. kademe) [4] |
| Bağ-Kur | 4/b ≈10.157 TL/ay (5 puan indirimli) - 11.808 TL/ay (indirimsiz), başka işte 4/a değilsen [5] | Ortak-müdür de 4/b |
| Sorumluluk | Sınırsız (şahsi malvarlığı) | Sermaye ile sınırlı |
| e-Belge | 2026: vergiler dahil 3.000 TL üstü e-Arşiv; 2027: tümü | 2026'dan itibaren tümü e-Arşiv/e-Fatura |
| Ne zaman | 2025 hasılatı ≤ 1,2 milyon TL (KDV hariç) | Bilanço esasına geçiş: yıllık gayrisafi iş hasılatı > 1.200.000 TL (VUK 177/2, 588 Tebliğ) [8]; Ltd ayrıca ortak/yatırımcı, KVKK sorumluluk sınırı için |

Basit usul teorik olarak mümkün (2026 hizmet hasılat haddi 600.000 TL) ama teslim ve hizmetler KDV'den istisna olduğu için KDV indirimi yok; basit usul kazançları zaten GVK mük. m.20/A ile gelir vergisinden istisna olduğundan genç girişimci istisnasının ayrıca bir anlamı kalmaz; İstanbul'da SaaS için verildiğine dair örnek **bulunamadı** [6].

### KDV ve e-belge `[teyit]`
- SaaS hizmet bedeli %20 KDV (7346 s. CBK, RG 07.07.2023, yürürlük 10.07.2023) [7]. Yurt içi B2B'de KDV tevkifatı yok.
- e-Arşiv (589 Sıra No'lu VUK Tebliği): bilanço esası 1.1.2026'dan itibaren tüm faturalar; basit usul ve işletme hesabı 1.1.2025-31.12.2026 arasında vergiler dahil 3.000 TL'yi aşan faturalar, 1.1.2027'den itibaren tümü. GİB e-Belge Portalı ücretsiz, mali mühür gerekmez [10].
- e-Fatura: 2025 hasılatı 3 milyon TL (geçiş 1.7.2026); kendi sitesi veya aracı platformlar üzerinden mal/hizmet satışında 500 bin TL eşiği (509 Tebliğ IV.1.4). SaaS'ın bu kapsama girdiği kuvvetle muhtemel, özelge **bulunamadı**; ARPA 500 TL'de eşik ≈80 klinikte aşılır, 30-40 klinikte hazırlan [11].
- Entegratör: Paraşüt e-Fatura + ön muhasebe 940 TL+KDV/ay; sadece e-Portal tek seferlik 1.800 TL+KDV (120 e-kontör dahil; ek 50 kontör 210 TL+KDV); e-Fatura kaydı için mali mühür 1.450 TL+KDV ayrıca [12]. 5-50 faturaya GİB portalı yeter.

### Fatura zamanı `[teyit]`
VUK 231/5: hizmetin yapıldığı tarihten itibaren azami 7 gün; süresi geçen fatura hiç düzenlenmemiş sayılır (VUK 353 özel usulsüzlük cezası) [9]. Aylık abonelikte hizmet dönemi "takvim ayı", fatura ay sonu / takip eden ilk 7 gün. Yıllık peşinde avans için fatura zorunlu değil `(kaynak bu turda açılamadı)`; peşin fatura kesilirse KDV tamamı hemen doğar, gelir aylara yayılır (380 hesabı bilanço esası ister). Uygulama her iki modu desteklemeli (issued_at ayrı alan).

### Tahsilat yolları

| Yol | Maliyet | Not |
|---|---|---|
| Havale/EFT | 0 TL | Açıklama kodu (VET-XXXXXX) + elle mutabakat; ilk 10 klinik |
| iyzico Abonelik | İlk 3 ay yalnız komisyon, sonra 199 TL/ay + resmi liste %4,29 + 0,25 TL/işlem (+%5 BSMV); üçüncü taraf siteler pazarlıkla %1,95-3,99 yazıyor [13] | Kart saklama iyzico'da (PCI yükü yok), yalnız kredi kartı, başarısız ödemede 160 güne kadar retry, hakediş haftalık hesaplanır (Çarşamba-Salı) [18] |
| PayTR | Aylık ücret yok; yeni üyeye %2,19 promosyon; "Abonelik Yönetimi" ürünü var [13] | Oran ciroya göre |
| Paraşüt tahsilat linki / Papara Business | **bulunamadı** | — |

iyzico şahıs şirketi belgeleriyle (vergi levhası, imza beyannamesi, kimlik, banka belgesi) başvuru kabul ediyor [13]. 1.200 TL'lik tahsilatta: iyzico liste oranıyla ≈51,7 TL (+BSMV ≈54 TL), PayTR ≈26 TL, havale 0 TL.

### Sözleşme kontrol listesi `[avukat teyidi]`
- [ ] "Taraflar ticari/mesleki amaçla hareket eder; 6502 s.K. uygulanmaz" beyanı (6502 m.3: tüketici = ticari veya mesleki olmayan amaçlarla hareket eden gerçek veya tüzel kişi) [14]
- [ ] Otomatik aylık/yıllık yenileme; 30 gün önceden yazılı fesih
- [ ] Ödeme vadesi 7 gün; vade + 7 gün grace sonrası askı (SMS durur, panel açık); askı + 30 gün sonra fesih/pasif
- [ ] Temerrüt faizi: 3095 s.K. m.2/2 avans faizi atfı
- [ ] Bildirim: e-posta; tacir kliniklere ihtar KEP/noter/taahhütlü (TTK 18/3) [15]
- [ ] Damga vergisi: web onay kutusu (güvenli e-imza yok) → damga vergisi yok; ıslak/güvenli e-imzalı ve tutar içeren sözleşme → binde 9,48 (yıllık 12.000 TL'de 113,76 TL; 2026 kağıt başı azami 29.115.961,10 TL) [16]
- [ ] KVKK Veri İşleme Eki: klinik veri sorumlusu, Teserix veri işleyen; m.12 müşterek sorumluluk, alt işleyenler (sağlayıcı, VPS), ihlal bildirimi, sözleşme sonunda silme [17]
- [ ] İYS/6563: hatırlatma SMS'i "hizmet ifası bilgilendirmesi" — klinik taahhüdü olarak yazılır `[teyit]`
- [ ] Sağlayıcı SMS ücretinin Teserix dışı olduğu; kliniğin sağlayıcı sözleşmesinden Teserix'in sorumlu olmadığı
- [ ] Hizmet seviyesi: bakım penceresi, "teslim garantisi yok" (DLR sağlayıcıya bağlı)

### Komisyon faturası `[teyit]`
Teserix → sağlayıcıya aylık "aracılık/komisyon hizmet bedeli" faturası, %20 KDV (aracılık edilen ürünün oranından bağımsız) [24][25]. Netgsm ayın 25'inde öder (25'inden sonra iletilen fatura sonraki ay). Sağlayıcı e-Fatura mükellefiyse ve Teserix de e-Fatura'ya geçtiyse e-Fatura, yoksa e-Arşiv. Bayilik sözleşmesi ıslak imzalı ve tutar içeriyorsa damga vergisi kontrol edilmeli.

---

## 5) Uygulamada abonelik takibi

Mevcut mimari (master.db + klinik başına SQLite, `clinicScope`, `sessions.get JOIN clinics`, `dispatchUnlocked` tek SMS çıkışı, `scheduler.tick + maybeBackup`) yeniden yapılandırma gerektirmez. `MASTER_MIGRATIONS` bugün 2 elemanlı (şema + parola/denetim); aşağıdaki blok 3. eleman (indeks 2) olur.

### Şema — MASTER_MIGRATIONS[2] (`/Users/thejackaltr/GitHub/veteriner-sms/src/db/master.js`)

```sql
ALTER TABLE clinics ADD COLUMN plan TEXT NOT NULL DEFAULT 'trial';                -- trial|baslangic|klinik|klinikplus
ALTER TABLE clinics ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial'; -- trial|active|past_due|suspended|cancelled
ALTER TABLE clinics ADD COLUMN billing_cycle TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE clinics ADD COLUMN price_cents INTEGER NOT NULL DEFAULT 0;            -- KDV hariç, kuruş
ALTER TABLE clinics ADD COLUMN trial_ends_at TEXT;
ALTER TABLE clinics ADD COLUMN next_invoice_at TEXT;                              -- her zaman ayın 1'i
ALTER TABLE clinics ADD COLUMN grace_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE clinics ADD COLUMN suspended_at TEXT;
ALTER TABLE clinics ADD COLUMN billing_name TEXT;  ALTER TABLE clinics ADD COLUMN tax_office TEXT;
ALTER TABLE clinics ADD COLUMN tax_number TEXT;    ALTER TABLE clinics ADD COLUMN billing_address TEXT;
ALTER TABLE clinics ADD COLUMN billing_email TEXT; ALTER TABLE clinics ADD COLUMN payment_code TEXT;
ALTER TABLE clinics ADD COLUMN iyzico_customer_ref TEXT; ALTER TABLE clinics ADD COLUMN iyzico_subscription_ref TEXT;
UPDATE clinics SET trial_ends_at = date(substr(created_at,1,10), '+14 days'),
                   payment_code = 'VET-' || upper(substr(id,1,6));

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  number TEXT NOT NULL UNIQUE,                 -- iç no TSX-2026-000001; YASAL fatura no DEĞİL
  period_start TEXT NOT NULL, period_end TEXT NOT NULL,
  plan TEXT NOT NULL, billing_cycle TEXT NOT NULL,
  amount_cents INTEGER NOT NULL, kdv_rate INTEGER NOT NULL DEFAULT 20,
  kdv_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','void')),
  due_at TEXT NOT NULL, issued_at TEXT, paid_at TEXT, voided_at TEXT,
  external_ref TEXT,                           -- GİB e-Arşiv / Paraşüt fatura no
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('havale','iyzico','nakit','mahsup')),
  notes TEXT, created_at TEXT NOT NULL, updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_period ON invoices(clinic_id, period_start) WHERE status <> 'void';
CREATE INDEX IF NOT EXISTS idx_inv_status ON invoices(status, due_at);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE RESTRICT,
  invoice_id INTEGER REFERENCES invoices(id), amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('havale','iyzico','nakit','mahsup')),
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','confirmed','rejected','refunded')),
  reference TEXT, reported_by TEXT, confirmed_by TEXT, received_at TEXT, created_at TEXT NOT NULL, raw TEXT
);
CREATE TABLE IF NOT EXISTS commission_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, period TEXT NOT NULL, clinic_id TEXT NOT NULL, provider TEXT NOT NULL,
  sms_sent INTEGER NOT NULL, sms_failed INTEGER NOT NULL,
  unit_price_cents INTEGER, commission_rate_bp INTEGER, commission_cents INTEGER, snapshot_at TEXT NOT NULL,
  UNIQUE(period, clinic_id, provider)
);
CREATE TABLE IF NOT EXISTS master_meta (key TEXT PRIMARY KEY, value TEXT);
```

Para daima kuruş/INTEGER (teserix-payment `money.ts` kuralı); `kdv_cents = Math.round(amount*rate/100)`. Plan sabitleri `src/billing/plans.js`. Uygulama **yasal fatura üretmez**; iç kayıt + `external_ref` tutar, klinik ekranı "proforma/ödeme bildirimi" etiketli `[teyit]` [10].

### Durum makinesi (`src/billing/state.js`, `assertTransition`)
```
trial     → active (ilk fatura paid) | past_due (trial_ends_at geçti, fatura kesildi) | cancelled (elle)
active    → past_due (fatura due_at geçti) | suspended (elle) | cancelled (elle)
past_due  → active (açık faturalar paid) | suspended (due_at + grace geçti) | cancelled (elle)
suspended → active (ödeme) | cancelled (suspended_at + 30 gün veya elle)
cancelled → active (yalnız süper yönetici "devam et")
```
`suspended`: `active=1` kalır, giriş serbest, yalnız `/abonelik*`, `/sifre`, `/cikis` açık; SMS durur. `cancelled`: mevcut `clinics.setActive(0)` davranışı (oturumlar silinir, tenant dosyası yerinde, silme yok).

### Zamanlayıcı (`src/billing/tick.js`, `scheduler.tick` içinde `maybeBackup` yanına)
Günde bir kez (`master_meta.billing_tick_date`), klinik başına ayrı `withTransaction`: (1) deneme bitişi → ilk fatura, past_due; (2) `next_invoice_at <= today` → dönem faturası (UNIQUE index idempotent); (3) `sent` + vade geçmiş → `overdue`, klinik past_due; (4) overdue + grace geçmiş → suspended; (5) suspended + 30 gün → cancelled. Ayın 1'inde `commission_reports` anlık görüntüsü. Deneme/gecikme uyarıları zamanlayıcısız: `clinicScope` her istekte `res.locals.billing` hesaplar, `header.ejs` `.warnbox` bandı basar (e-posta altyapısı yok).

Yaptırım noktaları: `auth.js sessionMiddleware` SELECT'ine abonelik sütunları; `clinic.js clinicScope` yönlendirme; `dispatch.js dispatchUnlocked` erken dönüş `{skipped:'askida'}` (test SMS dahil) + günlük tek audit; `scheduler.js` `clinics.billable()`.

### Ekranlar
- **Süper yönetici:** `/admin` listesine Plan · Durum rozeti · Sonraki fatura · Açık alacak; `/admin/klinik/:id` Abonelik kartı + faturalar + bekleyen ödeme bildirimleri; `POST .../abonelik | fatura | askiya-al | devam-et`; `POST /admin/fatura/:id/gonder | odendi | iptal | earsiv`; `POST /admin/odeme/:id/onayla | reddet`; `GET /admin/faturalar`, `/admin/gelir` (MRR, kesilen, tahsil, açık, geciken), `/admin/gelir.csv` (BOM + ';' — fatura_ic_no, unvan, VKN, vergi dairesi, adres, dönem, hizmet, KDV, toplam, durum, e-Arşiv no), `/admin/komisyon[.csv]`.
- **Klinik:** `GET /abonelik` (plan, dönem, kalan deneme günü, fatura geçmişi, IBAN + `payment_code`, "Ödeme bildir" formu — yalnız admin rolü), `POST /abonelik/odeme-bildir`, `GET /abonelik/fatura/:id` (proforma; "Bu belge mali fatura değildir").

### Tahsilat aşamaları
- **Aşama 1 (ilk 10 klinik):** havale/EFT + süper yönetici "ödendi" → payment confirmed + klinik active.
- **Aşama 2:** iyzico Abonelik — 1 ürün, 6 ödeme planı (3 plan × MONTHLY/YEARLY, RECURRING) `scripts/iyzico-plans.mjs` ile; `POST /abonelik/kart` checkout, `/abonelik/iyzico/donus` token ile retrieve (callback gövdesine güvenilmez), `POST /api/webhooks/iyzico` X-IYZ-SIGNATURE-V3 (HMAC-SHA256, eski V1/V2 imzalar desteklenmiyor); `subscription.order.success` → paid/active, `subscription.order.failure` → overdue/past_due [18]. teserix-payment'tan `iyzico.client.ts` (IYZWSv2 imza), `payment-state.ts` deseni, `safeEqualHex` taşınır (~0,5 gün) [19].

### Efor ve dosyalar
Aşama 1 ≈ 9 iş günü; Aşama 2 ≈ 5 gün; komisyon ≈ 1,5 gün. **Yeni:** `src/billing/{plans,state,service,tick,iyzico}.js`, `src/routes/subscription.js`, `views/subscription.ejs`, `views/admin_invoices.ejs`, `views/admin_revenue.ejs`, `views/admin_commission.ejs`, `views/partials/billing_band.ejs`, `test/billing.test.js`, `test/billing-http.test.js`, `scripts/iyzico-plans.mjs`, `docs/abonelik-ve-fatura.md`. **Değişen:** `src/db/master.js`, `src/db/tenant.js` (`countByProviderBetween`), `src/auth.js`, `src/routes/clinic.js`, `src/routes/admin.js`, `src/sms/dispatch.js`, `src/scheduler.js`, `src/app.js`, `src/config.js` (BILLING_IBAN, BILLING_ACCOUNT_NAME, IYZICO_*), `views/admin.ejs`, `views/admin_detail.ejs`, `views/partials/header.ejs`, `public/style.css`, `test/migrations.test.js`.

---

## 6) Abonelik sözleşmesi taslağı `[avukat teyidi]`

1. **Taraflar ve nitelik** — "İşbu sözleşme Teserix (Hizmet Sağlayıcı) ile ... Veteriner Kliniği (Müşteri) arasında akdedilmiştir. Müşteri mesleki/ticari faaliyeti kapsamında hareket ettiğini, 6502 sayılı Kanun anlamında tüketici olmadığını kabul eder."
2. **Hizmetin tanımı** — "Randevu ve aşı hatırlatma mesajlarının Müşteri'nin kendi SMS sağlayıcı hesabı üzerinden planlanmasını ve gönderimini sağlayan web tabanlı yazılımın kullanım hakkı."
3. **SMS bedeli ve sağlayıcı** — "SMS gönderim ücreti hizmet bedeline dahil değildir; Müşteri'nin İleti Merkezi/Netgsm hesabından sağlayıcı tarafından doğrudan Müşteri'ye faturalanır. Sağlayıcının teslim, gecikme ve kesintilerinden Hizmet Sağlayıcı sorumlu değildir."
4. **Paket, ücret ve KDV** — "Seçilen paket: ... Aylık bedel ... TL + KDV. Bedeller yıllık olarak TÜFE oranında güncellenebilir; güncelleme 30 gün önceden bildirilir."
5. **Deneme süresi** — "14 gün ücretsiz deneme; deneme sonunda ödeme yapılmazsa hizmet askıya alınır."
6. **Fatura ve ödeme** — "Hizmet dönemi takvim ayıdır. Fatura dönem sonunu izleyen 7 gün içinde e-Arşiv olarak düzenlenir. Ödeme vadesi fatura tarihinden itibaren 7 gündür. Yıllık peşin ödemede fatura ödeme tarihinde düzenlenir." `[muhasebeci teyidi]`
7. **Gecikme, askı ve fesih** — "Vade + 7 gün içinde ödenmeyen faturada SMS gönderimi durdurulur; panel ve veriler erişilebilir kalır. Askı tarihinden 30 gün sonra sözleşme feshedilmiş sayılır. Gecikme faizi 3095 sayılı Kanun m.2/2 uyarınca uygulanır."
8. **Süre ve otomatik yenileme** — "Sözleşme dönem sonunda aynı koşullarla kendiliğinden yenilenir. Taraflar 30 gün önceden yazılı bildirimle fesih hakkına sahiptir; yıllık peşin ödemelerde kullanılmayan aylar için iade yapılmaz." (iade politikası ticari tercih)
9. **Kişisel veriler (Ek-1: Veri İşleme Sözleşmesi)** — "Müşteri veri sorumlusu, Hizmet Sağlayıcı veri işleyendir (6698 m.3). Hizmet Sağlayıcı verileri yalnızca Müşteri'nin talimatı ve bu sözleşme amacıyla işler; alt işleyenler: SMS sağlayıcısı, barındırma sağlayıcısı. İhlal en geç 48 saat içinde Müşteri'ye bildirilir. Sözleşme sonunda veriler 30 gün içinde Müşteri'ye teslim edilir ve silinir."
10. **Ticari elektronik ileti** — "Hatırlatma mesajlarının 6563 sayılı Kanun'a uygun içerikte olması ve gerekli izinlerin alınması Müşteri'nin sorumluluğundadır."
11. **Hizmet seviyesi ve sorumluluk sınırı** — "Planlı bakım önceden duyurulur. Hizmet Sağlayıcı'nın sorumluluğu son 12 ayda ödenen bedelle sınırlıdır; dolaylı zararlar hariçtir."
12. **Bildirimler** — "Bildirimler kayıtlı e-posta adresine yapılır; temerrüt ve fesih ihtarları tacir Müşteri için KEP/noter/taahhütlü mektupla yapılır (TTK 18/3)."
13. **Kabul şekli** — "Sözleşme web üzerinden 'Okudum, kabul ediyorum' onayı ile kurulur; onay zaman damgası ve IP kaydı saklanır." (güvenli e-imza kullanılmadığı için damga vergisi doğmaması amaçlanır)
14. **Uygulanacak hukuk ve yetki** — "Türk hukuku; İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri yetkilidir."

---

## 7) İlk 90 gün planı

**0-30 gün — kurumsal:**
- SMMM ile görüşme: şahıs/işletme hesabı mı, genç girişimci şartları (400.000 TL, 3 yıl; Bağ-Kur desteği yok), e-Arşiv tarihi, 500 bin TL internet satış eşiği, yıllık peşin fatura modu `[teyit]`.
- Vergi dairesi işe başlama bildirimi (genç girişimci için süresinde), NACE kodu yazılım hizmeti; Bağ-Kur durumu netleştir.
- Ticari banka hesabı (IBAN, açıklama kodu düzeni); GİB e-Belge Portalı hesabı; interaktif vergi dairesi.
- Avukata sözleşme + KVKK eki taslağı; VERBİS gerekip gerekmediği (veri işleyen olarak) sorulur.
- Netgsm bayilik başvurusu; İleti Merkezi'ne iş ortaklığı e-postası.

**0-30 gün — ürün:** Migrasyon 3, `state/tick`, askı yaptırımı, `/abonelik`, süper yönetici fatura ekranları, gelir.csv, testler (Aşama 1, ≈9 gün). Fiyat sayfası + "Ayda kaç SMS?" hesaplayıcı.

**31-60 gün:** İlk 10 kurucu klinik (yakın çevre): 14 gün deneme → havale; ilk faturaları GİB portalından kes; her fatura için `external_ref`; SMMM ile ilk KDV beyannamesi. Muhasebeci geri bildirimiyle CSV sütunlarını Paraşüt şablonuna eşle.

**61-90 gün:** iyzico başvurusu (vergi levhası, imza beyannamesi, kimlik, banka belgesi, web sitesi; anlaşmalı oran pazarlığı); sandbox'ta Aşama 2; ilk komisyon raporu ve sağlayıcıyla mutabakat; fiyat testi (paket karması, yıllık oranı); 30 klinik hedefi için e-Fatura/entegratör kararı.

---

## 8) Riskler ve bilinmeyenler

- **Genç girişimci istisna tutarı:** GİB 2026 duyurusu 400.000 TL diyor (GVK mük. 20: tarifenin ikinci dilimi); "≈430.000 TL" yazan ikincil kaynaklar hatalı — çelişki çözüldü. Bağ-Kur prim desteği 7566 s.K. (RG 19.12.2025) ile 1.1.2026'dan itibaren mükellefiyet tesis edenler için kaldırıldı `[teyit]` [2].
- **SaaS = "internet üzerinden hizmet satışı"** (500 bin TL e-Fatura eşiği) için özelge **bulunamadı**; kapsamda varsayıldı [11].
- **İleti Merkezi komisyonu** ve Netgsm oranı kamuya açık değil; komisyon geliri %10-20 tamamen varsayım. Kliniğin aldığı paket büyüklüğüne göre SMS birim fiyatı 4 kat değişiyor (0,09-0,38 TL); komisyon tahmini buna çok duyarlı.
- **iyzico gerçek oranı:** resmi liste %4,29 + 0,25 TL (+%5 BSMV); üçüncü taraf sitelerdeki %1,95-3,99 pazarlıklı/taksit oranları teklifle netleşir. Abonelik ürünü 199 TL/ay ve "ilk 3 ay ücretsiz" resmi sayfada doğrulandı (6 Eylül 2026) [13].
- **Bağ-Kur** (≈10,2-11,8 bin TL/ay) 10 klinik ölçeğinde modeli eksiye çevirir; başka işte 4/a sigortalı olup olmadığın belirleyici [5].
- **Rakip fiyatları** çoğunlukla teklife dayalı; Kolayvet KDV dahil/hariç belirsiz; BulutVet KDV hariç.
- **Churn** Türkiye veteriner SaaS'ı için veri yok; uluslararası benchmark kullanıldı (SMB aylık %2-8 arası geniş bant).
- **DLR yok:** sms_log "sent" sağlayıcı kabulüdür; komisyon mutabakatında fark çıkabilir.
- **E-posta altyapısı yok:** ödeme hatırlatmaları yalnız panel bandıyla; kliniğin SMS hesabından fatura hatırlatması gönderilmez.
- **B2B'de 6502'nin uygulanmadığına** dair içtihat doğrudan bulunamadı; m.3 tanımından çıkarım.
- **Meta/Google reklamı** yapılırsa %15 stopaj (476 s. CBK, 1.1.2019 sonrası ödemeler; ÇVÖA nedeniyle yargıda tartışmalı) + 2 no'lu KDV sorumluluğu; ilk 10 klinikte reklam gerekmeyebilir [26].
- **Hetzner fiyatı:** CX23 için kaynaklar €3,99 (Nisan 2026 yazısı) ile €5,49 (Ağustos-Eylül 2026 karşılaştırma siteleri) arasında; hesapta €5,49 kullanıldı. Hetzner Türkiye'ye KDV'siz fatura keser; 2 no'lu KDV sorumluluğu ve indirimi `[teyit]` [31].
- **Veteriner muayene ücreti:** 1.750 TL 2026 İVHO alt sınırı; daha yüksek "2.500 TL" iddiası kaynaklarda **bulunamadı** [29].

---

## 9) Kaynaklar

1. 332 Seri No'lu GVK Genel Tebliği (2026 tarifesi: 190.000 / 400.000 / 1.000.000 / 5.300.000 TL dilimleri, %15-40): https://www.alomaliye.com/2025/12/31/gelir-vergisi-genel-tebligi-seri-no-332-gvk-332/
2. GİB 2026 genç girişimci duyurusu (2026 istisna 400.000 TL; sigorta prim teşviki yürürlükten kaldırıldı): https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=DUYURU/UNIVERSAL/2026/2026_genc_girisimciler_info.pdf ; 7566 s.K. ile Bağ-Kur desteğinin kaldırılması (RG 19.12.2025, 33112): https://vergimerkezi.com.tr/genc-girisimci-bagkur-destegi-kaldirildi-2026/ ; Ltd ortağı kapsam dışı (sayfa 403 verdi, doğrulanamadı): https://www.muhasebenews.com/genc-girisimci-istisnasindan-limited-sirket-ortaklari-faydalanabilir-mi/
3. Kâr payı stopajı %15 (9286 s. CBK, RG 22.12.2024 / 32760): https://www.resmigazete.gov.tr/eskiler/2024/12/20241222-15.pdf ; https://kpmgvergi.com/yayinlar/mali-bultenler/vergi/9286-sayili-cumhurbaskani-karari-ile-kar-payi-stopaj-orani-15-e-cikarildi/2893 ; asgari sermaye 50.000 TL (1.1.2024): https://icticaret.ticaret.gov.tr/haberler/anonim-ve-limited-sirketlerde-asgari-sermaye-tutarlari-artirilmistir ; kuruluş maliyeti 2026 (30.000-42.500 TL): https://www.parasut.com/blog/limited-sirket-kurulus-maliyetleri
4. 2026 SMMM asgari ücret tarifesi: https://www.alomaliye.com/2025/12/17/2026-yili-sm-smmm-ymm-asgari-ucret-tarifesi/ ; İstanbul tarifesi (işletme hesabı işçisiz 3.593 TL; bilanço 1. kademe 7.985 TL): https://vergimerkezi.com.tr/wp-content/uploads/2025/12/2026-Istanbul-SMMM-Ucret-Tarifesi.pdf
5. Bağ-Kur 2026 primi (10.156,73 TL indirimli / 11.808,23 TL indirimsiz; asgari ücret 33.030 TL): https://www.uyumsoft.com/blog/bag-kur-primi-2026-ne-kadar-nasil-hesaplanir
6. Basit usul 2026 hadleri (hizmet 600.000 TL): https://www.pluxee.com.tr/blog/basit-usulde-vergilendirme-hadleri/ ; GVK mük. 20/A basit usul kazanç istisnası: https://www.fatiharas.com/gvk-madde-mukerrer-20-a-basit-usulde-vergi-istisnasi/
7. KDV %20 (7346 s. CBK, RG 07.07.2023 / 32241, yürürlük 10.07.2023): https://www.resmigazete.gov.tr/eskiler/2023/07/20230707-11.pdf ; https://www.alomaliye.com/2023/07/07/katma-deger-vergisi-oranlari-karar-sayisi-7346/ ; yazılım hizmeti özelgesi: https://www.verginet.net/dtt/11/ozelge-2024-12.aspx?ozID=3929
8. VUK 177 defter hadleri 2026 (588 Tebliğ; hizmet hasılatı 1.200.000 TL): https://cdn.gib.gov.tr/api/gibportal-file/file/getFileResources?objectKey=arsiv%2Fyardim-kaynaklar%2Fyararli-bilgiler%2Fdeftertutmahadleri.pdf ; https://www.mikro.com.tr/defter-hadleri-nelerdir/
9. VUK 231/5 fatura süresi: https://www.alomaliye.com/2026/01/08/vergi-usul-kanunu-kapsaminda-fatura-duzenlenmesinde-7-gun-suresi-karmasasi/ ; avans/peşin fatura (bu turda açılamadı): https://www.gulbenkmusavirlik.com/tr_erken-odeme-veya-avanslarda-faturanin-duzenlenme-zamani-ve-vergilendirilecegi-donem-hk-2373.html
10. 589 Sıra No'lu VUK Tebliği / e-Arşiv 2026 (TÜRMOB): https://www.turmob.org.tr/ekutuphane/Read/9208c1d3-f311-468d-9dd7-0d50a202bd6c ; RG: https://www.resmigazete.gov.tr/eskiler/2025/12/20251231M5-32.pdf ; GİB e-Belge: https://ebelge.gib.gov.tr/anasayfa.html
11. e-Fatura eşikleri (509 Tebliğ; 3 milyon TL genel, 500 bin TL internet satışı): https://www.asmmmo.org.tr/userfiles/others/files/Mvzt/Gh/24/12-08-Vergi%20Usul%20Kanunu%20Genel%20Tebli%C4%9Fi%20(S%C4%B1ra%20No%20509).pdf ; https://finrota.com/blog/2026-e-fatura-zorunluluk-limitleri-ve-gecis-rehberi ; https://www.mikro.com.tr/internet-uzerinden-satis-yapanlarda-e-fatura-zorunlulugu-nedir/
12. Paraşüt fiyatları (e-Portal 1.800 TL+KDV tek seferlik; e-Fatura + ön muhasebe 940 TL+KDV/ay): https://www.parasut.com/on-muhasebe-fiyatlari ; e-fatura maliyeti (mali mühür 1.450 TL+KDV, kontör paketleri): https://www.parasut.com/kullanim-kilavuzu/elektronik-fatura-hizmetinin-maliyeti
13. iyzico Abonelik (199 TL/ay, ilk 3 ay ücretsiz): https://www.iyzico.com/abonelik ; fiyatlandırma (%4,29 + 0,25 TL kurumsal): https://www.iyzico.com/destek/yardim-merkezi/genel-bilgiler/fiyatlandirma ; üçüncü taraf oranlar: https://poskomisyon.com/pos/iyzico-sanal/ ; başvuru koşulları ve evraklar: https://www.iyzico.com/destek/yardim-merkezi/basvuru ; https://www.iyzico.com/destek/yardim-merkezi/basvuru/gerekli-evraklar ; haftalık hakediş: https://www.iyzico.com/destek/yardim-merkezi/uye-is-yeri-odemeleri/odemeler ; PayTR (%2,19 promosyon, Abonelik Yönetimi): https://www.paytr.com/
14. 6502 s.K. m.3: https://mevzuat.gov.tr/mevzuatmetin/1.5.6502.pdf ; https://www.lexpera.com.tr/mevzuat/kanunlar/tuketicinin-korunmasi-hakkinda-kanun-6502
15. TTK 18/3 ihtar şekli: https://demirbas.av.tr/tacirler-arasinda-temerrude-sozlesmeyi-feshe-sozlesmeden-donmeye-iliskin-ihbar-veya-ihtarlarin-sekli/
16. Damga vergisi 2026 (binde 9,48; azami 29.115.961,10 TL): https://www.mikro.com.tr/damga-vergisi-oran-ve-tutarlari/ ; internet sözleşmeleri (güvenli e-imza yoksa damga vergisi yok): https://www.dunya.com/gundem/internette-yapilan-sozlesmelerde-damga-vergisi-haberi-212969
17. KVKK 6698: https://www.kvkk.gov.tr/Icerik/6649/6698-Sayili-Kanun ; veri güvenliği rehberi: https://www.kvkk.gov.tr/yayinlar/veri_guvenligi_rehberi.pdf ; DPA: https://blog.lexpera.com.tr/kisisel-veri-isleme-sozlesmesi/
18. iyzico abonelik API (yalnız kredi kartı; 160 gün retry): https://docs.iyzico.com/urunler/abonelik/abonelik-entegrasyonu ; https://docs.iyzico.com/urunler/abonelik/abonelik-entegrasyonu/abonelik-islemleri ; webhook (subscription.order.success/failure, X-IYZ-SIGNATURE-V3 HMAC-SHA256): https://docs.iyzico.com/ek-servisler/webhook ; kart saklama: https://docs.iyzico.com/ek-servisler/kart-saklama
19. teserix-payment: /Users/thejackaltr/GitHub/teserix-payment/apps/api/src/modules/providers/iyzico/iyzico.client.ts ; /Users/thejackaltr/GitHub/teserix-payment/apps/api/src/modules/payments/payment-state.ts ; /Users/thejackaltr/GitHub/teserix-payment/packages/shared/src/money.ts
20. Kolayvet fiyatlar: https://www.kolayvet.com/fiyatlar
21. BulutVet fiyatlar: https://bulutvet.com/fiyatlar
22. Rakipler: https://evetsmart.com/tr ; https://www.pratikvet.com/ ; https://vetran.com.tr/ ; https://selfvet.com/paketler.php ; https://www.doldurkabi.com/veteriner-yazilimi ; https://fugevet.com/blogv2/veteriner-yazilimi-secim-rehberi-2025-fiyat-ozellik-karsilastirma/
23. Komşu sektör: https://www.kuaforasistan.com/kuafor-randevu-programi (419 TL/ay) ; https://piyzi.com/blog/randevu-programi-fiyatlari-2026/ (999 TL/ay; pazar 700-3.500) ; https://dentalasistanim.com/ (1.200 TL+KDV/ay, yıllık 12.000 TL+KDV) ; https://dentsoft.com.tr/pricing
24. Netgsm bayilik: https://www.netgsm.com.tr/bayilik/
25. Komisyon faturalarında KDV: https://www.alomaliye.com/2025/12/16/e-ticaretteki-komisyon-faturalarinda-kdv/
26. Meta reklam KDV/stopaj: https://www.muhasebenews.com/yurt-disindaki-google-meta-facebook-alinan-reklam-hizmetlerde-vergilendirme-fatura-stopaj-ve-kdv-uygulamasi/ ; 476 s. CBK: https://vergidosyasi.com/2019/12/24/internet-ortaminda-reklam-hizmetinde-stopaja-iliskin-cumhurbaskani-karari-476-sayili/
27. İleti Merkezi fiyatları (500 SMS 189 TL = 0,378; 10.000 SMS 1.599 TL = 0,160; yeni abone 10.000 SMS 879 TL = 0,088; 1M SMS 0,074; KDV+ÖİV dahil): https://www.iletimerkezi.com/toplu-sms-fiyatlari
28. Netgsm SMS fiyatları (500 SMS 198 TL = 0,396; 1.000 SMS 370 TL; yeni abone 10.000 SMS 899 TL = 0,090; 1M SMS 0,081; KDV+ÖİV dahil): https://www.netgsm.com.tr/fiyatlar/toplu-sms
29. Veteriner muayene ücretleri 2026 (İVHO alt sınır 1.750 TL): https://vetart.com.tr/veteriner-ucretleri/ ; https://www.vetsaglik.com/post/2026ii-stanbul-veteriner-%C3%BCcretleri-2026-veteriner ; (403 verdi) https://www.petzzshop.com/blog/veteriner-klinikleri-ucret-tarifesi
30. SaaS churn/indirim benchmark: https://livmo.com/blog/saas-churn-benchmarks-valuation/ (SMB aylık %2-4) ; https://baremetrics.com/blog/annual-vs-monthly-pricing-better-retention (yıllık plan ≈3 kat düşük churn; indirim %10-25, en yaygın %17) ; https://pmtoolkit.ai/benchmarks/churn-rate-benchmarks (SMB aylık %3-8)
31. Hetzner fiyatları (CX23 €5,49; IPv4 +€0,50; yedek +%20): https://costgoat.com/pricing/hetzner ; https://www.vpsbenchmarks.com/hosters/hetzner/plans/cx23 ; Türkiye'ye KDV uygulanmaz: https://docs.hetzner.com/general/billing-and-account-management/billing-at-hetzner/value-added-tax/ ; TCMB kur (4.9.2026 EUR satış 56,1581): https://www.tcmb.gov.tr/kurlar/today.xml
32. Depo: /Users/thejackaltr/GitHub/veteriner-sms/docs/ileti-merkezi-bayilik-yolu.md ; /Users/thejackaltr/GitHub/veteriner-sms/docs/saglayici-karsilastirmasi.md ; /Users/thejackaltr/GitHub/veteriner-sms/docs/pazara-cikis-hazirlik-raporu.md ; /Users/thejackaltr/GitHub/veteriner-sms/src/db/master.js ; /Users/thejackaltr/GitHub/veteriner-sms/src/sms/dispatch.js ; /Users/thejackaltr/GitHub/veteriner-sms/src/scheduler.js