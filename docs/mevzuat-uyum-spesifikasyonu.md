# Mevzuat uyumu — uygulamada yapılanlar ve kalanlar

Tarih: 2026-09-14. Kapsam: veteriner-sms'in Türkiye'de bir şirket ürünü olarak satılması. Bu belge bir hukuk görüşü değil, doğrulanmış mevzuat hükümlerinin koda nasıl yansıtıldığının kaydıdır. "[yorum]" işaretli yerler mevzuat metninden doğrudan çıkmayan çıkarımlardır; "[avukat]" işaretli yerler yayına alınmadan önce avukat teyidi ister.

Doğrulama yöntemi: altı boyutta (6563/İYS, KVKK işletimsel, veteriner mevzuatı, e-ticaret/sözleşme, soğuk pazarlama, kod boşlukları) 150 iddia üretildi; her biri mevzuat.gov.tr, resmigazete.gov.tr, kvkk.gov.tr ve apidocs.iys.org.tr birincil metinleri indirilerek çürütme turundan geçirildi. Yanlış çıkan 40'a yakın iddia (yanlış madde numarası, mülga fıkra, yorumun hüküm gibi sunulması, güncel olmayan ceza tutarı) bu belgeye alınmadı.

## 1. Karar özeti

Lansman için uygulamada zorunlu olan ve **yapılan** şeyler:

