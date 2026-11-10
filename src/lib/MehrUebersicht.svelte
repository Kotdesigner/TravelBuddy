<script>
  // „Mehr“ aufgeräumt (V31): oben vier Kacheln für unterwegs, darunter kurze Gruppen, „App und Einstellungen“
  // eingeklappt. Dieselbe Übersicht auf der Mehr-Seite und im iPhone-Blatt. Keine Seite fällt weg: Flüge und
  // Packliste stehen eine Ebene tiefer in den Chips ihrer Gruppe (mehr-gruppen.js, NUR_CHIP).
  import { je } from './i18n.js'
  import { uebersicht } from './mehr-gruppen.js'
  import { klapp, dauer } from './motion.js'
  import { PAYPAL } from './spenden.js'

  /**
   * eintraege: [{ id, icon, label, info, rot }] aus mehr-eintraege.js
   * app: [{ icon, label, info, onclick }] zusätzlich unter „App und Einstellungen“ (Backup, Design, …)
   * gefahr: { label, onclick } ganz unten in App, abgesetzt (Werkseinstellungen), optional
   */
  let { eintraege = [], app = [], gefahr = null, onwahl = () => {}, unten = null } = $props()

  const KEY = 'tb-mehr-app-offen'
  let appOffen = $state((() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })())
  function umschalten() { appOffen = !appOffen; try { localStorage.setItem(KEY, appOffen ? '1' : '0') } catch {} }

  const teile = $derived(uebersicht(eintraege, (e) => e.id))
</script>

