<script>
  import { t, tn } from './i18n.js'
  // Eine Etappe: Name und Datum, Buchungen, Routen mit Stopps, Wanderungen, Logbuch.
  // Ist keine Etappe gewählt (Route ohne Etappe), zeigt sie nur diese Route.
  import { reisen, gesamtStart, buchungen, wanderungen, journal, updateReise, loescheReise, neueRoute, wandleReiseUm } from './userdata.js'
  import { etappenMitDatum, routenDerEtappe, tageZwischen, gueltigesDatum, ymd } from './plan.js'
  import { bereich, tageText, mitWochentag, zahl } from './format.js'
  import { katInfo } from './reisekalender.js'
  import { STATUS_MAP, S_MAP } from './wanderungen-daten.js'
  import { loeschFrage } from './dialog.js'
  import { zeigeToast } from './toast.js'
  import { haptic } from './haptik.js'
  import Stepper from './Stepper.svelte'
  import RouteEditor from './RouteEditor.svelte'
  import Versorgung from './Versorgung.svelte'
  import BelegKnoepfe from './BelegKnoepfe.svelte'
  import { dauer, klapp, istMorph, morphName } from './motion.js'

  let { etappeId = null, routeId = null, orte = [], warnungen = [], umkreisKm = 150,
    onzurueck = () => {}, onneu = () => {}, onlogbuch = () => {}, onwanderung = () => {} } = $props()

  const eintrag = $derived(etappenMitDatum($reisen, $gesamtStart).find((e) => e.reise.id === etappeId) || null)
  const etappe = $derived(eintrag?.reise || $reisen.find((r) => r.id === etappeId) || null)
  const einzelRoute = $derived(!etappeId && routeId ? $reisen.find((r) => r.id === routeId) : null)
  const routen = $derived(etappe ? routenDerEtappe($reisen, etappe.id) : einzelRoute ? [einzelRoute] : [])
  const alleEtappen = $derived(etappenMitDatum($reisen, $gesamtStart))

  let offen = $state({})
  $effect(() => { if (routeId) offen[routeId] = true })
  // Kommt man über eine Route hierher (Link, Karte, Ort einplanen), steht sie gleich im Bild
  $effect(() => {
    if (!routeId || !etappeId) return
    const t = setTimeout(() => document.getElementById('route-' + routeId)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 260)
    return () => clearTimeout(t)
  })
  let farbeOffen = $state(false)
  let anreiseOffen = $state(false)

  const von = $derived(eintrag?.von), bis = $derived(eintrag?.bis)
  const imZeitraum = (d) => d && von && d >= von && d <= bis
  const gebucht = $derived(($buchungen?.events || []).filter((b) => !b.platzhalter && imZeitraum(b.datum)).sort((a, b) => a.datum.localeCompare(b.datum)))
  const ids = $derived(new Set([etappe?.id, ...routen.map((r) => r.id)].filter(Boolean)))
  const wand = $derived($wanderungen.filter((w) => (w.datum ? imZeitraum(w.datum) : ids.has(w.reiseId))))
  const geschrieben = $derived(new Set($journal.filter((j) => imZeitraum(j.datum)).map((j) => j.datum)).size)
  const vergangen = $derived(von && eintrag ? Math.max(0, Math.min(eintrag.tage, tageZwischen(von, ymd(new Date())) + 1)) : 0)

  function setVon(v) { if (gueltigesDatum(v)) updateReise(etappe.id, { von: v }) }
  function setTage(t) { updateReise(etappe.id, { tage: t }) }
  function setBis(v) {
    if (!gueltigesDatum(v) || !von) return
    const t = tageZwischen(von, v) + 1
    if (t >= 1) updateReise(etappe.id, { tage: t })
  }

  function routeDazu() {
    const id = neueRoute({ etappeId: etappe.id, name: t('Route {n}', { n: routen.length + 1 }), art: 'auto', farbe: etappe.farbe })
    offen[id] = true
    haptic()
    setTimeout(() => document.getElementById('route-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  async function routeLoeschen(r) {
    if (await loeschFrage(t('Route „{name}“', { name: r.name }), t('{length} Stopps. Das lässt sich nicht rückgängig machen.', { length: (r.stops || []).length }))) {
      loescheReise(r.id); zeigeToast(t('Route „{name}“ gelöscht', { name: r.name }), 'info')
      if (einzelRoute) onzurueck()
    }
  }
  async function etappeLoeschen() {
    const n = routen.length
    const zusatz = n ? tn(n, 'Die Route darin bleibt erhalten und steht danach unter „Routen ohne Etappe“.', 'Die {n} Routen darin bleiben erhalten und stehen danach unter „Routen ohne Etappe“.') : t('Das lässt sich nicht rückgängig machen.')
    if (await loeschFrage(t('Etappe „{name}“', { name: etappe.name }), zusatz)) {
      loescheReise(etappe.id); zeigeToast(t('Etappe „{name}“ gelöscht', { name: etappe.name }), 'info'); onzurueck()
    }
  }
  function zurRoute() {
    wandleReiseUm(etappe.id, 'route', null)
    zeigeToast(t('„{name}“ ist jetzt eine Route ohne Etappe', { name: etappe.name }), 'ok')
    onzurueck()
  }
  const farben = ['#2f6b4f', '#1a7a8a', '#a8842b', '#7a3b1e', '#7a5c8e', '#c1662f', '#4a4038', '#a83c6e']
</script>

<div class="ed">
  <button class="ed-zurueck" onclick={onzurueck}><span aria-hidden="true">‹</span> {t('Plan')}</button>

  {#if etappe}
    <header class="ed-kopf" data-morph style:view-transition-name={istMorph(etappe.id) ? morphName : null} style="--farbe:{etappe.farbe || 'var(--brand)'}">
      <label class="ed-name-feld">
        <span class="sr">{t('Name der Etappe')}</span>
        <input class="ed-name" value={etappe.name} oninput={(e) => updateReise(etappe.id, { name: e.target.value })} />
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" /></svg>
      </label>
      <button class="ed-farbknopf" aria-expanded={farbeOffen} onclick={() => (farbeOffen = !farbeOffen)}>
        <span class="ed-farbpunkt" aria-hidden="true"></span>{t('Farbe')}
      </button>
    </header>
    {#if farbeOffen}
      <div class="ed-farben" role="radiogroup" aria-label={t('Farbe der Etappe')} transition:klapp={{ duration: dauer(180) }}>
        {#each farben as f}
          <button class="ed-farbe" class:an={etappe.farbe === f} style="background:{f}" role="radio" aria-checked={etappe.farbe === f} aria-label={t('Farbe {f}', { f })} onclick={() => { updateReise(etappe.id, { farbe: f }); farbeOffen = false }}></button>
        {/each}
      </div>
    {/if}

    <section class="ed-block ed-zeit">
      <div class="ed-felder">
        <label class="ed-f">{t('Von')}<input type="date" value={von} onchange={(e) => setVon(e.target.value)} /></label>
        <span class="ed-f">{t('Tage')}<Stepper value={eintrag?.tage ?? etappe.tage} min={1} max={120} label={t('Dauer in Tagen')} onchange={setTage} /></span>
        <label class="ed-f">{t('Bis')}<input type="date" value={bis} min={von} onchange={(e) => setBis(e.target.value)} /></label>
      </div>
      <p class="ed-k">{t('{mitWochentag} bis {mitWochentag2}, {tageText}', { mitWochentag: mitWochentag(von), mitWochentag2: mitWochentag(bis), tageText: tageText(eintrag?.tage ?? etappe.tage) })}{#if vergangen > 0 && vergangen < (eintrag?.tage ?? 0)}&nbsp;{t('· heute Tag {vergangen}', { vergangen })}{/if}</p>
      {#if etappe.quelle === 'reisekalender'}
        <p class="ed-k ed-quelle">{t('Kommt aus deinem Reisekalender. Ein neuer Import setzt Name und Datum wieder auf den Kalender. Deine Routen, Wanderungen und Logbuchtage bleiben dabei an der Etappe.')}</p>
      {/if}
    </section>

    {#if gebucht.length}
      <section class="ed-block">
        <h2 class="ed-h">{t('Gebucht')} <span class="ed-zahl">{gebucht.length}</span></h2>
        <ul class="ed-buch">
          {#each gebucht as b (b.id)}
            <li><span class="ed-b-tag">{mitWochentag(b.datum)}</span><span class="ed-b-icon" aria-hidden="true">{b.emoji || katInfo(b.kat).icon}</span><span class="ed-b-txt"><b>{b.titel}</b>{#if b.sub}<small>{b.sub}</small>{/if}<BelegKnoepfe docs={b.docs} /></span></li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if (etappe.stops || []).length}
      <section class="ed-block">
        <button class="ed-auf" aria-expanded={anreiseOffen} onclick={() => (anreiseOffen = !anreiseOffen)}>
          <span class="aufklapp klein" class:offen={anreiseOffen} aria-hidden="true"></span>
          <span class="ed-auf-txt"><b>{t('Anreise und Orte der Etappe')}</b><small>{(etappe.stops || []).map((s) => s.name).join(' → ')}{#if etappe.route?.km}&nbsp;· {etappe.route.flug ? '✈️' : '🛣️'} {zahl(etappe.route.km)} km{/if}</small></span>
        </button>
        {#if anreiseOffen}<div class="ed-innen" transition:klapp={{ duration: dauer(220) }}><RouteEditor r={etappe} {orte} reisen={$reisen} {warnungen} {umkreisKm} /><Versorgung r={etappe} {orte} /></div>{/if}
      </section>
    {/if}
  {/if}

  <section class="ed-block">
    {#if etappe}<h2 class="ed-h">{t('Routen')} <span class="ed-zahl">{routen.length}</span></h2>{/if}
    {#if etappe && !routen.length}
      <p class="ed-k">{t('Eine Route ist die Strecke, die du in dieser Etappe fährst, mit allen Stopps. Daraus rechnet die App km, Fahrzeit, Tankstopps und Sehenswertes am Weg.')}</p>
    {/if}
    {#each routen as r (r.id)}
      <article class="ed-route" id="route-{r.id}" style="--farbe:{r.farbe || 'var(--brand)'}">
        <div class="ed-r-kopf">
          <button class="aufklapp" class:offen={offen[r.id]} aria-expanded={!!offen[r.id]} aria-label={t(offen[r.id] ? '{name} zuklappen' : '{name} aufklappen', { name: r.name })} onclick={() => (offen[r.id] = !offen[r.id])}></button>
          <input class="ed-r-name" value={r.name} aria-label={t('Name der Route')} oninput={(e) => updateReise(r.id, { name: e.target.value })} />
        </div>
        <p class="ed-r-meta">{t('{length} Stopps', { length: (r.stops || []).length })}{#if r.route?.km}&nbsp;· {r.route.flug ? '✈️' : '🛣️'} {zahl(r.route.km)} km{/if}{#if (r.stops || []).length >= 2}&nbsp;· {r.stops[0].name} → {r.stops[r.stops.length - 1].name}{/if}</p>
        {#if offen[r.id]}
          <div class="ed-innen" transition:klapp={{ duration: dauer(240) }}>
            <RouteEditor {r} {orte} reisen={$reisen} {warnungen} {umkreisKm} />
            <Versorgung {r} {orte} />
            <div class="ed-r-fuss">
              <label class="ed-f ed-f-breit">{t('Gehört zur Etappe')}
                <select value={r.etappeId || ''} onchange={(e) => { updateReise(r.id, { etappeId: e.target.value || null, etappeVermutet: false }); if (einzelRoute && e.target.value) onzurueck() }}>
                  <option value="">{t('keine Etappe')}</option>
                  {#each alleEtappen as x (x.reise.id)}<option value={x.reise.id}>{x.reise.name} ({bereich(x.von, x.bis)})</option>{/each}
                </select>
              </label>
              {#if r.etappeVermutet}<p class="ed-k">{t('Diese Zuordnung hat die App beim Umstellen auf V4 geraten. Stimmt sie nicht, hier ändern.')}</p>{/if}
              <button class="btn ed-weg" onclick={() => routeLoeschen(r)}>{t('Route löschen')}</button>
            </div>
          </div>
        {/if}
      </article>
    {/each}
    {#if etappe}<button class="btn ed-dazu" onclick={routeDazu}>{t('+ Route in dieser Etappe')}</button>{/if}
  </section>

  {#if etappe}
    <section class="ed-block">
      <h2 class="ed-h">{t('Wanderungen')} <span class="ed-zahl">{wand.length}</span></h2>
      {#if wand.length}
        <ul class="ed-wand">
          {#each wand as w (w.id)}
            <li><button class="ed-w" onclick={() => onwanderung(w.id)}>
              <span aria-hidden="true">{STATUS_MAP[w.status]?.emoji || '🥾'}</span>
              <span class="ed-w-txt"><b>{w.name}</b><small>{w.datum ? mitWochentag(w.datum) + (w.zeit ? ', ' + w.zeit : '') : t('ohne Datum')}{#if w.km}&nbsp;· {w.km} km{/if}{#if S_MAP[w.schwierigkeit]}&nbsp;· {S_MAP[w.schwierigkeit].label}{/if}</small></span>
              <span class="ed-w-pfeil" aria-hidden="true">›</span>
            </button></li>
          {/each}
        </ul>
      {/if}
      <button class="btn ed-dazu" onclick={() => onneu('wanderung', { datum: von, reiseId: etappe.id })}>{t('+ Wanderung')}</button>
    </section>

    <section class="ed-block">
      <h2 class="ed-h">{t('Logbuch')}</h2>
      <p class="ed-k">{geschrieben ? t('{geschrieben} von {wert} Tagen geschrieben.', { geschrieben, wert: eintrag?.tage ?? etappe.tage }) : t('Noch kein Tag geschrieben.')}</p>
      <button class="btn ed-dazu" onclick={() => onlogbuch(etappe.id)}>{t('Im Logbuch ansehen')}</button>
    </section>

    <section class="ed-block ed-ende">
      <button class="btn" onclick={zurRoute}>{t('In Route umwandeln')}</button>
      <button class="btn ed-weg" onclick={etappeLoeschen}>{t('Etappe löschen')}</button>
    </section>
  {:else if !einzelRoute}
    <p class="ed-k">{t('Diese Etappe gibt es nicht mehr.')}</p>
  {/if}
</div>

<style>
  .ed { display: flex; flex-direction: column; gap: 16px; }
  .ed-zurueck {
    align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 12px 0 4px;
    border: none; background: none; color: var(--brand-text); font-size: calc(16px * var(--schrift, 1)); font-weight: 600; cursor: pointer;
  }
  .ed-zurueck span { font-size: calc(28px * var(--schrift, 1)); line-height: 1; margin-top: -3px; }
  .ed-kopf { display: flex; align-items: center; gap: 10px; border-left: 6px solid var(--farbe); padding-left: 12px; transition: border-color var(--t-med) var(--ease-out); }
  .ed-name-feld { position: relative; display: flex; align-items: center; flex: 1; min-width: 0; }
  /* Farbe ist Nebensache: ein kleiner Knopf statt acht großer Kreise über dem Datum */
  .ed-farbknopf { flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 12px 0 8px; border: 1px solid var(--line); border-radius: 22px; background: var(--card); color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .ed-farbpunkt { width: 18px; height: 18px; border-radius: 50%; background: var(--farbe); box-shadow: 0 0 0 2px var(--card), 0 0 0 3px var(--line-stark); }
  .ed-name {
    width: 100%; font-size: calc(24px * var(--schrift, 1)); font-weight: 800; color: var(--ink); line-height: 1.2;
    border: 1px solid transparent; border-bottom: 1px dashed var(--line-stark); border-radius: 8px 8px 0 0; padding: 6px 30px 6px 4px; background: transparent;
  }
  .ed-name:focus { border-color: var(--line-stark); background: var(--eingabe); border-radius: 8px; outline: none; }
  .ed-name-feld svg { position: absolute; right: 6px; color: var(--muted); pointer-events: none; }
  .ed-farben { display: flex; gap: 10px; flex-wrap: wrap; padding: 2px 0 2px 18px; margin-top: -6px; }
  .ed-farbe { width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--card); box-shadow: 0 0 0 1px var(--line-stark); cursor: pointer; padding: 0; }
  .ed-farbe.an { box-shadow: 0 0 0 3px var(--ink); }
  .ed-block { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: var(--shadow); }
  .ed-block .ed-h { margin: 0; font-size: calc(17px * var(--schrift, 1)); display: flex; align-items: center; gap: 8px; }
  .ed-zahl { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 800; background: var(--flaeche-2); color: var(--muted); padding: 1px 8px; border-radius: 10px; }
  .ed-felder { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: end; }
  @media (max-width: 480px) { .ed-felder { grid-template-columns: 1fr 1fr; } .ed-felder > :nth-child(2) { grid-column: 1 / -1; order: 3; } }
  .ed-f { display: flex; flex-direction: column; gap: 4px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .ed-f select { width: 100%; max-width: 100%; }
  .ed-f input, .ed-f select { min-height: 44px; font-size: max(16px, calc(16px * var(--schrift, 1))); padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); }
  .ed-f-breit { flex: 1 1 220px; min-width: 0; max-width: 100%; }

  .ed-k { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); }
  .ed-quelle { background: var(--info-flaeche); color: var(--info-text); padding: 8px 10px; border-radius: 10px; }
  .ed-buch { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ed-buch li { display: grid; grid-template-columns: 82px 26px 1fr; gap: 8px; align-items: center; font-size: calc(14px * var(--schrift, 1)); min-height: 40px; }
  .ed-b-tag { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .ed-b-icon { font-size: calc(17px * var(--schrift, 1)); text-align: center; }
  .ed-b-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
  .ed-b-txt small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .ed-auf { display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 0; cursor: pointer; text-align: left; color: var(--ink); min-height: 44px; }
  .ed-auf:active { transform: none; }
  .ed-auf-txt { display: flex; flex-direction: column; min-width: 0; }
  .ed-auf-txt b { font-size: calc(15px * var(--schrift, 1)); }
  .ed-auf-txt small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ed-innen { padding-top: 6px; }
  .ed-route { border: 1px solid var(--line); border-left: 5px solid var(--farbe); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; background: var(--card); }
  .ed-r-kopf { display: flex; align-items: center; gap: 8px; }
  .ed-r-name { flex: 1; min-width: 0; font-size: calc(16.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); border: 1px solid transparent; border-radius: 8px; padding: 6px 6px; background: transparent; min-height: 44px; }
  .ed-r-name:hover, .ed-r-name:focus { border-color: var(--line-stark); background: var(--eingabe); }
  .ed-r-meta { margin: 0 0 0 48px; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ed-r-fuss { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
  .ed-dazu { align-self: flex-start; min-height: 44px; }
  .ed-weg { color: var(--danger-text); min-height: 44px; }
  .ed-ende { flex-direction: row; flex-wrap: wrap; justify-content: space-between; background: none; border: none; box-shadow: none; padding: 0; }
  .ed-ende .btn { min-height: 44px; }
  .ed-wand { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ed-w { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--flaeche); cursor: pointer; text-align: left; color: var(--ink); }
  .ed-w-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .ed-w-txt small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .ed-w-pfeil { font-size: calc(22px * var(--schrift, 1)); color: var(--muted); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (max-width: 600px) {
    /* Auf dem iPhone keine Karte in der Karte in der Karte: die Route liegt flach im Block */
    .ed-block { padding: 12px; }
    .ed-route { border: none; border-left: 4px solid var(--farbe); border-radius: 0; padding: 4px 0 8px 10px; }
    .ed-r-meta { margin-left: 0; }
  }
</style>
