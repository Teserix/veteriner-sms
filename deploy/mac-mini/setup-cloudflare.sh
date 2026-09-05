#!/bin/bash
# Mac mini'yi Cloudflare Tunnel ile dışa açar (HTTPS, port yönlendirme yok).
# Kullanım:  deploy/mac-mini/setup-cloudflare.sh [hostname]      (varsayılan: vet.teserix.com)
# Ön koşul: `brew install cloudflared` (kurulu) ve bir kez `cloudflared tunnel login` (tarayıcıda Cloudflare hesabınızla).
set -euo pipefail
HOSTNAME_="${1:-vet.teserix.com}"
TUNNEL_NAME="veteriner-sms"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"

if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
  echo "Önce Cloudflare hesabınızla oturum açın (tarayıcı açılır, alan adını seçin):"
  echo "    cloudflared tunnel login"
  exit 1
fi

# 1) Tünel (yoksa oluştur)
if ! cloudflared tunnel list --output json | grep -q "\"name\":\"$TUNNEL_NAME\""; then
  cloudflared tunnel create "$TUNNEL_NAME"
fi
TUNNEL_ID=$(cloudflared tunnel list --output json | python3 -c 'import sys,json;print(next(t["id"] for t in json.load(sys.stdin) if t["name"]=="'"$TUNNEL_NAME"'"))')
CRED_SRC="$HOME/.cloudflared/$TUNNEL_ID.json"
echo "Tünel: $TUNNEL_NAME ($TUNNEL_ID)"

# 2) DNS kaydı: hostname -> tünel (varsa hata vermez)
cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME_" || true

# 3) Sistem servisi (LaunchDaemon, açılışta girişten bağımsız). /etc/cloudflared altında çalışır.
sudo mkdir -p /etc/cloudflared
sudo cp "$CRED_SRC" /etc/cloudflared/
sed -e "s#__TUNNEL_ID__#$TUNNEL_ID#" -e "s#__CREDENTIALS_FILE__#/etc/cloudflared/$TUNNEL_ID.json#" -e "s#__HOSTNAME__#$HOSTNAME_#" \
  "$REPO/deploy/mac-mini/cloudflared-config.yml" | sudo tee /etc/cloudflared/config.yml >/dev/null
sudo chmod 600 /etc/cloudflared/*.json /etc/cloudflared/config.yml
if launchctl print system/com.cloudflare.cloudflared >/dev/null 2>&1; then
  sudo launchctl kickstart -k system/com.cloudflare.cloudflared
else
  sudo cloudflared service install
fi

# 4) Uygulamanın kabul ettiği adres listesine ekle
ENV_FILE="$REPO/.env"
ORIGIN="https://$HOSTNAME_"
if grep -q "^APP_ORIGIN=" "$ENV_FILE"; then
  CUR=$(grep "^APP_ORIGIN=" "$ENV_FILE" | cut -d= -f2-)
  case ",$CUR," in *",$ORIGIN,"*) ;; *) sed -i '' "s#^APP_ORIGIN=.*#APP_ORIGIN=$ORIGIN,$CUR#" "$ENV_FILE";; esac
else
  echo "APP_ORIGIN=$ORIGIN" >> "$ENV_FILE"
fi
"$REPO/deploy/mac-mini/service.sh" restart >/dev/null 2>&1 || true

echo
echo "Tamam. Birkaç dakika içinde: $ORIGIN"
echo "Kontrol: curl -sS $ORIGIN/api/health"
