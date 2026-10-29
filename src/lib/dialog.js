// Eigene Rückfragen statt confirm()/alert().
//
// Die Systemdialoge sehen auf dem iPhone aus wie eine Fehlermeldung von Safari, zeigen
// die Webadresse als Titel, und „Abbrechen“ steht an einer anderen Stelle als in der
// App. Außerdem sperren sie die Seite hart. Hier: eine Frage im Stil der App,
// Löschen in Rot, Escape und Tippen daneben heißt „nein“.
import { writable } from 'svelte/store'
import { t } from './i18n.js'

export const dialogAnfrage = writable(null)

/** @returns Promise<boolean> */
export function frage({ titel = '', text = '', ja = 'OK', nein = t('Abbrechen'), gefahr = false } = {}) {
  return new Promise((resolve) => {
    dialogAnfrage.set({ titel, text, ja, nein, gefahr, antwort: (wert) => { dialogAnfrage.set(null); resolve(wert) } })
  })
}

/** Nur eine Mitteilung mit einem Knopf. */
export function hinweis(text, { titel = '', ok = 'OK' } = {}) {
  return frage({ titel, text, ja: ok, nein: null })
}

/** Löschen bestätigen: „„Nord 3“ löschen?" mit rotem Knopf. */
export const loeschFrage = (was, zusatz = '') =>
  frage({ titel: t('{was} löschen?', { was }), text: zusatz || t('Das lässt sich nicht rückgängig machen.'), ja: t('Löschen'), gefahr: true })
