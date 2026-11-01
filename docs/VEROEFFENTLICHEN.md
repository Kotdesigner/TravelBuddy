# Eigene TravelBuddy-Seite veröffentlichen

TravelBuddy ist eine installierbare Web-App. Wer sie für sich und seine Leute bereitstellen will, braucht
nur einen statischen Webspace mit HTTPS, zum Beispiel eine kostenlose Netlify-Seite.

## 1 · Bauen und prüfen

```
npm install
npm run build
node tests/basic-privat.test.mjs
```

Der letzte Befehl muss „0 gescheitert“ melden. Er stellt sicher, dass keine Namen, Konto-Kennungen,
Reisedaten oder privaten Adressen im Build stecken.

## 2 · Hochladen (Netlify)

**Am einfachsten direkt aus GitHub:** Auf app.netlify.com **Add new site → Import an existing project →
GitHub** und das Repo wählen. Build-Befehl und Ordner stehen schon in `netlify.toml`, nichts eintragen.
Jede Änderung an der App auf `main` baut und veröffentlicht die Seite neu, mit großer Karte aus dem Release (`scripts/netlify-bau.sh`). Reine Text- und Bildänderungen lösen keinen Bau aus.

**Ohne GitHub-Anbindung:** Unter Releases liegt `TravelBuddy-Netlify.zip`, der fertige Ordner `dist`.

1. Auf app.netlify.com anmelden: **Sites → Add new site → Deploy manually**.
2. Die ZIP-Datei oder den selbst gebauten Ordner **`dist`** in das Feld ziehen. Eigenes ZIP bauen:
   `cd dist && zip -q -r -X ../TravelBuddy-Netlify.zip . -x '.DS_Store'`
3. **Site configuration → Change site name** wählen, zum Beispiel `travelbuddy-wa`.

Eine eigene Adresse ist auch ein eigener Speicher: Was Nutzer eintragen, liegt im Browser unter genau
dieser Adresse. Deshalb eine neue Fassung immer auf **dieselbe** Seite laden (Deploys → `dist` hineinziehen),
nie eine fremde Seite überschreiben.

## 3 · Selbst ausprobieren

1. Die Adresse in einem privaten Fenster öffnen: die Einführung „Willkommen bei TravelBuddy“ erscheint.
2. Am iPhone in Safari öffnen, Teilen → „Zum Home-Bildschirm“, von dort starten. Danach einmal im
   Flugmodus öffnen: die App startet trotzdem.
3. Hängt ein Gerät auf einem alten Stand: `…/reset.html` öffnen und den Knopf drücken.

## 4 · Textvorschlag zum Weitergeben

> Hier ist TravelBuddy, eine Reise-App für Western Australia: https://travelbuddy-wa.netlify.app
> Am iPhone in Safari öffnen, dann Teilen und „Zum Home-Bildschirm“. Beim ersten Öffnen führt dich die App
> durch alles. Deine Daten bleiben nur auf deinem Handy. Ab und zu unter Mehr ein Backup machen.

## 5 · Musik unterwegs (freiwillig)

Im Code sind keine Spotify-Zugänge hinterlegt. Wer Musik sammeln will, braucht Spotify Premium und eine
eigene, kostenlose App auf developer.spotify.com. Dort als **Redirect URI** die Adresse eintragen, die in
TravelBuddy unter Mehr → Musik steht, und die **Client-ID** in TravelBuddy übernehmen. Die Playlist legt
die App dann im eigenen Konto an. Ein Last.fm-Schlüssel bringt zusätzlich die Charts des Landes.

## 6 · Mac-App

`sh mac/baue-mac-app.sh` baut `mac/build/TravelBuddy.app` und `mac/build/TravelBuddy-Mac.zip` (braucht Xcode).
Die App bringt die fertige Web-App mit und zeigt sie über einen eingebauten Server auf `127.0.0.1:8990` in
einem eigenen Fenster. Daten liegen im Speicher der App und bleiben über Neustarts erhalten.

Unterschiede zum Browser: Die Sperre mit Touch ID für Belege braucht einen Browser (Safari, Chrome), in der
App steht sie nicht zur Verfügung. Backups landen in „Downloads“, Links nach draußen öffnet der Standardbrowser.

## 7 · Windows-App

`sh win/baue-windows.sh` baut `win/build/TravelBuddy.exe` und `win/build/TravelBuddy-Windows.zip`, auch auf dem
Mac (braucht Go, für das Symbol einmal `go install github.com/akavel/rsrc@v0.10.2`). Die Web-App steckt in der
exe. Beim Start liefert ein eingebauter Server sie auf `127.0.0.1:8990` aus, Microsoft Edge zeigt sie als
eigenes Fenster ohne Adressleiste, mit eigenem Profil unter `%LOCALAPPDATA%\TravelBuddy`. Fehlt Edge, nimmt die
App Chrome oder den Standardbrowser. In Edge funktioniert die Sperre für Belege mit Windows Hello.
