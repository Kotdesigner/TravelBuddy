// Testreise laden und wieder beenden. Der eigene Stand kommt vorher komplett zur Seite und beim
// Beenden unverändert zurück; alles aus der Testreise verschwindet dann, auch was man darin geändert hat.
// Eigener Schlüssel im Topf von userdata.js, die Marke liegt in localStorage und gehört zum Gerät.
import { writable, get } from 'svelte/store'
import { t } from './i18n.js'
import { baueBackupPayload, wendeBackupAn, datenStand, buchungen, idbGet, idbSet } from './userdata.js'
import { flugspeicher, tauscheFlugstand } from './flug-dienst.js'
import { testmodus, TEST_AUS } from './warnlage-dienst.js'
import { baueTestreise, flugStaende, TEST_FOTOS, TEST_STANDORT } from './testreise.js'
import { istLeer } from './einfuehrung.js'
import { frage } from './dialog.js'
import { geh } from './navigation.js'
import { zeigeToast } from './toast.js'

const KEY_MARKE = 'tb-testreise'
const KEY_VORHER = 'testreise-vorher-v1'

function marke() { try { return localStorage.getItem(KEY_MARKE) === '1' } catch { return false } }
export const testreiseAn = writable(marke())
function setzeMarke(an) {
  try { if (an) localStorage.setItem(KEY_MARKE, '1'); else localStorage.removeItem(KEY_MARKE) } catch {}
  testreiseAn.set(an)
}

function alsDaten(blob) {
  return new Promise((ok, nein) => {
    const r = new FileReader()
    r.onload = () => ok(r.result)
    r.onerror = () => nein(r.error)
    r.readAsDataURL(blob)
  })
}

// Ohne Netz fehlen manche Bilder, dann bleibt der Eintrag eben ohne Foto
async function holeFotos(journal) {
  await Promise.all(journal.map(async (e) => {
    const bilder = await Promise.all((TEST_FOTOS[e.id] || []).map(async (pfad) => {
      try { const r = await fetch(pfad); return r.ok ? await alsDaten(await r.blob()) : null } catch { return null }
    }))
    e.fotos = bilder.filter(Boolean)
  }))
}

export async function starteTestreise() {
  if (get(testreiseAn)) return false
  try {
    const jetzt = Date.now(), stand = baueTestreise(jetzt)
    await holeFotos(stand.journal)
    const vorher = JSON.parse(JSON.stringify({ stand: baueBackupPayload(), flug: get(flugspeicher), warn: get(testmodus) }))
    await idbSet(KEY_VORHER, vorher)
    // Erst wenn der eigene Stand nachweislich liegt, wird er ersetzt
    if (!(await idbGet(KEY_VORHER))?.stand) throw new Error('nicht gesichert')
    wendeBackupAn(stand)
    tauscheFlugstand({ ...vorher.flug, staende: flugStaende(stand.buchungen.events, jetzt), popup: {} })
    testmodus.set(TEST_STANDORT)
    setzeMarke(true)
    return true
  } catch (e) {
    console.warn('Testreise nicht geladen', e)
    zeigeToast(t('Die Testreise ließ sich nicht laden. Deine Daten sind unverändert.'), 'fehler', 6000)
    return false
  }
}

export async function beendeTestreise() {
  const alt = await idbGet(KEY_VORHER).catch(() => null)
  if (!alt?.stand) {
    zeigeToast(t('Dein eigener Stand wurde nicht gefunden. Die Testreise bleibt, bis du ein Backup importierst.'), 'fehler', 7000)
    return false
  }
  wendeBackupAn(alt.stand)
  // Eine frische App hat noch gar keinen Kalender, den die Übernahme zurückschreiben könnte
  if (!alt.stand.buchungen) buchungen.set(null)
  tauscheFlugstand(alt.flug)
  testmodus.set(alt.warn || TEST_AUS)
  await idbSet(KEY_VORHER, null)
  setzeMarke(false)
  return true
}

/** Der eine Knopf in Menü und Band: läuft keine Testreise, startet er eine, sonst beendet er sie. */
export async function testreiseKnopf() {
  if (get(testreiseAn)) {
    const ja = await frage({
      titel: t('Testreise beenden?'), text: t('Alles aus der Testreise verschwindet, auch was du darin geändert hast. Deine eigenen Daten kommen zurück.'),
      ja: t('Testreise beenden'), gefahr: true,
    })
    if (ja && await beendeTestreise()) { geh('heute'); zeigeToast(t('Testreise beendet'), 'ok') }
    return
  }
  if (!istLeer(datenStand(), (get(buchungen)?.events || []).length)) {
    const ja = await frage({
      titel: t('Testreise starten?'), text: t('Deine Daten kommen sicher zur Seite und sind wieder da, sobald du die Testreise beendest.'),
      ja: t('Testreise starten'),
    })
    if (!ja) return
  }
  if (await starteTestreise()) geh('heute')
}
