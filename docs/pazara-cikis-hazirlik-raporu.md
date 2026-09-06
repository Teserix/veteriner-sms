# Pazara Çıkış Hazırlık Raporu — veteriner-sms (Teserix)

Tarih: 06.09.2026 · Kapsam: kod, iş akışı, hukuk/KVKK, operasyon, satış, arayüz (6 bağımsız inceleme + ürün yönetimi eleştirisi)

---

## 1) Karar: Bu haliyle veterinerlerle görüşülebilir mi?

**Evet — bu hafta görüşün. Kod tarafında beklemeniz gereken hiçbir şey yok; 2-3 saatlik hazırlık yeter.**

Önceki değerlendirme "1 haftalık hazırlıktan sonra" diyordu; bu fazla temkinli ve satışın nasıl işlediğini yanlış okuyor. İlk görüşme ürün teslimi değil, **ihtiyaç doğrulama + ürün gösterme** görüşmesidir. Dizüstünüzde `localhost`'ta çalışan bir kopya ile demo yapabilirsiniz; veteriner ne Tailscale adresini, ne favicon'u, ne sayfalamayı görür. Canlı servisin şu anda kapalı olması (`curl .../api/health` → 502, `launchctl print` → *not running*) ücretli kullanım için ciddi bir sorundur, ama **ilk görüşmeyi engellemez**.

Ürün gerçekten çalışıyor: giriş → hızlı kayıt → hatırlatma → SMS geçmişi akışı uçtan uca sorunsuz, arayüz baştan sona doğal Türkçe, rol ayrımı sunucu tarafında gerçekten zorlanıyor (personel `/ayarlar`, `/kullanicilar`, `/iceaktar` isteklerinin hepsi 403), 119 test sıfır hatayla geçiyor. Gösterecek bir ürününüz var.

**Ama görüşmede söyleyeceğiniz vaadi baştan daraltın.** Bu raporun en kritik düzeltmesi şu: kliniğin ilk gerçek SMS'i göndermesi sizin yazılımınıza değil, **dış bir zincire** bağlı — sağlayıcı aboneliği + e-Devlet kimlik doğrulaması + belgelerin KEP ile gönderimi + gönderici başlığı onayı, üstüne 01.04.2026'dan beri panel girişinde e-imza/mobil imza zorunluluğu (`docs/ileti-merkezi-bayilik-yolu.md` §1 ve §3.7). Bu zincir günler sürer ve adımları **veteriner kendisi** yapar. Üründe bu sürecin tek izi `views/settings.ejs:54`'teki bir yardım cümlesi. "Yarın kurarız, ertesi gün SMS gider" derseniz sözünüzü tutamazsınız.

**Sonuç:** Keşif + demo + ön kayıt görüşmesi için ürün fazlasıyla hazır. Gerçek hasta verisi girilmeden önce (ücretsiz pilot dahil) B tablosu kapanmalı. Para almadan önce C tablosu kapanmalı.

---

## 2) Güçlü yönler (görüşmede söyleyecekleriniz)

1. **"Hastalarınızın verisi kendi ayrı dosyanızda."** Her klinik ayrı SQLite dosyası (`src/db/tenant.js:7-12`), klinik kimliği regex ile doğrulanıyor, `test/tenant-isolation.test.js` bunu kanıtlıyor.
2. **"Kayıt 20 saniye sürüyor."** Hızlı kayıt sahip + hayvan + ilk hatırlatmayı tek ekranda alıyor; aynı telefon girilirse hayvanı mevcut sahibe ekliyor ve bunu söylüyor (`src/routes/quick.js:43-58`).
3. **"Excel listenizi yükleriz, biz bakarız."** Üç adımlı CSV içe aktarma: `;` ayracı ve windows-1254 otomatik algılanıyor, Türkçe karaktersiz başlıklar eşleniyor, satır satır önizleme, onaylanmadan tek kayıt yazılmıyor, hatalı satırlar CSV indiriliyor (`src/import/apply.js:19-98`).
4. **"Faturanız patlamaz."** İki kademeli günlük SMS tavanı klinik başına kilit altında sms_log'dan hesaplanıyor (`src/sms/dispatch.js:23-49`).
5. **"Aynı kişiye iki kez SMS gitmez."** Klinik başına kilit + gönderim öncesi yeniden okuma + "claim" izi (`src/scheduler.js:54-86`).
6. **"Gece SMS gitmez, çok geç kalmış hatırlatma da gitmez."** 09:00–20:00 penceresi; 3 günden eski hatırlatmalar ayrı listede (`src/db/tenant.js:209-211`).
7. **"İstemeyene SMS gitmez."** Opt-out tek çıkış noktasında uygulanıyor (`src/sms/dispatch.js:36`, `src/routes/reminders.js:107`).
8. **"Hata olursa ne olduğunu ekranda Türkçe görürsünüz."** Sağlayıcı hata kodları çevrilmiş (`src/sms/index.js:23-46`).
9. **"Sağlayıcı şifreniz uygulamada açık durmuyor."** AES-256-GCM, ekranda bir daha gösterilmiyor; bcrypt 12 tur, CSRF + Origin, CSP, HSTS, `__Host-` çerez. *(Not: #61'i okuyun — disk şifrelemesi kapalıyken bu cümleyi "hiç kimse erişemez" diye genişletmeyin.)*
10. **"Her gece yedek alınıyor."** WAL checkpoint + VACUUM INTO; logda doğrulandı.
11. **"Her değişiklikten önce 119 otomatik test çalışıyor"**, `npm audit` 0 açık, 3 üretim bağımlılığı.
12. **"Hastanız bir hayvan; tuttuğumuz veri sıradan iletişim verisi."** Sahip adı + telefon + hayvan adı; KVKK'nın özel nitelikli sağlık verisi rejimi burada uygulanmaz (hasta insan değil). Bu, veterinerin en çok korktuğu konuda verebileceğiniz en rahatlatıcı ve **dürüst** cevaptır — kliniğin kendi aydınlatma yükümlülüğü yine de sürer.
13. **"Sizi biz de gözetleyemiyoruz."** Süper yönetici klinik verisine giremiyor; tüm yönetici işlemleri IP'li denetim günlüğüne düşüyor. *(#28'i okuyun — kurtarma amaçlı parola sıfırlama istisnasını da söyleyin.)*

