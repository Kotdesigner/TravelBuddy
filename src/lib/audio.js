// Audio-Sprachnotizen aufnehmen (MediaRecorder). Speichert die Aufnahme als data:-URL.
// Für Sprache reichen 32 kbit/s völlig. Der Browser nimmt sonst mit rund 128 kbit/s auf, das
// sind über 1 MB je Minute im Logbuch. Nach spätestens 5 Minuten endet die Aufnahme von selbst,
// damit eine vergessene Aufnahme das Logbuch nicht um Dutzende MB aufbläht.
export const AUDIO_BITRATE = 32000
export const AUDIO_MAX_SEK = 300

export function audioVerfuegbar() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

/** Recorder mit niedriger Bitrate, falls der Browser die Angabe nicht mag ohne. */
export function baueRecorder(stream, Recorder = globalThis.MediaRecorder) {
  try { return new Recorder(stream, { audioBitsPerSecond: AUDIO_BITRATE }) }
  catch { return new Recorder(stream) }
}

/**
 * Startet die Aufnahme. Rückgabe: { stop() -> Promise<dataURL>, start (ms), maxSek }.
 * `onEnde` wird gerufen, wenn die Höchstdauer erreicht ist. Die Aufnahme speichert dann der Aufrufer
 * genauso wie beim Tippen auf Stopp.
 */
export async function starteAufnahme({ maxSek = AUDIO_MAX_SEK, onEnde } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const rec = baueRecorder(stream)
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
  rec.start()
  const uhr = maxSek > 0 && onEnde ? setTimeout(() => { try { onEnde() } catch {} }, maxSek * 1000) : null
  let ergebnis = null
  return {
    start: Date.now(),
    maxSek,
    stop() {
      clearTimeout(uhr)
      // Zweimal stoppen (Höchstdauer und Tippen gleichzeitig) liefert dieselbe Aufnahme
      return (ergebnis ??= new Promise((resolve, reject) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
          const r = new FileReader()
          r.onloadend = () => resolve(r.result)
          r.onerror = () => reject(r.error)
          r.readAsDataURL(blob)
        }
        try { rec.stop() } catch (e) { reject(e) }
      }))
    },
  }
}

/** Restzeit als „4:05“ */
export function restZeit(startMs, maxSek, jetzt = Date.now()) {
  const rest = Math.max(0, Math.ceil(maxSek - (jetzt - startMs) / 1000))
  return Math.floor(rest / 60) + ':' + String(rest % 60).padStart(2, '0')
}
