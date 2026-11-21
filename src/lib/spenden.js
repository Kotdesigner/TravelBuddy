// Kaffeekasse (V33, in V43 entfernt, auf Steves Wunsch wieder da, inzwischen über Ko-fi).
//
// Wer TravelBuddy mag, kann etwas zurückgeben. Freiwillig, ohne Gegenleistung.
// Die App schickt dabei NICHTS an Ko-fi und bindet kein fremdes Skript ein: Der Knopf ist ein
// gewöhnlicher Link. Erst wer ihn antippt, landet auf der Ko-fi-Seite. Deshalb bleibt die App
// auch offline vollständig und ohne fremde Mitleser.
//
// Warum Ko-fi und nicht PayPal.me: Die PayPal-Seite zeigt jedem, der den Knopf antippt, den
// vollen Kontonamen. Auf Ko-fi steht nur der selbst gewählte Name. Die Zahlung läuft dahinter
// trotzdem über PayPal oder Stripe, dort sieht der Zahlende den Empfänger wieder.
//
// Beim Prüfdurchgang zu V45 ging es einmal hin und her (PayPal, Ko-fi, PayPal), Steves letztes
// Wort ist Ko-fi. Wer es noch einmal umstellt: Hier die Adresse, dazu der Abschnitt in
// Rechtliches.svelte, der Titel am Knopf in App.svelte und die Prüfung in tests/spenden.test.mjs.
//
// Nur hier ändern — Fußzeile und Datenschutz lesen die Adresse von hier.
export const KOFI_NAME = 'TravelBuddy'
export const KOFI = `https://ko-fi.com/${KOFI_NAME}`
