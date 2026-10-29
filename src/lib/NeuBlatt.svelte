<script>
  import { t } from './i18n.js'
  import { blattRaus, ausblenden } from './motion.js'
  import { heuteTag } from './heute.js'
  // Schnell anlegen: Etappe, Route, Wanderung oder Logbuch-Tag mit den wenigen
  // Angaben, die man wirklich sofort braucht. Alles Weitere steht danach in der Detailansicht.
  import { reisen, gesamtStart, journal, neueEtappe, neueRoute, neueWanderung, neuerJournalEintrag } from './userdata.js'
  import { etappenMitDatum, planUeberblick, etappeAm, plusTage, ymd, gueltigesDatum } from './plan.js'
  import { bereich, mitWochentag } from './format.js'
  import { WANDER_STATUS } from './wanderungen-daten.js'
  import { modal } from './modal.js'
  import { haptic } from './haptik.js'
  import Stepper from './Stepper.svelte'
  import OrtWahl from './OrtWahl.svelte'
  import BuchungEinfuegen from './BuchungEinfuegen.svelte'

  let { typ: startTyp = 'route', vorlage = {}, orte = [], onclose = () => {}, onfertig = () => {} } = $props()

  const TYPEN = [
    { id: 'etappe', label: t('Etappe') },
    { id: 'route', label: t('Route') },
    { id: 'wanderung', label: t('Wanderung') },
    { id: 'tag', label: t('Logbuch') },
    { id: 'buchung', label: t('Buchung') },
  ]
  let typ = $state(startTyp)
  const heute = $derived($heuteTag)
  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const ueber = $derived(planUeberblick(eintraege))

  // Etappe
  let eName = $state('')
  let eVon = $state('')
  let eTage = $state(3)
  let eArt = $state('auto')
  let eGesetzt = false
  $effect(() => { if (eGesetzt) return; eGesetzt = true; if (!eVon) eVon = vorlage.von || (ueber.ende ? plusTage(ueber.ende, 1) : heute) })

  // Route
  let rName = $state('')
  let rEtappe = $state('')
  let rStops = $state(vorlage.stops || [])
  let rGesetzt = false   // nur einmal vorbelegen, damit „keine Etappe“ wählbar bleibt
  $effect(() => {
    if (rGesetzt || rEtappe || !eintraege.length) return
    rGesetzt = true
    const v = vorlage.etappeId || etappeAm(eintraege, heute)?.reise.id
      || [...eintraege].sort((a, b) => (a.reise.art === 'flug') - (b.reise.art === 'flug') || b.tage - a.tage)[0]?.reise.id
    rEtappe = v || ''
  })

  // Wanderung
  let wName = $state(vorlage.name || '')
  let wOrt = $state(vorlage.ort || null)
  let wDatum = $state(vorlage.datum || '')
  let wZeit = $state('')
  let wStatus = $state(vorlage.status || 'wunsch')

  // Tag
  let tDatum = $state(vorlage.datum || heute)
  const tagGibtEs = $derived($journal.some((j) => j.datum === tDatum))
  const tagEtappe = $derived(etappeAm(eintraege, tDatum))

  const kannAnlegen = $derived(
    typ === 'etappe' ? gueltigesDatum(eVon) && eTage >= 1
    : typ === 'route' ? true
    : typ === 'wanderung' ? !!(wName.trim() || wOrt)
    : gueltigesDatum(tDatum))

  function anlegen() {
    if (!kannAnlegen) return
    haptic.confirm()
    if (typ === 'etappe') {
      const id = neueEtappe({ name: eName.trim() || undefined, von: eVon, tage: eTage, art: eArt })
      onfertig({ typ, id })
    } else if (typ === 'route') {
      const e = eintraege.find((x) => x.reise.id === rEtappe)?.reise
      const id = neueRoute({ name: rName.trim() || (rStops.length >= 2 ? `${rStops[0].name} → ${rStops[rStops.length - 1].name}` : undefined),
        etappeId: rEtappe || null, stops: rStops, farbe: e?.farbe, art: 'auto' })
      onfertig({ typ, id, etappeId: rEtappe || null })
    } else if (typ === 'wanderung') {
      const o = wOrt
      const id = neueWanderung({ name: wName.trim() || o?.name, datum: wDatum, zeit: wZeit, status: wStatus,
        ortId: o?.ortId || null, lat: o?.lat ?? null, lon: o?.lon ?? null, gebiet: o?.region && o.quelle === 'ort' ? o.region : '',
        reiseId: vorlage.reiseId || (wDatum ? etappeAm(eintraege, wDatum)?.reise.id : null) || null })
      onfertig({ typ, id })
    } else {
      if (!tagGibtEs) neuerJournalEintrag({ datum: tDatum, ...(vorlage.ort ? vorlage.ort : {}) })
      onfertig({ typ, datum: tDatum })
    }
  }
  function stoppDazu(o) { rStops = [...rStops, { name: o.name, lat: o.lat, lon: o.lon, img: null }] }
  const knopfText = $derived(typ === 'etappe' ? t('Etappe anlegen') : typ === 'route' ? t('Route anlegen') : typ === 'wanderung' ? t('Wanderung anlegen') : tagGibtEs ? t('Tag öffnen') : t('Tag anlegen'))
