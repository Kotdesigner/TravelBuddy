<script>
  import { t, LOCALE, sprache, setzeSprache } from './i18n.js'
  import { ZWEI } from './format.js'
  import { blattRaus, ausblenden } from './motion.js'
  // Mobile Bottom-Tab-Bar (New Style, Phase 1) — Thumb-Zone-Navigation.
  // 5 Tabs: Start · Orte · Roadtrip · Logbuch · Mehr (Bottom-Sheet) — und rechts daneben,
  // abgesetzt, der runde Such-Knopf (wie die Suche in iOS 26). Wunsch Steve 19.09.:
  // „Die Suchfunktion muss nach unten wandern, schnell aktivieren mit einem Knopf unten“.
  // Monochrome SVG-Icons (einfärbbar für Aktiv-Zustand), Glass-Look,
  // Safe-Area unten, gleitender Indikator. Ref: UX-Recherche/05.
  import { online } from './netz.js'
  import { haptic } from './haptik.js'
  import { theme, setzeTheme } from './theme.js'
  import { darstellung, setzeSchrift, setzeGesamt, SCHRIFT, GESAMT } from './darstellung.js'
  const SCHRIFT_NAME = { klein: t('Klein'), standard: t('Standard'), gross: t('Groß'), sehrgross: t('Sehr groß') }
  const GESAMT_NAME = { kompakt: t('Kompakt'), standard: t('Standard'), gross: t('Groß'), sehrgross: t('Sehr groß') }
  import { modal } from './modal.js'
  import { syncZeiten } from './userdata.js'
  const gesichertText = (iso) => { try { return new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) + ', ' + new Date(iso).toLocaleTimeString(LOCALE, { hour: ZWEI, minute: '2-digit' }) } catch { return '' } }

  let {
    aktivTab = 'heute',       // 'heute' | 'plan' | 'orte' | 'logbuch' | 'mehr'
    onTab = () => {},         // (tabId) => öffnet den Bildschirm
    springeZu = () => {},     // (pfad) => z. B. 'mehr/notfall'
    onSuche = () => {},
    onBackup = () => {},
    onImport = () => {},
    onHandbuch = () => {},
    onEinfuehrung = () => {},
  } = $props()

  let sheetOffen = $state(false)

  const TABS = [
    { id: 'heute', label: t('Heute') },
    { id: 'plan', label: t('Plan') },
    { id: 'orte', label: t('Orte') },
    { id: 'logbuch', label: t('Logbuch') },
    { id: 'mehr', label: t('Mehr') },
  ]
  const idx = $derived(Math.max(0, TABS.findIndex((t) => t.id === aktivTab)))

  function tap(t) {
    haptic()
    if (t.id === 'mehr') { sheetOffen = !sheetOffen; return }
    sheetOffen = false
    onTab(t.id)
  }
  function sheetLink(id) { sheetOffen = false; springeZu('mehr/' + id) }

  // iOS öffnet die Tastatur nur, wenn ein Feld IM SELBEN Fingertipp den Fokus bekommt. Das
  // Suchfeld entsteht aber erst danach. Also sofort ein unsichtbares Hilfsfeld fokussieren
  // (Tastatur geht auf) — das echte Suchfeld übernimmt den Fokus einen Augenblick später,
  // die Tastatur bleibt dabei offen. Danach verschwindet das Hilfsfeld wieder.
  function sucheOeffnen() {
    haptic()
    sheetOffen = false
    const hilfe = document.createElement('input')
    hilfe.type = 'text'
    hilfe.setAttribute('aria-hidden', 'true')
    hilfe.setAttribute('data-dialog-hg', '')   // nicht sperren (use:modal) — sonst verlöre es den Fokus und die Tastatur ginge wieder zu
    hilfe.setAttribute('data-hilfsfeld', '')   // use:modal entfernt es, sobald das echte Suchfeld den Fokus hat
    hilfe.tabIndex = -1
    // 16 px Schrift, sonst zoomt Safari beim Fokussieren heran
    hilfe.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;pointer-events:none'
    document.body.appendChild(hilfe)
    try { hilfe.focus({ preventScroll: true }) } catch { hilfe.focus() }
    setTimeout(() => hilfe.remove(), 1500)   // Rückfall, falls das Blatt nicht aufgeht
    onSuche()
  }
  function sheetAktion(fn) { sheetOffen = false; fn() }

  // Swipe-down schließt das Sheet (Geste als Beschleuniger, ✕ bleibt).
  let startY = 0, dragY = $state(0), dragging = $state(false)
  // Wegwischen nur, wenn der Inhalt ganz oben steht; sonst scrollt der Finger im Blatt
  function tStart(e) { if (e.currentTarget.scrollTop > 0) return; startY = e.touches[0].clientY; dragging = true; dragY = 0 }
  function tMove(e) { if (dragging) dragY = Math.max(0, e.touches[0].clientY - startY) }
  function tEnd() {
    if (dragY > 70) sheetOffen = false
    dragging = false; dragY = 0
  }

  const MEHR_SEKTIONEN = [
    { id: 'notfall', icon: '🆘', label: t('Notfall'), info: t('Notrufe, nächste Hilfe, dein Standort'), rot: true },
    { id: 'vorbereitung', icon: '🧳', label: t('Reisevorbereitung'), info: t('Checkliste, Dokumente, Buchungen') },
    { id: 'gefahren', icon: '⚠️', label: t('Gefahrenlage'), info: t('Warnungen zu Feuer, Flut und Hitze') },
    { id: 'packliste', icon: '🎒', label: t('Packliste'), info: t('Zum Abhaken, fürs Outback') },
    { id: 'praxis', icon: '🛠️', label: t('Praxis & Sicherheit'), info: t('Vorab buchen, Permits, Tanken, Reifen') },
    { id: 'musik', icon: '🎵', label: t('Musik unterwegs'), info: t('Sounds of the Road, Musik aus der Gegend') },
    { id: 'teilen', icon: '📤', label: t('Reisebericht teilen'), info: t('Etappen, Routen und Fotos als eine Datei') },
    { id: 'quiz', icon: '🇦🇺', label: t('Australien-Quiz'), info: t('Fragen mit Stufen vom Touri zum Local') },
    // „Vacation (Ostküste)" stand hier noch aus der Zeit vor der Zusammenlegung.
    // Die Ostküste ist jetzt ein Abschnitt unter Orte — der Eintrag führte ins Leere.
  ]
