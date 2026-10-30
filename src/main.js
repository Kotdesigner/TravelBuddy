import { mount, unmount } from 'svelte'
import './app.css'
// Schrift- und Gesamtgröße vor dem ersten Bild setzen (sonst springt die Seite nach dem Start)
import './lib/darstellung.js'
import App from './App.svelte'
import { beimSprachwechsel } from './lib/i18n.js'

// Neue Fassung sofort übernehmen.
//
// Der Service-Worker cacht die App-Hülle. Er installiert sich zwar im Hintergrund
// selbst neu (skipWaiting/clientsClaim), aber die BEREITS GELADENE Seite läuft
// weiter mit dem alten JavaScript — man müsste also zweimal neu laden, um eine
// Änderung zu sehen. Deshalb hier: sobald der neue Service-Worker die Kontrolle
// übernimmt, einmalig neu laden.
//
// `hatteController` verhindert ein überflüssiges Neuladen beim allerersten Besuch:
// da wechselt die Kontrolle von „keiner" auf „der erste" — das ist kein Update.
if ('serviceWorker' in navigator) {
  const hatteController = !!navigator.serviceWorker.controller
  let laedtNeu = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hatteController || laedtNeu) return
    laedtNeu = true
    location.reload()
  })
}

// Die Offline-Karten wurden neu zugeschnitten (größere Gebiete, feinere Zoomstufen),
// die Dateinamen sind aber gleich geblieben. Der alte Cache läuft „CacheFirst" mit einem
// Jahr Haltbarkeit — ohne diesen Aufräumer bekäme ein Gerät, das die alten Kacheln schon
// hat, die neuen NIE zu sehen. Der neue Cache heißt deshalb anders; der alte fliegt raus
// und gibt seine ~21 MB wieder frei.
if ('caches' in window) {
  caches.delete('karten-pmtiles').catch(() => {})
}

const ziel = document.getElementById('app')
let app = mount(App, { target: ziel })

// Sprachwechsel: alles neu aufbauen und an derselben Stelle stehen bleiben. Das Bild wechselt
// erst, wenn die Daten da sind (der Kreis wartet darauf), spätestens nach drei Sekunden.
beimSprachwechsel(async () => {
  const stelle = window.scrollY
  await unmount(app)
  await Promise.race([
    new Promise((fertig) => { app = mount(App, { target: ziel, props: { onbereit: fertig } }) }),
    new Promise((fertig) => setTimeout(fertig, 3000)),
  ])
  window.scrollTo({ top: stelle, behavior: 'instant' })
})

export default app
