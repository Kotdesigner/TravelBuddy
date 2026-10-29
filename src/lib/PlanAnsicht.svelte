<script>
  import { t, tn } from './i18n.js'
  import { merkeMorph, istMorph, morphName } from './motion.js'
  import { heuteTag } from './heute.js'
  // Plan (V4): alle Etappen mit Datum, darunter ihre Routen. Antippen öffnet die Etappe.
  // Ersetzt „Meine Reisen“ mit seinen 12 aufgeklappten Bearbeiten-Karten.
  import { reisen, gesamtStart, buchungen, wanderungen, journal, wandleReiseUm, loescheReise } from './userdata.js'
  import { etappenMitDatum, planUeberblick, routenDerEtappe, istRoute, ymd, vermuteEtappe } from './plan.js'
  import { bereich, tageText, tagMonatJahr, zahl } from './format.js'
  import { loeschFrage } from './dialog.js'
  import { zeigeToast } from './toast.js'
  import { artVon } from './routen-dienst.js'

  let { onoeffne = () => {}, onneu = () => {} } = $props()

  const heute = $derived($heuteTag)
  const eintraege = $derived(etappenMitDatum($reisen, $gesamtStart))
  const ueber = $derived(planUeberblick(eintraege))
  const ohneEtappe = $derived($reisen.filter((r) => istRoute(r) && (!r.etappeId || !$reisen.some((e) => e.id === r.etappeId))))
  const lueckeNach = $derived(new Map(ueber.luecken.map((l) => [l.nachId, l])))

  const imZeitraum = (liste, e, feld = 'datum') => liste.filter((x) => x[feld] && x[feld] >= e.von && x[feld] <= e.bis)
  function zahlen(e) {
    const routen = routenDerEtappe($reisen, e.reise.id)
    const ids = new Set([e.reise.id, ...routen.map((r) => r.id)])
    const wand = $wanderungen.filter((w) => (w.datum ? w.datum >= e.von && w.datum <= e.bis : ids.has(w.reiseId)))
    const buch = imZeitraum(($buchungen?.events || []).filter((b) => !b.platzhalter), e)
    const tage = new Set(imZeitraum($journal, e).map((j) => j.datum)).size
    const km = routen.reduce((n, r) => n + (r.route && !r.route.flug ? r.route.km : 0), 0)
    return { routen, wand: wand.length, buch: buch.length, tage, km }
  }

  // Etappen nach dem Rückflug ohne eigene Buchungen: meist alte Entwürfe (bei Steve:
  // „Hinflug Austalia“ und eine leere „Neue Reise“, die den Plan auf 66 Tage zogen).
  const nachRueckflug = $derived.by(() => {
    const bis = $buchungen?.bis
    if (!bis) return []
    return eintraege.filter((e) => e.reise.quelle !== 'reisekalender' && e.von > bis)
  })
  async function zurRoute(e) {
    const ziel = vermuteEtappe(e.reise, eintraege.filter((x) => x.reise.id !== e.reise.id && !nachRueckflug.includes(x)))
    wandleReiseUm(e.reise.id, 'route', ziel?.id || null)
    zeigeToast(t('„{name}“ ist jetzt eine Route', { name: e.reise.name }), 'ok')
  }
  async function weg(e) {
    if (await loeschFrage(`„${e.reise.name}“`, t('{length} Stopps. Das lässt sich nicht rückgängig machen.', { length: (e.reise.stops || []).length }))) {
      loescheReise(e.reise.id)
      zeigeToast(t('„{name}“ gelöscht', { name: e.reise.name }), 'info')
    }
  }
  const symbol = (r) => (artVon(r) === 'flug' ? '✈️' : '🚐')
</script>

