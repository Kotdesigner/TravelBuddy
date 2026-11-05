<script>
  import { oeffneNeu } from './neu.js'
  import InfoKnopf from './InfoKnopf.svelte'
  // V16: Plan → Nächte. Für jede Nacht der Reise: gebucht, geplant, im Flug, im Camper ohne Platz
  // oder offen. Feiertage in WA und die Hochsaison stehen dabei, die dringenden Nächte oben.
  import { je } from './i18n.js'
  import { reisen, gesamtStart, buchungen } from './userdata.js'
  import { etappenMitDatum } from './plan.js'
  import { naechteUebersicht, naechteGruppen, dringendeNaechte } from './naechte.js'
  import { mitWochentag, tagMonat } from './format.js'

  let { geh = () => {} } = $props()

  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const u = $derived(naechteUebersicht({ eintraege, reisen: $reisen, events: $buchungen?.events || [] }))
  const gruppen = $derived(naechteGruppen(u.naechte))
  const dringend = $derived(dringendeNaechte(u.naechte))

  const ZUSTAND = {
    gebucht: { zeichen: '✅', de: 'gebucht', en: 'booked' },
    geplant: { zeichen: '📍', de: 'geplant', en: 'planned' },
    flug: { zeichen: '✈️', de: 'im Flug', en: 'on a flight' },
    camper: { zeichen: '🚐', de: 'im Camper, Platz offen', en: 'in the camper, site open' },
    offen: { zeichen: '❔', de: 'offen', en: 'open' },
  }
  const z = (k) => je(ZUSTAND[k].de, ZUSTAND[k].en)
  const zeitraum = (g) => (g.von === g.bis ? mitWochentag(g.von) : `${tagMonat(g.von)} ${je('bis', 'to')} ${tagMonat(g.bis)}`)
</script>

<section class="na" aria-label={je('Nächte', 'Nights')}>
  <p class="na-k">{je('Wo du jede Nacht schläfst. Gebucht kommt aus deinen Buchungen, geplant aus den Stopps einer Route mit ihren Nächten.', 'Where you sleep each night. Booked comes from your bookings, planned from the stops of a route with their nights.')}<InfoKnopf id="naechte" /></p>

  {#if !u.naechte.length}
    <p class="na-k">{je('Noch keine Etappen mit Datum. Leg zuerst eine Etappe an, dann siehst du hier jede Nacht der Reise.', 'No legs with dates yet. Add a leg first, then you see every night of the trip here.')}</p>
    <button class="btn-primary" onclick={() => oeffneNeu('etappe')}>{je('+ Etappe anlegen', '+ Add leg')}</button>
  {:else}
    <div class="na-zahlen">
      {#each Object.keys(ZUSTAND) as k (k)}
        <div class="na-zahl {k}"><b>{u.zahl[k]}</b><span>{ZUSTAND[k].zeichen} {z(k)}</span></div>
      {/each}
    </div>

    {#if dringend.length}
      <div class="na-dringend" role="note">
        <b>{dringend.length === 1 ? je('1 Nacht an einem Feiertag ohne Platz', '1 night on a public holiday without a site') : je(`${dringend.length} Nächte an Feiertagen ohne Platz`, `${dringend.length} nights on public holidays without a site`)}</b>
        <p>{je('Über Weihnachten, Neujahr und Australia Day sind Campingplätze an der Küste und in Nationalparks früh voll. Diese Nächte zuerst buchen:', 'Over Christmas, New Year and Australia Day, coastal and national park campsites fill early. Book these nights first:')}</p>
        <ul>{#each dringend as n (n.datum)}<li>{mitWochentag(n.datum)} · {n.feiertag}</li>{/each}</ul>
      </div>
    {/if}

    <ol class="na-liste">
      {#each gruppen as g (g.von)}
        <li class="na-g {g.zustand}">
          <span class="na-zeichen" aria-hidden="true">{ZUSTAND[g.zustand].zeichen}</span>
          <span class="na-t">
            <b>{g.text || z(g.zustand)}</b>
            <small>{zeitraum(g)} · {g.anzahl === 1 ? je('1 Nacht', '1 night') : je(`${g.anzahl} Nächte`, `${g.anzahl} nights`)}{#if g.text}{' · '}{z(g.zustand)}{/if}{#if g.abschnitt}{' · '}{g.abschnitt}{/if}</small>
            {#if g.feiertage.length}<small class="na-fei">🎉 {g.feiertage.map((n) => `${tagMonat(n.datum)} ${n.feiertag}`).join(', ')}</small>{/if}
          </span>
          {#if g.etappe}<button class="na-etappe" onclick={() => geh('plan/etappe/' + g.etappe.id)}>{g.etappe.name} ›</button>{/if}
        </li>
      {/each}
    </ol>
    <p class="na-k">{je('Hochsaison: australische Sommerferien, etwa Mitte Dezember bis Ende Januar. Feiertage laut wa.gov.au.', 'Peak season: Australian summer holidays, roughly mid December to end of January. Public holidays from wa.gov.au.')}</p>
  {/if}
</section>

<style>
  .na { display: flex; flex-direction: column; gap: 12px; }
  .na-k { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.5; }
  .na-zahlen { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .na-zahl { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--card); }
  .na-zahl b { font-size: calc(24px * var(--schrift, 1)); font-variant-numeric: tabular-nums; }
  .na-zahl span { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .na-zahl.offen b, .na-zahl.camper b { color: var(--warn-text); }
  .na-zahl.gebucht b { color: var(--ok-text); }
  .na-dringend { padding: 12px 14px; border: 1px solid var(--warn-linie); border-radius: var(--radius-m); background: var(--warn-flaeche); color: var(--ink); font-size: calc(14px * var(--schrift, 1)); }
  .na-dringend p { margin: 4px 0; color: var(--ink); font-size: calc(13.5px * var(--schrift, 1)); }
  .na-dringend ul { margin: 0; padding-left: 18px; font-size: calc(13.5px * var(--schrift, 1)); }
  .na-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .na-g { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--line); border-left: 4px solid var(--line-stark); border-radius: var(--radius-m); background: var(--card); }
  .na-g.gebucht { border-left-color: var(--ok); }
  .na-g.geplant { border-left-color: var(--brand); }
  .na-g.offen, .na-g.camper { border-left-color: var(--warn); }
  .na-zeichen { font-size: calc(18px * var(--schrift, 1)); line-height: 1.3; }
  .na-t { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: calc(14.5px * var(--schrift, 1)); overflow-wrap: anywhere; }
  .na-t small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .na-fei { color: var(--warn-text) !important; font-weight: 700; }
  .na-etappe { flex: none; border: none; background: none; color: var(--brand-text); font-weight: 700; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; min-height: 36px; }
</style>