</script>

<div class="nb-hg" out:ausblenden data-dialog-hg onclick={onclose} aria-hidden="true"></div>
<div class="nb" out:blattRaus role="dialog" aria-labelledby="nb-titel" use:modal={{ onclose }}>
  <div class="nb-griff" aria-hidden="true"></div>
  <div class="nb-kopf">
    <h2 id="nb-titel">{t('Neu anlegen')}</h2>
    <button class="nb-zu" onclick={onclose} aria-label={t('Schließen')}>✕</button>
  </div>
  <div class="segment nb-typen" role="tablist" aria-label={t('Was anlegen?')}>
    {#each TYPEN as t}
      <button role="tab" aria-selected={typ === t.id} class:an={typ === t.id} onclick={() => (typ = t.id)}>{t.label}</button>
    {/each}
  </div>

  {#if typ === 'buchung'}
  <BuchungEinfuegen kompakt onfertig={(r) => onfertig(r)} />
  {:else}
  <form class="nb-form" onsubmit={(e) => { e.preventDefault(); anlegen() }}>
    {#if typ === 'etappe'}
      <p class="nb-k">{t('Ein Abschnitt der Reise mit Datum, zum Beispiel ein Stadtaufenthalt oder der Roadtrip mit dem Camper.')}</p>
      <label class="nb-f">{t('Name')}<input bind:value={eName} placeholder={t('z. B. Melbourne')} /></label>
      <div class="nb-zeile">
        <label class="nb-f">{t('Von')}<input type="date" bind:value={eVon} /></label>
        <span class="nb-f">{t('Tage')}<Stepper value={eTage} min={1} max={120} label={t('Dauer in Tagen')} onchange={(v) => (eTage = v)} /></span>
      </div>
      {#if gueltigesDatum(eVon)}<p class="nb-k">{bereich(eVon, plusTage(eVon, eTage - 1))}</p>{/if}
      <div class="segment" role="group" aria-label={t('Verkehrsmittel')}>
        <button type="button" class:an={eArt === 'auto'} aria-pressed={eArt === 'auto'} onclick={() => (eArt = 'auto')}>{t('🚗 Auto')}</button>
        <button type="button" class:an={eArt === 'flug'} aria-pressed={eArt === 'flug'} onclick={() => (eArt = 'flug')}>{t('✈️ Flug')}</button>
      </div>
    {:else if typ === 'route'}
      <p class="nb-k">{t('Eine Strecke mit Stopps innerhalb einer Etappe. Start und Ziel reichen fürs Erste, den Rest ergänzt du in der Route.')}</p>
      <label class="nb-f">{t('Etappe')}
        <select bind:value={rEtappe}>
          <option value="">{t('keine Etappe')}</option>
          {#each eintraege as x (x.reise.id)}<option value={x.reise.id}>{x.reise.name} ({bereich(x.von, x.bis)})</option>{/each}
        </select>
      </label>
      {#if rStops.length}
        <ol class="nb-stops">{#each rStops as s, i}<li>{s.name}<button type="button" class="nb-x" aria-label={t('{name} entfernen', { name: s.name })} onclick={() => (rStops = rStops.filter((_, k) => k !== i))}>✕</button></li>{/each}</ol>
      {/if}
      <span class="nb-f">{rStops.length === 0 ? t('Start') : rStops.length === 1 ? t('Ziel') : t('Weiterer Stopp')}
        <OrtWahl {orte} reisen={$reisen} label={rStops.length === 0 ? t('Start suchen') : t('Ziel suchen')} platzhalter={rStops.length === 0 ? t('z. B. Perth') : t('z. B. Exmouth')} onwahl={stoppDazu} koordinaten={false} />
      </span>
      <label class="nb-f">{t('Name (frei lassen für „Start → Ziel“)')}<input bind:value={rName} placeholder={rStops.length >= 2 ? `${rStops[0].name} → ${rStops[rStops.length - 1].name}` : t('z. B. Nord-Schleife')} /></label>
    {:else if typ === 'wanderung'}
      <span class="nb-f">Wo?
        {#if wOrt}
          <span class="nb-gewaehlt">📍 {wOrt.name}<button type="button" class="nb-x" aria-label={t('Ort entfernen')} onclick={() => (wOrt = null)}>✕</button></span>
        {:else}
          <OrtWahl {orte} reisen={$reisen} label={t('Ort oder Trailhead suchen')} platzhalter="z. B. Bluff Knoll" onwahl={(o) => { wOrt = o; if (!wName.trim()) wName = o.name }} />
        {/if}
      </span>
      <label class="nb-f">{t('Name')}<input bind:value={wName} placeholder={t('z. B. Bluff Knoll Gipfel')} /></label>
      <div class="nb-zeile">
        <label class="nb-f">{t('Datum (optional)')}<input type="date" bind:value={wDatum} /></label>
        <label class="nb-f">{t('Uhrzeit')}<input type="time" bind:value={wZeit} step="300" /></label>
      </div>
      {#if wDatum && etappeAm(eintraege, wDatum)}<p class="nb-k">{t('fällt in die Etappe „{name}“', { name: etappeAm(eintraege, wDatum).reise.name })}</p>{/if}
      <div class="segment" role="group" aria-label={t('Status')}>
        {#each WANDER_STATUS as s}<button type="button" class:an={wStatus === s.id} aria-pressed={wStatus === s.id} onclick={() => (wStatus = s.id)}>{s.emoji} {s.label}</button>{/each}
      </div>
    {:else}
      <label class="nb-f">{t('Datum')}<input type="date" bind:value={tDatum} /></label>
      <p class="nb-k">{mitWochentag(tDatum)}{#if tagEtappe}&nbsp;{t('· Etappe „{name}“', { name: tagEtappe.reise.name })}{:else}&nbsp;{t('· außerhalb der Etappen')}{/if}{#if tagGibtEs}{t('. Für diesen Tag gibt es schon einen Eintrag.')}{/if}</p>
    {/if}

    <button class="btn-primary nb-los" type="submit" disabled={!kannAnlegen}>{knopfText}</button>
  </form>
  {/if}
</div>

<style>
  .nb-hg { position: fixed; inset: 0; background: rgba(20, 14, 8, 0.4); z-index: 120; animation: hg var(--t-med) var(--ease-out); }
  .nb {
    position: fixed; z-index: 121; left: 0; right: 0; bottom: 0; max-height: 92dvh; overflow: auto;
    background: var(--bg); color: var(--ink); border-radius: 22px 22px 0 0; box-shadow: var(--shadow-float);
    padding: 8px 18px calc(18px + env(safe-area-inset-bottom, 0px)); display: flex; flex-direction: column; gap: 12px;
    animation: hoch var(--t-slow) var(--ease-spring);
  }
  @media (min-width: 900px) {
    .nb { left: 50%; top: 50%; bottom: auto; transform: translate(-50%, -50%); width: 520px; border-radius: var(--radius-l); padding: 18px 22px 20px; animation: rein var(--t-med) var(--ease-spring); }
    .nb-griff { display: none; }
  }
  .nb-griff { width: 40px; height: 5px; border-radius: 3px; background: var(--line-stark); align-self: center; margin-bottom: 4px; }
  .nb-kopf { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: calc(20px * var(--schrift, 1)); }
  .nb-zu { width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--flaeche-2); color: var(--ink); font-size: calc(16px * var(--schrift, 1)); cursor: pointer; }
  .nb-typen { display: grid; grid-template-columns: repeat(5, 1fr); }
  .nb-typen button { padding: 8px 2px; font-size: calc(12.5px * var(--schrift, 1)); min-height: 44px; }
  .nb-form { display: flex; flex-direction: column; gap: 12px; }
  .nb-k { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); }
  .nb-f { display: flex; flex-direction: column; gap: 5px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); flex: 1 1 0; min-width: 0; }
  .nb-f input, .nb-f select { min-height: 46px; font-size: max(16px, calc(17px * var(--schrift, 1))); padding: 8px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--eingabe); color: var(--ink); font-weight: 400; }
  .nb-zeile { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
  .nb-stops { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 4px; font-size: calc(15px * var(--schrift, 1)); }
  .nb-stops li { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .nb-x { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--line); background: var(--card); color: var(--muted); cursor: pointer; flex: none; }
  .nb-gewaehlt { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: calc(16px * var(--schrift, 1)); font-weight: 600; color: var(--ink); background: var(--card); border: 1px solid var(--line-stark); border-radius: var(--radius-m); padding: 4px 4px 4px 12px; min-height: 48px; }
  .nb-los { margin-top: 4px; min-height: 52px; font-size: calc(17px * var(--schrift, 1)); }
  @keyframes hg { from { opacity: 0; } }
  @keyframes hoch { from { transform: translateY(40px); opacity: 0.4; } }
  @keyframes rein { from { opacity: 0; transform: translate(-50%, -47%); } }
</style>