<div class="pl">
  {#if eintraege.length}
    <p class="pl-summe">
      <b>{t('{tagMonatJahr} bis {tagMonatJahr2}', { tagMonatJahr: tagMonatJahr(ueber.start), tagMonatJahr2: tagMonatJahr(ueber.ende) })}</b>{t(', {tageText} in {length} Etappen', { tageText: tageText(ueber.tage), length: eintraege.length })}
    </p>
  {/if}

  {#if nachRueckflug.length}
    <div class="pl-hinweis" role="note">
      <p><b>{tn(nachRueckflug.length, 'Eine Etappe liegt nach deinem Rückflug', '{n} Etappen liegen nach deinem Rückflug')}</b> {t('und verlängern die Reise. Vermutlich alte Entwürfe:')}</p>
      {#each nachRueckflug as e (e.reise.id)}
        <div class="pl-h-zeile">
          <span class="pl-h-name">{e.reise.name}<small>{t('{bereich} · {length} Stopps', { bereich: bereich(e.von, e.bis), length: (e.reise.stops || []).length })}</small></span>
          <button class="btn" onclick={() => zurRoute(e)}>{t('Zur Route machen')}</button>
          <button class="btn pl-weg" onclick={() => weg(e)}>{t('Löschen')}</button>
        </div>
      {/each}
    </div>
  {/if}

  {#if !eintraege.length}
    <div class="pl-leer">
      <p><b>{t('Noch keine Etappe.')}</b> {t('Eine Etappe ist ein Abschnitt deiner Reise mit Datum, zum Beispiel „Melbourne, 30.11. bis 3.12.“. Die Strecken, die du darin fährst, legst du danach als Routen an.')}</p>
      <button class="btn-primary" onclick={() => onneu('etappe')}>{t('Erste Etappe anlegen')}</button>
      <p class="pl-leer-k">{t('Oder deinen Reisekalender laden: Mehr → Import.')}</p>
    </div>
  {:else}
    <ol class="pl-liste">
      {#each eintraege as e, i (e.reise.id)}
        {@const z = zahlen(e)}
        {@const jetzt = heute >= e.von && heute <= e.bis}
        <li class="pl-etappe rein" class:jetzt style="--farbe:{e.reise.farbe || 'var(--brand)'}; --i:{i}">
          <button class="pl-zeile" data-morph style:view-transition-name={istMorph(e.reise.id) ? morphName : null} onclick={(ev) => { merkeMorph(e.reise.id, ev.currentTarget); onoeffne(e.reise.id) }} aria-label={t('{name}, {bereich}, {tageText} öffnen', { name: e.reise.name, bereich: bereich(e.von, e.bis), tageText: tageText(e.tage) })}>
            <span class="pl-datum"><b>{bereich(e.von, e.bis)}</b><small>{tageText(e.tage)}</small></span>
            <span class="pl-inhalt">
              <span class="pl-name">{e.reise.name}{#if jetzt}<span class="pl-jetzt">{t('heute')}</span>{/if}</span>
              <span class="pl-meta">
                {#if e.reise.route?.km}<span>{symbol(e.reise)} {zahl(e.reise.route.km)} km</span>{/if}
                {#if z.routen.length}<span>🛣️ {tn(z.routen.length, '{n} Route', '{n} Routen')}{#if z.km}&nbsp;· {zahl(z.km)} km{/if}</span>{/if}
                {#if z.wand}<span>🥾 {z.wand}</span>{/if}
                {#if z.buch}<span>{t('🧾 {buch} gebucht', { buch: z.buch })}</span>{/if}
                {#if z.tage}<span>{t('📓 {tage} von {tage2} Tagen', { tage: z.tage, tage2: e.tage })}</span>{/if}
              </span>
            </span>
            <span class="pl-pfeil" aria-hidden="true">›</span>
          </button>
          {#if z.routen.length}
            <ul class="pl-routen">
              {#each z.routen as r (r.id)}
                <li>
                  <button class="pl-route" onclick={() => onoeffne(e.reise.id, r.id)}>
                    <span class="pl-r-linie" style="background:{r.farbe}" aria-hidden="true"></span>
                    <span class="pl-r-name">{r.name}</span>
                    <span class="pl-r-meta">{t('{length} Stopps', { length: (r.stops || []).length })}{#if r.route?.km}&nbsp;· {zahl(r.route.km)} km{/if}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
        {#if lueckeNach.get(e.reise.id)}
          {@const l = lueckeNach.get(e.reise.id)}
          <li class="pl-luecke" class:ueber={l.tage < 0}>
            {l.tage > 0 ? t('{tageText} ohne Etappe', { tageText: tageText(l.tage) }) : t('überschneidet sich {tageText} mit der nächsten Etappe', { tageText: tageText(-l.tage) })}
          </li>
        {/if}
      {/each}
    </ol>
  {/if}

  {#if ohneEtappe.length}
    <h3 class="pl-h3">{t('Routen ohne Etappe')}</h3>
    <p class="pl-k">{t('Öffne eine Route und wähle, zu welcher Etappe sie gehört. Dann erscheint sie dort und im Logbuch.')}</p>
    <ul class="pl-routen frei">
      {#each ohneEtappe as r (r.id)}
        <li>
          <button class="pl-route" onclick={() => onoeffne(null, r.id)}>
            <span class="pl-r-linie" style="background:{r.farbe}" aria-hidden="true"></span>
            <span class="pl-r-name">{r.name}</span>
            <span class="pl-r-meta">{t('{length} Stopps', { length: (r.stops || []).length })}{#if r.route?.km}&nbsp;· {zahl(r.route.km)} km{/if}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .pl { display: flex; flex-direction: column; gap: 14px; }
  .pl-summe { margin: 0; font-size: calc(15px * var(--schrift, 1)); color: var(--muted); }
  .pl-summe b { color: var(--ink); }
  .pl-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .pl-etappe {
    background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m);
    box-shadow: var(--shadow); overflow: hidden; border-left: 6px solid var(--farbe);
  }
  .pl-etappe.jetzt { box-shadow: 0 0 0 2px var(--brand-2), var(--shadow); }
  .pl-zeile {
    display: grid; grid-template-columns: 112px 1fr 18px; gap: 12px; align-items: center; width: 100%;
    background: none; border: none; text-align: left; padding: 14px 12px 14px 14px; cursor: pointer; color: var(--ink); min-height: 64px;
  }
  .pl-zeile:active { transform: none; background: var(--flaeche); }
  .pl-datum { display: flex; flex-direction: column; line-height: 1.25; }
  .pl-datum b { font-size: calc(14px * var(--schrift, 1)); font-variant-numeric: tabular-nums; }
  .pl-datum small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .pl-inhalt { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .pl-name { font-size: calc(16.5px * var(--schrift, 1)); font-weight: 700; line-height: 1.3; }
  .pl-jetzt { margin-left: 8px; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: #fff; background: var(--ok); padding: 2px 8px; border-radius: 10px; vertical-align: 2px; }
  .pl-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .pl-pfeil { font-size: calc(24px * var(--schrift, 1)); color: var(--muted); line-height: 1; }
  .pl-routen { list-style: none; margin: 0; padding: 0 10px 10px 124px; display: flex; flex-direction: column; gap: 4px; }
  .pl-routen.frei { padding: 0; }
  .pl-route {
    display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 6px 10px;
    border: 1px solid var(--line); border-radius: 12px; background: var(--flaeche); cursor: pointer; text-align: left; color: var(--ink);
  }
  .pl-r-linie { width: 18px; height: 4px; border-radius: 2px; flex: none; }
  .pl-r-name { flex: 1; min-width: 0; font-size: calc(14px * var(--schrift, 1)); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-r-meta { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); flex: none; }
  .pl-luecke { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); padding: 0 0 0 18px; border-left: 2px dashed var(--line-stark); margin-left: 40px; }
  .pl-luecke.ueber { color: var(--danger-text); border-color: var(--danger-linie); }
  .pl-hinweis { background: var(--warn-flaeche); border: 1px solid var(--line-stark); border-radius: var(--radius-m); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
  .pl-hinweis p { margin: 0; font-size: calc(14px * var(--schrift, 1)); }
  .pl-h-zeile { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .pl-h-name { flex: 1 1 160px; display: flex; flex-direction: column; font-weight: 700; font-size: calc(14.5px * var(--schrift, 1)); }
  .pl-h-name small { font-weight: 400; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .pl-h-zeile .btn { min-height: 44px; }
  .pl-weg { color: var(--danger-text); }
  .pl-leer { background: var(--flaeche); border-radius: var(--radius-m); padding: 18px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  .pl-leer p { margin: 0; font-size: calc(15px * var(--schrift, 1)); }
  .pl-leer-k { font-size: calc(13px * var(--schrift, 1)) !important; color: var(--muted); }
  .pl-h3 { margin: 8px 0 0; font-size: calc(17px * var(--schrift, 1)); }
  .pl-k { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); }
  @media (max-width: 420px) {
    .pl-zeile { grid-template-columns: 96px 1fr 14px; gap: 10px; padding: 12px 10px 12px 12px; }
    .pl-datum b { font-size: calc(13.5px * var(--schrift, 1)); }
    .pl-routen { padding-left: 12px; }
  }
</style>