</script>

<nav class="bar" aria-label={t('Hauptnavigation')} data-dialog-hg>
  <div class="tabs">
  <div class="indikator" style="transform: translateX({idx * 100}%)"></div>
  {#each TABS as t (t.id)}
    <button class="tab" class:aktiv={aktivTab === t.id || (t.id === 'mehr' && sheetOffen)}
      onclick={() => tap(t)} aria-label={t.label}
      aria-current={aktivTab === t.id ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        {#if t.id === 'heute'}
          <circle cx="12" cy="12" r="4.2" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
        {:else if t.id === 'orte'}
          <path d="M12 21s-6.6-5.4-6.6-10.4a6.6 6.6 0 1 1 13.2 0C18.6 15.6 12 21 12 21Z" />
          <circle cx="12" cy="10.4" r="2.5" />
        {:else if t.id === 'plan'}
          <circle cx="5.5" cy="18" r="2.4" /><circle cx="18.5" cy="6" r="2.4" />
          <path d="M7.9 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7.1" stroke-dasharray="2.6 2.6" />
        {:else if t.id === 'logbuch'}
          <path d="M5 4.5h11.5a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2v-13Z" />
          <path d="M5 17.5a2 2 0 0 1 2-2h11.5" /><path d="M9 8.5h6" />
        {:else}
          <circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none" />
        {/if}
      </svg>
      <span class="lbl">{t.label}</span>
      {#if t.id === 'mehr'}<span class="dot" class:on={$online} aria-hidden="true"></span>{/if}
    </button>
  {/each}
  </div>
  <button class="such-knopf" onclick={sucheOeffnen} aria-label={t('Suchen')} title={t('Suchen')}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" />
    </svg>
  </button>
</nav>

{#if sheetOffen}
  <div class="backdrop" out:ausblenden data-dialog-hg onclick={() => (sheetOffen = false)} aria-hidden="true"></div>
  <div class="sheet" out:blattRaus class:dragging role="dialog" aria-label={t('Mehr')} tabindex="-1" use:modal={{ onclose: () => (sheetOffen = false) }}
    style="transform: translateY({dragY}px)"
    ontouchstart={tStart} ontouchmove={tMove} ontouchend={tEnd} ontouchcancel={tEnd}>
    <div class="griff" aria-hidden="true"></div>

    <div class="s-liste">
      {#each MEHR_SEKTIONEN as s (s.id)}
        <button class="s-zeile" class:rot={s.rot} onclick={() => sheetLink(s.id)}>
          <span class="s-icon">{s.icon}</span><span class="s-txt">{s.label}<small>{s.info}</small></span>
          <span class="s-chev" aria-hidden="true">›</span>
        </button>
      {/each}
    </div>

    <div class="s-aktionen">
      <button class="s-aktion" onclick={() => sheetAktion(onBackup)}>💾<span>{t('Backup')}</span></button>
      <button class="s-aktion" onclick={() => sheetAktion(onImport)}>📂<span>{t('Import')}</span></button>
      <button class="s-aktion" onclick={() => sheetAktion(onHandbuch)}>📖<span>{t('Handbuch')}</span></button>
    </div>

    <div class="s-theme">
      <span class="st-lbl">{t('🌓 Design')}</span>
      <div class="segment">
        {#each [['auto', t('Auto')], ['hell', t('Hell')], ['dunkel', t('Dunkel')]] as [m, l]}
          <button class:an={$theme === m} onclick={() => { setzeTheme(m); haptic() }}>{l}</button>
        {/each}
      </div>
    </div>

    <div class="s-theme">
      <span class="st-lbl">{t('🌐 Sprache')}</span>
      <div class="segment">
        {#each [['de', 'Deutsch'], ['en', 'English']] as [s, l]}
          <button class:an={sprache === s} lang={s} onclick={() => { haptic(); setzeSprache(s) }}>{l}</button>
        {/each}
      </div>
    </div>

    <!-- V7: Schrift (nur Texte) und Gesamtgröße (alles), je Gerät gemerkt (darstellung.js) -->
    <div class="s-stufen">
      <span class="st-lbl">{t('🔠 Schrift')}</span>
      <div class="segment s-vier" role="group" aria-label={t('Schriftgröße')}>
        {#each SCHRIFT as s (s.id)}<button class:an={$darstellung.schrift === s.id} aria-pressed={$darstellung.schrift === s.id} onclick={() => { setzeSchrift(s.id); haptic() }}>{SCHRIFT_NAME[s.id]}</button>{/each}
      </div>
    </div>
    <div class="s-stufen">
      <span class="st-lbl">{t('🔍 Gesamtgröße')}</span>
      <div class="segment s-vier" role="group" aria-label={t('Gesamtgröße')}>
        {#each GESAMT as s (s.id)}<button class:an={$darstellung.gesamt === s.id} aria-pressed={$darstellung.gesamt === s.id} onclick={() => { setzeGesamt(s.id); haptic() }}>{GESAMT_NAME[s.id]}</button>{/each}
      </div>
    </div>

    <div class="s-status">
      <span class="dot gross" class:on={$online}></span>{$online ? t('Online') : t('Offline. Alles Wichtige ist auf dem Gerät gespeichert.')}
    </div>
    <div class="s-status s-backup">
      {#if $syncZeiten.gesichert}{t('Letztes Backup von diesem Gerät: {gesichertText}', { gesichertText: gesichertText($syncZeiten.gesichert) })}{:else}{t('Von diesem Gerät gibt es noch kein Backup.')}{/if}
    </div>
    <!-- Basic: statt „Startdaten laden“ die Einführung vom ersten Öffnen noch einmal -->
    <button class="s-einf" onclick={() => sheetAktion(onEinfuehrung)}>🧭 {t('Einführung noch einmal')}</button>
  </div>
{/if}

<style>
  /* ---------- Bar ----------
     Schwebende Leiste aus „Glas“ (Stil iOS 26): zwei Kapseln über dem Inhalt, der darunter
     durchscheint. Ohne backdrop-filter fast deckend. Tippflächen bleiben 56 px hoch. */
  .bar {
    position: fixed; z-index: var(--z-bar);
    left: max(10px, env(safe-area-inset-left, 0px)); right: max(10px, env(safe-area-inset-right, 0px));
    bottom: max(10px, calc(env(safe-area-inset-bottom, 0px) - 4px));
    display: flex; align-items: center; gap: 10px; pointer-events: none;
  }
  .tabs, .such-knopf {
    pointer-events: auto;
    background: color-mix(in srgb, var(--card) 84%, transparent);
    -webkit-backdrop-filter: blur(20px) saturate(1.7);
    backdrop-filter: blur(20px) saturate(1.7);
    border: 1px solid color-mix(in srgb, var(--line-stark) 55%, transparent);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 10px 30px rgba(60, 38, 18, 0.16), 0 2px 6px rgba(60, 38, 18, 0.08);
  }
  :global([data-theme='dark']) .tabs, :global([data-theme='dark']) .such-knopf {
    background: color-mix(in srgb, var(--card) 86%, transparent);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 10px 30px rgba(0, 0, 0, 0.45);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .tabs, .such-knopf { background: var(--card); }
  }
  .tabs { flex: 1; display: flex; position: relative; min-width: 0; border-radius: 32px; padding: 4px; }
  /* Runder Such-Knopf, abgesetzt rechts: 64 px, also über Apples 44 pt */
  .such-knopf {
    flex: none; width: 64px; height: 64px; border-radius: 50%;
    display: grid; place-items: center; cursor: pointer; color: var(--ink);
  }
  .such-knopf svg { width: 24px; height: 24px; }
  .such-knopf:active { transform: scale(0.94); }
  .tab {
    flex: 1; min-height: 56px; padding: 6px 2px 5px; z-index: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    background: none; border: none; cursor: pointer; position: relative; border-radius: 28px;
    color: var(--muted); transition: color var(--t-med) var(--ease-out), transform var(--t-feder) var(--ease-federnd);
  }
  .tab.aktiv { color: var(--brand-text); }
  .tab svg { width: 24px; height: 24px; }
  /* Beschriftung der Leiste wächst nicht mit (wie bei iOS): sonst stoßen fünf Wörter aneinander. Kleiner geht. */
  .tab .lbl { font-size: min(11px, calc(11px * var(--schrift, 1))); font-weight: 700; letter-spacing: 0.01em; }
  /* Die aktive Kapsel gleitet federnd zum gewählten Reiter */
  .indikator {
    position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / 5);
    pointer-events: none;
    transition: transform var(--t-feder) var(--ease-federnd);
  }
  .indikator::after {
    content: ''; position: absolute; inset: 0; border-radius: 28px;
    background: color-mix(in srgb, var(--brand) 13%, transparent);
  }
  :global([data-theme='dark']) .indikator::after { background: color-mix(in srgb, var(--brand-text) 18%, transparent); }
  .dot {
    position: absolute; top: 6px; right: calc(50% - 17px);
    width: 7px; height: 7px; border-radius: 50%; background: #b9b0a2;
  }
  .dot.on { background: var(--ok); }

  /* ---------- Sheet ---------- */
  .backdrop {
    position: fixed; inset: 0; z-index: calc(var(--z-sheet) - 1);
    background: rgba(20, 15, 10, 0.4);
    animation: fadein var(--t-med) var(--ease-out);
  }
  @keyframes fadein { from { opacity: 0; } }
  .sheet {
    position: fixed; left: 0; right: 0; z-index: var(--z-sheet);
    bottom: 0; padding: 6px 14px calc(14px + 60px + env(safe-area-inset-bottom, 0px));
    /* Nie höher als der sichtbare Bereich: im Safari-Tab des iPhone 17 Pro ragte das Blatt
       oben 9 pt hinaus, auf kleineren iPhones und quer wären Notfall & Co. unerreichbar
       gewesen (15.10.2026). Passt es nicht, scrollt der Inhalt. */
    max-height: calc(100dvh - max(env(safe-area-inset-top, 0px), 10px) - 6px);
    overflow-y: auto; overscroll-behavior: contain;
    background: var(--card); border-radius: var(--radius-l) var(--radius-l) 0 0;
    box-shadow: var(--shadow-float);
    animation: hoch var(--t-slow) var(--ease-spring);
    transition: transform var(--t-fast) var(--ease-out);
  }
  .sheet.dragging { transition: none; }
  @keyframes hoch { from { transform: translateY(100%); } }
  .griff { width: 38px; height: 4px; border-radius: 2px; background: var(--line); margin: 6px auto 10px; }

  .s-liste { display: flex; flex-direction: column; }
  .s-zeile {
    display: flex; align-items: center; gap: 12px; width: 100%;
    min-height: 54px; padding: 5px 6px; border: none; background: none; cursor: pointer;
    font-size: calc(15px * var(--schrift, 1)); font-weight: 600; color: var(--ink); text-align: left;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 55%, transparent);
    border-radius: var(--radius-s);
  }
  .s-zeile:active { background: var(--flaeche-2); }
  .s-zeile.rot { color: var(--danger); font-weight: 800; }
  .s-icon { font-size: calc(19px * var(--schrift, 1)); width: 26px; text-align: center; }
  .s-txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
  .s-txt small { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 500; color: var(--muted); }
  .s-zeile.rot .s-txt small { font-weight: 500; }
  .s-zeile { animation: rein-unten var(--t-slow) var(--ease-out) backwards; }
  .s-zeile:nth-child(2) { animation-delay: 25ms; } .s-zeile:nth-child(3) { animation-delay: 50ms; }
  .s-zeile:nth-child(4) { animation-delay: 75ms; } .s-zeile:nth-child(5) { animation-delay: 100ms; }
  .s-zeile:nth-child(6) { animation-delay: 125ms; } .s-zeile:nth-child(7) { animation-delay: 150ms; }
  .s-chev { margin-left: auto; color: var(--muted); font-size: calc(18px * var(--schrift, 1)); }

  .s-backup { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .s-aktionen { display: flex; gap: 8px; margin-top: 12px; }
  .s-einf { display: block; width: 100%; min-height: 44px; margin-top: 18px; padding: 8px 12px; border: 1px dashed var(--line-stark); border-radius: 12px; background: none; color: var(--brand-text); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; text-align: left; cursor: pointer; }
  .s-aktion {
    flex: 1; min-height: 58px; border: 1px solid var(--line); border-radius: var(--radius-m);
    background: var(--bg); cursor: pointer; font-size: calc(19px * var(--schrift, 1));
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  }
  .s-aktion span { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .s-aktion:active { background: var(--flaeche-2); }

  .s-stufen { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
  .s-vier { display: grid; grid-template-columns: repeat(4, 1fr); }
  .s-vier button { padding: 8px 4px; }
  .s-theme { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; }
  .st-lbl { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--ink); }

  .s-status {
    display: flex; align-items: center; gap: 8px; margin-top: 12px;
    font-size: calc(12px * var(--schrift, 1)); font-weight: 600; color: var(--muted);
  }
  .dot.gross { position: static; width: 9px; height: 9px; }
</style>
