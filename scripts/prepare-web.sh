#!/usr/bin/env bash
# ============================================================================
#  scripts/prepare-web.sh
#  Baut den Capacitor-Web-Root (www/) aus den Quell-Webdateien im Repo zusammen.
#
#  Warum: capacitor.config.json hat "webDir": "www", aber www/ ist gitignored
#  und wird NICHT eingecheckt. Vor jedem `npx cap sync` muss www/ neu befüllt
#  werden. Dieses Script ist die EINE Quelle der Wahrheit dafür — es wird von
#  `npm run sync:ios` / `sync:android` UND von der CI (build-ios/android.yml)
#  benutzt, damit lokaler Xcode-Build und CI-Build exakt gleich sind.
#
#  Es kopiert ALLE Dateien, die index.html zur Laufzeit referenziert
#  (territory.js, assets/, bg-poster.jpg, videos/ … — die alte CI-Liste war
#  unvollständig und hätte die native App zerbrochen).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ www/ zurücksetzen"
rm -rf www
mkdir -p www

echo "→ Kern-Webdateien kopieren"
cp index.html manifest.json sw.js territory.js rc-erfolg-icons.js privacy.html promo.html altstore-source.json www/

echo "→ Medien kopieren"
[ -f bg.mp4 ]        && cp bg.mp4 www/
[ -f bg-poster.jpg ] && cp bg-poster.jpg www/

echo "→ Asset-Ordner kopieren (alle von index.html referenzierten)"
for d in icons assets videos; do
  [ -d "$d" ] && cp -r "$d" www/
done

echo "→ Nicht benötigte Dateien aus www/ entfernen (Zips, macOS-Reste)"
find www -type f \( -name '*.zip' -o -name '.DS_Store' \) -delete 2>/dev/null || true

echo "✓ www/ bereit — $(find www -type f | wc -l | tr -d ' ') Dateien, $(du -sh www | cut -f1)"
