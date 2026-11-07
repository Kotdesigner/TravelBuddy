<script>
  // Routen-Ideen: oben die Karte, darauf alle Ideen nebeneinander versetzt, damit sich gleiche Straßen
  // nicht verdecken. Darunter je Route eine Zeile mit kleiner eigener Karte. Ein Tipp klappt die Route
  // mit allen Infos auf, ein zweiter klappt sie zu. Die offene Route ist auf der großen Karte kräftig.
  import { tick } from 'svelte'
  import { je } from './i18n.js'
  import UebersichtsKarte from './UebersichtsKarte.svelte'
  import Routen from './Routen.svelte'
  import { stoppsAusRoute } from './routen-ideen.js'
  import { dauer, klapp } from './motion.js'

  let { routen = [], gruppe = $bindable('alle') } = $props()

  const GRUPPEN = [['alle', () => je('Alle', 'All')], ['sued', () => je('Süden', 'South')], ['nord', () => je('Norden', 'North')]]
  const anzahl = (g) => (g === 'alle' ? routen.length : routen.filter((r) => r.gruppe === g).length)
  let offen = $state(null)

  const linieVon = $derived(Object.fromEntries(routen.map((r) => [r.id, stoppsAusRoute(r).filter((s) => s.lat != null).map((s) => [s.lon, s.lat])])))
  const sichtbar = $derived(routen.filter((r) => gruppe === 'alle' || r.gruppe === gruppe))
  // Abstand der Linien nebeneinander in Pixeln, je Gruppe gezählt (Süden und Norden liegen getrennt)
  const ABSTAND = 4.2
  // Nur die Linien der gewählten Gegend, damit der Ausschnitt passt und beim Aufklappen stehen bleibt
  const linien = $derived(sichtbar.map((r) => {
    const gleich = routen.filter((x) => x.gruppe === r.gruppe)
    const i = gleich.indexOf(r)
    return {
      id: r.id, farbe: r.farbe, punkte: linieVon[r.id], label: r.titel,
      an: !offen || offen === r.id,
      versatz: (i - (gleich.length - 1) / 2) * ABSTAND,
    }
  }))
  const kurzTitel = (t) => t.replace(/^Route\s+/, '')

  async function umschalten(id, vonKarte = false) {
    const r = routen.find((x) => x.id === id)
    if (r && gruppe !== 'alle' && gruppe !== r.gruppe) gruppe = r.gruppe
    offen = offen === id && !vonKarte ? null : id
    if (vonKarte) { await tick(); document.getElementById('ru-z-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }
  }
</script>

<div class="ru">
  <UebersichtsKarte {linien} gewaehlt={offen} onlinie={(id) => umschalten(id, true)} label={je('Karte mit allen Routen-Ideen', 'Map of all route ideas')} hoehe={300} rahmen="alle" />
  <div class="ru-legende">{offen ? je('Die offene Route ist hervorgehoben, die anderen grau.', 'The open route is highlighted, the others are grey.') : je('Routen auf derselben Straße liegen nebeneinander. Tippe eine Linie oder Zeile an.', 'Routes on the same road run side by side. Tap a line or a row.')}</div>
  <div class="ru-chips" role="group" aria-label={je('Gegend', 'Area')}>
    {#each GRUPPEN as [id, name] (id)}
      <button class="ru-chip" class:an={gruppe === id} aria-pressed={gruppe === id} onclick={() => { gruppe = id; if (offen && !sichtbar.some((r) => r.id === offen)) offen = null }}>{name()} <span>{anzahl(id)}</span></button>
    {/each}
  </div>
  <ul class="ru-liste">
    {#each sichtbar as r (r.id)}
      <li>
        <button class="ru-zeile" id="ru-z-{r.id}" class:aktiv={offen === r.id} aria-expanded={offen === r.id} onclick={() => umschalten(r.id)}>
          <span class="ru-mini" aria-hidden="true"><UebersichtsKarte linien={[{ id: r.id, farbe: r.farbe, punkte: linieVon[r.id] }]} breite={64} hoehe={54} /></span>
          <span class="ru-text"><b>{kurzTitel(r.titel)}</b><small>{(r.meta || []).join(' · ')}</small></span>
          <span class="ru-pfeil" class:auf={offen === r.id} aria-hidden="true">›</span>
        </button>
        {#if offen === r.id}
          <div class="ru-inhalt" transition:klapp={{ duration: dauer(240) }}><Routen routen={[r]} eingebettet /></div>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .ru { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 16px; }
  .ru-legende { text-align: center; font-size: calc(11.5px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .ru-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .ru-chip { min-height: 40px; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); font-weight: 700; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; }
  .ru-chip span { color: var(--muted); font-weight: 600; margin-left: 2px; }
  .ru-chip.an { background: var(--brand); border-color: var(--brand); color: #fff; }
  .ru-chip.an span { color: #fff; opacity: 0.85; }
  .ru-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .ru-zeile { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; background: none; border: none; border-top: 1px solid var(--line); padding: 10px 4px; min-height: 64px; cursor: pointer; color: var(--ink); font: inherit; }
  .ru-zeile.aktiv { background: var(--flaeche); border-radius: 8px; }
  .ru-mini { flex: none; width: 64px; pointer-events: none; }
  .ru-mini :global(.uk) { border-radius: 6px; }
  .ru-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ru-text b { font-size: calc(14.5px * var(--schrift, 1)); }
  .ru-text small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .ru-pfeil { color: var(--muted); font-size: calc(20px * var(--schrift, 1)); transition: transform 0.2s; }
  .ru-pfeil.auf { transform: rotate(90deg); }
</style>
