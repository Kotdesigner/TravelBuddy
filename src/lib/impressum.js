// Anbieter für das Impressum. Bleibt ein Feld leer, nennt die Seite nur den Kontakt über GitHub.
// Wer die App selbst öffentlich anbietet, trägt hier die eigenen Angaben ein.
export const IMPRESSUM = {
  name: 'Steven Brandenburg',
  strasse: 'Hegerade 10a',
  ort: '24248 Mönkeberg',
  land: 'Deutschland',
  email: 'steven.brandenburg@outlook.de',
}

export const impressumFertig = (d = IMPRESSUM) => !!(d.name.trim() && d.strasse.trim() && d.ort.trim() && d.email.trim())
