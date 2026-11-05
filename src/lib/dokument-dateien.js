// V18: Dateien von Dokumenten auf einem zweiten Gerät zuordnen. Das Backup trägt zu jedem Dokument
// die Liste seiner Dateien (Pfad, Name, Typ, Größe), die Dateien selbst bleiben auf dem Gerät. Auf dem
// neuen Gerät wählt man sie einmal aus, und jede landet am selben Pfad, an dem das Dokument sie erwartet.
// Reine Rechnung, ohne Speicher: was zugeordnet wird, legt die Oberfläche ab.

const n = (s) => String(s || '').normalize('NFC').trim().toLowerCase()

/** Alle Dateien der Dokumente, die auf diesem Gerät fehlen: [{ dokId, dokTyp, datei, name, groesse }] */
export function fehlendeDateien(dokumente = [], istLokal = () => false) {
  const out = []
  for (const d of dokumente) for (const x of d.dateien || []) if (!istLokal(x.datei)) out.push({ dokId: d.id, dokTyp: d.typ || '', datei: x.datei, name: x.name, groesse: x.groesse ?? null })
  return out
}

/**
 * Ausgewählte Dateien den fehlenden zuordnen: gleicher Name (Groß und klein egal) und, wo bekannt,
 * gleiche Größe. Hängt dieselbe Datei an mehreren Dokumenten, bekommt jedes sie. Ohne bekannte Größe
 * nur, wenn genau ein Dokument die Datei erwartet; sonst lieber nicht raten.
 * @param fehlend  aus fehlendeDateien()
 * @param dateien  [{ name, size }] (File-Objekte gehen)
 * @returns { zugeordnet: [{ ziel, datei }], uebrig: [datei], offen: [ziel] }
 */
export function ordneDokumenteZu(fehlend = [], dateien = []) {
  const frei = [...fehlend]
  const zugeordnet = [], uebrig = []
  for (const f of dateien) {
    const gleich = frei.filter((z) => n(z.name) === n(f.name))
    const mitGroesse = gleich.filter((z) => z.groesse != null && z.groesse === f.size)
    const ohneGroesse = gleich.filter((z) => z.groesse == null)
    // Größe passt: an jedes Dokument, das genau diese Datei erwartet. Sonst nur, wenn es eindeutig ist.
    const ziele = mitGroesse.length ? mitGroesse : ohneGroesse.length === 1 ? ohneGroesse : []
    if (!ziele.length) { uebrig.push(f); continue }
    for (const ziel of ziele) { zugeordnet.push({ ziel, datei: f }); frei.splice(frei.indexOf(ziel), 1) }
  }
  return { zugeordnet, uebrig, offen: frei }
}
