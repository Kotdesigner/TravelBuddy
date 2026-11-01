<script>
  import { t, tn } from './i18n.js'
  import { blattRaus, ausblenden } from './motion.js'
  // Suche als Blatt — iPhone: geöffnet über den runden Such-Knopf rechts in der unteren Leiste;
  // das SUCHFELD STEHT UNTEN, direkt über der Tastatur, Treffer darüber (wie in iOS 26:
  // im Daumenbereich besser erreichbar).
  // Mac: Fenster in der Mitte mit Feld oben (wie Spotlight), geöffnet über „Suchen", ⌘K oder „/".
  import { untrack } from 'svelte'
  import { modal } from './modal.js'
  import { reiseDatum } from './reisedatum.js'
  import { sucheOrte } from './suche.js'
  // Neben den Orten durchsucht das Blatt Tage, Tiere, Wanderungen, Buchungen, Etappen, Notizen,
  // Packliste und Vorbereitung (gesamtsuche.js). Orte bleiben oben, mit Etiketten und Kacheln.
  import { gesamtsuche } from './gesamtsuche.js'
  import { journal, wanderungen, buchungen, notizen, reisen, gesamtStart, packliste, vorbereitung, dokumente } from './userdata.js'
  import { etappenMitDatum } from './plan.js'
  import { ARTEN, artVon } from './tierwelt.js'
  import { PACK_VORLAGE } from './packliste-daten.js'
  import { VORBEREITUNG } from './vorbereitung-daten.js'
  import { NOTIZ_TYP } from './notizen-typen.js'
  import { katInfo } from './reisekalender.js'

  let {
    orte = [],
    alleTags = [],
    tagClass = () => '',
    begriff = '',            // Startwert (z. B. aus einem aktiven Kachel-Filter)
    etiketten = [],
    onclose = () => {},
    onwahl = () => {},       // (ort) → zur Kachel springen
    onkacheln = () => {},    // (begriff, etiketten) → als Kachel-Filter übernehmen
    onxoxo = () => {},
    onsnake = () => {},
    onvier = () => {},
    ongeh = () => {},        // (pfad) → zu einem Tag, einer Wanderung, Buchung … springen
  } = $props()

  // Startwerte nur einmal übernehmen — danach gehört die Eingabe dem Blatt.
  let q = $state(untrack(() => begriff))
  let tags = $state(untrack(() => [...etiketten]))
  let eingabe = $state()

  const treffer = $derived(sucheOrte(orte, q, tags))
  const GRENZE = 60
  const sichtbar = $derived(treffer.slice(0, GRENZE))
  const TEXTE = {
    tage: t('Logbuch-Tage'), tiere: t('Tiere'), wanderungen: t('Wanderungen'), buchungen: t('Buchungen und Belege'),
    reisen: t('Etappen und Routen'), notizen: t('Notizen'), packliste: t('Packliste'), vorbereitung: t('Vorbereitung'),
    gesehen: (n, tage) => tn(n, '{n}× gesehen', '{n}× gesehen') + ', ' + tn(tage, 'an {n} Tag', 'an {n} Tagen'),
    nochNicht: t('noch nicht gesehen'), eigeneDokumente: t('Eigene Dokumente'), dokument: t('Dokument'), gueltigBis: t('gültig bis'),
  }
  // Mit Etiketten geht es um Orte; dann nur die Orte
  const weitere = $derived(tags.length ? [] : gesamtsuche(q, {
    journal: $journal, wanderungen: $wanderungen, buchungen: $buchungen, notizen: $notizen, reisen: $reisen,
    etappen: etappenMitDatum($reisen, $gesamtStart), start: $gesamtStart, arten: ARTEN, artVon, katInfo, notizTyp: NOTIZ_TYP,
    packVorlage: PACK_VORLAGE, pack: $packliste, vorbVorlage: VORBEREITUNG, vorb: $vorbereitung, dokumente: $dokumente, texte: TEXTE,
  }))
  const weitereZahl = $derived(weitere.reduce((n, g) => n + g.treffer.length, 0))
  const JE_GRUPPE = 5
  let offeneGruppen = $state(new Set())
  const klappe = (id) => { const s = new Set(offeneGruppen); s.has(id) ? s.delete(id) : s.add(id); offeneGruppen = s }
  const statusText = $derived(
    !q.trim() && !tags.length ? t('Ort, Tag, Tier, Buchung oder Datum eingeben, oder ein Etikett wählen.')
      : treffer.length === 0 && !weitereZahl ? t('Nichts gefunden.')
        : [treffer.length ? tn(treffer.length, '{n} Ort', '{n} Orte') + (treffer.length > GRENZE ? ' (' + t('die ersten {n}', { n: GRENZE }) + ')' : '') : '',
          weitereZahl ? tn(weitereZahl, '{n} weiterer Treffer', '{n} weitere Treffer') : ''].filter(Boolean).join(' · '),
  )
  function springe(ziel) { ongeh(ziel) }

  // Easter-Eggs: „xoxo" → Tic-Tac-Toe, „sn4ke" → Snake, „4444" → Vier in einer Reihe.
  // Bewusst nicht „snake“: das Wort bleibt frei für die Suche nach Schlangen.
  $effect(() => {
    const wort = q.trim().toLowerCase()
    if (wort === 'xoxo') { q = ''; onxoxo() }
    else if (wort === 'sn4ke') { q = ''; onsnake() }
    else if (wort === '4444') { q = ''; onvier() }
  })

  function toggle(t) { tags = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t] }

  // Enter: am Mac den ersten Treffer öffnen; am iPhone nur die Tastatur einklappen —
  // dort erwartet man nach „Suchen" die Liste, keinen Sprung.
  const beruehrung = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
  function absenden(e) {
    e.preventDefault()
    if (!beruehrung && treffer.length) onwahl(treffer[0])
    else if (!beruehrung && weitere.length) springe(weitere[0].treffer[0].ziel)
    else eingabe?.blur()
  }

  // iPhone-Tastatur: das Blatt wird genau auf den SICHTBAREN Bereich gelegt (visualViewport,
  // Safari seit iOS 13). Geht die Tastatur auf, schrumpft der Bereich — das Suchfeld unten
  // sitzt dann direkt auf der Tastatur, statt dahinter zu verschwinden.
  let sicht = $state({ oben: 0, hoehe: 0, tastatur: 0 })
  $effect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const f = () => {
      sicht = { oben: Math.round(vv.offsetTop), hoehe: Math.round(vv.height),
        tastatur: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) }
    }
    vv.addEventListener('resize', f); vv.addEventListener('scroll', f); f()
    return () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f) }
  })
  const tastaturOffen = $derived(sicht.tastatur > 60)
  // Wenig Platz mit Tastatur (Querformat ~150 px, iPhone SE hochkant ~360 px): Etiketten und Griff
  // weg, sonst passt kaum ein Treffer hin. Nach „Suchen" (Tastatur zu) sind sie wieder da.
  const eng = $derived(tastaturOffen && sicht.hoehe > 0 && sicht.hoehe < 400)

  const kurz = (a) => String(a || '').split(':')[0]
