# Veteriner SMS

Veteriner klinikleri için **çok kiracılı (multi-tenant) SMS hatırlatma** uygulaması.
Her klinik kendi hasta sahiplerini, hayvanlarını ve aşı/kontrol/parazit hatırlatmalarını
kaydeder; zamanlayıcı her gün uygun saatte hasta sahiplerine SMS gönderir.

- Node 24+ / Express 5 / EJS, yerleşik `node:sqlite` (harici veritabanı yok)
- Her klinik için **ayrı SQLite dosyası** (`data/tenants/<12hex>.db`); ortak `master.db`
  yalnızca klinik listesi, kullanıcılar, oturumlar ve denetim kaydını tutar
- SMS sağlayıcıları: **Netgsm**, **İleti Merkezi**, Twilio (isteğe bağlı), Konsol (test)
- Gece yedeği, günlük SMS tavanı, denetim kaydı, CSV içe/dışa aktarma

## Veri düzeni

```
data/                         (DATA_DIR)
├── master.db                 klinikler, kullanıcılar, oturumlar, denetim kaydı
├── tenants/
│   ├── 3f9a1c2b7d4e.db       bir kliniğin tüm verisi: sahipler, hayvanlar,
│   └── ...                   hatırlatmalar, sms_log, ayarlar (şifreli sağlayıcı bilgisi)
├── backups/
│   ├── 2026-09-02/           gece yedeği (VACUUM INTO kopyaları)
│   │   ├── master.db
│   │   ├── tenants/*.db
│   │   └── .done             "bugün alındı" işareti
│   └── 2026-09-03/
└── trash/
    └── 3f9a1c2b7d4e-<ts>.db  silinen klinikler (elle temizlenir)
```

Klinik verileri birbirinden dosya düzeyinde ayrıdır: bir kullanıcı yalnızca kendi kliniğinin
dosyasını açabilir (`clinicScope`). Süper yönetici rutin kullanımda klinik verisine giremez; yalnızca kurtarma amacıyla klinik kullanıcılarına geçici parola üretebilir ve bu işlem denetim günlüğüne IP ile yazılır.

## Gereksinimler

- **Node.js >= 24** (`node:sqlite` için zorunlu; 22 çalışmaz)
- veya Docker (imaj `node:24-bookworm-slim` üzerine kurulur)

## Hızlı başlangıç (yerel)

```bash
cp .env.example .env          # APP_SECRET'ı mutlaka değiştirin
npm install
npm start                     # http://localhost:3000
```

İlk açılışta hiç kullanıcı yoksa `.env` içindeki `ADMIN_EMAIL` / `ADMIN_PASSWORD` ile bir
**süper yönetici** oluşturulur. Alternatif:

```bash
npm run create-admin -- admin@ornek.com GucluParola123 "Ad Soyad"
```

(Aynı e-posta varsa parolası sıfırlanır.) Geliştirme için `npm run dev` (`--watch`).

## Ortam değişkenleri

