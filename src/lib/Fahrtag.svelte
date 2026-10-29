<script>
  import { t, tn } from './i18n.js'
  // Fahrtag-Planer im RouteEditor: je Abschnitt eine Zeile „spätestens los um …“, damit man
  // vor Sonnenuntergang ankommt. Rechnet offline (Sonnenstand aus Koordinaten und Datum).
  import { reisen, gesamtStart } from './userdata.js'
  import { heuteTag } from './heute.js'
  import { mitWochentag, zahl } from './format.js'
  import { abschnitte, zusammen, fahrtag, fahrDatum, dauerText, WILDWECHSEL, SCHAETZ_KMH, PUFFER_MIN } from './fahrtag.js'
  import { dauer, klapp } from './motion.js'

  let { r, aktuell = true } = $props()

  const grundDatum = $derived(fahrDatum(r, $reisen, $gesamtStart, $heuteTag))
  const teile = $derived(abschnitte(r, { aktuell }))
  const zeilen = $derived.by(() => {
    const out = teile.map((t) => ({ key: 'a' + t.i, titel: `${t.von} → ${t.nach}`, f: fahrtag(t, t.datum || grundDatum) }))
    if (teile.length > 1) {
      const g = zusammen(teile)
      out.push({ key: 'ganz', titel: t('Ganze Route an einem Tag'), f: fahrtag(g, g.datum || grundDatum), ganz: true })
    }
    return out.filter((z) => z.f)
  })
  const zuLang = $derived(zeilen.filter((z) => !z.ganz && !z.f.reichtLicht).length)
  let offen = $state(null)          // null = nach Lage (offen, wenn etwas zu lang ist)
  const istOffen = $derived(offen ?? zuLang > 0)
  let aufZeile = $state({})

  const ZONE = { 'Australia/Perth': t('WA-Zeit'), 'Australia/Darwin': t('NT-Zeit'), 'Australia/Adelaide': t('SA-Zeit'),
    'Australia/Brisbane': t('QLD-Zeit'), 'Australia/Sydney': t('Ortszeit Ostküste'), 'Australia/Hobart': t('Tasmanien-Zeit') }
  const losZeiten = $derived(zeilen.filter((z) => !z.ganz && z.f.reichtLicht).map((z) => z.f.losText).sort())
  const fruehste = $derived(losZeiten[0])
  const spaeteste = $derived(losZeiten[losZeiten.length - 1])
</script>

