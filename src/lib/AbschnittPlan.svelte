<script>
  // V16: Zeitraum, Nächte je Stopp und Machbarkeit eines Abschnitts. Ein Abschnitt ohne Datum ist
  // „noch nicht eingeplant“, eine Idee zählt nicht mit. Gefahren wird am Morgen nach der letzten Nacht.
  import { je } from './i18n.js'
  import { updateReise } from './userdata.js'
  import { bereichVon, artVon } from './abschnitte.js'
  import { machbarkeit, saisonHinweise, GRENZE_MIN } from './machbarkeit.js'
  import { dauerText } from './fahrtag.js'
  import { mitWochentag, zahl, tagMonat } from './format.js'
  import Stepper from './Stepper.svelte'

  let { r, etappe = null, orte = [] } = $props()

  const b = $derived(bereichVon(r))
  const m = $derived(machbarkeit(r))
  const saison = $derived(saisonHinweise(r, orte))
  const fahrt = $derived(!['flug', 'bus', 'bahn', 'boot'].includes(artVon(r)))
  let saisonAuf = $state(false)

  function setzeVon(v) { updateReise(r.id, { von: v || null }) }
  function setzeTage(n) { updateReise(r.id, { tage: n }) }
  function setzeNaechte(i, n) {
    const stops = (r.stops || []).map((s, j) => (j === i ? { ...s, naechte: n } : s))
    updateReise(r.id, { stops })
  }
</script>

