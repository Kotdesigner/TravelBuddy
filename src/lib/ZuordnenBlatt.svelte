<script>
  // V16: Fragen statt raten. Wohin kommt ein neuer Abschnitt (Routen-Idee, Ort einplanen, Etappe
  // zur Route machen)? Vorgeschlagen wird eine passende Etappe, nie Hin- oder Heimreise. Man wählt
  // Etappe, Zeitraum und Namen, oder merkt ihn als Idee ohne Datum.
  import { je } from './i18n.js'
  import { reisen, gesamtStart } from './userdata.js'
  import { etappenMitDatum, plusTage } from './plan.js'
  import { etappeVorschlag, istReiseEtappe, ersterFreierTag } from './abschnitte.js'
  import { bereich, tagMonat } from './format.js'
  import { modal } from './modal.js'
  import Stepper from './Stepper.svelte'

  /** vorlage: { titel, name, stops, tage }. onfertig({ etappeId, von, tage, name, idee }) */
  let { vorlage, onfertig = () => {}, onabbruch = () => {}, knopf = '' } = $props()

  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const v = $derived(etappeVorschlag(vorlage.stops || [], eintraege, $reisen))
  const sortiert = $derived([...eintraege].sort((a, b) => (istReiseEtappe(a.reise, $reisen) - istReiseEtappe(b.reise, $reisen)) || a.von.localeCompare(b.von)))

  let etappeId = $state(''), von = $state(''), tage = $state(1), name = $state(''), idee = $state(false), gesetzt = false
  $effect(() => {
    if (gesetzt || !eintraege.length) return
    gesetzt = true
    etappeId = v?.etappe.reise.id || ''
    name = vorlage.name || ''
    tage = Math.max(1, vorlage.tage || 1)
    const e = eintraege.find((x) => x.reise.id === etappeId)
    von = e ? ersterFreierTag($reisen, e) : ''
  })
  const gewaehlt = $derived(eintraege.find((x) => x.reise.id === etappeId) || null)
  function etappeWechseln(id) {
    etappeId = id
    const e = eintraege.find((x) => x.reise.id === id)
    von = e ? ersterFreierTag($reisen, e) : ''
  }
  const bis = $derived(von ? plusTage(von, tage - 1) : '')
  const ausserhalb = $derived(gewaehlt && von && (von < gewaehlt.von || bis > gewaehlt.bis))
  function los() { onfertig({ etappeId: etappeId || null, von: idee || !etappeId ? null : von || null, tage, name: name.trim() || vorlage.name, idee }) }
</script>

<div class="zb-hg" data-dialog-hg aria-hidden="true" onclick={onabbruch}></div>
<div class="zb" role="dialog" aria-labelledby="zb-titel" use:modal={{ onclose: onabbruch }}>
  <h2 id="zb-titel">{je('Wohin damit?', 'Where should it go?')}</h2>
  {#if vorlage.titel}<p class="zb-titel">{vorlage.titel}{#if vorlage.tage}{' · '}{je(`${vorlage.tage} Tage`, `${vorlage.tage} days`)}{/if}</p>{/if}

  <label class="zb-f">{je('Etappe', 'Leg')}
    <select value={etappeId} onchange={(e) => etappeWechseln(e.currentTarget.value)}>
      {#each sortiert as e (e.reise.id)}<option value={e.reise.id}>{e.reise.name} ({bereich(e.von, e.bis)}){istReiseEtappe(e.reise, $reisen) ? je(' · Reise', ' · travel') : ''}{v?.etappe.reise.id === e.reise.id ? je(' · Vorschlag', ' · suggested') : ''}</option>{/each}
      <option value="">{je('Ohne Etappe', 'No leg')}</option>
    </select>
  </label>
  {#if v && v.etappe.reise.id === etappeId}<p class="zb-k">{v.grund === 'nah' ? je('Vorschlag, weil die Etappe in der Nähe liegt.', 'Suggested because the leg is nearby.') : je('Vorschlag: die längste Etappe, in der du selbst fährst.', 'Suggested: the longest leg you drive yourself.')}</p>{/if}

  <label class="zb-f">{je('Name', 'Name')}<input bind:value={name} /></label>

  <label class="zb-check"><input type="checkbox" bind:checked={idee} /> <span>{je('Nur als Idee merken (ohne Datum, zählt nicht mit)', 'Just keep as an idea (no date, not counted)')}</span></label>

  {#if !idee && etappeId}
    <div class="zb-zeit">
      <label class="zb-f">{je('Von', 'From')}<input type="date" bind:value={von} min={gewaehlt?.von} max={gewaehlt?.bis} /></label>
      <span class="zb-f">{je('Tage', 'Days')}<Stepper value={tage} min={1} max={120} label={je('Dauer in Tagen', 'Length in days')} onchange={(n) => (tage = n)} /></span>
    </div>
    {#if von}<p class="zb-k">{tagMonat(von)} {je('bis', 'to')} {tagMonat(bis)}{#if ausserhalb}{' · '}<b class="zb-warn">{je('reicht über die Etappe hinaus', 'goes beyond the leg')}</b>{/if}</p>{/if}
  {/if}

  <div class="zb-knoepfe">
    <button class="btn btn-ghost" onclick={onabbruch}>{je('Abbrechen', 'Cancel')}</button>
    <button class="btn-primary" onclick={los}>{knopf || je('Übernehmen', 'Add')}</button>
  </div>
</div>

<style>
  .zb-hg { position: fixed; inset: 0; z-index: 900; background: rgba(20, 14, 8, 0.5); }
  .zb { position: fixed; left: 50%; top: 50%; z-index: 901; transform: translate(-50%, -50%); width: min(460px, calc(100% - 32px)); max-height: calc(100dvh - 32px); overflow: auto; display: flex; flex-direction: column; gap: 10px; padding: 18px; border-radius: var(--radius-l); background: var(--card); color: var(--ink); box-shadow: var(--shadow-float); }
  h2 { margin: 0; font-size: calc(18px * var(--schrift, 1)); }
  .zb-titel { margin: 0; font-weight: 700; font-size: calc(14px * var(--schrift, 1)); }
  .zb-f { display: flex; flex-direction: column; gap: 4px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .zb-f input, .zb-f select { min-height: 44px; font-size: max(16px, calc(15px * var(--schrift, 1))); padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); width: 100%; box-sizing: border-box; }
  .zb-check { display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: calc(14px * var(--schrift, 1)); cursor: pointer; }
  .zb-zeit { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
  .zb-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .zb-warn { color: var(--danger-text); }
  .zb-knoepfe { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
</style>
