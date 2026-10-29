<script>
  import { t, LOCALE, tn } from './i18n.js'
  import { reisen, gesamtStart, berechneKalender, userData, journal, wanderungen, zeitstempel, buchungen } from './userdata.js'
  import { schriftAuf } from './kontrast.js'
  import { FELD, QUICKSTATS } from './journal-schema.js'
  import { S_MAP, dauerText } from './wanderungen-daten.js'
  import { katInfo } from './reisekalender.js'

  let { orte = [], eigeneOrte = [] } = $props()

  const nameById = $derived(new Map([...orte, ...eigeneOrte].map((o) => [o.id, o])))

  // Alles Datierte chronologisch: Reise-Etappen + Roadtrip-Tagebuch + per-Ort-Notizen.
  const items = $derived.by(() => {
    const list = []
    const kal = berechneKalender($reisen, $gesamtStart)
    for (const e of kal.eintraege) {
      list.push({ key: 'r-' + e.reise.id, sort: e.von.getTime(), typ: 'reise', reise: e.reise, von: e.von, bis: e.bis, tage: e.tage })
    }
    for (const e of $journal) {
      const d = new Date((e.datum || '2000-01-01') + 'T12:00')
      const stats = QUICKSTATS.map((fid) => ({ f: FELD[fid], w: e.felder?.[fid] })).filter((x) => x.w != null && x.w !== '')
      list.push({ key: 'j-' + e.id, sort: d.getTime(), typ: 'journal', datum: d, ort: e.ort, text: e.text, fotos: e.fotos || [], stats, felder: e.felder || {} })
    }
    for (const [ortId, ud] of Object.entries($userData)) {
      for (const t of ud.tagebuch || []) {
        const d = new Date(t.datum + 'T12:00')
        list.push({ key: 't-' + t.id, sort: d.getTime(), typ: 'tagebuch', datum: d, ortName: nameById.get(ortId)?.name || ortId, text: t.text, fotos: t.fotos || [] })
      }
    }
    // Wanderungen erscheinen nur MIT Datum — ohne Datum haben sie hier keinen Platz,
    // sie bleiben dann allein in der Wanderungsliste.
    for (const w of $wanderungen) {
      const ts = zeitstempel(w.datum, w.zeit)
      if (isNaN(ts)) continue
      list.push({
        key: 'w-' + w.id, sort: ts, typ: 'wanderung', datum: new Date(ts), zeit: w.zeit || '',
        name: w.name, gebiet: w.gebiet || '', km: w.km, dauerMin: w.dauerMin, hoehenmeter: w.hoehenmeter,
        schwierigkeit: S_MAP[w.schwierigkeit], status: w.status, fotos: w.fotos || [], text: w.beschreibung || '',
      })
    }
    // Gebuchtes aus dem Reisekalender — TAGEWEISE gebündelt. Am 8. Dezember stehen
    // Flug, Shuttle, Boot und Check-in; als vier Einzelkarten wäre die Zeitleiste
    // unlesbar, als ein Tag mit vier Zeilen ist sie genau richtig.
    if ($buchungen?.events?.length) {
      const proTag = new Map()
      for (const e of $buchungen.events) {
        if (e.platzhalter) continue
        if (!proTag.has(e.datum)) proTag.set(e.datum, [])
        proTag.get(e.datum).push(e)
      }
      for (const [datum, posten] of proTag) {
        const d = new Date(datum + 'T09:00')   // vor Tagebuch (12:00): Gebuchtes rahmt den Tag
        list.push({ key: 'b-' + datum, sort: d.getTime(), typ: 'buchung', datum: d, posten,
          special: posten.find((x) => x.special)?.special || '', emoji: posten.find((x) => x.emoji)?.emoji || '' })
      }
    }
    // NaN sortiert nirgendwohin und würde die ganze Liste durcheinanderbringen —
    // datenlose Einträge deshalb sicherheitshalber ans Ende.
    return list.sort((a, b) => (isNaN(a.sort) ? 1 : isNaN(b.sort) ? -1 : a.sort - b.sort))
  })

  const fmt = (d) => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
  const fmtLang = (d) => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })

  let scroller
  // Time-Machine-Stapel (seitlich): die zentrierte Karte steht flach & lesbar vorne,
  // alle anderen staffeln sich gekippt in die Tiefe und ziehen zur Mitte (Fluchtpunkt).
  function transformCards() {
    if (!scroller) return
    const rect = scroller.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    const UNIT = 250 // px pro „Kartenschritt" → Effekt bleibt auf Handy & Desktop gleich
    for (const card of scroller.querySelectorAll('.tm-card')) {
      const cr = card.getBoundingClientRect()
      const cc = cr.left + cr.width / 2
      const a = Math.max(-3.4, Math.min(3.4, (cc - center) / UNIT))
      const abs = Math.abs(a)
      // Einen Hauch dezenter (flachere Winkel, weniger Tiefe) —
      // besser lesbar & flüssiger auf älteren Geräten.
      const ry = Math.max(-48, Math.min(48, -a * 26)) // zur Mitte fächern
      const tz = -abs * 150 // in die Tiefe staffeln
      const tx = -a * 58 // zur Mitte ziehen → Karten stapeln sich hintereinander
      const sc = Math.max(0.5, 1 - abs * 0.15)
      card.style.transform = `translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${sc})`
      card.style.opacity = String(Math.max(0.18, 1 - abs * 0.36))
      card.style.filter = abs > 0.06 ? `brightness(${Math.max(0.55, 1 - abs * 0.14)})` : 'none'
      card.style.zIndex = String(300 - Math.round(abs * 80))
    }
  }

  // Mausrad/Trackpad senkrecht → stufenlos horizontal scrollen (sonst am Desktop nur mit Pfeilen erreichbar).
  function onWheel(e) {
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX
    if (!d) return
    scroller.scrollLeft += d
    e.preventDefault()
  }

  $effect(() => {
    items.length // neu berechnen, wenn sich Items ändern
    if (!scroller) return
    requestAnimationFrame(transformCards)
    scroller.addEventListener('scroll', transformCards, { passive: true })
    scroller.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', transformCards)
    return () => {
      scroller.removeEventListener('scroll', transformCards)
      scroller.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', transformCards)
    }
  })

  function scrollBy(dir) {
    const step = Math.max(276, (scroller?.clientWidth || 400) * 0.6)
    scroller?.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  // Karte anklicken: erst zentrieren; ist sie schon mittig, zur Sektion springen.
  const zielSektion = { reise: 'eigene-route', journal: 'tagebuch', tagebuch: 'tagebuch', wanderung: 'wanderungen', buchung: 'vorbereitung' }
  function oeffne(it, el) {
    const rect = scroller.getBoundingClientRect()
    const cr = el.getBoundingClientRect()
    const mittig = Math.abs((cr.left + cr.width / 2) - (rect.left + rect.width / 2)) < cr.width / 2
    if (!mittig) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    } else {
      const ziel = document.getElementById(zielSektion[it.typ])
      ziel?.scrollIntoView({ behavior: 'smooth' })
    }
  }