<div class="ap">
  <div class="ap-zeit">
    <label class="ap-f">{je('Von', 'From')}
      <input type="date" value={r.von || ''} min={etappe?.von} max={etappe?.bis} onchange={(e) => setzeVon(e.currentTarget.value)} />
    </label>
    <span class="ap-f">{je('Tage', 'Days')}<Stepper value={r.tage ?? 1} min={1} max={120} label={je('Dauer der Route in Tagen', 'Length of the route in days')} onchange={setzeTage} /></span>
    <label class="ap-idee"><input type="checkbox" checked={!!r.idee} onchange={(e) => updateReise(r.id, { idee: e.currentTarget.checked })} /> <span>{je('Nur Idee, zählt nicht mit', 'Just an idea, not counted')}</span></label>
  </div>
  {#if b}
    <p class="ap-k">{mitWochentag(b.von)}{#if b.bis !== b.von}{' '}{je('bis', 'to')}{' '}{mitWochentag(b.bis)}{/if}{#if r.zeit}{' · '}{r.zeit}{/if}{#if etappe && (b.von < etappe.von || b.bis > etappe.bis)}{' · '}<b class="ap-warn">{je('liegt außerhalb der Etappe', 'outside the leg')}</b>{/if}</p>
  {:else}
    <p class="ap-k">{je('Noch nicht eingeplant. Mit einem Datum zählt die Route mit und Heute kennt die Fahrt des Tages.', 'Not scheduled yet. With a date the route counts and Today knows the day’s drive.')}</p>
  {/if}

  {#if fahrt && (r.stops || []).length}
    <h4>{je('Nächte je Stopp', 'Nights per stop')}</h4>
    <ul class="ap-stopps">
      {#each r.stops as s, i (i + s.name)}
        <li><span class="ap-s-name">{i + 1}. {s.name}</span><Stepper value={s.naechte ?? 0} min={0} max={60} label={je(`Nächte in ${s.name}`, `Nights in ${s.name}`)} onchange={(n) => setzeNaechte(i, n)} /></li>
      {/each}
    </ul>
  {/if}

  {#if m && fahrt && (r.stops || []).length >= 2}
    <h4>{je('Machbarkeit', 'Feasibility')}</h4>
    <p class="ap-sum">
      {zahl(m.km)} km · {m.fahrtage === 1 ? je('1 Fahrtag', '1 driving day') : je(`${m.fahrtage} Fahrtage`, `${m.fahrtage} driving days`)} · {m.ruhetage === 1 ? je('1 Ruhetag', '1 rest day') : je(`${m.ruhetage} Ruhetage`, `${m.ruhetage} rest days`)}{#if m.geschaetzt}{' · '}{je('geschätzt', 'estimated')}{/if}
    </p>
    {#if m.zuViel}<p class="ap-warn">{m.zuViel === 1 ? je('1 Nacht mehr, als die Route Tage hat.', '1 more night than the route has days.') : je(`${m.zuViel} Nächte mehr, als die Route Tage hat.`, `${m.zuViel} more nights than the route has days.`)}</p>
    {:else if m.frei}<p class="ap-k">{m.frei === 1 ? je('1 Nacht noch keinem Stopp zugeordnet.', '1 night not yet assigned to a stop.') : je(`${m.frei} Nächte noch keinem Stopp zugeordnet.`, `${m.frei} nights not yet assigned to a stop.`)}</p>{/if}
    {#if m.lange.length === 1}<p class="ap-warn">{je(`1 langer Tag mit mehr als ${GRENZE_MIN / 60} Stunden am Steuer.`, `1 long day with more than ${GRENZE_MIN / 60} hours of driving.`)}</p>{:else if m.lange.length}<p class="ap-warn">{je(`${m.lange.length} lange Tage mit mehr als ${GRENZE_MIN / 60} Stunden am Steuer.`, `${m.lange.length} long days with more than ${GRENZE_MIN / 60} hours of driving.`)}</p>{/if}
    <ol class="ap-tage">
      {#each m.tage as tg (tg.datum)}
        <li class:ruhe={tg.ruhetag} class:lang={tg.lang}>
          <span class="ap-d">{tagMonat(tg.datum)}</span>
          {#if tg.ruhetag}<span class="ap-t">{je('Ruhetag', 'Rest day')}</span>
          {:else}<span class="ap-t">{tg.von} → {tg.nach}<small>{zahl(tg.km)} km · {dauerText(tg.fahrMin)}</small></span>{/if}
          {#if !tg.ruhetag}<span class="ap-balken" aria-hidden="true"><span style="width:{Math.min(100, (tg.fahrMin / (GRENZE_MIN * 1.6)) * 100)}%"></span></span>{/if}
        </li>
      {/each}
    </ol>
  {/if}

  {#if saison.length}
    <button class="ap-saison-k" aria-expanded={saisonAuf} onclick={() => (saisonAuf = !saisonAuf)}>☀️ {je(`Saison an der Strecke: ${saison.length} Hinweise`, `Season along the way: ${saison.length} notes`)}</button>
    {#if saisonAuf}
      <ul class="ap-saison">{#each saison as s (s.id)}<li><b>{s.name}</b> {s.text}</li>{/each}</ul>
    {/if}
  {/if}
</div>

<style>
  .ap { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--flaeche); }
  .ap-zeit { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
  .ap-f { display: flex; flex-direction: column; gap: 4px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .ap-f input { min-height: 44px; font-size: max(16px, calc(15px * var(--schrift, 1))); padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); }
  .ap-idee { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: calc(13.5px * var(--schrift, 1)); cursor: pointer; }
  .ap-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ap-warn { margin: 0; color: var(--danger-text); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; }
  h4 { margin: 4px 0 0; font-size: calc(13.5px * var(--schrift, 1)); }
  .ap-stopps, .ap-tage, .ap-saison { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .ap-stopps li { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: calc(14px * var(--schrift, 1)); }
  .ap-s-name { min-width: 0; overflow-wrap: anywhere; }
  .ap-sum { margin: 0; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; }
  .ap-tage li { display: grid; grid-template-columns: 56px minmax(0, 1fr) 72px; gap: 8px; align-items: center; font-size: calc(13px * var(--schrift, 1)); border-top: 1px solid var(--line); padding-top: 4px; }
  .ap-tage li.ruhe { color: var(--muted); }
  .ap-tage li.lang .ap-t { color: var(--danger-text); font-weight: 700; }
  .ap-d { font-variant-numeric: tabular-nums; color: var(--muted); }
  .ap-t { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
  .ap-t small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .ap-balken { height: 6px; border-radius: 3px; background: var(--flaeche-2); overflow: hidden; }
  .ap-balken span { display: block; height: 100%; background: var(--brand); }
  .ap-tage li.lang .ap-balken span { background: var(--danger); }
  .ap-saison-k { align-self: flex-start; border: none; background: none; color: var(--ink); font-weight: 700; font-size: calc(13.5px * var(--schrift, 1)); min-height: 36px; cursor: pointer; padding: 0; }
  .ap-saison li { font-size: calc(13px * var(--schrift, 1)); line-height: 1.45; border-top: 1px solid var(--line); padding-top: 4px; }
</style>
