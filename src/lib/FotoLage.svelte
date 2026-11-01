<script>
  // Fotolage auf der Startseite. Die Kopfzeile sagt sofort, ob es sich hier lohnt, aufgeklappt
  // steht alles, was man für die Planung vor Ort braucht.
  import { je, LOCALE } from './i18n.js'
  import { dauer, klapp } from './motion.js'
  import { meinePosition } from './warnlage-dienst.js'
  import { online } from './netz.js'
  import { zeitzoneFuer } from './sonne.js'
  import { fotoLage, holeHimmel, naechsteMilchstrasse, richtung, stadtLicht } from './foto-lage.js'

  let { ersatz = null } = $props()   // { lat, lon, name }, wenn kein Standort vorliegt

  const ort = $derived($meinePosition ? { ...$meinePosition, name: '' } : ersatz)
  let jetzt = $state(new Date()), wetter = $state(null), auf = $state(false), ziel = $state(undefined)

  $effect(() => { const u = setInterval(() => (jetzt = new Date()), 300000); return () => clearInterval(u) })
  $effect(() => {
    const o = ort, netz = $online
    if (!o || !netz) return
    let aktuell = true
    holeHimmel(o.lat, o.lon).then((w) => { if (aktuell && w) wetter = w })
    return () => { aktuell = false }
  })
  const l = $derived(ort ? fotoLage(ort.lat, ort.lon, jetzt, wetter) : null)
  const tz = $derived(ort && stadtLicht(ort.lat, ort.lon) ? zeitzoneFuer(ort.lat, ort.lon) : undefined)
  $effect(() => { if (auf && ort && ziel === undefined) ziel = naechsteMilchstrasse(ort.lat, ort.lon, jetzt) })

  const uhr = (d) => (d instanceof Date && !isNaN(d) ? d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: tz }) : '')
  const bis = (a, b) => (uhr(a) && uhr(b) ? je(`${uhr(a)} bis ${uhr(b)}`, `${uhr(a)} to ${uhr(b)}`) : je('heute nicht', 'not today'))
  const tag = (d) => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', timeZone: tz })
  const pz = (w) => `${Math.round(w)} %`
  const NAME = { top: () => je('Sehr gut', 'Excellent'), gut: () => je('Gut', 'Good'), maessig: () => je('Mäßig', 'Fair'), schlecht: () => je('Ungünstig', 'Poor') }

  const kopf = $derived.by(() => {
    if (!l) return ''
    const h = l.fokus === 'milchstrasse' || l.fokus === 'sterne' ? l.himmelNacht : l.himmelLicht
    const teil = []
    if (l.fokus === 'milchstrasse') teil.push(`${je('Milchstraße', 'Milky Way')} ${bis(l.f.mw.von, l.f.mw.bis)}`)
    else if (l.fokus === 'sterne') teil.push(`${je('Sterne', 'Stars')} ${bis(l.f.frei.von, l.f.frei.bis)}`)
    else if (l.fokus === 'mond') teil.push(je('Heute Nacht zu hell', 'Too bright tonight'))
    else teil.push(`${je('Goldene Stunde', 'Golden hour')} ${bis(l.licht[l.fokus].goldVon, l.licht[l.fokus].goldBis)}`)
    if (h?.wolken != null) teil.push(`${je('Wolken', 'Clouds')} ${pz(h.wolken)}`)
    teil.push(`${je('Mond', 'Moon')} ${l.mond.prozent} %`)
    return teil.join(' · ')
  })
  const stadtText = $derived(!l?.stadt ? je('Keine Angabe für diese Gegend', 'No data for this area')
    : l.stadt.stufe === 2 ? je(`Stark, ${l.stadt.stadt} ${l.stadt.km} km`, `Strong, ${l.stadt.stadt} ${l.stadt.km} km`)
    : l.stadt.stufe === 1 ? je(`Spürbar, ${l.stadt.stadt} ${l.stadt.km} km`, `Noticeable, ${l.stadt.stadt} ${l.stadt.km} km`)
    : je('Keine größere Stadt in der Nähe', 'No large town nearby'))
</script>