Kaynak: `src/config.js`. `.env` dosyası varsa yüklenir; gerçek ortam değişkenleri `.env`'i
ezer. `SKIP_DOTENV=1` ile `.env` tamamen yok sayılır (testler için).

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `3000` | Dinlenen port |
| `NODE_ENV` | – | `production`: `Secure`/`__Host-` çerez, HSTS, hata ayrıntıları gizli, yapılandırma hataları uygulamayı **durdurur** |
| `TRUST_PROXY` | `0` | `1`: ters vekil arkasında; `cf-connecting-ip` gerçek IP olarak kullanılır |
| `APP_SECRET` | – | **En az 32 karakter**; sağlayıcı hesap bilgileri bununla şifrelenir (AES-256-GCM). `.env.example` yer tutucusu üretimde reddedilir |
| `APP_ORIGIN` | – | Dış adres, ör. `https://vet.example.com`. Üretimde zorunlu; POST isteklerinde Origin/Referer bununla karşılaştırılır |
| `DATA_DIR` | `./data` | `master.db`, `tenants/`, `backups/`, `trash/` kökü (çalışma dizinine göre çözülür) |
| `ADMIN_EMAIL` | – | Hiç kullanıcı yokken açılışta oluşturulacak süper yöneticinin e-postası |
| `ADMIN_PASSWORD` | – | Aynı süper yöneticinin parolası (en az 8 karakter, harf + rakam) |
| `ENABLE_SCHEDULER` | kapalı | `1`: otomatik hatırlatma gönderimi ve gece yedeği açık. **Yalnızca tek kopyada** |
| `SCHEDULER_INTERVAL_SECONDS` | `60` | Zamanlayıcı kontrol aralığı (alt sınır 15) |
| `BACKUP_HOUR` | `3` | İstanbul saatiyle bu saatten sonra günde bir kez yedek (0–23) |
| `BACKUP_RETENTION_DAYS` | `14` | Bu günden eski yedek klasörleri silinir (alt sınır 1) |
| `APP_VERSION` | `1.0.0` | `/api/version` çıktısındaki sürüm (isteğe bağlı) |

`APP_SECRET` üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

## Roller ve ilk kurulum akışı

| Rol | Kapsam | Yetki |
|---|---|---|
| `superadmin` | Klinik bağımsız | `/admin`: klinik oluşturma/durdurma/silme, SMS tavanı, yönetici parolası sıfırlama, `/admin/denetim` |
| `admin` | Bir klinik | Her şey + `/ayarlar` (SMS sağlayıcısı, şablon, saatler) + `/kullanicilar` + `/iceaktar` |
| `staff` | Bir klinik | Sahip/hayvan/hatırlatma kayıtları, elle gönderim, SMS geçmişi |

1. Süper yönetici `/admin` üzerinden **klinik + klinik yöneticisi** oluşturur; ekranda
   **geçici parola** gösterilir (bir kez).
2. Klinik yöneticisi bu parolayla `/giris` yapar; ilk girişte `/sifre` sayfasına yönlendirilir ve
   parolasını değiştirmeden başka sayfa açamaz.
3. Yönetici `/ayarlar` altında klinik adı/telefonu, SMS sağlayıcısı, gönderici başlığı ve şablonu
   girer; "Test SMS" ile dener.
4. Yönetici `/kullanicilar` altında personel ekler (yine geçici parola ile).

## Günlük kullanım

- **Hızlı kayıt** (`/hizli-kayit`): tek formda sahip + hayvan + ilk hatırlatma. Telefon numarası
  zaten kayıtlıysa mevcut sahibe hayvan eklenir.
- **Hasta sahipleri** (`/sahipler`): arama, düzenleme, SMS izni (opt-in), CSV dışa aktarma
  (`/sahipler/disa-aktar.csv`).
- **Hatırlatmalar** (`/hatirlatmalar`): bugün/yaklaşan/gecikmiş listeleri, durum değiştirme,
  **Şimdi gönder** (zamanlayıcıyı beklemeden tek hatırlatmayı gönderir; saatte en fazla 30).
- **SMS geçmişi** (`/sms`): son 300 gönderim, sağlayıcı yanıtı ve hata metni.
- **Özet** (`/`): bugün gönderilecekler, aylık sayaçlar, **günlük SMS sınırı** kullanımı.

### Günlük SMS sınırı

İki tavan vardır; küçük olan geçerlidir:

- Süper yöneticinin klinik için belirlediği `sms_daily_cap` (varsayılan 300)
- Kliniğin kendi `/ayarlar` sayfasındaki günlük sınır (varsayılan 200)

Tavan dolunca gönderim yapılmaz, `sms_log`'a yazılmaz; günde bir kez `sms.cap` denetim satırı
düşülür. Sayaç İstanbul gününe göre `sms_log`'dan hesaplanır (yeniden başlatmadan etkilenmez).

