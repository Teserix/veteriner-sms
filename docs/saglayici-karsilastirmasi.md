# Veteriner Randevu/Aşı Hatırlatma Kanalı Karşılaştırması: Meta WhatsApp Cloud API vs Netgsm SMS vs İleti Merkezi SMS

Kontrol tarihi: 5 Eylül 2026 (bu sürümde tüm sayısal iddialar kaynak sayfalara karşı yeniden açılarak doğrulandı; doğrulanamayanlar metin içinde "doğrulanamadı" olarak işaretlidir). Kur: 1 USD = 48,42 TL (görev verisi); TCMB 04.09.2026 döviz satış 48,3195 (fark %0,2). Tüm SMS fiyatları KDV+ÖİV dahildir; Meta fiyatları vergisiz USD'dir.

## 1) Özet karar

1. **Bugün canlıya çıkmak için birincil kanal: İleti Merkezi SMS.** Kod zaten hazır (src/sms/index.js), başlık ücretsiz, ulaşmayan SMS iade, ilk 30 gün para iadesi, teslim raporu için webhook mevcut, Türkçe dokümantasyon en okunabilir olanı.
2. **Netgsm eşdeğer ikinci seçenek**; klinik zaten Netgsm abonesiyse kullanılır. Fiyatı İleti Merkezi'nden kademe başına %2-6 yüksek (10.000 SMS kademesinde %6,3), paket iadesi yok, SMS teslim raporu için push webhook bulunamadı, 249 TL yıllık ücretin SMS hesabına uygulanıp uygulanmadığı belirsiz.
3. **Meta WhatsApp mesaj başına açık ara en ucuz kanal** (utility 0,0009 USD ≈ 0,0436 TL; SMS'in 2-9 kat altı) ve hasta sahibi deneyimi en zengin olanı (buton, okundu, ücretsiz yanıt).
4. **Ancak WhatsApp'ın iki yapısal engeli var:** (a) KVKK m.9 yurt dışına aktarım için bugün fiilen uygun güvence kurulamıyor (yeterlilik kararı yok; Kurul'un standart sözleşmesi var ama Meta'nın imzaladığına dair kaynak yok; açık rıza sürekli aktarımda geçersiz); (b) doğrulanmamış işletmede klinik adı değil telefon numarası görünür.
5. WhatsApp ayrıca 4-6 geliştirici günü + 1-2 hafta onay takvimi ister (efor tahmini); SMS için ek gönderim eforu sıfırdır.
6. Randevu/aşı hatırlatması üç kanalda da **"bilgilendirme iletisi"**dir: İYS onayı gerekmez; ancak kampanya/indirim ifadesi eklenirse İYS onayı, Meta'da 12 kat fiyat (marketing) ve veteriner reklam yasağı riski birlikte devreye girer.
7. 1 Nisan 2026 itibarıyla SMS panellerinde gönderim yetkili kullanıcılar için e-imza/mobil imza zorunluluğu başladı; API gönderimleri muaf (İleti Merkezi ve Mobildev beyanı; Netgsm beyanı bulunamadı). Belgelerin KEP ile iletilmesi her iki sağlayıcıda zaten zorunlu.
8. **Önerilen yol haritası:** Faz 1 İleti Merkezi (klinik başına hesap + KEP + başlık); Faz 2 KVKK danışman görüşü alınırsa WhatsApp'ı utility şablonuyla ekleyip 131026 hatasında SMS'e düşen hibrit.
9. Tek klinik yıllık maliyet (3.600 mesaj): WhatsApp ≈157 TL; İleti Merkezi ≈1.103 TL; Netgsm ≈1.123 TL (KEP dahil). Fark büyük görünse de WhatsApp'ta yedek SMS + KEP zaten gerekli olduğu için gerçek tasarruf ölçekte ortaya çıkar.
10. Resmi olmayan WhatsApp botları (whatsapp-web.js, Baileys) kliniğin kendi hattının kalıcı yasaklanma riskini taşır; kapsam dışı ve önerilmez.

## 2) Puan kartı (1 = zayıf, 5 = güçlü)

| Boyut | Meta WhatsApp | Netgsm | İleti Merkezi |
|---|---|---|---|
| Fiyat ve faturalama | **4** – Mesaj başı en ucuz, ama USD kur riski, KDV belirsizliği, utility→marketing 12x riski. | **3** – TL, öngörülebilir; iade yok, her kademede İleti Merkezi'nden pahalı, 249 TL belirsiz. | **4** – En ucuz SMS listesi, ulaşmayan iade, 30 gün para iadesi, sabit ücret yok. |
| Kayıt ve klinik adıyla görünme | **3** – Dakikalar içinde gönderim, ama ad görünmesi için işletme doğrulaması şart. | **3** – KEP + belge + BTK onayı; süre yayımlanmıyor ("en kısa sürede"); onay öncesi test doğrulanamadı. | **4** – Aynı BTK rejimi, ama APITEST başlığı, 100 SMS hediye, 1-2 iş günü onay. |
| Teknik entegrasyon | **2** – Şablon + webhook + fallback için 4-6 geliştirici günü; resmi Node SDK arşivlendi. | **4** – Mevcut ve çalışıyor; teslim raporu yalnızca sorgu, doküman JS ile yükleniyor; resmi npm paketi (@netgsm/sms, TypeScript) var. | **5** – Mevcut ve çalışıyor; webhook + get-report, Türkçe statik doküman, resmi Node SDK. |
| Teslimat ve hasta sahibi deneyimi | **4** – Buton, okundu, ücretsiz yanıt; ama 65-74 yaşta kapsam düşük, numara görünür. | **3** – Evrensel ulaşım, başlık görünür; yanıt için interaktif SMS modülü gerekir (fiyat doğrulanamadı). | **3** – Evrensel ulaşım, başlık görünür; iki yönlü SMS belgelenmemiş. |
| Hukuk ve uyum | **2** – KVKK m.9 aktarım güvencesi fiilen kurulamıyor; tek taraflı yaptırım. | **4** – Veri yurt içinde, İYS filtresi altyapıda; BTK rejimi net. | **4** – Aynı; veri merkezi konumu açıkça yazmıyor. |
| Operasyon, destek, risk | **2** – Direct Support yok, SLA yok, 2022-2025'te 4 fiyat modeli (+ Eki 2026'da 5.), kademeli hesap kilidi. | **3** – Türkçe telefon desteği, durum sayfası var; iade yok, destek saatleri yayımlanmıyor. | **4** – Türkçe destek, esnek ticari koşullar; durum sayfası yok, telefon desteği mesai saatleriyle sınırlı. |
| **Toplam** | **17/30** | **20/30** | **24/30** |

