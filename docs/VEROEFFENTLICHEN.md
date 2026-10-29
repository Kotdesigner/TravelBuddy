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

1. Auf app.netlify.com anmelden: **Sites → Add new site → Deploy manually**.
2. Den Ordner **`dist`** in das Feld ziehen. Alternativ als ZIP:
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
