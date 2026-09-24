#!/bin/bash
# launchd altındaki çalışan kurulumu Docker'a taşır.
#
#   deploy/mac-mini/to-docker.sh            # taşı
#   deploy/mac-mini/to-docker.sh --rollback # launchd'ye geri dön
#
# Neden dikkatli: iki kopya aynı anda çalışırsa iki zamanlayıcı aynı hatırlatmayı gönderebilir
# (src/lock.js süreç içidir). Bu yüzden önce launchd durdurulur, sonra Docker başlatılır.
# İkinci tuzak: boş volume ile açılan uygulama yeni bir süperadmin yaratıp sağlıklı görünür;
# betik taşımadan önce ve sonra klinik sayısını karşılaştırır.
set -euo pipefail

LABEL="com.teserix.veteriner-sms"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
VOLUME="veteriner_sms_data"
NETWORK="teserix_network"
DOMAIN="gui/$(id -u)"
cd "$REPO"

msg() { printf '\n==> %s\n' "$*"; }
die() { printf '\nHATA: %s\n' "$*" >&2; exit 1; }

count_clinics() { sqlite3 "$1" 'SELECT COUNT(*) FROM clinics' 2>/dev/null || echo "?"; }

stop_launchd() {
  if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    sleep 2
  fi
  ! curl -fsS -m 2 http://127.0.0.1:3000/api/health >/dev/null 2>&1
}

if [ "${1:-}" = "--rollback" ]; then
  msg "Docker durduruluyor"
  docker compose down 2>/dev/null || true
  msg "launchd yeniden kuruluyor"
  "$REPO/deploy/mac-mini/service.sh" install
  exit 0
fi

command -v docker >/dev/null || die "docker kurulu değil"
docker info >/dev/null 2>&1 || die "Docker çalışmıyor (Docker Desktop'ı açın)"
command -v sqlite3 >/dev/null || die "sqlite3 gerekli"
[ -f "$REPO/.env" ] || die ".env yok; APP_SECRET olmadan kayıtlı sağlayıcı bilgileri çözülemez"
grep -q '^APP_SECRET=.\{32,\}' "$REPO/.env" || die ".env içindeki APP_SECRET en az 32 karakter olmalı"

msg "1/7 Taşıma öncesi durum"
BEFORE_CLINICS="$(count_clinics "$REPO/data/master.db")"
BEFORE_TENANTS="$(ls "$REPO"/data/tenants/*.db 2>/dev/null | wc -l | tr -d ' ')"
echo "    klinik: $BEFORE_CLINICS, klinik dosyası: $BEFORE_TENANTS"
[ "$BEFORE_CLINICS" != "?" ] || die "master.db okunamadı"

msg "2/7 launchd servisi durduruluyor (yazan süreç kalmasın)"
stop_launchd || die "3000 portu hâlâ yanıt veriyor; başka bir kopya çalışıyor olabilir"

msg "3/7 WAL gövdeye yazılıyor + bütünlük kontrolü"
for f in "$REPO/data/master.db" "$REPO"/data/tenants/*.db; do
  [ -e "$f" ] || continue
  sqlite3 "$f" 'PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null
  ok="$(sqlite3 "$f" 'PRAGMA integrity_check;')"
  [ "$ok" = "ok" ] || die "bütünlük hatası: $f -> $ok"
  echo "    ok: $(basename "$f")"
done

msg "4/7 Soğuk yedek (geri dönüş için)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_TGZ="$REPO/../veteriner-sms-data-$STAMP.tgz"
tar -czf "$BACKUP_TGZ" -C "$REPO" data
echo "    $BACKUP_TGZ"

msg "5/7 Volume hazırlanıyor ve veri kopyalanıyor"
docker network inspect "$NETWORK" >/dev/null 2>&1 || docker network create "$NETWORK" >/dev/null
if docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  EXISTING="$(docker run --rm -v "$VOLUME":/d alpine sh -c 'ls /d/master.db 2>/dev/null | wc -l')"
  [ "$EXISTING" = "0" ] || die "$VOLUME zaten dolu. Üzerine yazmadım. Gerekirse: docker volume rm $VOLUME"
else
  docker volume create "$VOLUME" >/dev/null
fi
docker run --rm -v "$VOLUME":/dst -v "$REPO/data":/src:ro alpine \
  sh -c 'cp -a /src/. /dst/ && chown -R 1000:1000 /dst' >/dev/null

msg "6/7 Volume doğrulanıyor (boş volume tuzağı)"
AFTER_CLINICS="$(docker run --rm -v "$VOLUME":/d alpine:3.20 sh -c 'apk add --no-cache sqlite >/dev/null 2>&1; sqlite3 /d/master.db "SELECT COUNT(*) FROM clinics"')"
echo "    volume içindeki klinik sayısı: $AFTER_CLINICS (beklenen: $BEFORE_CLINICS)"
[ "$AFTER_CLINICS" = "$BEFORE_CLINICS" ] || die "klinik sayısı tutmuyor; Docker başlatılmadı. Geri dönüş: $0 --rollback"

msg "7/7 Konteyner başlatılıyor"
docker compose up -d --build
for i in $(seq 1 30); do
  sleep 2
  if curl -fsS -m 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then break; fi
  if docker compose exec -T veteriner-sms node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then break; fi
  [ "$i" = "30" ] && die "uygulama ayağa kalkmadı: docker compose logs veteriner-sms"
done
docker compose ps

cat <<MSG

Taşıma tamam.
  - Veri: docker volume $VOLUME (soğuk yedek: $BACKUP_TGZ)
  - launchd servisi kaldırıldı; ikinci kopya çalışmıyor (çift SMS riski yok)
  - Zamanlayıcı: .env içindeki ENABLE_SCHEDULER değeri geçerli (şu an: $(grep -E '^ENABLE_SCHEDULER=' "$REPO/.env" | cut -d= -f2))
  - Erişim tünelden: docker logs -f cloudflared
  - Geri dönüş:  $0 --rollback

Kontrol listesi:
  docker compose logs -f veteriner-sms
  docker compose exec veteriner-sms node -e "import('./src/db/master.js').then(m=>console.log('klinik:', m.clinics.all().length))"
MSG
