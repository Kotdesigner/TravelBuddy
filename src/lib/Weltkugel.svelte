<script>
  import { t } from './i18n.js'
  // Kleine gemalte Weltkugel (Tagebuch). Zeichnet erst, wenn sie ins Bild kommt, und
  // dreht sich dabei einmal sanft in Position. Bei „Bewegung reduzieren“ steht sie gleich.
  import { zeichneGlobus, blick } from './globus.js'

  let { linien = [], punkte = [], namen = [], groesse = 200, titel = t('Weltkugel'), mitte = null, minP = 1.2, fuellen = 0.62 } = $props()

  let cv = $state()
  let gezeigt = false
  let lauf = 0
  const reduziert = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const sicht = $derived.by(() => {
    const pk = [...linien.flatMap((l) => l.coords || []), ...punkte.map((p) => [p.lon, p.lat])]
    return blick(pk, { mitte, minP, fuellen })
  })

  function male(drehung = 0, dpr = Math.min(2, window.devicePixelRatio || 1)) {
    if (!cv) return
    try { zeichneGlobus(cv, { breite: groesse, hoehe: groesse, dpr, mitte: sicht.mitte, P: sicht.P, linien, punkte, namen, drehung }) } catch {}
  }

  function einblenden() {
    if (reduziert()) { male(); return }
    const nr = ++lauf, start = performance.now(), dauer = 1300, von = 70
    const schritt = (t) => {
      if (nr !== lauf) return
      const p = Math.min(1, (t - start) / dauer)
      const e = 1 - Math.pow(1 - p, 3)
      if (p < 1) { male(von * (1 - e), groesse > 240 ? 1 : undefined); requestAnimationFrame(schritt) }
      else male()
    }
    requestAnimationFrame(schritt)
  }

  $effect(() => {
    // neu malen, wenn sich Inhalt oder Größe ändern
    void sicht; void groesse; void JSON.stringify([linien.length, punkte.length, namen.length])
    if (!cv) return
    if (gezeigt) { male(); return }
    const io = new IntersectionObserver((es) => {
      if (es.some((x) => x.isIntersecting)) { io.disconnect(); gezeigt = true; einblenden() }
    }, { rootMargin: '80px' })
    io.observe(cv)
    return () => io.disconnect()
  })
</script>

<canvas bind:this={cv} class="wk" role="img" aria-label={titel} style="width:{groesse}px;height:{groesse}px"></canvas>

<style>
  .wk { display: block; flex: none; }
</style>
