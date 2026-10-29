<script>
  import { t, LOCALE, tn, istEn } from './i18n.js'
  import { ZWEI } from './format.js'
  // Animierte Foto-Kollage über alle Logbuch-Fotos.
  //
  // Bewusst ohne KI und ohne Netz: die Bilder liegen bereits lokal vor, die
  // Animation rechnet der Browser (CSS-Transformationen). Damit läuft die
  // Kollage offline, kostet nichts und braucht keinen Schlüssel.
  //
  // Ablauf: je Runde wird eine Kachelvorlage gewählt, die Fotos gleiten
  // versetzt herein und wandern langsam (Ken-Burns-Effekt), dann folgt die
  // nächste Runde. Bei „prefers-reduced-motion" steht alles still.
  import { haptic } from './haptik.js'
  import { modal } from './modal.js'

  let { fotos = [], titel = t('Kollage'), schliessen = () => {} } = $props()

  const REDUZIERT = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches

  // Kachelvorlagen: [Spalte, Zeile, Breite, Höhe] in einem 6×4-Raster.
  const VORLAGEN = [
    [[1, 1, 3, 2], [4, 1, 3, 2], [1, 3, 2, 2], [3, 3, 2, 2], [5, 3, 2, 2]],
    [[1, 1, 4, 4], [5, 1, 2, 2], [5, 3, 2, 2]],
    [[1, 1, 2, 2], [3, 1, 2, 2], [5, 1, 2, 2], [1, 3, 3, 2], [4, 3, 3, 2]],
    [[1, 1, 6, 2], [1, 3, 2, 2], [3, 3, 2, 2], [5, 3, 2, 2]],
  ]

  let runde = $state(0)
  let laeuft = $state(!REDUZIERT)
  let timer

  const vorlage = $derived(VORLAGEN[runde % VORLAGEN.length])
  // Fotos rundenweise durchreichen, damit auch bei wenigen Bildern etwas passiert.
  const kacheln = $derived(vorlage.map((v, i) => ({
    v, foto: fotos.length ? fotos[(runde * vorlage.length + i) % fotos.length] : null, i,
  })))

  const DAUER = 7000
  $effect(() => {
    runde   // jede neue Runde plant die nächste
    if (!laeuft || fotos.length === 0) return
    timer = setTimeout(() => (runde += 1), DAUER)
    return () => clearTimeout(timer)
  })

  function weiter() { clearTimeout(timer); runde += 1; haptic() }
  function zurueck() { clearTimeout(timer); runde = Math.max(0, runde - 1); haptic() }
  function pause() { laeuft = !laeuft; haptic() }

  // ---------- Druck-/Exportfassung ----------
  // Die Animation lässt sich nicht drucken. Für Fotobuch und PDF wird deshalb
  // dasselbe Kachel-Layout statisch aufgebaut: je Vorlage eine Seite, alle Fotos
  // der Reihe nach, mit Bildunterschrift. Öffnet ein eigenes Druckfenster.
  function esc(t) {
    return String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  }
  function druckKollage() {
    if (!fotos.length) return
    haptic()
    const seiten = []
    let i = 0, runde = 0
    while (i < fotos.length) {
      const v = VORLAGEN[runde % VORLAGEN.length]
      const kacheln = []
      for (const feld of v) {
        if (i >= fotos.length) break
        const f = fotos[i++]
        const bu = [f.ort, f.datum ? kurzDat(f.datum) : ''].filter(Boolean).join(' · ')
        kacheln.push(`<figure class="ka" style="grid-column:${feld[0]}/span ${feld[2]};grid-row:${feld[1]}/span ${feld[3]}">
          <img src="${f.src}">${bu ? `<figcaption>${esc(bu)}</figcaption>` : ''}</figure>`)
      }
      seiten.push(`<section class="seite"><div class="raster">${kacheln.join('')}</div>
        <div class="seitenzahl">${seiten.length + 1}</div></section>`)
      runde++
    }
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!doctype html><html lang="${istEn ? 'en' : 'de'}"><head><meta charset="utf-8">
      <title>${esc(titel)} — ${t('Kollage')}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #fff; color: #2b2621; }
        .deckblatt { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; page-break-after: always; }
        .deckblatt h1 { font-size: calc(42px * var(--schrift, 1)); margin: 0 0 6px; letter-spacing: 0.02em; }
        .deckblatt p { font-size: calc(15px * var(--schrift, 1)); color: #6b6157; margin: 0; }
        .seite { height: 100vh; page-break-after: always; position: relative; padding-bottom: 8mm; }
        .seite:last-of-type { page-break-after: auto; }
        .raster { height: 100%; display: grid; grid-template-columns: repeat(6, 1fr);
          grid-template-rows: repeat(4, 1fr); gap: 4mm; }
        .ka { margin: 0; position: relative; overflow: hidden; border-radius: 3mm; background: #efe6d6;
          break-inside: avoid; page-break-inside: avoid; }
        .ka img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ka figcaption { position: absolute; left: 0; right: 0; bottom: 0; padding: 8mm 3mm 2mm;
          font-size: 9pt; font-weight: 700; color: #fff;
          background: linear-gradient(to top, rgba(0,0,0,.6), transparent);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .seitenzahl { position: absolute; bottom: 0; right: 0; font-size: 8pt; color: #9a9086; }
        @media print { .hinweis { display: none; } }
        .hinweis { padding: 10px; text-align: center; font-size: calc(13px * var(--schrift, 1)); color: #6b6157; }
      </style></head><body>
      <div class="hinweis">Druckdialog öffnet sich. Für ein PDF im Dialog „Als PDF sichern" wählen. Querformat A4.</div>
      <section class="deckblatt"><h1>${esc(titel)}</h1>
        <p>${t('Foto-Kollage')} · ${tn(fotos.length, '{n} Aufnahme', '{n} Aufnahmen')}</p></section>
      ${seiten.join('')}
      </body></html>`)
    w.document.close()
    // Bilder erst laden lassen, sonst druckt der Dialog leere Kacheln.
    const los = () => setTimeout(() => { w.focus(); w.print() }, 400)
    if (w.document.readyState === 'complete') los()
    else w.addEventListener('load', los)
  }

  const kurzDat = (d) => {
    try { return new Date(d + 'T12:00').toLocaleDateString(LOCALE, { day: ZWEI, month: 'short' }) }
    catch { return d || '' }
  }
</script>

<svelte:window onkeydown={(e) => {
  if (e.key === 'Escape') schliessen()
  else if (e.key === 'ArrowRight') weiter()
  else if (e.key === 'ArrowLeft') zurueck()
  else if (e.key === ' ') { e.preventDefault(); pause() }
}} />

<div class="ko" role="dialog" aria-label={t('Foto-Kollage')} use:modal={{ onclose: schliessen }}>
  <div class="ko-kopf">
    <span class="ko-titel">✨ {titel}</span>
    <span class="ko-zahl">{tn(fotos.length, '{n} Foto', '{n} Fotos')}</span>
    <div class="ko-steuer">
      {#if fotos.length}
        <button class="ko-druck" onclick={druckKollage} title={t('Statische Fassung für Fotobuch/PDF')}>{t('🖨️ Drucken / PDF')}</button>
      {/if}
      <button onclick={zurueck} aria-label={t('zurück')} title={t('zurück (←)')}>‹</button>
      <button onclick={pause} aria-label={laeuft ? t('anhalten') : t('abspielen')} title={t('Leertaste')}>{laeuft ? '⏸' : '▶'}</button>
      <button onclick={weiter} aria-label={t('weiter')} title={t('weiter (→)')}>›</button>
      <button class="ko-zu" onclick={schliessen} aria-label={t('schließen')} title={t('schließen (Esc)')}>✕</button>
    </div>
  </div>

  {#if fotos.length === 0}
    <p class="ko-leer">{t('Noch keine Fotos im Logbuch. Sobald du Bilder zu deinen Reisetagen hinzufügst, entsteht hier automatisch eine Kollage.')}</p>
  {:else}
    {#key runde}
      <div class="ko-raster" class:still={REDUZIERT} class:pause={!laeuft}>
        {#each kacheln as k (k.i)}
          <figure class="ka" style="--c:{k.v[0]}; --r:{k.v[1]}; --w:{k.v[2]}; --h:{k.v[3]}; --v:{k.i * 140}ms; --d:{(k.i % 3) * 1.7}s">
            <img src={k.foto.src} alt={t('Reisefoto')} loading="lazy" />
            {#if k.foto.ort || k.foto.datum}
              <figcaption>{k.foto.ort || ''}{#if k.foto.ort && k.foto.datum}&nbsp;· {/if}{#if k.foto.datum}{kurzDat(k.foto.datum)}{/if}</figcaption>
            {/if}
          </figure>
        {/each}
      </div>
    {/key}
  {/if}

  <div class="ko-fuss">
    {#if !REDUZIERT}{t('Wechselt alle {wert} s · ← → blättern · Leertaste anhalten · Esc schließt · „Drucken / PDF" liefert dieselbe Kollage statisch fürs Fotobuch', { wert: DAUER / 1000 })}
    {:else}{t('Bewegung ist in deinen Systemeinstellungen reduziert, deshalb steht die Kollage still. ← → blättern.')}{/if}
  </div>
</div>

<style>
  .ko {
    position: fixed; inset: 0; z-index: var(--z-overlay);
    display: flex; flex-direction: column; gap: 10px;
    background: #14100c; color: #f4ece0;
    padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
  }
  .ko-kopf { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .ko-titel { font-size: calc(15px * var(--schrift, 1)); font-weight: 800; }
  .ko-zahl { font-size: calc(12.5px * var(--schrift, 1)); opacity: 0.65; }
  .ko-steuer { margin-left: auto; display: inline-flex; gap: 6px; }
  .ko-steuer button {
    width: 40px; height: 40px; border-radius: 50%; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.22); background: rgba(255,255,255,0.08);
    color: #f4ece0; font-size: calc(16px * var(--schrift, 1)); font-weight: 700;
  }
  .ko-zu { background: rgba(255,255,255,0.16) !important; }
  .ko-druck { width: auto !important; border-radius: 20px !important; padding: 0 14px; font-size: calc(12.5px * var(--schrift, 1)) !important; white-space: nowrap; }

  .ko-raster {
    flex: 1; min-height: 0;
    display: grid; grid-template-columns: repeat(6, 1fr); grid-template-rows: repeat(4, 1fr); gap: 8px;
  }
  .ka {
    grid-column: var(--c) / span var(--w); grid-row: var(--r) / span var(--h);
    margin: 0; position: relative; overflow: hidden; border-radius: 12px; background: #221a12;
    opacity: 0; animation: rein 900ms var(--ease-out, ease-out) var(--v) forwards;
  }
  .ka img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    /* Ken-Burns: langsames Wandern, hin und zurück — nie ein harter Sprung. */
    animation: wandern 22s ease-in-out var(--d) infinite alternate;
  }
  .ka figcaption {
    position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 10px 7px;
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: #fff;
    background: linear-gradient(to top, rgba(0,0,0,.62), transparent);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  @keyframes rein { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
  @keyframes wandern { from { transform: scale(1.06) translate(0, 0); } to { transform: scale(1.16) translate(-2.2%, -1.8%); } }

  .ko-raster.still .ka { opacity: 1; animation: none; }
  .ko-raster.still .ka img { animation: none; }
  .ko-raster.pause .ka img { animation-play-state: paused; }

  .ko-leer { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center;
    font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.6; opacity: 0.75; padding: 24px; }
  .ko-fuss { font-size: calc(12px * var(--schrift, 1)); opacity: 0.5; text-align: center; }

  @media (max-width: 560px) {
    .ko-raster { grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(5, 1fr); }
    .ka { grid-column: 1 / -1; grid-row: span 1; }
  }
</style>
