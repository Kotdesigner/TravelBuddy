#!/bin/sh
# Baut TravelBuddy für Linux (x86-64 und ARM64) aus der fertigen Web-App, auch auf dem Mac.
#   sh win/baue-linux.sh   → win/build-linux/TravelBuddy-Linux-x64.tar.gz und TravelBuddy-Linux-arm64.tar.gz
#   KARTE=gross sh win/baue-linux.sh → win/build-linux-gross/…-Grosse-Karte.tar.gz (braucht karten-gross/)
# Braucht Go (brew install go).
set -e
cd "$(dirname "$0")/.."
ZIEL=win/build-linux
BUILD=build
ZUSATZ=
if [ "$KARTE" = "gross" ]; then ZIEL=win/build-linux-gross; BUILD=build:gross; ZUSATZ=-Grosse-Karte; fi

echo "▶︎ Web-App bauen"
npm run "$BUILD" >/dev/null 2>&1
node tests/basic-privat.test.mjs >/dev/null || { echo "✗ Datenschutz-Test gescheitert, nichts gebaut"; exit 1; }
rm -rf win/web "$ZIEL" && cp -R dist win/web && mkdir -p "$ZIEL"

for a in amd64 arm64; do
  [ "$a" = amd64 ] && n=x64 || n=arm64
  echo "▶︎ Übersetzen (linux/$a)"
  o="$ZIEL/TravelBuddy-Linux-$n"; mkdir -p "$o"
  (cd win && CGO_ENABLED=0 GOOS=linux GOARCH=$a go build -trimpath -ldflags "-s -w" -o "../$o/TravelBuddy" .)
  cat > "$o/LIESMICH.txt" <<'TEXT'
TravelBuddy for Linux
=====================

1. Unpack: tar -xzf TravelBuddy-Linux-*.tar.gz
2. Start: ./TravelBuddy
3. With Chrome, Chromium, Edge or Brave the app opens in its own window. Otherwise it opens in your
   default browser, for example Firefox. Your data stays on this computer.

Runs without internet. Weather, warnings and new road routes need a connection.

Deutsch: Entpacken, dann ./TravelBuddy starten. Mit Chrome, Chromium, Edge oder Brave öffnet sich ein
eigenes Fenster, sonst der Standardbrowser. Deine Daten bleiben auf diesem Rechner.
TEXT
  (cd "$ZIEL" && tar -czf "TravelBuddy-Linux-$n$ZUSATZ.tar.gz" --no-mac-metadata -C "TravelBuddy-Linux-$n" TravelBuddy LIESMICH.txt 2>/dev/null || tar -czf "TravelBuddy-Linux-$n$ZUSATZ.tar.gz" -C "TravelBuddy-Linux-$n" TravelBuddy LIESMICH.txt)
  rm -rf "$o"
done
rm -rf win/web
ls -la "$ZIEL"/*.tar.gz | awk '{printf "✓ %d MB  %s\n", $5/1048576, $9}'