## SMS sağlayıcıları

Sağlayıcı ve hesap bilgileri klinik başına `/ayarlar` sayfasından girilir; hesap bilgileri
`APP_SECRET` ile şifrelenerek kliniğin kendi dosyasında saklanır. Alıcı numaralar
`905XXXXXXXXX` biçimine normalize edilir.

| Sağlayıcı | Gerekli bilgiler | Notlar |
|---|---|---|
| **Netgsm** | Kullanıcı adı (usercode/abone no) + **API şifresi** | REST v2 (`/sms/rest/v2/send`, Basic auth). `msgheader` = Netgsm panelinde **onaylı mesaj başlığı** (en fazla 11 karakter). Alıcı **10 hane** (`5XXXXXXXXX`) gönderilir. Netgsm panelinde API erişimi ve gerekiyorsa IP izni açık olmalı (hata 30). |
| **İleti Merkezi** | API Key + API Hash | `/v1/send-sms/json`; gönderici başlığı panelde **onaylı** olmalı (hata 453). `iys=0` (bilgilendirme mesajı) ile gönderilir. |
| **Twilio** (isteğe bağlı) | Account SID + Auth Token | Gönderici `+90…` (E.164) biçiminde Twilio numarası. |
| **Konsol** (test) | – | Gerçek SMS gitmez; maskelenmiş numara ve karakter sayısı loga yazılır. Yeni kliniklerin varsayılanı. |

Sağlayıcı değiştirildiğinde eski hesap bilgileri silinir; aynı sağlayıcıda alanlar boş
bırakılırsa mevcut bilgiler korunur.

### Şablon yer tutucuları

Varsayılan şablon:

```
Sayın {sahip}, {hayvan} adlı dostunuzun {tarih} tarihinde {tur} randevusu vardır. Bilgi için: {klinik_tel} - {klinik}
```

| Yer tutucu | Değer |
|---|---|
| `{sahip}` | Hasta sahibinin adı |
| `{hayvan}` | Hayvanın adı |
| `{tarih}` | Hatırlatma tarihi (GG.AA.YYYY) |
| `{tur}` | Hatırlatma başlığı, yoksa tür adı (Aşı, Kontrol, Parazit (iç/dış), Kısırlaştırma, Diğer) |
| `{klinik}` | Ayarlardaki klinik adı |
| `{klinik_tel}` | Ayarlardaki klinik telefonu |

Şablon en fazla 320, gönderilen mesaj en fazla 460 karakter.

## Zamanlayıcı kuralları

`ENABLE_SCHEDULER=1` ise her `SCHEDULER_INTERVAL_SECONDS` saniyede bir tüm aktif klinikler
sırayla işlenir:

1. Klinik ayarında zamanlayıcı kapalıysa (`scheduler_enabled=0`) atlanır.
2. **Gönderim saati penceresi** (İstanbul saati, varsayılan 09:00–20:00, `/ayarlar`) dışında
   hiçbir şey gönderilmez.
3. Bir hatırlatma "bugün gönderilecek" sayılır eğer
   `due_date - notify_days_before <= bugün` **ve** `due_date >= bugün - 3 gün`.
   Yani 3 günden fazla geçmiş hatırlatmalar otomatik gönderilmez; **Gecikmiş** listesinde kalır.
4. SMS izni kapalı sahiplere gönderilmez.
5. Başarısız denemeden sonra **4 saat** beklenir; **3. başarısız denemede** durum `failed` olur.
6. Başarılı gönderimde durum `sent`; `repeat_days` doluysa aynı türde yeni bir hatırlatma
   `due_date + repeat_days` tarihine otomatik açılır (ör. yıllık aşı için 365).
7. Günlük tavan dolunca o klinik için o tur biter.

Gece yedeği de aynı döngüden `BACKUP_HOUR` sonrası günde bir kez tetiklenir.

