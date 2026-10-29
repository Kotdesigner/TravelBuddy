// Skaliert ein Foto beim Upload auf Druck-Auflösung (max. 2000px lange Kante).
// Groß genug für den Fotobuch-Druck, gleichzeitig deutlich kleiner als das Original
// (aus mehreren MB werden ~0,3–0,5 MB). Für die Anzeige wird es per CSS herunterskaliert.
import { t } from './i18n.js'
export function macheThumbnail(file, maxPx = 2000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) return reject(new Error(t('Keine Bilddatei')))
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        let { width, height } = img
        const scale = Math.min(1, maxPx / Math.max(width, height))
        width = Math.round(width * scale)
        height = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) { reject(e) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('Bild konnte nicht gelesen werden'))) }
    img.src = url
  })
}

export function heute() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
