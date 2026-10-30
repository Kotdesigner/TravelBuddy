#!/bin/sh
# Baut TravelBuddy.app für den Mac (Apple Silicon und Intel) aus der fertigen Web-App.
#   sh mac/baue-mac-app.sh          → mac/build/TravelBuddy.app und mac/build/TravelBuddy-Mac.zip
#   KARTE=gross sh mac/baue-mac-app.sh → mac/build-gross/… und TravelBuddy-Mac-Grosse-Karte.zip
#     (braucht die Dateien in karten-gross/, siehe karten-gross/holen.sh)
# Braucht Xcode (für swiftc). Die App ist nicht notariell beglaubigt: beim ersten Öffnen
# Rechtsklick → Öffnen, oder Systemeinstellungen → Datenschutz & Sicherheit → „Trotzdem öffnen“.
set -e
cd "$(dirname "$0")/.."
[ -d /Applications/Xcode.app ] && export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo 1.0.0)
[ "$VERSION" = "0.0.0" ] && VERSION=1.0.0
ZIEL=mac/build
BUILD=build
PAKET=TravelBuddy-Mac.zip
if [ "$KARTE" = "gross" ]; then ZIEL=mac/build-gross; BUILD=build:gross; PAKET=TravelBuddy-Mac-Grosse-Karte.zip; fi
APP="$ZIEL/TravelBuddy.app"

echo "▶︎ Web-App bauen"
npm run "$BUILD" >/dev/null 2>&1
node tests/basic-privat.test.mjs >/dev/null || { echo "✗ Datenschutz-Test gescheitert, keine App gebaut"; exit 1; }

echo "▶︎ Programm übersetzen (arm64 + x86_64)"
rm -rf "$ZIEL" && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
for a in arm64 x86_64; do
  xcrun swiftc -O -target "$a-apple-macos13.0" -o "$ZIEL/TravelBuddy-$a" mac/TravelBuddy.swift
done
xcrun lipo -create -output "$APP/Contents/MacOS/TravelBuddy" "$ZIEL/TravelBuddy-arm64" "$ZIEL/TravelBuddy-x86_64"
rm "$ZIEL"/TravelBuddy-arm64 "$ZIEL"/TravelBuddy-x86_64

echo "▶︎ Symbol und Inhalte"
SET="$ZIEL/AppIcon.iconset"; mkdir -p "$SET"
for g in 16 32 128 256 512; do
  sips -z $g $g public/icon-512.png --out "$SET/icon_${g}x${g}.png" >/dev/null
  d=$((g * 2)); sips -z $d $d public/icon-512.png --out "$SET/icon_${g}x${g}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$APP/Contents/Resources/AppIcon.icns" && rm -rf "$SET"
cp -R dist "$APP/Contents/Resources/web"
for l in de en; do mkdir -p "$APP/Contents/Resources/$l.lproj"; echo "\"CFBundleDisplayName\" = \"TravelBuddy\";" > "$APP/Contents/Resources/$l.lproj/InfoPlist.strings"; done

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>TravelBuddy</string>
  <key>CFBundleDisplayName</key><string>TravelBuddy</string>
  <key>CFBundleIdentifier</key><string>de.kotdesigner.travelbuddy</string>
  <key>CFBundleExecutable</key><string>TravelBuddy</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleDevelopmentRegion</key><string>de</string>
  <key>CFBundleLocalizations</key><array><string>de</string><string>en</string></array>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$(date +%Y%m%d%H%M)</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.travel</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>TravelBuddy by Kotdesigner</string>
  <key>NSLocationWhenInUseUsageDescription</key><string>Für Warnungen, Wetter und Notfallhilfe in deiner Nähe.</string>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST

codesign --force --deep -s - "$APP" 2>/dev/null
(cd "$ZIEL" && ditto -c -k --keepParent TravelBuddy.app "$PAKET")
echo "✓ $APP ($(du -sh "$APP" | cut -f1)), Paket: $ZIEL/$PAKET ($(du -h "$ZIEL/$PAKET" | cut -f1))"