## CSV içe aktarma (`/iceaktar`, yalnızca klinik yöneticisi)

1. Excel'de **Dosya → Farklı Kaydet → "CSV UTF-8 (virgülle ayrılmış)"** seçin. Ayırıcı `,` veya
   `;` olabilir, ilk satır başlık olmalı.
2. `/iceaktar` sayfasında dosyayı yükleyin (saatte en fazla 5 yükleme).
3. **Sütun eşleme** ekranında hangi sütunun sahip adı, telefon, hayvan adı, tür, son
   aşı/kontrol tarihi olduğunu seçin; ön izlemede satırlar `new_owner` / `add_pet` /
   `skip_duplicate` / `error` olarak etiketlenir.
4. Onaylayın. **Telefon numarası** tekilleştirme anahtarıdır: aynı numara zaten varsa sahip yeniden
   oluşturulmaz, hayvan mevcut sahibe eklenir; aynı sahipte aynı adlı hayvan atlanır.
5. Hatalı satırlar (geçersiz telefon, boş ad vb.) sonuç ekranından **hata CSV'si** olarak indirilir;
   düzeltip yeniden yükleyebilirsiniz.

Dışa aktarma için `/sahipler/disa-aktar.csv` (UTF-8 BOM'lu, Excel'de doğrudan açılır).

## Yedekleme ve geri yükleme

### Otomatik

Zamanlayıcı açıkken her gün `BACKUP_HOUR` (İstanbul) sonrası ilk turda:
`PRAGMA wal_checkpoint(TRUNCATE)` + `VACUUM INTO` ile `master.db` ve her klinik dosyası
`data/backups/YYYY-MM-DD/` altına kopyalanır, `.done` yazılır, `BACKUP_RETENTION_DAYS`'ten eski
klasörler silinir. Yedek dosyaları tutarlı, tek parça SQLite dosyalarıdır (WAL yok).

### Elle

```bash
npm run backup
# Docker:
docker compose exec veteriner-sms node scripts/backup.js
```

### Dışarıya kopya (örnek)

```bash
# Volume içindeki son yedeği tar olarak sunucuya al
docker run --rm -v veteriner_sms_data:/data -v "$PWD":/out alpine \
  sh -c 'cd /data/backups && tar czf /out/veteriner-yedek-$(date +%F).tgz $(ls | tail -1)'
# sonra rsync/scp/rclone ile başka bir makineye taşıyın
```

### Geri yükleme tatbikatı

1. Konteyneri durdurun: `docker compose stop veteriner-sms` (WAL/SHM dosyaları kapansın).
2. Volume içine dosyaları geri koyun:
   ```bash
   docker run --rm -v veteriner_sms_data:/data alpine sh -c '
     B=/data/backups/2026-09-02
     test -f $B/master.db || { echo "yedek bulunamadı: $B"; exit 1; }
     rm -f /data/master.db-wal /data/master.db-shm /data/tenants/*.db-wal /data/tenants/*.db-shm
     cp $B/master.db /data/master.db
     [ -n "$(ls $B/tenants/*.db 2>/dev/null)" ] && cp $B/tenants/*.db /data/tenants/
     chown -R 1000:1000 /data && chmod 700 /data /data/tenants && chmod 600 /data/master.db /data/tenants/*.db 2>/dev/null; true'
   ```
   (Tek bir klinik için yalnızca o kliniğin `tenants/<id>.db` dosyasını kopyalayın.)
3. Başlatın: `docker compose start veteriner-sms`; `/api/health` ve `/admin` ile doğrulayın.
4. Yerel kurulumda aynı işlem: uygulamayı durdur, `data/` altına kopyala, başlat.

Yeni bir sunucuya taşırken **aynı `APP_SECRET`** kullanın; aksi halde şifreli sağlayıcı bilgileri
çözülemez ve her klinik `/ayarlar`'dan yeniden girmek zorunda kalır.