---

## 3) Eksikler tablosu

### A. Görüşme öncesi (2-3 saat — gerçekten bunlar yeter)

| # | Eksik | Neden önemli | Kanıt | Öneri | Efor |
|---|---|---|---|---|---|
| 3 | Demo verisi yok: ekran sıfırlarla açılıyor | İlk izlenim "boş program" olur; anlatacak hikâye kalmaz | Yeni klinikte `GET /` → 4 sayaç 0, üç boş kutu; `scripts/` altında seed betiği yok | `scripts/seed-demo.js` (20 sahip / 25 hayvan / bugün-yarın-gelecek hafta 15 hatırlatma) + 30 satırlık örnek CSV | 1-2 saat |
| 2 | CSV içe aktarma, tırnak içinde satır sonu olan hücrede çöküyor | Kliniğin adres/not sütunu varsa demoda kırılır. *(Düzeltme: "Excel'in en yaygın biçimi" değil — normal CRLF satır sonu `csv.js:51`'de doğru işleniyor)* | `src/csv.js:37` `const c = text[i]`, `:44` aynı değişkene atama → `Assignment to constant variable.` | `let c`; hatayı "Dosya okunamadı, CSV UTF-8 kaydedin"e sarın; CRLF fixture testi | 15 dk |
| 9 | Kliniğe bırakılacak tek sayfa yok (değer, fiyat, karşılaştırma) | Görüşmeden elde bir şey bırakmadan çıkmak dönüşümü düşürür | `docs/` altında yalnız iki tedarikçi araştırması; views/src'de "fiyat/abonelik/teklif" geçmiyor | 1 sayfa: değer önerisi, **3 somut hacim senaryosu için aylık fiyat**, SmartVet karşılaştırması, "verinizi CSV alırsınız" | 2 saat |
| 0-a | İlk SMS'e giden yolun anlatımı hazır değil | Vaadi yanlış kurarsanız ilk 2 haftada güven kaybedersiniz | `docs/ileti-merkezi-bayilik-yolu.md` §1, §3.7; üründe tek satır: `views/settings.ejs:54` | Görüşme metnine yazın: *"Yazılım aynı gün hazır; ilk SMS için sağlayıcı hesabınızın e-Devlet onayı ve başlık onayı gerekiyor, tipik olarak 3-7 iş günü. Bu adımları birlikte yapıyoruz."* | 30 dk |
| 28 | README "süper yönetici klinik verisine giremez" diyor; kurtarma amacıyla girebiliyor | Yanlış güvenlik beyanı, ilk itiraz anında elinizde patlar | `README.md:31-32` iddia; `src/routes/admin.js:115-125` geçici parola üretimi; `views/admin_detail.ejs:9` parolayı ekranda gösteriyor | Metni düzeltin: "Rutin kullanımda görmez; kurtarma amacıyla parola sıfırlayabilir ve bu denetim günlüğüne yazılır" | 15 dk |
| 4 | Veterinerin telefonuna gerçek SMS gönderilemiyor | Demonun "vay be" anı budur | `src/sms/dispatch.js:50` yalnızca kiracı ayarlarından okuyor; yeni klinik varsayılanı `console` | **Dar çözüm:** Teserix'in kendi onaylı başlıklı hesabından, yalnızca görüşmedeki kişinin telefonuna, Teserix'in kendi mesajı olarak. ⚠ Önceki rapordaki "kliniğe deneme kredisi" önerisi **yapılmamalı** — bkz. #64 | gün (hesap açma süresi) |

**Bu kadar. Bunlar bittiğinde randevu alın.** Aşağıdaki maddelerin hiçbiri ilk görüşmeyi engellemez.

### B. Pilot öncesi — gerçek hasta verisi girilmeden (ücretsiz pilot dahil)

| # | Eksik | Neden önemli | Kanıt | Öneri | Efor |
|---|---|---|---|---|---|
| **0** | **Kliniğin ilk gerçek SMS'e ulaşma yolu üründe hiç yönetilmiyor** | **Raporun en büyük boşluğu.** e-Devlet kimlik doğrulaması + belgelerin KEP ile gönderimi + başlık onayı + 01.04.2026'dan beri panel girişinde e-imza/mobil imza (BTK 2025/DK-YED/399). Hepsi klinik tarafından, günler süren, sizin kontrolünüz dışında adımlar. Klinik bu süreçte hiçbir değer görmezse sizi bırakır | `docs/ileti-merkezi-bayilik-yolu.md` §1 (e-Devlet + KEP, 1 iş günü belge kontrolü) ve §3.7 (e-imza zorunluluğu); üründeki tek iz `views/settings.ejs:54` | Ürüne "Sağlayıcı kurulumu" adım listesi (abonelik → e-Devlet → KEP belgeleri → başlık → test SMS), her adımda durum + tarih; yazılı klinik rehberi (ekran görüntülü); onboarding'de takip araması | gün |
| **61** | **Mac mini'de disk şifrelemesi KAPALI** | Tüm klinik veritabanları, yedekler ve `APP_SECRET` içeren `.env` şifresiz diskte. Sağlayıcı bilgilerinin AES-256-GCM şifrelemesi fiziksel erişimde anlamsız; makine bir evde duruyor. Veteriner "verim nerede duruyor" diye sorduğunda bugünkü dürüst cevap zayıf | `fdesetup status` → **"FileVault is Off."**; `.env` `-rw-------` ama aynı şifresiz diskte; README:330-352 daha güçlü bir duruş ima ediyor | FileVault'u açın, kurtarma anahtarını parola kasasına koyun; README güvenlik özetine "disk şifreli" satırı; UPS/kilitli konum | 30 dk |
| **64** | **Önerilen "deneme kredisi" çözümü hukuki tuzak** | Kliniğin kendi hastalarına Teserix aboneliğinden SMS attırmak, kendi belgenizdeki 5809 m.60/4 (abonelik iptali) ve Yetkilendirme Yönetmeliği m.19/ö senaryosunun tam kendisi | `docs/ileti-merkezi-bayilik-yolu.md` §1: "abone olarak aldığınız krediyi kliniklere yeniden satmak aboneliğinizin iptal sebebidir"; §2 model B satırı | Teserix hesabı **yalnızca** kendi demo/test mesajlarınız için. Klinik trafiği her zaman kliniğin kendi hesabından. Bunu yazılı politika yapın | 0 (karar) |
| **62** | **Hiç e-posta altyapısı yok** | Parola sıfırlama, hoş geldin, fatura, kesinti bildirimi, KVKK ihlal bildirimi — hepsi imkânsız | `grep -rn "nodemailer\|smtp\|sendMail" src/ package.json` → 0 sonuç | Kısa vade: **sıfırlama kodunu kliniğin kayıtlı telefonuna SMS ile gönderin** — kanalı zaten siz işletiyorsunuz, marka açısından da doğru. Orta vade: SMTP sağlayıcı | gün |
| 8 | Klinik yöneticisi kendi parolasını kurtaramıyor + ortak IP'den 8 hata tüm kliniği kilitliyor | Cumartesi kilitlenen yönetici pazartesiye kadar dışarıda. ⚠ Düzeltme: personel parolasını klinik yöneticisi **sıfırlayabiliyor** (`views/users.ejs:21`); sorun yöneticinin kendisi | `src/routes/auth.js:26` `keys=['ip:'+ip,'email:'+email]`, `:32` her ikisine bakıyor, `:46` başarıda yalnız e-posta kovasını sıfırlıyor; `ratelimit.js:57` max 8; `views/login.ejs`'te sıfırlama bağlantısı yok | IP kovasını ayırın (IP 30-50, e-posta 8); girişe "Parolanızı mı unuttunuz? &lt;destek no&gt;"; **onboarding'de her klinikte ikinci yönetici hesabı açmayı zorunlu yapın** | gün |
| 10 | Sahte `cf-connecting-ip` ile giriş hız sınırı tamamen atlanıyor | Parola püskürtme koruması sıfır; audit_log'a uydurma IP yazılıyor | `src/ratelimit.js:47-52`; ölçüm: sahte başlıkla 30/30 istek 401, 0 adet 429; `.env` `TRUST_PROXY=1` ama trafik Funnel'dan geliyor | Funnel arkasında `TRUST_PROXY=0`; ya da `PROXY_HEADER` / Cloudflare IP aralığı kontrolü | saat |
| 1 | Canlı servis kapalı, launchd geri getirmedi, uyarı yok | Görüşmeyi engellemez ama pilot başladığı gün taahhüde döner | `curl .../api/health` → 502; `launchctl print gui/501/...` → not running; log son satırı `13:48:09 INFO kapatılıyor` | `service.sh restart`; **LaunchDaemon**'a geçin; UptimeRobot/Healthchecks ile `/api/health` dış izleme + telefona uyarı | saat |
| 14 | Elektrik kesintisinde makine açılmıyor | Kesintiden sonra siz elle açana kadar hiçbir hatırlatma gitmez | `pmset -g` → `autorestart 0`; `launchctl print system/...` → bulunamadı | `sudo pmset -a autorestart 1`; `sudo deploy/mac-mini/service.sh install`; fişi çekip uçtan uca test | saat |
| 11 | Kod makine dışında hiç yok (git remote tanımsız) | Disk ölürse 8 commit'lik tüm geliştirme kaybolur; CI hiç çalışmıyor | `git remote -v` boş; `.git/refs/remotes` yok | Private GitHub deposu + `git push -u origin main` (`.gitignore` `.env` ve `data/` zaten hariç) | saat |
| 47 | APP_SECRET tek kopya; tek süper yönetici hesabı | Kaybı geri dönülemez: tüm sağlayıcı bilgileri çözülemez | `src/crypto.js:5`; yalnız Mac mini `.env`'de; `server.js:11-26` tek bootstrap hesabı | Parola kasasına kaydedin (5 dk); ikinci süper yönetici hesabı | saat |
| 12 | Yedeklerin makine dışında kopyası yok; yedek zamanlayıcıya bağlı | Uygulama kapalıysa (bugünkü gibi) 03:00'te yedek hiç alınmaz | Yedekler `data/backups/` aynı diskte; `src/scheduler.js:135` tick içinden | Ayrı launchd yedek işi + restic/rclone ile şifreli dış kopya + "dead man switch" | gün |
| 13 | Geri yükleme tatbikatı hiç yapılmamış; belge Docker'a göre yazılmış | Yedeğin okunabilir olduğu doğrulanmamış | `README.md:215-236` tamamı `docker run -v ...`; gerçek kurulum launchd | Bu hafta tatbikat, süreyi ölçün, README'ye "RTO: X dakika, son tatbikat: tarih" | saat |
| **18** | **Uygulamada hiçbir hukuki metin yok** ⚠ Aşama 3'ten Aşama 2'ye taşındı | Yükümlülüğü para değil **veri işleme** tetikler; ücretsiz pilotta da gerekli | `GET /gizlilik`, `/kvkk` → 404; `views/partials/footer.ejs` tamamen boş (3 satır kapanış etiketi) | Gizlilik + Kullanım Şartları + Çerez sayfaları + footer bağlantıları; avukat teyidi | hafta |
| **19** | **Klinik ile Teserix arasında veri işleyen sözleşmesi yok** ⚠ taşındı | KVKK m.12/2 yazılı sözleşme zorunlu ve pilotta da geçerli; kendi belgeniz 2026 cezalarını 256.357 TL'den başlatıyor | Depoda taslak yok; `docs/ileti-merkezi-bayilik-yolu.md` §3.5 "[teyit]" | Alt işleyen onayı, 72 saat ihlal bildirimi, silme/iade, teknik-idari tedbir eki (README:330-352 doğrudan ek olur), sorumluluk sınırı | hafta |
| 24 | İçe aktarma aşı geçmişi/sonraki aşı sütunlarını sessizce atıyor | Göç sonrası klinikte **0 hatırlatma** olur; ürün hiçbir işe yaramaz | `src/import/mapping.js:4-15` 10 alan; canlı test: "Son Aşı Tarihi, Aşı Türü, Sonraki Aşı" → KULLANILMAYAN | `last_vaccine_date`, `vaccine_type`, `next_due_date` + apply.js'te otomatik hatırlatma üretimi; önizlemede "N hatırlatma oluşturulacak" | hafta |
| 25 | Toplu hatırlatma üretimi yok | 500 hayvanlık klinik 500 kez form doldurur — kimse yapmaz | Tek yol `src/routes/reminders.js:49` tek kayıt POST | "Hatırlatması olmayan hayvanlar" + çoklu seçimle toplu oluşturma | gün |
| 26 | "Tamamlandı" işaretlemek yıllık tekrar zincirini sessizce bitiriyor | Aşıyı yapan klinik gelecek yılın kuduz hatırlatmasını kaybeder | `scheduler.js:72-74` sonraki dönemi yalnız SMS başarılıysa üretiyor; `reminders.js:84-93` yalnız `setStatus('done')` | 'done'da repeat_days doluysa yeni kayıt + "Sonraki hatırlatma 06.09.2027 için oluşturuldu" | gün |
| 27 | Vefat eden / pasif hayvan kavramı yok; tek çare silmek | Ölen hayvana SMS gitmesi kliniğin en korktuğu şey; silmek geçmişi cascade siliyor | `tenant.js:32-42` pets'te status yok; `tenant.js:46` CASCADE | `active`, `deceased_at`; pasifleştirmede bekleyen hatırlatmalar `cancelled` | gün |
| 15 | Yarım yapılandırılmış sağlayıcı "kaydedildi" diyor; tüm SMS sessizce başarısız | #0 ile birleşince: klinik başlık onayını beklerken canlı sanıyor, hiçbir hatırlatma gitmiyor, kimse bilmiyor | `src/routes/clinic.js:101-115`; boş kimlikle → `?ok=Ayarlar kaydedildi.`; `views/dashboard.ejs:3` yalnız `console` kontrol ediyor | Kimlik yoksa kalıcı kırmızı uyarı; kayıttan sonra otomatik doğrulama + "Bağlantı doğrulandı" rozeti; 24 saatte 3+ `failed` → panelde uyarı | gün |
| 16 | "SMS gönder" tek tıkla para harcıyor: onay yok, önizleme yok | Yanlış tıklama gerçek para + yanlış bilgilendirme | `dashboard.ejs:31`, `owner_detail.ejs:61`, `reminders.ejs:28`'de `data-confirm` yok (altyapı `public/app.js:2-8`'de var) | `data-confirm="0532 ... numarasına gönderilecek (2 SMS). Onaylıyor musunuz?"` + metnin ilk 60 karakteri | saat |
| 17 | Varsayılan şablon gerçekte 3 SMS ücreti yazıyor; arayüz sadece "karakter" gösteriyor | İlk fatura 3 katı gelince güven biter | Varsayılan şablon `tenant.js:92` Türkçe karakterli → UCS-2, 67'şer parça; `public/app.js:26` yalnız `t.length + ' karakter'`; `src/sms/index.js:199` 460'ta sessiz kesme | "144 karakter · Türkçe · 3 SMS" hesaplayıcısı; varsayılanı kısaltın; "Türkçe karakterleri kaldır" seçeneği | gün |
| 20 | CSV içe aktarım herkesi `sms_opt_in=1` yapıyor | Hedef senaryonun tam ortası: eski listeyi aktarmak = "istemiyorum" diyene SMS atmak | `src/import/apply.js:126` sabit `sms_opt_in: 1`; `tenant.js:27` `DEFAULT 1`; `mapping.js:4-15`'te onay alanı yok | TARGET_FIELDS'e `sms_opt_in` + Evet/Hayır çözümleyici; eşleşmezse bilinçli radyo seçimi; önizlemede "kaç kişi izinli işaretlenecek" | gün |
| 21 | Opt-in ispatlanamıyor: ne zaman, nasıl, kim aldı kayıtlı değil | Şikayette klinik hiçbir şey gösteremez; izin değişikliği denetime düşmüyor | `tenant.js:27` tek bit; `src/routes/owners.js:92-104` update'te `audit()` yok | `sms_opt_in_at`, `_source`, `_by` sütunları + detayda gösterim + audit | gün |
| 22 | Şablona kampanya/reklam yazılmasını engelleyen kontrol yok | Her mesaj `iys:'0'` bilgilendirme bayrağıyla gidiyor; klinik indirim yazarsa 6563 m.12 + hesap kapanması | `clinic.js:88-89` tek doğrulama uzunluk; `src/sms/index.js:119` sabit `iys:'0'`; `docs/...` §3.6 bunu talep ediyor | Anahtar kelime taraması (indirim, kampanya, fırsat, %, TL, hediye) + engelleme; Ayarlar'a uyarı notu | gün |
| 5 | Liste 300 kayıtta sessizce kesiliyor ⚠ demo-blocker'dan indi | Demoda görünmez; kliniğin gerçek listesi yüklenince "kayıtlarım kayboldu" algısı | `tenant.js:167,169` `LIMIT 300`; `:222` 500; sayfada "daha fazla" metni yok (grep=0) | Hemen: "409 kayıttan ilk 300'ü gösteriliyor" satırı. Sonra: LIMIT/OFFSET | gün |
| 33 | Türkçe sıralama ve arama bozuk ⚠ important'tan yükseldi | "Ayşe", "İbrahim", "Şeyma" aranamıyor — Türkiye'de bir hasta listesinde bu ürünü bitirir | `q=AYŞE / ayse / ibrahim` → "Kayıt bulunamadı"; `q=AHMET` bulunuyor; sıralama: Zeynep → ahmet → Çağla → Ömer → İbrahim | `name_sort` sütunu (İ→i, ş→s, ğ→g…); hem `ORDER BY` hem `LIKE` bunun üzerinden | gün |
| 6 | Hayvan adıyla arama yok ⚠ demo-blocker'dan indi | Klinikte kişi "Boncuk'un sahibi" diye hatırlanır | `GET /sahipler?q=Boncuk` → "Kayıt bulunamadı"; `tenant.js:167` yalnız `o.name / o.phone` | `EXISTS (SELECT 1 FROM pets ...)`; placeholder "Sahip, hayvan adı veya telefon" | saat |
| 30 | Hata/uyarı bildirimi yok: SMS hataları, tavan aşımı, çöküş kimseye ulaşmıyor | "SMS'im gitmemiş, haberim olmadı" pilotu bitirir | `src/log.js` yalnız console; `grep "sentry\|alert\|notify" src/` → 0 | Kliniğe günlük özet; size Telegram/e-posta uyarısı; Sentry ücretsiz katman | gün |
| 34 | `owners.phone`'da UNIQUE kısıt yok | Tüm mükerrer-birleştirme mantığı telefonun tekil olduğunu varsayıyor | `tenant.js:24,30` UNIQUE değil; `owners.js:67`, `quick.js:44`, `apply.js:68,121` hep `byPhone().get()` | Mükerrerleri birleştirip `CREATE UNIQUE INDEX`; SQLITE_CONSTRAINT'i Türkçe mesaja çevirin | saat |
| 35 | Günlük tavan başarısız gönderimleri de sayıyor | Bozuk yapılandırma 200'lük kotayı ~66 hatırlatmayla tüketir | `dispatch.js:30-31` → `tenant.js:273` tüm satırları sayıyor | Tavanı `status='sent'` üzerinden hesaplayın | saat |
| **65** | **Pilot başarı kriteri ve kullanım ölçümü tanımlı değil** | Pilotun işe yarayıp yaramadığını ölçemezseniz ücretliye geçiş kararı hissiyata kalır | Üründe kullanım metriği yok; `views/admin.ejs:6` sütunlar yalnız Klinik/Telefon/Kullanıcı/Tavan/Durum | Pilot mutabakatına yazılı kriter: "30 günde ≥200 hatırlatma gönderildi, haftada ≥3 gün giriş, ≥%80 teslim". Süper yönetici paneline özet (#48) | gün |
| 36 | Kurulum sihirbazı / ilk gün kontrol listesi yok | Klinik parolayı değiştirince boş panele düşüyor | Yeni klinikte `GET /` tek sarı uyarı; menüde 8 sırasız bağlantı | 5 adımlı, tamamlanınca kaybolan kontrol listesi (klinik bilgisi → şablon → sağlayıcı → test SMS → CSV) — **#0'ın adımlarını da içine koyun** | gün |
| 7 | Marka yok: favicon 404, logo yok, adres `ts.net` ⚠ demo-blocker'dan indi | Görüşmede fark edilmez; kalıcı erişim verirken önemlidir | `/favicon.ico` → 404; "Teserix" kelimesi views/src'de hiç geçmiyor | SVG logo + favicon + footer (marka, sürüm, destek); `vet.teserix.com` Cloudflare Tunnel ile canlıya | gün |
| 43 | Destek kanalı, sürüm, yardım sayfası yok | Küçük klinikte kararı çoğu zaman "sorun olursa kimi arayacağım" belirler | `views/partials/footer.ejs` tamamen boş; menüde Yardım yok | "Teserix · v1.0.0 · Destek: 0xxx · Gizlilik"; kısa `/yardim` + örnek CSV | saat |
| 37 | Mobil deneyim zayıf | Personel muayenede telefondan bakacak | `public/style.css`'te `overflow` kuralı 0; hatırlatmalar 7 sütun; `input{font-size:15px}` iOS'ta zum yapar | `.table-wrap{overflow-x:auto}`, &lt;700px kart görünümü, 16px input, 40px düğme | gün |
| 39 | Hazır aşı takvimi presetleri yok | Bir yavruya karma+kuduz+parazit girmek üç ayrı form | `grep "kuduz\|karma\|preset"` → yalnız placeholder; `util.js:176-182` 5 genel tür | 6-8 kalıp (Kuduz 365, Karma 21, İç parazit 90, Dış parazit 30, Yıllık kontrol 365) | gün |

### C. Ücretli lansman öncesi

| # | Eksik | Neden önemli | Kanıt | Öneri | Efor |
|---|---|---|---|---|---|
| 29 | Abonelik / deneme / fatura akışı ne kodda ne belgede | İlk müşteriden para alırken ne kesildiği belirsiz; 5809 m.60/4 riski kendi belgenizde yazılı | `grep "fatura\|abonelik\|billing"` src/views → 0; master.db clinics'te plan alanı yok | Klinik kaydına plan + deneme_bitis; süreçte kimin fatura keseceği (SMS→sağlayıcı, yazılım→Teserix), e-arşiv (`docs/...` §3.4) — muhasebeci teyidi | hafta |
| 23 | Sahip silinince sms_log'da telefon/ad/mesaj süresiz kalıyor; hiç budama yok | KVKK m.7 silme talebine cevap verilemez | `owners.js:106-112` sert silme; `tenant.js:63-76` snapshot sütunları; `grep "DELETE FROM sms_log"` → 0 | Silmede maskeleme + saklama süreleri (sms_log 24 ay, audit_log 12 ay); ETK 3 yıl saklama çakışmasını avukata sorun | gün |
| 44 | Log rotasyonu yok; sms_log/audit_log/trash hiç budanmıyor | Disk dolarsa SQLite yazmaları kırılır; trash süresiz kişisel veri tutar | plist tek dosyaya yazıyor; `scripts/backup.js:46` yalnız backups/ buduyor; README:241 "elle silin" | newsyslog.d girdisi; 30 gün trash temizliği; yılda bir VACUUM | saat |
| 32 | Teslim raporu (DLR) yok; "Gönderildi" = sağlayıcı isteği kabul etti | Veteriner mutlaka "ulaştı mı?" diye soracak; komisyon modelinde ölçüm de buna bağlı | `grep "dlr\|delivery" src/` → 0; `dispatch.js:57-61` status 'sent'; `docs/saglayici-karsilastirmasi.md:72` İM webhook'u yazıyor | Kısa: rozetin altına açıklama. Orta: `sms_log.delivery_status` + İM webhook | gün |
| 40 | Sağlayıcı bakiyesi görünmüyor | Klinik bitişi ancak gönderim başarısız olunca öğreniyor; komisyon modelinde kontör tetikleyicisi | `src/sms/index.js`'te yalnız `send`; get-balance ucu kullanılmıyor | Panelde "Kalan SMS: 1.240" rozeti + eşik altı uyarı | gün |
| 31 | 3 günden uzun kesintide hatırlatmalar sessizce hiç gitmiyor | Bugünkü kesinti bunun ne kadar gerçekçi olduğunu gösterdi | `tenant.js:209-211` `date(due_date) >= date(?,'-3 days')` | Pencereyi ayarlanabilir yapın; açılışta "Kesinti oldu, 12 hatırlatma gitmedi — tek tıkla gönder" bandı | saat |
| 38 | Hatırlatmalar sayfası eksik: ekleme, arama/filtre, toplu işlem, opt-out rozeti yok | Günlük en çok kullanılacak ekran | `reminders.js:28-35` yalnız status+range; `reminders.ejs:15` başka sayfaya yolluyor; gönder düğmesi opt-in'e bakmıyor | "+ Yeni hatırlatma", arama, tarih aralığı, tür filtresi, toplu işlem, opt-in koşulu | gün |
| 41 | SMS geçmişi 300 kayıt, filtre/dışa aktarma yok | Klinik sağlayıcı faturasını sizin ekranınızla karşılaştıramazsa ilk fatura tartışması çıkar | `clinic.js:66` `recent(req.db, 300)`; `smslog.ejs` düz tablo | Ay seçici, durum filtresi, "CSV indir", başlıkta aylık özet | gün |
| 42 | Kliniğin tüm verisini geri alması eksik | "SmartVet'te yaşadığım kilitlenmeyi sizde de yaşar mıyım?" itirazının cevabı | `owners.js:38-49` tek uç; başlıklar yalnız sahip+hayvan | "Tüm verimi indir": hatirlatmalar.csv + sms-gecmisi.csv + hasta-listesi.csv | gün |
| 5b | Kalıcı sayfalama (LIMIT/OFFSET) | 300+ kayıtlı kliniklerde kaçınılmaz | `tenant.js:167,169,222` | Sayfalama + toplam sayı | gün |
| 52 | Hasta sahibine serbest metin SMS gönderilemiyor | "Tahlil sonucunuz çıktı", "yarın kapalıyız" gerçek klinik ihtiyacı | `grep "'manual'" src/` yalnız `dispatch.js:15` yorumunda; rota yok | Sahip sayfasına "Bu kişiye SMS gönder" (opt-in ve tavan otomatik) | gün |
| 53 | Randevu saati yok; tek şablon; tek telefon numarası | Saat yazmayan SMS telefon trafiği yaratır | `tenant.js:49` yalnız `due_date`; `:91-92` tek template; `:24` tek `phone` | `due_time` + `{saat}`; tür başına şablon; `owner_phones` tablosu | gün |
| 48 | Süper yönetici panelinde onboarding görünürlüğü yok | "Müşteri kullanıyor mu?" sorusunun tek cevabı telefon açmak | `views/admin.ejs:6` sütunlar | Kiracı verisine girmeden özet: son SMS tarihi, aylık gönderim, sağlayıcı türü, hasta sayısı | gün |
| 45 | Node sürümü sabitlenmemiş: üretim 26, CI 24 | `brew upgrade` node:sqlite API'sini kırabilir | `package.json` engines `>=24`; ci.yml node 24; üretim v26.5.0 | `brew pin node`; CI'ı 26'ya alın; engines `>=24 <27` | saat |
| 46 | Güncelleme/dağıtım süreci tanımsız | Migrasyonlar geri alınamaz; güncelleme öncesi otomatik yedek yok | `service.sh` yalnız install/restart/stop/status/logs; `/api/version` → `unknown` | `service.sh update`: yedek → pull → `npm ci` → test → restart → health, hata olursa geri al | gün |
| 51 | Tek Mac mini + ev interneti: yedek yol yok | Modem/ISP/donma tüm hizmeti durdurur | Uygulama+veri+yedek+erişim aynı kutuda | Sözleşmeye "en iyi çaba, kesinti taahhüdü yoktur"; UPS; 3. klinikten itibaren VPS | hafta |

### D. Nice (sonra)

| # | Eksik | Kanıt | Öneri |
|---|---|---|---|
| 54 | Hayvan detay sayfası yok | `GET /hayvanlar/:id` yok | Detay + o hayvanın hatırlatma geçmişi |
| 55 | Kişi bazlı KVKK dışa aktarımı yok | `owners.js:38-50` yalnız tüm klinik | Sahip detayına "Bu kişinin verilerini indir" |
| 56 | Kullanıcı kendi adını/e-postasını değiştiremiyor | `views/password.ejs` yalnız 3 parola alanı | "Hesabım" sayfası |
| 57 | Ölü kod ve kopyalanmış `csvCell` | `master.js:115`, `tenant.js:137,171` çağrılmıyor; `owners.js:31-36` ikinci `csvCell` | Silin / tek kaynağa indirin |
| 58 | `sms_log(owner_id)` indeksi yok | `tenant.js:77,87` yalnız created/kind | `idx_sms_owner(owner_id, id DESC)` |
| 59 | Doğum günü mesajı yok | `tenant.js:39` `birth_date` hiç kullanılmıyor | Sonraki sürüm |
| 50 | Erişilebilirlik temelleri yok ⚠ important'tan indi | `aria-\|thead\|scope=` → 0 (artı: `label for` ve `lang="tr"` doğru) | `<thead>`+`scope="col"`, `role="status"`, atlama bağlantısı |
| 63 | WhatsApp kanalı yok | `docs/saglayici-karsilastirmasi.md` Meta WhatsApp'ı inceliyor, üründe karşılığı yok | Talep doğrularsa yol haritasına; görüşmede sorun (bkz. §5) |

*(Önceki #60 — test SMS'in opt-in atlaması — kasıtlı tasarım olduğu için madde listesinden çıkarıldı.)*

---

## 4) Üç aşamalı plan

### Aşama 0 — Bu hafta, görüşme öncesi (2-3 saat)

- `src/csv.js:37/44` `let c` düzeltmesi + CRLF testi *(#2)*
- Demo verisi betiği + kalıcı "Demo Veteriner Kliniği" kiracısı *(#3)*
- Tek sayfalık değer/fiyat belgesi — **3 hacim senaryosu için somut aylık ücret** *(#9)*
- İlk-SMS yolunun görüşme metni: "yazılım aynı gün, ilk SMS 3-7 iş günü" *(#0-a)*
- README'deki yanlış süper yönetici cümlesi *(#28)*
- Teserix'in kendi onaylı başlıklı hesabı (demo SMS için, **yalnızca kendi mesajlarınıza**) *(#4, #64)*

**Sonra randevu alın.** Demoyu dizüstünüzde localhost'tan yapın; canlı adres vermeyin.

### Aşama 1 — Pilot klinikten önce, gerçek hasta verisi girilmeden (3-4 hafta)

**Ürün ve göç (pilotun olmazsa olmazı):**
- Aşı geçmişi sütunlarının içe aktarımı + otomatik hatırlatma üretimi *(#24)* ve toplu hatırlatma *(#25)* — **tek en kritik madde**
- Türkçe arama/sıralama *(#33)*, hayvan adıyla arama *(#6)*, liste kırpma uyarısı *(#5)*
- "Tamamlandı"da tekrar zinciri *(#26)*; pasif/vefat *(#27)*; aşı presetleri *(#39)*
- Gönderim onayı/önizlemesi *(#16)*, SMS parça/maliyet hesaplayıcısı + kısa varsayılan şablon *(#17)*
- Sağlayıcı doğrulaması + kalıcı uyarı *(#15)*; **sağlayıcı kurulum adım listesi ve durum takibi** *(#0)*; kurulum kontrol listesi *(#36)*
- Opt-in kaynağı/tarihi *(#21)*, CSV'de onay sütunu *(#20)*, şablon reklam taraması *(#22)*
- Telefon UNIQUE *(#34)*; tavan yalnız 'sent' *(#35)*

**Altyapı ve güvenlik:**
- **FileVault'u açın** + kurtarma anahtarı kasaya *(#61)*; APP_SECRET kasaya *(#47)*
- LaunchDaemon + `pmset -a autorestart 1` + fiş testi *(#1, #14)*; dış izleme + telefona uyarı
- Private GitHub deposu *(#11)*; `TRUST_PROXY=0` *(#10)*
- Dış yedek + ayrı launchd yedek işi + geri yükleme tatbikatı *(#12, #13)*
- Uyarı katmanı (Sentry + günlük özet) *(#30)*; kesinti telafi bandı *(#31)*
- SMS ile parola sıfırlama + IP kovası ayrımı + ikinci yönetici hesabı *(#8, #62)*

**Hukuk (⚠ Aşama 3'ten buraya taşındı):**
- Gizlilik + Kullanım Şartları + Çerez sayfaları *(#18)*
- **Veri işleyen sözleşmesi** — KVKK m.12/2, ücretsiz pilotta da zorunlu *(#19)*
- Klinik için hasta sahibi aydınlatma metni örneği

**Materyal:** klinik açma kontrol listesi, sağlayıcı kurulum rehberi (e-Devlet/KEP/başlık, ekran görüntülü), 3-4 dk ekran kaydı, 1 sayfa personel kılavuzu, **yazılı pilot mutabakatı + ölçülebilir başarı kriteri** *(#65)*

### Aşama 2 — Ücretli lansmandan önce (1-2 ay)

- Fatura/abonelik süreci: ücret, kimin kestiği, e-arşiv, tahsilat; klinik kaydına plan + deneme_bitis *(#29)*
- Saklama/imha politikası koda *(#23, #44)*
- Teslim raporu webhook'u *(#32)*; bakiye rozeti *(#40)*
- Hatırlatmalar sayfası tam sürüm *(#38)*; SMS geçmişi filtre + CSV *(#41)*; "Tüm verimi indir" *(#42)*
- Sayfalama *(#5b)*; serbest metin SMS *(#52)*; saat + tür bazlı şablon + ikinci telefon *(#53)*
- Marka/alan adı *(#7)*, destek/yardım sayfası *(#43)*, mobil *(#37)*
- Süper yönetici onboarding paneli *(#48)*; `brew pin node` + `service.sh update` *(#45, #46)*
- 3. klinikten itibaren VPS değerlendirmesi *(#51)*

---

## 5) Görüşmede sorulacak sorular

**Önce ihtiyacı doğrulayın (yeni, en kritik üçü):**

1. **"Şu an kullandığınız programdan neden çıkıyorsunuz — SMS'i zaten gönderiyor muydu?"** Mevcut yazılım SMS'i paket içinde veriyorsa değer öneriniz "daha ucuz/daha basit" olmak zorunda; vermiyorsa "hiç yok"tan geliyorsunuz. Tüm konumlandırma bu cevaba bağlı.
2. **"Hasta sahiplerine SMS mi, WhatsApp mı ulaşıyor? Sizi hangisinden arıyorlar?"** WhatsApp beklentisi yüksekse "sadece SMS" ilk itiraz olur; `docs/saglayici-karsilastirmasi.md` bu kararın verisini içeriyor. *(#63)*
3. **"Toplu SMS için bir sağlayıcı hesabınız var mı? Yoksa e-Devlet + KEP ile hesap açmak sizin için engel mi?"** İlk gerçek SMS'e giden tüm yol bu cevaba bağlı *(#0)*; hesabı olan bir klinikte 1 haftalık avantaj kazanırsınız.

**Sonra kapsamı belirleyin:**

4. **"Sisteminizde kaç hasta kaydı var?"** 300 üstüyse sayfalama *(#5)* pilot öncesi zorunlu.
5. **"Aldığınız listede son aşı tarihi ve aşı türü sütunu var mı? Bir Excel örneği alabilir miyim?"** *(#24)*'ün kapsamını tek başına belirler — **gerçek dosyayı isteyin.**
6. **"Mevcut 500 hastanızın aşı tarihlerini tek tek girmek zorunda kalsanız kullanır mıydınız?"** *(#25)*
7. **"Aşıyı yaptıktan sonra gelecek yılın hatırlatmasını sistem otomatik açsın mı?"** *(#26)*
8. **"Bir hasta vefat ettiğinde kaydı silmek mi istersiniz, geçmişi kalsın ama SMS gitmesin mi?"** *(#27)*
9. **"Hatırlatma SMS'inde saat yazmazsa sizi ararlar mı?"** *(#53)*
10. **"Hasta sahiplerinden SMS için nasıl izin alıyorsunuz — sözlü mü, formda imza mı?"** *(#20/#21)* ve aydınlatma metni ihtiyacı.
11. **"Şu an SMS için ayda ne kadar ödüyorsunuz, kaç mesaj gönderiyorsunuz?"** Fiyatlandırma + *(#17)*'nin aciliyeti.
12. **"Personeliniz telefondan mı, masadaki bilgisayardan mı çalışacak? Kaç kişi?"** *(#37)*
13. **"'Tahlil sonucunuz çıktı' gibi tek seferlik mesajları nasıl gönderiyorsunuz?"** *(#52)*

**Hazır cevabınız olması gerekenler (sormadan onlar soracak):**

- *"Verilerim nerede duruyor?"* → Dürüst cevap: "Türkiye'de, benim işlettiğim bir sunucuda, her kliniğin verisi ayrı şifreli dosyada; yedekler günlük ve ayrıca dışarıda tutuluyor." **Bu cümleyi söyleyebilmeniz için önce FileVault'u açın *(#61)* ve dış yedeği kurun *(#12)*.**
- *"KVKK'ya uygun mu?"* → "Hastanız hayvan olduğu için tuttuğumuz veri sıradan iletişim verisi, özel nitelikli sağlık verisi değil. Aramızda KVKK'nın istediği yazılı veri işleyen sözleşmesini imzalıyoruz." *(#19)*
- *"Sizden ayrılırsam verim ne olur?"* → "Tüm listeyi tek tıkla CSV indirirsiniz, kilit yok." *(#42)*
- *"Ne kadar?"* → Hacim senaryolu 3 fiyat, doğaçlama yok. *(#9)*

*Bonus:* "Sağlayıcı faturasının sizin adınıza gelmesi mi, benim üzerimden olması mı daha iyi?" — İş modelinin *(#29)* tümü bu cevaba bağlı. **Ancak cevap ne olursa olsun kontörü kendi adınıza satmayın: 5809 m.60/4 abonelik iptali sebebi *(#64)*.**

---

## 6) Riskler ve kabul edilen sınırlamalar

**Kabul edilen sınırlamalar (ilk 1-2 klinik için makul, ama yazılı söyleyin):**

- **Tek makine, tek nokta.** Uygulama, veri, yedek ve dış erişim aynı Mac mini'de; ev interneti/elektriği hizmetin parçası. Sözleşmeye "en iyi çaba ile sunulur, kesinti taahhüdü yoktur" yazın. 3. klinikten itibaren VPS planlı.
- **Kuruluma dış bağımlılık.** İlk SMS'in tarihi sizin elinizde değil (e-Devlet + KEP + başlık onayı). Pilot mutabakatında "hizmet, başlık onayı alındığı gün başlar" diye yazın.
- **Parola sıfırlama sizden geçiyor.** Klinik yöneticisi personelinkini sıfırlayabiliyor *(`views/users.ejs:21`)*, ama kendi parolası için sizi arıyor ve uygulamada hiç e-posta altyapısı yok. Destek SLA'sına yazın + her klinikte ikinci yönetici hesabı açın.
- **Manuel onboarding.** İlk 5-10 klinik için sorun değil; ölçeklenmez.

**Aktif riskler (öncelik sırasıyla):**

1. **Kuruluma varamama riski (yeni ve en büyüğü).** Sözleşme imzalanır, klinik e-Devlet/KEP/başlık adımlarını tamamlayamaz veya erteler, iki hafta hiçbir SMS gitmez, ilgi söner. Üründe bu süreci yöneten hiçbir şey yok *(#0)*. Onboarding'in kendisi ürünün parçası olmalı: adım listesi, durum, takip araması.
2. **Sessiz başarısızlık riski.** Servis 5+ dakika kapalıydı, kimse fark etmedi; yedek de uygulamaya bağlı olduğu için o gece alınmayacaktı. Ücretli kullanımda karşılığı "kliniğin bir haftalık hatırlatmaları hiç gitmedi ve kimse bilmiyor". *(#1, #12, #15, #30, #31)*
3. **Veri güvenliği algısı ve gerçeği.** Disk şifrelemesi kapalı (`fdesetup status` → FileVault is Off); tüm klinik verisi, yedekler ve APP_SECRET aynı şifresiz diskte, bir evde duran makinede. Sağlayıcı bilgilerinin AES-GCM şifrelemesi fiziksel erişimde anlamsız. 30 dakikada kapanan, kapanmazsa hem hukuken hem satışta savunulamayan bir açık. *(#61)*
4. **Hukuki risk.** Aydınlatma metni, veri işleyen sözleşmesi ve onay izi yok; içe aktarılan herkes otomatik "izinli" işaretleniyor *(`apply.js:126`, `tenant.js:27`)*. Bunlar **ücretsiz pilotta da** gerekli — yükümlülüğü para değil veri işleme doğurur. "Kapsam dışı" bırakılan KVKK onay takibi **geri alınmalıdır**.
5. **Model riski (yeni).** Kliniklere kendi hesabınızdan SMS/kredi vermek — deneme kredisi dahil — kendi araştırmanızın uyardığı 5809 m.60/4 ve m.19/ö ihlalidir *(docs/ileti-merkezi-bayilik-yolu.md §1-2)*. Demo SMS'i yalnız kendi mesajınız olarak, kendi başlığınızdan, görüşmedeki kişiye gönderin. *(#64)*
6. **İçerik riski.** Her mesaj `iys:'0'` bilgilendirme bayrağıyla gidiyor ama şablona kampanya yazılmasını engelleyen kontrol yok. Tek bir kliniğin "%20 indirim" yazması hem 6563 cezası hem sağlayıcı hesabınızın kapanması. *(#22)*
7. **Beklenti riski.** "SmartVet'ten çıkın, bize geçin" vaadi bugün verilemez: göç aşı geçmişini taşımıyor ve toplu hatırlatma üretimi yok *(#24, #25)*. Vaadinizi dar tutun: *"randevu ve aşı hatırlatma SMS'i"* — klinik yönetim yazılımı değil.
8. **Fatura sürprizi riski.** Varsayılan şablon 3 SMS ücretlendiriliyor, arayüz göstermiyor, bakiye görünmüyor, teslim raporu yok. *(#17, #40, #32)*
9. **Anahtar kaybı riski.** APP_SECRET tek kopya, tek makinede; 5 dakikalık bir işlemle (parola kasası) tamamen ortadan kalkar. *(#47)*