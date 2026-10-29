<script>
  import { t, LOCALE, tn } from './i18n.js'
  import { ZWEI, dezimal, zahl } from './format.js'
  import { STUFE_FARBE } from './gefahren.js'
  import { schriftAuf } from './kontrast.js'
  import { online } from './netz.js'
  import Strassenlage from './Strassenlage.svelte'
  import { aktualisiereStrassenlage } from './strassenlage-dienst.js'

  let { standort = null, laden = false, fehler = null, stand = null, ausCache = false, betroffene = [],
    warnungen = [], betroffeneWarnungen = [], onRefresh,
    umkreisKm = $bindable(150), bedingungen = [], quellenFehler = [],
    meinOrt = null, ortStatus = 'bereit', ortText = '', onOrt, orte = [] } = $props()

  // „Aktualisieren“ holt auch die Straßenlage neu (eigene Quelle, eigener Speicher).
  function aktualisieren() {
    onRefresh?.()
    aktualisiereStrassenlage({ erzwingen: true })
  }

  const STAAT = { WA: t('Westaustralien'), VIC: t('Victoria'), QLD: t('Queensland') }
  const kmText = (km) => (km == null ? '' : km < 1 ? t('hier') : km < 10 ? dezimal(km, 1) + ' km' : zahl(km) + ' km')

  const stufeText = { 1: t('erhöht'), 2: 'hoch', 3: 'extrem' }
  const fmtZeit = (z) => { try { return new Date(z).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: ZWEI, minute: '2-digit' }) } catch { return '' } }

  // Lange Listen: erst 3 zeigen, Rest ausklappbar
  const ZEIGE = 3
  let warnAlle = $state(false)
  let stdAlle = $state(false)
  let betrAlle = $state(false)
</script>