{#if zeilen.length}
  <div class="ft" class:warn={zuLang}>
    <button class="ft-kopf" aria-expanded={istOffen} onclick={() => (offen = !istOffen)}>
      <span class="ft-icon" aria-hidden="true">🌅</span>
      <span class="ft-kopf-txt">
        <b>{t('Ankunft vor Sonnenuntergang')}</b>
        <small>{#if zuLang}{tn(zuLang, 'Ein Abschnitt ist im Hellen nicht zu schaffen', '{n} Abschnitte sind im Hellen nicht zu schaffen')}{:else if teile.length === 1}{t('losfahren spätestens {losText}', { losText: zeilen[0].f.losText })}{:else}{t('{length} Abschnitte, spätestens los zwischen {fruehste} und {spaeteste}', { length: teile.length, fruehste, spaeteste })}{/if}</small>
      </span>
      <span class="aufklapp klein" class:offen={istOffen} aria-hidden="true"></span>
    </button>
    {#if istOffen}
      <div class="ft-innen" transition:klapp={{ duration: dauer(220) }}>
        <ul class="ft-liste">
          {#each zeilen as z (z.key)}
            {@const f = z.f}
            <li class:ganz={z.ganz}>
              <button class="ft-zeile" aria-expanded={!!aufZeile[z.key]} onclick={() => (aufZeile[z.key] = !aufZeile[z.key])}>
                <span class="ft-z-txt"><b>{z.titel}</b><small>{zahl(f.km)} km · {dauerText(f.fahrMin)}</small></span>
                <span class="ft-los" class:rot={!f.reichtLicht}>{#if f.reichtLicht}{t('los bis')} <b>{f.losText}</b>{:else}<b>{t('zu lang')}</b>{/if}</span>
                <span class="aufklapp klein" class:offen={aufZeile[z.key]} aria-hidden="true"></span>
              </button>
              {#if aufZeile[z.key]}
                <div class="ft-detail" transition:klapp={{ duration: dauer(200) }}>
                  <p>{t('{mitWochentag}: {dauerText} Fahrt', { mitWochentag: mitWochentag(f.datum), dauerText: dauerText(f.fahrMin) })}{#if f.pausenMin}{t(', {dauerText} Pausen (alle 2 h eine Viertelstunde)', { dauerText: dauerText(f.pausenMin) })}{/if}{t(', {PUFFER_MIN} min Reserve.', { PUFFER_MIN })}</p>
                  <p>{t('Sonnenuntergang am Ziel {untergangText}, richtig dunkel ab {daemmerungText} ({wert}).', { untergangText: f.untergangText, daemmerungText: f.daemmerungText, wert: ZONE[f.tz] || f.tz })}</p>
                  {#if f.reichtLicht}
                    <p>{t('Losfahren spätestens')} <b>{f.losText}</b>.</p>
                  {:else}
                    <p class="ft-rot">{t('Im Hellen nicht zu schaffen: Sonnenaufgang {aufgangText}, dann bleiben bis Sonnenuntergang zu wenig Stunden. Besser auf {teile} Tage aufteilen ({join} km), zum Beispiel mit einem Übernachtungsstopp dazwischen.', { aufgangText: f.aufgangText, teile: f.teile, join: f.kmTeile.map(zahl).join(' + ') })}</p>
                  {/if}
                  {#if f.geschaetzt}<p class="ft-klein">{t('Fahrzeit geschätzt mit {SCHAETZ_KMH} km/h. Genauer, sobald die Straßenroute berechnet ist.', { SCHAETZ_KMH })}</p>{/if}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
        <p class="ft-klein">{t('Tag der Fahrt: {mitWochentag}. Aufenthalte an den Stopps sind nicht eingerechnet.', { mitWochentag: mitWochentag(grundDatum) })}</p>
        <p class="ft-wild"><span aria-hidden="true">🦘</span> {WILDWECHSEL}</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .ft { border: 1px solid var(--line); border-radius: 12px; background: var(--flaeche); overflow: hidden; }
  .ft.warn { border-color: var(--danger-linie); background: var(--danger-flaeche); }
  .ft-kopf { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; padding: 8px 10px 8px 12px; border: none; background: none; cursor: pointer; text-align: left; color: var(--ink); }
  .ft-kopf:active { transform: none; }
  .ft-icon { font-size: calc(18px * var(--schrift, 1)); }
  .ft-kopf-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .ft-kopf-txt b { font-size: calc(13.5px * var(--schrift, 1)); }
  .ft-kopf-txt small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .ft-innen { padding: 0 12px 10px; display: flex; flex-direction: column; gap: 8px; }
  .ft-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .ft-liste li { border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent); }
  .ft-liste li.ganz { border-top-style: dashed; }
  .ft-zeile { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 48px; padding: 4px 0; border: none; background: none; cursor: pointer; text-align: left; color: var(--ink); }
  .ft-zeile:active { transform: none; }
  .ft-z-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .ft-z-txt b { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ft-z-txt small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .ft-los { flex: none; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .ft-los b { color: var(--ink); font-size: calc(14px * var(--schrift, 1)); }
  .ft-los.rot b { color: var(--danger-text); }
  .ft-detail { padding: 0 0 10px; display: flex; flex-direction: column; gap: 4px; }
  .ft-detail p { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--ink); line-height: 1.45; }
  .ft-detail .ft-rot { color: var(--danger-text); }
  .ft-klein { margin: 0; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .ft-wild { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--warn-text); background: var(--warn-flaeche); border-radius: 10px; padding: 8px 10px; line-height: 1.45; }
</style>
