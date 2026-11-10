<script>
  // „Mehr“ aufgeräumt (V31): oben vier Kacheln für unterwegs, darunter kurze Gruppen, „App und Einstellungen“
  // eingeklappt. Dieselbe Übersicht auf der Mehr-Seite und im iPhone-Blatt. Keine Seite fällt weg: Flüge und
  // Packliste stehen eine Ebene tiefer in den Chips ihrer Gruppe (mehr-gruppen.js, NUR_CHIP).
  import { je } from './i18n.js'
  import { uebersicht } from './mehr-gruppen.js'
  import { klapp, dauer } from './motion.js'

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
  {#if unten}{@render unten()}{/if}
  <!-- V34: der gefährliche Knopf (hier App zurücksetzen) klein und grau ganz am Ende, mit Rückfrage (vom Aufrufer) -->
  {#if gefahr}<button class="mu-gefahr" onclick={gefahr.onclick}>{gefahr.label}</button>{/if}
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
  .mu-gefahr { align-self: center; min-height: 44px; margin-top: 6px; padding: 0 10px; border: none; background: none; color: var(--muted); font: inherit; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 500; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
</style>
