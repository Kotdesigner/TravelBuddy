// Hintergrund-Rechner für Offline-Routen (V29). Lädt die Straßennetze einmal (aus dem Speicher,
// sonst übers Netz) und rechnet dort, damit die Bedienung flüssig bleibt.
// Nachricht: { id, stops, netze: [{ name, url }], meidePiste, pistenFaktor, sperrungen, allrad }
// sperrungen: Meldungen von Main Roads WA, deren Straßen die Umleitung meiden soll (sperrungen.js) → Antwort { id, route, quelle } oder { id, fehler }
import { leseNetz, routeOffline } from './offline-router.js'
import { sperrKanten } from './sperrungen.js'

const CACHE = 'routing-netze-v1'
const netze = new Map()
const sperrCache = new Map()   // url + Meldungen → gesperrte Kanten

function netz(url) {
  if (!netze.has(url)) {
    netze.set(url, (async () => {
      let resp = null
      try { resp = await (await caches.open(CACHE)).match(url) } catch {}
      if (!resp) resp = await fetch(url)   // Hauptstraßen: im App-Speicher vorab gesichert
      if (!resp.ok) throw new Error('Straßennetz fehlt: ' + url)
      return leseNetz(await resp.arrayBuffer())
    })().catch((e) => { netze.delete(url); throw e }))
  }
  return netze.get(url)
}

self.onmessage = async (e) => {
  const { id, stops, netze: liste = [], meidePiste = false, pistenFaktor, vergessen, sperrungen = null, allrad = false } = e.data || {}
  if (vergessen) { netze.delete(vergessen); for (const k of sperrCache.keys()) if (k.startsWith(vergessen + '|')) sperrCache.delete(k); return }
  for (const n of liste) {
    try {
      const net = await netz(n.url)
      let gesperrt = null
      if (sperrungen?.length) {
        const k = n.url + '|' + (allrad ? '4wd|' : '') + sperrungen.map((m) => m.id + '@' + (m.zeitMs || '')).join(',')
        if (!sperrCache.has(k)) { if (sperrCache.size > 20) sperrCache.clear(); sperrCache.set(k, sperrKanten(net, sperrungen, { allrad }).gesperrt) }
        gesperrt = sperrCache.get(k)
      }
      const route = routeOffline(net, stops, { meidePiste, gesperrt, ...(pistenFaktor ? { pistenFaktor } : {}) })
      if (route) { self.postMessage({ id, route, quelle: n.name }); return }
    } catch (err) { /* nächstes Netz versuchen */ }
  }
  self.postMessage({ id, route: null })
}