### Silinen klinikler

`/admin` üzerinden silinen kliniğin dosyası **silinmez**, `data/trash/<id>-<zaman>.db` olarak
taşınır; klinik kaydı ve o kliniğin kullanıcı hesapları `master.db`'den silinir. Geri almak
için: `/admin`'den kliniği yeniden oluşturun (yeni bir kimlik alır), uygulamayı durdurun,
`data/trash/` içindeki dosyayı `data/tenants/<yeni-id>.db` olarak kopyalayın ve başlatın.
Bu klasör otomatik temizlenmez; KVKK/saklama politikanıza göre elle silin.

## Ev sunucusu (Mac mini) kurulumu

Uygulama bu depodan doğrudan `launchd` ile çalışır; Docker gerekmez. Dosyalar `deploy/mac-mini/` altındadır.

```bash
deploy/mac-mini/service.sh install    # LaunchAgent olarak kur ve başlat (kullanıcı oturumu açıkken çalışır)
deploy/mac-mini/service.sh status     # durum + /api/version
deploy/mac-mini/service.sh logs       # ~/Library/Logs/veteriner-sms.log
sudo deploy/mac-mini/service.sh install   # LaunchDaemon: açılışta, kullanıcı girişi olmadan da çalışır (önerilen)
```

`.env` üretim değerleriyle doldurulmalı: `NODE_ENV=production`, `TRUST_PROXY=1`, rastgele `APP_SECRET`,
`APP_ORIGIN` içinde dışarıdan kullanılan tüm adresler (virgülle).

**Dışa açma, seçenek 1: Tailscale Funnel** (en hızlı; alan adı gerekmez, sertifika otomatik)

```bash
/Applications/Tailscale.app/Contents/MacOS/Tailscale funnel --bg 3000
# -> https://<makine>.<tailnet>.ts.net/   (kapatmak: tailscale funnel --https=443 off)
```

**Dışa açma, seçenek 2: Cloudflare Tunnel** (kendi alan adınız, ör. vet.teserix.com)

```bash
brew install cloudflared
cloudflared tunnel login                      # tarayıcıda Cloudflare hesabı, alan adını seçin (bir kez)
deploy/mac-mini/setup-cloudflare.sh vet.teserix.com   # tünel + DNS kaydı + LaunchDaemon + APP_ORIGIN
```

Notlar:
- Elektrik kesintisinden sonra kendiliğinden açılması için: `sudo pmset -a autorestart 1`.
- Yedekler `data/backups/` altında; `data/` klasörünü Time Machine dışında da düzenli kopyalayın.
- Port yönlendirme (router) gerekmez; her iki yöntem de dışarıya yalnızca HTTPS verir.

## Docker / Dokploy dağıtımı

İmaj: iki aşamalı `node:24-bookworm-slim`, `node` kullanıcısıyla çalışır, `/app/data` volume,
`HEALTHCHECK` `/api/health`, derleme zamanı `/app/BUILD_TIME` → `/api/version`.

```bash
# 1) Ortak Docker ağı (bir kez; cloudflared ile aynı ağ)
docker network create teserix_network || true

# 2) Dokploy: Compose türünde uygulama, kaynak = bu depo, dosya = docker-compose.yml
#    Environment sekmesinde en az:
#      APP_SECRET=<48 bayt base64>
#      APP_ORIGIN=https://vet.example.com
#      ADMIN_EMAIL=... ADMIN_PASSWORD=...   (yalnızca ilk açılış için gerekli)

# 3) Cloudflare Tunnel ingress:
#      hostname: vet.example.com  ->  service: http://veteriner-sms:3000

# 4) Elle çalıştırmak isterseniz:
docker compose up -d --build
docker compose logs -f veteriner-sms
```

Kurallar:

