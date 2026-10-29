// Das heutige Datum als Store. Eine offen gelassene Web-App wird vom iPhone oft erst am
// nächsten Morgen wieder geweckt; ohne diesen Store stünde dann noch „gestern“ im Cockpit.
import { readable } from 'svelte/store'
import { ymd } from './plan.js'

export const heuteTag = readable(ymd(new Date()), (set) => {
  if (typeof window === 'undefined') return
  const pruefe = () => set(ymd(new Date()))
  const uhr = setInterval(pruefe, 60000)
  const sicht = () => { if (document.visibilityState === 'visible') pruefe() }
  document.addEventListener('visibilitychange', sicht)
  window.addEventListener('focus', pruefe)
  return () => { clearInterval(uhr); document.removeEventListener('visibilitychange', sicht); window.removeEventListener('focus', pruefe) }
})
