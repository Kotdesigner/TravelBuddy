<script>
  import { t, LOCALE, tn } from './i18n.js'
  import { kurzTag, kurzZeit, eur } from './format.js'
  import { reisen, neueReise, updateReise, loescheReise, verschiebeReise, journal, wanderungen, vorabKosten,
    gesamtStart, berechneKalender, ymd } from './userdata.js'
  import { tankLuecken, orteAnRoute, wetterPunkte, stoppEinfuegen } from './routenhinweise.js'
  import { holeGefahren } from './gefahren.js'
  import { schriftAuf } from './kontrast.js'
  import { S_MAP, STATUS_MAP } from './wanderungen-daten.js'
  import { fxKurse, kursFuer, inBeide } from './fx.js'
  import { WA_ORTE, WA_ORTE_NAMEN } from './wa-orte.js'
  import { baueVorschau } from './minikarte.js'
  import { poiRegionFuer } from './karten-config.js'
  import { online } from './netz.js'
  import { berechneRoute, flugRoute, luftlinieKm, tankAnalyse, stopsSignatur, fahrzeitText } from './routing.js'
  import { warnungenAnRoute } from './warnungen.js'
  import Stepper from './Stepper.svelte'

  let { warnungen = [], umkreisKm = 150, orte = [] } = $props()

  // ---------- Hinweise entlang der Route (Wunsch Steve 19.09.) ----------
  // Lange Strecken ohne Tankstelle · Sehenswertes nahe der Route · Wetter an der Strecke.
  // Rechnen komplett offline (Route + Tankstellen + Orte liegen auf dem Gerät), nur das
  // Wetter braucht Netz.
  let hinweise = $state({})   // reise.id -> { key, tank, vorschlaege, ohneTankdaten }
  $effect(() => {
    const rs = $reisen, rw = reichweite, alle = orte
    for (const r of rs) {
      if (!r.route?.geometry || r.route.flug || veraltet(r)) continue
      const key = [r.route.sig, rw, (r.nichtVorschlagen || []).join(','), alle.length].join('|')
      if (hinweise[r.id]?.key === key) continue
      ladeTankstellen(regionFuer(r.stops)).then((fuel) => {
        const tank = fuel.length ? tankLuecken(r.route.geometry, fuel, {
          reichweiteKm: rw, abKm: Math.max(150, Math.round(rw * 0.4)),
          start: stops(r).find((s) => s.lat != null)?.name || t('Start'),
          ziel: [...stops(r)].reverse().find((s) => s.lat != null)?.name || t('Ziel'),
          ortsnamen: [...stops(r), ...alle],
        }) : null
        const vorschlaege = orteAnRoute(r.route.geometry, alle, r.stops, { maxKm: 25, ignoriert: r.nichtVorschlagen || [] })
        hinweise[r.id] = { key, tank, vorschlaege, ohneTankdaten: !fuel.length }
        // Gespeicherte Kurzfassung korrigieren, wenn sie noch von der alten Rechnung stammt
        // (am echten „Nord 3": „max 980 km" statt 400 — auch die Karte zeigte das).
        if (tank && r.route.tank && r.route.tank.maxLuecke !== tank.maxLuecke) {
          updateReise(r.id, { route: { ...r.route, tank: { anzahlTank: tank.stationen, maxLuecke: tank.maxLuecke,
            von: '', bis: '', warnung: tank.maxLuecke > rw }, reichweite: rw } })
        }
      })
    }
  })

  function stoppDazu(r, v) {
    updateReise(r.id, { stops: stoppEinfuegen(r.stops, v.nachStopp, v.ort) })
    hinweisMeldung[r.id] = t('✓ {name} nach „{wert}" eingefügt — die Route wird neu berechnet{wert2}.', { name: v.ort.name, wert: (r.stops[v.nachStopp] || {}).name || t('Start'), wert2: $online ? '' : t(', sobald Netz da ist') })
  }
  function nichtVorschlagen(r, id) {
    updateReise(r.id, { nichtVorschlagen: [...new Set([...(r.nichtVorschlagen || []), id])] })
  }
  let hinweisMeldung = $state({})

  // ---------- Wetter an der Strecke ----------
  // Knopf für jede Straßenroute; automatisch für die Etappe, die gerade läuft oder in den
  // nächsten 3 Tagen beginnt (Vorhersage reicht 3 Tage — für spätere Etappen wäre sie Zufall).
  let wetter = $state({})     // reise.id -> { laedt, stand, treffer, punkte, fehler }
  // Ortsangabe für einen Punkt der Strecke: „bei Carnarvon" (≤ 60 km) oder „ca. 90 km von
  // Nanutarra" (≤ 250 km) — „bei km 2100" sagte unterwegs nichts.
  function naechsterName(p, namen) {
    let best = null
    for (const o of namen) {
      if (o.lat == null) continue
      const dx = (o.lon - p.lon) * Math.cos(p.lat * Math.PI / 180) * 111.32, dy = (o.lat - p.lat) * 110.57
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= 250 && (!best || d < best.d)) best = { d, name: o.name }
    }
    if (!best) return null
    return best.d <= 60 ? t('bei {name}', { name: best.name }) : t('ca. {km} km von {name}', { km: Math.round(best.d / 10) * 10, name: best.name })
  }
  async function wetterPruefen(r) {
    if (!r.route?.geometry || !$online) return
    wetter[r.id] = { laedt: true }
    try {
      const pkt = wetterPunkte(r.route.geometry)
      const res = await holeGefahren(pkt.map((p, i) => ({ id: String(i), lat: p.lat, lon: p.lon })))
      const namen = [...stops(r), ...orte]
      // Gleiche Gefahr an aufeinanderfolgenden Punkten zu EINEM Hinweis zusammenfassen
      const treffer = []
      pkt.forEach((p, i) => {
        const g = res.get(String(i))
        for (const x of g?.gefahren || []) {
          const vorige = treffer.find((t) => t.typ === x.typ && p.km - t.bisKm <= 250)
          const name = naechsterName(p, namen) || t('Streckenkilometer {km}', { km: p.km })
          if (vorige) {
            vorige.bisKm = p.km
            if (x.stufe > vorige.stufe) Object.assign(vorige, { stufe: x.stufe, icon: x.icon, text: x.text, tag: x.tag, name })
          } else treffer.push({ typ: x.typ, icon: x.icon, text: x.text, stufe: x.stufe, tag: x.tag, name, vonKm: p.km, bisKm: p.km })
        }
      })
      treffer.sort((a, b) => b.stufe - a.stufe || a.vonKm - b.vonKm)
      wetter[r.id] = { stand: new Date().toISOString(), treffer, punkte: pkt.length }
    } catch (e) {
      wetter[r.id] = { fehler: e?.message || t('Wetterdienst nicht erreichbar') }
    }
  }
  const tagText = kurzTag
  // Läuft die Etappe gerade (oder beginnt in ≤ 3 Tagen)? Dann Wetter automatisch einmal prüfen.
  const plan = $derived(berechneKalender($reisen, $gesamtStart))
  const autoWetterVersucht = new Set()
  $effect(() => {
    if (!$online) return
    const heute = ymd(new Date()), in3 = ymd(new Date(Date.now() + 3 * 86400000))
    for (const e of plan.eintraege) {
      const r = e.reise
      if (!r.route?.geometry || r.route.flug || veraltet(r) || autoWetterVersucht.has(r.id)) continue
      if (ymd(e.bis) < heute || ymd(e.von) > in3) continue
      autoWetterVersucht.add(r.id)
      wetterPruefen(r)
    }
  })

  // Amtliche Warnungen an der Route — nicht nur „Polygon gekreuzt", sondern auch alles
  // im eingestellten Umkreis. Ein Feuer 40 km neben der Strecke geht einen ebenso an.
  function routenWarnungen(r) {
    const geo = r.route?.geometry
    if (!geo || !warnungen?.length) return []
    return warnungenAnRoute(warnungen, geo, umkreisKm)
  }

  let reichweite = $state(500) // km pro Tankfüllung (für Tank-Lücken-Warnung)
  let rechnet = $state({})     // reise.id -> läuft gerade
  let routeMsg = $state({})    // reise.id -> Fehlermeldung

  const fuelCache = new Map()  // region.id -> [{y,x,n}]
  // Nur Regionen mit `pois-<id>.json`; sonst träfe jeder Ostküsten-Stopp „Ostküste"
  // und die Tank-Lücken-Warnung stünde ohne Daten da.
  function regionFuer(stops) {
    const s = (stops || []).find((x) => x.lat != null)
    if (!s) return null
    return poiRegionFuer([[s.lon, s.lat]])?.id ?? null
  }
  async function ladeTankstellen(regionId) {
    if (!regionId) return []
    if (fuelCache.has(regionId)) return fuelCache.get(regionId)
    let fuel = []
    try {
      const alle = await fetch('/pois-' + regionId + '.json').then((r) => (r.ok ? r.json() : []))
      fuel = alle.filter((p) => p.k === 'fuel')
    } catch {}
    fuelCache.set(regionId, fuel)
    return fuel
  }

  function veraltet(r) { return r.route && r.route.sig !== stopsSignatur(r.stops) }

  // Etappen-km je Stopp (Distanz vom vorherigen Stopp) — nur wenn Route aktuell.
  function legInfo(r) {
    const legs = r.route?.legs
    if (!legs || !legs.length || veraltet(r)) return {}
    const res = {}
    let j = -1
    const st = stops(r)
    for (let i = 0; i < st.length; i++) {
      if (st[i].lat == null) continue
      j++
      if (j >= 1 && legs[j - 1]) res[i] = legs[j - 1].km
    }
    return res
  }

  const artVon = (r) => r.art || 'auto'
  const artPasst = (r) => !r.route || (artVon(r) === 'flug') === !!r.route.flug

  // Verkehrsmittel umstellen → Route neu bestimmen (km, Zeit und Sprit ändern sich).
  function setArt(r, art) {
    updateReise(r.id, { art })
    autoVersucht.delete(r.id)
    if ((r.stops || []).filter((x) => x.lat != null).length >= 2) routeRechnen({ ...r, art })
  }

  async function routeRechnen(r) {
    routeMsg[r.id] = ''
    // Flug = Luftlinie, funktioniert auch ohne Netz und ohne Tank-Analyse.
    if (artVon(r) === 'flug') {
      try { updateReise(r.id, { route: flugRoute(r.stops) }) }
      catch (e) { routeMsg[r.id] = e.message }
      return
    }
    rechnet[r.id] = true
    try {
      const route = await berechneRoute(r.stops)
      const fuel = await ladeTankstellen(regionFuer(r.stops))
      route.tank = tankAnalyse(route.geometry, fuel, reichweite)
      route.reichweite = reichweite
      updateReise(r.id, { route })
    } catch (e) {
      routeMsg[r.id] = e.message
    } finally {
      rechnet[r.id] = false
    }
  }
  // ---- Auto-Routing (New Style): „online = sofort aktuell" ----
  // Sobald online, werden fehlende/veraltete Routen automatisch nachgerechnet
  // (debounced; je Stopp-Signatur nur EIN Versuch → kein Hämmern bei Fehlern).
  // Der Knopf bleibt als manueller Fallback. Ref: UX-Recherche/08.
  const autoVersucht = new Map() // reise.id -> zuletzt automatisch versuchte Signatur
  let autoTimer
  $effect(() => {
    const rs = $reisen, on = $online
    if (!rs.length) return
    clearTimeout(autoTimer)
    autoTimer = setTimeout(() => {
      for (const r of rs) {
        const koord = (r.stops || []).filter((s) => s.lat != null)
        if (koord.length < 2) continue
        if (artVon(r) !== 'flug' && !on) continue   // Straßenroute braucht Netz, Flug nicht
        const sig = stopsSignatur(r.stops)
        if (r.route && r.route.sig === sig && artPasst(r)) continue // aktuell — nichts zu tun
        if (autoVersucht.get(r.id) === sig + '|' + artVon(r)) continue // diesen Stand schon versucht
        if (rechnet[r.id]) continue
        autoVersucht.set(r.id, sig + '|' + artVon(r))
        routeRechnen(r)
      }
    }, 1200) // warten, bis das Stopp-Editieren zur Ruhe kommt
    return () => clearTimeout(autoTimer)
  })

  // Tank-Warnung bei geänderter Reichweite ohne Neu-Routing aktualisieren.
  function tankNeu(r) {
    if (!r.route?.geometry) return
    ladeTankstellen(regionFuer(r.stops)).then((fuel) => {
      const tank = tankAnalyse(r.route.geometry, fuel, reichweite)
      updateReise(r.id, { route: { ...r.route, tank, reichweite } })
    })
  }
  function kurz(iso) {
    return kurzZeit(iso)
  }

  // Verknüpfte Tagebuch-Einträge (Gegenrichtung zur Reise-Verknüpfung im Tagebuch).
  // ---- Reise-Hub (New Style V2): alles Verknüpfte einer Reise einsammeln ----
  function wanderungenZuReise(r) {
    return $wanderungen.filter((w) => w.reiseId === r.id)
  }
  function vorabZuReise(r) {
    let eur = 0, n = 0
    for (const k of $vorabKosten) {
      if (k.reiseId !== r.id) continue
      n++; eur += inBeide(k.betrag, k.waehrung, kursFuer($fxKurse, k.datum)).eur
    }
    return { n, eur: Math.round(eur) }
  }

  function tagebuchZuReise(r) {
    return $journal.filter((e) => e.reiseId === r.id).sort((a, b) => (a.datum || '').localeCompare(b.datum || ''))
  }
  function abschnittLabel(r, e) {
    if (e.legIdx == null) return null
    const s = (r.stops || []).filter((x) => x.name)
    return s[e.legIdx] && s[e.legIdx + 1] ? `${s[e.legIdx].name} → ${s[e.legIdx + 1].name}` : null
  }
  function kurzDat(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' }) } catch { return d } }

  let offen = $state({})
  let auswahl = $state({})
  let mName = $state({}), mLat = $state({}), mLon = $state({})

  function toggle(id) { offen[id] = !offen[id] }

  function stops(r) { return r.stops || [] }
  const tagKlasse = (t) => 'tag-' + String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  function setStops(r, neu) { updateReise(r.id, { stops: neu }) }

  function addSel(r) {
    const n = auswahl[r.id]
    if (!n) return
    setStops(r, [...stops(r), { name: n, lat: WA_ORTE[n][0], lon: WA_ORTE[n][1], img: null }])
    auswahl[r.id] = ''
  }
  function num(v) { return parseFloat(String(v).replace(',', '.')) }
  function addManual(r) {
    const name = (mName[r.id] || '').trim() || t('Punkt {n}', { n: stops(r).length + 1 })
    const lat = num(mLat[r.id]), lon = num(mLon[r.id])
    if (isNaN(lat) || isNaN(lon)) return
    setStops(r, [...stops(r), { name, lat, lon, img: null }])
    mName[r.id] = ''; mLat[r.id] = ''; mLon[r.id] = ''
  }
  function move(r, i, d) {
    const s = [...stops(r)]; const j = i + d
    if (j < 0 || j >= s.length) return
    ;[s[i], s[j]] = [s[j], s[i]]; setStops(r, s)
  }
  function remove(r, i) { setStops(r, stops(r).filter((_, idx) => idx !== i)) }
  function addImg(r, i, e) {
    const f = e.target.files && e.target.files[0]; if (!f) return
    const rd = new FileReader()
    rd.onload = (ev) => setStops(r, stops(r).map((x, idx) => idx === i ? { ...x, img: ev.target.result } : x))
    rd.readAsDataURL(f); e.target.value = ''
  }

  function openMaps(r) {
    const use = stops(r).slice(0, 11)
    if (use.length < 2) return
    const c = (s) => encodeURIComponent(s.lat != null ? s.lat + ',' + s.lon : s.name + ', Australia')
    let url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + c(use[0]) + '&destination=' + c(use[use.length - 1])
    if (use.length > 2) url += '&waypoints=' + use.slice(1, -1).map(c).join('%7C')
    window.open(url, '_blank')
  }

  // Mini-Vorschau: Ausschnitt richtet sich nach der Route selbst — so lässt sich
  // jede Strecke in Australien zeigen, nicht nur Westaustralien.
  function vorschau(r) {
    const st = stops(r).filter((x) => x.lat != null)
    if (!st.length) return null
    const geo = r.route?.geometry
    const punkte = geo && geo.length > 1 && r.route.sig === stopsSignatur(r.stops)
      ? geo
      : st.map((x) => [x.lon, x.lat])
    return baueVorschau(punkte, st.map((x) => [x.lon, x.lat]))
  }
</script>

<div class="kopf">
  <p class="intro">{t('Baue deine Reisen — jede eine Etappe. Markiere, welche in den Gesamtplan gehen, und ordne sie unten im Kalender.')}</p>
  <button class="btn neu" onclick={() => neueReise()}>{t('+ Neue Reise')}</button>
</div>

{#if $reisen.length === 0}
  <p class="leer">{t('Noch keine Reisen. Lege eine an, übernimm eine der Routen oben („als eigene Reise"), oder füge Orte aus der Liste hinzu.')}</p>
{/if}

{#each $reisen as r, ri (r.id)}
  <article class="reise" style="border-left:5px solid {r.farbe}">
    <div class="rkopf">
      <button class="aufklapp" class:offen={offen[r.id]} onclick={() => toggle(r.id)}
        title={offen[r.id] ? t('zuklappen') : t('aufklappen')} aria-expanded={!!offen[r.id]}></button>
      <input class="name" aria-label={t('Name der Reise')} value={r.name} oninput={(e) => updateReise(r.id, { name: e.target.value })} />
      <span class="tage" title={t('Dauer in Tagen')}>
        <Stepper value={r.tage} min={1} max={60} einheit="Tg" label={t('Dauer in Tagen')} onchange={(v) => updateReise(r.id, { tage: v })} />
      </span>
      <label class="plan" title={t('Teil der Gesamtreise?')}>
        <input type="checkbox" checked={r.imGesamtplan} onchange={(e) => updateReise(r.id, { imGesamtplan: e.target.checked })} /> {t('Plan')}
      </label>
      <span class="ord">
        <button onclick={() => verschiebeReise(r.id, -1)} disabled={ri === 0} title={t('früher')}>↑</button>
        <button onclick={() => verschiebeReise(r.id, 1)} disabled={ri === $reisen.length - 1} title={t('später')}>↓</button>
      </span>
      <button class="del" onclick={() => { if (confirm(t('Reise „{name}“ löschen?', { name: r.name }))) loescheReise(r.id) }} title={t('löschen')}>✕</button>
    </div>
    <div class="rart">
      <button class="art-knopf" class:an={artVon(r) === 'auto'} onclick={() => setArt(r, 'auto')}
        title={t('Echte Straßenroute — zählt als Fahrstrecke und in den Spritverbrauch')}>{t('🚗 Auto')}</button>
      <button class="art-knopf" class:an={artVon(r) === 'flug'} onclick={() => setArt(r, 'flug')}
        title={t('Luftlinie, kein Sprit — zählt als Flug')}>{t('✈️ Flug')}</button>
    </div>
    <div class="rmeta">{t('{length} Stopp(s)', { length: stops(r).length })}{#if r.route}&nbsp;· <b class="rm-km">{artVon(r) === 'flug' ? '✈️' : '🛣️'} {r.route.km} km</b> · {fahrzeitText(r.route.dauerMin)}{#if veraltet(r)} <span class="rm-alt">{t('(veraltet)')}</span>{/if}{/if}{#if !r.imGesamtplan}&nbsp;{t('· nicht im Gesamtplan')}{/if}</div>

    {#if offen[r.id]}
      {@const legMap = legInfo(r)}
      {@const tb = tagebuchZuReise(r)}
      <div class="body">
        <div class="controls">
          <div class="row">
            <select bind:value={auswahl[r.id]} aria-label={t('Ort als Stopp auswählen')}>
              <option value="">{t('— Ort wählen —')}</option>
              {#each WA_ORTE_NAMEN as n}<option value={n}>{n}</option>{/each}
            </select>
            <button class="btn" onclick={() => addSel(r)}>{t('+ Stopp')}</button>
          </div>
          <div class="row man">
            <input placeholder={t('Name')} bind:value={mName[r.id]} />
            <input placeholder={t('Lat')} bind:value={mLat[r.id]} />
            <input placeholder={t('Lon')} bind:value={mLon[r.id]} />
            <button class="btn" onclick={() => addManual(r)}>{t('+ Koord.')}</button>
          </div>

          <ol class="stops">
            {#each stops(r) as s, i (i)}
              <li>
                <span class="snm">{s.name}{#if legMap[i] != null} <span class="leg">↳ {legMap[i]} km</span>{/if}{#if s.img} 🖼{/if}{#if s.lat == null} <span class="ohne">{t('(keine Koord.)')}</span>{/if}</span>
                <span class="acts">
                  <button onclick={() => move(r, i, -1)}>↑</button>
                  <button onclick={() => move(r, i, 1)}>↓</button>
                  <label>🖼<input type="file" accept="image/*" onchange={(e) => addImg(r, i, e)} /></label>
                  <button onclick={() => remove(r, i)}>✕</button>
                </span>
              </li>
            {/each}
          </ol>

          <button class="btn go" onclick={() => openMaps(r)} disabled={stops(r).length < 2}>{t('📍 In Google Maps öffnen')}</button>

          <!-- OSM-Straßenroute: km, Fahrzeit, Tank-Lücken -->
          <div class="route">
            {#if r.route && !veraltet(r)}
              <div class="r-stats">
                <span class="r-km">🛣️ {r.route.km} km</span>
                <span>⏱️ {fahrzeitText(r.route.dauerMin)}</span>
                {#if r.route.tank}
                  {@const maxL = hinweise[r.id]?.tank?.maxLuecke ?? r.route.tank.maxLuecke}
                  <span class="r-tank" class:warn={maxL > reichweite}>{t('⛽ längste Strecke ohne Tankstelle {maxL} km', { maxL })}</span>
                {/if}
              </div>
              {@const h = hinweise[r.id]}
              {@const tk = h?.tank}
              {#if tk?.luecken.length}
                {@const zuLang = tk.luecken.some((l) => l.ueberReichweite)}
                <details class="r-hw" class:rot={zuLang} open={zuLang}>
                  <summary>{tn(tk.luecken.length, '⛽ {n} lange Strecke ohne Tankstelle · längste {maxLuecke} km', '⛽ {n} lange Strecken ohne Tankstelle · längste {maxLuecke} km', { maxLuecke: tk.maxLuecke })}</summary>
                  <ul class="hw-liste">
                    {#each tk.luecken as l}
                      <li class:rot={l.ueberReichweite}><b>{l.laenge} km</b> <span>{l.von} → {l.bis}</span></li>
                    {/each}
                  </ul>
                  <p class="hw-tipp">{#if zuLang}{t('🔴 Länger als deine Reichweite ({reichweite} km) — Reservekanister oder einen Umweg über eine Tankstelle planen.', { reichweite })} {/if}{t('Vor jeder dieser Strecken volltanken. Tankstellen aus OpenStreetMap, höchstens 5 km neben der Route.')}</p>
                </details>
              {:else if h?.ohneTankdaten}
                <div class="r-hint">{t('⛽ Für diese Gegend sind keine Tankstellen gespeichert (nur WA, Raum Melbourne, Cairns, Whitsundays).')}</div>
              {/if}
              {#if h?.vorschlaege.length}
                <details class="r-hw" open>
                  <summary>{tn(h.vorschlaege.length, '📍 {n} sehenswerter Ort nahe der Route — noch kein Stopp', '📍 {n} sehenswerte Orte nahe der Route — noch kein Stopp')}</summary>
                  <ul class="hw-liste">
                    {#each h.vorschlaege as v (v.ort.id)}
                      <li class="hw-vorschlag">
                        <span class="hw-ort">
                          <b>{v.ort.name}</b>{#if v.ort.tags?.[0]} <span class="tagpill {tagKlasse(v.ort.tags[0])}">{t(v.ort.tags[0])}</span>{/if}
                          <small>{t('{abstand} km neben der Route · passt nach „{wert}"', { abstand: v.abstand, wert: r.stops[v.nachStopp]?.name || t('Start') })}</small>
                        </span>
                        <button class="btn hw-dazu" onclick={() => stoppDazu(r, v)} aria-label={t('{name} als Stopp einfügen', { name: v.ort.name })}>{t('+ Stopp')}</button>
                        <button class="hw-x" onclick={() => nichtVorschlagen(r, v.ort.id)} aria-label={t('{name} nicht mehr vorschlagen', { name: v.ort.name })} title={t('nicht mehr vorschlagen')}>✕</button>
                      </li>
                    {/each}
                  </ul>
                  {#if r.quelle === 'reisekalender'}<p class="hw-tipp">{t('⚠️ Importierte Etappe: hinzugefügte Stopps gehen beim nächsten Kalender-Import verloren.')}</p>{/if}
                </details>
              {/if}
              {#if (r.nichtVorschlagen || []).length}
                <button class="hw-link" onclick={() => updateReise(r.id, { nichtVorschlagen: [] })}>{tn(r.nichtVorschlagen.length, '1 ausgeblendeten Vorschlag wieder zeigen', '{n} ausgeblendete Vorschläge wieder zeigen')}</button>
              {/if}
              {#if !r.route.flug}
                {@const w = wetter[r.id]}
                <div class="r-wetter">
                  {#if w?.laedt}
                    <span>{t('🌦️ Wetter an der Strecke wird geprüft …')}</span>
                  {:else if w?.fehler}
                    <span>🌦️ {w.fehler}</span>
                  {:else if w?.stand}
                    {#if w.treffer.length}
                      <div class="hw-titel">{t('🌦️ Wetter an der Strecke · nächste 3 Tage')}</div>
                      <ul class="hw-liste">
                        {#each w.treffer.slice(0, 8) as tr}
                          <li class="st{tr.stufe}">{tr.icon} <b>{tr.text}</b> — {tr.name} ({tagText(tr.tag)})</li>
                        {/each}
                      </ul>
                    {:else}
                      <span>{t('🌦️ Keine Wetter-Gefahren an der Strecke in den nächsten 3 Tagen ({punkte} Punkte geprüft).', { punkte: w.punkte })}</span>
                    {/if}
                    <span class="hw-stand">{t('Stand {kurz}', { kurz: kurz(w.stand) })}</span>
                  {/if}
                  {#if !w?.laedt}
                    <button class="btn hw-btn" onclick={() => wetterPruefen(r)} disabled={!$online}>
                      {w?.stand ? t('↻ Wetter neu prüfen') : t('🌦️ Wetter an der Strecke prüfen')}{$online ? '' : t(' (braucht Netz)')}
                    </button>
                  {/if}
                </div>
              {/if}
              {@const gw = routenWarnungen(r)}
              {#if gw.length}
                <div class="r-gefahr">{t('⚠️ {length} amtliche Warnung(en) auf der Route:', { length: gw.length })}
                  {#each gw as w}<div class="rg-w"><span class="rg-stufe" style="background:{w.farbe};color:{schriftAuf(w.farbe)}">{w.icon} {w.level}</span> {w.titel}</div>{/each}
                </div>
              {/if}
              <div class="r-fuss">{t('berechnet {kurz} · {wert}', { kurz: kurz(r.route.berechnetAm), wert: r.route.flug ? t('Flugstrecke (Luftlinie, Zeit geschätzt)') : t('Straßenroute (OSRM)') })}</div>
            {:else if veraltet(r)}
              <div class="r-stats">
                <span class="r-km">🛣️ {r.route.km} km</span>
                <span>⏱️ {fahrzeitText(r.route.dauerMin)}</span>
                <span class="rm-alt">{t('· veraltet (Stopps geändert)')}</span>
              </div>
              <div class="r-hint">{t('🔄 „Route aktualisieren" für neue Werte')}{#if !$online} {t('(online)')}{/if}.</div>
            {:else}
              <div class="r-hint">{t('🛣️ ~{luftlinieKm} km Luftlinie (grob)', { luftlinieKm: luftlinieKm(r.stops) })}{#if $online}&nbsp;{t('· „Route berechnen" für echte km & Fahrzeit')}{:else}&nbsp;{t('· online für echte Werte')}{/if}.</div>
            {/if}

            <div class="r-ctrl">
              <button class="btn route-btn" onclick={() => routeRechnen(r)}
                disabled={!$online || rechnet[r.id] || stops(r).filter((s) => s.lat != null).length < 2}>
                {rechnet[r.id] ? t('rechnet …') : (r.route ? t('🔄 Route aktualisieren') : t('🛣️ Route berechnen'))}
              </button>
              <span class="reich" title={t('Reichweite pro Tankfüllung')}>⛽ <Stepper value={reichweite} min={50} max={2000} step={50} einheit="km Reichweite" label={t('Reichweite pro Tankfüllung in km')} onchange={(v) => { reichweite = v; tankNeu(r) }} /></span>
            </div>
            {#if routeMsg[r.id]}<div class="r-fehler">{routeMsg[r.id]}</div>{/if}
            {#if hinweisMeldung[r.id]}<div class="hw-ok" role="status">{hinweisMeldung[r.id]}</div>{/if}
          </div>

          {#if tb.length}
            <div class="tb-verkn">
              <div class="tb-titel">{tn(tb.length, '📓 Logbuch — {n} Eintrag', '📓 Logbuch — {n} Einträge')}</div>
              <ul>
                {#each tb as e}
                  <li><a href="#tagebuch">{kurzDat(e.datum)}</a> · {e.ort || '—'}{#if abschnittLabel(r, e)}&nbsp;· <span class="tb-abs">{abschnittLabel(r, e)}</span>{/if}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <!-- Reise-Hub (V2): Wanderungen & Vorab-Kosten dieser Reise -->
          {#if wanderungenZuReise(r).length}
            <div class="tb-verkn">
              <div class="tb-titel">{t('🥾 Wanderungen — {length}', { length: wanderungenZuReise(r).length })}</div>
              <ul>
                {#each wanderungenZuReise(r) as w}
                  <li><a href="#wanderungen">{STATUS_MAP[w.status]?.emoji} {w.name}</a>{#if w.km}&nbsp;· {w.km} km{/if}{#if S_MAP[w.schwierigkeit]}&nbsp;· {S_MAP[w.schwierigkeit].emoji}{/if}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if vorabZuReise(r).n}
            <div class="tb-verkn">
              <div class="tb-titel">{t('🧾 Vorab-Kosten — {betrag} ({n} Posten)', { betrag: eur(vorabZuReise(r).eur), n: vorabZuReise(r).n })}</div>
              <ul><li><a href="#vorbereitung">{t('in der Reisevorbereitung erfasst → ansehen')}</a> {t('· zählt nur einmal')}</li></ul>
            </div>
          {/if}
        </div>

        {#if vorschau(r)}
          {@const v = vorschau(r)}
          <div class="preview">
            <svg viewBox="0 0 152 226" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="152" height="226" fill="#eaf2f6" rx="6" />
              {#each v.land as d}<path {d} fill="#f5eddc" stroke="#c9b995" stroke-width="1" />{/each}
              {#if v.linie}<polyline points={v.linie} fill="none" stroke={r.farbe} stroke-width="2.2"
                stroke-linejoin="round" stroke-linecap="round" stroke-dasharray={artVon(r) === 'flug' ? '5 4' : null} />{/if}
              {#each v.punkte as p, i}
                <circle cx={p[0]} cy={p[1]} r="3.4" fill={r.farbe} stroke="#fff" stroke-width="0.9" />
                <text x={p[0]} y={p[1] + 1.5} font-size={i >= 9 ? 3.4 : 4.2} font-weight="bold" fill="#fff" text-anchor="middle" font-family="Arial,sans-serif">{i + 1}</text>
              {/each}
            </svg>
          </div>
        {/if}
      </div>
    {/if}
  </article>
{/each}

<style>
  .kopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .intro { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); margin: 0; flex: 1 1 300px; }
  .btn { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 7px 13px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .neu { background: #2f7a63; color: #fff; border-color: #2f7a63; }
  .leer { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); background: var(--flaeche); padding: 14px; border-radius: 10px; }

  .reise { background: var(--card); border: 1px solid var(--line); border-radius: 10px; margin-bottom: 12px; padding: 10px 12px; box-shadow: var(--shadow); }
  .rkopf { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .name { flex: 1 1 140px; font-size: calc(15px * var(--schrift, 1)); font-weight: 700; color: var(--ink); border: 1px solid transparent; border-radius: 6px; padding: 4px 6px; background: transparent; }
  .name:hover, .name:focus { border-color: #e0d3ba; background: var(--eingabe); }
  .tage, .plan { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
  /* ≥ 32 px: vorher 25 × 22 (unter WCAG 2.5.8, Prüfung 19.09.) */
  .ord button, .del { border: 1px solid var(--line-stark); background: var(--card); border-radius: 8px; cursor: pointer; font-size: calc(14px * var(--schrift, 1)); min-width: 34px; min-height: 34px; padding: 0 8px; }
  .ord button:disabled { opacity: 0.3; }
  .del { color: var(--danger-text); border-color: #e3b7b0; }
  .rart { display: flex; gap: 5px; padding: 0 0 6px; }
  .art-knopf {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 5px 11px; min-height: 32px; cursor: pointer;
    border: 1px solid var(--line-stark); background: var(--card); color: var(--muted); border-radius: 16px;
  }
  .art-knopf.an { background: var(--btn-flaeche); border-color: var(--brand); color: var(--brand-text); }
  .rmeta { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin: 4px 0 0 26px; }

  .body { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
  .controls { flex: 1 1 300px; min-width: 260px; }
  .preview { flex: 0 0 240px; }
  .preview svg { width: 100%; height: auto; display: block; }
  .row { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
  select, .row input { font-size: calc(13px * var(--schrift, 1)); padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--eingabe); color: var(--ink); }
  select { flex: 1 1 180px; }
  .man input { flex: 1 1 70px; min-width: 60px; }
  .go { background: #2f7a63; color: #fff; border-color: #2f7a63; }

  .route { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
  .r-stats { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .r-km { color: var(--brand-text); }
  .r-tank { color: var(--ok-text); } .r-tank.warn { color: var(--danger-text); }
  .r-warn { font-size: calc(12px * var(--schrift, 1)); color: #7a2317; background: #fbeee7; border: 1px solid var(--danger-linie); border-radius: 6px; padding: 6px 9px; margin: 4px 0; }
  .r-warn b { color: var(--danger-text); }
  /* Farben als Tokens: im dunklen Design stand hier ein heller Kasten (Prüfung 19.09.) */
  .r-gefahr { font-size: calc(12px * var(--schrift, 1)); color: var(--ink); background: var(--danger-flaeche); border: 1px solid var(--danger-linie); border-radius: 8px; padding: 8px 10px; margin: 4px 0; }
  .rg-w { margin-top: 4px; } .rg-w b { font-weight: 800; }
  .rg-stufe { display: inline-block; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; padding: 1px 7px; border-radius: 8px; }
  .r-fuss { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .rm-km { color: var(--brand-text); font-weight: 800; }
  .rm-alt { color: #b0894a; font-weight: 600; font-size: 0.92em; }
  .r-hint { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); margin-bottom: 6px; }
  .r-ctrl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
  .route-btn { background: #7a3b1e; color: #fff; border-color: #7a3b1e; }
  .route-btn:disabled { opacity: 0.4; }
  .reich { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .r-fehler { font-size: calc(12px * var(--schrift, 1)); color: var(--danger-text); margin-top: 5px; }
  .tb-verkn { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--line); }
  .tb-titel { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); margin-bottom: 4px; }
  .tb-verkn ul { list-style: none; margin: 0; padding: 0; }
  .tb-verkn li { font-size: calc(12.5px * var(--schrift, 1)); color: var(--ink); padding: 2px 0; }
  .tb-verkn a { color: var(--brand-text); font-weight: 700; text-decoration: none; }
  .tb-abs { color: var(--muted); }
  .stops { margin: 6px 0 10px; padding-left: 20px; }
  .stops li { font-size: calc(13.5px * var(--schrift, 1)); min-height: 48px; margin-bottom: 4px; display: flex; justify-content: space-between; gap: 8px; align-items: center; border-bottom: 1px solid #f4ece0; }
  .snm { flex: 1; }
  .leg { color: var(--brand-text); font-weight: 700; font-size: calc(12px * var(--schrift, 1)); }
  .ohne { color: var(--danger-text); font-size: calc(12px * var(--schrift, 1)); }   /* #b09: dunkel 2,7 : 1 */
  .acts { display: inline-flex; gap: 5px; }
  .acts button, .acts label {
    min-width: 38px; min-height: 38px; padding: 0 6px; font-size: calc(14px * var(--schrift, 1)); color: var(--btn-ink);
    border: 1px solid var(--line-stark); background: var(--card); border-radius: 9px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .acts button:hover, .acts label:hover { background: var(--flaeche-2); }
  .acts button:last-child { color: var(--danger); border-color: #e8c2bc; }
  .acts input { display: none; }
  @media (max-width: 520px) { .preview { flex: 1 1 100%; } }
.rg-km{opacity:.7;font-size:.92em}
  /* Hinweise entlang der Route (19.09.) */
  .r-hw { margin: 6px 0; border: 1px solid var(--line); border-radius: 10px; background: var(--flaeche); }
  .r-hw.rot { border-color: var(--danger-linie); background: var(--danger-flaeche); }
  .r-hw summary { cursor: pointer; padding: 10px 12px; min-height: 44px; display: flex; align-items: center; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--ink); list-style-position: inside; }
  .hw-liste { list-style: none; margin: 0; padding: 0 12px 8px; display: flex; flex-direction: column; gap: 6px; }
  .hw-liste li { font-size: calc(12.5px * var(--schrift, 1)); color: var(--ink); line-height: 1.4; }
  .hw-liste li.rot b { color: var(--danger-text); }
  .hw-liste li.st3 b, .hw-liste li.st2 b { color: var(--danger-text); }
  .hw-tipp { margin: 0; padding: 0 12px 10px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .hw-vorschlag { display: flex; align-items: center; gap: 8px; }
  .hw-ort { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .hw-ort b { font-size: calc(13px * var(--schrift, 1)); }
  .hw-ort small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .hw-ort .tagpill { align-self: flex-start; }
  .hw-dazu { flex: none; min-height: 40px; padding: 0 12px; font-size: calc(13px * var(--schrift, 1)); }
  .hw-x { flex: none; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--line); background: var(--card); color: var(--muted); cursor: pointer; font-size: calc(14px * var(--schrift, 1)); }
  .hw-link { background: none; border: none; padding: 6px 0; min-height: 32px; color: var(--brand-text); font-weight: 700; font-size: calc(12px * var(--schrift, 1)); cursor: pointer; }
  .r-wetter { margin: 6px 0; display: flex; flex-direction: column; gap: 6px; font-size: calc(12.5px * var(--schrift, 1)); color: var(--ink); }
  .r-wetter .hw-liste { padding: 0; }
  .hw-titel { font-weight: 700; font-size: calc(13px * var(--schrift, 1)); }
  .hw-stand { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .hw-btn { align-self: flex-start; min-height: 40px; }
  .hw-ok { margin-top: 6px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); background: var(--ok-flaeche); border: 1px solid var(--ok-linie); border-radius: 8px; padding: 8px 10px; }
</style>
