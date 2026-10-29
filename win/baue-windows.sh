#!/bin/sh
# Baut TravelBuddy.exe für Windows 10 und 11 (64 Bit) aus der fertigen Web-App, auch auf dem Mac.
#   sh win/baue-windows.sh   → win/build/TravelBuddy.exe und win/build/TravelBuddy-Windows.zip
# Braucht Go (brew install go) und einmal: go install github.com/akavel/rsrc@v0.10.2 (für das Symbol).
# Die exe ist nicht signiert: Windows zeigt beim ersten Start „Der Computer wurde durch Windows
# geschützt“ → „Weitere Informationen“ → „Trotzdem ausführen“.
set -e
cd "$(dirname "$0")/.."
ZIEL=win/build

echo "▶︎ Web-App bauen"
npm run build >/dev/null 2>&1
node tests/basic-privat.test.mjs >/dev/null || { echo "✗ Datenschutz-Test gescheitert, keine exe gebaut"; exit 1; }
rm -rf win/web "$ZIEL" && cp -R dist win/web && mkdir -p "$ZIEL"

echo "▶︎ Symbol"
python3 -c "from PIL import Image; Image.open('public/icon-512.png').convert('RGBA').save('$ZIEL/TravelBuddy.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])"
RSRC="$(go env GOPATH)/bin/rsrc"
if [ -x "$RSRC" ]; then "$RSRC" -ico "$ZIEL/TravelBuddy.ico" -arch amd64 -o win/rsrc_windows_amd64.syso; else echo "  (ohne Symbol: rsrc fehlt)"; fi

echo "▶︎ Übersetzen (windows/amd64, ohne Konsolenfenster)"
(cd win && CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-H windowsgui -s -w" -o build/TravelBuddy.exe .)
rm -f win/rsrc_windows_amd64.syso

cat > "$ZIEL/LIESMICH.txt" <<'TEXT'
TravelBuddy für Windows 10 und 11
=================================

1. TravelBuddy.exe an einen festen Ort legen, zum Beispiel in „Dokumente“ oder auf den Desktop.
2. Doppelklick. Beim ersten Start meldet Windows „Der Computer wurde durch Windows geschützt“,
   weil die Datei nicht signiert ist: „Weitere Informationen“ → „Trotzdem ausführen“.
3. TravelBuddy öffnet sich in einem eigenen Fenster (Microsoft Edge, ohne Adressleiste).
   Die Einführung führt durch alles. Deine Daten bleiben auf diesem PC.

Läuft ohne Internet. Für Wetter, Warnungen und neue Straßenrouten braucht es Netz.

TravelBuddy for Windows 10 and 11: double-click TravelBuddy.exe. If Windows SmartScreen warns,
choose "More info" → "Run anyway". The app opens in its own Edge window, your data stays on this PC.
TEXT
(cd "$ZIEL" && rm -f TravelBuddy-Windows.zip && zip -q -X TravelBuddy-Windows.zip TravelBuddy.exe LIESMICH.txt)
echo "✓ $ZIEL/TravelBuddy.exe ($(du -h "$ZIEL/TravelBuddy.exe" | cut -f1)), Paket: $ZIEL/TravelBuddy-Windows.zip ($(du -h "$ZIEL/TravelBuddy-Windows.zip" | cut -f1))"
