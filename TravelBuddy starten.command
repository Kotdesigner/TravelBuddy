#!/bin/bash
# TravelBuddy — New Style · lokaler Starter für den Mac.
# Doppelklick: baut die App bei Bedarf, startet einen lokalen Server und öffnet den Browser.
# Zum Beenden dieses Terminalfenster schließen.
#
# Port 8990: eigener Datenraum, getrennt von anderen TravelBuddy-Fassungen auf 8900.
# BEWUSST derselbe Port wie im Ordner „TravelBuddy - New Style": ein anderer Port
# wäre für den Browser eine andere Website — Notizen, Logbuch und gesicherte Karten
# lägen dann nicht mehr vor. Deshalb immer nur EINEN der beiden Ordner laufen lassen.
# Beim ersten Start werden deine gesicherten Daten automatisch übernommen.

cd "$(dirname "$0")" || exit 1

if [ ! -f package.json ]; then
  echo "package.json nicht gefunden — liegt diese Datei im TravelBuddy-Ordner?"
  read -n1
  exit 1
fi

# 1) Bauen, falls noch kein fertiger Build vorhanden ist.
if [ ! -f dist/index.html ]; then
  echo "▶︎ Baue TravelBuddy (einmalig, dauert einen Moment) …"
  npm install >/dev/null 2>&1
  npm run build || { echo "Build fehlgeschlagen."; read -n1; exit 1; }
fi

# 2) Welche Dokumenten-Fassung liegt hier? Damit nie unklar ist, ob Pass und Visum
#    im Build stecken — das entscheidet, ob er hochgeladen werden darf.
if [ -f dist/dokumente/index.json ]; then
  if grep -q '"mitPersoenlichen":true' dist/dokumente/index.json; then
    echo "⚠️  Dieser Build enthält die PERSÖNLICHEN PAPIERE (Pass, Visum, Führerschein)."
    echo "    Nur für dieses Gerät. NICHT hochladen."
    echo "    Fassung zum Hochladen bauen:  npm run build"
  else
    echo "🔒  Dieser Build ist OHNE persönliche Papiere — zum Hochladen geeignet."
    echo "    Fassung mit allem fürs eigene Gerät:  npm run build:privat"
  fi
  echo ""
fi

PORT=8990
echo ""
echo "🧭  TravelBuddy läuft auf:  http://localhost:${PORT}/"
echo "    (Dieses Fenster offen lassen. Schließen = App beenden.)"
echo ""

cd dist

# 3) Server starten (Python bevorzugt, sonst Node).
if command -v python3 >/dev/null 2>&1; then
  ( sleep 1; open "http://localhost:${PORT}/" ) &
  python3 -m http.server "$PORT"
else
  ( sleep 2; open "http://localhost:${PORT}/" ) &
  npx --yes serve -l "$PORT" .
fi
