#!/bin/bash
# Uygulama servisini yönetir. Varsayılan LaunchAgent (kullanıcı oturumu). `sudo` ile çalıştırılırsa LaunchDaemon.
# Kullanım: deploy/mac-mini/service.sh install|restart|stop|status|logs
set -euo pipefail
LABEL="com.teserix.veteriner-sms"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_SRC="$REPO/deploy/mac-mini/$LABEL.plist"
if [ "$(id -u)" = "0" ]; then
  DOMAIN="system"; PLIST="/Library/LaunchDaemons/$LABEL.plist"
else
  DOMAIN="gui/$(id -u)"; PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
fi
mkdir -p "$(dirname "$PLIST")" "$HOME/Library/Logs"
case "${1:-status}" in
  install|restart)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    cp "$PLIST_SRC" "$PLIST"
    launchctl bootstrap "$DOMAIN" "$PLIST"
    launchctl kickstart -k "$DOMAIN/$LABEL"
    sleep 2
    curl -fsS http://localhost:3000/api/health && echo " <- sağlıklı ($DOMAIN)"
    ;;
  stop)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null && echo "durduruldu" || echo "çalışmıyordu"
    ;;
  status)
    launchctl print "$DOMAIN/$LABEL" 2>/dev/null | grep -E "state|pid|last exit" || echo "kurulu değil ($DOMAIN)"
    curl -fsS http://localhost:3000/api/version 2>/dev/null && echo
    ;;
  logs)
    tail -n 50 -f "$HOME/Library/Logs/veteriner-sms.log"
    ;;
  *) echo "Kullanım: $0 install|restart|stop|status|logs"; exit 1;;
esac
