// Standort — beim Start holen, nach einer Ablehnung nicht mehr fragen.
//
// Was die App NICHT kann: eine Freigabe „dauerhaft" setzen. Das entscheidet der Browser,
// und der merkt sich die Antwort selbst — in iOS Safari je Website, in der
// Home-Bildschirm-App je App. Die App kann nur zweierlei richtig machen:
//   1. Wer ablehnt, wird nicht bei jedem Start neu belästigt.
//   2. Wenn die Freigabe schon da ist, gar nicht erst fragen, sondern still holen.
//
// Und: Geolocation braucht einen sicheren Kontext. Über `http://192.168.x.x` blockiert
// Safari die Abfrage vollständig — nur `https://` und `localhost` funktionieren. Deshalb
// gibt es den Zustand `unsicher`, damit die Oberfläche den Grund nennen kann statt
// wortlos nichts zu tun.
import { writable, get } from 'svelte/store'
import { t } from './i18n.js'

const GEFRAGT = 'standort-schon-gefragt'
const ABGELEHNT = 'standort-abgelehnt'

/** { lat, lon, genauigkeit, zeit } oder null */
export const standort = writable(null)

/**
 * 'aus'        – Gerät/Browser kann kein GPS
 * 'unsicher'   – kein HTTPS: Abfrage vom Browser blockiert
 * 'bereit'     – noch nicht gefragt
 * 'laeuft'     – Abfrage unterwegs
 * 'erlaubt'    – Position vorhanden
 * 'verweigert' – Nutzer hat abgelehnt
 * 'fehler'     – technisch fehlgeschlagen (kein Empfang o. ä.)
 */
export const standortStatus = writable('bereit')
export const standortFehler = writable('')

function lageBestimmen() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'aus'
  if (typeof window !== 'undefined' && !window.isSecureContext) return 'unsicher'
  return 'bereit'
}

function hole({ hoheGenauigkeit = false, alterMs = 300000 } = {}) {
  return new Promise((fertig) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        standort.set({
          lat: p.coords.latitude, lon: p.coords.longitude,
          genauigkeit: Math.round(p.coords.accuracy || 0), zeit: Date.now(),
        })
        standortStatus.set('erlaubt')
        standortFehler.set('')
        try { localStorage.removeItem(ABGELEHNT) } catch {}
        fertig(true)
      },
      (e) => {
        if (e.code === 1) { standortStatus.set('verweigert'); standortFehler.set('Zugriff abgelehnt'); try { localStorage.setItem(ABGELEHNT, '1') } catch {} }
        else if (e.code === 3) { standortStatus.set('fehler'); standortFehler.set('Zeitüberschreitung — kein GPS-Empfang?') }
        else { standortStatus.set('fehler'); standortFehler.set(e.message || t('Standort nicht ermittelbar')) }
        fertig(false)
      },
      { enableHighAccuracy: hoheGenauigkeit, timeout: 12000, maximumAge: alterMs }
    )
  })
}

/** Position laufend mitführen, solange die Karte offen ist. Gibt die Funktion zum Beenden zurück. */
export function folgeStandort() {
  if (lageBestimmen() !== 'bereit') return () => {}
  const id = navigator.geolocation.watchPosition((p) => {
    standort.set({ lat: p.coords.latitude, lon: p.coords.longitude, genauigkeit: Math.round(p.coords.accuracy || 0), zeit: Date.now() })
    standortStatus.set('erlaubt')
  }, () => {}, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 })
  return () => navigator.geolocation.clearWatch(id)
}

/** Ausdrückliche Abfrage (Knopf). Fragt auch dann, wenn schon einmal abgelehnt wurde. */
export async function frageStandortAn(opt) {
  const lage = lageBestimmen()
  if (lage !== 'bereit') { standortStatus.set(lage); return false }
  standortStatus.set('laeuft')
  try { localStorage.setItem(GEFRAGT, '1') } catch {}
  return await hole(opt)
}

/**
 * Beim App-Start: bereits erteilte Freigabe still nutzen, sonst fragen, außer es wurde abgelehnt.
 * `verzoegerungMs` gibt der App Zeit, sichtbar zu werden — ein Berechtigungsdialog
 * vor dem ersten gezeichneten Bild wirkt wie ein Übergriff.
 */
export async function starteStandort({ verzoegerungMs = 1500 } = {}) {
  const lage = lageBestimmen()
  if (lage !== 'bereit') { standortStatus.set(lage); return false }

  let erlaubnis = null
  try { erlaubnis = await navigator.permissions?.query({ name: 'geolocation' }) } catch {}

  // Schon erlaubt → ohne Dialog holen, und bei Änderungen mitziehen.
  if (erlaubnis?.state === 'granted') {
    erlaubnis.onchange = () => { if (erlaubnis.state === 'denied') { standortStatus.set('verweigert'); standort.set(null) } }
    return await hole()
  }
  if (erlaubnis?.state === 'denied') { standortStatus.set('verweigert'); return false }

  // Safari meldet oft „prompt“, auch wenn der Standort längst erlaubt wurde. Nur eine echte
  // Ablehnung bleibt still, sonst fehlte die Position nach jedem Start am iPhone.
  let nein = false
  try { nein = localStorage.getItem(ABGELEHNT) === '1' } catch {}
  if (nein) return false

  await new Promise((r) => setTimeout(r, verzoegerungMs))
  return await frageStandortAn()
}

/** Menschenlesbarer Hinweis zum aktuellen Zustand. */
export function standortHinweis(status, fehler) {
  switch (status) {
    case 'aus': return t('Dieses Gerät kann keinen Standort ermitteln.')
    case 'unsicher': return t('Standort geht nur über HTTPS. Über eine http-Adresse im WLAN blockiert der Browser die Abfrage — nach dem Hosting funktioniert es.')
    case 'verweigert': return t('Zugriff abgelehnt. Wieder erlauben: iOS → Einstellungen → Apps → Safari → Ort · macOS → Safari → Einstellungen → Websites → Ort.')
    case 'fehler': return fehler || t('Standort nicht ermittelbar.')
    case 'laeuft': return t('Standort wird ermittelt …')
    default: return ''
  }
}

export const standortFrisch = (s) => !!s && Date.now() - s.zeit < 15 * 60 * 1000
export const standortJetzt = () => get(standort)