- **Tek kopya.** SQLite + zamanlayıcı: `replicas` artırılmaz, ikinci bir ortamda
  `ENABLE_SCHEDULER=1` verilmez (çift SMS riski).
- `TRUST_PROXY=1` compose'da sabittir; Cloudflare `cf-connecting-ip` başlığı gerçek IP olarak
  kullanılır (giriş ve POST hız sınırları buna dayanır).
- `expose: 3000` — host portu açılmaz; erişim yalnızca tünelden.
- Loglar `json-file`, 3 × 10 MB döner.
- Yeniden dağıtımda `stop_grace_period: 30s`: önce çalışan zamanlayıcı turu (sağlayıcıya
  giden istek dahil) bitirilir, sonra sunucu kapanır ve veritabanları kapatılır; 25 sn'de
  bitmezse süreç zorla kapanır.

### CI ve dağıtım bildirimi

- `.github/workflows/ci.yml`: her push/PR'da Node 24 ile `npm ci`, `npm test`, `docker build`
  ve imajın `/api/health` ile ayağa kalktığının kontrolü (push yok).
- `.github/workflows/deploy-notify.yml`: `main`'e push sonrası `GET $SITE/api/version` 10 dk
  boyunca yoklanır; `buildTime` dağıtılan commit'in zamanından yeniyse "canlıda", değilse
  "doğrulanamadı" mesajı Google Chat'e düşer. Yalnızca imaja giren dosyalar değiştiyse çalışır.
  Elle tetikleme (`workflow_dispatch`) yalnızca webhook testi gönderir.

Gerekli depo ayarları (Settings → Secrets and variables → Actions):

| Ad | Tür | Değer |
|---|---|---|
| `SITE` | Variable | `https://vet.example.com` (sondaki `/` olmadan) |
| `GOOGLE_CHAT_WEBHOOK_URL` | Secret | Google Chat alanı webhook adresi |

İkisi de tanımlı değilse iş akışı uyarı verip atlar; başka secret gerekmez.

## Güvenlik özeti

- **Kiracı yalıtımı:** her klinik ayrı dosya; istek başına yalnızca kullanıcının kendi kliniği
  açılır (`clinicScope`). Süper yönetici klinik hasta verisi göremez, yalnızca `master.db`
  yönetir; kurtarma amaçlı parola sıfırlama yetkisi vardır ve denetim günlüğüne düşer.
  Veri dosyaları `umask 077` ile oluşturulur.
- **Şifreli sağlayıcı bilgileri:** Netgsm/İleti Merkezi/Twilio hesap bilgileri `APP_SECRET`'tan
  türetilen anahtarla AES-256-GCM. **`APP_SECRET` değişirse** kayıtlı bilgiler çözülemez
  (`null` döner, gönderim "bilgiler eksik" hatası verir); her klinik `/ayarlar`'dan yeniden girer.
- **Oturum:** rastgele belirteç, veritabanında SHA-256 özeti, 12 saat, `HttpOnly` + `SameSite=Lax`,
  üretimde `Secure` ve `__Host-` öneki; girişte oturum rotasyonu.
- **CSRF:** oturumlu her POST `_csrf` alanı (oturuma bağlı belirteç, sabit zamanlı karşılaştırma);
  giriş formu ayrı bir oturum-öncesi çerez belirteciyle korunur.
- **Origin kontrolü:** POST'larda `Origin`/`Referer` `APP_ORIGIN` ile eşleşmeli; üretimde
  ikisi de yoksa 403.
- **Hız sınırları** (bellek içi, tek kopya): giriş 8/15 dk (IP+e-posta), test SMS 5/saat, elle
  gönderim 30/saat/klinik, CSV yükleme 5/saat, tüm POST'lar 300/15 dk/IP.
- **Günlük SMS tavanı:** klinik başına iki kademeli (yukarıda).
- **Parola:** bcrypt (12 tur), en az 8 karakter + harf + rakam; bilinmeyen e-postada da bcrypt
  çalışır (zamanlama sızıntısı yok); geçici parolayla ilk girişte değişim zorunlu.
