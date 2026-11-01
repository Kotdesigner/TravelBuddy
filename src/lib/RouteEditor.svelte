<script>
  import { t, je, tn } from './i18n.js'
  import { kurzZeit } from './format.js'
  // Eine Strecke bearbeiten: Stopps per Suche hinzufügen, per Griff umsortieren,
  // Route, Tank-Lücken, Sehenswertes und Wetter an der Strecke.
  // Die Rechnungen selbst laufen in routen-dienst.js — hier nur Anzeige und Bedienung.
  import { updateReise, stopHinzufuegen } from './userdata.js'
  import { online } from './netz.js'
  import { schriftAuf } from './kontrast.js'
  import { baueVorschau } from './minikarte.js'
  import { luftlinieKm, stopsSignatur, fahrzeitText, stimmigeLegs } from './routing.js'
  import { stoppEinfuegen } from './routenhinweise.js'
  import { warnungenAnRoute } from './warnungen.js'
  import { sortierbar, verschiebe } from './sortierbar.js'
  import { haptic } from './haptik.js'
  import Stepper from './Stepper.svelte'
  import OrtWahl from './OrtWahl.svelte'
  import Fahrtag from './Fahrtag.svelte'
  import { dauer, klapp } from './motion.js'
  import { rechnet, routeMsg, hinweise, wetter, reichweite, routeRechnen, setArt, tankNeu, wetterPruefen,
    veraltet, artVon, gerade, tagText } from './routen-dienst.js'
  import VerkehrBlock from './VerkehrBlock.svelte'
  import { lage } from './warnlage-dienst.js'
  import { zahl } from './format.js'

  let { r, orte = [], reisen = [], warnungen = [], umkreisKm = 150 } = $props()
  // Vorschläge an der Strecke: zugeklappt, damit die Route nicht endlos lang wird
  let vorschlaegeOffen = $state(false)
  const bildVon = (o) => o?.bildData || (o?.bild ? '/' + String(o.bild).replace(/^\//, '') : o?.img || null)
  const namenText = (vs) => {
    const n = vs.map((v) => v.ort.name)
    return n.length <= 2 ? n.join(t(' und ')) : t('{a}, {b} und {n} weitere', { a: n[0], b: n[1], n: n.length - 2 })
  }

  const st = $derived(r.stops || [])
  const h = $derived($hinweise[r.id])
  const w = $derived($wetter[r.id])
  const alt = $derived(veraltet(r))
  let meldung = $state('')
  let aktivStopp = $state(-1)   // angetippter Stopp zeigt Foto und Entfernen
  let mTimer
  function melde(t) { meldung = t; clearTimeout(mTimer); mTimer = setTimeout(() => (meldung = ''), 5000) }

  function stoppDazu(o) {
    const { nach } = stopHinzufuegen(r.id, o)
    haptic()
    melde(nach ? t('✓ {name} nach „{nach}“ eingefügt', { name: o.name, nach }) : t('✓ {name} als Start eingefügt', { name: o.name }))
  }
  function vorschlagDazu(v) {
    updateReise(r.id, { stops: stoppEinfuegen(r.stops, v.nachStopp, v.ort) })
    melde(t('✓ {name} nach „{wert}“ eingefügt. Die Route wird neu berechnet{wert2}.', { name: v.ort.name, wert: (r.stops[v.nachStopp] || {}).name || t('Start'), wert2: $online ? '' : t(', sobald Netz da ist') }))
  }
  const nichtVorschlagen = (id) => updateReise(r.id, { nichtVorschlagen: [...new Set([...(r.nichtVorschlagen || []), id])] })
  const setStops = (neu) => updateReise(r.id, { stops: neu })
  function entfernen(i) { setStops(st.filter((_, k) => k !== i)); melde(t('{name} entfernt', { name: st[i].name })) }
  function addImg(i, e) {
    const f = e.target.files && e.target.files[0]; if (!f) return
    const rd = new FileReader()
    rd.onload = (ev) => setStops(st.map((x, k) => (k === i ? { ...x, img: ev.target.result } : x)))
    rd.readAsDataURL(f); e.target.value = ''
  }

  // Etappen-km je Stopp (Distanz vom vorherigen) — nur wenn die Route aktuell ist.
  // Stimmig gerundet: zusammen genau die km im Kopf der Route (runden.js).
  const legMap = $derived.by(() => {
    const legs = stimmigeLegs(r.route)
    if (!legs || !legs.length || alt) return {}
    const res = {}
    let j = -1
    for (let i = 0; i < st.length; i++) {
      if (st[i].lat == null) continue
      j++
      if (j >= 1 && legs[j - 1]) res[i] = legs[j - 1].km
    }
    return res
  })

  function openMaps() {
    const use = st.slice(0, 11)
    if (use.length < 2) return
    const c = (s) => encodeURIComponent(s.lat != null ? s.lat + ',' + s.lon : s.name + ', Australia')
    let url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + c(use[0]) + '&destination=' + c(use[use.length - 1])
    if (use.length > 2) url += '&waypoints=' + use.slice(1, -1).map(c).join('%7C')
    window.open(url, '_blank')
  }

  const vorschau = $derived.by(() => {
    const p = st.filter((x) => x.lat != null)
    if (!p.length) return null
    const geo = r.route?.geometry
    const punkte = geo && geo.length > 1 && r.route.sig === stopsSignatur(r.stops) ? geo : p.map((x) => [x.lon, x.lat])
    return baueVorschau(punkte, p.map((x) => [x.lon, x.lat]))
  })
  const routeLage = $derived($lage.routen.find((x) => x.id === r.id) || null)
  const routenWarnungen = $derived(routeLage?.treffer ?? (r.route?.geometry && warnungen?.length ? warnungenAnRoute(warnungen, r.route.geometry, umkreisKm) : []))
  const tagKlasse = (t) => 'tag-' + String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const kurz = kurzZeit
</script>

<div class="re">
  <div class="re-haupt">
    <div class="segment re-art" role="group" aria-label={t('Verkehrsmittel')}>
      <button class:an={artVon(r) === 'auto'} aria-pressed={artVon(r) === 'auto'} onclick={() => setArt(r, 'auto')}>{t('🚗 Auto')}</button>
      <button class:an={artVon(r) === 'flug'} aria-pressed={artVon(r) === 'flug'} onclick={() => setArt(r, 'flug')}>{t('✈️ Flug')}</button>
      <button class:an={artVon(r) === 'bahn'} aria-pressed={artVon(r) === 'bahn'} onclick={() => setArt(r, 'bahn')}>{t('🚆 Bahn')}</button>
      <button class:an={artVon(r) === 'boot'} aria-pressed={artVon(r) === 'boot'} onclick={() => setArt(r, 'boot')}>{t('⛵ Schippern')}</button>
    </div>
    <label class="re-film"><input type="checkbox" checked={r.imFilm !== false} onchange={(e) => updateReise(r.id, { imFilm: e.currentTarget.checked })} /><span>{je('Im Animationsfilm', 'In the animated film')}</span></label>
    {#if gerade(r) && artVon(r) !== 'boot'}<VerkehrBlock art={artVon(r)} terminId={r.terminId} titel={r.name} onverknuepft={(id) => updateReise(r.id, { terminId: id })} />{/if}

    {#if st.length}
      <ol class="stops" use:sortierbar={{ onbewege: (a, b) => setStops(verschiebe(st, a, b)) }} aria-label={t('Stopps')}>
        {#each st as s, i (s.name + '|' + i)}
          <li data-zeile>
            <button class="griff" data-griff aria-label={t('{name} verschieben (Pfeiltasten)', { name: s.name })} title={t('Ziehen zum Umsortieren')}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            </button>
            <span class="nr" style="background:{r.farbe};color:{schriftAuf(r.farbe || '#7a3b1e')}">{i + 1}</span>
            <button class="snm" aria-expanded={aktivStopp === i} onclick={() => (aktivStopp = aktivStopp === i ? -1 : i)}>
              <span class="s-name">{s.name}{#if s.img} <span aria-label={t('mit Foto')}>🖼</span>{/if}</span>
              {#if legMap[i] != null}<span class="leg">{t('{wert} km ab {name}', { wert: legMap[i], name: st[i - 1]?.name })}</span>{/if}
              {#if s.lat == null}<span class="ohne">{t('ohne Kartenpunkt')}</span>{/if}
            </button>
            {#if aktivStopp === i}
              <span class="s-akt">
                <label class="ic" title={t('Foto zum Stopp')}>📷<input type="file" accept="image/*" onchange={(e) => addImg(i, e)} aria-label={t('Foto für {name}', { name: s.name })} /></label>
                <button class="ic weg" onclick={() => { entfernen(i); aktivStopp = -1 }} aria-label={t('{name} entfernen', { name: s.name })}>✕</button>
              </span>
            {/if}
          </li>
        {/each}
      </ol>
    {:else}
      <p class="re-leer">{t('Noch keine Stopps. Such den ersten Ort, zum Beispiel deinen Startpunkt.')}</p>
    {/if}

    <div class="re-dazu">
      <span class="re-lbl">{t('Stopp hinzufügen')}</span>
      <OrtWahl {orte} {reisen} platzhalter="Ort, Nationalpark, Stadt …" label={t('Stopp suchen')} onwahl={stoppDazu} />
      <p class="re-tipp">{t('Neue Stopps kommen an die Stelle mit dem kleinsten Umweg. Am Griff ≡ lässt sich die Reihenfolge ändern.')}</p>
    </div>
    {#if meldung}<div class="hw-ok" role="status">{meldung}</div>{/if}

    <!-- Strecke -->
    <div class="route">
      {#if r.route && !alt}
        <div class="r-stats">
          <span class="r-km">{artVon(r) === 'boot' ? '⛵' : r.route.flug ? '✈️' : '🛣️'} {r.route.km} km</span>
          <span>⏱️ {fahrzeitText(r.route.dauerMin)}</span>
          {#if r.route.tank}
            {@const maxL = h?.tank?.maxLuecke ?? r.route.tank.maxLuecke}
            <span class="r-tank" class:warn={maxL > $reichweite}>{t('⛽ längste Strecke ohne Tankstelle {maxL} km', { maxL })}</span>
          {/if}
        </div>
        {@const tk = h?.tank}
        {#if tk?.luecken.length}
          {@const zuLang = tk.luecken.some((l) => l.ueberReichweite)}
          <details class="r-hw" class:rot={zuLang} open={zuLang}>
            <summary>{tn(tk.luecken.length, '⛽ {n} lange Strecke ohne Tankstelle · längste {maxLuecke} km', '⛽ {n} lange Strecken ohne Tankstelle · längste {maxLuecke} km', { maxLuecke: tk.maxLuecke })}</summary>
            <ul class="hw-liste">
              {#each tk.luecken as l}<li class:rot={l.ueberReichweite}><b>{l.laenge} km</b> <span>{l.von} → {l.bis}</span></li>{/each}
            </ul>
            <p class="hw-tipp">{#if zuLang}{t('🔴 Länger als deine Reichweite ({reichweite} km). Reservekanister oder einen Umweg über eine Tankstelle planen.', { reichweite: $reichweite })} {/if}{t('Vor jeder dieser Strecken volltanken. Tankstellen aus OpenStreetMap, höchstens 5 km neben der Route.')}</p>
          </details>
        {:else if h?.ohneTankdaten}
          <div class="r-hint">{t('⛽ Für diese Gegend sind keine Tankstellen gespeichert (nur WA, Raum Melbourne, Cairns, Whitsundays).')}</div>
        {/if}
        {#if h?.vorschlaege.length}
          <div class="r-hw r-vor">
            <button class="vor-kopf" aria-expanded={vorschlaegeOffen} onclick={() => { vorschlaegeOffen = !vorschlaegeOffen; haptic() }}>
              <span class="vor-vorschau" aria-hidden="true">
                {#each h.vorschlaege.slice(0, 3) as v (v.ort.id)}
                  {@const b = bildVon(v.ort)}
                  {#if b}<img src={b} alt="" loading="lazy" />{:else}<span class="vor-leer">📍</span>{/if}
                {/each}
              </span>
              <span class="vor-txt">
                <b>{tn(h.vorschlaege.length, '{n} sehenswerter Ort nahe der Route', '{n} sehenswerte Orte nahe der Route')}</b>
                <small>{namenText(h.vorschlaege)}</small>
              </span>
              <span class="aufklapp klein" class:offen={vorschlaegeOffen} aria-hidden="true"></span>
            </button>
            {#if vorschlaegeOffen}
              <ul class="hw-liste vor-liste" transition:klapp={{ duration: dauer(240) }}>
                {#each h.vorschlaege as v (v.ort.id)}
                  {@const b = bildVon(v.ort)}
                  <li class="hw-vorschlag">
                    {#if b}<img class="hw-bild" src={b} alt="" loading="lazy" />{:else}<span class="hw-bild hw-bild-leer" aria-hidden="true">📍</span>{/if}
                    <span class="hw-ort">
                      <b>{v.ort.name}</b>{#if v.ort.tags?.[0]} <span class="tagpill {tagKlasse(v.ort.tags[0])}">{t(v.ort.tags[0])}</span>{/if}
                      <small>{t('{abstand} km neben der Route · passt nach „{wert}“', { abstand: v.abstand, wert: r.stops[v.nachStopp]?.name || t('Start') })}</small>
                    </span>
                    <button class="btn hw-dazu" onclick={() => vorschlagDazu(v)} aria-label={t('{name} als Stopp einfügen', { name: v.ort.name })}>+<span class="hw-dazu-txt"> {t('Stopp')}</span></button>
                    <button class="hw-x" onclick={() => nichtVorschlagen(v.ort.id)} aria-label={t('{name} nicht mehr vorschlagen', { name: v.ort.name })} title={t('nicht mehr vorschlagen')}>✕</button>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
        {#if (r.nichtVorschlagen || []).length}
          <button class="hw-link" onclick={() => updateReise(r.id, { nichtVorschlagen: [] })}>{tn(r.nichtVorschlagen.length, '1 ausgeblendeten Vorschlag wieder zeigen', '{n} ausgeblendete Vorschläge wieder zeigen')}</button>
        {/if}
        {#if !r.route.flug}
          <div class="r-wetter">
            {#if w?.laedt}
              <span>{t('🌦️ Wetter an der Strecke wird geprüft …')}</span>
            {:else if w?.fehler}
              <span>🌦️ {w.fehler}</span>
            {:else if w?.stand}
              {#if w.treffer.length}
                <div class="hw-titel">{t('🌦️ Wetter an der Strecke, nächste 3 Tage')}</div>
                <ul class="hw-liste">
                  {#each w.treffer.slice(0, 8) as tr}
                    <li class="st{tr.stufe}">{tr.icon} <b>{tr.text}</b>: {tr.name} ({tagText(tr.tag)})</li>
                  {/each}
                </ul>
              {:else}
                <span>{t('🌦️ Keine Wetter-Gefahren an der Strecke in den nächsten 3 Tagen ({punkte} Punkte geprüft).', { punkte: w.punkte })}</span>
              {/if}
              <span class="hw-stand">{t('Stand {kurz}', { kurz: kurz(w.stand) })}</span>
            {/if}
            {#if !w?.laedt}
              <button class="btn hw-btn" onclick={() => wetterPruefen(r, orte)} disabled={!$online}>
                {w?.stand ? t('↻ Wetter neu prüfen') : t('🌦️ Wetter an der Strecke prüfen')}{$online ? '' : t(' (braucht Netz)')}
              </button>
            {/if}
          </div>
        {/if}
        {#if routenWarnungen.length}
          <div class="r-gefahr">{tn(routenWarnungen.length, '⚠️ {n} amtliche Warnung auf der Route:', '⚠️ {n} amtliche Warnungen auf der Route:')}
            {#each routenWarnungen as x}<div class="rg-w"><span class="rg-stufe" style="background:{x.farbe};color:{schriftAuf(x.farbe)}">{x.icon} {x.level}</span> {x.titel}<small class="rg-km">{routeLage?.aufRoute ? (x.kmBis < 10 ? t('Direkt vor dir') : t('In etwa {km} km voraus', { km: zahl(Math.round(x.kmBis / 10) * 10) })) : t('Nach etwa {km} km Strecke', { km: zahl(Math.round(x.kmBis / 10) * 10) })}{#if x.km > 0}&nbsp;· {t('{km} km neben der Strecke', { km: zahl(Math.round(x.km)) })}{/if}</small></div>{/each}
          </div>
        {/if}
        <div class="r-fuss">{t('berechnet {kurz} · {wert}', { kurz: kurz(r.route.berechnetAm), wert: r.route.flug ? t('Flugstrecke (Luftlinie, Zeit geschätzt)') : t('Straßenroute (OSRM)') })}</div>
      {:else if alt}
        <div class="r-stats"><span class="r-km">🛣️ {r.route.km} km</span><span class="rm-alt">{t('Stopps geändert, wird neu berechnet{wert}', { wert: $online ? '' : t(', sobald Netz da ist') })}</span></div>
      {:else if st.filter((s) => s.lat != null).length >= 2}
        <div class="r-hint">{t('🛣️ etwa {luftlinieKm} km Luftlinie{wert}', { luftlinieKm: luftlinieKm(r.stops), wert: $online ? t(', Straßenroute wird berechnet …') : t('. Echte km und Fahrzeit, sobald Netz da ist.') })}</div>
      {/if}

      <!-- Fahrtag-Planer: spätestens losfahren, um vor Sonnenuntergang anzukommen -->
      {#if !gerade(r) && st.filter((s) => s.lat != null).length >= 2}
        <Fahrtag {r} aktuell={!alt} />
      {/if}

      <div class="r-ctrl">
        <button class="btn" onclick={openMaps} disabled={st.length < 2}>{t('📍 In Google Maps öffnen')}</button>
        <button class="btn" onclick={() => routeRechnen(r)} disabled={!$online || $rechnet[r.id] || st.filter((s) => s.lat != null).length < 2}>
          {$rechnet[r.id] ? t('rechnet …') : (r.route ? t('🔄 Neu berechnen') : t('🛣️ Route berechnen'))}
        </button>
        {#if !gerade(r)}
          <span class="reich">⛽ <Stepper value={$reichweite} min={50} max={2000} step={50} einheit="km Reichweite" label={t('Reichweite pro Tankfüllung in km')}
            onchange={(v) => { reichweite.set(v); tankNeu(r) }} /></span>
        {/if}
      </div>
      {#if $routeMsg[r.id]}<div class="r-fehler">{$routeMsg[r.id]}</div>{/if}
    </div>
  </div>

  {#if vorschau}
    <div class="preview" aria-hidden="true">
      <svg viewBox="0 0 152 226" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="152" height="226" fill="var(--info-flaeche)" rx="8" />
        {#each vorschau.land as d}<path {d} fill="var(--flaeche)" stroke="var(--line-stark)" stroke-width="1" />{/each}
        {#if vorschau.linie}<polyline points={vorschau.linie} fill="none" stroke={r.farbe} stroke-width="2.2"
          stroke-linejoin="round" stroke-linecap="round" stroke-dasharray={gerade(r) ? '5 4' : null} />{/if}
        {#each vorschau.punkte as p, i}
          <circle cx={p[0]} cy={p[1]} r="3.4" fill={r.farbe} stroke="#fff" stroke-width="0.9" />
          <text x={p[0]} y={p[1] + 1.5} font-size={i >= 9 ? 3.4 : 4.2} font-weight="bold" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">{i + 1}</text>
        {/each}
      </svg>
    </div>
  {/if}
</div>

<style>
  .re-film { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: calc(14px * var(--schrift, 1)); font-weight: 600; cursor: pointer; }
  .re-film input { width: 20px; height: 20px; accent-color: var(--brand); }
  .re { display: flex; flex-wrap: wrap; gap: 18px; }
  .re-haupt { flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
  .preview { flex: 0 0 220px; }
  .preview svg { width: 100%; height: auto; display: block; }
  @media (max-width: 620px) { .preview { flex: 1 1 100%; max-width: 260px; margin: 0 auto; } }
  .re-art { align-self: flex-start; }
  .rg-km { display: block; font-size: calc(12.5px * var(--schrift, 1)); opacity: 0.85; }

  .stops { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .stops li {
    display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 4px 4px 4px 0;
    background: var(--card); border-radius: 12px; transition: transform 160ms var(--ease-out), box-shadow 160ms;
    touch-action: pan-y;
  }
  :global(.beim-ziehen) li { transition: transform 160ms var(--ease-out); }
  :global(li.wird-gezogen) { z-index: 3; position: relative; box-shadow: var(--shadow-float); transition: none !important; background: var(--card) !important; }
  .griff {
    width: 44px; height: 44px; flex: none; border: none; background: none; color: var(--muted);
    display: inline-flex; align-items: center; justify-content: center; cursor: grab; border-radius: 10px; touch-action: none;
  }
  .griff:active { cursor: grabbing; transform: none; }
  .nr { flex: none; width: 26px; height: 26px; border-radius: 50%; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
  .snm { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; background: none; border: none; padding: 4px 0; text-align: left; cursor: pointer; color: inherit; min-height: 44px; justify-content: center; }
  .snm:active { transform: none; }
  .s-akt { display: inline-flex; gap: 6px; flex: none; }
  .s-name { font-size: calc(15px * var(--schrift, 1)); font-weight: 600; color: var(--ink); }
  .leg { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .ohne { font-size: calc(12px * var(--schrift, 1)); color: var(--danger-text); }
  .ic {
    width: 44px; height: 44px; flex: none; border: 1px solid var(--line); background: var(--card); border-radius: 12px;
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: calc(15px * var(--schrift, 1)); color: var(--btn-ink);
  }
  .ic input { display: none; }
  .ic.weg { color: var(--danger-text); }
  .re-leer { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); background: var(--flaeche); border-radius: 12px; padding: 12px 14px; }
  .re-dazu { display: flex; flex-direction: column; gap: 6px; }
  .re-lbl { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .re-tipp { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }

  .route { display: flex; flex-direction: column; gap: 6px; padding-top: 12px; border-top: 1px solid var(--line); }
  .r-stats { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; color: var(--ink); }
  .r-km { color: var(--brand-text); }
  .r-tank { color: var(--ok-text); } .r-tank.warn { color: var(--danger-text); }
  .r-gefahr { font-size: calc(13px * var(--schrift, 1)); color: var(--ink); background: var(--danger-flaeche); border: 1px solid var(--danger-linie); border-radius: 10px; padding: 8px 10px; }
  .rg-w { margin-top: 4px; }
  .rg-stufe { display: inline-block; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; padding: 1px 7px; border-radius: 8px; }
  .r-fuss { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .rm-alt { color: var(--warn-text); font-weight: 600; font-size: calc(13px * var(--schrift, 1)); }
  .r-hint { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .r-ctrl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
  .r-ctrl .btn { min-height: 44px; }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .reich { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .r-fehler { font-size: calc(13px * var(--schrift, 1)); color: var(--danger-text); }
  .r-hw { border: 1px solid var(--line); border-radius: 12px; background: var(--flaeche); }
  .r-hw.rot { border-color: var(--danger-linie); background: var(--danger-flaeche); }
  .r-hw summary { cursor: pointer; padding: 10px 12px; min-height: 44px; display: flex; align-items: center; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); list-style-position: inside; }
  .hw-liste { list-style: none; margin: 0; padding: 0 12px 8px; display: flex; flex-direction: column; gap: 6px; }
  .hw-liste li { font-size: calc(13px * var(--schrift, 1)); color: var(--ink); line-height: 1.4; }
  .hw-liste li.rot b, .hw-liste li.st3 b, .hw-liste li.st2 b { color: var(--danger-text); }
  .hw-tipp { margin: 0; padding: 0 12px 10px; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .hw-vorschlag { display: flex; align-items: center; gap: 8px; }
  .r-vor { overflow: hidden; }
  .vor-kopf { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 8px 10px 8px 12px; border: none; background: none; cursor: pointer; text-align: left; color: var(--ink); }
  .vor-kopf:active { transform: none; background: var(--flaeche-2); }
  /* Drei kleine Bilder übereinander gefächert: zeigt schon zugeklappt, was einen erwartet */
  .vor-vorschau { flex: none; display: flex; }
  .vor-vorschau img, .vor-leer { width: 30px; height: 30px; border-radius: 8px; object-fit: cover; border: 2px solid var(--card); background: var(--flaeche-2); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18); }
  .vor-vorschau > :not(:first-child) { margin-left: -12px; }
  .vor-leer { display: grid; place-items: center; font-size: calc(14px * var(--schrift, 1)); }
  .vor-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .vor-txt b { font-size: calc(13.5px * var(--schrift, 1)); }
  .vor-txt small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vor-liste { padding-top: 2px; }
  .vor-liste .hw-vorschlag { padding: 6px 0; border-top: 1px solid color-mix(in srgb, var(--line) 60%, transparent); }
  /* iPhone: „+“ ohne Wort, damit der Name nicht in drei Zeilen bricht */
  @media (max-width: 600px) {
    .vor-liste .hw-dazu { width: 44px; padding: 0; justify-content: center; font-size: calc(20px * var(--schrift, 1)); border-radius: 50%; }
    .vor-liste .hw-dazu-txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .vor-liste .hw-ort small { font-size: calc(12px * var(--schrift, 1)); }
  }
  .hw-bild { flex: none; width: 40px; height: 40px; border-radius: 9px; object-fit: cover; background: var(--flaeche-2); }
  .hw-bild-leer { display: grid; place-items: center; font-size: calc(18px * var(--schrift, 1)); }
  .hw-ort { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .hw-ort b { font-size: calc(14px * var(--schrift, 1)); }
  .hw-ort small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .hw-ort .tagpill { align-self: flex-start; }
  .hw-dazu { flex: none; min-height: 44px; padding: 0 12px; }
  .hw-x { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line); background: var(--card); color: var(--muted); cursor: pointer; font-size: calc(14px * var(--schrift, 1)); }
  .hw-link { align-self: flex-start; background: none; border: none; padding: 6px 0; min-height: 36px; color: var(--brand-text); font-weight: 700; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; }
  .r-wetter { display: flex; flex-direction: column; gap: 6px; font-size: calc(13px * var(--schrift, 1)); color: var(--ink); }
  .r-wetter .hw-liste { padding: 0; }
  .hw-titel { font-weight: 700; font-size: calc(13.5px * var(--schrift, 1)); }
  .hw-stand { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .hw-btn { align-self: flex-start; min-height: 44px; }
  .hw-ok { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); background: var(--ok-flaeche); border: 1px solid var(--ok-linie); border-radius: 10px; padding: 10px 12px; }
</style>