<div class="mu">
  <div class="mu-kacheln">
    {#each teile.kacheln as e (e.id)}
      <button class="mu-kachel" class:rot={e.rot} onclick={() => onwahl(e.id)}>
        <span class="mu-k-icon" aria-hidden="true">{e.icon}</span>
        <b>{e.label}</b><small>{e.info}</small>
      </button>
    {/each}
  </div>

  {#each teile.gruppen as { gruppe, eintraege: liste } (gruppe.id)}
    {#if gruppe.id === 'app'}
      <div class="mu-app">
        <button class="mu-app-kopf" aria-expanded={appOffen} aria-controls="mu-app-liste" onclick={umschalten}>
          <span class="mu-icon" aria-hidden="true">{gruppe.icon}</span>
          <span class="mu-txt"><b>{je(...gruppe.titel)}</b><small>{[...app.map((a) => a.label), ...liste.map((e) => e.label)].join(', ')}</small></span>
          <span class="aufklapp klein" class:offen={appOffen} aria-hidden="true"></span>
        </button>
        {#if appOffen}
          <div class="mu-app-liste" id="mu-app-liste" transition:klapp={{ duration: dauer(200) }}>
            {#each app as a (a.label)}
              <button class="mu-zeile" onclick={a.onclick}><span class="mu-icon" aria-hidden="true">{a.icon}</span><span class="mu-txt">{a.label}{#if a.info}<small>{a.info}</small>{/if}</span><span class="mu-chev" aria-hidden="true">›</span></button>
            {/each}
            {#each liste as e (e.id)}
              <button class="mu-zeile" onclick={() => onwahl(e.id)}><span class="mu-icon" aria-hidden="true">{e.icon}</span><span class="mu-txt">{e.label}<small>{e.info}</small></span><span class="mu-chev" aria-hidden="true">›</span></button>
            {/each}
            {#if gefahr}<button class="mu-gefahr" onclick={gefahr.onclick}>{gefahr.label}</button>{/if}
          </div>
        {/if}
      </div>
    {:else}
      <h3 class="mu-gruppe">{je(...gruppe.titel)}</h3>
      {#if gruppe.zeile}
        <div class="mu-reihe">
          {#each liste as e (e.id)}
            <button class="mu-klein" onclick={() => onwahl(e.id)} title={e.info}><span class="mu-k-icon" aria-hidden="true">{e.icon}</span><span>{e.label}</span></button>
          {/each}
        </div>
      {:else}
        <div class="mu-liste">
          {#each liste as e (e.id)}
            <button class="mu-zeile" onclick={() => onwahl(e.id)}><span class="mu-icon" aria-hidden="true">{e.icon}</span><span class="mu-txt">{e.label}<small>{e.info}</small></span><span class="mu-chev" aria-hidden="true">›</span></button>
          {/each}
        </div>
      {/if}
    {/if}
  {/each}
  <!-- V33: Spenden über PayPal. Ganz unten, freundlich, ohne zu drängeln. Auf der Mehr-Seite und im iPhone-Blatt. -->
  <div class="mu-spende">
    <span class="mu-icon" aria-hidden="true">☕</span>
    <span class="mu-txt"><b>{je('Dir gefällt TravelBuddy?', 'Enjoying TravelBuddy?')}</b><small>{je('Die App ist kostenlos und ohne Werbung. Wenn du etwas zurückgeben möchtest, freue ich mich über eine kleine Spende.', 'The app is free and has no ads. If you would like to give something back, a small donation is very welcome.')}</small></span>
    <a class="btn mu-spende-knopf" href={PAYPAL} target="_blank" rel="noopener noreferrer">{je('Mit PayPal spenden', 'Donate with PayPal')} ↗</a>
  </div>
  <p class="mu-spende-k">{je('Freiwillig und ohne Gegenleistung, eine Spendenquittung gibt es nicht. Öffnet PayPal.', 'Voluntary and nothing in return, there is no tax receipt. Opens PayPal.')}</p>
  {#if unten}{@render unten()}{/if}
</div>

<style>
  .mu { display: flex; flex-direction: column; gap: 8px; max-width: 1040px; }
  .mu-kacheln { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  @media (min-width: 900px) { .mu-kacheln { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
  .mu-kachel { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 92px; padding: 12px; text-align: left; cursor: pointer;
    border: 1px solid var(--line); border-radius: var(--radius-l, 14px); background: var(--card); color: var(--ink); font: inherit; }
  .mu-kachel b { font-size: calc(15px * var(--schrift, 1)); }
  .mu-kachel small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.35; }
  .mu-k-icon { font-size: calc(22px * var(--schrift, 1)); line-height: 1; margin-bottom: 4px; }
  .mu-kachel.rot { background: var(--danger-flaeche); border-color: var(--danger-linie); }
  .mu-kachel.rot b, .mu-kachel.rot small { color: var(--danger-text, var(--ink)); }
  .mu-gruppe { margin: 10px 0 0; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .mu-liste, .mu-app { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--radius-l, 14px); background: var(--card); overflow: hidden; }
  .mu-zeile, .mu-app-kopf { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; padding: 8px 14px; border: none; border-top: 1px solid var(--line);
    background: none; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
  .mu-liste .mu-zeile:first-child, .mu-app-kopf { border-top: none; }
  .mu-icon { width: 24px; flex: none; text-align: center; font-size: calc(18px * var(--schrift, 1)); }
  .mu-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: calc(15px * var(--schrift, 1)); font-weight: 700; }
  .mu-txt small { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 500; color: var(--muted); }
  .mu-chev { color: var(--muted); font-size: calc(20px * var(--schrift, 1)); }
  .mu-reihe { display: flex; gap: 8px; flex-wrap: wrap; }
  .mu-klein { flex: 1 1 0; min-width: 90px; min-height: 64px; padding: 8px 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; text-align: center; line-height: 1.2; border: 1px solid var(--line); border-radius: var(--radius-m, 10px); background: var(--card);
    color: var(--ink); font: inherit; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .mu-klein .mu-k-icon { margin: 0; font-size: calc(18px * var(--schrift, 1)); }
  .mu-app { margin-top: 10px; }
  .mu-app-liste { display: flex; flex-direction: column; }
  .mu-gefahr { margin: 10px 14px 14px; min-height: 44px; border: 1px solid var(--danger-linie); border-radius: var(--radius-m, 10px); background: none;
    color: var(--danger-text, var(--ink)); font: inherit; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .mu-spende { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; align-items: center; margin-top: 10px; padding: 12px 14px;
    border: 1px dashed var(--line-stark); border-radius: var(--radius-l, 14px); background: var(--card); }
  .mu-spende .mu-txt b { font-size: calc(15px * var(--schrift, 1)); }
  .mu-spende-knopf { grid-column: 1 / -1; min-height: 48px; display: flex; align-items: center; justify-content: center; text-decoration: none; margin-top: 6px; }
  @media (min-width: 700px) { .mu-spende { grid-template-columns: auto minmax(0, 1fr) auto; } .mu-spende-knopf { grid-column: auto; margin-top: 0; padding: 0 18px; } }
  .mu-spende-k { margin: 2px 4px 0; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
</style>