- **Başlıklar:** CSP (`default-src 'self'`, satır içi script/style yok), `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy: same-origin`, `Cache-Control: no-store`, üretimde HSTS.
- **Denetim kaydı:** `/admin/denetim` — giriş/çıkış, klinik ve kullanıcı işlemleri, ayar
  değişiklikleri, tavan aşımı, silme; IP ile birlikte `master.db`'de.
- **Loglar:** telefon numaraları maskelenir; mesaj gövdesi, parola, belirteç ve sağlayıcı
  bilgileri loga yazılmaz.

## Sorun giderme

| Belirti | Neden / çözüm |
|---|---|
| Üretimde açılışta `APP_SECRET en az 32 karakterlik ...` hatası | `.env.example`'daki yer tutucu veya 32 karakterden kısa değer. Rastgele bir değer üretip `APP_SECRET`'a yazın. Geliştirmede yalnızca uyarı verir. |
| `APP_ORIGIN üretimde zorunludur` | `NODE_ENV=production` iken `APP_ORIGIN` boş. Dış adresi (`https://…`) yazın. |
| Her POST'ta **403 "İsteğin kaynağı doğrulanamadı"** | `APP_ORIGIN` tarayıcının gördüğü adresle birebir aynı değil (şema/port/alt alan adı). Cloudflare arkasında `https://vet.example.com` olmalı; yerelde `http://localhost:3000`. |
| Hiç otomatik SMS gitmiyor | `ENABLE_SCHEDULER=1` verilmemiş (açılış logunda "Zamanlayıcı kapalı" uyarısı). Ayrıca klinik `/ayarlar`'da zamanlayıcı açık ve saat penceresi içinde olmalı; sağlayıcı "Konsol" ise gerçek SMS gitmez. |
| `Netgsm 30` | Kullanıcı adı/API şifresi hatalı ya da Netgsm panelinde API/IP izni yok. |
| `Netgsm 40` / `İleti Merkezi 453` | Gönderici başlığı panelde tanımlı/onaylı değil. |
| Sağlayıcı bilgileri "eksik" görünüyor ama girilmişti | `APP_SECRET` değişmiş; bilgileri `/ayarlar`'dan yeniden girin. |
| Girişte 429 "Çok fazla istek" | 15 dakikada 8 hatalı deneme; bekleyin veya konteyneri yeniden başlatın (sayaç bellekte). |
| `/api/version` `buildTime: "unknown"` | İmaj Dockerfile ile derlenmemiş (`BUILD_TIME` dosyası yok); yerel çalıştırmada normaldir. |
| Çerez tutmuyor, sürekli giriş ekranı | `NODE_ENV=production` ile HTTP üzerinden erişim: `Secure` çerez HTTPS ister. Tünel/HTTPS kullanın ya da yerelde `NODE_ENV` boş bırakın. |
| Docker imajı `node:sqlite` bulamıyor | Temel imaj 24'ten eski; `node:24-bookworm-slim` kullanın. |

## Komutlar

```bash
npm start            # üretim/yerel sunucu
npm run dev          # --watch ile
npm test             # node --test "test/*.test.js"
npm run create-admin -- <e-posta> <parola> [ad]
npm run backup       # elle yedek
# Uçtan uca HTTP duman testi: BOŞ bir veri klasörüyle açılmış sunucuya karşı çalışır.
# Terminal 1:
#   SKIP_DOTENV=1 DATA_DIR=$(mktemp -d) PORT=3199 APP_ORIGIN=http://localhost:3199 \
#   APP_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
#   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Admin12345 ENABLE_SCHEDULER=0 node src/server.js
# Terminal 2 (SMOKE_BASE / SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD ile değiştirilebilir):
node scripts/smoke.mjs
```