## 3) Boyut bazında ayrıntı

### 3.1 Fiyat ve faturalama

| Kriter | Meta WhatsApp | Netgsm | İleti Merkezi |
|---|---|---|---|
| Birim fiyat | Utility/auth 0,0009 USD, marketing 0,0109 USD (agregatör tabloları: whautomate "1 Nis 2026 rate card", sleekflow "1 Tem 2026 itibarıyla"; Meta resmi sayfası "rate card 1 Tem 2026'dan geçerli" diyor, CSV bu turda açılamadı) | Standart: 500 SMS 198 TL (0,396), 1.000 370 TL (0,370), 3.000 896 TL (0,299), 5.000 1.089 TL (0,218), 10.000 1.699 TL (0,170), 50.000 7.799 TL (0,156), 100.000 14.798 TL (0,148) | Standart: 500 SMS 189 TL (0,378), 1.000 359 TL (0,359), 3.000 875 TL (0,292), 5.000 1.049 TL (0,210), 10.000 1.599 TL (0,160), 50.000 7.549 TL (0,151), 100.000 14.499 TL (0,145) |
| Yeni abone paketi | Yok; deneme kredisi yok | 10.000 SMS 899 TL, 25.000 2.229, 50.000 4.379, 100.000 7.899 TL (yeni abonelere özel, tek seferlik) | 10.000 SMS 879 TL, 25.000 2.149, 50.000 4.199, 100.000 7.699 TL (ilk ödeme); +100 SMS hoş geldin kredisi |
| Yıllık 3.000 mesaj | ≈131 TL (utility) / ≈1.583 TL (marketing) | 896 TL (standart) veya 899 TL (yeni abone 10.000) | 875 TL (standart) veya 879 TL (yeni abonelik 10.000) |
| Vergi | Vergisiz USD; VKN girilmezse +%20 KDV (reklam faturaları için doğrulandı, WhatsApp'a özgü teyit yok) | %20 KDV + %10 ÖİV dahil | KDV+ÖİV dahil |
| Geçerlilik / iade | Paket yok, kullanım sonrası kart çekimi | 1 yıl; "para veya paket iadesi yapılmayacaktır" | 1 yıl; ilk 30 gün para iadesi; ulaşmayan SMS hesaba iade |
| Türkçe uzun mesaj | Şablon gövdesi 1.024 karaktere kadar tek ücret | Türkçe karakterli SMS 150 karakter/SMS (ç, ğ, ı, ş, Ğ, İ, Ş 2 sayılır); standart karakterde 155 (B021 eki nedeniyle); parça başına ücret | Türkçe 150/148, GSM-7 155/153, Unicode 65/63; en fazla 7 parça (~1.071 karakter) |
| Sabit ücret | Yok | SMS fiyat sayfası ve şartnamede yok; yeni abonelik rehberi tutar vermeden "yılda bir kez Numara Kullanım ve Destek Ücreti" diyor; 249 TL tutarı sabit telefon/VoIP, 0850, coğrafi numara ve kurumsal WhatsApp hattı sayfalarında | "Sabit ücret veya taahhüt yok"; başlık ücretsiz |

- Depodaki varsayılan şablon (`Sayın {sahip}, {hayvan} adlı dostunuzun {tarih} tarihinde {tur} randevusu vardır. Bilgi için: {klinik_tel} - {klinik}`) örnek verilerle 140-150 karakter arasında çıkıyor; bu turda kullanılan örnekte ("Ayşe Yılmaz", "Pamuk", "12.09.2026", "Karma aşı", "0312 123 45 67", "Şen Veteriner Kliniği") 140 karakter / Netgsm ağırlıklı sayımla tam 150 = sınırda 1 SMS. Biraz daha uzun sahip/klinik adı **2 SMS**'e taşır. Şablonu güvenli payla 150 ağırlıklı karakterin altında tutmak SMS maliyetini yarıya indirir; WhatsApp'ta bu sorun yok.
- Meta'da 1 Ekim 2026'dan itibaren 24 saat penceresi içindeki utility şablonları ve serbest metin (servis) yanıtları da ücretli olur (utility/auth oranında, hacim kademesi yok, ücretsiz kota yok); 1 Eki 2026 pazar bazlı değişiklik listesinde Türkiye yer almıyor.
- Şablon utility'den marketing'e yeniden sınıflandırılırsa birim maliyet 12 kat artar (1 gün önceden bildirim; 16 Nis 2025'ten beri kötüye kullanım uyarısı almış işletmelerde anında; 60 gün itiraz); uygulama `template_category_update` webhook'unu dinlemeli.
- Çok kiracılı modelde her klinik kendi hesabını açtığı için "yeni abone" indirimi klinik başına bir kez alınır; 2. yıldan itibaren standart liste (10.000 SMS'te yaklaşık 1,8-1,9 kat) geçerlidir.

### 3.2 Kayıt, doğrulama ve klinik adıyla görünme

| Kriter | Meta WhatsApp | Netgsm | İleti Merkezi |
|---|---|---|---|
| Hesap açma | Dakikalar; yeni portföyde 250 tekil alıcı/24 saat ve 2 numara (doğrulama veya 2.000 sınırına ulaşınca 20 numara) | 4 adım + e-Devlet/mobil uygulama ile sözleşme + belge + ödeme; süre yayımlanmamış | Ücretsiz üyelik; "yaklaşık 10 dakika" ve "belgeler 1 iş günü" ifadeleri doğrulanamadı |
| Belge kanalı | Business Suite'e yükleme; KEP/e-imza yok | Yalnızca KEP (netgsm.belge@netgsm.hs03.kep.tr) | Yalnızca KEP; standart e-posta geçersiz |
| Ad/başlık kuralı | ≥3 karakter, boşluk serbest, işletme/web sitesiyle tutarlı (Türkçe karakter kuralı yazmıyor) | 3-11 karakter, firma/kurum adıyla bağlantılı, alan adı olamaz (boşluk kuralı yazmıyor) | 3-11 karakter, Türkçe karakter (Ç, Ğ, İ, Ö, Ş, Ü) yasak |
| Onay süresi | Görünen ad: resmi süre yok (BSP'ler 2-3 saat–3 iş günü); işletme doğrulaması 1-15 iş günü (üçüncü taraf) | "En kısa sürede"; üçüncü taraf 1-3 iş günü | 1-2 iş günü (docs) / 1-3 iş günü (blog) |
| Alıcıda ad görünmesi | Yalnızca görünen ad doğrulaması ile; aksi hâlde numara | Onaylı başlık her alıcıda görünür (+B021, 2016 kararı) | Onaylı başlık her alıcıda görünür (+B186) |
| Sabit hat | Sesli OTP ile kullanılabilir (IVR geçemez) | "1 Nis 2026'dan itibaren sabit numara başlık olamaz" doğrulanamadı | Doğrulanamadı |
| Onay öncesi test | Test numarası (alıcı sayısı resmi dokümanda doğrulanamadı) | Doğrulanamadı (doküman JS ile yükleniyor) | APITEST başlığı, ücretsiz, sabit metin |

- "Şen Veteriner Kliniği" SMS'te en fazla "SENVETERINE" gibi 11 karaktere sıkışır; WhatsApp'ta tam ad kullanılabilir, ama görünmesi doğrulamaya bağlıdır.
- Şahıs işletmesi kliniklerde vergi levhasındaki ad ile tabela adı farklıysa SMS'te marka tescil belgesi gündeme gelir; Meta'da web sitesi/altbilgi ilişkisi yeterlidir.
- Çok kiracılı yapıda üç kanal da uygulama sahibinin tek hesabından farklı klinik adlarıyla göndermeyi kural dışı/riskli kılar; mevcut mimari (klinik başına hesap) uyumludur.
- Meta'da ölçeklenebilir yol Tech Provider (işletme doğrulaması + App Review + video kanıt) ve Embedded Signup'tır; v2 15 Eki 2026'da kaldırılıyor, v4 ile başlanmalı.

### 3.3 Teknik entegrasyon

| Kriter | Meta WhatsApp | Netgsm | İleti Merkezi |
|---|---|---|---|
| API | Graph API (dokümandaki örnekler v23.0), Bearer token, JSON | REST, HTTP Basic (sürüm/limitler doğrulanamadı) | REST v1, API key + hash gövdede |
| Mesaj içeriği | Zorunlu onaylı şablon + değişkenler | Serbest metin, encoding TR | Serbest metin, iys:'0' (zorunlu alan) |
| Teslim raporu | Webhook (sent/delivered/read/failed), X-Hub-Signature-256 (SHA256) imzalı, 36 saat yeniden deneme | Sorgu (getReport); push webhook bulunamadı | Webhook (hesap başına 1 URL, imzasız, accepted/delivered/undelivered) + get-report |
| Hız limiti | 80 mesaj/sn varsayılan; aynı kullanıcıya 6 sn'de 1 | "50 paket/dk" ve "aynı numaraya 20 görev/dk" doğrulanamadı | 100 SMS/sn |
| Kalite mekanizması | Kalite puanı, şablon duraklatma (1. kez 3 saat → 2. kez 6 saat → 3. kez devre dışı) | Yok | Yok |
| Resmi Node SDK | Arşivlendi (7 Haz 2023) | @netgsm/sms (npm, v1.1.11, 30 Ara 2025, TypeScript tipleri, yayıncı Netgsm A.Ş.) | @iletimerkezi/iletimerkezi-node (webhook yardımcılı, TypeScript) |
| Durum sayfası | metastatus.com | netgsm.instatus.com (yalnızca genel durum) | Bulunamadı |
| Mevcut uygulamaya efor | ~4-6 geliştirici günü + 1-2 hafta onay (tahmin) | 0 gün (+0,5 gün rapor sorgusu) | 0 gün (+0,5-1 gün webhook) |

- Meta için gereken iş: PROVIDERS'a `whatsapp` girişi, `buildMessage`'ın değişken nesnesi üretmesi, `/webhooks/whatsapp` ucu (hub.challenge, X-Hub-Signature-256), `phone_number_id → klinik` eşlemesi, `updateStatusByRef`, 131026 (alıcı WhatsApp kullanıcısı değil) / 131049 (ekosistem sağlığı için teslim edilmedi) hatalarında SMS'e düşme.
- İleti Merkezi webhook'u imzasız olduğundan `?token=` ile klinik bazlı URL ve get-report ile mutabakat gerekir; aynı `report.id` birden çok kez gelebilir (idempotent yazılmalı); yeniden deneme garantisi belgelenmemiş.
- Uygulamanın MAX_MESSAGE_LENGTH=460 değeri İleti Merkezi'nde Türkçe kodlamada 4 parçaya kadar ücret üretebilir (150+148+148 = 446 < 460); mesaj emoji/Unicode içerirse 460 karakter 8 parça gerektirir ve 7 parça sınırını aşar (red riski).
- IP kısıtı iki SMS sağlayıcısında da var (Netgsm'de "önerilir"); sunucu taşınırsa her klinik panelini güncellemelidir.

### 3.4 Teslimat ve hasta sahibi deneyimi

| Kriter | Meta WhatsApp | Netgsm | İleti Merkezi |
|---|---|---|---|
| Kapsam | İnternet kullanımı %92,3, WhatsApp %90 ile ilk sırada (TÜİK 2026); 65-74 yaşta internet kullanımı %31,3 | Tüm GSM hatları (81,9 milyon mobil bağlantı, 2025 sonu) | Aynı |
| Gönderici görünümü | Doğrulanmamışsa numara | Onaylı başlık + B021 | Onaylı başlık + B186 |
| Okundu bilgisi | Var | Yok | Yok |
| İki yönlü | Yerleşik, yanıt ücretsiz (1 Eki 2026'ya kadar), buton | İnteraktif SMS modülü var; fiyat (62-552 TL/ay) ve hat şartı doğrulanamadı | Belgelenmemiş (bulunamadı); başlıklı SMS'e yanıt verilemez |
| Zengin içerik | 1.024 karakter gövde, toplam 10 buton (en fazla 2 URL), görsel | Düz metin | Düz metin |
| Bekletme | 30 gün TTL (auth şablonları 10 dk) | Süre bulunamadı | Bulunamadı |
| Şikayet kayıtları | Türkiye'ye özgü teslimat şikayeti bulunamadı | Şikayetvar toplam 2.212 şikayet (çoğu GSM/hat); 7 Kas 2025 tarihli "%50'si 3 gün ulaşmadı" alıntısı bugünkü sayfada doğrulanamadı | Şikayetvar toplam 3 şikayet, 1'i SMS teslimatı ("rapor bekleniyor") |

- Yaşlı hasta sahipleri için WhatsApp kapsamı belirgin düşüyor; SMS yedeği bu boyutta da gereklidir.
- Gönderim saati için yasal gece yasağı bulunamadı; Turkcell 09:00-21:00 penceresi iddiası doğrulanamadı. Uygulama varsayılanı (send_hour_start 9, send_hour_end 20) gündüz planlıyor; risk yoktur.
- Ortak WABA altında birden çok klinik çalıştırılırsa bir kliniğin şikayeti diğerlerinin kalite puanını etkiler; klinik başına numara önerilir.

### 3.5 Hukuk ve uyum

| Kriter | Meta WhatsApp | Netgsm | İleti Merkezi |
|---|---|---|---|
| Hatırlatmanın niteliği | Bilgilendirme (Yönetmelik m.6/2: devam eden ilişki, bilgi güncelleme vb.; tanıtım içeremez); Meta utility ile örtüşür | Bilgilendirme; İYS filtresi altyapıda | Bilgilendirme; rehber açıkça "randevu hatırlatması" sayar |
| İYS | Kampanya varsa zorunlu; Meta İYS kontrolü yapmaz, uygulama yapmalı | Otomatik İYS filtresi (NetİYS) | iys=1 ile otomatik kontrol, filtrelenen alıcı için kredi düşmez |
| Verinin konumu | ABD/Meta veri merkezleri; local storage listesinde (AU, ID, IN, JP, SG, KR, DE, CH, GB, BR, BH, ZA, AE, CA) Türkiye yok | Türkiye, 2 bağımsız Tier III veri merkezi; gizlilik politikasında "yurt dışına aktarım yapılmıyor" | Türk şirketi (eMarka); konum açıkça yazmıyor |
| KVKK m.9 | Yeterlilik kararı yok; Kurul'un standart sözleşmesi (4 Haz 2024) var ama Meta'nın imzaladığına dair kaynak yok; açık rıza yalnızca arızi/süreksiz aktarımda | Uygulanmaz | Uygulanmaz |
| Kanal opt-in şartı | Zorunlu (işletme adı geçen izin) | Yok | Yok |
| Saklama/ispat | Meta teslim edilemeyen mesajı en fazla 30 gün (TTL) bekletir; 3 yıl kayıt uygulamada | 3 yıl klinikte | 3 yıl klinikte; "gönderim raporları belirli süre sonra silinir" (süre yazmıyor) |
| 2026 cezaları | Onaysız ileti 2.859-14.309 TL; bir defada birden fazla kişiye gönderimde 10 katına kadar (6563 m.12/2 → en çok 143.090 TL, hesaplama); standart sözleşme bildirim ihlali 90.308-1.806.377 TL | Aynı 6563 cezaları | Aynı |

- "150 alıcı altı İYS muafiyeti" hiçbir resmi kaynakta yok; 150.000 rakamı 2020-21 geçiş takvimi eşiğidir (150.000 üstü onay için 31 Ara 2020, altı için 31 May 2021).
- Hayvan sağlığı verisi KVKK m.6 anlamında özel nitelikli değildir; telefon numarası m.5/2-c veya m.5/2-f ile işlenir, aydınlatma metni zorunludur.
- KVKK Kurulu WhatsApp'a 03.09.2021 tarih ve 2021/891 sayılı kararla m.12/1 uyarınca 1.950.000 TL ceza kesmiştir (tüketici uygulaması); şikâyet hâlinde WhatsApp kullanan kliniğin m.9 savunması zayıf kalır.
- Veteriner Hekimliği Muayenehane ve Poliklinik Yönetmeliği'nin reklam hükmü, "marketing" niteliğindeki mesajları kanal bağımsız riskli kılar (birincil metin bu turda açılamadı); içerik yalnız tarih/saat/aşı adıyla sınırlanmalıdır.

### 3.6 Operasyon, destek ve risk

| Kriter | Meta WhatsApp | Netgsm | İleti Merkezi |
|---|---|---|---|
| Destek | Direct Support yalnızca partner/enterprise; İngilizce forum | Telefon 0850 303 0 303, ticket, Türkçe; saat yayımlanmıyor | Telefon 0212 543 4210 ve canlı destek hafta içi 08:30-18:30, Cumartesi 09:30-15:30; WhatsApp destek hattı; e-posta 7/24 ("7/24 Destek" sloganı buna dayanıyor) |
| SLA | "Ticari SLA sunmuyoruz" (enterprise ticket ilk yanıt hedefi 24 saat) | Bulunamadı | Bulunamadı |
| Hesap kesintisi | Kademeli yaptırım (1/3/5/7/30 gün engel) → hesap kilidi → kalıcı; itiraz 24-48 saat | Paket iadesi yok; BTK başlık rejimi | 30 gün iade; kamuya açık kapatma vakası yok |
| Fiyat modeli değişimi | Şub 2022, Haz 2023, Kas 2024, Tem 2025 (4 değişiklik) + Eki 2026 (5.) | 2024-2026 geçmişi bulunamadı | Bulunamadı |
| Kurumsal geçmiş | Meta Platforms Ireland Ltd. sözleşme tarafı; Türkiye'de tüzel muhatap yok | 2009'da kuruldu, 243.000+ abone, yılda 3,5 milyar+ SMS | eMarka 2013, BTK yetkili; STH-195 ve B186 kodu resmi sayfada doğrulanamadı |
| Klinik başına kurulum | 1-14 gün (tahmin) | 2-5 iş günü (tahmin) | 1-3 iş günü (tahmin) |
| Yan maliyet | Kur, banka komisyonu | KEP 215 TL/yıl + 8,70 TL/ileti (PTT, 15 Ara 2025 tarifesi) | Aynı KEP |

- Uygulama API ile gönderdiği için klinik personeline e-imza gerekmez; ancak başlık başvurusu için klinik KEP hesabı şarttır (yoksa 1-2 hafta ekler).
- Meta'da tek bir kliniğin spam şikayeti, aynı portföydeki diğer numaraları etkileyebilir (üçüncü taraf iddiası, doğrulanamadı).
- Netgsm'in Kasım 2024 Turkcell erişim krizi MVNO hattını ilgilendirir, SMS API'yi değil (bu turda doğrulanamadı).

## 4) Senaryo önerileri (yıllık, TL)

Varsayım: klinik başına 300 mesaj/ay = 3.600 mesaj/yıl (varsayım, kaynaklı değil). KEP: 215 TL + 1 ileti 8,70 TL ≈ 224 TL.

**A. Tek klinik**
- WhatsApp utility: 3.600 × 0,0009 USD × 48,42 ≈ **157 TL** (marketing sınıflanırsa ≈1.900 TL; VKN yoksa +%20 KDV). Yedek SMS eklenmezse yaşlı hasta sahipleri ve WhatsApp'ta olmayan numaralar kapsanmaz.
- Netgsm: yıl 1 yeni abone 10.000 SMS 899 TL + KEP 224 ≈ **1.123 TL**; yıl 2 standart 5.000 SMS 1.089 + 215 ≈ 1.304 TL. 249 TL yıllık ücret alınıyorsa +249 TL (≈1.372 TL, +%22).
- İleti Merkezi: yıl 1 879 + 224 ≈ **1.103 TL**; yıl 2 standart 10.000 SMS 1.599 + 215 ≈ 1.814 TL (veya 5.000 SMS 1.049 + 215 ≈ 1.264 TL).
- Öneri: **İleti Merkezi**, şablon 150 ağırlıklı karakter altında tutulmalı.

**B. 10 klinik SaaS (36.000 mesaj/yıl)**
- WhatsApp: 36.000 × 0,0009 × 48,42 ≈ **1.569 TL** toplam; ama 10 ayrı Meta doğrulaması + 10 kart ya da Tech Provider (App Review) gerekir.
- Netgsm, klinik başına hesap: yıl 1 10 × (899 + 224) ≈ **11.230 TL**; sonraki yıllar 10 × (1.089 + 215) ≈ 13.040 TL. Merkezi hesap + yetki belgeli başlıklar (sağlayıcı onayına bağlı): 50.000 SMS 4.379 TL (yeni) / 7.799 TL (standart) + 1 KEP.
- İleti Merkezi, klinik başına: yıl 1 10 × (879 + 224) ≈ **11.030 TL**. Merkezi distribütör modeli: 50.000 SMS 4.199 TL + 224 ≈ 4.423 TL (yıl 1).
- Öneri: Mevcut klinik-başına-hesap mimarisiyle **İleti Merkezi**; hacim büyüdükçe merkezi başlık modeli sağlayıcıyla teyit edilmeli. WhatsApp bu ölçekte yıllık ≈9.460 TL tasarruf vaat eder, ancak KVKK m.9 çözülmeden önerilmez.

**C. WhatsApp birincil + SMS yedekli hibrit** (varsayım: mesajların %80'i WhatsApp'ta teslim, %20'si SMS'e düşer)
- Tek klinik: WhatsApp 2.880 × 0,0009 × 48,42 ≈ 126 TL + SMS 720 mesaj → İleti Merkezi 1.000 SMS 359 TL (Türkçe 2 SMS ise 3.000 SMS 875 TL) + KEP 224 ≈ **709-1.225 TL**. Yalnız SMS'e göre tasarruf yıl 1'de sınırlı; deneyim kazancı (buton, okundu, ücretsiz yanıt) esas getiri.
- 10 klinik: WhatsApp ≈1.255 TL + 10 × (359 + 224) ≈ **7.085 TL** (yalnız SMS ≈11.030 TL).
- Ön koşullar: KVKK danışmanından m.9 görüşü, aydınlatma metninde yurt dışı aktarım ibaresi, kayıt formunda klinik adı geçen opt-in, utility şablonu, `131026` hatasında SMS'e düşme, kategori değişim webhook'unda gönderimi durdurma, işletme doğrulaması (ad görünmesi için).

## 5) Riskler ve bilinmeyenler

- **Netgsm 249 TL yıllık ücret:** yeni abonelik rehberi tutar vermeden "tüm abonelik hizmetlerinde yılda bir kez" diyor; 249 TL tutarı üyelik sayfasında yalnızca Sabit Telefon/VoIP başlığı altında ve numara tahsisli hizmet sayfalarında (kurumsal WhatsApp hattı, 0850, coğrafi numara, Netkumanda) geçiyor; SMS fiyat sayfası ve şartnamede yok. Yazılı teyit şart. Alınıyorsa tek klinik yıl 1 maliyetini %22 artırır.
- **Meta KVKK m.9:** Türkiye için imzalı standart sözleşme sunulmadığı, yayımlanmış veri aktarım eki (yalnızca AEA/İsviçre, EU-US DPF ve SCC) kapsamından çıkarımdır; bireysel talep üzerine imzaladığına dair kaynak yok.
- **Meta KDV/stopaj:** VKN yoksa %20 KDV kuralı reklam faturaları için doğrulandı; WhatsApp'a özgü teyit ve %15 stopajın uygulanabilirliği bulunamadı.
- **Meta kart tahsilat eşiği** ve **geçici token süresi** resmi sayfada okunamadı (yalnızca "hızla sona erer" ifadesi var).
- **1 Ekim 2026 servis mesajı ücreti:** "1.000 ücretsiz/numara/ay" iddiası (SendPulse, wha.tools) Meta sayfasıyla çelişiyor; Meta "hacim kademesi yok" diyor, ücretsiz kota belirtmiyor.
- **Türkiye utility oranı:** üçüncü taraf agregatörler 0,0014 ve 0,0055 USD de veriyor; whautomate/sleekflow 0,0009 USD; resmi CSV bu turda açılamadı (sayfa metninde dosya bağlantısı yok). 0,0053→0,0009 düşüş tarihi çelişkili: Meta sayfası "Türkiye daha düşük utility/auth, 1 Eki 2025"; wha.tools ve whautomate 1 Nis 2026.
- **İleti Merkezi standart listesi** fiyat sayfasından doğrulandı (500: 189, 1.000: 359, 1.500: 529, 3.000: 875, 5.000: 1.049, 10.000: 1.599, 50.000: 7.549, 100.000: 14.499 TL); panelde teyit yine önerilir. 30 gün iadesinin kısmi kullanımda hesaplaması, veri merkezi konumu, rapor saklama süresi, gelen SMS API'si, durum sayfası, STH-195 numarası, "10 dakika/1 iş günü" süreleri bulunamadı.
- **Netgsm:** başlık onay süresi, aktivasyon süresi, SMS teslim webhook'u, sandbox, hata kodu 40 / kod 2, "dakikada 50 paket" ve "aynı numaraya 20 görev" limitleri, REST sürümü, MNP ifadesi, API e-imza muafiyeti beyanı, interaktif SMS fiyatı ve klinik adına başlık için yetki belgesi kabulü doğrulanamadı (API dokümanı JS ile yükleniyor).
- **BTK 2025/DK-YED/399 ve 412:** birincil metne erişilemedi (Lexpera ücretli); e-imzanın API'yi kapsamaması İleti Merkezi ve Mobildev beyanlarına dayanır. "Sabit numara başlık olamaz" kuralı hiçbir açılan kaynakta bulunamadı. URL içeren SMS hükmü hatırlatma linki kullanılacaksa ayrıca değerlendirilmeli.
- **Meta yardım sayfaları** (işletme doğrulaması belgeleri, OBA, red sebepleri) JS ile yüklendiği için tam okunamadı; görünen ad için "en az 3 karakter" doğrulandı; süreler 2-3 saat ile 15 iş günü arasında çelişkili (üçüncü taraf).
- **Turkcell 09:00-21:00** toplu SMS penceresi ve operatör bekletme süreleri doğrulanamadı.
- **Meta Verified**'ın Cloud API numaraları için Türkiye'de geçerliliği doğrulanmadı.
- **Veteriner Yönetmeliği reklam hükmü:** Resmî Gazete (sertifika hatası) ve Lexpera (404) açılamadı; madde numarası bu turda doğrulanamadı.
- **Şablon karakter sayısı** örnek veriye bağlıdır (bu turda 140 karakter / 150 ağırlıklı = tam sınır); gerçek klinik adlarıyla ölçülmeli.
- TCO'daki 300 mesaj/ay, %20 fallback oranı ve kurulum süreleri varsayımdır.

## 6) Kaynaklar

**Meta**
- https://developers.facebook.com/docs/whatsapp/pricing (rate card "1 Tem 2026'dan geçerli"; Türkiye: daha düşük utility/auth 1 Eki 2025; CSV bağlantıları sayfa metninde yok)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages (1 Eki 2026; hacim kademesi/ücretsiz kota yok)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization (1 gün bildirim, 60 gün itiraz, template_category_update)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-pausing (3 saat / 6 saat / devre dışı)
- https://developers.facebook.com/docs/whatsapp/messaging-limits (250 → 2.000 → 10.000 → 100.000)
- https://developers.facebook.com/docs/whatsapp/cloud-api/overview (80 mesaj/sn, aynı kullanıcıya 6 sn'de 1)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names ve https://www.facebook.com/business/help/757569725593362 (en az 3 karakter)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers (2 numara → 20; sabit hat sesli OTP, IVR)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/policy-enforcement (kademeli engel, kilit, 24-48 saat itiraz)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- https://developers.facebook.com/docs/whatsapp/embedded-signup (v2 15 Eki 2026'da kaldırılıyor, v4)
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components ve https://developers.facebook.com/docs/graph-api/webhooks/getting-started (X-Hub-Signature-256, 36 saat yeniden deneme, hub.challenge)
- https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes (131026, 131047, 131049, 131050)
- https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components (1.024 karakter, 10 buton, 2 URL butonu)
- https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages (TTL 30 gün / auth 10 dk)
- https://developers.facebook.com/docs/whatsapp/cloud-api/overview/local-storage/ ve https://developers.facebook.com/docs/whatsapp/cloud-api/reference/registration (data_localization_region listesi; TR yok)
- https://developers.facebook.com/documentation/business-messaging/whatsapp/support (Direct Support, SLA yok)
- https://developers.facebook.com/docs/whatsapp/cloud-api/get-started (örneklerde v23.0)
- https://www.whatsapp.com/legal/meta-terms-whatsapp-business (Meta Platforms Ireland Ltd.)
- https://www.whatsapp.com/legal/business-data-processing-terms
- https://www.whatsapp.com/legal/business-data-transfer-addendum (AEA/İsviçre, EU-US DPF, SCC; Türkiye yok)
- https://whatsappbusiness.com/policy/
- https://github.com/WhatsApp/WhatsApp-Nodejs-SDK (7 Haz 2023 arşiv)
- https://metastatus.com/whatsapp-business-api/history

**Netgsm**
- https://www.netgsm.com.tr/fiyatlar/toplu-sms (fiyatlar, 1 yıl, KDV %20 + ÖİV %10 dahil, iade yok)
- https://www.netgsm.com.tr/sms/toplu-sms
- https://www.netgsm.com.tr/hakkimizda (2009, 243.000+ abone, 2 bağımsız Tier III veri merkezi, 3,5 milyar+ SMS/yıl)
- https://bilgibankasi.netgsm.com.tr/sms/toplu-sms/gonderici-adi-talebi (3-11 karakter, KEP adresi, "en kısa sürede")
- https://bilgibankasi.netgsm.com.tr/abonelik-islemleri/yeni-abonelik (4 adım; yıllık ücret ifadesi, tutar yok)
- https://www.netgsm.com.tr/uyelik ve https://www.netgsm.com.tr/sabit-telefon/kurumsal-whatsapp-hatti ("Yılda bir kere 249 TL Numara Kullanım ve Destek Ücreti", vergiler dahil)
- https://bilgibankasi.netgsm.com.tr/sms/toplu-sms/toplu-sms-gonderimi (150/155 karakter, ç ğ ı ş Ğ İ Ş, B021 2016)
- https://bilgibankasi.netgsm.com.tr/sms/toplu-sms/interaktif-sms (modüller; fiyat yok)
- https://bilgibankasi.netgsm.com.tr/entegrasyonlar/api-entegrasyonu-hazirlik-rehberi (IP kısıtı önerilir)
- https://www.netgsm.com.tr/belgeler/sartname/sms_teknik_sartnamesi_rev2.htm (150/155 karakter, 11 karakter başlık, iletilmeyen SMS ücretsiz)
- https://www.netgsm.com.tr/sms/ileti-yonetim-sistemi-iys (NetİYS filtresi, 150.000 eşiği)
- https://www.netgsm.com.tr/gizlilik-ve-guvenlik/ ("yurt dışına aktarım yapılmıyor")
- https://registry.npmjs.org/@netgsm/sms (v1.1.11, 30 Ara 2025, TypeScript; depo github.com/netgsm/netgsm-sms-js)
- https://github.com/netgsm1/sms/blob/main/README.md (PHP paketi; gelen SMS webhook'u – Node SDK değil)
- https://www.netgsm.com.tr/dokuman/ (JS ile yükleniyor; API limitleri/hata kodları okunamadı)
- https://netgsm.instatus.com/
- https://www.sikayetvar.com/netgsm (2.212 şikayet)

**İleti Merkezi**
- https://www.iletimerkezi.com/toplu-sms-fiyatlari (yeni abonelik ve standart liste, 30 gün iade, sabit ücret yok)
- https://www.iletimerkezi.com/toplu-sms-gerekli-evraklar (yalnızca KEP)
- https://www.iletimerkezi.com/docs/guides/toplu-sms-nedir (1-2 iş günü, APITEST ücretsiz, 100 SMS, 150/148, 65/63, ulaşmayan ücretsiz)
- https://www.iletimerkezi.com/docs/guides/iys-rehberi ("randevu hatırlatması" bilgilendirme)
- https://www.iletimerkezi.com/docs/guides/kvkk-sms
- https://www.iletimerkezi.com/docs/api/send-sms (v1, key+hash, iys zorunlu, 7 parça, 100 SMS/sn)
- https://www.iletimerkezi.com/docs/api/authentication
- https://www.iletimerkezi.com/docs/api/webhooks (tek URL, imzasız, mükerrer)
- https://www.iletimerkezi.com/docs/api/get-report
- https://www.iletimerkezi.com/docs/api/error-codes
- https://www.iletimerkezi.com/docs/api/test-mode
- https://www.iletimerkezi.com/blog/toplu-sms-icin-baslik-islemleri (3-11 karakter, Türkçe karakter yasak, 1-3 iş günü)
- https://www.iletimerkezi.com/yardim-merkezi/1-nisan-2026-sonrasi-e-imza-ile-giris-nasil-calisir (API etkilenmez)
- https://www.iletimerkezi.com/guven-merkezi (eMarka, 2013, BTK yetkili)
- https://www.iletimerkezi.com/iletisim (hafta içi 08:30-18:30, Cumartesi 09:30-15:30, e-posta 7/24)
- https://www.iletimerkezi.com/sikca-sorulan-sorular
- https://github.com/iletimerkezi/iletimerkezi-node
- https://www.sikayetvar.com/ileti-merkezi (3 şikayet)

**Mevzuat ve diğer**
- https://www.tcmb.gov.tr/kurlar/today.xml (04.09.2026: döviz satış 48,3195)
- https://www.lexpera.com.tr/mevzuat/yonetmelikler/ticari-iletisim-ve-ticari-elektronik-iletiler-hakkinda-yonetmelik (m.6/2)
- https://www.lexpera.com.tr/mevzuat/kanunlar/elektronik-ticaretin-duzenlenmesi-hakkinda-kanun-6563 (m.12/2 "on katına kadar")
- https://www.lexpera.com.tr/mevzuat/kurul-kararlari/sms-hizmeti-sunumu-ile-ilgili-duzenlemeler-2025-dk-yed-399 (ücretli, erişilemedi)
- https://www.kvkk.gov.tr/Icerik/2053/Yurtdisina-Aktarim (yeterlilik kararı yok; standart sözleşme 4 Haz 2024; açık rıza arızi aktarım)
- https://www.kvkk.gov.tr/Icerik/6856/WHATSAPP-UYGULAMASI-HAKKINDA-KAMUOYU-DUYURUSU (12 Oca 2021 inceleme duyurusu, 2021/28)
- https://www.aa.com.tr/tr/bilim-teknoloji/kisisel-verileri-koruma-kurumundan-whatsappa-1-milyon-950-bin-lira-ceza/2354876 (2021/891, 1.950.000 TL, m.12/1)
- https://www.erdem-erdem.av.tr/bilgi-bankasi/elektronik-ticaret-kanunu-kapsaminda-idari-para-cezalari-2026-yili-icin-guncellendi (2.859-14.309 TL; %25,49 yeniden değerleme)
- https://www.cottgroup.com/tr/mevzuat/item/yeniden-degerleme-oranina-gore-2026-yili-kvkk-idari-para-cezalari (90.308-1.806.377 TL)
- https://www.resmigazete.gov.tr/eskiler/2011/10/20111015-2.htm (bu turda sertifika hatasıyla açılamadı)
- https://www.mobildev.com/blog/btk-duzenlemesi-sms-panel-girislerinde-e-imza--mobil-imza-zorunlulugu-basliyor (1 Nis 2026, API muaf)
- https://www.hukukihaber.net/pttden-kep-ucretlerine-zam (215 TL/yıl, 8,70 TL/ileti, 15 Ara 2025)
- https://www.teknoblog.com/turkiye-de-internet-kullanimi-yuzde-923-oldu/ (TÜİK 2026: %92,3; 65-74 yaş %31,3; WhatsApp %90)
- https://raporbulteni.substack.com/p/124-datareportal-dijital-2026-turkiye (81,9 milyon mobil hat, 2025 sonu)
- https://www.turktelekom.com.tr/hakkimizda/duyurular/sabit-toplu-sms-fiyat-guncellemesi-hakkinda (1 Tem 2025: yurt içi 70 kr/SMS)
- https://wha.tools/whatsapp-api-pricing-history (Türkiye 0,01 → 0,0053 → 0,0009 USD; model değişiklikleri)
- https://whautomate.com/whatsapp-business-api-pricing (Türkiye 0,0109 / 0,0009 / 0,0009 USD, rate card 1 Nis 2026)
- https://sleekflow.io/en-us/blog/whatsapp-business-price (aynı oranlar, 1 Tem 2026 itibarıyla)
- Depo: /Users/thejackaltr/GitHub/veteriner-sms/src/sms/index.js (PROVIDERS, MAX_MESSAGE_LENGTH=460, iys:'0', encoding 'TR'), src/sms/dispatch.js, src/scheduler.js (buildMessage), src/db/tenant.js (DEFAULT_TEMPLATE, send_hour_start/end 9-20), src/util.js (formatDate)