#!/bin/sh
# Lädt die große Karte: Western Australia bis Zoomstufe 14 in vier Teilen (zusammen gut 200 MB),
# ausgeschnitten aus dem Protomaps-Planet-Build. Braucht das Programm pmtiles:
#   Mac: brew install pmtiles   ·   sonst: https://github.com/protomaps/go-pmtiles/releases
# Danach: npm run build:gross
# Jeder Aufruf hat ein festes Gebiet (--bbox). Ohne Gebiet lüde pmtiles die ganze Welt (über 100 GB).
# Ältere Builds löscht Protomaps nach einiger Zeit. Dann einen aktuellen von
# https://maps.protomaps.com/builds wählen: PLANET=https://build.protomaps.com/JJJJMMTT.pmtiles sh holen.sh
set -e
cd "$(dirname "$0")"
P=${PLANET:-https://build.protomaps.com/20261029.pmtiles}
pmtiles extract "$P" wa-sued.pmtiles      --bbox=112.5,-35.5,129.2,-31.0 --maxzoom=14
pmtiles extract "$P" wa-mitte.pmtiles     --bbox=112.5,-31.5,129.2,-26.0 --maxzoom=14
pmtiles extract "$P" wa-nordwest.pmtiles  --bbox=112.5,-26.5,129.2,-20.0 --maxzoom=14
pmtiles extract "$P" wa-kimberley.pmtiles --bbox=112.5,-20.5,129.2,-13.5 --maxzoom=14
ls -lh *.pmtiles