{#if l}
  <section class="fl">
    <button class="fl-kopf" aria-expanded={auf} onclick={() => (auf = !auf)}>
      <span class="fl-oben"><b>{je('Fotolage', 'Photo conditions')}{#if ort.name}&nbsp;· {ort.name}{/if}</b><span class="fl-stufe {l.stufe}">{NAME[l.stufe]()}</span></span>
      <span class="fl-kurz">{kopf}</span>
      <span class="fl-pfeil" class:auf aria-hidden="true">›</span>
    </button>
    {#if auf}
      <div class="fl-mehr" transition:klapp={{ duration: dauer(220) }}>
        <div class="bedien-block">
          <span class="bedien-titel">{je('Licht', 'Light')}</span>
          <dl>
            <dt>{je('Blaue Stunde morgens', 'Morning blue hour')}</dt><dd>{bis(l.licht.morgen.blauVon, l.licht.morgen.goldVon)}</dd>
            <dt>{je('Goldene Stunde morgens', 'Morning golden hour')}</dt><dd>{bis(l.licht.morgen.goldVon, l.licht.morgen.goldBis)}, {je('Sonne aus', 'sun from')} {richtung(l.licht.morgen.richtung)}</dd>
            <dt>{je('Goldene Stunde abends', 'Evening golden hour')}</dt><dd>{bis(l.licht.abend.goldVon, l.licht.abend.goldBis)}, {je('Sonne im', 'sun in the')} {richtung(l.licht.abend.richtung)}</dd>
            <dt>{je('Blaue Stunde abends', 'Evening blue hour')}</dt><dd>{bis(l.licht.abend.goldBis, l.licht.abend.blauBis)}</dd>
            <dt>{je('Sonne jetzt', 'Sun now')}</dt><dd>{l.licht.jetzt.hoehe > 0 ? `${Math.round(l.licht.jetzt.hoehe)}° ${je('hoch im', 'high in the')} ${richtung(l.licht.jetzt.richtung)}` : je('unter dem Horizont', 'below the horizon')}</dd>
          </dl>
        </div>
        <div class="bedien-block">
          <span class="bedien-titel">{je('Nacht', 'Night')}</span>
          <dl>
            <dt>{je('Ganz dunkel', 'Fully dark')}</dt><dd>{l.f.dunkel ? bis(l.f.dunkel.von, l.f.dunkel.bis) : je('heute nicht', 'not tonight')}</dd>
            <dt>{je('Mond', 'Moon')}</dt><dd>{l.mond.prozent} %, {l.mond.phase}</dd>
            {#if l.mond.auf}<dt>{je('Mondaufgang', 'Moonrise')}</dt><dd>{uhr(l.mond.auf)}, {richtung(l.mond.aufRichtung)}</dd>{/if}
            {#if l.mond.unter}<dt>{je('Monduntergang', 'Moonset')}</dt><dd>{uhr(l.mond.unter)}, {richtung(l.mond.unterRichtung)}</dd>{/if}
            <dt>{je('Ohne störenden Mond', 'Without moonlight')}</dt><dd>{l.f.frei ? bis(l.f.frei.von, l.f.frei.bis) : je('heute nicht', 'not tonight')}</dd>
            <dt>{je('Milchstraße', 'Milky Way')}</dt><dd>{#if l.f.mw}{bis(l.f.mw.von, l.f.mw.bis)}, {je('höchstens', 'up to')} {Math.round(l.f.mw.spitze.hoehe)}° {je('im', 'in the')} {richtung(l.f.mw.spitze.richtung)}{:else}{je('heute nicht gut sichtbar', 'not well visible tonight')}{/if}</dd>
            {#if ziel}<dt>{je('Nächste gute Nacht', 'Next good night')}</dt><dd>{tag(ziel.von)}, {bis(ziel.von, ziel.bis)}</dd>{/if}
            <dt>{je('Strichspuren', 'Star trails')}</dt><dd>{je('Kamera nach', 'Point camera')} {richtung(l.pol.richtung)}, {Math.round(l.pol.hoehe)}° {je('hoch', 'high')}{#if l.f.frei}, {je('bis zu', 'up to')} {(Math.round((l.f.frei.bis - l.f.frei.von) / 360000) / 10).toLocaleString(LOCALE)} {je('Stunden', 'hours')}{/if}</dd>
            <dt>{je('Stadtlicht (Schätzung)', 'City light (estimate)')}</dt><dd>{stadtText}</dd>
            {#if l.schauer}<dt>{je('Sternschnuppen', 'Meteors')}</dt><dd>{l.schauer.name}, {je('Höhepunkt', 'peak')} {tag(l.schauer.tag)}</dd>{/if}
          </dl>
        </div>
        <div class="bedien-block">
          <span class="bedien-titel">{je('Himmel in der Fotozeit', 'Sky during the shoot')}</span>
          {#if l.himmelNacht}
            <dl>
              <dt>{je('Wolken gesamt', 'Total clouds')}</dt><dd>{pz(l.himmelNacht.wolken)}</dd>
              <dt>{je('Tief, mittel, hoch', 'Low, mid, high')}</dt><dd>{pz(l.himmelNacht.tief)}, {pz(l.himmelNacht.mittel)}, {pz(l.himmelNacht.hoch)}</dd>
              {#if l.himmelNacht.sicht != null}<dt>{je('Sicht', 'Visibility')}</dt><dd>{Math.round(l.himmelNacht.sicht / 1000)} km</dd>{/if}
              {#if l.himmelNacht.wind != null}<dt>{je('Wind', 'Wind')}</dt><dd>{Math.round(l.himmelNacht.wind)} km/h, {je('Böen bis', 'gusts to')} {Math.round(l.himmelNacht.boeen)} km/h</dd>{/if}
              {#if l.himmelNacht.temp != null}<dt>{je('Temperatur', 'Temperature')}</dt><dd>{Math.round(l.himmelNacht.temp)} °C</dd>{/if}
              {#if l.tau}<dt>{je('Taugefahr', 'Dew risk')}</dt><dd>{je('Objektiv kann beschlagen', 'Lens may fog up')}</dd>{/if}
              {#if l.himmelNacht.regen != null}<dt>{je('Regenrisiko', 'Rain risk')}</dt><dd>{pz(l.himmelNacht.regen)}</dd>{/if}
            </dl>
          {:else}
            <p class="bedien-text">{$online ? je('Wetter wird geladen.', 'Loading weather.') : je('Ohne Netz gibt es keine Wolken und keine Sicht. Sonne, Mond und Sterne rechnet die App trotzdem.', 'Without signal there is no cloud or visibility data. Sun, moon and stars still work.')}</p>
          {/if}
        </div>
        <p class="bedien-text">{je('Richtwerte für die Milchstraße: 14 bis 24 mm, Blende 2,8, 15 bis 20 Sekunden, ISO 3200. Für Strichspuren 30 Sekunden je Bild, rund 120 Bilder ergeben eine Stunde.', 'Milky Way starting point: 14 to 24 mm, f/2.8, 15 to 20 seconds, ISO 3200. For star trails use 30 seconds per frame, about 120 frames make one hour.')}</p>
      </div>
    {/if}
  </section>
{/if}

<style>
  .fl { border: 1px solid var(--line); border-radius: var(--radius-m); background: var(--card); overflow: hidden; }
  .fl-kopf { position: relative; display: flex; flex-direction: column; gap: 4px; width: 100%; min-height: 64px; padding: 12px 40px 12px 14px; border: none; background: none; color: var(--ink); text-align: left; cursor: pointer; }
  .fl-oben { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: calc(15px * var(--schrift, 1)); }
  .fl-oben b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fl-stufe { flex: none; padding: 2px 9px; border-radius: 10px; border: 1px solid var(--line-stark); color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; }
  .fl-stufe.top { border-color: var(--brand); background: var(--brand); color: #fff; }
  .fl-stufe.gut { border-color: var(--brand); color: var(--brand-text); }
  .fl-kurz { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); font-variant-numeric: tabular-nums; line-height: 1.35; }
  .fl-pfeil { position: absolute; right: 14px; top: 50%; translate: 0 -50%; color: var(--brand-text); font-size: calc(20px * var(--schrift, 1)); transition: rotate var(--t-med) var(--ease-out); }
  .fl-pfeil.auf { rotate: 90deg; }
  .fl-mehr { display: flex; flex-direction: column; gap: 14px; padding: 2px 14px 14px; }
  dl { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 6px 12px; margin: 0; font-size: calc(13.5px * var(--schrift, 1)); }
  dt { color: var(--muted); }
  dd { margin: 0; color: var(--ink); font-variant-numeric: tabular-nums; }
</style>
