<script>
  // Das animierte App-Logo in der Seitenleiste. Läuft nur, solange es zu sehen ist (breites Fenster,
  // Tab im Vordergrund), und mit 30 Bildern je Sekunde, das reicht bei 64 px und schont den Akku.
  import { onMount } from 'svelte'
  import { grundgeruest, zeichne, UMLAUF_ALLE, UMLAUF_DAUER } from './logo-animation.js'

  let { groesse = 64 } = $props()
  let svg

  onMount(() => {
    const teile = grundgeruest(svg, 'tbl')
    const ruhig = matchMedia('(prefers-reduced-motion: reduce)')
    const start = performance.now() / 1000
    let umlauf = 8                     // erster Umlauf kurz nach dem Öffnen, danach alle 90 Sekunden
    let sichtbar = false, rahmen = 0, zuletzt = 0

    const bild = (jetzt) => {
      rahmen = 0
      if (!sichtbar || ruhig.matches || document.hidden) return
      rahmen = requestAnimationFrame(bild)
      if (jetzt - zuletzt < 32) return
      zuletzt = jetzt
      const t = jetzt / 1000 - start
      if (t > umlauf + UMLAUF_DAUER) umlauf += UMLAUF_ALLE
      zeichne(teile, t, umlauf)
    }
    const los = () => { if (!rahmen && sichtbar && !ruhig.matches && !document.hidden) rahmen = requestAnimationFrame(bild) }

    zeichne(teile, 0, null)            // ruhiges erstes Bild, auch bei „Bewegung reduzieren“
    const beobachter = new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; los() })
    beobachter.observe(svg)
    document.addEventListener('visibilitychange', los)
    ruhig.addEventListener?.('change', los)
    return () => {
      cancelAnimationFrame(rahmen)
      beobachter.disconnect()
      document.removeEventListener('visibilitychange', los)
      ruhig.removeEventListener?.('change', los)
    }
  })
</script>

<svg bind:this={svg} class="logo" viewBox="0 0 512 512" width={groesse} height={groesse} role="img" aria-label="TravelBuddy"></svg>

<style>
  .logo { display: block; border-radius: 22%; box-shadow: 0 4px 14px rgba(122, 59, 30, 0.28); }
</style>
