<script>
  import { t, LOCALE, tn, istEn } from './i18n.js'
  import { hinweis } from './dialog.js'
  // Lese-/Ansichtsmodus fürs Roadtrip-Tagebuch: dieselben Daten wie der Editor,
  // aber als „fertiges“ Reisemagazin — Deckblatt, Foto-Grid, Zitat-Blöcke,
  // Tages-Bilanz, Sortier-Umschalter und Druck/PDF-Export („Fotobuch“).
  import { journal, notizen, wanderungen, buchungen, userData, gesamtStart } from './userdata.js'
  import { etappenMitDatum, chronik, routenDerEtappe } from './plan.js'
  import { bereich, tagMonatJahr, tageText, zahl, dezimal } from './format.js'
  import { haversine, stimmigeLegs } from './routing.js'
  import { verdichte, blick, zeichneGlobus } from './globus.js'
  import Weltkugel from './Weltkugel.svelte'
  import { katInfo } from './reisekalender.js'
  import { S_MAP, dauerText } from './wanderungen-daten.js'
  import { MODULE, FELD } from './journal-schema.js'
  import { NOTIZ_TYP } from './notizen-typen.js'
  import Kollage from './Kollage.svelte'
  import { berechneBilanz, bilanzKacheln } from './reise-bilanz.js'
  import { fxKurse } from './fx.js'
  import { planUeberblick } from './plan.js'
  import TagebuchFotos from './TagebuchFotos.svelte'
  import { tagebuchFotos, holeTagebuchBild, geraetBild } from './tagebuch-fotos.js'

  let { orte = [], reisen = [] } = $props()

  // Zwei Fassungen: „kurz“ zeigt nur Bild, Text und Kennzahlen je Tag —
  // die ausführliche zusätzlich alle ausgefüllten Themenmodule, Notizen und Bilanz.
  let fassung = $state('lang')   // 'kurz' | 'lang'
  let kollageAuf = $state(false)
  const alleFotos = $derived([
    ...eintraege.flatMap((e) => (e.fotos || []).map((src) => ({ src, datum: e.datum, ort: e.ort }))),
    ...$wanderungen.filter((w) => w.datum).flatMap((w) => (w.fotos || []).map((src) => ({ src, datum: w.datum, ort: w.name }))),
  ])

  // ---- Was ins Tagebuch kommt: alles aus dem Plan zuschaltbar ----
  // Etappen: Kapitelkopf mit Datum, Routen, Stopps und Gebuchtem, auch für Etappen, zu
  // denen noch nichts geschrieben ist. Wanderungen und Orte: eigene Abschnitte. Weltkugeln:
  // eine auf dem Deckblatt, eine je Etappe.
  const SCHALTER = [
    ['etappen', '🧭', t('Etappen')], ['wanderungen', '🥾', t('Wanderungen')],
    ['orte', '📍', t('Orte')], ['kugeln', '🌍', t('Weltkugeln')], ['bilanz', '📊', t('Bilanz')],
    ['geraet', '📷', t('Fotos vom Gerät')],
  ]
  const VORGABE = { etappen: true, wanderungen: true, orte: true, kugeln: true, bilanz: true, geraet: true }
  let zeige = $state((() => { try { return { ...VORGABE, ...JSON.parse(localStorage.getItem('tb-tagebuch-zeigen') || '{}') } } catch { return { ...VORGABE } } })())
  $effect(() => { try { localStorage.setItem('tb-tagebuch-zeigen', JSON.stringify(zeige)) } catch {} })
  const schalte = (id) => { zeige = { ...zeige, [id]: !zeige[id] } }
  const breitesBild = typeof innerWidth !== 'undefined' && innerWidth > 700
  // Fotos fürs Tagebuch, die nur auf diesem Gerät liegen (TagebuchFotos.svelte). Ein Tag mit
  // solchen Fotos ist eine Tagebuchseite, auch ohne Logbuch-Eintrag.
  const geraetFotos = $derived(zeige.geraet ? $tagebuchFotos : [])

  // ---- Dieselbe Chronik wie das Logbuch. Kapitel = Etappen, darin die Tage. ----
  // Ein Tag kommt ins Tagebuch, wenn es etwas zu erzählen gibt: einen Logbuch-Eintrag,
  // eine gemachte (oder beschriebene) Wanderung oder eine alte Orts-Notiz. Gebuchtes
  // allein ist kein Tagebuchtag, steht aber als Zeile über dem Tag, wenn er drin ist.
  const ortName = $derived(new Map(orte.map((o) => [o.id, o.name])))
  const planE = $derived(etappenMitDatum(reisen, $gesamtStart))
  const chr = $derived(chronik({
    eintraege: planE, journal: $journal, wanderungen: $wanderungen, buchungen: $buchungen?.events || [], fotos: geraetFotos,
    ortTage: Object.entries($userData).flatMap(([id, ud]) => (ud?.tagebuch || []).map((t) => ({ ...t, ortName: ortName.get(id) || id }))),
  }))
  const wandErzaehlt = (w) => w.status === 'gemacht' || (w.beschreibung || '').trim() || (w.fotos || []).length || w.bewertung
  const tagGilt = (t) => t.journal.length > 0 || t.fotos.length > 0 || (zeige.wanderungen && t.wanderungen.some(wandErzaehlt)) || (zeige.orte && t.ortTage.length > 0)
  // Leere Einträge (angelegt, nie beschrieben) sind keine Tagebuchseite
  const eintragHatInhalt = (e) => !!((e.text || '').trim() || (e.ort || '').trim() || (e.fotos || []).length || (e.audios || []).length
    || Object.values(e.felder || {}).some((w) => w != null && w !== '' && !(Array.isArray(w) && !w.length) && !(typeof w === 'object' && !Array.isArray(w) && !Object.keys(w).length)))
  const kapitel = $derived.by(() => {
    const k = []
    const dazu = (id, titel, untertitel, farbe, tage, etappe = null) => {
      const g = tage.map((t) => ({ ...t, journal: t.journal.filter(eintragHatInhalt) })).filter(tagGilt)
      // Mit „Etappen“ steht jede Etappe im Buch, auch wenn dort noch nichts geschrieben ist
      if (g.length || (etappe && zeige.etappen)) k.push({ id, titel, untertitel, farbe, tage: g, etappe })
    }
    dazu('vorher', t('Vor der Reise'), '', '#9a8f80', chr.vorher)
    for (const a of chr.abschnitte) dazu(a.etappe.reise.id, a.etappe.reise.name, bereich(a.etappe.von, a.etappe.bis), a.etappe.reise.farbe || '#8a3f16', a.tage, a.etappe)
    dazu('zwischen', t('Zwischen den Etappen'), '', '#9a8f80', chr.ausserhalb)
    dazu('nachher', t('Nach der Reise'), '', '#9a8f80', chr.nachher)
    if (reihenfolge === 'neu') return k.reverse().map((x) => ({ ...x, tage: [...x.tage].reverse() }))
    return k
  })
  const nrAm = $derived(new Map(chr.abschnitte.flatMap((a) => a.tage.map((t) => [t.datum, t.nr]))))
  const wandDesTages = (t) => (zeige.wanderungen ? t.wanderungen.filter(wandErzaehlt) : [])
  const ortTageDes = (t) => (zeige.orte ? t.ortTage : [])

  // ---- Plan einer Etappe fürs Tagebuch: Routen, Stopps, Orte, Wanderungen, Kugel ----
  const istFlug = (x) => (x.art || 'auto') === 'flug' || !!x.route?.flug
  const mitKoord = (x) => (x.stops || []).filter((st) => st.lat != null && st.lon != null)
  const bildVon = (o) => o?.bildData || (o?.bild ? '/' + String(o.bild).replace(/^\//, '') : o?.img || null)
  const orteMitKoord = $derived(orte.filter((o) => o.lat != null && o.lon != null))
  const normName = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  function ortZuStopp(st) {
    const n = normName(st.name)
    let best = null, bestKm = 9
    for (const o of orteMitKoord) {
      const km = haversine(st.lat, st.lon, o.lat, o.lon)
      const gleich = n && (normName(o.name).startsWith(n) || n.startsWith(normName(o.name)))
      if ((gleich && km < 60) || km < bestKm) { if (gleich) return o; best = o; bestKm = km }
    }
    return best
  }
  function linieVon(x, farbe) {
    const st = mitKoord(x)
    const geo = x.route?.geometry?.length >= 2 ? x.route.geometry : st.map((p) => [p.lon, p.lat])
    return geo.length >= 2 ? { coords: verdichte(geo, istFlug(x)), farbe: x.farbe || farbe, flug: istFlug(x) } : null
  }
  function planVon(et) {
    if (!et) return null
    const r = et.reise
    const routen = routenDerEtappe(reisen, r.id)
    const quellen = [r, ...routen]
    const linien = quellen.map((x) => linieVon(x, r.farbe || '#c1662f')).filter(Boolean)
    const stopps = []
    const gesehen = new Set()
    for (const x of quellen) for (const st of mitKoord(x)) {
      const key = st.name + '|' + st.lat.toFixed(2)
      if (gesehen.has(key)) continue
      gesehen.add(key); stopps.push({ ...st, farbe: x.farbe || r.farbe })
    }
    const ids = new Set(quellen.map((x) => x.id))
    const imZeitraum = (d) => d && d >= et.von && d <= et.bis
    const wand = $wanderungen.filter((w) => (w.datum ? imZeitraum(w.datum) : ids.has(w.reiseId)))
      .sort((a, b) => (a.datum || '9').localeCompare(b.datum || '9'))
    const besucht = $journal.filter((e) => imZeitraum(e.datum) && e.lat != null && e.lon != null)
    const ortListe = []
    const ortIds = new Set()
    const nimm = (o) => { if (o && !ortIds.has(o.id)) { ortIds.add(o.id); ortListe.push(o) } }
    for (const e of besucht) nimm(e.ortId ? orte.find((o) => o.id === e.ortId) : null)
    for (const st of stopps) nimm(ortZuStopp(st))
    const gebucht = ($buchungen?.events || []).filter((b) => !b.platzhalter && imZeitraum(b.datum))
    const km = routen.reduce((n, x) => n + (Number(x.route?.km) || 0), 0)
    const anreiseKm = Number(r.route?.km) || 0
    const punkte = [
      ...stopps.map((st) => ({ lon: st.lon, lat: st.lat, farbe: st.farbe, art: 'stopp' })),
      ...wand.filter((w) => w.lat != null && w.lon != null).map((w) => ({ lon: w.lon, lat: w.lat, art: 'wanderung' })),
      ...besucht.map((e) => ({ lon: e.lon, lat: e.lat, art: 'ort', farbe: '#2b2621' })),
    ]
    const namen = []
    for (const l of quellen) {
      const st = mitKoord(l)
      if (st.length) namen.push({ lon: st[0].lon, lat: st[0].lat, text: st[0].name })
      if (st.length > 1) namen.push({ lon: st[st.length - 1].lon, lat: st[st.length - 1].lat, text: st[st.length - 1].name })
    }
    return {
      routen: quellen.filter((x) => mitKoord(x).length >= (x === r ? 2 : 1)), linien, stopps, wand, orte: ortListe.slice(0, 14), gebucht, km, anreiseKm,
      kugel: linien.length || punkte.length ? { linien, punkte, namen: namen.slice(0, 4) } : null,
    }
  }
  const plaene = $derived(new Map(kapitel.filter((k) => k.etappe).map((k) => [k.id, planVon(k.etappe)])))

  // Deckblatt-Kugel: die ganze Reise, von zu Hause bis zurück
  const ganzeKugel = $derived.by(() => {
    const linien = [], punkte = [], namen = []
    for (const e of planE) {
      const r = e.reise
      for (const x of [r, ...routenDerEtappe(reisen, r.id)]) {
        const l = linieVon(x, r.farbe || '#c1662f')
        if (l) linien.push(l)
      }
      const st = mitKoord(r)[0]
      if (st) { punkte.push({ lon: st.lon, lat: st.lat, farbe: r.farbe, art: 'stopp' }); namen.push({ lon: st.lon, lat: st.lat, text: st.name }) }
    }
    return linien.length ? { linien, punkte, namen: namen.slice(0, 6) } : null
  })
  const reiseZeile = (t) => t.buchungen.filter((b) => ['flight', 'train', 'boat', 'shuttle', 'hotel', 'camper', 'car'].includes(b.kat)).slice(0, 4)

  // Titel des Tagebuchs: frei wählbar, merkt sich das Gerät (Vorgabe „Australien“)
  let titel = $state((() => { try { return localStorage.getItem('tb-tagebuch-titel') || t('Australien') } catch { return t('Australien') } })())
  $effect(() => { try { localStorage.setItem('tb-tagebuch-titel', titel) } catch {} })

  // Verknüpfte Reise (+ optionaler Teilabschnitt) eines Eintrags.
  // Bei „Ganze Reise“ (legIdx == null) werden ALLE Zwischenschritte mit aufgenommen.
  function reiseTag(e) {
    if (!e.reiseId) return null
    const r = reisen.find((x) => x.id === e.reiseId)
    if (!r) return null
    const s = (r.stops || []).filter((x) => x.name)
    const ganze = e.legIdx == null
    let abschnitt = '', km = null
    if (ganze) {
      km = r.route?.km ?? null
    } else {
      if (s[e.legIdx] && s[e.legIdx + 1]) abschnitt = ` · ${s[e.legIdx].name} → ${s[e.legIdx + 1].name}`
      km = stimmigeLegs(r.route)[e.legIdx]?.km ?? null
    }
    return { name: r.name, abschnitt, farbe: r.farbe || 'var(--brand)', ganze, stops: ganze ? s.map((x) => x.name) : null, km }
  }

  let reihenfolge = $state('alt') // 'alt' = älteste zuerst (wie ein Buch) | 'neu' = neueste zuerst

  const eintraege = $derived(
    [...$journal].sort((a, b) =>
      reihenfolge === 'alt'
        ? (a.datum || '').localeCompare(b.datum || '')
        : (b.datum || '').localeCompare(a.datum || '')),
  )

  // Tag-Nummer immer chronologisch (ältester = Tag 1).
  const tagNr = $derived.by(() => {
    const asc = [...$journal].filter((e) => e.datum).sort((a, b) => a.datum.localeCompare(b.datum))
    const m = {}
    asc.forEach((e, i) => (m[e.id] = i + 1))
    return m
  })

  const themen = MODULE.filter((m) => m.id !== 'meta')

  // ---- Helfer ----
  const hatWert = (w) =>
    w != null && w !== '' &&
    !(Array.isArray(w) && w.length === 0) &&
    !(typeof w === 'object' && !Array.isArray(w) && Object.keys(w).length === 0)

  const wert = (e, fid) => e.felder?.[fid]
  const hat = (e, fid) => hatWert(wert(e, fid))
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

  function datumLang(d) {
    if (!d) return t('Ohne Datum')
    try { return new Date(d + 'T00:00:00').toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
    catch { return d }
  }
  function datumKurz(d) {
    if (!d) return ''
    try { return new Date(d + 'T00:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) }
    catch { return d }
  }

  const summe = (obj) => Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0)

  // Erfasstes lokales Datum einer Notiz (stabil, unabhängig von der aktuellen Gerätezeitzone).
  function notizDatum(n) {
    if (n.tsLokal) return n.tsLokal.slice(0, 10)
    try { const d = new Date(n.ts); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
    catch { return '' }
  }

  function counterEintraege(fid, obj) {
    const opts = FELD[fid]?.optionen || []
    const emojiVon = (label) => opts.find((o) => o.label === label)?.emoji || '📝'
    return Object.entries(obj || {}).map(([label, n]) => ({ label: t(label), n, emoji: emojiVon(label) }))
  }

  function akzent(e) {
    const c = wert(e, 'color_palette')
    return typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : 'var(--brand)'
  }

  function quickStats(e) {
    const f = e.felder || {}
    const out = []
    if (hatWert(f.distance_km)) out.push({ icon: '🛣️', text: `${f.distance_km} km` })
    if (hatWert(f.temp_celsius)) out.push({ icon: '🌡️', text: f.temp_celsius })
    if (hatWert(f.fly_factor)) out.push({ icon: '🪰', text: `${f.fly_factor}/5` })
    if (hatWert(f.connectivity)) out.push({ icon: '📶', text: t(f.connectivity) })
    if (hatWert(f.roadkill_density)) out.push({ icon: '💀', text: t(f.roadkill_density) })
    if (hatWert(f.roadtrain_count)) out.push({ icon: '🚛', text: f.roadtrain_count })
    if (hatWert(f.soundtrack)) out.push({ icon: '🎵', text: f.soundtrack })
    return out
  }

  function bilanz(e) {
    const f = e.felder || {}
    const out = []
    if (hatWert(f.distance_km)) out.push(`🛣️ ${f.distance_km} km`)
    if (hatWert(f.fly_factor)) out.push(t('🪰 Fliegen {fly_factor}/5', { fly_factor: f.fly_factor }))
    const rk = summe(f.roadkill_counts)
    if (rk) out.push(t('💀 {rk} Roadkill', { rk }))
    const sight = (f.roadside_sightings || []).length
    if (sight) out.push('👀 ' + tn(sight, '{n} Tierart', '{n} Tierarten'))
    const kur = summe(f.roadside_junk)
    if (kur) out.push('🗿 ' + tn(kur, '{n} Kuriosität', '{n} Kuriositäten'))
    if (hatWert(f.food_rating)) out.push(`😋 ${f.food_rating}/10`)
    return out
  }

  const istProsa = (f) => f.typ === 'textlang' || f.typ === 'text'
  const modulHatInhalt = (e, m) => m.felder.some((f) => hat(e, f.id))
  function region(e) {
    const o = e.ortId ? orte.find((x) => x.id === e.ortId) : null
    return o?.region || null
  }

  // Gesamt-Bilanz fürs Deckblatt.
  const gesamt = $derived.by(() => {
    let km = 0, rk = 0, kur = 0, flySum = 0, flyN = 0, fotos = 0
    const daten = []
    for (const e of $journal) {
      const f = e.felder || {}
      if (hatWert(f.distance_km)) km += Number(f.distance_km) || 0
      rk += summe(f.roadkill_counts)
      kur += summe(f.roadside_junk)
      if (hatWert(f.fly_factor)) { flySum += Number(f.fly_factor) || 0; flyN++ }
      fotos += (e.fotos || []).length
      if (e.datum) daten.push(e.datum)
    }
    daten.sort()
    const gemacht = $wanderungen.filter((w) => w.status === 'gemacht')
    const wKm = Math.round(gemacht.reduce((n, w) => n + (Number(w.km) || 0), 0) * 10) / 10
    fotos += $wanderungen.reduce((n, w) => n + (w.fotos || []).length, 0) + geraetFotos.length
    const tage = new Set(kapitel.flatMap((k) => k.tage.map((t) => t.datum))).size
    const von = kapitel.length ? [...kapitel.flatMap((k) => k.tage.map((t) => t.datum))].sort()[0] : daten[0]
    const bis = kapitel.length ? [...kapitel.flatMap((k) => k.tage.map((t) => t.datum))].sort().pop() : daten[daten.length - 1]
    return { tage, km, rk, kur, fotos, avgFly: flyN ? flySum / flyN : 0, von, bis, wand: gemacht.length, wKm, etappen: kapitel.filter((k) => !['vorher', 'zwischen', 'nachher'].includes(k.id)).length }
  })

  // ---- Reise-Bilanz am Ende des Buchs: nur, wofür es Daten gibt ----
  const reiseBilanz = $derived(berechneBilanz({ journal: $journal, wanderungen: $wanderungen, reisen, plan: planUeberblick(planE), kurse: $fxKurse }))
  const bilanzK = $derived(bilanzKacheln(reiseBilanz))
  function bilanzHTML() {
    if (!zeige.bilanz || !bilanzK.length) return ''
    const kacheln = bilanzK.map((x) => `<div class="bz${x.lang ? ' lang' : ''}"><span class="bz-i">${x.icon}</span><b>${esc(x.wert)}</b><span>${esc(x.text)}</span>${x.zusatz ? `<em>${esc(x.zusatz)}</em>` : ''}</div>`).join('')
    const fuss = reiseBilanz.kosten ? `<p class="bz-fuss">${esc(t('Beträge zum Tageskurs umgerechnet, ohne Kurs mit Näherungswert. Ausgaben vor der Reise sind nicht dabei.'))}</p>` : ''
    return `<section class="kapitel bilanz" style="--kf:#8a3f16"><div class="kap-kopf"><div class="kap-txt"><h2>${esc(t('Bilanz'))}</h2><span>${esc(t('{titel} in Zahlen', { titel }))}</span></div></div><div class="bz-raster">${kacheln}</div>${fuss}</section>`
  }

  // ---------- Druck / PDF („Fotobuch“) ----------
  function faktenHTML(e, m) {
    const kompakt = m.felder.filter((f) => !istProsa(f) && hat(e, f.id))
    if (!kompakt.length) return ''
    let chips = ''
    for (const f of kompakt) {
      const v = wert(e, f.id)
      if (f.typ === 'rating') chips += `<span class="fakt">${f.icon} ${esc(f.label)}: <b>${v}/${f.max}</b> ${(f.symbol || '⭐').repeat(f.max <= 5 ? v : 1)}</span>`
      else if (f.typ === 'tags') for (const x of v) chips += `<span class="chip">${esc(t(x))}</span>`
      else if (f.typ === 'counter') for (const c of counterEintraege(f.id, v)) chips += `<span class="chip">${c.emoji} ${esc(c.label)} <b>×${c.n}</b></span>`
      else if (f.typ === 'farbe') chips += /^#[0-9a-f]{3,8}$/i.test(v)
        ? `<span class="fakt">${f.icon} ${esc(f.label)}: <span class="sw" style="background:${esc(v)}"></span></span>`
        : `<span class="fakt">${f.icon} ${esc(f.label)}: <b>${esc(v)}</b></span>`
      else chips += `<span class="chip">${f.icon} ${esc(t(v))}</span>`
    }
    return `<div class="fakten">${chips}</div>`
  }

  // Gerätefotos im Druck in voller Auflösung. Die Blob-Adressen gelten, bis das Druckfenster zugeht.
  let druckBilder = new Map()
  async function holeDruckBilder() {
    const m = new Map()
    for (const f of geraetFotos) {
      const b = await holeTagebuchBild(f.id, 'gross')
      if (b) m.set(f.id, URL.createObjectURL(b))
    }
    return m
  }
  function geraetHTML(liste = []) {
    const da = liste.filter((f) => druckBilder.has(f.id))
    if (!da.length) return ''
    return `<div class="galerie ${da.length > 2 ? 'viele' : ''} ${da.length === 1 ? 'solo' : ''} ${da.length > 6 ? 'dicht' : ''}">${da.map((f) => `<figure class="g-foto"><img src="${druckBilder.get(f.id)}"></figure>`).join('')}</div>`
  }

  function tagHTML(e, vorspann = '', nachspann = '', fotosDazu = '') {
    const stats = quickStats(e).map((s) => `<span class="stat">${s.icon} ${esc(s.text)}</span>`).join('')
    const fotos = e.fotos || []
    const gal = fotos.length
      ? `<div class="galerie ${fotos.length > 2 ? 'viele' : ''} ${fotos.length === 1 ? 'solo' : ''}">${fotos.map((src) => `<figure class="g-foto"><img src="${src}"></figure>`).join('')}</div>`
      : ''
    let mod = ''
    for (const m of themen) {
      if (fassung !== 'lang') break     // Kurzfassung: keine Themenmodule
      if (!modulHatInhalt(e, m)) continue
      if (m.zitat) {
        let z = ''
        for (const f of m.felder) if (hat(e, f.id)) z += `<blockquote class="zitat"><p>${esc(wert(e, f.id))}</p><cite>${f.icon} ${esc(f.label)}</cite></blockquote>`
        mod += `<div class="zitate">${z}</div>`
      } else {
        let pros = ''
        for (const f of m.felder) if (istProsa(f) && hat(e, f.id)) pros += `<div class="prosa"><span class="p-cap">${f.icon} ${esc(f.label)}</span><p>${esc(wert(e, f.id))}</p></div>`
        mod += `<section class="modul"><h4 class="m-titel">${m.icon} ${esc(m.titel)}</h4>${pros}${faktenHTML(e, m)}</section>`
      }
    }
    const bil = fassung === 'lang' ? bilanz(e).map((b) => `<span>${esc(b)}</span>`).join('') : ''
    const nr = nrAm.get(e.datum) ? `<span class="t-nr">${t('Tag {n}', { n: nrAm.get(e.datum) })}</span>` : ''
    const reg = region(e) ? ` · ${esc(region(e))}` : ''
    const rt = reiseTag(e)
    const reiseLine = rt
      ? `<div class="t-reise-print">🧭 ${esc(rt.name)}${esc(rt.abschnitt)}${!rt.ganze && rt.km ? ` · ${rt.km} km` : ''}</div>`
      : ''
    const routeLine = rt?.ganze && rt.stops?.length
      ? `<div class="t-route-print">${rt.stops.map((s) => `<span>${esc(s)}</span>`).join('<b>→</b>')}${rt.km ? ` <em>🛣️ ${rt.km} km</em>` : ''}</div>`
      : ''
    return `<article class="tag" style="--akz:${akzent(e)}">
      <header class="t-kopf"><div class="t-meta">${nr}<span class="t-datum">${esc(datumLang(e.datum))}</span></div>
      ${reiseLine}${routeLine}
      ${vorspann}
      ${e.ort ? `<h3 class="t-ort">${esc(e.ort)}<span class="t-region">${reg}</span></h3>` : ''}
      ${stats ? `<div class="t-stats">${stats}</div>` : ''}</header>
      ${hatWert(e.text) ? `<p class="t-lead">${esc(e.text)}</p>` : ''}
      ${gal}${fotosDazu}${mod}
      ${nachspann}
      ${bil ? `<footer class="t-bilanz">${bil}</footer>` : ''}</article>`
  }

  function extrasHTML(tg) {
    let h = ''
    for (const w of wandDesTages(tg)) {
      const daten = [w.km ? w.km + ' km' : '', dauerText(w.dauerMin), w.hoehenmeter ? t('↑ {n} hm', { n: w.hoehenmeter }) : '', S_MAP[w.schwierigkeit]?.label, w.bewertung ? '★'.repeat(w.bewertung) : ''].filter(Boolean).join(' · ')
      const fotos = (w.fotos || []).length ? `<div class="galerie ${w.fotos.length === 1 ? 'solo' : ''}">${w.fotos.map((src) => `<figure class="g-foto"><img src="${src}"></figure>`).join('')}</div>` : ''
      h += `<section class="wand"><h4 class="m-titel">🥾 ${esc(t('Wanderung: {name}', { name: w.name }))}</h4>${daten ? `<div class="w-daten">${esc(daten)}</div>` : ''}${(w.beschreibung || '').trim() ? `<p class="w-text">${esc(w.beschreibung)}</p>` : ''}${fotos}</section>`
    }
    for (const o of ortTageDes(tg)) h += `<section class="wand"><h4 class="m-titel">📍 ${esc(o.ortName)}</h4>${(o.text || '').trim() ? `<p class="w-text">${esc(o.text)}</p>` : ''}</section>`
    return h
  }
  function reiseZeileHTML(tg) {
    const r = zeige.etappen ? reiseZeile(tg) : []
    return r.length ? `<div class="t-unterwegs">${r.map((b) => `${b.emoji || katInfo(b.kat).icon} ${esc(b.titel)}`).join(' · ')}</div>` : ''
  }
  function tagOhneEintragHTML(tg) {
    const nr = nrAm.get(tg.datum) ? `<span class="t-nr">${t('Tag {n}', { n: nrAm.get(tg.datum) })}</span>` : ''
    return `<article class="tag"><header class="t-kopf"><div class="t-meta">${nr}<span class="t-datum">${esc(datumLang(tg.datum))}</span></div>${reiseZeileHTML(tg)}</header>${geraetHTML(tg.fotos)}${extrasHTML(tg)}</article>`
  }
  // Weltkugel als Bild für den Druck (Canvas → PNG), doppelte Auflösung
  function kugelBild(kugel, groesse, minP = 1.2) {
    if (!kugel) return ''
    try {
      const cv = document.createElement('canvas')
      const pk = [...kugel.linien.flatMap((l) => l.coords), ...kugel.punkte.map((x) => [x.lon, x.lat])]
      const b = blick(pk, { minP })
      zeichneGlobus(cv, { breite: groesse, hoehe: groesse, dpr: 2, mitte: b.mitte, P: b.P, linien: kugel.linien, punkte: kugel.punkte, namen: kugel.namen })
      return cv.toDataURL('image/png')
    } catch { return '' }
  }
  const absolut = (u) => (u && u.startsWith('/') ? location.origin + u : u)
  function planHTML(k, pl) {
    let h = ''
    if (zeige.etappen) {
      for (const x of pl.routen) {
        const st = mitKoord(x)
        h += `<div class="kp-route" style="--rf:${esc(x.farbe || k.farbe)}"><div class="kp-r-kopf"><b>${istFlug(x) ? '✈️' : '🛣️'} ${esc(x.name)}</b>${x.route?.km ? `<span>${zahl(x.route.km)} km</span>` : ''}</div>`
          + `<div class="kp-stopps">${st.slice(0, 14).map((p) => `<span class="kp-stopp">${esc(p.name)}</span>`).join('<b>→</b>')}${st.length > 14 ? ` <em>+${st.length - 14}</em>` : ''}</div></div>`
      }
      if (pl.gebucht.length) h += `<p class="kp-gebucht">🧾 ${t('{n} gebucht:', { n: pl.gebucht.length })} ${pl.gebucht.slice(0, 5).map((b) => esc((b.emoji || katInfo(b.kat).icon) + ' ' + b.titel)).join(' · ')}</p>`
    }
    if (zeige.orte && pl.orte.length) {
      h += `<div class="kp-orte">${pl.orte.slice(0, 8).map((o) => { const b = absolut(bildVon(o)); return `<figure class="kp-ort">${b ? `<img src="${esc(b)}">` : '<span class="kp-ort-leer">📍</span>'}<figcaption>${esc(o.name)}</figcaption></figure>` }).join('')}</div>`
    }
    if (zeige.wanderungen && pl.wand.length) {
      h += `<ul class="kp-wand">${pl.wand.map((w) => `<li>${w.status === 'gemacht' ? '✅' : '🥾'} <b>${esc(w.name)}</b>${w.datum ? ` · ${esc(tagMonatJahr(w.datum))}` : ''}${w.km ? ` · ${esc(w.km)} km` : ''}</li>`).join('')}</ul>`
    }
    return h ? `<div class="kap-plan">${h}</div>` : ''
  }
  function kapitelHTML(k) {
    const pl = plaene.get(k.id)
    const bild = zeige.kugeln && pl?.kugel ? kugelBild(pl.kugel, 230) : ''
    let h = `<section class="kapitel" style="--kf:${esc(k.farbe)}"><div class="kap-kopf"><div class="kap-txt"><h2>${esc(k.titel)}</h2>${k.untertitel ? `<span>${esc(k.untertitel)}${k.etappe ? ' · ' + esc(tageText(k.etappe.tage)) : ''}</span>` : ''}</div>${bild ? `<img class="kap-kugel" src="${bild}" alt="">` : ''}</div>`
    if (pl) h += planHTML(k, pl)
    for (const tg of k.tage) {
      if (!tg.journal.length) { h += tagOhneEintragHTML(tg); continue }
      tg.journal.forEach((e, i) => { h += tagHTML(e, i === 0 ? reiseZeileHTML(tg) : '', i === tg.journal.length - 1 ? extrasHTML(tg) : '', i === 0 ? geraetHTML(tg.fotos) : '') })
    }
    return h + '</section>'
  }

  function druckFotobuch() {
    // Fenster sofort öffnen (sonst blockt der Browser es), die Kugeln danach malen
    const w = window.open('', '_blank')
    if (!w) { hinweis(t('Bitte Pop-ups für diese Seite erlauben, dann klappt der Druck- und PDF-Export.'), { titel: t('Fenster blockiert') }); return }
    w.document.open(); w.document.write(`<!doctype html><meta charset="utf-8"><title>${t('Tagebuch')}</title><p style="font:600 16px system-ui;padding:40px;color:#5a5248">${t('Dein Tagebuch wird vorbereitet …')}</p>`); w.document.close()
    setTimeout(() => druckSchreiben(w), 30)
  }
  async function druckSchreiben(w) {
    for (const u of druckBilder.values()) URL.revokeObjectURL(u)
    druckBilder = await holeDruckBilder()
    const bilder = druckBilder
    const g = gesamt
    const deckKugel = zeige.kugeln && ganzeKugel ? kugelBild(ganzeKugel, 300, 2) : ''
    const zeit = g.von ? `${datumKurz(g.von)} – ${datumKurz(g.bis)}` : ''
    const cover = `<section class="cover">
      <div class="c-kicker">${t('Mein Reisetagebuch')}</div>
      <h1 class="c-title">${esc(titel)}</h1>
      <div class="c-zeit">${esc(zeit)}${zeit ? ' · ' : ''}${esc(tn(g.tage, '{n} Reisetag', '{n} Reisetage'))}${g.etappen ? ' ' + esc(tn(g.etappen, 'in {n} Etappe', 'in {n} Etappen')) : ''}</div>
      ${deckKugel ? `<img class="c-kugel" src="${deckKugel}" alt="">` : ''}
      <div class="c-stats">
        ${g.km ? `<span>🛣️ ${g.km} km</span>` : ''}
        ${g.wand ? `<span>🥾 ${tn(g.wand, '{n} Wanderung', '{n} Wanderungen')}${g.wKm ? ' · ' + g.wKm + ' km' : ''}</span>` : ''}
        ${g.fotos ? `<span>📸 ${tn(g.fotos, '{n} Foto', '{n} Fotos')}</span>` : ''}
        ${g.rk ? `<span>💀 ${g.rk} Roadkill</span>` : ''}
        ${g.kur ? `<span>🗿 ${tn(g.kur, '{n} Kuriosität', '{n} Kuriositäten')}</span>` : ''}
        ${g.avgFly ? `<span>🪰 ${t('Ø {wert}/5 Fliegen', { wert: dezimal(g.avgFly, 1) })}</span>` : ''}
      </div>
    </section>`
    const koerper = kapitel.map(kapitelHTML).join('') + bilanzHTML()
    const html = `<!doctype html><html lang="${istEn ? 'en' : 'de'}"><head><meta charset="utf-8">
      <title>${t('Reisetagebuch')} ${esc(titel)}</title><style>${DRUCK_CSS}</style></head>
      <body>${cover}${koerper}</body></html>`
    w.document.open(); w.document.write(html); w.document.close()
    try { w.addEventListener('pagehide', () => { for (const u of bilder.values()) URL.revokeObjectURL(u) }) } catch {}
    let gedruckt = false
    const los = () => { if (gedruckt) return; gedruckt = true; try { w.focus(); w.print() } catch {} }
    w.onload = los
    setTimeout(los, 800) // Fallback, falls onload nicht feuert
  }

  const DRUCK_CSS = `
    @font-face { font-family:'Anton'; src:url('${typeof location !== 'undefined' ? location.origin : ''}/fonts/anton.woff2') format('woff2'); font-display:swap; }
    * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    body { font-family:'Segoe UI',system-ui,sans-serif; color:#2b2621; margin:0; background:#fff; }
    @page { size:A4; margin:16mm 14mm; }
    .cover { text-align:center; padding:70px 20px; page-break-after:always; color:#fff;
      background:linear-gradient(150deg,#8a3f16,#b5451b 55%,#d98a3d); border-radius:0; min-height:75vh;
      display:flex; flex-direction:column; justify-content:center; }
    .c-kicker { font-size:13px; font-weight:800; letter-spacing:0.25em; text-transform:uppercase; opacity:0.9; }
    .c-title { font-family:'Anton',sans-serif; font-weight:400; text-transform:uppercase; letter-spacing:0.02em;
      font-size:64px; line-height:1; margin:14px 0 10px; }
    .c-zeit { font-size:15px; font-weight:600; opacity:0.95; }
    .c-stats { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:26px; }
    .c-stats span { font-size:13px; font-weight:700; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.35);
      padding:6px 13px; border-radius:20px; }
    .tag { page-break-inside:auto; border-top:4px solid var(--akz,#8a3f16); padding-bottom:14px; margin-bottom:20px; }
    .t-kopf { page-break-inside:avoid; padding-top:10px; }
    .t-meta { display:flex; gap:10px; align-items:center; }
    .t-nr { font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#fff;
      background:var(--akz,#8a3f16); padding:2px 9px; border-radius:20px; }
    .t-datum { font-size:12px; color:#5a5248; font-weight:600; }
    .t-reise-print { font-size:11px; font-weight:700; color:#8a3f16; margin-top:4px; }
    .t-route-print { display:flex; flex-wrap:wrap; gap:3px 6px; align-items:center; margin-top:5px; font-size:11px; font-weight:600; color:#5a5248; }
    .t-route-print span { background:#f4ece0; border:1px solid var(--line); border-radius:5px; padding:1px 7px; }
    .t-route-print b { color:#b5451b; }
    .t-route-print em { font-style:normal; font-weight:800; color:#8a3f16; }
    .t-ort { font-family:'Anton',sans-serif; font-weight:400; text-transform:uppercase; font-size:34px; line-height:1.05; margin:6px 0 0; }
    .t-region { font-size:0.5em; color:#b5451b; }
    .t-stats { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    .stat { font-size:11.5px; font-weight:600; color:#5a5248; background:#faf5ec; border:1px solid var(--line); border-radius:20px; padding:3px 10px; }
    .t-lead { font-size:16px; line-height:1.55; font-style:italic; margin:12px 0 4px; }
    .galerie { display:grid; grid-template-columns:1fr 1fr; gap:5px; margin:12px 0 6px; page-break-inside:avoid; }
    .galerie.solo { grid-template-columns:1fr; }
    .galerie.dicht { grid-template-columns:1fr 1fr 1fr; }
    .g-foto { margin:0; aspect-ratio:4/3; overflow:hidden; border-radius:6px; }
    .galerie.viele .g-foto:first-child { grid-column:1/-1; aspect-ratio:16/9; }
    .galerie.solo .g-foto { aspect-ratio:16/9; }
    .g-foto img { width:100%; height:100%; object-fit:cover; display:block; }
    .modul { margin-top:10px; page-break-inside:avoid; }
    .m-titel { font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#8a3f16;
      border-bottom:1px solid var(--line); padding-bottom:5px; margin:0 0 8px; }
    .prosa { margin-bottom:9px; }
    .p-cap { display:block; font-size:11px; font-weight:700; color:#5a5248; }
    .prosa p { margin:1px 0 0; font-size:14px; line-height:1.55; white-space:pre-wrap; }
    .fakten { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .fakt { font-size:12.5px; } .fakt b { color:#8a3f16; }
    .chip { font-size:12px; font-weight:600; background:#f4ece0; border:1px solid var(--line); border-radius:20px; padding:3px 10px; }
    .chip b { color:#8a3f16; }
    .sw { display:inline-block; width:15px; height:15px; border-radius:50%; vertical-align:middle; box-shadow:0 0 0 1px #ccc; }
    .zitate { margin-top:10px; }
    .zitat { page-break-inside:avoid; margin:0 0 12px; padding:4px 0 4px 20px; border-left:4px solid var(--akz,#8a3f16); }
    .zitat p { margin:0; font-size:18px; line-height:1.45; font-style:italic; font-weight:500; }
    .zitat cite { display:block; margin-top:5px; font-size:11.5px; font-style:normal; color:#5a5248; font-weight:700; }
    .kapitel { page-break-before:always; }
    .kapitel:first-of-type { page-break-before:auto; }
    .kap-kopf { border-left:10px solid var(--kf,#8a3f16); padding:6px 0 6px 16px; margin:0 0 14px; page-break-after:avoid; display:flex; align-items:center; gap:14px; }
    .kap-txt { flex:1; }
    .kap-kugel { width:52mm; height:52mm; flex:none; }
    .c-kugel { width:78mm; height:78mm; margin:22px auto 0; display:block; }
    .kap-plan { margin:0 0 14px; page-break-inside:avoid; }
    .kp-route { border-left:4px solid var(--rf,#8a3f16); padding:2px 0 2px 10px; margin-bottom:8px; }
    .kp-r-kopf { font-size:13.5px; } .kp-r-kopf span { font-size:11.5px; color:#5a5248; font-weight:700; margin-left:8px; }
    .kp-stopps { display:flex; flex-wrap:wrap; gap:3px 5px; align-items:center; margin-top:4px; font-size:11px; }
    .kp-stopp { background:#f4ece0; border:1px solid #e5ddd0; border-radius:5px; padding:1px 7px; font-weight:600; }
    .kp-stopps b { color:#b5451b; } .kp-stopps em { font-style:normal; color:#5a5248; }
    .kp-gebucht { font-size:11.5px; color:#5a5248; margin:4px 0 0; }
    .kp-orte { display:flex; flex-wrap:wrap; gap:6px; margin:0 0 12px; page-break-inside:avoid; }
    .kp-ort { width:30mm; margin:0; } .kp-ort img, .kp-ort-leer { width:30mm; height:21mm; object-fit:cover; border-radius:4px; display:block; background:#f4ece0; }
    .kp-ort-leer { display:flex; align-items:center; justify-content:center; }
    .kp-ort figcaption { font-size:9.5px; font-weight:700; margin-top:2px; line-height:1.2; }
    .kp-wand { list-style:none; margin:0 0 12px; padding:0; font-size:12px; } .kp-wand li { margin:2px 0; }
    .kap-kopf h2 { font-family:'Anton',sans-serif; font-weight:400; text-transform:uppercase; font-size:40px; line-height:1.05; margin:0; }
    .kap-kopf span { font-size:13px; font-weight:700; color:#5a5248; }
    .t-unterwegs { font-size:11.5px; font-weight:600; color:#5a5248; margin-top:5px; }
    .wand { margin-top:12px; page-break-inside:avoid; }
    .w-daten { font-size:12.5px; font-weight:700; color:#5a5248; }
    .w-text { font-size:14px; line-height:1.55; margin:4px 0 0; white-space:pre-wrap; }
    .t-bilanz { display:flex; flex-wrap:wrap; gap:8px 14px; margin-top:12px; padding-top:10px; border-top:1px dashed #e5ddd0; }
    .t-bilanz span { font-size:12.5px; font-weight:700; color:#5a5248; }
    .bz-raster { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; page-break-inside:avoid; }
    .bz { border:1px solid #e5ddd0; border-radius:8px; padding:10px 12px; display:flex; flex-direction:column; gap:2px; page-break-inside:avoid; }
    .bz.lang { grid-column:span 2; }
    .bz-i { font-size:18px; }
    .bz b { font-size:22px; font-weight:800; color:#2b2621; font-variant-numeric:tabular-nums; line-height:1.15; }
    .bz span { font-size:12px; font-weight:700; color:#5a5248; }
    .bz em { font-style:normal; font-size:11px; color:#8a3f16; font-weight:600; }
    .bz-fuss { font-size:10.5px; color:#5a5248; margin:10px 0 0; }
  `
</script>

{#if kapitel.length === 0}
  <p class="leer">{t('Noch nichts zu lesen. Sobald du im Logbuch einen Tag schreibst, erscheint er hier als Seite deines Tagebuchs.')}</p>
  <TagebuchFotos {orte} />
{:else}
  <label class="titel-feld">{t('Titel des Tagebuchs')}<input bind:value={titel} placeholder={t('Australien')} /></label>
  <div class="zeige" role="group" aria-label={t('Was ins Tagebuch kommt')}>
    <span class="zeige-lbl">{t('Im Tagebuch zeigen')}</span>
    {#each SCHALTER as [id, icon, label]}
      {#if id !== 'geraet' || $tagebuchFotos.length}
        <button class="zeige-chip" class:an={zeige[id]} aria-pressed={zeige[id]} onclick={() => schalte(id)}><span aria-hidden="true">{icon}</span> {label}</button>
      {/if}
    {/each}
  </div>
  <div class="werkzeug">
    <div class="fassung" role="group" aria-label={t('Fassung')}>
      <button class="f-btn" class:an={fassung === 'kurz'} onclick={() => (fassung = 'kurz')}
        title={t('Nur Bild, Text und Kennzahlen je Tag')}>{t('📄 Kurzfassung')}</button>
      <button class="f-btn" class:an={fassung === 'lang'} onclick={() => (fassung = 'lang')}
        title={t('Zusätzlich alle ausgefüllten Module, Notizen und Bilanz')}>{t('📖 Ausführlich')}</button>
    </div>
    {#if alleFotos.length}
      <button class="wz" onclick={() => (kollageAuf = true)}>{t('✨ Kollage ({length})', { length: alleFotos.length })}</button>
    {/if}
    <button class="wz druck" onclick={druckFotobuch}>{t('🖨️ Als Tagebuch drucken oder PDF ({wert})', { wert: fassung === 'kurz' ? 'kurz' : t('ausführlich') })}</button>
    <button class="wz" onclick={() => (reihenfolge = reihenfolge === 'alt' ? 'neu' : 'alt')}>
      ⇅ {reihenfolge === 'alt' ? t('Älteste zuerst') : t('Neueste zuerst')}
    </button>
  </div>
  <TagebuchFotos {orte} />

  <div class="magazin">
    <!-- Deckblatt -->
    <header class="deckblatt">
      <div class="d-kicker">{t('Mein Reisetagebuch')}</div>
      <h2 class="d-title">{titel}</h2>
      {#if gesamt.von}
        <div class="d-zeit">{tn(gesamt.tage, '{datumKurz} – {datumKurz2} · {n} Reisetag', '{datumKurz} – {datumKurz2} · {n} Reisetage', { datumKurz: datumKurz(gesamt.von), datumKurz2: datumKurz(gesamt.bis) })}</div>
      {/if}
      {#if zeige.kugeln && ganzeKugel}
        <div class="d-kugel"><Weltkugel {...ganzeKugel} groesse={breitesBild ? 300 : 230} minP={2} titel="Weltkugel mit der ganzen Reise" /></div>
      {/if}
      <div class="d-stats">
        {#if gesamt.km}<span>🛣️ {gesamt.km} km</span>{/if}
        {#if gesamt.wand}<span>{tn(gesamt.wand, '🥾 {n} Wanderung', '🥾 {n} Wanderungen')}{#if gesamt.wKm}&nbsp;· {gesamt.wKm} km{/if}</span>{/if}
        {#if gesamt.fotos}<span>{tn(gesamt.fotos, '📸 {n} Foto', '📸 {n} Fotos')}</span>{/if}
        {#if gesamt.rk}<span>{t('💀 {rk} Roadkill', { rk: gesamt.rk })}</span>{/if}
        {#if gesamt.kur}<span>{tn(gesamt.kur, '🗿 {n} Kuriosität', '🗿 {n} Kuriositäten')}</span>{/if}
        {#if gesamt.avgFly}<span>🪰 Ø {dezimal(gesamt.avgFly, 1)}/5</span>{/if}
      </div>
    </header>

    {#each kapitel as k (k.id)}
    {@const pl = plaene.get(k.id)}
    <section class="kapitel" style="--kf:{k.farbe}">
      <header class="kap-kopf" class:mit-kugel={zeige.kugeln && pl?.kugel}>
        <div class="kap-txt">
          <h2>{k.titel}</h2>
          {#if k.untertitel}<span>{k.untertitel}{#if k.etappe}&nbsp;· {tageText(k.etappe.tage)}{/if}</span>{/if}
        </div>
        {#if zeige.kugeln && pl?.kugel}
          <Weltkugel {...pl.kugel} groesse={breitesBild ? 200 : 132} titel="Weltkugel: {k.titel}" />
        {/if}
      </header>
      {#if pl && zeige.etappen}
        <div class="kap-plan">
          {#each pl.routen as x (x.id)}
            {@const st = mitKoord(x)}
            <div class="kp-route" style="--rf:{x.farbe || k.farbe}">
              <div class="kp-r-kopf"><b>{istFlug(x) ? '✈️' : '🛣️'} {x.name}</b>{#if x.route?.km}<span>{zahl(x.route.km)} km</span>{/if}</div>
              <div class="kp-stopps">{#each st.slice(0, 10) as p, i}<span class="kp-stopp">{p.name}</span>{#if i < Math.min(st.length, 10) - 1}<span class="kp-pfeil" aria-hidden="true">→</span>{/if}{/each}{#if st.length > 10}<span class="kp-mehr">+{st.length - 10}</span>{/if}</div>
            </div>
          {/each}
          {#if pl.gebucht.length}
            <p class="kp-gebucht">{t('🧾 {length} gebucht: {join}{wert}', { length: pl.gebucht.length, join: pl.gebucht.slice(0, 4).map((b) => (b.emoji || katInfo(b.kat).icon) + ' ' + b.titel).join(' · '), wert: pl.gebucht.length > 4 ? ' …' : '' })}</p>
          {/if}
          {#if !k.tage.length}<p class="kp-leer">{t('Noch nichts geschrieben. Die Seiten entstehen aus deinen Logbuch-Tagen dieser Etappe.')}</p>{/if}
        </div>
      {/if}
      {#if pl && zeige.orte && pl.orte.length}
        <div class="kp-orte" role="region" aria-label={t('Orte der Etappe {titel}', { titel: k.titel })} tabindex="0">
          {#each pl.orte as o (o.id)}
            {@const b = bildVon(o)}
            <figure class="kp-ort">{#if b}<img src={b} alt="" loading="lazy" />{:else}<span class="kp-ort-leer" aria-hidden="true">📍</span>{/if}<figcaption>{o.name}</figcaption></figure>
          {/each}
        </div>
      {/if}
      {#if pl && zeige.wanderungen && pl.wand.length}
        <ul class="kp-wand">
          {#each pl.wand as w (w.id)}
            <li><span aria-hidden="true">{w.status === 'gemacht' ? '✅' : '🥾'}</span> <b>{w.name}</b>{#if w.datum}<small>&nbsp;· {tagMonatJahr(w.datum)}</small>{/if}{#if w.km}<small>&nbsp;· {w.km} km</small>{/if}</li>
          {/each}
        </ul>
      {/if}
    {#each k.tage as tg (tg.datum)}
    {#if !tg.journal.length}
      <article class="tag" style="--akz:{k.farbe}">
        <header class="t-kopf"><div class="t-meta">{#if nrAm.get(tg.datum)}<span class="t-nr">{t('Tag {get}', { get: nrAm.get(tg.datum) })}</span>{/if}<span class="t-datum">{datumLang(tg.datum)}</span></div>
          {#if zeige.etappen && reiseZeile(tg).length}<div class="t-unterwegs">{reiseZeile(tg).map((b) => (b.emoji || katInfo(b.kat).icon) + ' ' + b.titel).join(' · ')}</div>{/if}
        </header>
        {@render geraetGalerie(tg.fotos)}
        {@render extras(tg)}
      </article>
    {/if}
    {#each tg.journal as e, ji (e.id)}
      {@const stats = quickStats(e)}
      {@const bil = bilanz(e)}
      {@const fotos = e.fotos || []}
      {@const tagNotizen = e.datum ? $notizen.filter((n) => notizDatum(n) === e.datum) : []}
      {@const rt = reiseTag(e)}
      <article class="tag" style="--akz:{akzent(e)}">
        <header class="t-kopf">
          <div class="t-meta">
            {#if nrAm.get(e.datum)}<span class="t-nr">{t('Tag {get}', { get: nrAm.get(e.datum) })}</span>{/if}
            <span class="t-datum">{datumLang(e.datum)}</span>
            {#if rt}<span class="t-reise" style="--rf:{rt.farbe}">🧭 {rt.name}{rt.abschnitt}{#if rt.km && !rt.ganze}{' · '}🛣️ {rt.km} km{/if}</span>{/if}
          </div>
          {#if rt?.ganze && rt.stops?.length}
            <div class="t-route">
              {#each rt.stops as st, i}<span class="t-stop">{st}</span>{#if i < rt.stops.length - 1}<span class="t-arr">→</span>{/if}{/each}
              {#if rt.km}<span class="t-route-km">🛣️ {rt.km} km</span>{/if}
            </div>
          {/if}
          {#if ji === 0 && zeige.etappen && reiseZeile(tg).length}<div class="t-unterwegs">{reiseZeile(tg).map((b) => (b.emoji || katInfo(b.kat).icon) + ' ' + b.titel).join(' · ')}</div>{/if}
          {#if e.ort}
            <h3 class="t-ort">{e.ort}{#if region(e)}<span class="t-region"> · {region(e)}</span>{/if}</h3>
          {/if}
          {#if stats.length}
            <div class="t-stats">
              {#each stats as s}<span class="stat"><b>{s.icon}</b> {s.text}</span>{/each}
            </div>
          {/if}
        </header>

        {#if hatWert(e.text)}
          <p class="t-lead">{e.text}</p>
        {/if}

        {#if fotos.length}
          <div class="galerie" class:viele={fotos.length > 2} class:solo={fotos.length === 1}>
            {#each fotos as src}
              <figure class="g-foto"><img {src} alt={t('Reisefoto')} loading="lazy" /></figure>
            {/each}
          </div>
        {/if}
        {#if ji === 0}{@render geraetGalerie(tg.fotos)}{/if}

        {#if (e.audios || []).length}
          <div class="t-audio">
            {#each e.audios as a}<audio controls src={a}></audio>{/each}
          </div>
        {/if}

        {#if fassung === 'lang'}
        {#each themen as m}
          {#if modulHatInhalt(e, m)}
            {#if m.zitat}
              <div class="zitate">
                {#each m.felder as f}
                  {#if hat(e, f.id)}
                    <blockquote class="zitat">
                      <p>{wert(e, f.id)}</p>
                      <cite>{f.icon} {f.label}</cite>
                    </blockquote>
                  {/if}
                {/each}
              </div>
            {:else}
              {@const kompakt = m.felder.filter((f) => !istProsa(f) && hat(e, f.id))}
              <section class="modul">
                <h3 class="m-titel"><span>{m.icon}</span> {m.titel}</h3>
                {#each m.felder as f}
                  {#if istProsa(f) && hat(e, f.id)}
                    <div class="prosa">
                      <span class="p-cap">{f.icon} {f.label}</span>
                      <p>{wert(e, f.id)}</p>
                    </div>
                  {/if}
                {/each}
                {#if kompakt.length}
                  <div class="fakten">
                    {#each kompakt as f}
                      {#if f.typ === 'rating'}
                        <span class="fakt">{f.icon} {f.label}: <b>{wert(e, f.id)}/{f.max}</b> {(f.symbol || '⭐').repeat(f.max <= 5 ? wert(e, f.id) : 1)}</span>
                      {:else if f.typ === 'tags'}
                        {#each wert(e, f.id) as tg}<span class="chip">{t(tg)}</span>{/each}
                      {:else if f.typ === 'counter'}
                        {#each counterEintraege(f.id, wert(e, f.id)) as c}<span class="chip zahl">{c.emoji} {c.label} <b>×{c.n}</b></span>{/each}
                      {:else if f.typ === 'farbe'}
                        <span class="fakt">{f.icon} {f.label}:
                          {#if /^#[0-9a-f]{3,8}$/i.test(wert(e, f.id))}<span class="sw" style="background:{wert(e, f.id)}"></span>{:else}<b>{wert(e, f.id)}</b>{/if}
                        </span>
                      {:else}
                        <span class="chip">{f.icon} {t(wert(e, f.id))}</span>
                      {/if}
                    {/each}
                  </div>
                {/if}
              </section>
            {/if}
          {/if}
        {/each}

        {#if tagNotizen.length}
          <section class="modul tagnotizen">
            <h3 class="m-titel"><span>🗒️</span> {t('Notizen dieses Tages')}</h3>
            <ul class="tn-liste">
              {#each tagNotizen as n}
                <li class:erl={n.erledigt}>{NOTIZ_TYP[n.typ]?.icon} {n.text}</li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if bil.length}
          <footer class="t-bilanz">{#each bil as b}<span>{b}</span>{/each}</footer>
        {/if}
        {/if}
        {#if ji === tg.journal.length - 1}{@render extras(tg)}{/if}
      </article>
    {/each}
    {/each}
    </section>
    {/each}

    {#if zeige.bilanz && bilanzK.length}
      <section class="kapitel bilanz" style="--kf: var(--brand)" aria-labelledby="bilanz-titel">
        <header class="kap-kopf">
          <div class="kap-txt">
            <h2 id="bilanz-titel">{t('Bilanz')}</h2>
            <span>{t('{titel} in Zahlen', { titel })}</span>
          </div>
        </header>
        <ul class="bz-raster">
          {#each bilanzK as x, i (x.id)}
            <li class="bz rein" class:lang={x.lang} style="--i:{i}">
              <span class="bz-i" aria-hidden="true">{x.icon}</span>
              <b class="bz-wert">{x.wert}</b>
              <span class="bz-text">{x.text}</span>
              {#if x.zusatz}<span class="bz-zusatz">{x.zusatz}</span>{/if}
            </li>
          {/each}
        </ul>
        {#if reiseBilanz.kosten}<p class="bz-fuss">{t('Beträge zum Tageskurs umgerechnet, ohne Kurs mit Näherungswert. Ausgaben vor der Reise sind nicht dabei.')}</p>{/if}
      </section>
    {/if}
  </div>
{/if}

{#snippet geraetGalerie(liste)}
  {#if liste.length}
    <div class="galerie geraet" class:viele={liste.length > 2} class:solo={liste.length === 1} class:dicht={liste.length > 6}>
      {#each liste as f, i (f.id)}
        <!-- Das große Bild oben in voller Auflösung, die anderen als Vorschau -->
        <figure class="g-foto"><img use:geraetBild={{ id: f.id, art: i === 0 && liste.length !== 2 ? 'gross' : 'klein' }} alt={f.ort ? t('Foto aus {ort}', { ort: f.ort }) : t('Reisefoto')} decoding="async" /></figure>
      {/each}
    </div>
  {/if}
{/snippet}

{#snippet extras(tg)}
  {#each wandDesTages(tg) as w (w.id)}
    <section class="modul wand">
      <h3 class="m-titel"><span>🥾</span> {t('Wanderung: {name}', { name: w.name })}</h3>
      <div class="w-daten">{[w.km ? w.km + ' km' : '', dauerText(w.dauerMin), w.hoehenmeter ? '↑ ' + w.hoehenmeter + ' hm' : '', S_MAP[w.schwierigkeit]?.label, w.bewertung ? '★'.repeat(w.bewertung) : ''].filter(Boolean).join(' · ')}</div>
      {#if (w.beschreibung || '').trim()}<p class="w-text">{w.beschreibung}</p>{/if}
      {#if (w.fotos || []).length}
        <div class="galerie" class:solo={w.fotos.length === 1}>{#each w.fotos as src}<figure class="g-foto"><img {src} alt={t('Foto von der Wanderung')} loading="lazy" /></figure>{/each}</div>
      {/if}
    </section>
  {/each}
  {#each ortTageDes(tg) as o (o.id)}
    <section class="modul wand"><h3 class="m-titel"><span>📍</span> {o.ortName}</h3>{#if (o.text || '').trim()}<p class="w-text">{o.text}</p>{/if}</section>
  {/each}
{/snippet}

{#if kollageAuf}<Kollage fotos={alleFotos} titel={t('Mein Reisetagebuch: ') + titel} schliessen={() => (kollageAuf = false)} />{/if}

<style>
  .titel-feld { display: flex; flex-direction: column; gap: 4px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-bottom: 12px; max-width: 420px; }
  .titel-feld input { min-height: 44px; font-size: max(16px, calc(17px * var(--schrift, 1))); padding: 6px 12px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); font-weight: 600; }
  .kapitel { margin-top: 26px; }
  .kap-kopf { border-left: 8px solid var(--kf); padding: 4px 0 4px 14px; margin-bottom: 14px; display: flex; align-items: center; gap: 12px; }
  .kap-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .kap-kopf.mit-kugel { margin-bottom: 6px; }
  .zeige { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
  .zeige-lbl { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-right: 2px; }
  .zeige-chip {
    min-height: 40px; padding: 0 13px; border-radius: 20px; border: 1px dashed var(--line-stark); background: var(--card);
    color: var(--muted); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer;
    transition: background-color var(--t-med) var(--ease-out), color var(--t-med) var(--ease-out), border-color var(--t-med) var(--ease-out);
  }
  .zeige-chip.an { border-style: solid; border-color: var(--ink); background: var(--ink); color: var(--bg); }
  .d-kugel { display: flex; justify-content: center; margin: 14px 0 4px; }
  .kap-plan { display: flex; flex-direction: column; gap: 8px; margin: 0 0 12px; }
  .kp-route { border-left: 4px solid var(--rf); padding: 2px 0 2px 10px; }
  .kp-r-kopf { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: calc(14.5px * var(--schrift, 1)); color: var(--ink); }
  .kp-r-kopf span { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .kp-stopps { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 5px; margin-top: 5px; }
  .kp-stopp { font-size: calc(12px * var(--schrift, 1)); font-weight: 600; color: var(--ink); background: var(--flaeche); border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; }
  .kp-pfeil { color: var(--brand-2); font-weight: 800; font-size: calc(12px * var(--schrift, 1)); }
  .kp-mehr { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .kp-gebucht, .kp-leer { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .kp-leer { background: var(--flaeche); border-radius: 10px; padding: 10px 12px; }
  .kp-orte:focus-visible { outline: 2px solid var(--brand-2); outline-offset: 2px; border-radius: 8px; }
  .kp-orte { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 10px; margin-bottom: 4px; scrollbar-width: thin; }
  .kp-ort { flex: none; width: 92px; margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .kp-ort img, .kp-ort-leer { width: 92px; height: 68px; border-radius: 8px; object-fit: cover; background: var(--flaeche-2); }
  .kp-ort-leer { display: grid; place-items: center; font-size: calc(22px * var(--schrift, 1)); }
  .kp-ort figcaption { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--ink); line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .kp-wand { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .kp-wand li { font-size: calc(13.5px * var(--schrift, 1)); color: var(--ink); }
  .kp-wand small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .kap-kopf h2 { font-family: 'Anton', Impact, sans-serif; font-weight: 400; text-transform: uppercase; font-size: calc(30px * var(--schrift, 1)); line-height: 1.05; margin: 0; color: var(--ink); letter-spacing: 0.3px; }
  .kap-kopf span { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .t-unterwegs { font-size: calc(13px * var(--schrift, 1)); font-weight: 600; color: var(--muted); margin-top: 4px; }
  .wand { margin-top: 12px; }
  .w-daten { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .w-text { font-size: calc(15px * var(--schrift, 1)); line-height: 1.55; margin: 4px 0 0; white-space: pre-wrap; }
  .leer { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); background: var(--flaeche); padding: 16px; border-radius: 10px; }

  /* Werkzeugleiste */
  .fassung { display: inline-flex; gap: 0; border: 1px solid var(--line-stark); border-radius: 18px; overflow: hidden; }
  .f-btn {
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; padding: 8px 14px; min-height: 38px; cursor: pointer;
    border: none; background: var(--card); color: var(--muted);
  }
  .f-btn.an { background: var(--brand); color: #fff; }
  .werkzeug { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .wz {
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; padding: 8px 14px; border: 1px solid var(--line);
    background: var(--card); color: var(--muted); border-radius: 20px; cursor: pointer;
  }
  .wz.druck { background: var(--brand); color: #fff; border-color: var(--brand); }

  .magazin { display: flex; flex-direction: column; gap: 24px; }

  /* Deckblatt */
  .deckblatt {
    text-align: center; padding: 40px 24px; border-radius: 16px; color: #fff;
    background: linear-gradient(150deg, #8a3f16, #b5451b 55%, #d98a3d);
    box-shadow: var(--shadow);
  }
  .d-kicker { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.9; }
  .d-title {
    font-family: 'Anton', system-ui, sans-serif; font-weight: 400; text-transform: uppercase;
    font-size: calc(clamp(34px, 8vw, 58px) * var(--schrift, 1)); line-height: 1; letter-spacing: 0.02em; margin: 10px 0 8px;
  }
  .d-zeit { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 600; opacity: 0.96; }
  .d-stats { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; margin-top: 18px; }
  .d-stats span {
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; background: rgba(255,255,255,0.18);
    border: 1px solid rgba(255,255,255,0.35); padding: 5px 12px; border-radius: 20px;
  }

  .tag {
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    box-shadow: var(--shadow); overflow: hidden; padding: 0 0 4px; border-top: 4px solid var(--akz);
  }

  .t-kopf { padding: 16px 22px 4px; }
  .t-meta { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .t-nr {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    color: #fff; background: var(--akz); padding: 2px 9px; border-radius: 20px;
  }
  .t-datum { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .t-reise { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: #fff; background: var(--rf, var(--brand)); padding: 2px 9px; border-radius: 20px; }
  .t-route { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; margin-top: 9px; }
  .t-stop { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--ink); background: var(--flaeche); border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; }
  .t-arr { color: var(--brand-2); font-weight: 800; }
  .t-route-km { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); margin-left: 3px; }
  .t-ort {
    font-family: 'Anton', system-ui, sans-serif; font-weight: 400;
    font-size: calc(clamp(27px, 5.4vw, 42px) * var(--schrift, 1)); line-height: 1.05; letter-spacing: 0.01em;
    color: var(--ink); margin: 6px 0 0; text-transform: uppercase;
  }
  .t-region { font-size: 0.5em; color: var(--brand-text); letter-spacing: 0; vertical-align: middle; }
  .t-stats { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .stat {
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 600; color: var(--muted); background: var(--flaeche);
    border: 1px solid var(--line); border-radius: 20px; padding: 4px 11px;
  }
  .stat b { font-weight: 400; }

  .t-lead { margin: 14px 22px 4px; font-size: calc(17.5px * var(--schrift, 1)); line-height: 1.55; color: var(--ink); font-style: italic; }

  .galerie { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 14px 0 6px; padding: 0 5px; }
  .galerie.solo { grid-template-columns: 1fr; }
  .galerie.dicht { grid-template-columns: 1fr 1fr 1fr; }
  .g-foto { margin: 0; aspect-ratio: 4 / 3; overflow: hidden; border-radius: 6px; background: #eee2cf; }
  .galerie.viele .g-foto:first-child { grid-column: 1 / -1; aspect-ratio: 16 / 9; }
  .galerie.solo .g-foto { aspect-ratio: 16 / 9; max-height: 440px; }
  .g-foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .g-foto img:not([src]) { visibility: hidden; }
  @media (max-width: 520px) { .galerie.dicht { grid-template-columns: 1fr 1fr; } }

  .t-audio { display: flex; flex-direction: column; gap: 6px; padding: 6px 22px; }
  .t-audio audio { width: 100%; max-width: 420px; height: 34px; }

  .modul { padding: 6px 22px 2px; margin-top: 8px; }
  .m-titel {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--brand-text); margin: 0 0 8px; display: flex; align-items: center; gap: 6px;
    border-bottom: 1px solid var(--line); padding-bottom: 6px;
  }
  .m-titel span { font-size: calc(15px * var(--schrift, 1)); }
  .prosa { margin-bottom: 11px; }
  .p-cap { display: block; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-bottom: 2px; }
  .prosa p { margin: 0; font-size: calc(15.5px * var(--schrift, 1)); line-height: 1.6; color: var(--ink); white-space: pre-wrap; }
  .fakten { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 4px; }
  .fakt { font-size: calc(13px * var(--schrift, 1)); color: var(--ink); }
  .fakt b { color: var(--brand-text); }
  .tn-liste { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
  .tn-liste li { font-size: calc(14px * var(--schrift, 1)); color: var(--ink); }
  .tn-liste li.erl { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); text-decoration: line-through; }
  .chip {
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 600; color: var(--ink); background: var(--flaeche-2);
    border: 1px solid var(--line); border-radius: 20px; padding: 4px 11px;
  }
  .chip.zahl b { color: var(--brand-text); }
  .sw { display: inline-block; width: 16px; height: 16px; border-radius: 50%; vertical-align: middle; box-shadow: 0 0 0 1px #ccc; }

  .zitate { padding: 8px 22px; margin-top: 8px; }
  .zitat { position: relative; margin: 0 0 14px; padding: 6px 0 6px 22px; border-left: 4px solid var(--akz); }
  .zitat p { margin: 0; font-size: calc(20px * var(--schrift, 1)); line-height: 1.5; color: var(--ink); font-style: italic; font-weight: 500; }
  .zitat cite { display: block; margin-top: 6px; font-size: calc(12px * var(--schrift, 1)); font-style: normal; color: var(--muted); font-weight: 700; }

  .t-bilanz {
    display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 12px 22px 0; padding: 12px 0 4px;
    border-top: 1px dashed var(--line);
  }
  .t-bilanz span { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }

  /* Bilanz */
  .bz-raster { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .bz {
    background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); box-shadow: var(--shadow);
    padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0;
  }
  .bz.lang { grid-column: span 2; }
  .bz-i { font-size: calc(20px * var(--schrift, 1)); line-height: 1.2; }
  .bz-wert { font-size: calc(24px * var(--schrift, 1)); font-weight: 800; line-height: 1.15; color: var(--ink); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .bz-text { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .bz-zusatz { font-size: calc(12.5px * var(--schrift, 1)); color: var(--brand-text); font-weight: 600; }
  .bz-fuss { margin: 10px 0 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  @media (max-width: 360px) { .bz.lang { grid-column: auto; } }

  @media (max-width: 520px) {
    .t-kopf, .t-lead, .modul, .zitate, .t-bilanz, .t-audio { padding-left: 15px; padding-right: 15px; }
    .t-lead, .t-bilanz { margin-left: 15px; margin-right: 15px; }
  }
</style>
