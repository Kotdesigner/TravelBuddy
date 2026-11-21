// Kaffeekasse (V33, in V43 entfernt, auf Steves Wunsch wieder da).
//
// Wer TravelBuddy mag, kann etwas zurückgeben. Freiwillig, ohne Gegenleistung.
// Die App schickt dabei NICHTS an PayPal und bindet kein fremdes Skript ein: Der Knopf ist ein
// gewöhnlicher Link. Erst wer ihn antippt, landet bei PayPal, und zwar im Browser oder in der
// PayPal-App. Deshalb bleibt die App auch offline vollständig und ohne fremde Mitleser.
//
// Die Kasse war kurz bei Ko-fi, auf Steves Wunsch geht sie wieder direkt zu
// PayPal.me. Wer es noch einmal umstellt: Hier die Adresse, dazu der Abschnitt in
// Rechtliches.svelte und die Prüfung in tests/spenden.test.mjs.
//
// Nur hier ändern — Fußzeile und Datenschutz lesen die Adresse von hier.
export const PAYPAL_NAME = 'Kohlesonstbeule'
export const PAYPAL = `https://www.paypal.me/${PAYPAL_NAME}`