<div class="gefahren">
  <div class="kopf">
    <div class="titel">{t('⚠️ Gefahrenlage')}</div>
    <button class="btn" onclick={aktualisieren} disabled={laden || !$online}>
      {laden ? t('prüfe …') : t('↻ Aktualisieren')}
    </button>
  </div>

  <div class="ort-zeile">
    {#if meinOrt}
      <span class="oz-ok">{t('📍 Standort aktiv · {toFixed}, {toFixed2}', { toFixed: meinOrt.lat.toFixed(3), toFixed2: meinOrt.lon.toFixed(3) })}
        {#if meinOrt.genauigkeit}<span class="oz-gen">±{meinOrt.genauigkeit} m</span>{/if}</span>
      <button class="oz-btn" onclick={onOrt} disabled={ortStatus === 'laeuft'}>{t('↻ neu bestimmen')}</button>
      <!-- Die letzte bekannte Position bleibt stehen (besser als nichts), aber ein
           fehlgeschlagener Versuch darf nicht stumm verschwinden. -->
      {#if ortStatus === 'verweigert' || ortStatus === 'fehler'}
        <span class="oz-hinweis warn">⚠︎ {ortText}</span>
      {/if}
    {:else if ortStatus === 'laeuft'}
      <span class="oz-lauf">{t('📍 Standort wird ermittelt …')}</span>
    {:else}
      <span class="oz-hinweis">📍 {ortText || t('Kein Standort')}</span>
      {#if ortStatus === 'bereit' || ortStatus === 'fehler' || ortStatus === 'verweigert'}
        <button class="oz-btn" onclick={onOrt}>{t('Standort freigeben')}</button>
      {/if}
    {/if}
  </div>

  {#if ausCache}
    <div class="cache-banner">📴 <b>{t('Letzter bekannter Stand')}</b>{#if stand}&nbsp;{t('von {stand}', { stand })}{/if}{#if !$online}&nbsp;{t('· offline')}{/if}{t('. Kann veraltet sein.')} {#if $online}{t('„Aktualisieren“ holt die aktuelle Lage.')}{/if}</div>
  {/if}
  {#if !$online && !stand}
    <p class="offline">{t('🌐 Noch kein Stand geladen. Online „Aktualisieren“ tippen. Danach ist der letzte Stand auch offline sichtbar.')}</p>
  {:else if fehler}
    <p class="fehler">{fehler}</p>
  {/if}

  <!-- Waldbrandgefahr / Feuerverbot / Hitze (Victoria) -->
  {#if bedingungen.length}
    <div class="bedingungen">
      {#each bedingungen as b}
        <div class="bed"><b>{b.titel}</b> · {b.distrikt}: <span class="bed-wert">{b.wert}</span></div>
      {/each}
      <div class="bed-fuss">{t('Waldbrandstufe und Feuerverbot gelten für ganz Victoria-Distrikte (VicEmergency). Kinglake und Melbourne liegen im Distrikt')} <b>{t('Central')}</b>.</div>
    </div>
  {/if}

  <!-- Amtliche Warnungen: WA + VIC + QLD -->
  <div class="amtlich">
    <div class="s-titel">{t('🚨 Amtliche Warnungen für WA, Victoria und Queensland')}</div>

    <div class="umkreis">
      <label for="umk">{t('Umkreis um meine Orte und Routen')}</label>
      <input id="umk" type="range" min="0" max="300" step="25" bind:value={umkreisKm} />
      <span class="umk-wert">{umkreisKm === 0 ? t('nur direkt betroffen') : umkreisKm + ' km'}</span>
    </div>

    {#if quellenFehler.length}
      <div class="q-fehler">{t('⚠️ Nicht erreichbar: {join}. Die übrigen Quellen sind aktuell.', { join: quellenFehler.join(', ') })}</div>
    {/if}

    {#if warnungen.length === 0}
      <div class="ok">{t('✓ Keine aktiven Warnungen in WA, Victoria oder Queensland (oder noch nicht geladen).')}</div>
    {:else}
      {#if betroffeneWarnungen.length}
        <div class="betroffen-box">⚠️ <b>{t('{length} Ort(e) deiner Liste im Umkreis:', { length: betroffeneWarnungen.length })}</b>
          {#each betroffeneWarnungen as b}
            <div class="bo-z">{b.warnung.icon} <b>{b.name}</b>: {b.warnung.level}{#if b.warnung.km != null}&nbsp;· {b.warnung.km < 1 ? t('direkt betroffen') : t('{km} entfernt', { km: kmText(b.warnung.km) })}{/if}</div>
          {/each}
        </div>
      {/if}
      <div class="w-liste">
        {#each (warnAlle ? warnungen : warnungen.slice(0, ZEIGE)) as w}
          <div class="w-karte" style="border-left:5px solid {w.farbe}">
            <div class="w-kopf">
              <span class="w-level" style="background:{w.farbe};color:{schriftAuf(w.farbe)}">{w.icon} {w.level}</span>
              <span class="w-staat">{STAAT[w.staat] || w.staat}</span>
              <span class="w-event">{w.event}</span>
              {#if w.km != null && w.km < Infinity}<span class="w-km">{w.km < 1 ? t('📍 an einem deiner Orte') : t('{km} vom nächsten Ort', { km: kmText(w.km) })}</span>{/if}
              <span class="w-zeit">{fmtZeit(w.zeit)}</span>
            </div>
            <div class="w-titel">{w.titel}</div>
            {#if w.ort}<div class="w-ort">📍 {w.ort.slice(0, 160)}</div>{/if}
            {#if w.text}<div class="w-text">{w.text}</div>{/if}
          </div>
        {/each}
      </div>
      {#if warnungen.length > ZEIGE}
        <button class="mehr" onclick={() => (warnAlle = !warnAlle)}>
          {warnAlle ? t('▲ weniger anzeigen') : tn(warnungen.length - ZEIGE, '▼ {n} weitere Warnung anzeigen', '▼ {n} weitere Warnungen anzeigen')}
        </button>
      {/if}
      <div class="w-quellen">
        <a href="https://www.emergency.wa.gov.au/" target="_blank" rel="noopener">{t('emergency.wa.gov.au ↗')}</a>
        <a href="https://emergency.vic.gov.au/respond/" target="_blank" rel="noopener">{t('emergency.vic.gov.au ↗')}</a>
        <a href="https://www.qld.gov.au/emergency" target="_blank" rel="noopener">{t('qld.gov.au/emergency ↗')}</a>
      </div>
    {/if}
  </div>

  <!-- Straßenlage WA (Main Roads WA): eigene Kategorie, eigene Zählung -->
  <Strassenlage {orte} {meinOrt} {umkreisKm} />

  <p class="disclaimer">{t('Amtliche Warnungen: DFES (WA), VicEmergency (VIC), Queensland Fire Department (QLD). Straßenlage: Main Roads WA. Der Wetter-Teil unten sind')} <b>{t('abgeleitete Indikatoren')}</b>{t(', keine Warnungen. Diese App ersetzt keine amtliche Warn-App. In der Feuersaison zusätzlich Emergency+, EmergencyWA und VicEmergency nutzen.')}</p>

  <!-- Aktueller Standort + Umkreis ~100 km -->
  <div class="standort">
    <div class="s-titel">{t('📍 Dein Standort & ~100 km Umkreis')}</div>
    {#if standort == null}
      <p class="hint">{t('Standort noch nicht geprüft. „Aktualisieren" tippen (fragt nach GPS-Freigabe).')}</p>
    {:else if standort.stufe === 0}
      <div class="ok">{t('✓ Keine wetterbedingten Gefahren erkannt.')}</div>
    {:else}
      <div class="liste">
        {#each (stdAlle ? standort.gefahren : standort.gefahren.slice(0, ZEIGE)) as g}
          <div class="g-zeile" style="border-left:4px solid {STUFE_FARBE[g.stufe]}">
            <span class="g-icon">{g.icon}</span>
            <span class="g-text"><b>{g.typ}:</b> {g.text}</span>
            <span class="g-stufe" style="background:{STUFE_FARBE[g.stufe]};color:{schriftAuf(STUFE_FARBE[g.stufe])}">{stufeText[g.stufe]}</span>
          </div>
        {/each}
      </div>
      {#if standort.gefahren.length > ZEIGE}
        <button class="mehr" onclick={() => (stdAlle = !stdAlle)}>
          {stdAlle ? t('▲ weniger anzeigen') : t('▼ {wert} weitere anzeigen', { wert: standort.gefahren.length - ZEIGE })}
        </button>
      {/if}
    {/if}
  </div>

  <!-- Betroffene Orte aus meiner Liste -->
  {#if betroffene.length}
    <div class="orte">
      <div class="s-titel">{t('Betroffene Orte deiner Liste ({length})', { length: betroffene.length })}</div>
      {#each (betrAlle ? betroffene : betroffene.slice(0, ZEIGE)) as b}
        <div class="o-zeile">
          <span class="o-badge" style="background:{STUFE_FARBE[b.stufe]}">{b.gefahren[0]?.icon}</span>
          <span class="o-name">{b.name}</span>
          <span class="o-info">{b.gefahren.map((g) => g.typ).join(', ')}</span>
        </div>
      {/each}
      {#if betroffene.length > ZEIGE}
        <button class="mehr" onclick={() => (betrAlle = !betrAlle)}>
          {betrAlle ? t('▲ weniger anzeigen') : t('▼ {wert} weitere anzeigen', { wert: betroffene.length - ZEIGE })}
        </button>
      {/if}
    </div>
  {/if}

  {#if stand}<div class="stand">{t('Stand: {stand}', { stand })}</div>{/if}
</div>

<style>
  .gefahren { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
  .kopf { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .titel { font-size: calc(17px * var(--schrift, 1)); font-weight: 800; color: var(--danger-text); }
  .btn { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 7px 12px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; }
  .btn:disabled { opacity: 0.4; }
  .offline, .fehler { font-size: calc(13px * var(--schrift, 1)); padding: 8px 0; }
  .fehler { color: var(--danger-text); }
  .cache-banner { background: var(--info-flaeche); border: 1px solid var(--info-linie); color: var(--info-text); font-size: calc(12.5px * var(--schrift, 1)); padding: 8px 12px; border-radius: 8px; margin: 8px 0; }
  .disclaimer { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); background: var(--flaeche); padding: 8px 10px; border-radius: 8px; margin: 8px 0; }
  .s-titel { font-size: calc(14px * var(--schrift, 1)); font-weight: 700; color: var(--ink); margin: 10px 0 6px; }
  .hint { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); margin: 0; }
  .ok { font-size: calc(13.5px * var(--schrift, 1)); color: var(--ok-text); background: var(--ok-flaeche); padding: 8px 12px; border-radius: 8px; }
  .liste, .orte { display: flex; flex-direction: column; gap: 6px; }
  .g-zeile { display: flex; align-items: center; gap: 8px; background: var(--eingabe); border: 1px solid var(--line); padding: 8px 10px; border-radius: 6px; }
  .g-icon { font-size: calc(18px * var(--schrift, 1)); }
  .g-text { flex: 1; font-size: calc(13px * var(--schrift, 1)); }
  .g-stufe { color: #fff; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; }
  .o-zeile { display: flex; align-items: center; gap: 8px; font-size: calc(13px * var(--schrift, 1)); padding: 4px 0; }
  .o-badge { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: calc(12px * var(--schrift, 1)); flex: 0 0 auto; }
  .o-name { font-weight: 600; }
  .o-info { color: var(--muted); font-size: calc(12px * var(--schrift, 1)); }
  .stand { margin-top: 10px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }

  .amtlich { margin-top: 8px; }
  .betroffen-box { background: var(--danger-flaeche); border: 1px solid var(--danger-linie); color: var(--danger-text); font-size: calc(13px * var(--schrift, 1)); padding: 9px 12px; border-radius: 8px; margin-bottom: 10px; }
  .w-liste { display: flex; flex-direction: column; gap: 8px; }
  .w-karte { background: var(--eingabe); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
  .w-kopf { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .w-level { color: #fff; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; padding: 2px 9px; border-radius: 10px; }
  .w-event { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); }
  .w-zeit { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-left: auto; }
  .w-titel { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 600; margin-top: 5px; color: var(--ink); }
  .w-ort { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-top: 3px; }
  .w-text { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); margin-top: 5px; line-height: 1.5; }
  .w-quelle { display: inline-block; margin-top: 10px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--info-text); }
  .mehr {
    display: block; width: 100%; margin-top: 8px; padding: 8px 12px; cursor: pointer;
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); text-align: center;
    background: var(--flaeche); border: 1px dashed var(--line-stark); border-radius: 8px;
  }
  .mehr:hover { background: var(--flaeche-2); border-color: var(--muted); }
.umkreis{display:flex;align-items:center;gap:.6rem;margin:.5rem 0 .7rem;font-size:.82rem;flex-wrap:wrap}
.umkreis label{opacity:.8}
.umkreis input{flex:1;min-width:130px;height:32px;accent-color:var(--danger)}
.umk-wert{font-weight:700;min-width:5.5rem;text-align:right}
.q-fehler{background:var(--warn-flaeche);color:var(--warn-text);border-radius:8px;padding:.45rem .6rem;font-size:.78rem;margin-bottom:.5rem}
.bedingungen{background:var(--warn-flaeche);border:1px solid var(--danger-linie);color:var(--warn-text);border-radius:10px;padding:.6rem .7rem;margin-bottom:.7rem}
.bed{font-size:.85rem;margin:.15rem 0}
.bed-wert{font-weight:800;color: var(--danger-text)}
.bed-fuss{font-size:.74rem;opacity:.75;margin-top:.35rem}
.bo-z{margin:.2rem 0;font-size:.84rem}
.w-staat{font-size:.72rem;opacity:.7;border:1px solid currentColor;border-radius:5px;padding:0 .3rem}
.w-quellen{display:flex;gap:.8rem;flex-wrap:wrap;font-size:.78rem;margin-top:.5rem}
.w-km{font-size:.74rem;font-weight:700;opacity:.85}
.ort-zeile { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: .6rem; font-size: calc(12.5px * var(--schrift, 1)); }
.oz-ok { color: var(--ok-text); font-weight: 700; }
.oz-gen { opacity: .7; font-weight: 600; margin-left: 3px; }
.oz-lauf { color: var(--brand-text); font-weight: 700; }
.oz-hinweis { color: var(--muted); flex: 1; min-width: 160px; }
.oz-hinweis.warn { color: var(--warn-text); font-weight: 600; width: 100%; flex: none; }
.oz-btn { padding: 4px 10px; border: 1px solid var(--brand); background: none; color: var(--brand-text); border-radius: 13px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
.oz-btn:disabled { opacity: .5; }
</style>
