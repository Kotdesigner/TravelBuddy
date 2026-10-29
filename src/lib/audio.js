// Audio-Sprachnotizen aufnehmen (MediaRecorder). Speichert die Aufnahme als data:-URL.
export function audioVerfuegbar() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

/** Startet die Aufnahme. Rückgabe: { stop() -> Promise<dataURL> }. */
export async function starteAufnahme() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const rec = new MediaRecorder(stream)
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
  rec.start()
  return {
    stop() {
      return new Promise((resolve, reject) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
          const r = new FileReader()
          r.onloadend = () => resolve(r.result)
          r.onerror = () => reject(r.error)
          r.readAsDataURL(blob)
        }
        try { rec.stop() } catch (e) { reject(e) }
      })
    },
  }
}
