#!/bin/sh
# Erzeugt public/handbuch.pdf aus docs/handbuch/handbuch.html und die englische Fassung
# public/handbook.pdf aus docs/handbuch/handbook-en.html (Chrome ohne Fenster).
# Dazu die Seiten für die Ansicht in der App: public/handbuch.html und public/handbook.html.
# Danach `npm run build`, damit das Handbuch in dist/ landet.
cd "$(dirname "$0")/.." || exit 1
sed 's#\.\./\.\./public/fonts/#/fonts/#' docs/handbuch/handbuch.html > public/handbuch.html
sed 's#\.\./\.\./public/fonts/#/fonts/#' docs/handbuch/handbook-en.html > public/handbook.html
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Google Chrome nicht gefunden: $CHROME"; exit 1; }
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=4000 \
  --allow-file-access-from-files --print-to-pdf="public/handbuch.pdf" "file://$(pwd)/docs/handbuch/handbuch.html" 2>/dev/null
[ -s public/handbuch.pdf ] && echo "✓ public/handbuch.pdf erzeugt ($(du -h public/handbuch.pdf | cut -f1))"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=4000 \
  --allow-file-access-from-files --print-to-pdf="public/handbook.pdf" "file://$(pwd)/docs/handbuch/handbook-en.html" 2>/dev/null
[ -s public/handbook.pdf ] && echo "✓ public/handbook.pdf erzeugt ($(du -h public/handbook.pdf | cut -f1))"