| # | Yükümlülük | Dayanak | Uygulamadaki karşılığı |
|---|---|---|---|
| 1 | Her SMS'te gönderen kimliği: tacir → MERSİS; esnaf → ad-soyad + TCKN/VKN | Ticari İletişim ve Ticari Elektronik İletiler Hk. Yön. m.8/3 | `src/sms/policy.js` `identityLine`; Ayarlar › Hukuki kimlik; kimlik yoksa `dispatch` kilitli (`skipped:'legal'`) |
| 2 | Her SMS'te erişilebilir iletişim bilgisi | Yön. m.8/5 | Klinik telefonu kuyruğa eklenir; boşsa kilit |
| 3 | Niteliği anlaşılmıyorsa başta "bilgilendirme" ibaresi | Yön. m.8/6 (koşullu) | Her ileti "Bilgilendirme:" ile başlar |
| 4 | Her iletide ret imkânı; aynı kanaldan, kolay, ücretsiz; rette özgülenmiş URL kabul | Yön. m.9/3, m.9/4 | `Iptal: <origin>/ret/<klinik>.<belirteç> Tel:<klinik>`; `GET/POST /ret/:token` oturumsuz, tek tık |
| 5 | Ret 3 iş günü içinde uygulanır | Yön. m.10/1 | Anında uygulanır (`owners.sms_opt_in=0`); panelden ret düğmesi personel için de açık |
| 6 | Onay/ret ispatı hizmet sağlayıcıda | Yön. m.7/10, m.13/1 | `consent_events` (tarih, kanal, not, kullanıcı, IP) — oluşturma, düzenleme, hızlı kayıt, içe aktarma, ret URL'si, panel |
| 7 | m.6/1 istisnasının maddi dayanağı: iletişim bilgisi hasta sahibince verildi; ileti bakım bilgilendirmesi | Yön. m.6/1, m.6/5, m.11/8 | Klinik beyanı (`m61_declared_at`, denetim kaydı); içe aktarmada zorunlu beyan adımı; `sms_log.legal_basis='m6_1'`, `iys_flag='0'` |
| 8 | İçerik istisnayı bozamaz; veteriner reklam yasağı; ilaç ticari adı; meslek sırrı | Yön. m.6/1 sınırı, m.5/1; 6343 m.9 ve m.41/b-h; TVHB Uyg. Yön. m.97, m.98, m.68; VTÜ Yön. m.37/1 | `templateProblems` / `contentProblems`: şablon ve hatırlatma başlığı kaydedilirken engellenir; değişken beyaz listesi |
| 9 | SMS kayıtları en az 3 yıl; iş/işlem kayıtları 10 yıl; KVKK saklama sınırlılığı | Yön. m.13/2; 6563 m.11/3; KVKK m.4/2-d, m.7 | `src/retention.js`: kişisel alanlar ≥1095 gün sonra anonimleştirilir, satır kalır; süre klinikçe uzatılabilir, kısaltılamaz |
| 10 | Periyodik imha ve imha kaydı (≥3 yıl) | İmha Yön. m.11/3, m.7/3 | Günlük tur; `imha_log` (tenant) asla silinmez; master `audit_log` 3 yıl sonra maskelenir; `retention.run` denetim satırı |
| 11 | İlgili kişi hakları: erişim, düzeltme, silme; 30 gün | KVKK m.11, m.13/2; Başvuru Tebliği m.6/5 | `/sahipler/:id/veri.json|csv`, `/anonimlestir`, `/sil` (sms_log kalıntısı temizlenir); `/basvurular` (30 günlük vade, gecikme rozeti, nav sayacı) |
| 12 | Aydınlatma: Teserix→kullanıcı ve klinik→hasta sahibi; ispat veri sorumlusunda | KVKK m.10; Aydınlatma Tebliği m.4, m.5/1-e | `/belgeler/aydinlatma-teserix` (nihai); `/aydinlatma/<kısa ad>` klinik bilgileriyle dolan şablon; Ayarlar'da bağlantı |
| 13 | Hizmet sağlayıcı kimlik bilgileri sitede | 5651 m.3; 6563 m.3 | `/iletisim` (COMPANY_* ortam değişkenleri); footer bağlantıları |
| 14 | Sözleşme kabulünün ispatı; genel işlem koşulları; ayrı onaylar | TBK m.21, m.24; Kurul 2025/1072 | `legal_acceptances` (kullanıcı, sürüm, SHA-256, tarih, IP, tarayıcı); `legalAcceptanceGate`; iki ayrı kutu, metin gömülü |
| 15 | Veri işleyen sözleşmesi (tavsiye, ticari olarak şart) | Rehber §2.5 | `docs/legal/veri-isleyen-eki-v1.md`; kabul kapısında ayrı onay |
| 16 | Veri ihlali: 72 saat; veri işleyen gecikmeksizin bildirir; kayıt altına alınır | KVKK m.12/5; Kurul 2019/10 | `/admin/ihlaller` (breaches tablosu, üç bildirim zaman damgası, 72 saat rozeti) |
| 17 | Erişim kayıtları; yetki matrisi | Rehber §3.1, §3.2, Tablo 4.1 | `owner.view / owner.search / sms.view / owner.export` denetim satırları; Ayarlar'da matris; `docs/yetki-matrisi.md` |
| 18 | Yedekler ağ dışında, şifreli | Rehber §3.6, §3.3 | `BACKUP_SECONDARY_DIR` + `BACKUP_KEY` (AES-256-GCM, APP_SECRET'ten ayrı); `scripts/restore.js`; `service.sh status` FileVault kontrolü |
| 19 | Çerez: yalnızca zorunlu oturum çerezi → rıza yok, bildirim var | Çerez Rehberi §5.2 | `/belgeler/cerez`; kalıcı "beni hatırla" çerezi yok |
| 20 | Ek-4 kayıt alanları (sahip adresi, mikroçip) | Muayenehane Yön. m.17/1-b; Kimliklendirme Yön. m.4/h | `owners.address`, `pets.microchip_no` (15 hane doğrulaması); CSV'de sütunlar. Uygulama defterin yerine geçmez (sözleşme m.2) |

**İYS entegrasyonu yapılmadı, gerekmiyor:** hatırlatma iletileri m.6/1 kapsamında olduğu sürece m.6/5 uyarınca İYS kontrolü yapılmaz ve `iys:"0"` m.11/8'in aradığı beyandır. Kampanya/tanıtım içeriği bu kapsamı bozar; sistem bunu şablon düzeyinde engeller. Tanıtım SMS'i istenirse ayrı bir ürün kararıdır: klinik İYS'ye marka olarak kaydolur, onaylar İYS'ye yüklenir, gönderim `iys:"1"` + `iysList` ile yapılır.

## 2. Aşı hatırlatması ticari elektronik ileti mi?

**Evet, nitelendirme olarak.** Yön. m.4/1-o tanımı ("...kısa mesaj hizmeti gibi vasıtalar kullanılarak ... ticari amaçlarla gönderilen ... iletiler") kliniğin hasta sahibine gönderdiği hatırlatmayı kapsar; m.2/2'deki beş kapsam dışı hâl veteriner kliniğine uymaz.

**Onay gerekmemesinin dayanağı m.6/1:** "Alıcının kendisiyle iletişime geçilmesi amacıyla iletişim bilgilerini vermesi hâlinde, temin edilen mal veya hizmetlere ilişkin değişiklik, kullanım ve bakıma yönelik ticari elektronik iletiler için ayrıca onay alınmaz." Aşı rapelinin "bakıma yönelik" olduğu güçlü ama **yorumdur**; Ticaret Bakanlığı'nın, İYS'nin veya bir mahkemenin bunu teyit eden yayımlanmış bir kararı bulunamadı. Karşı argüman: her aşı yeni bir hizmet satışıdır. `[avukat]`

Uygulama iki senaryoya da dayanıklı kurgulandı:
- **Senaryo A (m.6/1 geçerli):** onay yok, İYS yok; kimlik + ret + içerik sınırı (bugünkü tasarım).
- **Senaryo B (m.6/1 geçersiz sayılır):** onay ve İYS gerekir. Bu durumda `consent_events` tablosu zaten onay kanıtını (tarih, kanal, kullanıcı, IP) İYS'nin `consent` şemasına eşlenebilir biçimde tutar; eksik olan yalnızca İYS API bağlantısı ve `iys:"1"` gönderimidir (tahmini 3–5 gün iş). Not: İYS `consent/create` üç günden eski onay kabul etmez; geçmiş kayıtlar toplu yüklenemez.

## 3. Yapılan şema ve rota değişiklikleri

Tenant migrasyon 3: `owners.address`, `owners.opt_out_token`, `pets.microchip_no`, `sms_log.{legal_basis, iys_flag, identity_used, anonymized_at}`, tablolar `consent_events`, `subject_requests`, `imha_log`. Ayarlar: `legal_form, mersis_no, tax_id, ruhsat_isim, kvkk_contact_email, kvkk_contact_phone, m61_declared_at, retention_sms_days, notice_version`.

Master migrasyon 3: `clinics.public_slug`, tablolar `legal_acceptances`, `breaches`.

Yeni rotalar: oturumsuz `/belgeler/:slug`, `/iletisim`, `/aydinlatma/:slug`, `/ret/:token`; klinik `/basvurular`, `/sahipler/:id/{ret,veri.json,veri.csv,anonimlestir}`, `/sozlesme`; süper yönetici `/admin/ihlaller`.

Yeni dosyalar: `src/sms/policy.js`, `src/retention.js`, `src/legal.js`, `src/routes/public.js`, `src/routes/legal.js`, `docs/legal/*.md`, `scripts/restore.js`, testler `test/policy.test.js`, `test/retention.test.js`, `test/uyum.test.js`.

## 4. Saklama ve imha tablosu

| Veri | Süre | Yöntem | Nerede |
|---|---|---|---|
| Hasta sahibi, hayvan, hatırlatma | Hizmet ilişkisi sürdükçe; klinik sildiğinde / anonimleştirdiğinde; abonelik bitince 30 gün sonra | Silme (CASCADE) veya anonimleştirme | `owners.anonymize`, `/sahipler/:id/sil` |
| sms_log kişisel alanları (telefon, mesaj, ad) | `retention_sms_days` (≥1095; Yön. m.13/2) | Anonimleştirme, satır kalır (6563 m.11/3 on yıl) | `src/retention.js` günlük |
| sms_log satırı (tarih, durum, sağlayıcı ref, dayanak) | 10 yıl `[yorum: 6563 m.11/3 "iş ve işlem kayıtları"]` | Silinmez (bu sürümde) | — |
| consent_events | Sahip silinince CASCADE; aksi halde sms_log ile aynı `[avukat: onay kaydı "geçerliliğin sona erdiği tarihten itibaren 3 yıl", m.13/2]` | — | — |
| subject_requests | 3 yıl `[yorum]` | Elle | — |
| imha_log | Süresiz (≥3 yıl, İmha Yön. m.7/3) | Silinmez | — |
| audit_log (master) | Olay kaydı kalır; 3 yıl sonra kullanıcı e-postası ve IP maskelenir | Maskeleme | `auditLog.maskOlderThan` |
| legal_acceptances, breaches | 10 yıl (6563 m.11/3) / süresiz | Silinmez | — |
| sessions | Süre dolunca | Silme | `sessions.purgeExpired` |
| Yedekler | 14 gün (`BACKUP_RETENTION_DAYS`), ikinci hedefte de aynı | Klasör silme | `pruneOldBackups` |

Periyodik imha, İmha Yön. m.11/3 ("politika yükümlülüğü olmayan veri sorumlusu ... üç ay içinde") gereksiniminin çok altında, günlük çalışır.

## 5. Pazarlama kanal kuralları (9.344 klinik listesi) — uygulama kapsamı dışı

| Kanal | Yapılabilir mi | Şartlar |
|---|---|---|
| Yüz yüze ziyaret, kartvizit, basılı posta | Evet | 6563 kapsamı dışı (Yön. m.2/1 elektronik araçlarla sınırlı). Kartvizit CRM'e girilirse ilk iletişimde aydınlatma (Aydınlatma Tebliği m.6/1-b) |
| E-posta | Evet, tacir/esnaf olduğu doğrulanmış kliniklere | m.6/3 onay muafiyeti; **ama m.6/6 gereği adres İYS'ye kaydedilir ve ret kontrolü yapılır** (m.6/5 üçüncü fıkrayı kapsamaz; m.17/A yalnızca aracının yükümlülüğünü kaldırır); m.8/2 kimlik, m.8/6 konu satırında "Tanıtım", m.9 ret imkânı |
| Telefonla arama | Evet, aynı şartlarla | m.4/1-o kapsamda; ARAMA kanalında İYS ret kontrolü; m.8/4 ticaret unvanı; m.8/6 görüşme başında nitelik |
| SMS | Pratikte hayır | Bakanlık listesinde telefonlar maskeli; alternatif kaynaklar cep ağırlıklı (hekimin kişisel cebi = tacir/esnaf adresi değil `[yorum]`); toplu gönderimde m.12/2 ceza on kata kadar |
| KVKK boyutu | Dikkat | Kamuya açık veri alenileştirme sayılmaz: Kurul 2022/861 (150.000 TL) iş e-postasına pazarlama; Uygulama Rehberi s.77. Veteriner hekimlerde Avukatlık Kanunu m.11 benzeri tacirlik yasağı yok — savunma farklı ama risk sürer. m.5/2-f meşru menfaat dengesi yazılı yapılmalı |

Teserix'in kendisi ticari ileti gönderecekse İYS'ye hizmet sağlayıcı olarak kaydolur (m.5/2) ve ret listesi tutar.

## 6. Kod dışında yapılacaklar (kullanıcı adımları)

1. `.env`: `COMPANY_*` alanları (unvan, VKN/MERSİS, adres, e-posta, telefon, KEP). Şirket türü kararı: şahıs (esnaf) mı, limited (tacir) mi — `COMPANY_LEGAL_FORM`.
2. **KEP adresi** alın: 6563 m.3 iletişim bilgisi, TTK m.18/3 ihtarlar, olası ETBİS kaydı.
3. `.env`: `BACKUP_KEY` (openssl rand -base64 48) ve `BACKUP_SECONDARY_DIR` (ayrı disk/USB); FileVault açık; `deploy/mac-mini/service.sh status` ile doğrulayın.
4. Hukuki metinleri (`docs/legal/*.md`) avukata okutun; sürüm değişirse `src/legal.js` MANIFEST'te sürümü artırın — klinik yöneticileri yeniden kabul eder.
5. Online sipariş akışı eklenmeyecek (karar). Eklenirse ETBİS kaydı (Tebliğ m.5/1), 2022 Yönetmeliği m.5/7/8/9 (işlem rehberi, sipariş teyidi, KEP/MERSİS/oda bilgisi) devreye girer.
6. e-Arşiv fatura: 1.1.2026'dan itibaren tutar sınırı olmaksızın zorunlu (VUK 509 GT IV.2.4.3); işletme hesabı esasında 1.1.2027. `docs/abonelik-ve-faturalama-duzeni.md` uygulanır.
7. VERBİS: klinikler büyük olasılıkla muaf (yıllık çalışan < 50 ve bilanço < 100 milyon TL; Kurul 2023/1154). Teserix için de aynı eşikler; muafiyet KVKK'dan muafiyet değildir.
8. Her klinik açılışında: yönetici sözleşmeyi kabul eder → Ayarlar › Hukuki kimlik doldurulur → aydınlatma bağlantısı kayıt formuna/QR'a konur.

## 7. Avukata sorulacaklar

1. Aşı/kontrol hatırlatması Yön. m.6/1 "bakıma yönelik" kapsamında mı? (Ürünün onay/İYS'siz çalışmasının tek dayanağı.)
2. Teserix 6563 m.2/1-d anlamında "aracı hizmet sağlayıcı" mı? (m.11 ve m.12 yükümlülük/ceza muhatabı olup olmadığı.)
3. Rette "aynı kanal" şartı (m.9/3 ikinci cümle): SMS'e URL + telefon yeterli mi, kısa numara gerekli mi?
4. sms_log satırını 10 yıl tutmak (6563 m.11/3) ile KVKK m.4/2-d arasındaki gerilim: anonimleştirilmiş satır çözümü yeterli mi?
5. Hayvan sağlık verisi hasta sahibinin özel nitelikli verisi sayılabilir mi? (Kurul kararı yok; rehber köpek gibi kenar durumlar.)
6. Klinik–Teserix ilişkisinde veri işleyen ekinin GDPR m.28 benzeri unsurları yeterli mi; Kurul'un beklediği ek bir husus var mı?
7. Cloudflare Tunnel açılırsa TLS'in ABD şirketinde sonlanması KVKK m.9 aktarımı doğurur mu? (Bugün Tailscale Funnel, TLS cihazda.)
8. Abonelik sözleşmesindeki sorumluluk sınırı ve delil sözleşmesi maddeleri tacir olmayan (esnaf) klinikler için geçerli mi?

## 8. Doğrulanamayanlar

- Bakanlık/İYS'nin aşı hatırlatmasını m.6/1 kapsamında saydığına dair yayımlanmış karar (bulunamadı).
- Koordinasyon Kurulu meslek kolları listesinde veteriner hekimliğin esnaf sayılıp sayılmadığı (taranmış PDF, okunamadı).
- KVKK 2026 ceza tablosu doğrulandı (85.437–1.709.200 / 256.357–17.092.242 TL); 6563 2026 tablosu doğrulandı (m.12/1-a 2.859–14.309; -e 143.102–715.516 TL). 5651 m.3 cezasının 2026 tutarı doğrulanamadı.
- Twilio'nun İYS parametresi sunup sunmadığı; Twilio adaptörü yalnızca konsol dışı test içindir, Türkiye'de üretimde kullanılmamalı.
- İleti Merkezi'nin API dışı gelen-SMS/kısa numara ürünü olup olmadığı (dokümante REST API'de yok).

## Kaynaklar

- 6563 sayılı Kanun: https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6563.pdf
- Ticari İletişim ve Ticari Elektronik İletiler Hk. Yönetmelik (konsolide): https://www.mevzuat.gov.tr/File/GeneratePdf?mevzuatNo=20914&mevzuatTur=KurumVeKurulusYonetmeligi&mevzuatTertip=5
- 6698 sayılı KVKK: https://www.mevzuat.gov.tr/MevzuatMetin/1.5.6698.pdf
- Aydınlatma Tebliği ve Başvuru Tebliği: RG 10.03.2018/30356
- İmha Yönetmeliği: RG 28.10.2017/30224
- Kişisel Veri Güvenliği Rehberi; Çerez Uygulamaları Hk. Rehber (Temmuz 2025); Kurul 2019/10, 2022/861, 2023/1154, 2025/1072
- 6343 sayılı Kanun: https://www.mevzuat.gov.tr/MevzuatMetin/1.3.6343.pdf; TVHB Hizmetlerinin Yürütülmesine İlişkin Uygulama Yönetmeliği (mevzuatNo=10644); Veteriner Hekim Muayenehane ve Poliklinik Yönetmeliği (mevzuatNo=15393); Veteriner Tıbbi Ürünler Hk. Yönetmelik (mevzuatNo=15651); Kimliklendirme Yönetmeliği (mevzuatNo=24414)
- ETBİS Tebliği (mevzuatNo=23842); E-Ticarette Hizmet Sağlayıcı ve Aracı Hizmet Sağlayıcılar Hk. Yönetmelik (RG 29.12.2022/32058); VUK 509 Sıra No.lu GT
- İYS OpenAPI: https://apidocs.iys.org.tr/openapi-v1.json; İleti Merkezi: https://www.iletimerkezi.com/docs/api/send-sms