</script>

<div class="s-hg" out:ausblenden data-dialog-hg onclick={onclose} aria-hidden="true"></div>
<div class="s-blatt" out:blattRaus class:tastatur={tastaturOffen} class:eng role="dialog" aria-label={t('Suchen')}
  style="--vv-oben:{sicht.oben}px;--vv-hoehe:{sicht.hoehe ? sicht.hoehe + 'px' : '100dvh'}"
  use:modal={{ onclose, fokus: 'input[type=search]', zurueck: '.such-knopf, .nav-suche' }}>
  <div class="s-griff" aria-hidden="true"></div>

  <form class="s-kopf" role="search" onsubmit={absenden}>
    <span class="s-lupe" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>
    </span>
    <input bind:this={eingabe} type="search" bind:value={q} placeholder={t('Ort, Tag, Tier, Buchung, Datum …')}
      enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
      aria-label={t('Suchbegriff')} aria-controls="s-liste" />
    {#if q}
      <button type="button" class="s-leeren" onclick={() => { q = ''; eingabe?.focus() }} aria-label={t('Suchbegriff löschen')}>✕</button>
    {/if}
    <button type="button" class="s-fertig" onclick={onclose}>{t('Fertig')}</button>
  </form>

  <div class="s-tags" role="group" aria-label={t('Nach Kennzeichnung filtern')}>
    {#each alleTags as tag}
      <button type="button" class="s-tag {tagClass(tag)}" class:an={tags.includes(tag)} aria-pressed={tags.includes(tag)}
        onclick={() => toggle(tag)}>{t(tag)}</button>
    {/each}
  </div>

  <p class="s-status" aria-live="polite">{statusText}</p>

  <ul class="s-liste" id="s-liste">
    {#each sichtbar as o (o.id)}
      <li>
        <button type="button" class="s-treffer" onclick={() => onwahl(o)}>
          {#if o.bild || o.img}
            <img src={o.bild || o.img} alt="" loading="lazy" />
          {:else}
            <span class="s-emoji" aria-hidden="true">{o.emoji || '📍'}</span>
          {/if}
          <span class="s-text">
            <b>{o.name}</b>
            <small>{t(o.region)}{o.abschnitt ? ' · ' + kurz(t(o.abschnitt)) : ''}</small>
          </span>
          {#if o.tags?.length}<span class="tagpill {tagClass(o.tags[0])}">{t(o.tags[0])}</span>{/if}
        </button>
      </li>
    {/each}
    {#each weitere as g (g.id)}
      <li class="s-gruppe" aria-label={g.titel}>
        <h3 class="s-gkopf"><span aria-hidden="true">{g.icon}</span> {g.titel} <small>{g.treffer.length}</small></h3>
        <ul class="s-gliste">
          {#each offeneGruppen.has(g.id) ? g.treffer : g.treffer.slice(0, JE_GRUPPE) as x (x.id)}
            <li>
              <button type="button" class="s-treffer" onclick={() => springe(x.ziel)}>
                <span class="s-emoji" aria-hidden="true">{x.icon}</span>
                <span class="s-text"><b>{x.titel}</b>{#if x.unter}<small>{x.unter}</small>{/if}</span>
              </button>
            </li>
          {/each}
        </ul>
        {#if g.treffer.length > JE_GRUPPE}
          <button type="button" class="s-mehr" onclick={() => klappe(g.id)} aria-expanded={offeneGruppen.has(g.id)}>
            {offeneGruppen.has(g.id) ? t('Weniger zeigen') : t('Alle {n} zeigen', { n: g.treffer.length })}
          </button>
        {/if}
      </li>
    {/each}
  </ul>

  <div class="s-fuss">
    <label class="s-datum"><span aria-hidden="true">☀️</span> <span class="s-datum-text">{t('Sonnenzeiten am')}</span> <input type="date" bind:value={$reiseDatum} /></label>
    {#if treffer.length}
      <button type="button" class="s-kacheln" onclick={() => onkacheln(q, tags)}>{t('Alle {length} als Kacheln', { length: treffer.length })}</button>
    {/if}
  </div>
</div>

<style>
  .s-hg {
    position: fixed; inset: 0; z-index: calc(var(--z-sheet) + 1);
    background: rgba(20, 15, 10, 0.45); touch-action: none;
    animation: s-ein var(--t-med) var(--ease-out);
  }
  @keyframes s-ein { from { opacity: 0; } }

  /* iPhone: Blatt über den sichtbaren Bereich (ohne Tastatur), Suchfeld unten */
  .s-blatt {
    --rand-oben: max(44px, calc(env(safe-area-inset-top, 0px) + 8px));
    position: fixed; z-index: calc(var(--z-sheet) + 2);
    left: 0; right: 0; bottom: auto;
    top: calc(var(--vv-oben, 0px) + var(--rand-oben));
    height: calc(var(--vv-hoehe, 100dvh) - var(--rand-oben));
    display: flex; flex-direction: column; min-height: 0;
    background: var(--card); color: var(--ink);
    border-radius: var(--radius-l) var(--radius-l) 0 0;
    box-shadow: var(--shadow-float);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    animation: s-hoch var(--t-slow) var(--ease-spring);
    outline: none;
  }
  @keyframes s-hoch { from { transform: translateY(100%); } }
  .s-griff { width: 38px; height: 5px; border-radius: 3px; background: var(--line-stark); margin: 8px auto 2px; flex: none; }

  .s-kopf { display: flex; align-items: center; gap: 8px; padding: 8px 14px 6px; position: relative; flex: none; }
  .s-lupe { position: absolute; left: 26px; top: 50%; transform: translateY(-50%); color: var(--muted); display: flex; pointer-events: none; }
  .s-kopf input {
    flex: 1; min-width: 0; min-height: 46px;
    /* ≥ 16 px, sonst zoomt Safari beim Antippen ungefragt heran (altes Feld: 14 px) */
    font-size: max(16px, calc(17px * var(--schrift, 1))); padding: 0 40px 0 40px;
    border-radius: 12px; border: 1px solid var(--line-stark);
    background: var(--eingabe); color: var(--ink);
    -webkit-appearance: none; appearance: none;
  }
  .s-kopf input::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }
  .s-leeren {
    position: absolute; right: 100px; top: 50%; transform: translateY(-50%);
    width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
    background: var(--flaeche-2); color: var(--muted); font-size: calc(13px * var(--schrift, 1)); font-weight: 800;
  }
  .s-fertig {
    flex: none; min-height: 44px; min-width: 64px; padding: 0 6px; border: none; background: none; cursor: pointer;
    font-size: calc(16px * var(--schrift, 1)); font-weight: 700; color: var(--brand-text);
  }

  .s-tags { display: flex; gap: 8px; padding: 4px 14px 8px; overflow-x: auto; flex: none; scrollbar-width: none; }
  .s-tags::-webkit-scrollbar { display: none; }
  .s-tag {
    flex: none; min-height: 40px; padding: 0 14px; border-radius: 20px; cursor: pointer;
    font-size: calc(12px * var(--schrift, 1)); font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase;
    border: none; color: #fff;
  }
  /* aus: heller Knopf mit Rahmen in der Etikettfarbe — an: volle Farbe */
  .s-tag:not(.an) { background: var(--card) !important; color: var(--ink); box-shadow: inset 0 0 0 1.5px var(--line-stark); }
  .s-tag.an { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--brand-2); }

  .s-status { margin: 0; padding: 2px 16px 6px; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); flex: none; }

  .s-liste {
    flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
    list-style: none; margin: 0; padding: 0 8px 8px;
  }
  .s-gruppe { margin-top: 10px; }
  .s-gkopf { margin: 6px 4px 4px; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 6px; }
  .s-gkopf small { font-weight: 700; letter-spacing: 0; }
  .s-gliste { list-style: none; margin: 0; padding: 0; }
  .s-mehr { margin: 2px 4px 4px; min-height: 36px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--brand-text); background: none; border: 1px dashed var(--line-stark); border-radius: 10px; padding: 4px 12px; cursor: pointer; }
  .s-treffer {
    width: 100%; display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 8px;
    border: none; background: none; border-radius: 12px; text-align: left; color: var(--ink); cursor: pointer;
  }
  .s-treffer:hover, .s-treffer:focus-visible { background: var(--flaeche-2); }
  .s-treffer:active { background: var(--flaeche-2); }
  .s-treffer img, .s-emoji {
    flex: none; width: 48px; height: 48px; border-radius: 10px; object-fit: cover; background: var(--flaeche-2);
  }
  .s-emoji { display: grid; place-items: center; font-size: calc(24px * var(--schrift, 1)); }
  .s-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .s-text b { font-size: calc(15.5px * var(--schrift, 1)); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s-text small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s-treffer .tagpill { flex: none; }

  .s-fuss {
    flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
    padding: 10px 14px; border-top: 1px solid var(--line); background: var(--flaeche);
  }
  .s-datum { display: inline-flex; align-items: center; gap: 6px; font-size: calc(13px * var(--schrift, 1)); font-weight: 600; color: var(--muted); }
  .s-datum input { font-size: max(16px, calc(16px * var(--schrift, 1))); min-height: 40px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); }
  .s-kacheln {
    min-height: 44px; padding: 0 16px; border-radius: 22px; border: none; cursor: pointer;
    background: var(--brand); color: #fff; font-size: calc(14px * var(--schrift, 1)); font-weight: 700;
  }

  /* iPhone: Reihenfolge wie iOS 26 — Treffer oben, darunter Etiketten, ganz unten das Suchfeld.
     Im Markup steht das Feld zuerst (VoiceOver liest es zuerst), angezeigt wird es unten. */
  @media (max-width: 639px), (max-width: 899px) and (orientation: portrait) {
    .s-griff { order: 0; }
    .s-status { order: 1; padding-top: 6px; }
    .s-liste { order: 2; }
    .s-fuss { order: 3; background: var(--flaeche); border-top: 1px solid var(--line); padding: 8px 14px; flex-wrap: nowrap; }
    /* einzeilig: sichtbar nur ☀️ + Datum, „Sonnenzeiten am" bleibt für VoiceOver */
    .s-datum-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .s-datum input { max-width: 150px; }
    .s-kacheln { white-space: nowrap; }
    .s-tags { order: 4; background: var(--flaeche); padding: 8px 14px 4px; }
    .s-kopf { order: 5; background: var(--flaeche); padding: 6px 12px 10px; }
    /* Tastatur offen: Zeile „Sonnenzeiten / Als Kacheln" weg — mehr Platz für Treffer */
    .s-blatt.tastatur .s-fuss { display: none; }
    .s-blatt.tastatur .s-tags { border-top: 1px solid var(--line); }
    .s-blatt.tastatur { padding-bottom: 0; }
    .s-blatt.eng { --rand-oben: max(6px, env(safe-area-inset-top, 0px)); border-radius: 12px 12px 0 0; }
    .s-blatt.eng .s-griff, .s-blatt.eng .s-tags { display: none; }
    .s-blatt.eng .s-status { padding-top: 4px; padding-bottom: 2px; }
    .s-blatt.eng .s-treffer { min-height: 52px; padding: 4px 8px; }
    .s-blatt.eng .s-treffer img, .s-blatt.eng .s-emoji { width: 40px; height: 40px; }
    .s-blatt.eng .s-kopf { border-top: 1px solid var(--line); padding: 4px 12px 6px; }
  }

  /* Mac / großer Bildschirm: Fenster in der Mitte (wie Spotlight) */
  @media (min-width: 900px), (orientation: landscape) and (min-width: 640px) {
    .s-blatt {
      left: 50%; right: auto; bottom: auto; top: 10vh; height: auto;
      width: min(680px, 92vw); max-height: 76vh;
      transform: translateX(-50%);
      border-radius: var(--radius-l); padding-bottom: 0;
      animation: s-auf var(--t-med) var(--ease-out);
    }
    @keyframes s-auf { from { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.98); } }
    .s-griff { display: none; }
    .s-kopf { padding-top: 14px; }
    .s-tags { flex-wrap: wrap; overflow: visible; }
    .s-liste { min-height: 120px; }
    .s-fuss { border-radius: 0 0 var(--radius-l) var(--radius-l); }
  }
</style>
