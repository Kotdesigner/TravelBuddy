// „App zurücksetzen“: löscht alles, was TravelBuddy auf diesem Gerät gespeichert hat, und startet
// danach wie frisch installiert. Vorher fragt die App zweimal und bietet ein Backup an.
// Die App-Hülle (Service-Worker-Vorrat) bleibt, sonst startet sie danach ohne Netz gar nicht.
import { frage } from './dialog.js'
import { je } from './i18n.js'

/** Alle Datenbanken der App (userdata, Belege, Tagebuch-Fotos, Tresor) */
export const DATENBANKEN = ['wa-plan', 'wa-belege', 'wa-tagebuch-fotos', 'wa-tresor']

/** Welche Caches gelöscht werden: alle außer der App selbst (Workbox-Vorrat) */
export const zuLoeschen = (namen) => namen.filter((n) => !/^workbox-precache/.test(n))

const loescheDb = (name) => new Promise((fertig) => {
  try {
    const r = indexedDB.deleteDatabase(name)
    r.onsuccess = r.onerror = () => fertig()
    r.onblocked = () => fertig()         // offene Verbindung: das Löschen läuft beim Neuladen zu Ende
  } catch { fertig() }
})

export async function allesLoeschen() {
  let namen = DATENBANKEN
  try { if (indexedDB.databases) namen = [...new Set([...namen, ...(await indexedDB.databases()).map((d) => d.name).filter(Boolean)])] } catch {}
  await Promise.race([Promise.all(namen.map(loescheDb)), new Promise((r) => setTimeout(r, 2500))])
  try { for (const n of zuLoeschen(await caches.keys())) await caches.delete(n) } catch {}
  try { localStorage.clear() } catch {}
  try { sessionStorage.clear() } catch {}
}

/** Der Knopf im Menü. `backup` speichert vorher eine Backup-Datei. */
export async function appZuruecksetzen(backup) {
  const erst = await frage({
    titel: je('App zurücksetzen?', 'Reset the app?'),
    text: je('Alles, was TravelBuddy auf diesem Gerät gespeichert hat, wird gelöscht: Reisen, Etappen, Logbuch, Fotos, Buchungen, Dokumente mit ihren Dateien, Belege, Einstellungen und die Offline-Karten. Danach startet die App wie neu. Willst du etwas behalten, sichere vorher ein Backup.',
      'Everything TravelBuddy has stored on this device is deleted: trips, legs, logbook, photos, bookings, documents with their files, receipts, settings and the offline maps. The app then starts like new. To keep anything, save a backup first.'),
    ja: je('Erst Backup sichern', 'Save a backup first'), nein: je('Ohne Backup weiter', 'Continue without backup'), abbruch: null,
  })
  if (erst === null) return false
  if (erst === true && backup) { try { await backup() } catch {} }
  const ja = await frage({
    titel: je('Wirklich alles löschen?', 'Really delete everything?'),
    text: je('Das lässt sich nicht rückgängig machen.', 'This cannot be undone.'),
    ja: je('Alles löschen', 'Delete everything'), gefahr: true,
  })
  if (!ja) return false
  await allesLoeschen()
  location.replace(location.pathname + '#/heute')
  location.reload()
  return true
}
