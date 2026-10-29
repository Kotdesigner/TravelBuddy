// Reaktiver Online-/Offline-Status. Steuert z. B. die Wetteranzeige.
import { readable } from 'svelte/store'

export const online = readable(navigator.onLine, (set) => {
  const on = () => set(true)
  const off = () => set(false)
  window.addEventListener('online', on)
  window.addEventListener('offline', off)
  return () => {
    window.removeEventListener('online', on)
    window.removeEventListener('offline', off)
  }
})
