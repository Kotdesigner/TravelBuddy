<script>
  // Monats- und Jahresansicht des Kalenders wie am iPhone. Tag antippen zeigt seine Termine.
  import { LOCALE, je } from './i18n.js'
  import { monatWochen, tagKarte, tagText, startMonat } from './kalender-raster.js'

  let { ansicht = 'monat', etappen = [], termine = [], logbuchTage = [], onmonat = () => {} } = $props()

  const jetzt = new Date()
  const heute = tagText(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate())
  const start = startMonat(heute, etappen[0]?.von, etappen.at(-1)?.bis)
  let jahr = $state(start.jahr)
  let monat = $state(start.monat)
  let gewaehlt = $state(null)

  const karte = $derived(tagKarte(etappen, termine, logbuchTage))
  const auswahl = $derived(gewaehlt ? karte.get(gewaehlt) : null)
  const WOCHE = [...Array(7)].map((_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(LOCALE, { weekday: 'short' }))
  const monatName = (m, art = 'long') => new Date(2024, m, 1).toLocaleDateString(LOCALE, { month: art })
  const datumLang = (d) => new Date(d + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' })
  const titel = $derived(ansicht === 'jahr' ? String(jahr) : `${monatName(monat)} ${jahr}`)

  function blaettern(schritt) {
    gewaehlt = null
    if (ansicht === 'jahr') { jahr += schritt; return }
    const d = new Date(jahr, monat + schritt, 1)
    jahr = d.getFullYear()
    monat = d.getMonth()
  }
  function zuHeute() {
    jahr = jetzt.getFullYear()
    monat = jetzt.getMonth()
    gewaehlt = ansicht === 'monat' ? heute : null
  }
  function tagName(d, info) {
    const teile = [datumLang(d), ...(info?.etappen || []).map((e) => e.name)]
    if (info?.termine.length) teile.push(je(`${info.termine.length} Termine`, `${info.termine.length} events`))
    return teile.join(', ')
  }
  const jahresEtappen = $derived(etappen.filter((e) => e.von.slice(0, 4) <= String(jahr) && e.bis.slice(0, 4) >= String(jahr)))
  const hatMonat = (m) => monatWochen(jahr, m).flat().filter((d) => karte.get(d)?.etappen.length).length
</script>

<div class="kr-kopf">
  <button class="kr-pfeil" aria-label={je('Zurück', 'Previous')} onclick={() => blaettern(-1)}>‹</button>
  <h3 aria-live="polite">{titel}</h3>
  <button class="kr-pfeil" aria-label={je('Weiter', 'Next')} onclick={() => blaettern(1)}>›</button>
  <button class="kr-heute" onclick={zuHeute}>{je('Heute', 'Today')}</button>
</div>

{#if ansicht === 'jahr'}
  <div class="kr-jahr">
    {#each Array(12) as _, m}
      {@const tage = hatMonat(m)}
      <button class="kr-mini" class:leer={!tage} aria-label="{monatName(m)} {jahr}{tage ? ', ' + je(`${tage} Reisetage`, `${tage} trip days`) : ''}" onclick={() => onmonat(jahr, (monat = m))}>
        <b>{monatName(m)}</b>
        <span class="kr-mini-tage">
          {#each monatWochen(jahr, m).flat() as d}
            {@const f = d && karte.get(d)?.etappen[0]?.farbe}
            <i class:heute={d === heute} class:frei={!d} style={f ? `background:${f}` : ''}></i>
          {/each}
        </span>
      </button>
    {/each}
  </div>
  {#if jahresEtappen.length}
    <div class="kr-legende">
      {#each jahresEtappen as e (e.id)}<a href="#/plan/etappe/{e.id}"><i style="background:{e.farbe}"></i>{e.name}</a>{/each}
    </div>
  {/if}
{:else}
  <div class="kr-monat">
    {#each WOCHE as w}<span class="kr-wt">{w}</span>{/each}
    {#each monatWochen(jahr, monat).flat() as d}
      {#if d}
        {@const info = karte.get(d)}
        <button class="kr-tag" class:heute={d === heute} class:an={d === gewaehlt} aria-pressed={d === gewaehlt} aria-label={tagName(d, info)} onclick={() => (gewaehlt = d === gewaehlt ? null : d)}>
          <span class="kr-zahl">{Number(d.slice(8))}</span>
          <span class="kr-balken">{#each (info?.etappen || []).slice(0, 2) as e}<i style="background:{e.farbe}"></i>{/each}</span>
          <span class="kr-zeichen">{(info?.termine || []).slice(0, 2).map((x) => x.icon).join('')}{#if info?.termine.length > 2}<small>+{info.termine.length - 2}</small>{/if}</span>
        </button>
      {:else}<span></span>{/if}
    {/each}
  </div>

  {#if gewaehlt}
    <div class="kr-tagblatt">
      <b>{datumLang(gewaehlt)}</b>
      {#each auswahl?.etappen || [] as e (e.id)}
        <a class="kr-etappe" style="border-left-color:{e.farbe}" href="#/plan/etappe/{e.id}">{e.name}</a>
      {/each}
      {#each auswahl?.termine || [] as x (x.id)}
        <p>{x.icon} {x.zeit ? x.zeit + ' · ' : ''}{x.titel}{#if x.rand}<small>{x.rand}</small>{/if}</p>
      {/each}
      {#if auswahl?.logbuch}<p>📖 {je('Im Logbuch eingetragen', 'Written in the logbook')}</p>{/if}
      {#if !auswahl}<p class="kr-frei">{je('Nichts geplant', 'Nothing planned')}</p>{/if}
    </div>
  {/if}
{/if}

<style>
  .kr-kopf { display: flex; align-items: center; gap: 6px; margin: 4px 0 10px; }
  .kr-kopf h3 { flex: 1; margin: 0; font-size: calc(18px * var(--schrift, 1)); text-transform: capitalize; }
  .kr-pfeil, .kr-heute { min-width: 44px; min-height: 44px; border: 1px solid var(--line); border-radius: 12px; background: var(--flaeche-2); color: var(--ink); font-size: calc(18px * var(--schrift, 1)); cursor: pointer; }
  .kr-heute { padding: 0 12px; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; }
  .kr-monat { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
  .kr-wt { padding-bottom: 4px; text-align: center; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); font-weight: 700; }
  .kr-tag { display: flex; flex-direction: column; align-items: stretch; gap: 2px; min-width: 0; min-height: 66px; padding: 4px 2px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--ink); cursor: pointer; overflow: hidden; }
  .kr-tag.heute .kr-zahl { align-self: center; min-width: 22px; border-radius: 11px; background: var(--brand); color: #fff; }
  .kr-tag.an { outline: 2px solid var(--brand-text); outline-offset: -2px; }
  .kr-zahl { text-align: center; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; }
  .kr-balken { display: flex; flex-direction: column; gap: 1px; }
  .kr-balken i { height: 5px; border-radius: 3px; }
  .kr-zeichen { text-align: center; font-size: calc(12px * var(--schrift, 1)); white-space: nowrap; }
  .kr-zeichen small { font-size: calc(10.5px * var(--schrift, 1)); color: var(--muted); }
  .kr-tagblatt { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); }
  .kr-tagblatt p { margin: 0; font-size: calc(14px * var(--schrift, 1)); }
  .kr-tagblatt small { display: block; color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .kr-etappe { padding-left: 8px; border-left: 4px solid; color: var(--ink); font-size: calc(14px * var(--schrift, 1)); font-weight: 700; text-decoration: none; }
  .kr-frei { color: var(--muted); }
  .kr-jahr { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  @media (max-width: 520px) { .kr-jahr { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; } .kr-mini { padding: 5px; } }
  .kr-legende { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 10px; }
  .kr-legende a { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; color: var(--ink); font-size: calc(13px * var(--schrift, 1)); text-decoration: none; }
  .kr-legende i { width: 12px; height: 12px; border-radius: 3px; }
  .kr-mini { display: flex; flex-direction: column; gap: 5px; padding: 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: var(--ink); text-align: left; cursor: pointer; }
  .kr-mini.leer { opacity: .62; }
  .kr-mini b { font-size: calc(13px * var(--schrift, 1)); text-transform: capitalize; }
  .kr-mini-tage { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
  .kr-mini-tage i { aspect-ratio: 1; border-radius: 2px; background: var(--flaeche-2); }
  .kr-mini-tage i.frei { background: none; }
  .kr-mini-tage i.heute { outline: 2px solid var(--brand-text); }
</style>
