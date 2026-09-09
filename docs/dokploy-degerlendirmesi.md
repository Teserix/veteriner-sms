# "Dokploy'a kursak ne olur" — değerlendirme

Tarih: 2026-09-09
Kapsam: Sorunun iki okuması ayrı ayrı ele alınmıştır — (a) Supabase yığınının Dokploy üzerine kurulması, (b) veteriner SMS uygulamasının Mac mini yerine Dokploy sunucusunda barındırılması.

Bu belgede "ölçüm" ve "tahmin" ayrı işaretlenmiştir. Ölçüm = bu makinede çalıştırılan komutun çıktısı veya birebir okunan kaynak dosya. Tahmin/çıkarım = hesaplama ya da mantıksal sonuç; doğrulanmamış varsayımlar 9. bölümde listelenmiştir.

---

## 1. Karar

**(a) Supabase'i Dokploy'a kurmak: hayır.** Önceki turun kararı değişmiyor, ancak gerekçelerinden biri düzeltiliyor. "Varsayılan public ANON_KEY/SERVICE_ROLE_KEY riski" gerekçesi Dokploy şablonu için geçersizdir — şablon tüm sırları kurulumda üretir. Yerine daha ağır iki gerekçe geçiyor: Dokploy'un şablon sır üreticisi `Math.random()` kullanıyor ve çıktıyı `.toLowerCase()` ile küçültüyor (JWT_SECRET dahil, v0.30.6'da hâlâ böyle), ve Supabase Studio public alan adının kökünde tek bir basic-auth parolasıyla duruyor. Bunlara ek olarak: uygulamanın kaynak kodunda ve `package.json` içinde `pg|postgres|supabase|prisma|knex|sequelize` geçen tek satır yok — 11 servisin hiçbiri kullanılmıyor; Dokploy zaten yönetilen Postgres + S3 yedeği sunuyor, yani Supabase yalnızca Postgres için kurulacaksa Dokploy'un kendi işlevi ikinci kez kurulmuş oluyor; ve KVKK açısından m.9 rejimi sunucunun konumundan doğduğu için self-hosted olmak hiçbir kazanç sağlamıyor, aksine denetlenecek saldırı yüzeyini büyütüyor.

**(b) Uygulamayı Dokploy'da barındırmak: bugün için hayır, ilk faturalı klinikte evet — tek ön koşulla.** Karar teknik değil, coğrafi: Dokploy sunucusunun hangi ülkede olduğu bu oturumda doğrulanamadı ve tüm KVKK sonucu buna bağlı. Sunucu Türkiye'deyse taşımanın marjinal parasal maliyeti sıfırdır ve ev elektriği + ev interneti + macOS güncellemesi bağımlılığını ortadan kaldırır; sunucu yurt dışındaysa tek bir teknik kararla KVKK m.9 zinciri (değiştirilemez standart sözleşme + beş iş günü içinde Kurula bildirim + alt-işleyen güvenceleri) açılır ve Teserix'i doğrudan idari para cezasına açan tek hükmü (m.18/1-d, 2026'da 90.308 – 1.806.177 TL) devreye sokar. Ayrıca "Dokploy'a geçmek" ile "Mac mini'den Linux sunucuya taşınmak" aynı şeydir; Dokploy macOS'a kurulamaz.

---

## 2. Dokploy nedir, ne çalıştırır, bu makineye kurulabilir mi

Dokploy, Docker üzerine kurulu, kendi sunucunuzda çalıştırdığınız açık kaynak bir dağıtım paneli (Heroku/Vercel benzeri bir katman). Kendi dokümanı birebir "Free and open-source software, available for anyone to use." diyor; self-hosted sürüm için lisans ücreti yok. (Dokploy Cloud ayrı bir ürün: Hobby 4,50 USD/sunucu/ay, Startup 15 USD/ay — kullanılmıyor.)

**Ne çalıştırır (install.sh ve manual-installation dokümanından okundu):**

| Konteyner | İmaj | Notlar |
|---|---|---|
| dokploy-postgres | postgres:16 | Panelin kendi veritabanı |
| dokploy | dokploy/dokploy | `/var/run/docker.sock` bind mount, `--publish published=3000,target=3000,mode=host` |
| dokploy-traefik | traefik:v3.6.7 | 80/tcp, 443/tcp, 443/udp |

Docker Swarm zorunludur (`docker swarm init --advertise-addr`), overlay ağ `dokploy-network` oluşturulur. Hiçbir konteynerde kaynak limiti/rezervasyonu tanımlı değil (install.sh ve dokümanda grep ile bakıldı). Resmi asgari gereksinim: "at least 2GB of RAM and 30GB of disk space". Güncel install.sh'de redis yok; uninstall dokümanı hâlâ `dokploy-redis` volume'unu listeliyor, yani doküman geride kalmış.

Dolaşımdaki "dokploy konteyneri 464/633 MiB kullanıyor" rakamları bir ölçüm olarak kullanılmamalıdır: kaynak issue #3755 kapalı (2026-02-28), rakamlar v0.27.1'e ait tek bir kullanıcı raporudur ve bakımcı artışı o sürümde eklenen healthcheck'e bağlamıştır. Güncel sürüm v0.30.6. Bugünkü gerçek bellek kullanımı için sunucuda `docker stats` çalıştırmak gerekir.

**Mac mini'ye kurulamaz (kesin).** install.sh satır 104-108 birebir:

```
if [ "$(uname)" = "Darwin" ]; then echo "This script must be run on Linux" >&2; exit 1; fi
```

Resmi desteklenen işletim sistemleri: Ubuntu 18.04/20.04/22.04/23.10/24.04, Debian 10/11/12, Fedora 40, CentOS 8/9. Bu yüzden "Dokploy'a geçelim mi" sorusu, "Mac mini'den Linux sunucuya taşınalım mı" sorusundan ayrı tartışılamaz. Mevcut Mac mini'de Docker Desktop kurulu ama daemon kapalı; imajı yerel denemek isterseniz önce onu açmanız gerekir.

**Sürüm hızı ve bakım yükü:** v0.30.0 (2026-08-14) → v0.30.6 (2026-09-08), yani ~3,5 haftada 7 sürüm; aynı gün iki sürüm çıkan günler var (v0.30.1 ve v0.30.2, 2026-08-18). Proje hâlâ 0.x, semver garantisi yok. Panel güncellemesi kesintili (`--update-order stop-first`). Bilinen açık yükseltme sorunları: #5221 (Dokploy güncellense bile internete bakan dokploy-traefik eski sürümde kalıyor), #5223 (Swarm ayarları UI'dan kalıcı olmuyor), #5191 (aynı image tag'inin içeriği değişse bile konteyner yeniden yaratılmıyor — `--build` ile git'ten derleyen akışı az etkiler, ön-derlenmiş imaja geçilirse doğrudan vurur).

