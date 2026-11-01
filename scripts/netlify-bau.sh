#!/bin/sh
# Bau auf Netlify mit großer Karte. Die vier Kartenteile sind zu groß fürs Repo, deshalb kommen sie
# aus dem Release-Paket. Liegen sie schon in karten-gross/, wird nichts geladen.
set -e
PAKET=${KARTEN_PAKET:-https://github.com/Kotdesigner/TravelBuddy/releases/download/v1.2.0/TravelBuddy-Netlify-Grosse-Karte.zip}
TEILE="wa-sued wa-mitte wa-nordwest wa-kimberley"
fehlt=
for t in $TEILE; do [ -s "karten-gross/$t.pmtiles" ] || fehlt=1; done
if [ -n "$fehlt" ]; then
  echo "Große Karte aus dem Release holen"
  z=$(mktemp)
  curl -fsSL "$PAKET" -o "$z"
  for t in $TEILE; do unzip -q -o -j "$z" "karten/$t.pmtiles" -d karten-gross; done
  rm -f "$z"
fi
npm ci
npm run build:gross
node tests/basic-privat.test.mjs > /dev/null