</script>

<div class="tm-wrap">
  {#if items.length === 0}
    <p class="leer">{t('Noch nichts auf der Zeitleiste. Sobald du Reisen in den Gesamtplan nimmst, Logbuch-Einträge schreibst, einer Wanderung ein Datum gibst oder deinen Reisekalender importierst, erscheinen sie hier — chronologisch zum Durchscrollen.')}</p>
  {:else}
    <button class="pfeil links" onclick={() => scrollBy(-1)} aria-label={t('zurück')}>‹</button>
    <button class="pfeil rechts" onclick={() => scrollBy(1)} aria-label={t('vor')}>›</button>
    <div class="tm" bind:this={scroller}>
      {#each items as it (it.key)}
        <div class="tm-card {it.typ}" role="button" tabindex="0" onclick={(e) => oeffne(it, e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && oeffne(it, e.currentTarget)}>
          {#if it.typ === 'reise'}
            <div class="card reise" style="--f:{it.reise.farbe}">
              <div class="datum">{fmt(it.von)}{#if it.tage > 1}&nbsp;– {fmt(it.bis)}{/if}</div>
              <div class="badge" style="background:{it.reise.farbe};color:{schriftAuf(it.reise.farbe)}">{tn(it.tage, '🧭 Reise · {n} Tag', '🧭 Reise · {n} Tage')}</div>
              <div class="titel">{it.reise.name}</div>
              {#if it.reise.stops?.length}
                <div class="stops">{it.reise.stops.map((s) => s.name).join(' → ')}</div>
              {/if}
            </div>
          {:else if it.typ === 'journal'}
            <div class="card journal">
              <div class="datum">{fmtLang(it.datum)}</div>
              <div class="badge tb">{t('📖 Tagebuch')}</div>
              {#if it.ort}<div class="ort">{it.ort}</div>{/if}
              {#if it.stats.length}
                <div class="micro">
                  {#each it.stats as s}
                    <span class="ms" title={s.f.label}>{s.f.icon} {#if s.f.typ === 'rating'}{s.w}/{s.f.max}{:else}{s.w}{/if}</span>
                  {/each}
                </div>
              {/if}
              {#if it.fotos?.length}<div class="fotos">{#each it.fotos.slice(0, 4) as f}<img src={f} alt={t('Foto')} />{/each}</div>{/if}
              {#if it.text}<div class="text">{it.text}</div>{/if}
              {#if it.felder.thought_of_the_day}<div class="zitat">„{it.felder.thought_of_the_day}"</div>{/if}
            </div>
          {:else if it.typ === 'buchung'}
            <div class="card buchung">
              <div class="datum">{fmtLang(it.datum)}</div>
              <div class="badge bu">{t('🎟️ Gebucht')}{#if it.emoji} {it.emoji}{/if}</div>
              {#each it.posten as b (b.id)}
                {@const ki = katInfo(b.kat)}
                <div class="b-zeile">
                  <span class="b-titel">{ki.icon} {b.titel}</span>
                  {#if b.sub}<span class="b-sub">{b.sub}</span>{/if}
                  <span class="b-fuss">
                    {#if b.ref}<span class="b-ref">{b.ref}</span>{/if}
                    {#if b.docs.length}<span class="b-doc">📎 {b.docs.length}</span>{/if}
                  </span>
                </div>
              {/each}
            </div>
          {:else if it.typ === 'wanderung'}
            <div class="card wanderung">
              <div class="datum">{fmtLang(it.datum)}{#if it.zeit}&nbsp;· {it.zeit}{/if}</div>
              <div class="badge wa">{t('🥾 Wanderung')}{#if it.status === 'gemacht'}&nbsp;· ✅{/if}</div>
              <div class="ort">{it.name}</div>
              {#if it.gebiet}<div class="stops">{it.gebiet}</div>{/if}
              <div class="micro">
                {#if it.km}<span class="ms">📏 {it.km} km</span>{/if}
                {#if dauerText(it.dauerMin)}<span class="ms">⏱️ {dauerText(it.dauerMin)}</span>{/if}
                {#if it.hoehenmeter}<span class="ms">⛰️ {it.hoehenmeter} hm</span>{/if}
                {#if it.schwierigkeit}<span class="ms">{it.schwierigkeit.emoji} {it.schwierigkeit.label}</span>{/if}
              </div>
              {#if it.fotos?.length}<div class="fotos">{#each it.fotos.slice(0, 4) as f}<img src={f} alt={t('Foto')} />{/each}</div>{/if}
              {#if it.text}<div class="text">{it.text}</div>{/if}
            </div>
          {:else}
            <div class="card tagebuch">
              <div class="datum">{fmtLang(it.datum)}</div>
              <div class="badge tb">{t('📝 Notiz')}</div>
              <div class="ort">{it.ortName}</div>
              {#if it.fotos?.length}
                <div class="fotos">
                  {#each it.fotos.slice(0, 4) as f}<img src={f} alt={t('Foto')} />{/each}
                </div>
              {/if}
              <div class="text">{it.text}</div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <div class="hinweis">{t('← nach links/rechts scrollen · {length} Einträge', { length: items.length })}</div>
  {/if}
</div>

<style>
  .tm-wrap { position: relative; }
  .leer { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); background: var(--flaeche); padding: 16px; border-radius: 10px; }

  .tm {
    display: flex; gap: 12px; overflow-x: auto; overflow-y: hidden; padding: 52px 45% 40px;
    perspective: 900px; perspective-origin: 50% 42%;
    -webkit-overflow-scrolling: touch; /* frei/stufenlos scrollen – kein Snap */
    border-radius: 14px; scrollbar-width: thin;
    /* Warme Outback-Dämmerung: dezenter Glow am Fluchtpunkt, tiefes Rotbraun außen */
    background:
      radial-gradient(56% 42% at 50% 33%, rgba(226,168,88,0.20), rgba(150,80,40,0.10) 52%, transparent 72%),
      radial-gradient(140% 108% at 50% 30%, #5c3018 0%, #3a2312 48%, #1e120a 100%);
  }
  .tm-card {
    flex: 0 0 250px; transform-style: preserve-3d; cursor: pointer;
    transition: transform 0.06s linear, opacity 0.06s linear, filter 0.06s linear; will-change: transform;
  }
  /* Größe je Typ → auf einen Blick erkennbar */
  .tm-card.reise { flex-basis: 310px; }
  .tm-card.journal { flex-basis: 250px; }
  .tm-card.tagebuch { flex-basis: 200px; }
  .tm-card.wanderung { flex-basis: 235px; }
  .tm-card.buchung { flex-basis: 268px; }
  .card {
    background: var(--eingabe); border-radius: 12px; padding: 14px 16px; box-shadow: 0 18px 50px rgba(0,0,0,0.55);
    display: flex; flex-direction: column; gap: 6px; border-top: 5px solid var(--f, #7a5c8e);
  }
  .tm-card.reise .card { min-height: 190px; border-top-width: 7px; }
  .tm-card.journal .card { min-height: 150px; }
  .tm-card.tagebuch .card { min-height: 120px; background: var(--eingabe); }
  .tm-card.wanderung .card { min-height: 140px; }
  .card.tagebuch, .card.journal { border-top-color: #e07b28; }
  .card.wanderung { border-top-color: #2f7a63; }
  .badge.wa { background: #2f7a63; }
  .tm-card.buchung .card { min-height: 150px; }
  .card.buchung { border-top-color: #1a5276; }
  .badge.bu { background: #1a5276; }
  .b-zeile { display: flex; flex-direction: column; gap: 1px; padding: 4px 0; border-top: 1px solid rgba(0,0,0,0.07); }
  .b-zeile:first-of-type { border-top: none; }
  .b-titel { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .b-sub { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); line-height: 1.35; }
  .b-fuss { display: flex; gap: 6px; flex-wrap: wrap; }
  .b-ref { font-size: calc(12px * var(--schrift, 1)); font-family: ui-monospace, monospace; color: var(--muted); }
  .b-doc { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--info-text); }
  .micro { display: flex; flex-wrap: wrap; gap: 4px 8px; }
  .ms { font-size: calc(12px * var(--schrift, 1)); color: var(--btn-ink); background: var(--btn-flaeche); padding: 2px 7px; border-radius: 8px; }
  .zitat { font-size: calc(12px * var(--schrift, 1)); font-style: italic; color: var(--warn-text); background: var(--warn-flaeche); border-left: 3px solid #d98a3d; padding: 6px 9px; border-radius: 0 6px 6px 0; }
  .datum { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--muted); letter-spacing: 0.4px; }
  .badge { align-self: flex-start; color: #fff; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; padding: 2px 9px; border-radius: 10px; }
  .badge.tb { background: #b35a13; }   /* #e07b28: Weiß nur 3,0 : 1 */
  .titel { font-size: calc(16px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .ort { font-size: calc(15px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .stops { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .text { font-size: calc(12.5px * var(--schrift, 1)); color: var(--ink); line-height: 1.5; }
  .fotos { display: flex; gap: 4px; flex-wrap: wrap; }
  .fotos img { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; }

  .pfeil {
    /* nur über den Karten der Zeitleiste — nicht über App-Overlays (siehe --z-* in app.css) */
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 3; width: 38px; height: 38px;
    border-radius: 50%; border: none; background: rgba(255,255,255,0.9); color: #2b2621; font-size: calc(22px * var(--schrift, 1));
    cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.3); line-height: 1;
  }
  .pfeil.links { left: 8px; }
  .pfeil.rechts { right: 8px; }
  .hinweis { text-align: center; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 8px; }
  @media (max-width: 520px) { .tm { padding: 30px 35% 24px; } .tm-card { flex-basis: 220px; } }
</style>
