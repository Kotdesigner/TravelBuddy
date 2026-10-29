// Währungsumrechnung AUD ↔ EUR zum Tageskurs der Ausgabe.
// Online: Kurs pro Datum von frankfurter.app holen und cachen. Offline: gecachter
// Kurs oder grobe Näherung. Gespeichert wird EUR pro 1 AUD je Datum.
import { writable, get } from 'svelte/store'

const KEY = 'wa-fx-v1'
const _init = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} } })()

/** { 'YYYY-MM-DD': eurProAud } */
export const fxKurse = writable(_init)
fxKurse.subscribe((v) => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch {} })

// Grobe Näherung (Stand ~2026), falls kein Tageskurs verfügbar ist.
export const FX_DEFAULT = 0.605 // EUR pro 1 AUD

const laufend = new Set()

/** Tageskurs für ein Datum sicherstellen (nur online, einmalig, gecacht). */
export async function stelleKursBereit(datum, online) {
  if (!datum || !online) return
  if (get(fxKurse)[datum] != null || laufend.has(datum)) return
  laufend.add(datum)
  try {
    const res = await fetch(`https://api.frankfurter.app/${datum}?from=AUD&to=EUR`)
    if (res.ok) {
      const d = await res.json()
      const k = d?.rates?.EUR
      if (k) fxKurse.update((m) => ({ ...m, [datum]: k }))
    }
  } catch {}
  finally { laufend.delete(datum) }
}

/** EUR pro 1 AUD für ein Datum (gecacht, sonst Näherung). */
export function kursFuer(kurse, datum) {
  return (kurse && kurse[datum]) || FX_DEFAULT
}

/** Betrag von seiner Währung in beide Währungen. kurs = EUR pro 1 AUD. */
export function inBeide(betrag, waehrung, kurs) {
  const b = Number(betrag) || 0
  if (waehrung === 'EUR') return { eur: b, aud: b / kurs }
  return { eur: b * kurs, aud: b } // Standard AUD
}