**Güvenlik geçmişi — sayılar ve çerçeve birlikte:** GitHub Security Advisories'te 60 yayımlanmış kayıt var: 34 kritik, 17 yüksek, 8 orta, 1 düşük. 42'si tek günde (2026-07-21), 11'i 2026-05-11'de yayımlandı. Çoğunluğu OS Command Injection (60 kaydın 37'si) ve cross-organization IDOR sınıfında. Panel `/var/run/docker.sock` ile çalıştığı için panelde RCE = host'ta root demektir. Dengeleyici bilgi: 60 kaydın 45'i kimlik doğrulanmış bir hesap gerektiriyor (member / low-privilege), yalnızca 4'ü pre-auth; tek operatörlü, başka org üyesi olmayan bir kurulumda çoğu doğrudan uygulanabilir değil. 42 kaydın aynı gün çıkması sahada 42 olay değil, tek bir koordineli denetimin toplu ifşasıdır.

İki CVE'nin durumu netleştirilmelidir:
- **CVE-2026-45631** (sabit kodlanmış `better-auth-secret-123456789` → kimlik doğrulamasız admin devralma → yerleşik SSH terminali üzerinden host'ta RCE): gerçek, ama NVD'ye göre "From 0.27.0 to before 0.29.3 ... fixed in 0.29.3". Güncel install.sh artık rastgele bir secret üretip Docker Secret olarak saklıyor (`docker secret create dokploy_auth_secret`). Bugün yapılacak temiz bir kurulum etkilenmez. **Ancak sizin sunucunuzda kurulu sürüm doğrulanmadı; 0.29.3 altındaysa bu, veteriner-sms'ten bağımsız olarak acil kontrol edilmesi gereken bir konudur.**
- **CVE-2025-53825** (public repo'da PR → preview deployment ile kimlik doğrulamasız RCE): 0.24.3'te düzeltildi.

Kalıcı zayıflıklar: 2FA organizasyon düzeyinde zorunlu kılınamıyor (#4304 açık). CVE-2026-45791 "Password Change Does Not Revoke Active Sessions" (<0.29.4). Dokploy'un kendi güvenlik dokümanı Docker'ın UFW'yi bypass ettiğini uyarıyor: "ports exposed by Docker containers remain accessible from the public internet even when UFW rules should block them" — yani sade UFW yetmez, `ufw-docker` veya sağlayıcı güvenlik duvarı gerekir.

---

## 3. (a) Supabase + Dokploy: önceki karar değişiyor mu?

**Değişmiyor. Gerekçe listesi güncellendi.**

Şablon gerçek ve güncel: `blueprints/supabase/docker-compose.yml` 11 servis ayağa kaldırıyor (studio, kong, auth, rest, realtime, storage, imgproxy, meta, functions, db, supavisor). İmajlar sabitlenmiş (supabase/postgres:17.6.1.136, kong/kong:3.9.3, gotrue v2.189.0, postgrest v14.12, realtime v2.102.3, storage-api v1.60.4, studio 2026.08.03-sha-022b374, supavisor 2.9.5). Asgari Dokploy sürümü 0.22.5 (`blueprints/supabase/meta.json`).

**Geri alınan gerekçe.** "Varsayılan public ANON_KEY/SERVICE_ROLE_KEY" riski Dokploy şablonu için geçerli değildir. `template.toml` tüm sırları kurulumda üretiyor (`postgres_password`, `dashboard_password`, `jwt_secret`, `vault_enc_key`, `pg_meta_crypto_key` = `${password:32}`, `secret_key_base` = `${password:64}`, `pooler_tenant_id` = `${uuid}`); ANON/SERVICE_ROLE bu jwt_secret ile imzalanıyor. Public varsayılanlar yalnızca `supabase/docker` deposunu elle kurarsanız geçerli.

**Yerine geçen, daha ağır gerekçeler:**
1. `packages/server/src/templates/index.ts` satır 59-69: `generatePassword()` kriptografik olmayan `Math.random()` kullanıyor ve çıktıyı `.toLowerCase()` ile eziyor — 62 harflik alfabe fiilen 36'ya düşüyor. Aynı dosyadaki `generateHash()` ise `node:crypto` `randomBytes` kullanıyor; yani bu bir tutarsızlık. Bu akıştan üretilenler arasında **JWT_SECRET** var; o da RLS'i tamamen bypass eden service_role token'ını imzalıyor. POSTGRES_PASSWORD, DASHBOARD_PASSWORD, VAULT_ENC_KEY, SECRET_KEY_BASE aynı PRNG akışından geliyor. Bu kusur v0.30.6'da ve main dalında hâlâ duruyor. (Not: bu şablona karşı gerçekleştirilmiş somut bir saldırı kanıtı bulunmadı; iddia "kriptografik olarak güvenli değil" seviyesindedir, "kırılmış" seviyesinde değil.)
2. Supabase Studio — rastgele SQL çalıştırabilen tam yönetim konsolu — public alan adının kökünde (`/`) yayınlanıyor; tek eklenti `basic-auth`, kullanıcı adı şablonda sabit (`DASHBOARD_USERNAME=supabase`). Yani konsolun tüm güvenlik sınırı, yukarıdaki üreticiyle yapılmış tek bir parola.
3. Uygulama bu yığının hiçbirini kullanmıyor. `src/` ve `package.json` içinde `pg|postgres|supabase|prisma|knex|sequelize` geçen tek satır yok; kendi auth/oturum/rol katmanı ve `node:sqlite` var, üretim bağımlılığı 3 paket (express, ejs, bcryptjs).
4. Dokploy'un yönetilen veritabanı tipleri Postgres, MySQL, MariaDB, MongoDB, Redis — ve bunlar için zaten S3 hedefli otomatik yedek var. Sırf Postgres için 11 konteynerlik yığın eklemek Dokploy'un kendi sunduğu şeyi ikinci kez kurmaktır. (SQLite bu listede yok; yani Dokploy'un "Backups" özelliği bu uygulamaya doğrudan uygulanmaz — bkz. bölüm 4, Volume Backups.)
5. Kaynak baskısı koşullu bir risk: Supabase self-hosting dokümanı asgari 4 GB RAM / 2 çekirdek / 40 GB SSD, önerilen 8 GB+ / 4+ çekirdek / 80 GB+ diyor. Sunucuda hâlihazırda teserix-webpage, teserix-crm, teserix-gider-app, analiz.teserix.com, cloudflared ve Dokploy'un kendisi var. Sunucunun RAM'i doğrulanmadığı için bu bir öngörüdür, ölçüm değil.

**Düzeltilen abartılar (kayıt için):**
- Analytics/Logflare çökme sorunu artık yok; PR #1068 (2026-08-06) analytics ve vector konteynerlerini kaldırdı. İnternetteki "supabase-analytics is unhealthy" şikâyetleri eski yığına ait.
- Postgres major yükseltmesi için in-place yol **var**: supabase discussions#46080 bir `pg_upgrade` yardımcı betiği sunuyor, alternatif olarak `supabase/postgres:15.x`'e sabitlemeyi öneriyor. Doğru ifade: PG15 veri dizini kendiliğinden yükselmez ve PG17 imajı o dizinle açılmaz. Ayrıca sıfırdan kuracağınız için bugün bir veri kaybı tuzağı yok ("New installs from the template are unaffected"); bu geleceğe ait bir bakım maliyetidir.
- Ağ sorunu gerçek ama çaresi desteklenen bir ayardır: şablon izole ağa kuruluyor, sizin compose'unuz external `teserix_network`'e bağlı. "Isolated deployments" varsayılan açık bir özelliktir ve kapatılabilir; Traefik'i o ağa Dokploy zaten kendisi bağlıyor. Yani "şablonu bozmak" değil, ayar değiştirmek gerekir.
- TLS otomatikliği sizin topolojinizde geçerli değil: Dokploy'un Cloudflare Tunnel rehberi birebir "disable Let's Encrypt and use HTTP instead of HTTPS" ve "Don't enable HTTPS toggle or select any certificate provider" diyor.

---

## 4. (b) Uygulamayı taşımak: kazanç, kayıp, arıza modları

### 4.1 Ne kazanılır

**1. Ev bağımlılığının kalkması (tek büyük kazanç).** Elektrik, ISS ve macOS güncellemesi bağımlılığı ortadan kalkar. README bugün bunu `sudo pmset -a autorestart 1` ile yamalamaya çalışıyor.

**2. Yedeklerin makine dışına çıkması — ama bu Dokploy'a bağımlı değil.** Dokploy'un "Volume Backups" özelliği tam ihtiyaca uyuyor: dokümandan birebir "Volume backups allow you to backup Docker named volumes to S3 destinations"; "Volume Backups only work with Docker named volumes, not with bind mounts"; cron zamanlaması ve `keepLatestNBackups` saklama sınırı var; Applications ve Docker Compose ile çalışıyor. Mevcut compose named volume kullandığı için uygundur. **Ancak geri yükleme yolu sorunlu:** issue #3995 (açık, 2026-03-14) tam bu senaryodur — Compose servisi + named volume + UI'dan restore → "Volume is in use" hatası, çünkü Dokploy konteyneri durduruyor ama silmiyor; tek çözüm SSH ile `docker rm` + `docker volume rm`. Yedek alma otomatik, geri dönme elle.

**3. CI/dağıtım doğrulama zinciri bugün çalışmıyor, Dokploy'da çalışır.** Ölçüm (bu makinede, bugün): `curl -s localhost:3000/api/version` → `{"name":"veteriner-sms","version":"1.0.0","buildTime":"unknown"}`. BUILD_TIME dosyası yalnızca Docker imajı derlenirken yazılıyor (Dockerfile:19-20, src/routes/ops.js). `.github/workflows/deploy-notify.yml` `buildTime != "unknown"` şartı koştuğu için doğrulama Mac mini'de asla geçemez; depoda dağıtımı tetikleyen bir mekanizma da yok.

**Abartılmaması gerekenler:** TLS zaten Cloudflare/Tailscale tarafında sonlanıyor (kazanç ~0). Yeniden başlatma zaten launchd `KeepAlive=true` ile var (kazanç ~0). Log rotasyonu teorik bir kazanç ama log dosyası bugün 1.573 bayt — uygulama neredeyse hiç log yazmıyor (kazanç ~0). Kaynak da sorun değil: ölçülen RSS 61.516 KB, CPU %0,0; canlı veritabanları 144 KB (master.db 52K + tenants 92K, bugün tek kiracı dosyası var), yedekler 520 KB, `data/pazarlama` 1,9 MB ve uygulama verisi değil.

### 4.2 Ne kaybedilir

- **Deploy başarısız olursa eski sürüm de ayakta değildir.** Compose tipi için resmî zero-downtime desteği yok; issue #2497 2025-09-01'den beri açık. Issue sahibinin cümlesi birebir: "it stops the current running container, if the deployment fails, we have a big problem because now nothing works." launchd düzeninde bu sorun yok.
- **Yeni saldırı yüzeyi:** Dokploy paneli + Traefik + Docker soketi + paylaşımlı makine (teserix-webpage/crm/gider/analiz ile aynı çekirdek ve disk). Bugün Mac mini'de bunların hiçbiri yok; dışarıya yalnızca giden tünel açık.
- **Yeni bir kural yükü:** Compose Type asla "Stack"e veya Application tipine çevrilmeyecek (aşağıda gerekçesi), `isolatedDeploymentsVolume` kapalı kalacak, panelde "Clean volumes" düğmesine elle dokunulmayacak.
- **0.x hızında ilerleyen bir yönetim katmanı** ve yönettiği uygulamadan (3 üretim bağımlılığı, ~0,7 MB gerçek veri) kat kat ağır bir kaynak tabanı.

### 4.3 Arıza modu 1: çift konteyner → çift SMS ve SQLite yazma yarışı

**Varsayılan akışta bu risk yoktur.** Dokploy'un Compose tipi için ürettiği varsayılan komut kaynak kodda (`packages/server/src/utils/builders/compose.ts`) net:

```
docker compose -p <appName> [--project-directory ...] [--env-file ...] -f <path> up -d --build --remove-orphans
```

Docker dokümanı: `up` değişiklikleri "by stopping and recreating the containers (preserving mounted volumes)" ile alır — yani önce durdurur, sonra başlatır. `--build` = "Build images before starting containers", dolayısıyla eski konteyner derleme boyunca ayakta kalır; kesinti derleme süresi değil, yalnızca yeniden başlatma süresi kadardır (saniye cinsinden ölçülmedi). İki süreç aynı anda aynı SQLite dosyasına yazmaz.

**Önemli düzeltme — yanlış korumaya güvenmeyin.** Bu güvenliği "compose dosyasına `deploy.update_config.order: start-first` yazmayın" diye korumaya çalışmak yanlış adresi gösterir: `deploy` bloğu `docker compose up` tarafından tamamen yok sayılır. Docker Compose bakımcısının kendi sözleri (docker/compose#13149): "Most of the attributes of the `deploy` section were added for Swarm support and aren't supported by Compose. `update_config` unfortunately is one of them." Yani o satırı yazmak hiçbir şey yapmaz — ne zero-downtime sağlar ne de risk doğurur.

**Gerçek kural:** Compose Type = "Docker Compose" kalacak; **Stack'e veya Application tipine geçilmeyecek.**
- "Stack" tipi `docker stack deploy` (Swarm) yolundan gider; issue #2497'de bir kullanıcı start-first'ü çalıştırabilmek için tam da bunun için stack tipine geçmek zorunda kalmış.
- **Application tipinde konteyner örtüşmesi varsayılan davranıştır**, bir anahtar açmaya gerek yok: `packages/server/src/utils/docker/utils.ts:691-695` varsayılan olarak `UpdateConfig: { Parallelism: 1, Order: "start-first", FailureAction: "rollback" }` veriyor. Yani Application tipinde iki süreç bir süre birlikte yaşar.

**Örtüşme olursa ne olur (kodla doğrulandı):**
- `src/lock.js:6` — `const chains = new Map()`: klinik kilidi süreç-içidir, ikinci konteyneri kapsamaz.
- **`reminders.claim` süreçler arası koruma sağlamaz.** `src/db/tenant.js:244`: `UPDATE reminders SET last_attempt_at = ? WHERE id = ? AND status = 'pending'` — `status`'u değiştirmiyor. İki ayrı bağlantıyla test edildiğinde ikisi de `.changes = 1` alır; ikisi de SMS gönderir. Dolayısıyla "scheduler'da `claim` dönüşünü kontrol et" şeklindeki tek satırlık düzeltme çift SMS'i **önlemez** ve yanlış güven verir. Gerçek koruma durum geçişli bir CAS gerektirir (zaman pencereli WHERE koşulu ya da yeni bir durum + migrasyon; mevcut CHECK kısıtı `'pending','sent','done','cancelled','failed'` ile sınırlı).
- `src/sms/dispatch.js:40-49` günlük tavan oku-karşılaştır-gönder dizisi kilitsiz yarışır; `src/scheduler.js:105`'teki 4 saatlik `last_attempt_at` filtresi de iki süreç aynı dakikada tick ederse ikisinde de eski değeri okur. Sonuç: hem çift SMS hem günlük tavan aşımı.
- `src/ratelimit.js` bellek içi olduğu için hız sınırları konteyner başına uygulanır (iki kopyada giriş sınırı fiilen iki katına çıkar).

**SQLite bozulması beklenen arıza değil.** Aynı host, aynı çekirdek ve `local` driver named volume kullanıldığında POSIX/fcntl kilitleri ve `-shm` mmap'i konteyner sınırını aşarak doğru çalışır. Beklenen arıza "veritabanı bozulması" değil, "çift SMS + tavan aşımı"dır. Bozulma riski NFS/CIFS gibi uzak dosya sistemlerinde doğar.

**Compose dosyasında bugün duran ilgili zaaf:** `docker-compose.yml:27` satırında `ENABLE_SCHEDULER=1` **sabit gömülü** (`${...}` değil). Bu uygulamanın ikinci bir kopyası (staging/preview) açılırsa panelden zamanlayıcı kapatılamaz. Tek satırlık düzeltme: `- ENABLE_SCHEDULER=${ENABLE_SCHEDULER:-0}`.

### 4.4 Arıza modu 2: boş volume → sessiz veri kaybı

Bu, listedeki en tehlikeli maddedir çünkü hiçbir alarm çalmaz.

Dokploy her deploy'da repo dizinini silip yeniden klonluyor: "On subsequent deployments, Dokploy cleans the directory and performs a fresh `git clone`" ve "Docker loses the reference to the files that were in the filesystem". Mevcut compose named volume (`veteriner_sms_data:/app/data`) kullandığı için bu tuzağa **düşmüyor**. `./data:/app/data` gibi depoya göreli bir bind mount ya da mutlak host yolu kullanılsaydı klinik veritabanları her deploy'da uçardı ("Avoid using absolute host paths, as they will be cleaned up during deployments"). Not: dokümanın önerdiği `../files/` deseni de güvenli bir bind mount yoludur; tüm bind mount'lar tehlikeli değildir.

**Ama volume adı sandığınız gibi olmayacak.** Dokploy'un Volume Backups dokümanı birebir: "For Docker Compose services, volume names follow a specific pattern: `{appName}_{volumeName}`". Yani gerçek ad `<appName>_veteriner_sms_data` olur. Ayrıca `isolatedDeploymentsVolume` anahtarı açılırsa ad `veteriner_sms_data-<appName>` biçimine döner (kaynak: `collision.ts:22-24`) — bu anahtar kapalı kalmalıdır.

**Zincir şöyle işler:** uygulama silinip yeniden oluşturulursa veya volume adı değişirse yeni ve boş bir volume oluşur → `src/server.js:11-26` `users.count() === 0` görünce ADMIN_EMAIL/ADMIN_PASSWORD ile yeni bir süperadmin yaratıp normal açılır → `/api/health` ve `/api/version` 200 döner → `.github/workflows/deploy-notify.yml` yalnızca buildTime karşılaştırdığı için "dağıtım canlıda" bildirir. Bütün klinikler ve hastalar yok olmuştur, hiçbir alarm çalmaz.

**İki önlem:** (1) compose'un `volumes:` bloğuna `name: veteriner_sms_data` ekleyip adı sabitleyin; (2) `/api/version` çıktısına klinik sayısı ekleyin, deploy doğrulaması bunu kontrol etsin.

### 4.5 Yedek: bugünkü durum ve Dokploy ile durum

`src/backup.js:23` yedeği `path.join(config.dataDir, 'backups', date)` altına, yani üretim verisiyle aynı dizine yazıyor; `docker-compose.yml:12` bunu açıkça kabul ediyor ("Veriler veteriner_sms_data adlı volume'da (/app/data) kalır; yedekler de oradadır"). Volume kaybı = veri + 14 günlük yedeğin tamamı. **Bu açık Mac mini'de de, Türkiye veri merkezinde de, yurt dışında da aynen devam eder — Dokploy'a taşımak kendiliğinden çözmez, ayrıca yapılandırma gerekir.** KVKK Kişisel Veri Güvenliği Rehberi §3.6 birebir: "veri seti yedekleri mutlaka ağ dışında tutulmalıdır ... Bu nedenle tüm yedeklerin fiziksel güvenliğinin de sağlandığından emin olunmalıdır."

**Önemli:** bu ihtiyaç Dokploy'a bağımlı değildir. `src/backup.js`'in ürettiği `VACUUM INTO` dosyalarını bir `rclone`/`restic` cron'u ile S3'e veya başka bir diske göndermek, bu kazancın tamamını Mac mini üzerinde, taşıma olmadan ve yeni saldırı yüzeyi açmadan verir.

**"Turn off container during backup" hakkında düzeltme:** bu seçeneği kapatmanız için daha önce gösterilen gerekçe geçersizdir. Issue #3392 açık değil, PR #3637 ile düzeltilip kapatılmıştır (volume backup'a flock kilidi eklendi, temizlik cron'u 23:50'ye alındı); ilgili #4263 de kapatılmıştır. Ayrıca Dokploy'un otomatik temizliği volume prune'u kodda dışlıyor: `utils.ts:364-366` `excludedCleanupAllCommands = ["volumes"]`; `docker volume prune --all --force` yalnızca panelden elle tetiklenir. Dokploy'un kendi dokümanı "Container OFF (Recommended): Safer option that prevents data corruption during backup" diyor. Gerçek durum: her iki seçenek de savunulabilir. Container ON seçilirse canlı `.db` dosyaları sıcak kopyalanır (yırtık olabilir) ama volume içindeki `data/backups/` klasörü `VACUUM INTO` ürünü olduğu için tutarlı kalır. Kalan gerçek risk: temizlikte `docker container prune --force` var; panelde "Clean volumes" düğmesine elle dokunmayın.

### 4.6 Ağ, domain ve ortam değişkenleri

- **Cloudflare Tunnel korunacaksa Dokploy'un domain özelliği kullanılmamalıdır.** Doküman: "At runtime, during the deployment phase, Dokploy automatically adds Traefik labels internally to your Docker Compose file" ve servisin `dokploy-network`'e eklenmesi gerekiyor. Sizin compose'unuz external `teserix_network`'te ve cloudflared `http://veteriner-sms:3000` ile geliyor. İki yönlendirme katmanı üst üste binmemeli: servis `teserix_network`'te bırakılmalı.
- **`container_name: veteriner-sms` satırı kaldırılmalıdır.** Dokploy dokümanı birebir: "Don't set container_name property to the each service, it will cause issues with logs, metrics and other features." Dokploy zaten `-p <appName>` veriyor. **Uyarı:** Compose normalde servis adını ağ üzerinde alias olarak kaydettiği için `http://veteriner-sms:3000` hedefinin çalışmaya devam etmesi beklenir, ancak bu bu oturumda ölçülmedi — ilk deploy'dan sonra cloudflared konteynerinden isim çözümlemesi doğrulanmalıdır.
- **"Isolated Deployment" korkusu yersiz:** `addAppNameToAllServiceNames` (`collision/root-network.ts:46-62`) servis/konteyner adlarını yeniden adlandırmıyor; yalnızca appName adında external bir ağ ekleyip her servisi ona da bağlıyor. `teserix_network` korunur.
- **TRUST_PROXY / cf-connecting-ip değişikliği gerekmiyor:** `src/ratelimit.js:47-53` önce `cf-connecting-ip` başlığına bakıyor, compose'da `TRUST_PROXY=1` sabit. Tek incelik: `src/app.js:26` `app.set('trust proxy', 1)` tek hop varsayar.
- **`__Host-vsid` çerezi sorunsuz:** `src/auth.js` Path=/, HttpOnly, SameSite=Lax, üretimde Secure, Domain yok — önekin üç şartı da sağlanıyor. (Oturumların korunması zaten önemsiz: `config.sessionTtlHours = 12`.)
- **APP_ORIGIN geçişteki en büyük 403 kaynağıdır.** `src/config.js` virgülle çoklu origin destekliyor; `src/auth.js` üretimde Origin/Referer eşleşmezse 403 "İsteğin kaynağı doğrulanamadı" döner. Geçiş penceresinde hem yeni alan adını hem Tailscale Funnel adresini virgülle yazın.
- **Eksik ortam değişkeni gürültülü arıza verir (iyi).** `NODE_ENV=production` sabit olduğu için kısa/eksik APP_SECRET veya eksik APP_ORIGIN `throw` eder ve konteyner crash-loop'a girer. Compose stop-first çalıştığı için eski konteyner çoktan silinmiştir → düzeltene kadar tam kesinti. İlk dağıtımdan önce Environment sekmesini iki kez kontrol edin.
- **Saat dilimi sorunu yok:** `src/util.js` `Intl.DateTimeFormat` ile `config.timeZone = 'Europe/Istanbul'` kullanıyor; konteynerin UTC olması gönderim penceresini, BACKUP_HOUR'u ve günlük tavan gün sınırını etkilemez.

### 4.7 Kesintiye dayanıklılık (ev senaryosunun lehine bir bulgu)

`src/db/tenant.js` hatırlatmayı `due_date + 3 gün`e kadar uygun sayıyor ve `notify_days_before` varsayılanı 1. Yani bildirim gününden sonra dört günlük telafi penceresi var — dört günden kısa elektrik/internet kesintisinde SMS kaybolmaz, dönüşte gönderilir. Tek kapı: `src/scheduler.js:95-97` gönderimi 09:00-20:00 aralığına sınırlıyor, dolayısıyla dönüş gece olursa SMS ertesi sabah gider. Kesintinin gerçek maliyeti kaçan SMS değil, o saatlerde kliniğin panele girememesidir.

### 4.8 Kapanış davranışı (değişiklik gerekmiyor)

`src/server.js` SIGTERM'de önce çalışan zamanlayıcı turunu bekliyor, 25 saniyede bitmezse zorla çıkıyor; `docker-compose.yml:23` `stop_grace_period: 30s` bunu tanıyor. Kalıntı risk: SIGKILL tam gönderim anında düşerse `claim` zaten `last_attempt_at` yazdığı için o hatırlatma 4 saat tekrar denenmez — bu bilinçli bir tasarımdır (çift SMS yerine geç SMS) ve tek süreç içinde doğru çalışır.

---

## 5. KVKK: üç senaryo

Zincir: klinik = **veri sorumlusu**, Teserix = **veri işleyen**, sunucuyu sağlayan firma = **alt veri işleyen**. KVKK'nın kendi yayını (Veri Sorumlusu ve Veri İşleyen, Haziran 2025, s.15) birebir: "bulut hizmeti sağlayıcısı veri işleyen statüsündedir. Zira ... kişisel verileri kendi amaçları için kullanması mümkün değildir."

| Konu | S1: Ev (Mac mini, bugün) | S2: Türkiye'de veri merkezi | S3: Yurt dışı sunucu |
|---|---|---|---|
| m.9 (yurt dışına aktarım) | Doğmaz | Doğma olasılığı çok azalır (bkz. iki istisna) | **Doğar.** Yeterlilik kararı yok; standart sözleşme (Modül 3) + beş iş günü içinde bildirim + m.9/8 alt-işleyen güvenceleri |
| Açık rıza ile çözme | Gerekmez | Gerekmez | **Kapalı.** m.9/6 "arızi olmak kaydıyla"; Rehber No:48: "yalnızca tek seferlik veya birkaç kez gerçekleşecek ve süreklilik arz etmeyecek" |
| m.12 fiziksel güvenlik (Rehber §3.3) | **Zayıf.** Kilitli oda, giriş/çıkış kaydı, dış risklere karşı koruma konutta belgelenmesi güç | İyi | İyi |
| Ceza usulü (7545 m.8/5) | Gecikmesinde sakınca varsa savcı yazılı emriyle arama/kopya/el koyma | **Yalnızca yetkilendirilmiş veri merkezi işletmecilerinde** hâkim kararı şartı; sağlayıcının bu statüde olduğu yazılı teyit edilmeli | Türk usul güvencesi yok |
| Teserix'e doğrudan ceza riski | Yok (m.18/1-d doğmaz) | Yok | **Var.** m.18/1-d veri işleyene de uygulanır: 2026'da 90.308 – 1.806.177 TL |
| VERBİS beyanı (kliniğin) | Değişmez | Değişmez | m.16/3-(d) "yabancı ülkelere aktarımı öngörülen kişisel veriler" doldurulur; m.16/4 "derhâl" güncellenir |
| Yedeklerin ağ dışında tutulması (§3.6) | **İhlal sürüyor** | **İhlal sürüyor** | **İhlal sürüyor** |
| Cloudflare proxy açılırsa | Ek aktarım argümanı | Ek aktarım argümanı | Zaten m.9 içinde |

**Ev senaryosunun m.12 zaafı.** Rehber §3.3 kişisel veri içeren sunucu ve yedekleme cihazları için "ek güvenlik önlemlerinin olduğu başka bir odaya alınması, kullanılmadığı zaman kilit altında tutulması, giriş çıkış kayıtlarının tutulması" gibi önlemleri sayar ve fiziksel ortamların dış risklere (yangın, sel vb.) karşı korunmasını ister. Bunlar örnek listedir, kapalı bir zorunluluk katalogu değildir; kilitli bir dolap ve giriş-çıkış kaydı bir konutta da kurulabilir. Yine de bir veri merkezinde bu maddeyi belgelemek çok daha kolaydır: **S2 ve S3 bu maddede S1'e nettir üstündür.**

**Yurt dışı senaryosunun m.9 yükümlülüğü.** Kurul bugüne kadar hiçbir ülke için yeterlilik kararı vermemiştir; kvkk.gov.tr/Icerik/2053 birebir: "Bu konuda Kurul tarafından henüz bir belirleme yapılmamıştır." Dolayısıyla m.9/4'teki uygun güvencelerden birine geçmek zorunludur; pratikte tek gerçekçi yol standart sözleşmedir (Kurul 04.06.2024, 2024/959; sizin ilişkiniz **Modül 3: Veri İşleyenden Veri İşleyene**). Yönetmelik (RG 10.07.2024/32598) m.14: metin **üzerinde değişiklik yapılmaksızın** kullanılacak (14/3), temsile yetkili kişilerce imzalanacak (14/4), imzaların tamamlanmasından itibaren **beş iş günü içinde** Kuruma bildirilecek (14/5), tevsik edici belgeler ve yabancı dildeki her belgenin **noter onaylı çevirisi** eklenecek (14/6), taraflarda/içerikte değişiklik veya sözleşmenin sona ermesi hâlinde de aynı usulle bildirilecek (14/8 — süregen yükümlülük). Ayrıca m.9/8 sonraki aktarımları da kapsar ve Yönetmelik m.7/2 veri sorumlusunun (kliniğin) sorumluluğunun ortadan kalkmadığını söyler.

Pratik uyarı: Hetzner, DigitalOcean gibi sağlayıcıların bu sözleşmeyi (özellikle Modül 3'ü, değiştirilmeden, temsile yetkili imzayla) imzalayıp imzalamayacağı doğrulanmadı. S3'ü ciddiye alacaksanız ilk sorulacak şey sunucu fiyatı değil, "bu sözleşmeyi imzalar mısınız" sorusudur.

**Sunucunun yeri belirleyicidir.** Kurul 17.03.2022 / 2022/249 kararı birebir: "Veri sorumlusu tarafından sunucuları yurt dışında bulunan sistemin kullanılması aracılığıyla kişisel verilerin yurt dışına aktarılması faaliyetinin gerçekleştirildiği..." (o kararda 950.000 TL ceza m.18/1-b veri güvenliği bendinden kesilmiştir ve karar 2024 değişikliğinden öncedir; birebir emsal olarak değil, yaklaşım göstergesi olarak okunmalıdır).

**İki istisna: S2 bile m.9'u tetikleyebilir.**
1. Yönetmelik m.4/(e) aktarımı "iletilmesi ya da başka bir suretle erişilebilir hâle getirilmesi" olarak tanımlar. Rehber No:48 birebir: "Üçüncü bir ülkeden uzaktan erişimin (yalnızca kişisel verilerin bir ekranda görüntülenmesi yoluyla gerçekleşse bile, örneğin destek durumlarında, sorun giderme veya yönetim amacıyla) ... bir aktarım olarak kabul edilecektir." Yani yurt dışından uzaktan yönetim/destek erişimi de aktarımdır.
2. **Cloudflare proxy'sini açmak ayrı bir aktarım argümanı doğurur.** Cloudflare'in kendi SSL modes dokümanı iki ayrı TLS bağlantısı olduğunu ("one between your visitors and Cloudflare, and the other between Cloudflare and your origin server") ve edge'de sonlandırıldığını teyit ediyor; Cloudflare Inc. ABD tüzel kişisidir. (Nüans: Flexible modda CF–origin bacağı yeniden şifrelenmez, düz HTTP'dir.) Bu risk üç senaryoda da aynıdır ve barındırma kararından bağımsızdır. Bu konuda doğrudan bir Kurul kararı bulunamadı; çıkarımdır, avukat teyidi ister.

**Bugünkü Tailscale Funnel düzeni bu açıdan daha temizdir.** Tailscale dokümanı birebir: "Funnel relay servers do not decrypt the traffic between public devices and your device. This ensures that Tailscale cannot access or read any content." TLS cihazın üzerinde sonlanır. Yani şu an yabancı bir aracıya **düz metin içerik** erişimi verilmiyor. (Nüans: Tailscale Inc. de ABD tüzel kişisidir; kontrol düzlemi/meta veri ilişkisi sürer.)

**VERBİS muafiyeti.** Kurul 06.07.2023 / 2023/1154: yıllık çalışan sayısı 50'den az **ve** yıllık mali bilanço toplamı 100 milyon TL'den az olanlar muaf (ana faaliyeti özel nitelikli veri işlemek olmamak kaydıyla; Kurul 04.09.2025 / 2025/1572 o hâl için <10 çalışan ve <10 milyon TL eşiği getirdi). Hayvan sağlığı verisi hasta sahibinin özel nitelikli kişisel verisi değildir; klinik esasen ad/telefon işler. Dolayısıyla çoğu klinik muhtemelen muaftır — ama m.9 yükümlülükleri muafiyetten bağımsız sürer.

**Veri işleyen sözleşmesi.** 6698'de veri işleyenle yazılı sözleşme yapmayı doğrudan emreden bir madde yoktur; Rehber §2.5 "önerilmektedir" der. Yine de m.12/2 (müşterek sorumluluk), m.12/3 (denetim yaptırma) ve m.12/4 (süresiz sır saklama) karşısında klinikle aranızda yazılı bir veri işleyen sözleşmesi imzalamak değerli bir uyum aracıdır.

**Kullanılmayan gerekçe (kayıt için).** "Rehber §3.4 klinik başına ayrı şifreleme anahtarı gerektiriyor" argümanı geçersizdir; o hüküm birden çok bulut çözümü kullanımını düzenler. Uygulamada tek `APP_SECRET` bulunması (`src/crypto.js`) bugün de aynen geçerlidir ve Dokploy bunu yaratmaz. Bunu bir ihlal değil, isteğe bağlı bir sertleştirme fırsatı sayın.

---

## 6. Maliyet tablosu

Kur (9 Eylül 2026, ölçüm): USD/TRY 48,478 — EUR/TRY 56,4857.

| Kalem | Aylık | Not |
|---|---|---|
| Mac mini elektriği (bugün) | ~70 TL | Tahmin. Apple tablosu: Mac mini (2018) boşta 19,9 W → 14,3 kWh/ay. Marjinal tüketim olduğu için üst kademeden faturalanır. Tarife rakamı yalnızca ikincil kaynaklardan doğrulanabildi |
| Dokploy yazılımı (self-hosted) | 0 TL | "Free and open-source software" |
| **Uygulamayı mevcut Dokploy sunucusuna eklemek** | **+0 TL** | Ölçüm: RSS 61.516 KB, CPU %0,0, veri 2,5 MB (bunun 1,9 MB'ı `data/pazarlama`, uygulama verisi değil). Sunucuda boş RAM olduğu **varsayımına** dayanır |
| Türkiye'de ayrı VPS (2 vCPU / 4 GB) | ~814 – ~1.527 TL | Alastyr VDS Standart liste 677,96 TL **KDV hariç** (sitenin ifadesi: "KDV İLAVESİYLE ... faturalandırılır") → %20 KDV ile ~814 TL. Natro XCloud Medium liste 1.526,56 TL (sitede görünen 484,29 TL yalnızca ilk 3 ay; KDV ve lokasyon belirtilmemiş) |
| Yurt dışı VPS (2 vCPU / 4 GB) | ~310 – ~1.163 TL | Hetzner CX23 €5,49 (~310 TL), CAX11 €5,99 (~338 TL), CPX22 €19,49 (~1.101 TL — 15.06.2026 zammıyla €7,99'dan çıktı). DigitalOcean $24 ≈ 1.163 TL, vergi hariç. **Hepsi KVKK m.9'u tetikler** |
| Supabase için sunucu yükseltmesi | +904 – +1.328 TL | **Senaryo, ölçüm değil.** Dokploy sunucusunun donanımı doğrulanmadı. CPX22 → CPX32 tam +16 EUR; Alastyr Cloud-8G liste farkı +1.327,80 TL (KDV hariç). Yıllık +9.000 ile +16.000 TL — korunan veri 2,5 MB |

Ek notlar: Hetzner AB dışı müşteriye KDV'siz fatura keser; Türkiye'de sorumlu sıfatıyla KDV (2 no'lu beyanname) yükümlülüğü doğup doğmadığı doğrulanmadı, muhasebeciye sorulmalı. Hetzner'de 2 Eylül 2026'da tüm CX ve CAX planları stokta değildi ama aynı tarihte CPX12 sipariş edilebiliyordu; stok saatler içinde ve lokasyona göre değişiyor, sipariş anında kontrol edilmeli. EclitGO (eski Vargonen) liste $11,30 (~548 TL) ama lokasyon seçimi belirsiz ve şirket Ocak 2024'te siber saldırıya uğradı, müşteri raporlarına göre hizmetler ~2 hafta ayakta gelemedi ve kendi yedekleri alınamamıştı.

---

## 7. Karar eşikleri

| Durum | Yapılacak |
|---|---|
| **Bugün** (ücretsiz pilot / kendi kliniğin, tek kiracı) | Mac mini kalsın. Taşıma. Bunun yerine üç işi yap: (1) yedekleri `/app/data` dışına çıkar (rclone/restic ile S3 veya ayrı disk), (2) `docker-compose.yml:27` → `ENABLE_SCHEDULER=${ENABLE_SCHEDULER:-0}`, (3) `volumes:` bloğuna `name: veteriner_sms_data` ekle ve `/api/version`'a klinik sayısı koy |
| **İlk faturalı klinik** | Dokploy'a taşı — marjinal maliyet 0 TL. **Ön koşul: sunucunun ülkesini ve boş RAM'ini doğrula.** Yurt dışıysa önce Modül 3 standart sözleşme + beş iş günü bildirim planlanmalı; sağlayıcı imzalamıyorsa yol kapalıdır |
| **Sözleşmeye uptime/SLA yazdığın an** | Veri merkezi zorunlu. TEDAŞ 2024 Sektör Raporu: bildirimsiz 1.099 dk + bildirimli 721 dk = 1.820 dk/yıl ≈ 30,3 saat → %99,65. %99,9'un yıllık bütçesi 8,8 saat; tek başına şebeke bunu 3,4 kat aşıyor. (Raporun kendisi Avrupa değerlerinin 2018, Türkiye değerinin 2024 olduğunu belirtiyor.) Bugünkü makine 44 gün 9 saattir kesintisiz açık — bu tek gözlem, SLA değil |
| **Binlerce klinik** | Sorun sunucu değil kod: `src/scheduler.js:127` klinikleri sıralı işliyor. Ama taşan tick kayıp tick değil (`if (running) return running;`), gönderilen hatırlatma `sent` olup sorgudan düşer. Gerçek tavan günlüktür: 09:00-20:00 penceresinde ~11 saat / ~1 sn sağlayıcı çağrısı ≈ 40.000 SMS/gün (**çıkarım, ölçüm değil**). O eşiğe gelindiğinde yapılacak iş sunucu değiştirmek değil, klinik döngüsünü sınırlı eşzamanlılıkla çalıştırmaktır |
| **Asla eşik değil** | Elektrik faturası (~70 TL/ay) ve "Supabase kuralım" ihtiyacı |

---

## 8. Taşıma runbook'u

Ön koşullar: sunucunun ülkesi doğrulanmış, boş RAM ölçülmüş, Dokploy sürümü ≥ 0.29.4 teyit edilmiş.

### 8.0 Taşımadan önce depoda yapılacak değişiklikler

```bash
cd /Users/thejackaltr/GitHub/veteriner-sms
# 1) container_name kaldır (Dokploy dokümanı: log/metrik sorunlarına yol açıyor)
# 2) ENABLE_SCHEDULER'ı panelden yönetilebilir yap
# 3) volume adını sabitle (boş volume tuzağına karşı)
```

`docker-compose.yml` hedef hâli (ilgili kısımlar):

```yaml
services:
  veteriner-sms:
    # container_name: veteriner-sms   <-- KALDIRILDI
    environment:
      - ENABLE_SCHEDULER=${ENABLE_SCHEDULER:-0}
volumes:
  veteriner_sms_data:
    name: veteriner_sms_data
```

Dokploy panel ayarları: **Compose Type = Docker Compose** (Stack veya Application DEĞİL), Domain özelliği **kullanılmayacak** (Cloudflare Tunnel korunuyor), `isolatedDeploymentsVolume` **kapalı**.

### 8.1 Boş kurulum ve doğrulama

Dokploy Environment sekmesine: `APP_SECRET` (Mac mini `.env` içindeki **aynı** değer), `APP_ORIGIN` (geçiş penceresi için virgülle iki adres: yeni alan adı + mevcut Tailscale Funnel adresi), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, ve **`ENABLE_SCHEDULER=0`**.

```bash
# Sunucuda, deploy sonrası
docker ps | grep veteriner
docker volume ls | grep veteriner          # gerçek volume adını not al -> $V
docker exec <cloudflared-konteyneri> wget -qO- http://veteriner-sms:3000/api/health
```

`{"ok":true}` görülmeden devam etmeyin. Cloudflare Tunnel ingress kaydını yeni alan adı için ekleyin.

### 8.2 Mac mini'yi durdur ve tutarlı kopya al

```bash
cd /Users/thejackaltr/GitHub/veteriner-sms
deploy/mac-mini/service.sh stop

# WAL'ı gövdeye yaz + bütünlük kontrolü (master kapanışta kapatılmadığı için şart)
node -e 'const {DatabaseSync}=require("node:sqlite"),fs=require("fs");const r="./data";
for(const f of ["master.db",...fs.readdirSync(r+"/tenants").filter(x=>/^[a-f0-9]{12}\.db$/.test(x)).map(x=>"tenants/"+x)]){
  const d=new DatabaseSync(r+"/"+f); d.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  console.log(f, JSON.stringify(d.prepare("PRAGMA integrity_check").get())); d.close(); }'

# Çıktıda her dosya için integrity_check = ok görülmeli, -wal ve -shm dosyaları silinmiş olmalı
ls -la data/*.db-wal data/*.db-shm data/tenants/*.db-wal 2>/dev/null   # boş dönmeli

# Paketle (data/pazarlama uygulama verisi DEĞİL, dışarıda bırak)
tar czf ~/vet-data.tgz -C data master.db tenants backups trash
shasum -a 256 ~/vet-data.tgz
scp ~/vet-data.tgz sunucu:/root/
```

### 8.3 Volume'u doldur

```bash
# Sunucuda
V=$(docker volume ls -q | grep veteriner_sms_data)
docker stop $(docker ps -q -f name=veteriner-sms)

docker run --rm -v $V:/data -v /root:/in alpine sh -c '
  tar xzf /in/vet-data.tgz -C /data &&
  rm -f /data/*.db-wal /data/*.db-shm /data/tenants/*.db-wal /data/tenants/*.db-shm &&
  chown -R 1000:1000 /data &&
  chmod 700 /data /data/tenants && chmod 600 /data/master.db /data/tenants/*.db &&
  ls -la /data /data/tenants'
```

(`node` imajında uid/gid 1000'dir — bu oturumda çalıştırılarak doğrulanmadı, Docker daemon kapalı. `Dockerfile:20` `chown -R node:node /app`, `Dockerfile:22` `USER node`. `src/config.js` `process.umask(0o077)` nedeniyle yeni dosyalar zaten 600 olur.)

### 8.4 Zamanlayıcıyı aç ve doğrula

Environment'ta `ENABLE_SCHEDULER=1` yapıp yeniden deploy edin. Ardından:

```bash
curl -s https://<yeni-alan-adi>/api/health     # {"ok":true}
curl -s https://<yeni-alan-adi>/api/version    # buildTime artık "unknown" olmamalı
```

Panelde: `/admin` açılıp klinik listesinin **dolu** olduğu görülmeli (boş volume alarmı budur). Bir klinikte `/ayarlar` > Test SMS ile İleti Merkezi kimlik bilgilerinin çözüldüğü doğrulanmalı — çözülemiyorsa APP_SECRET yanlış taşınmıştır.

### 8.5 Yedeği makine dışına çıkar

Dokploy > Volume Backups: named volume `veteriner_sms_data`, S3/R2 hedefi (provider, accessKeyId, secretAccessKey, bucket, endpoint alanları var), cron `BACKUP_HOUR=3`'ten sonraya (örn. 04:00), `keepLatestNBackups` ayarlanır. Düzenli olarak indirip `PRAGMA integrity_check` ile geri yükleme tatbikatı yapın. Alternatif ve Dokploy'a bağımlı olmayan yol: `data/backups/` altındaki `VACUUM INTO` çıktılarını rclone/restic cron'u ile dışarı gönderin.

### 8.6 Geri dönüş (rollback)

**Kural: hiçbir anda iki tarafta birden `ENABLE_SCHEDULER=1` olmayacak.**

Senaryo A — taşıma sırasında sorun çıktı, henüz Dokploy'da veri değişmedi:

```bash
# 1. Dokploy'da zamanlayıcıyı kapat
#    Environment: ENABLE_SCHEDULER=0 -> redeploy
# 2. Mac mini'yi geri aç
cd /Users/thejackaltr/GitHub/veteriner-sms
deploy/mac-mini/service.sh start
curl -s localhost:3000/api/health
# 3. Cloudflare Tunnel ingress'ini eski hedefe al ya da Tailscale Funnel adresini kullan
```

Senaryo B — Dokploy'da bir süre çalıştı, veri değişti, geri dönmek gerekiyor:

```bash
# Sunucuda: zamanlayıcıyı kapat, konteyneri durdur, tutarlı kopya al
V=$(docker volume ls -q | grep veteriner_sms_data)
docker stop $(docker ps -q -f name=veteriner-sms)
docker run --rm -v $V:/data -v /root:/out alpine sh -c 'tar czf /out/vet-back.tgz -C /data master.db tenants backups trash'
# Yerelde
scp sunucu:/root/vet-back.tgz ~/
cd /Users/thejackaltr/GitHub/veteriner-sms
cp -a data data.onceki-$(date +%F-%H%M)     # emniyet kopyası
tar xzf ~/vet-back.tgz -C data
chmod 700 data data/tenants && chmod 600 data/master.db data/tenants/*.db
deploy/mac-mini/service.sh start
```

Sonra Dokploy tarafında `ENABLE_SCHEDULER=0` bırakın (veya uygulamayı durdurun) ve tünel hedefini geri alın.

Taşıma başarılıysa Mac mini **soğuk yedek** olarak tutulmalıdır: `.env` içinde `ENABLE_SCHEDULER=0` ve launchd servisi **kurulu değil**. Depodaki `deploy/mac-mini/` dosyaları (plist, service.sh, setup-cloudflare.sh, cloudflared-config.yml) bu yüzden boşa gitmez.

---

## 9. Doğrulanamayanlar

Karar verirken bunların açık olduğunu bilerek karar verin.

**Bloke edici:**
1. **Dokploy sunucusunun fiziksel konumu** (Türkiye mi yurt dışı mı, hangi sağlayıcı). Alan adları Cloudflare arkasında olduğu için origin IP gizli. Tüm KVKK sonucu buna bağlı. Sağlayıcıdan **yazılı** olarak veri merkezi ülkesi ve adresi istenmeli.
2. **Dokploy sunucusunun RAM/CPU/disk kapasitesi ve boş kaynağı.** "Marjinal maliyet 0" sonucu, sunucuda en az birkaç yüz MB boş RAM olduğu varsayımına dayanıyor. `free -h` ve `docker stats` ile ölçülmeli.
3. **Kurulu Dokploy sürümü.** 0.29.3 altındaysa CVE-2026-45631 (kimlik doğrulamasız admin devralma → host'ta RCE) doğrudan geçerlidir ve bu, veteriner-sms'ten bağımsız olarak acil bir konudur.

**Önemli ama bloke edici değil:**
4. 2026-07-21'de yayımlanan 42 danışma belgesinin çoğunda `patched_versions` alanı boş/null; etkilenen aralıklar çoğunlukla `<= 0.29.8`. Bugünkü v0.30.6'nın bu açıkların **tümünü** kapsayıp kapsamadığı doğrulanamadı.
5. Compose tipi deploy'da gerçek kesinti süresi (saniye) ölçülmedi. `up -d --build`'in imajı konteyneri durdurmadan önce derlediği çıkarım yoluyla söylendi.
6. `container_name` kaldırıldığında `http://veteriner-sms:3000` DNS hedefinin çözülmeye devam edip etmeyeceği ölçülmedi (Compose'un servis adını ağ alias'ı olarak kaydettiği genel davranışından çıkarım). İlk deploy'dan sonra cloudflared konteynerinden test edilmeli.
7. `node` imajında uid/gid'in 1000 olduğu bu oturumda çalıştırılarak doğrulanmadı (Docker daemon kapalı). Aynı nedenle imaj derlenmedi, hiçbir konteyner testi yapılmadı.
8. Volume Backups'ın Cloudflare R2 ile çalıştığı, R2'nin S3 API uyumluluğundan çıkarımdır; Dokploy dokümanı R2'yi adıyla saymıyor. Bir kez denenmeli.
9. Mevcut kurulumda `dokploy-redis` kalıntısı olup olmadığı sunucuda `docker ps` ile bakılmalı (install.sh'de redis yok, uninstall dokümanı hâlâ listeliyor).
10. Panelde "Docker Cleanup" ve zamanlanmış temizlik işlerinin şu anda açık olup olmadığı görülemedi.
11. Zamanlayıcının günlük ~40.000 SMS tavanı **ölçülmedi**; sıralı döngü ve ~1 sn'lik sağlayıcı gecikmesi tahmininden çıkarım.
12. Cloudflare proxy/Tunnel kullanımının "yurt dışına aktarım" sayıldığına dair **doğrudan bir Kurul kararı bulunamadı**; çıkarım Yönetmelik m.4/(e) + Rehber No:48 uzaktan erişim örneği + Cloudflare TLS dokümanının birleşimine dayanıyor. Avukat teyidi ister.
13. Türkiye'deki hangi sağlayıcının 7545 anlamında "yetkilendirilmiş veri merkezi işletmecisi" olduğu doğrulanamadı — bu statü S2'nin ana hukuki avantajının ön şartıdır ve sağlayıcıya yazılı sorulmalıdır.
14. Yabancı sağlayıcıların KVKK standart sözleşmesini (Modül 3, değiştirilmeden, temsile yetkili imzayla) imzalayıp imzalamayacağı doğrulanamadı. İmzalamazsa S3 hukuken kapanır, çünkü açık rıza yolu "arızilik" şartı nedeniyle zaten kapalıdır.
15. Veteriner mevzuatında (5996 sayılı Kanun ve alt düzenlemeler) kayıtların Türkiye'de tutulmasını emreden bir yerelleştirme hükmü olup olmadığı araştırılmadı; varsa S3'ü KVKK'dan bağımsız olarak tek başına kapatır (m.9/10 "diğer kanunlarda yer alan hükümler saklıdır").
16. Elektrik tarifesi rakamları (3,24 / 4,86 TL/kWh) EPDK'nın kendi sayfalarından teyit edilemedi, yalnızca ikincil Türkçe kaynaklardan alındı. Sonuç üzerinde etkisi yok.
17. Teserix'in kendisinin (veri işleyen sıfatıyla) VERBİS'e kayıt yükümlülüğü olup olmadığı netleştirilemedi.
18. Mac mini'de kalma senaryosu için Dokploy'a hafif alternatifler (Portainer, doğrudan launchd + Watchtower, Linux VM içinde Dokploy) karşılaştırılmadı.

---

## İlgili dosyalar

- `/Users/thejackaltr/GitHub/veteriner-sms/docker-compose.yml` (16 container_name, 23 stop_grace_period, 27 ENABLE_SCHEDULER sabiti, 36-39 volume ve ağ, 46-47 volumes bloğu)
- `/Users/thejackaltr/GitHub/veteriner-sms/Dockerfile` (19-20 BUILD_TIME ve chown, 22 USER node, 24-25 HEALTHCHECK)
- `/Users/thejackaltr/GitHub/veteriner-sms/src/backup.js` (15-19 wal_checkpoint + VACUUM INTO, 23 yedek dizini)
- `/Users/thejackaltr/GitHub/veteriner-sms/src/scheduler.js` (95-97 gönderim saati kapısı, 103-105 sıralı hatırlatma döngüsü ve 4 saat filtresi, 124 çift-çalışma kilidi, 127 sıralı klinik döngüsü)
- `/Users/thejackaltr/GitHub/veteriner-sms/src/db/tenant.js` (244 `claim` — süreçler arası koruma sağlamaz)
- `/Users/thejackaltr/GitHub/veteriner-sms/src/lock.js` (6 süreç-içi kilit)
- `/Users/thejackaltr/GitHub/veteriner-sms/src/config.js` (2 umask, 38-52 APP_SECRET/APP_ORIGIN doğrulaması, 64-69 zamanlayıcı/yedek/saat dilimi)
- `/Users/thejackaltr/GitHub/veteriner-sms/src/server.js` (11-26 ilk süperadmin, 39-52 SIGTERM)
- `/Users/thejackaltr/GitHub/veteriner-sms/deploy/mac-mini/` (soğuk yedek düzeni)
- `/Users/thejackaltr/GitHub/veteriner-sms/docs/kvkk-veri-sorumlulugu-ve-supabase.md` (ceza tablosu — rakamlar bu turda birincil kaynaktan doğrulandı)
- `/Users/thejackaltr/GitHub/veteriner-sms/docs/self-hosted-supabase-degerlendirmesi.md` (önceki tur)
