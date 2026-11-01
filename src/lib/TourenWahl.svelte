<script>
  // Etappen und Routen ein- und ausblenden. Die Liste wächst über Monate: Aktuelles und Kommendes
  // steht vorn, der Rest klappt zu, ab neun Einträgen gibt es eine Suche.
  import { je } from './i18n.js'
  import { heuteTag } from './heute.js'
  import { reisen as alleReisen, gesamtStart } from './userdata.js'
  import { etappenMitDatum, istRoute, zuerstAktuell } from './plan.js'

  let { touren = [], istAn, offen = () => false, umschalten, antippen = () => {}, alle, keine, alleAn = false, keineAn = false, unten } = $props()

  const GRENZE = 6
  let ganz = $state(false), suche = $state('')
  const geordnet = $derived(zuerstAktuell(touren, etappenMitDatum($alleReisen, $gesamtStart), $heuteTag))
  const treffer = $derived(geordnet.filter((x) => x.name?.toLowerCase().includes(suche.trim().toLowerCase())))
  const voll = $derived(ganz || !!suche.trim())
  const gruppen = $derived([
    { titel: je('Etappen', 'Legs'), liste: treffer.filter((x) => !istRoute(x.reise)) },
    { titel: je('Routen', 'Routes'), liste: treffer.filter((x) => istRoute(x.reise)) },
  ].filter((g) => g.liste.length))
  const verdeckt = $derived(voll ? 0 : gruppen.reduce((n, g) => n + Math.max(0, g.liste.length - GRENZE), 0))
</script>

<div class="bedien tw">
  <div class="bedien-block">
    <span class="bedien-titel">{je('Auf der Karte zeigen', 'Show on the map')}</span>
    <div class="bedien-zwei">
      <button class="bedien-wahl tw-mitte" class:an={alleAn} aria-pressed={alleAn} onclick={alle}>{je('Alle', 'All')}</button>
      <button class="bedien-wahl tw-mitte" class:an={keineAn} aria-pressed={keineAn} onclick={keine}>{je('Keine', 'None')}</button>
    </div>
    {#if touren.length > 8}
      <input class="bedien-feld" type="search" bind:value={suche} placeholder={je(`${touren.length} Einträge durchsuchen`, `Search ${touren.length} entries`)} aria-label={je('Etappen und Routen suchen', 'Search legs and routes')} />
    {/if}
  </div>
  {#each gruppen as g (g.titel)}
    <div class="bedien-block">
      <span class="bedien-titel">{g.titel} <span class="bedien-zahl">{g.liste.length}</span></span>
      <div class="tw-raster">
        {#each voll ? g.liste : g.liste.slice(0, GRENZE) as x (x.id)}
          <button class="tw-knopf" class:an={istAn(x.id)} class:offen={offen(x.id)} aria-pressed={istAn(x.id)} style="--f:{x.farbe}"
            onclick={() => umschalten(x.id)} ondblclick={() => antippen(x.id)}>
            <span class="tw-linie" class:flug={x.flug}></span>
            <span class="tw-text"><span class="tw-name">{x.name}</span>{#if x.zusatz}<small>{x.zusatz}</small>{/if}</span>
          </button>
        {/each}
      </div>
    </div>
  {/each}
  {#if !gruppen.length}<p class="bedien-text">{je('Nichts gefunden.', 'Nothing found.')}</p>{/if}
  {#if verdeckt || (ganz && !suche.trim() && touren.length > GRENZE)}
    <button class="bedien-knopf" aria-expanded={ganz} onclick={() => (ganz = !ganz)}>{ganz ? je('Weniger zeigen', 'Show less') : je(`Alle zeigen, noch ${verdeckt}`, `Show all, ${verdeckt} more`)}</button>
  {/if}
  {#if unten}{@render unten()}{/if}
</div>

<style>
  .tw { margin: 0; }
  .tw-mitte { justify-content: center; }
  .tw-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(145px, 1fr)); gap: 8px; }
  .tw-knopf { position: relative; display: flex; align-items: center; gap: 9px; min-width: 0; min-height: 44px; padding: 4px 12px; border: 1px solid var(--line); border-radius: 10px; background: none; color: var(--muted); font-size: calc(13px * var(--schrift, 1)); font-weight: 600; text-align: left; cursor: pointer; }
  .tw-knopf.an { border-color: var(--f, var(--brand)); color: var(--ink); }
  .tw-knopf.offen { box-shadow: inset 0 0 0 2px var(--brand); }
  .tw-linie { flex: none; width: 18px; height: 3px; border-radius: 2px; background: var(--f); opacity: .4; }
  .tw-knopf.an .tw-linie { opacity: 1; }
  .tw-linie.flug { background: repeating-linear-gradient(90deg, var(--f) 0 5px, transparent 5px 8px); }
  .tw-text { min-width: 0; }
  .tw-name { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.25; }
  .tw-text small { display: block; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); font-weight: 600; }
</style>
