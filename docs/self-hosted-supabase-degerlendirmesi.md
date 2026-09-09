# Docker'da self-hosted Supabase: ne olur?

*Karar belgesi — 9 Eylül 2026 · Teserix / veteriner-sms · Kaynak: supabase.com/docs, github.com/supabase/supabase, docker.com, postgresql.org, kvkk.gov.tr + depo ve donanım üzerinde yapılan ölçümler*

---

## 1) Kısa cevap

1. **Kurabilirsin, çalışır.** Donanım yeter (16 GB RAM / 6 çekirdek / 130 GB boş, Supabase'in resmi asgarisi 4 GB / 2 çekirdek / 40 GB SSD), tüm imajların `linux/amd64` varyantı var, Intel Mac'te emülasyon gerekmez. Teknik engel yok. *(doğrulandı — [system requirements](https://supabase.com/docs/guides/self-hosting/docker#system-requirements))*
2. **Ama 11 servisin 10'unun kodda karşılığı yok.** Depo tarandı: tüm SQL 3 dosyada (`src/db/master.js`, `src/db/tenant.js`, `src/auth.js`), 73 `.prepare()` çağrısı, JSON dönen tek uç `/api/health` ve `/api/version`. Auth, PostgREST, Realtime, Storage, imgproxy, Edge Functions, Supavisor — hiçbiri kullanılmıyor. *(doğrulandı, ölçüm)*
3. **Oran saçma:** 2,06 GB sıkıştırılmış imaj ve önerilen 8 GB RAM / 80 GB SSD, korunan veri 2,5 MB. Önerilen disk, verinin ~32.000 katı. *(doğrulandı)*
4. **KVKK açısından hiçbir şey değişmez.** Veri zaten Türkiye'de kalıyor; m.9 yurt dışına aktarım rejimi bugün de doğmuyor, self-hosted Supabase'le de doğmaz. Kazanç sıfır — mevcut durumun korunması. *(doğrulandı)*
5. **Güvenlik açısından geri gidersin.** `.env.example`'daki `ANON_KEY` / `SERVICE_ROLE_KEY` herkese açık, sabit JWT'lerdir ve 09.01.2027'ye kadar geçerlidir; `JWT_SECRET` değiştirilmezse 8000 portuna ulaşan herkes RLS'i tamamen atlayan `service_role` erişimi alır. *(doğrulandı — [.env.example](https://raw.githubusercontent.com/supabase/supabase/master/docker/.env.example))*
6. **İzolasyon modelin bozulur.** Self-hosted Supabase resmen "tek proje"dir; Studio çoklu proje/organizasyon desteklemez. Bugünkü `data/tenants/<id>.db` fiziksel ayrımı, tek Postgres içinde mantıksal ayrıma iner. *(doğrulandı)*
7. **Hiçbir belge kazanmazsın.** SOC 2 Type 2 / ISO 27001 / HIPAA yalnızca yönetilen bulut platformuna aittir; self-hosted kurulumda ihalede gösterebileceğin belge yoktur. *(doğrulandı — [supabase.com/security](https://supabase.com/security))*
8. **Tavsiye: kurma.** Bu hafta yapılacak doğru işler: FileVault'u aç, yedekleri şifreleyip sunucu dışına çıkar, LaunchAgent'ı LaunchDaemon'a çevir. Bunlar Supabase'ten kat kat fazla KVKK ve dayanıklılık getirisi sağlar.

---

## 2) Ne kurmuş olursun

Resmi `docker/docker-compose.yml` (master, 09.09.2026) varsayılan olarak **11 konteyner** ayağa kaldırır. Log/analytics `docker-compose.logs.yml` override'ıyla eklenirse 13 olur; v0.5.0'dan (03.06.2026) beri varsayılan değildir. *(doğrulandı)*

| Servis (imaj) | Görevi | Teserix kullanıyor mu |
|---|---|---|
| `db` — supabase/postgres:17.6.1.136 (367,2 MB) | PostgreSQL 17 + eklentiler | Tek muhtemel gerekli bileşen — ama bugün gerekmiyor |
| `studio` — supabase/studio (327,0 MB) | Yönetim paneli | Hayır (uygulamanın kendi `/admin` paneli var) |
| `api-gw` — envoyproxy/envoy:v1.39.0 (70,0 MB) | API ağ geçidi (Kong artık varsayılan değil) | Hayır |
| `auth` — supabase/gotrue:v2.189.0 (26,3 MB) | Kimlik doğrulama | **Hayır** — `src/auth.js` bcrypt + sunucu tarafı oturum yapıyor |
| `rest` — postgrest/postgrest:v14.12 (6,3 MB) | Otomatik REST API | **Hayır** — uygulama SSR (22 EJS görünümü) |
| `realtime` — supabase/realtime:v2.102.3 (122,7 MB) | WebSocket/canlı abonelik | Hayır — kodda WS/SSE yok |
| `storage` — supabase/storage-api:v1.60.4 (244,0 MB) | Dosya deposu | Hayır |
| `imgproxy` — darthsim/imgproxy:v3.30.1 (80,0 MB) | Görsel dönüştürme | Hayır |
| `meta` — supabase/postgres-meta:v0.96.6 (99,1 MB) | Studio'nun şema API'si | Hayır |
| `functions` — supabase/edge-runtime:v1.74.0 (390,7 MB) | Edge Functions (Deno) | Hayır |
| `supavisor` — supabase/supavisor:2.9.5 (327,1 MB) | Bağlantı havuzlayıcı | Hayır — tek Node süreci |

**Toplam: 2.060,3 MB sıkıştırılmış amd64 imaj.** Karşılaştırma: `postgres:17-alpine` (117,2 MB) + `adminer` (46,1 MB) = 163,3 MB / 2 konteyner — 12,6 kat küçük. *(doğrulandı, Docker Hub API)*

Kaynak tüketimi: Supabase'in resmi tavsiyesi min 4 GB RAM / önerilen 8 GB+. Topluluk ölçümleri boşta 1,5–4 GB aralığı bildiriyor (**ikincil kaynağa göre**; v0.5.0 sonrası güncel ölçüm bulunamadı). Docker daemon şu anda kapalı olduğu için bu makinede **fiili RAM ölçümü yapılamadı**.

Supabase'in kendi dokümanı çıkışı da söylüyor: *"If you don't need specific services, such as Realtime, Storage, imgproxy, or Edge Runtime, you can remove the corresponding sections."* Hepsini silersen geriye kalan **Docker içinde bir Postgres**'tir — Supabase kurmuş olmazsın.

---

## 3) Kazançlar (dürüstçe)

- **Telemetri yok.** Doküman birebir: *"Self-hosted Supabase (run via Docker Compose) does not phone home or collect any telemetry."* Compose dosyalarında dışa rapor uç noktası bulunamadı. *(doğrulandı)*
- **Lisans temiz.** Apache-2.0 / MIT / PostgreSQL / MPL-2.0. SSPL veya BSL yok; SaaS olarak satabilirsin, kaynak açma zorunluluğu yok. Docker Desktop de Teserix ölçeğinde (<250 çalışan **ve** <10M USD ciro) ücretsiz. *(doğrulandı — [desktop-license](https://docs.docker.com/subscription/desktop-license/))*
- **Studio arayüzü.** Tabloları gezmek, SQL çalıştırmak. Tek somut yeni yetenek bu.
- **Postgres yetenekleri** (JSONB, pgvector, pg_cron, gerçek eşzamanlı yazma). Bu uygulamada bugün hiçbiri kullanılmıyor.
- **Mimari uyum.** Intel Mac'te çalışır, veriyi Türkiye'de tutar.

Liste bu kadar. Kazançların hiçbiri karşılanmamış bir ihtiyaca denk gelmiyor.

---

## 4) Kayıplar ve riskler

**Bulutta hazır gelip sana geçen her şey.** Resmi doküman: *"branching, advanced metrics beyond logs, managed backups and PITR, analytics and vector buckets, ETL, and the platform management API are **unavailable**."* Sorumluluk listesi de birebir sayılıyor: sunucu bakımı, güvenlik sertleştirme, OS/servis yaması, Postgres bakımı, yüksek erişilebilirlik, **yedekleme ve felaket kurtarma**, izleme. Destek: *"community-supported"*. *(doğrulandı)*

**Yedekleme geriye gider.** Resmi Docker self-hosting sayfası yedekleme prosedürü içermiyor — yalnızca "aşağıdaki komut tüm veriyi yok eder" uyarısı var. Bugün `src/backup.js` her gün `PRAGMA wal_checkpoint(TRUNCATE)` + `VACUUM INTO` ile tutarlı, sıkıştırılmış, idempotent (`.done` işaretçili) yedek alıyor ve saklama süresi sonrası eskiyi siliyor. Supabase'e geçiş bunu siler, yerine kendi yazacağın bir `pg_dump` cron'u koyar.

**Varsayılan sır yüzeyi.** `.env.example` başında büyük harfle: *"YOU MUST CHANGE ALL THE DEFAULT VALUES BELOW BEFORE STARTING THE CONTAINERS FOR THE FIRST TIME!"*; `docker/README.md`: *"The default configuration is not production-ready."* Varsayılanlar arasında `POSTGRES_PASSWORD=your-super-secret-...`, `DASHBOARD_PASSWORD=this_password_is_insecure_and_should_be_updated`, `REALTIME_DB_ENC_KEY=supaberealtime` benzeri sabitler ve payload'ı `iss: supabase-demo`, `exp` = 09.01.2027 olan iki genel JWT var. Bugünkü uygulamada hiçbir varsayılan sır yok.

**Açık portlar.** Compose yalnızca iki serviste `ports:` tanımlıyor: `api-gw` → 8000, `supavisor` → 5432 ve 6543. Yani Postgres yerel ağa açılır. Docker'ın varsayılan davranışı gereği bunlar 0.0.0.0'a bağlanır (**deneysel doğrulanamadı** — daemon kapalı). HTTPS varsayılan değil: *"By default, Supabase is accessible over HTTP"*; TLS için Caddy/Nginx override'ı gerekir. Bugün dış erişim tek bir Tailscale Funnel HTTPS uç noktasından geçiyor.

**Studio'nun tek koruması HTTP Basic Auth.** Rol ayrımı yok, tek parola = tüm kliniklerin verisine tam yönetici erişimi. Üstelik doküman parolada özel karakter kullanılmamasını şart koşuyor (*"must include at least one letter — do not use numbers only or any special characters"*), yani entropi tavanı düşük. Uygulamada bugün superadmin/admin/staff rolleri, hız sınırlayıcı ve denetim günlüğü var.

**Güncelleme yükü.** Kararlı snapshot'lar *"approximately once a month"* yayımlanıyor; imajları tek tek değiştirirsen *"compatibility is not guaranteed"*. `update.sh` üç yönlü birleştirme yapar, çakışma olursa dosyalara `<<<<<<<` yazıp elle çözmeni bekler ve **Postgres/Storage verisini yedeklemez**. Son ~6 ayda 5 kırıcı değişiklik: v0.8.0 Kong→Envoy, v0.7.0 `API_EXTERNAL_URL`/`PGRST_DB_SCHEMAS` değişimi, v0.6.0 Postgres 17 varsayılan (mevcut v15 verisi üzerinde **başlatılamaz**), v0.5.0 analytics çıkarıldı, 16.03.2026 yeni `sb_` anahtar formatı. PG17 yükseltmesi ayrı bir prosedür: root/sudo + mevcut veri boyutunun 2 katı + 5 GB boş alan. *(doğrulandı — [CHANGELOG.md](https://raw.githubusercontent.com/supabase/supabase/master/docker/CHANGELOG.md))*

**macOS/Docker Desktop kırılganlığı.**
- Daemon şu anda **kapalı** ve `~/Library/LaunchAgents` altında Docker'a ait hiçbir plist yok. Resmi ayar *"Start Docker Desktop when you sign in to your computer"* — makine açılışına değil, **kullanıcı oturumu açmaya** bağlı. Elektrik kesintisi sonrası kimse giriş yapmazsa veritabanı ayağa kalkmaz. Docker Desktop için resmi bir LaunchDaemon yolu **bulunamadı**.
- `Docker.raw` nominal 250,7 GB / fiili 15 GB tek seyrek dosya. Veri Docker'a taşınırsa 11 bağımsız küçük dosyaya dağılmış arıza yüzeyi tek bozulma noktasına toplanır.
- Doküman macOS bind mount kısıtını Storage için açıkça belgeliyor (*"missing xattr support, permission issues"*, named volume öneriliyor); ama `db` servisi de veri dizinini bind mount'la bağlıyor (`./volumes/db/data`). Postgres fsync dayanıklılığının bu katmanda nasıl davrandığına dair resmi açıklama **bulunamadı**.
- Mac mini 2018 Apple'ın macOS 26 Tahoe uyumluluk listesinde yok; makine 15.7.7'de sabit. Docker Desktop *"current and two previous major macOS releases"* destekliyor — bu donanımda birkaç yıllık pencere (**ikincil kaynağa göre** ömür tahmini).

---

## 5) KVKK etkisi

**En büyük "kazanç" aslında sıfır kazançtır.** KVKK Yurt Dışına Aktarma Rehberi (Yayın No: 48) aktarımı üç kritere bağlıyor; üçüncüsü *"Veri aktarılan veri sorumlusu ya da veri işleyen... üçüncü bir ülkede olmalıdır"*. Veri Mac mini'de kalırsa bu kriter oluşmaz, m.9 hiç doğmaz — dolayısıyla Teserix'e veri işleyen sıfatıyla doğrudan kesilebilen tek ceza (m.9/5 bildirim, 2026: 90.308–1.806.177 TL) gündeme gelmez. **Ama bu bugün de böyle.** Self-hosted Supabase mevcut durumu korur, iyileştirmez. Yalnızca Supabase **Cloud** tam m.9 rejimini tetikler. *(doğrulandı; 2026 ceza tutarları önceki araştırmadan devralındı, bu turda yeniden doğrulanmadı)*

Yurt dışındaki registry'den imaj çekmek aktarım değildir — yazılım içeri girer, kişisel veri dışarı çıkmaz. **İkincil kaynağa göre**: Kurul'un bu senaryoya doğrudan değinen yayımlanmış ilke kararı bulunamadı, sonuç Rehber'in üç kriterinden çıkarımdır.

**Buna karşılık m.12/1 yükünün tamamı sana geçer.** Kişisel Veri Güvenliği Rehberi (Yayın No: 72) yama yönetimi ve güncellemeleri açık teknik tedbir sayıyor. Bugünkü bakım yüzeyi: 3 npm paketi (express, ejs, bcryptjs) + Node çalışma zamanı. Supabase sonrası: 11 imajın CVE takibi + aylık snapshot birleştirme + Postgres bakımı. Tek kişilik bir işletmede bu, denetimde savunulabilirliği **azaltır**.

**"Belgeli sağlayıcı" savunması kaybolur.** ISO 27001 / SOC 2 sorusuna dürüst cevap: "hayır — üreticinin bulut hizmeti için belgesi var ama biz o hizmeti kullanmıyoruz." Bulut Supabase'de bu savunma vardı, ama m.9 riskiyle geliyordu; self-hosted'da her ikisi de yok.

**İzolasyon modeli değişimi ciddi.** `src/db/tenant.js` klinik kimliğini `^[a-f0-9]{12}$` ile doğrulayıp yalnızca o dosyayı açıyor; çapraz klinik sızıntısı bir SQL hatasıyla delinemez ve `test/tenant-isolation.test.js` bunu doğruluyor. Postgres'te izolasyon her sorgudaki `WHERE clinic_id` doğruluğuna bağlanır. Supabase'in RLS'i burada telafi **etmez**: uygulama GoTrue kullanmadığı için isteklerde son kullanıcı JWT'si olmayacak, bağlantı `service_role` ile kurulacak — ve doküman birebir diyor ki bu rol *"has the `bypassrls` attribute"*. RLS hiç değerlendirilmez.

**İmha zorlaşır.** PostgreSQL dokümanı: DELETE eski satır sürümünü hemen kaldırmaz, VACUUM gerekir ve *"it will not return the space to the operating system"*; üstüne WAL ve base backup kopyaları gelir. Silme/Yok Etme Rehberi yok etme için "tüm kopyaların tespiti"ni şart koşuyor. Bugün bir kliniği imha etmek dosyayı (+ yedeklerini) silmektir; ispatı basittir.

---

## 6) Beş seçeneğin karşılaştırması

| | **A: SQLite (bugün)** | **B: Docker'da sadece Postgres** | **C: Docker'da tam Supabase** | **D: Türkiye'de VPS** | **E: Supabase Cloud** |
|---|---|---|---|---|---|
| **Veri nerede** | Mac mini, TR | Mac mini, TR | Mac mini, TR | TR veri merkezi | Yurt dışı (TR bölgesi yok) |
| **RAM / CPU** | ~59 MB RSS (ölçüldü), 0 konteyner | 163 MB imaj, 2 konteyner; shared_buffers 128 MB | 2.060 MB imaj, 11 konteyner; resmî min 4 GB / öner. 8 GB, 2–4+ çekirdek | B veya C ile aynı | Yerel: 0 |
| **Kurulum** | 0 — kurulu | ~yarım gün *(tahmin)* | 1–2 gün: 11 servis sırrı, Envoy/TLS, Tailscale *(tahmin)* | 1–2 gün + tedarik *(tahmin)* | Saatler |
| **Aylık işletme** | ~0 saat | 1–2 saat *(tahmin)* | 4–8 saat: sürüm uyumu, `update.sh` çakışmaları *(tahmin)* | C + sağlayıcı yönetimi | ~0 saat, hukuki yük yüksek |
| **Kod değişikliği** | **0 gün** | 146 senkron çağrı + 35 handler + 30 SQLite'a özgü ifade + 120 test → **10–20 iş günü** *(tahmin)* | B ile aynı | B ile aynı | B ile aynı |
| **Yedek** | `VACUUM INTO`, günlük, çalışıyor | Kendi `pg_dump` cron'un | Kendi `pg_dump` cron'un; PITR **unavailable** | Aynı + sağlayıcı snapshot | Yönetilen + PITR |
| **KVKK yükü** | m.9 yok; m.12 sende | m.9 yok; m.12 sende (+Docker) | m.9 yok; m.12 **tamamen** sende, belge yok | m.9 yok; m.12 paylaşımlı | **m.9 tam rejim**, m.9/5 ceza riski |
| **Arıza modu** | launchd KeepAlive; bozulma klinik başına izole | Daemon kapalıysa erişim yok | Aynı + `Docker.raw` tek bozulma noktası + 11 servis | Ağ/sağlayıcı bağımlılığı | İnternet kesintisi = tam kesinti |
| **Satış anlatımı** | "Veriniz ayrı dosyada, Türkiye'de" — kodla kanıtlanabilir | Nötr | "Supabase" klinik alıcısına anlam ifade etmez, "bulut mu?" sorusunu açar | "Türkiye veri merkezi" güçlü | KVKK sorusunu açar |
| **Aylık maliyet** | 0 | 0 (elektrik) | 0 (elektrik) | VPS kirası *(fiyat doğrulanmadı)* | Supabase planı |

> **D hakkında uyarı (doğrulanamadı):** AWS İstanbul Local Zone (20.05.2026) duyurusunda **Amazon RDS yok** — sadece EC2, S3 One Zone-IA, EBS, ECS, EKS, VPC, Direct Connect, ALB. Azure TR bölge sayfası 404 döndü. Yerli sağlayıcıların yönetilen PostgreSQL SLA'sı birincil kaynaktan doğrulanamadı. Yani D pratikte "TR'de VPS kiralayıp Postgres'i kendin işletmek"tir.

---

## 7) SQLite ne zaman yetmez?

Bu makinede uygulamanın kendi deseniyle ölçüm yapıldı (WAL, `busy_timeout=5000`, her INSERT kendi transaction'ında):

- **Kapasite: 6.749 yazma/sn/dosya** (0,148 ms/yazma). Tek transaction içinde ~320.000 yazma/sn. İndeksli COUNT: 0,060 ms.
- **Hedef yük: ~0,012 yazma/sn.** 50 klinik × ~600 yazma/ay = 30.000 yazma/ay. Kapasitenin **~580.000'de biri**.
- Üstelik yazmalar tek dosyada toplanmıyor: klinik başına ayrı dosya = 50 klinik → 50 bağımsız yazar. SQLite'ın tek-yazar sınırı bu mimaride ölçeklenme engeli değil.
- **Boyut:** SQLite limiti 281 TB. Bugün 2,5 MB; 50 klinikle yıllık büyüme onlarca MB. 130 GB boş diskle onlarca yıl.

**Ölçülebilir çıkış eşiği — üçünden biri gerçekleşirse:**
1. Tek klinik dosyasında sürekli **>1.000 yazma/sn**;
2. Aynı dosyaya **birden fazla süreç/sunucu** yazması (yatay ölçekleme);
3. Veritabanı dosyasının **ağ dosya sistemine** (NFS/SMB) taşınması — WAL orada resmen çalışmaz.

**Bu projede o eşiğe ne zaman gelinir? Öngörülebilir gelecekte gelinmez.** 50 klinik hedefinde bile marj beş buçuk mertebe. sqlite.org'un kendi ölçütü: *"günde 100K isabetten az alan herhangi bir site SQLite ile sorunsuz çalışır"* ve bunun muhafazakâr olduğu, 10 katının gösterildiği belirtiliyor.

Mevcut yığının tek gerçek teknik riski `node:sqlite` modülünün **"Stability: 1.2 – Release candidate"** statüsüdür. Çözümü Supabase değil, gerekirse `better-sqlite3`'e geçmektir — API'si yakın, mimari değişmez. *(better-sqlite3 uyumluluk derecesi birincil kaynaktan karşılaştırılmadı.)*

---

## 8) Tavsiye

**Kurma. Veritabanı mimarisine dokunma. Zamanı gerçek açıklara harcа.**

Gerekçe tek cümlede: Supabase'in 11 servisinden 10'unun kodda karşılığı yok, KVKK getirisi sıfır, güvenlik ve izolasyon açısından net kayıp, aylık işletme yükü 0 saatten 4–8 saate çıkıyor ve kod göçü 10–20 iş günü — karşılığında elde edilen tek yeni şey 46 MB'lık Adminer'ın veya bugünkü `/admin` panelinin zaten yaptığı bir arayüz.

**Şimdi (bu hafta, hepsi bir hafta sonu işi):**
1. **FileVault'u aç.** Bugün disk şifresiz; Docker kurmak bunu düzeltmez, `Docker.raw` da aynı şifresiz diskte durur.
2. **Yedekleri şifreleyip sunucu dışına çıkar.** Güvenlik Rehberi: *"veri seti yedekleri mutlaka ağ dışında tutulmalıdır"*. 2,5 MB — teknik olarak bedava.
3. **`sudo deploy/mac-mini/service.sh install`** ile LaunchAgent'ı LaunchDaemon'a çevir; oturumdan bağımsız açılış.
4. İstersen `node:sqlite` → `better-sqlite3` geçişini değerlendir.

**10 klinikte:** Hiçbir şey değişmez. SQLite marjı hâlâ beş mertebe. Bu aşamada tek soru donanım tek nokta arızasıdır — cevabı Postgres değil, **mevcut Node+SQLite yığınını Türkiye'de bir VPS'e taşımak** (tek `rsync`).

**50 klinikte:** Yeniden ölç, varsayma. Eğer bölüm 7'deki üç eşikten biri fiilen zorlanıyorsa doğru hamle `postgres:17-alpine` + gerektiğinde `adminer` — 2 konteyner, 163 MB. Supabase yığını **hiçbir aşamada** gerekmiyor.

---

## 9) Yine de kurmak isterseniz — kontrol listesi

Sadece deneme/öğrenme amacıyla, **üretim verisi olmadan**:

1. **Ayrı klasör, ayrı ortam.** `git clone --filter=blob:none --no-checkout https://github.com/supabase/supabase` → sparse checkout `docker/`. Üretim verisine hiçbir yolla dokunmasın.
2. **Tüm varsayılan sırları değiştir.** `POSTGRES_PASSWORD`, `JWT_SECRET` (≥32 karakter), `ANON_KEY`, `SERVICE_ROLE_KEY` (`sh utils/rotate-new-api-keys.sh`), `DASHBOARD_USERNAME`/`PASSWORD` (en az bir harf, özel karakter yok), `VAULT_ENC_KEY`, `REALTIME_DB_ENC_KEY`, `SECRET_KEY_BASE`, S3 anahtarları. Konteynerleri **ilk başlatmadan önce**.
3. **`OPENAI_API_KEY` satırını sil.** Doldurulursa şema bilgisi ABD'ye gider ve m.9 tartışması açılır.
4. **Logs/analytics override'ını hiç ekleme.** Vector Docker soketini bağlar ve makinedeki *tüm* konteynerlerin loglarını toplar; BigQuery backend satırlarını asla açma.
5. **Portları kilitle.** `docker-compose.yml`'daki `ports:` girdilerini `127.0.0.1:` ile önekle (8000, 5432, 6543). Hiçbirini Tailscale Funnel'a bağlama; Studio'ya yalnızca Tailscale özel ağı üzerinden eriş.
6. **TLS ekle.** Varsayılan HTTP'dir; Caddy veya Nginx override'ıyla ters vekil kur.
7. **Kullanmayacağın servisleri sil:** realtime, storage, imgproxy, functions, auth, rest. Kalan: db + (isteğe bağlı) studio/meta/api-gw.
8. **`db` veri dizinini named volume'e çevir** (bind mount yerine). macOS bind mount kısıtları Storage için resmen belgeli; veritabanı için resmi güvence yok — ihtiyatlı davran.
9. **Yedek prosedürünü ilk gün yaz:** günlük `pg_dump` + haftalık `pg_dumpall` (roller), şifreli, sunucu dışına. **Geri yüklemeyi test et** — test edilmemiş yedek yedek değildir.
10. **Güncelleme ritüeli:** aylık `update.sh`, öncesinde Postgres verisini ayrı yedekle (script yedeklemiyor), `CHANGELOG.md`'yi oku, sürüm sabitle (pin).
11. **İzleme:** her servis için healthcheck + `docker stats` ile ilk hafta gözlem + disk doluluk alarmı (`Docker.raw` 250,7 GB'a kadar şişebilir, diskte 130 GB var).
12. **Otomatik başlatma:** Docker Desktop → Settings → "Start Docker Desktop when you sign in". Bu **oturum açmaya** bağlıdır; başsız Mac mini için otomatik giriş yapılandırılmalı — ki bu FileVault ile çelişir. Bu çelişkiyi çözmeden üretim verisi taşıma.
13. **Studio'yu asla dış ağa açma.** Tek basic-auth parolası tüm kliniklerin verisine tam erişimdir.

---

## 10) Belirsizlikler

- macOS Docker Desktop'ta Postgres veri dizininin bind mount üzerinden fsync/dayanıklılık davranışı **ölçülemedi**; resmi uyarı ya da güvence **bulunamadı**.
- Docker Desktop'ın macOS'ta kullanıcı oturumu olmadan (headless) çalışıp çalışmadığına dair kesin resmi ifade **bulunamadı**.
- Yayımlanan portların 0.0.0.0'a mı 127.0.0.1'e mi bağlandığı deneysel olarak **doğrulanamadı** (daemon kapalı); Docker varsayılanı tüm arayüzlerdir.
- Konteynerlerin **gerçek** boşta RAM/CPU tüketimi bu makinede ölçülmedi; verilen sayılar resmi tavsiye tablosu ve **ikincil** topluluk ölçümleridir.
- Kurulum süresi, aylık işletme saati ve 10–20 iş günü göç tahmini **kaynaksız tahmindir**; somut girdilerden (146 senkron çağrı, 35 handler, 30 SQLite'a özgü ifade, 120 test) türetilmiştir.
- İnternete açık self-hosted Supabase örneklerine ilişkin birincil kaynaklı ihlal olayı (CVE/resmi bildirim) **doğrulanamadı**; risk compose/env dosyalarından matematiksel olarak kesindir, ölçüm iddiaları ikincildir.
- "Yurt dışı menşeli yazılımın TR sunucuda çalıştırılması aktarım değildir" sonucu Rehber'in üç kriterinden **çıkarımdır**; Kurul kararıyla teyit edilmiş değildir.
- 2026 KVKK ceza tutarları (m.9/5: 90.308–1.806.177 TL) bu turda birincil kaynaktan **yeniden doğrulanmadı**.
- WAL ve base backup içindeki silinmiş kişisel verilerin İmha Yönetmeliği karşısındaki durumuna dair KVKK'nın özel açıklaması **bulunamadı**.
- Türkiye'de yönetilen PostgreSQL hizmeti (SLA, PITR, fiyat) birincil kaynaktan **doğrulanamadı**; Azure TR sayfası 404 döndü, Google Cloud sorgulanmadı.
- Apple'ın Intel Mac'lere 3 yıl güvenlik güncellemesi vereceği bilgisi **ikincildir**; doğrulanan tek şey Mac mini 2018'in Tahoe 26 listesinde olmadığıdır.
- Docker Hub'ın bildirdiği boyutlar **sıkıştırılmış** katman boyutlarıdır; diske açılmış gerçek kaplama ölçülmedi.
- `better-sqlite3`'ün `node:sqlite` ile API uyumluluk derecesi karşılaştırılmadı — yön önerisidir.