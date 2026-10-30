<script>
  import { t, tn, LOCALE, istEn } from './lib/i18n.js'
  import { dezimal, ZWEI, eur, aud, zahl } from './lib/format.js'
  import Ort from './lib/Ort.svelte'
  import Uebersicht from './lib/Uebersicht.svelte'
  import Routen from './lib/Routen.svelte'
  import Kalender from './lib/Kalender.svelte'
  import Praxis from './lib/Praxis.svelte'
  import Karte from './lib/Karte.svelte'
  import TagebuchLese from './lib/TagebuchLese.svelte'
  import PlanAnsicht from './lib/PlanAnsicht.svelte'
  import EtappeDetail from './lib/EtappeDetail.svelte'
  import LogbuchAnsicht from './lib/LogbuchAnsicht.svelte'
  import TagBlatt from './lib/TagBlatt.svelte'
  import Tierwelt from './lib/Tierwelt.svelte'
  import Teilen from './lib/Teilen.svelte'
  import OfflineCheck from './lib/OfflineCheck.svelte'
  import { strassenlage, starteStrassenlage, aktualisiereStrassenlage } from './lib/strassenlage-dienst.js'
  import { zaehleStrassen } from './lib/strassenlage.js'
  import Heute from './lib/Heute.svelte'
  import NeuBlatt from './lib/NeuBlatt.svelte'
  import Einfuehrung from './lib/Einfuehrung.svelte'
  import { einfuehrungStarten } from './lib/einfuehrung.js'
  import OrtNeu from './lib/OrtNeu.svelte'
  import Seitenleiste from './lib/Seitenleiste.svelte'
  import RoutenDienst from './lib/RoutenDienst.svelte'
  import DialogHost from './lib/DialogHost.svelte'
  import TresorDialog from './lib/TresorDialog.svelte'
  import { frage, hinweis, loeschFrage } from './lib/dialog.js'
  import { neuAnfrage, oeffneNeu } from './lib/neu.js'
  import { leseAdresse, geh, merke, zurueck } from './lib/navigation.js'
  import { etappenMitDatum, planUeberblick, reiseZeitraum, ymd as ymdPlan } from './lib/plan.js'
  import Quiz from './lib/Quiz.svelte'
  import Packliste from './lib/Packliste.svelte'
  import XoxoSpiel from './lib/XoxoSpiel.svelte'
  import SnakeSpiel from './lib/SnakeSpiel.svelte'
  import VierSpiel from './lib/VierSpiel.svelte'
  import Suchblatt from './lib/Suchblatt.svelte'
  import { passtOrt } from './lib/suche.js'
  import { tick } from 'svelte'
  import Notizen from './lib/Notizen.svelte'
  import Wanderungen from './lib/Wanderungen.svelte'
  import Notfall from './lib/Notfall.svelte'
  import ReiseKarte from './lib/ReiseKarte.svelte'
  import Reisevorbereitung from './lib/Reisevorbereitung.svelte'
  import BottomBar from './lib/BottomBar.svelte'
  import Toast from './lib/Toast.svelte'
  import { zeigeToast } from './lib/toast.js'
  import { haptic } from './lib/haptik.js'
  import { theme, setzeTheme } from './lib/theme.js'
  import { zaehlHoch, erscheine, leisteRand, wechsel, bildwechsel } from './lib/motion.js'
  import { fehlerText } from './lib/fehlertext.js'
  import MusikSymbol from './lib/musik/MusikSymbol.svelte'
  import MusikSeite from './lib/musik/MusikSeite.svelte'
  import { starteMusik, setzeOrte } from './lib/musik/dienst.js'
  import { quizAntworten } from './lib/userdata.js'
  import { auswerten } from './lib/quiz.js'
  import { istReisekalender, leseReisekalender, kalenderInfo, baueAbschnitte } from './lib/reisekalender.js'
  import { initUserData, userData, exportBackup, leseBackup, saeubereBackup, wendeBackupAn, backupInfo, datenStand, syncZeiten,
    eigeneOrte, updateEigenenOrt, loescheEigenenOrt, gefahrenCache, journal, reisen, reiseBudget, vorabKosten, buchungen, importiereReisekalender,
    vorschauZusammenfuehren, fuehreBackupZusammen, importRueckgaengig, schnappschuss, rettung,
    gesamtStart, reiseTage, ready } from './lib/userdata.js'
  import { get } from 'svelte/store'
  import { modal } from './lib/modal.js'
  import Handbuch from './lib/Handbuch.svelte'
  import { holeOrtsdaten } from './lib/ortdaten.js'
  import { FELD } from './lib/journal-schema.js'
  import { haversine, luftlinieKm } from './lib/routing.js'
  import { fxKurse, stelleKursBereit, kursFuer, inBeide } from './lib/fx.js'
  import { online } from './lib/netz.js'
  import { rubrikPatch, setzeVorlagen } from './lib/rubrik.js'
  import Gefahren from './lib/Gefahren.svelte'
  import { holeGefahren, holeStandortGefahr } from './lib/gefahren.js'
  import { holeWarnungen, warnungFuer, auffaelligeBedingungen, abstandKm } from './lib/warnungen.js'
  import { rundeAufSumme } from './lib/runden.js'
  import { standort, standortStatus, standortFehler, starteStandort, frageStandortAn, standortHinweis } from './lib/standort.js'

  let orte = $state([])
  let routen = $state([])
  let inhalt = $state(null)
  let quizData = $state({ fragen: [], levels: [] })
  let zeigeLevel = $state(false)
  // Statistik auf Heute aufklappbar (Standard: oben steht, was als Nächstes kommt). Nichts fällt
  // weg; offen oder zu merkt sich das Gerät, zu stehen die wichtigsten Zahlen in der Zeile.
  let zahlenOffen = $state((() => { try { return localStorage.getItem('tb-heute-zahlen') === 'offen' } catch { return false } })())
  $effect(() => { try { localStorage.setItem('tb-heute-zahlen', zahlenOffen ? 'offen' : 'zu') } catch {} })
  let laden = $state(true)
  let fehler = $state(null)
  let suche = $state('')
  let aktiveTags = $state([])

  const ALLE_TAGS = ['MUSS-SEHEN', 'GEHEIMTIPP', 'NUR-4WD', 'EXPEDITION', 'MEIN ORT']
  // ---- Navigation: jeder Bereich ist ein eigener Bildschirm ----
  // Adresse hinter dem # (navigation.js). Zurück-Wischen und Zurück-Taste funktionieren.
  let ansicht = $state(leseAdresse())
  let hauptEl = $state(null)
  const scrollStand = new Map()
  let letzterPfad = ansicht.pfad
  merke(ansicht.pfad)
  $effect(() => {
    const neu = async () => {
      scrollStand.set(letzterPfad, window.scrollY)
      const a = leseAdresse()
      // Alte Sprungmarken (#tagebuch …) still auf die neue Adresse umschreiben
      if (location.hash && !location.hash.startsWith('#/')) history.replaceState(null, '', '#/' + a.pfad)
      merke(a.pfad)
      const alt = ansicht
      // Richtung: tiefer hinein von rechts, zurück von links, sonst kurz von unten
      const r = alt.pfad === a.pfad ? null
        : alt.tab !== a.tab ? 0
        : a.pfad.startsWith(alt.pfad + '/') ? 1
        : alt.pfad.startsWith(a.pfad + '/') ? -1
        : (alt.unter === 'tag' && a.unter === 'tag') ? (a.pfad > alt.pfad ? 1 : -1)
        : 0
      const umschalten = async () => {
        ansicht = a
        letzterPfad = a.pfad
        await tick()
        window.scrollTo({ top: scrollStand.get(a.pfad) || 0, behavior: 'instant' })
      }
      if (r === null) { await umschalten(); return }
      // Bevorzugt: View Transition (der Browser blendet zwischen zwei Bildern über, ohne
      // Layout je Bild). Sonst die bisherige Einblendung des neuen Inhalts.
      // Nicht bei Tabs und Bereichen (r = 0): das Bild der ganzen langen Seite ruckelt am iPhone
      if (r !== 0 && bildwechsel(hauptEl, r, umschalten)) return
      await umschalten()
      wechsel(hauptEl, r)
    }
    window.addEventListener('hashchange', neu)
    return () => window.removeEventListener('hashchange', neu)
  })
  const aktivTab = $derived(ansicht.tab)
  // main.js wartet beim Sprachwechsel darauf
  let { onbereit = () => {} } = $props()
  $effect(() => { if (!laden && $ready) tick().then(onbereit) })
  // Unterpunkte je Bereich: oben als Umschalter (iPhone) und in der Seitenleiste (Mac)
  const UNTER = {
    plan: [['plan', t('Etappen')], ['plan/wanderungen', t('Wanderungen')], ['plan/karte', t('Karte')], ['plan/kalender', t('Kalender')]],
    orte: [['orte/sueden', t('Süden')], ['orte/norden', t('Norden')], ['orte/osten', t('Ostküste')], ['orte/meine', t('Meine Orte')], ['orte/routen', t('Routen-Ideen')]],
    logbuch: [['logbuch', t('Tage')], ['logbuch/lesen', t('Lesen')], ['logbuch/tiere', t('Tierwelt')], ['logbuch/notizen', t('Notizen')]],
    // Dieselben Namen und Zeichen wie im Mehr-Blatt am iPhone und in den Seitentiteln
    mehr: [['mehr/notfall', t('🆘 Notfall')], ['mehr/vorbereitung', t('🧳 Reisevorbereitung')], ['mehr/gefahren', t('⚠️ Gefahrenlage')], ['mehr/packliste', t('🎒 Packliste')], ['mehr/praxis', t('🛠️ Praxis & Sicherheit')], ['mehr/musik', t('🎵 Musik unterwegs')], ['mehr/teilen', t('📤 Reisebericht teilen')], ['mehr/quiz', t('🇦🇺 Australien-Quiz')]],
  }
  const TITEL = { heute: t('Heute'), plan: t('Plan'), orte: t('Orte'), logbuch: t('Logbuch'), mehr: t('Mehr') }
  // Eine Zeile je Punkt unter „Mehr“: was steckt dahinter (nur Namen, kein Wort dazu)
  const MEHR_INFO = {
    'mehr/notfall': t('Notrufnummern, nächste Hilfe und dein Standort zum Durchsagen. Geht auch offline.'),
    'mehr/vorbereitung': t('Checkliste bis zur Abreise, Dokumente, Buchungen und Ausgaben vorab.'),
    'mehr/gefahren': t('Amtliche Warnungen zu Feuer, Flut und Hitze rund um deine Orte und Routen.'),
    'mehr/packliste': t('Zum Abhaken, abgestimmt auf allein mit dem Auto durchs Outback.'),
    'mehr/praxis': t('Was du vorab buchen musst, Permits, Tanken im Norden, Reifen, Buschfeuer.'),
    'mehr/musik': t('Sounds of the Road: Musik aus der Gegend, unterwegs in einer Spotify-Playlist gesammelt.'),
    'mehr/teilen': t('Reisebericht als eine Datei für Familie und Freunde. Ohne Buchungen, Kosten und Dokumente.'),
    'mehr/quiz': t('Fragen zu Australien. Mit jeder richtigen Antwort steigst du eine Stufe auf.'),
  }
  const orteUnter = $derived(ansicht.tab === 'orte' ? (ansicht.unter || 'sueden') : '')
  // Neu-Blatt (auch von Ortskacheln aus, über neu.js)
  const neuOffen = $derived($neuAnfrage)
  function neuFertig(r) {
    neuAnfrage.set(null)
    if (r.typ === 'etappe') geh('plan/etappe/' + r.id)
    else if (r.typ === 'route') geh(r.etappeId ? `plan/etappe/${r.etappeId}/${r.id}` : 'plan/route/' + r.id)
    else if (r.typ === 'wanderung') geh('plan/wanderungen/' + r.id)
    else if (r.typ === 'buchung') geh(r.etappeId ? 'plan/etappe/' + r.etappeId : 'mehr/vorbereitung')
    else geh('logbuch/tag/' + r.datum)
  }

  // Gefahrenlage
  let ortGefahren = $state({})
  let standortGefahr = $state(null)
  let gefahrenLaden = $state(false)
  let gefahrenFehler = $state(null)
  let gefahrenStand = $state(null)
  let gefahrenGeprueft = false
  // Amtliche Warnungen (EmergencyWA)
  let warnungen = $state([])
  let ortWarnungen = $state({})
  // Umkreis fuer amtliche Warnungen. Auf einem Roadtrip zaehlt nicht nur, ob man IM
  // Warngebiet steht, sondern ob eins in Fahrtrichtung liegt. Merkt sich die Wahl.
  let umkreisKm = $state((() => {
    try { const raw = localStorage.getItem('gefahren-umkreis'); const v = Number(raw); return raw != null && raw !== '' && !isNaN(v) ? v : 150 } catch { return 150 }
  })())
  $effect(() => { const v = String(umkreisKm); try { localStorage.setItem('gefahren-umkreis', v) } catch {} })
  let bedingungen = $state(null)
  let quellenFehler = $state([])
  let ausCache = $state(false) // Anzeige stammt aus Offline-Zwischenspeicher

  function ordneWarnungenZu(warnListe, radius = umkreisKm) {
    const z = {}
    for (const o of [...orte, ...$eigeneOrte]) {
      if (o.lat == null) continue
      const w = warnungFuer(warnListe, o.lat, o.lon, radius)
      if (w) z[o.id] = w
    }
    return z
  }
  // Umkreis geaendert -> sofort neu zuordnen, ohne erneuten Abruf.
  $effect(() => { const r = umkreisKm; if (warnungen.length) ortWarnungen = ordneWarnungenZu(warnungen, r) })

  function gpsPosition() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null)
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => resolve(null), { timeout: 8000, maximumAge: 300000 })
    })
  }

  async function pruefeGefahren(mitStandort = false) {
    if (gefahrenLaden) return
    gefahrenLaden = true; gefahrenFehler = null
    aktualisiereStrassenlage()
    try {
      const mitKoord = [...orte, ...$eigeneOrte].filter((o) => o.lat != null)
      const punkte = mitKoord.map((o) => ({ id: o.id, lat: o.lat, lon: o.lon }))
      // Amtliche Warnungen + Wetter parallel holen
      const [karte, warn] = await Promise.all([
        holeGefahren(punkte),
        holeWarnungen().catch(() => []),
      ])
      ortGefahren = Object.fromEntries(karte)
      warnungen = warn
      bedingungen = warn.bedingungen || null
      quellenFehler = warn.quellenFehler || []
      ortWarnungen = ordneWarnungenZu(warn)
      // Standort NUR auf ausdrücklichen Wunsch abfragen (mitStandort=true).
      // Grund: iOS zeigt sonst gleich beim ersten App-Start einen blockierenden
      // Berechtigungs-Dialog, ohne dass der Nutzer weiß, wofür. Der Knopf
      // „Aktualisieren“ in der Gefahrenlage fragt bewusst mit Standort.
      if (mitStandort) {
        // Nutzt den gemeinsamen Standort-Speicher; fragt nur, wenn noch nichts da ist.
        const s = $standort || (await frageStandortAn({ hoheGenauigkeit: true }) ? $standort : null)
        if (s) standortGefahr = await holeStandortGefahr(s.lat, s.lon)
      }
      gefahrenStand = standText(Date.now())
      ausCache = false
      // Für Offline: Stand als klonbaren Snapshot zwischenspeichern (IndexedDB-tauglich).
      gefahrenCache.set({
        ortGefahren: $state.snapshot(ortGefahren),
        warnungen: $state.snapshot(warnungen),
        bedingungen: $state.snapshot(bedingungen),
        standort: $state.snapshot(standortGefahr),
        stand: gefahrenStand, zeit: Date.now(),
      })
    } catch (e) {
      gefahrenFehler = t('Gefahrenlage nicht geladen. ') + fehlerText(e)
    } finally { gefahrenLaden = false }
  }

  // Zeitpunkt als Text in der App-Sprache (der Cache hält die Zeit, damit ein Sprachwechsel greift).
  // Build-Zeit in deutscher Zeit wie bisher (gebaut wird in Deutschland), Schreibweise je Sprache
  const buildText = (() => { const d = new Date(__BUILD__); return isNaN(d) ? __BUILD__ : d.toLocaleString(LOCALE, { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: ZWEI, minute: '2-digit' }) })()
  const standText = (z) => new Date(z).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: ZWEI, minute: '2-digit' })

  // Beim Start letzten bekannten Stand aus dem Cache anzeigen (auch offline).
  let cacheRestauriert = false
  $effect(() => {
    if (cacheRestauriert || !$gefahrenCache || !orte.length) return
    cacheRestauriert = true
    const c = $gefahrenCache
    if (c.ortGefahren) ortGefahren = c.ortGefahren
    if (c.warnungen) { warnungen = c.warnungen; ortWarnungen = ordneWarnungenZu(c.warnungen) }
    if (c.bedingungen) bedingungen = c.bedingungen
    if (c.standort) standortGefahr = c.standort
    if (c.zeit || c.stand) gefahrenStand = c.zeit ? standText(c.zeit) : c.stand
    ausCache = true
  })

  const betroffene = $derived(
    [...orte, ...$eigeneOrte]
      .map((o) => ({ name: o.name, ...(ortGefahren[o.id] || { stufe: 0, gefahren: [] }) }))
      .filter((b) => b.stufe > 0)
      .sort((a, b) => b.stufe - a.stufe)
  )

  // Die Liste zeigt nur die ersten paar Warnungen. Ungeordnet waeren das bei drei
  // Bundesstaaten leicht drei WA-Meldungen, waehrend die 60 km entfernte aus Victoria
  // unsichtbar bleibt. Also: erst Stufe, dann Naehe zum naechsten EIGENEN Ort.
  const warnungenSortiert = $derived.by(() => {
    const punkte = [...orte, ...$eigeneOrte].filter((o) => o.lat != null)
    if (!punkte.length) return warnungen
    return warnungen
      .map((w) => {
        let km = Infinity
        for (const o of punkte) { const d = abstandKm(w, o.lat, o.lon); if (d < km) km = d; if (km === 0) break }
        return { ...w, km }
      })
      .sort((a, b) => b.rang - a.rang || a.km - b.km)
  })

  const betroffeneWarnungen = $derived(
    [...orte, ...$eigeneOrte]
      .filter((o) => ortWarnungen[o.id])
      .map((o) => ({ name: o.name, warnung: ortWarnungen[o.id] }))
      .sort((a, b) => b.warnung.rang - a.warnung.rang)
  )
  // Straßenlage WA (Main Roads): getrennt von den amtlichen Warnungen gezählt
  const strassenZahl = $derived(zaehleStrassen($strassenlage.meldungen, { orte: [...orte, ...$eigeneOrte], position: $standort, umkreisKm, reisen: $reisen }))

  // Prüfen, sobald Daten da sind UND es Netz gibt — auch nach jeder Rückkehr aus dem
  // Funkloch, damit nach längerer Offline-Phase sofort der aktuelle Stand geholt wird.
  // Mindestabstand, damit wackliger Empfang nicht dauernd Abrufe auslöst.
  // Standort gleich beim Start — erteilte Freigabe wird still genutzt, sonst genau
  // einmal gefragt (siehe standort.js). Danach steht er für Gefahren im Umkreis und
  // die Notfall-Karte bereit, ohne dass man ihn jedes Mal neu anfordern muss.
  let standortGestartet = false
  $effect(() => {
    if (standortGestartet) return
    standortGestartet = true
    starteStandort()
    starteStrassenlage()
    // Musik unterwegs: Zustand laden, Rücksprung von Spotify erkennen
    starteMusik({ meldung: (t, art) => zeigeToast(t, art || 'info', 4000) })
  })
  $effect(() => { setzeOrte([...orte, ...$eigeneOrte]) })
  // Sobald eine Position da ist: Gefahrenlage am Standort mitziehen.
  $effect(() => {
    const s = $standort
    if (!s || !$online) return
    holeStandortGefahr(s.lat, s.lon).then((g) => { standortGefahr = g }).catch(() => {})
  })

  const GEFAHREN_ABSTAND_MS = 15 * 60 * 1000
  let gefahrenZuletzt = 0
  $effect(() => {
    const on = $online
    if (!on || !orte.length) return
    if (Date.now() - gefahrenZuletzt < GEFAHREN_ABSTAND_MS) return
    gefahrenZuletzt = Date.now()
    pruefeGefahren(false)
  })

  // Roadtrip-Bilanz aus dem Tagebuch
  const emojiVon = (fid, label) => (FELD[fid]?.optionen?.find((o) => o.label === label)?.emoji || '•')
  const bilanz = $derived.by(() => {
    const j = $journal
    const flies = j.map((e) => e.felder?.fly_factor).filter((n) => typeof n === 'number' && n > 0)
    const avgFly = flies.length ? flies.reduce((a, b) => a + b, 0) / flies.length : null
    // Ø Temperatur: erste Zahl aus dem Freitext-Feld ziehen (z.B. „35 °C, sonnig“ → 35).
    const temps = j.map((e) => {
      const m = String(e.felder?.temp_celsius ?? '').match(/-?\d+(?:[.,]\d+)?/)
      return m ? parseFloat(m[0].replace(',', '.')) : null
    }).filter((n) => n != null && !isNaN(n))
    const avgTemp = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null
    const summe = (feld) => {
      const acc = {}
      for (const e of j) { const c = e.felder?.[feld]; if (c) for (const [k, v] of Object.entries(c)) acc[k] = (acc[k] || 0) + v }
      return Object.entries(acc).map(([label, n]) => ({ label, n, emoji: emojiVon(feld, label) })).sort((a, b) => b.n - a.n)
    }
    const km = j.map((e) => parseFloat(e.felder?.distance_km)).filter((n) => !isNaN(n)).reduce((a, b) => a + b, 0)
    // Wildlife: lebend gesehen (Summe der „Lebend gesehen“-Tags) vs. Roadkill (Summe der Zählungen).
    const lebend = j.reduce((n, e) => n + (e.felder?.roadside_sightings?.length || 0), 0)
    const roadkill = summe('roadkill_counts')
    const tot = roadkill.reduce((n, r) => n + r.n, 0)
    return { avgFly, avgTemp, roadkill, roadside: summe('roadside_junk'), km, tage: j.length, lebend, tot }
  })

  // ---------- Daten & Fakten (Fahrstrecke, Sprit, Vergleiche) ----------
  const VERBRAUCH = 13       // L/100 km – beladenes 4WD/Camper
  const SPRIT_PREIS = 2.0    // AU$/L – Outback grob
  const TANK = 80            // L – Tankvolumen
  const FLUG_FFM_MEL = 16500 // km – Frankfurt→Melbourne Luftlinie

  function funFacts(km) {
    if (!km) return []
    const out = [
      t('🇦🇺 {toFixed}× quer durch Australien (Perth → Sydney)', { toFixed: dezimal(km / 3935, 1) }),
      t('🌍 {toFixed} % einmal um den Äquator', { toFixed: dezimal(km / 40075 * 100, 1) }),
      t('🇩🇪 {toFixed}× Deutschland von Nord nach Süd', { toFixed: dezimal(km / 876, 1) }),
    ]
    if (km >= 3000) out.push(t('🌙 {toFixed} % der Strecke zum Mond', { toFixed: dezimal(km / 384400 * 100, 2) }))
    return out
  }

  // Kennzahlen der Startseite. Entscheidend ist das Verkehrsmittel je Reise:
  // Nur GEFAHRENE Strecken zählen in Fahrstrecke, Sprit und Zeit am Steuer.
  // Geflogene zählen ausschließlich in die kumulierte Distanz.
  // Vorgabe: Westküste = Auto, Ostküste = Flug (dort wird überwiegend geflogen).
  const fakten = $derived.by(() => {
    const alle = $reisen.map((r) => ({ r, art: r.art || 'auto' }))
    let km = 0, min = 0, flugKm = 0, flugMin = 0
    for (const { r, art } of alle) {
      // Ohne berechnete Route auf die Luftlinie der Stopps zurückfallen.
      const strecke = r.route?.km ?? luftlinieKm(r.stops || [])
      if (art === 'flug') { flugKm += strecke; flugMin += r.route?.dauerMin || 0 }
      else { km += strecke; min += r.route?.dauerMin || 0 }
    }
    km = Math.round(km); flugKm = Math.round(flugKm)
    const liter = Math.round((km / 100) * VERBRAUCH)
    const hatReise = km > 0 || flugKm > 0
    const anflug = hatReise ? FLUG_FFM_MEL : 0
    const gesamtReise = Math.round(km + flugKm + anflug)
    return {
      km, liter, tank: Math.round(liter / TANK), kosten: Math.round(liter * SPRIT_PREIS), stunden: Math.round(min / 60),
      flugKm: Math.round(flugKm + anflug), flugStunden: Math.round(flugMin / 60),
      facts: funFacts(km), gesamtReise, gesamtProzent: gesamtReise / 40075 * 100,
    }
  })

  const VERKEHR_CATS = ['kosten_flug', 'kosten_sprit', 'kosten_boot', 'kosten_bahn', 'kosten_bus', 'kosten_mietfahrzeug']
  const SONSTIG_CATS = ['kosten_unterkunft', 'kosten_attraktion', 'kosten_sonstiges', 'kosten_behoerde']
  const SHORT_CATS = ['kosten_lebensmittel', 'kosten_genuss', 'kosten_bedarf', 'kosten_telefon', 'kosten_internet', 'kosten_short']
  const LONG_CATS = ['kosten_drohne', 'kosten_kamera', 'kosten_kleidung', 'kosten_souvenir', 'kosten_technik', 'kosten_long']
  const KOSTEN_CATS = [...VERKEHR_CATS, ...SONSTIG_CATS, ...SHORT_CATS, ...LONG_CATS]

  // Tageskurse für alle Ausgabe-Tage sicherstellen (online holen, dann gecacht/offline).
  $effect(() => {
    const daten = new Set()
    for (const e of $journal) {
      if (e.datum && KOSTEN_CATS.some((c) => e.felder?.[c])) daten.add(e.datum)
    }
    for (const d of daten) stelleKursBereit(d, $online)
  })

  // Kumulierte Ausgaben aus BEIDEN Tagebüchern — immer in EUR UND AUD (Umrechnung zum Tageskurs).
  const ausgaben = $derived.by(() => {
    const kurse = $fxKurse
    const acc = {}; KOSTEN_CATS.forEach((c) => (acc[c] = { eur: 0, aud: 0 }))
    const vm = {}
    let tage = 0
    const proc = (entries, defCur) => {
      for (const e of entries) {
        const cur = e.felder?.waehrung || defCur
        const kurs = kursFuer(kurse, e.datum)
        let hatKosten = false
        for (const c of KOSTEN_CATS) {
          const b = inBeide(e.felder?.[c], cur, kurs)
          if (b.eur) hatKosten = true
          acc[c].eur += b.eur; acc[c].aud += b.aud
        }
        if (hatKosten) tage++
        for (const t of e.felder?.verkehrsmittel || []) vm[t] = (vm[t] || 0) + 1
      }
    }
    proc($journal, 'AUD')       // West = standardmäßig AUD
    // Vorab-Ausgaben (vor dem Trip) mit eigener Währung/Datum — separat mitzählen,
    // damit der Tagesschnitt nicht durch Einmalposten (Flug, Camper) verzerrt wird.
    const vorab = { eur: 0, aud: 0 }
    for (const k of $vorabKosten) {
      if (!acc[k.kat]) continue
      const b = inBeide(k.betrag, k.waehrung, kursFuer(kurse, k.datum))
      acc[k.kat].eur += b.eur; acc[k.kat].aud += b.aud
      vorab.eur += b.eur; vorab.aud += b.aud
    }
    const g = (arr) => arr.reduce((s, c) => ({ eur: s.eur + acc[c].eur, aud: s.aud + acc[c].aud }), { eur: 0, aud: 0 })
    const verkehr = g(VERKEHR_CATS)
    const gesamt = g(KOSTEN_CATS)
    // Short-Values = laufender Konsum · Long-Values = Anschaffungen.
    const short = g(SHORT_CATS)
    const long = g(LONG_CATS)
    const mittel = Object.entries(vm).sort((a, b) => b[1] - a[1])
    const unterwegs = { eur: gesamt.eur - vorab.eur, aud: gesamt.aud - vorab.aud }
    return {
      cat: acc, verkehr, unterkunft: acc.kosten_unterkunft, attraktion: acc.kosten_attraktion,
      gesamt, long, short, mittel, tage, vorab, unterwegs,
      hatDaten: gesamt.eur > 0.5 || mittel.length > 0,
    }
  })

  // Beträge für die Anzeige auf ganze € und AU$, OHNE Rundungsfehler: alle
  // Kategorien gemeinsam so gerundet, dass sie genau den angezeigten Gesamtbetrag ergeben.
  // Jede Zwischensumme (Verkehr, Short/Long-Values) ist die Summe angezeigter Kategorien,
  // „vor der Reise“ + „unterwegs“ = „Gesamt“. Gerechnet wird weiter genau (oben).
  const anzeige = $derived.by(() => {
    const runde = (w) => {
      const r = rundeAufSumme(KOSTEN_CATS.map((c) => ausgaben.cat[c][w]))
      return Object.fromEntries(KOSTEN_CATS.map((c, i) => [c, r[i]]))
    }
    const e = runde('eur'), a = runde('aud')
    const paar = (cats) => ({ eur: cats.reduce((n, c) => n + e[c], 0), aud: cats.reduce((n, c) => n + a[c], 0) })
    const gesamt = paar(KOSTEN_CATS)
    const [vorabEur, unterwegsEur] = rundeAufSumme([ausgaben.vorab.eur, ausgaben.unterwegs.eur], gesamt.eur)
    const [vorabAud, unterwegsAud] = rundeAufSumme([ausgaben.vorab.aud, ausgaben.unterwegs.aud], gesamt.aud)
    return {
      cat: Object.fromEntries(KOSTEN_CATS.map((c) => [c, { eur: e[c], aud: a[c] }])),
      gesamt, verkehr: paar(VERKEHR_CATS), short: paar(SHORT_CATS), long: paar(LONG_CATS),
      unterkunft: paar(['kosten_unterkunft']), attraktion: paar(['kosten_attraktion']),
      vorab: { eur: vorabEur, aud: vorabAud }, unterwegs: { eur: unterwegsEur, aud: unterwegsAud },
    }
  })

  // Neuer eigener Ort: OrtNeu fragt erst, welcher Ort gemeint ist (Vorschläge aus dem Netz)
  let ortNeuOffen = $state(false)
  function ortNeuFertig(neu) {
    ortNeuOffen = false
    const gruppe = neu.abschnitt && neu.abschnitt !== 'Meine Orte' ? t(neu.abschnitt).split(':')[0] + ' · ' + t(neu.region) : t('Meine Orte')
    zeigeToast(t('„{name}“ angelegt · {gruppe}', { name: neu.name, gruppe }), 'ok', 3600)
    zuOrt(neu)
  }
  // Nächstgelegenen der 88 Orte finden → dessen Abschnitt + Region übernehmen.
  // Eigene Orte ohne Rubrik oder Kennzeichen (ältere Datenstände) werden einmalig ergänzt,
  // damit sie auch unter „Süden“ bzw. „Norden“ erscheinen und nicht nur unter „Meine Orte“.
  function eigeneOrteNachruesten() {
    for (const o of $eigeneOrte) {
      const patch = {}
      if (!(o.tags || []).length) patch.tags = ['MEIN ORT']
      Object.assign(patch, rubrikPatch(o, o.lat, o.lon))
      if (Object.keys(patch).length) updateEigenenOrt(o.id, patch)
    }
  }

  // „Alle vervollständigen“: holt für jeden eigenen Ort das Fehlende nach.
  // Bewusst auf Knopfdruck statt automatisch — es sind Netzabfragen je Ort.
  let sammelLaeuft = $state(false)
  const unvollstaendig = $derived($eigeneOrte.filter(
    (o) => o.lat == null || !o.bildData || !((o.beschreibung || '') + (o.info || '')).trim()))
  async function alleVervollstaendigen() {
    if (sammelLaeuft) return
    sammelLaeuft = true
    const liste = [...unvollstaendig]
    let fertig = 0
    for (const o of liste) {
      zeigeToast(t('Vervollständige {i}/{n}: {name} …', { i: fertig + 1, n: liste.length, name: o.name }), 'info', 2000)
      await ortAnreichern(o, true)
      fertig++
    }
    zeigeToast(tn(fertig, '{n} Ort vervollständigt ✓', '{n} Orte vervollständigt ✓'), 'ok', 3200)
    sammelLaeuft = false
  }

  async function ortAnreichern(o, still = false) {
    try {
      if (!still) zeigeToast(t('Hole Daten & Bild zu „{name}“ …', { name: o.name }), 'info', 2600)
      const d = await holeOrtsdaten(o.name, { lat: o.lat, lon: o.lon })
      const patch = {}
      if (o.lat == null && d.lat != null) { patch.lat = d.lat; patch.lon = d.lon }
      // Rubrik aus den Koordinaten ableiten — dann steht der Ort mit unter „Orte Nord/Süd“.
      Object.assign(patch, rubrikPatch(o, patch.lat ?? o.lat, patch.lon ?? o.lon))
      if (d.beschreibung) {
        if (!(o.beschreibung || '').trim()) patch.beschreibung = d.beschreibung
        else if (d.beschreibung.trim() !== (o.beschreibung || '').trim()) patch.info = d.beschreibung
      }
      if (d.bildData) patch.bildData = d.bildData
      if (Object.keys(patch).length) {
        updateEigenenOrt(o.id, patch)
        const teile = []
        if (patch.lat != null) teile.push(t('Koordinaten'))
        if (patch.bildData) teile.push(t('Bild'))
        if (patch.beschreibung) teile.push(t('Beschreibung'))
        if (patch.abschnitt) teile.push(t('Rubrik'))
        if (!still) zeigeToast(o.name + ': ' + t('{teile} ergänzt ✓', { teile: teile.join(' + ') || t('Daten') }), 'ok', 3200)
      }
    } catch {}
  }

  $effect(() => {
    initUserData()
    // Englisch: Orte bekommen Beschreibung und Saison aus orte.en.json (Gruppen und Namen bleiben
    // die Schlüssel aus orte.json), Routen-Ideen, Praxis und Quiz kommen ganz aus *.en.json.
    const lade = (datei) => fetch(datei).then((r) => r.json())
    const inSprache = (datei) => (istEn ? lade(datei.replace(/\.json$/, '.en.json')).catch(() => lade(datei)) : lade(datei))
    Promise.all([
      lade('/orte.json'),
      istEn ? lade('/orte.en.json').catch(() => ({})) : Promise.resolve({}),
      inSprache('/routen.json'),
      inSprache('/inhalt.json'),
      inSprache('/quiz.json').catch(() => ({ fragen: [], levels: [] })),
    ])
      .then(([o, oEn, r, i, q]) => { orte = o.map((x) => (oEn[x.id] ? { ...x, ...oEn[x.id] } : x)); setzeVorlagen(o); routen = r; inhalt = i; quizData = q; laden = false; eigeneOrteNachruesten() })
      .catch((e) => { fehler = e.message; laden = false })
  })

  const filternAktiv = $derived(suche.trim() !== '' || aktiveTags.length > 0)

  // Dieselbe Logik wie im Suchblatt (lib/suche.js) — beide finden garantiert dasselbe.
  const passt = (o) => passtOrt(o, suche, aktiveTags)

  // Orte eines Abschnitts nach Region gruppieren.
  function regionen(list) {
    const out = []
    const idx = new Map()
    for (const o of list) {
      if (!idx.has(o.region)) { idx.set(o.region, out.length); out.push({ titel: o.region, orte: [] }) }
      out[idx.get(o.region)].orte.push(o)
    }
    return out
  }

  const sueden = $derived(regionen([...orte, ...$eigeneOrte].filter((o) => o.abschnitt?.startsWith('Süden') && passt(o))))
  const norden = $derived(regionen([...orte, ...$eigeneOrte].filter((o) => o.abschnitt?.startsWith('Norden') && passt(o))))
  // Ostküste: ein Abschnitt wie Süden und Norden.
  const osten = $derived(regionen([...orte, ...$eigeneOrte].filter((o) => o.abschnitt?.startsWith('Ostküste') && passt(o))))
  const treffer = $derived(regionen([...orte, ...$eigeneOrte].filter(passt)))
  const routenSued = $derived(routen.filter((r) => r.gruppe === 'sued'))
  const routenNord = $derived(routen.filter((r) => r.gruppe === 'nord'))
  const anzahlEintraege = $derived(Object.keys($userData).length)
  const quizErgebnis = $derived(auswerten($quizAntworten, quizData.fragen, quizData.levels))

  function toggleTag(t) {
    aktiveTags = aktiveTags.includes(t) ? aktiveTags.filter((x) => x !== t) : [...aktiveTags, t]
  }
  function tagClass(t) { return 'tag-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-') }
  function reset() { suche = ''; aktiveTags = [] }

  async function onExport() {
    try {
      const r = await exportBackup()
      haptic.confirm()
      if (r.methode === 'gespeichert+geteilt') flash(t('Backup gespeichert & geteilt ✓'))
      else flash(t('Backup gespeichert ✓ (') + r.name + ')')
    } catch { haptic.error(); flash(t('Export fehlgeschlagen')) }
  }

  const THEME_REIHE = { auto: 'hell', hell: 'dunkel', dunkel: 'auto' }
  const THEME_NAME = { auto: t('Automatisch'), hell: t('Hell'), dunkel: t('Dunkel') }
  function themeWechsel() {
    const n = THEME_REIHE[$theme] || 'auto'
    setzeTheme(n)
    flash(t('Design: ') + THEME_NAME[n])
  }

  function datumZeit(iso) { try { return new Date(iso).toLocaleString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: ZWEI, minute: '2-digit' }) } catch { return iso } }

  let scrollY = $state(0)
  function nachOben() { window.scrollTo({ top: 0, behavior: 'smooth' }) }

  // Dock unten rechts: eingeklappt -> auf Klick ausfahren, nach 2 s Inaktivität wieder zu.
  let dockOffen = $state(false)
  let dockTimer = null
  function dockReset() { clearTimeout(dockTimer); dockTimer = setTimeout(() => { dockOffen = false }, 2000) }
  function dockAuf() { dockOffen = true; dockReset() }
  function dockZu() { clearTimeout(dockTimer); dockOffen = false }

  // Suche: vom Dock aus hochspringen & fokussieren; ✕ leert das Feld.
  // ---- Suche: Blatt statt Leiste oben ----
  // iPhone: runder Knopf unten rechts · Mac: „Suchen“ oben, ⌘K oder /
  let sucheOffen = $state(false)
  function zurSuche() { dockZu(); sucheOffen = true }
  function globaleTaste(e) {
    if (sucheOffen || importOffen || importBericht || xoxoOffen || snakeOffen || vierOffen) return
    const imFeld = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); sucheOffen = true }
    else if (e.key === '/' && !imFeld && !e.metaKey && !e.ctrlKey) { e.preventDefault(); sucheOffen = true }
  }
  // Treffer antippen → Blatt zu, zur Kachel scrollen, kurz hervorheben, Fokus dorthin.
  // Welcher Orte-Bereich zeigt diesen Ort?
  const bereichVon = (o) => (o.abschnitt?.startsWith('Süden') ? 'sueden' : o.abschnitt?.startsWith('Norden') ? 'norden'
    : o.abschnitt?.startsWith('Ostküste') ? 'osten' : 'meine')
  async function zuOrt(o) {
    sucheOffen = false
    if (filternAktiv && !passt(o)) reset()
    geh('orte/' + bereichVon(o))
    await tick(); await new Promise((r) => setTimeout(r, 120)); await tick()
    const el = document.getElementById('ort-' + o.id)
    if (!el) return
    const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'center' })
    el.classList.add('aufgerufen')
    setTimeout(() => el.classList.remove('aufgerufen'), 2200)
    try { el.focus({ preventScroll: true }) } catch {}
  }
  function alsKacheln(q, tags) {
    suche = q; aktiveTags = [...tags]; sucheOffen = false
    geh('orte')
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  // Easter-Eggs in der Suche: „xoxo“ → Tic-Tac-Toe, „sn4ke“ → Snake (¾ des Bildschirms, feste Bande),
  // „4444“ → Vier in einer Reihe gegen den Computer
  let xoxoOffen = $state(false)
  let snakeOffen = $state(false)
  let vierOffen = $state(false)
  $effect(() => {
    if (suche.trim().toLowerCase() === 'xoxo') { xoxoOffen = true; suche = '' }
  })

  // Alte Aufrufe springeZu('tagebuch') o. ä. laufen über die neue Navigation
  function springeZu(id) { geh(id) }
  function tabZu(tab) { geh(tab) }

  let importInput
  async function onImport(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    try {
      const p = await leseBackup(f)

      // Eine Datei aus der eigenen Kalender-App? Dann kein Backup-Ersetzen, sondern
      // ein additiver Import: Buchungen übernehmen, Reise-Gerüst daraus ableiten.
      if (istReisekalender(p)) { await onKalenderImport(p); return }

      // Statt zu ersetzen: Trockenlauf zeigen, dann entscheiden lassen.
      const sauber = saeubereBackup(p)
      if (!sauber) throw new Error('kein Backup')
      importDatei = sauber
      importVorschau = vorschauZusammenfuehren(sauber, herkunftName(sauber))
      importOffen = true
    } catch { flash(t('Ungültige Datei')) }
  }

  // Import aus der Kalender-App. Bewusst mit voller Vorschau: der Import legt
  // Reisen an und verschiebt das Startdatum — das darf nicht überraschen.
  async function onKalenderImport(p) {
    const k = leseReisekalender(p)
    const i = kalenderInfo(k)
    const ab = baueAbschnitte(k.events)
    const alteImporte = $reisen.filter((r) => r.quelle === 'reisekalender').length
    const eigene = $reisen.length - alteImporte

    const ok = await frage({ titel: t('Reisekalender übernehmen?'), ja: t('Übernehmen'), text:
      t('Stand {wert}\n\n', { wert: k.stand ? datumZeit(k.stand) : t('unbekannt') }) +
      t('{termine} Termine · {buchungsnummern} Buchungsnummern · {dokumente} Belege\n', { termine: i.termine, buchungsnummern: i.buchungsnummern, dokumente: i.dokumente }) +
      t('{datumKurz} – {datumKurz2} ({tage} Tage)\n\n', { datumKurz: datumKurz(i.von), datumKurz2: datumKurz(i.bis), tage: i.tage }) +
      t('Daraus werden {length} Reiseabschnitte:\n', { length: ab.length }) +
      ab.map((a) => `   ${datumKurz(a.von)}  ${a.name} (${a.tage} T)`).join('\n') + '\n\n' +
      (alteImporte ? t('{alteImporte} früher importierte Reisen werden ersetzt.\n', { alteImporte }) : '') +
      (eigene ? t('Deine {eigene} eigenen Etappen und Routen bleiben erhalten.\n', { eigene }) : '') +
      t('Deine Routen, Wanderungen und Logbuchtage bleiben an ihren Etappen.') })
    if (!ok) { flash(t('Import abgebrochen')); return }

    const r = importiereReisekalender(k, { orte: [...orte, ...$eigeneOrte], reisenAnlegen: true })
    flash(t('Kalender übernommen ✓ {angelegt} Abschnitte · {buchungen} Buchungen', { angelegt: r.angelegt, buchungen: r.buchungen }))
  }
  // ---- Zusammenführender Import ----
  let importOffen = $state(false)
  // .raw: die eingelesene Datei darf KEIN Svelte-Proxy werden — sonst scheitert später das
  // Speichern in IndexedDB ohne Fehlermeldung (Proxies sind nicht strukturiert klonbar, siehe userdata.js).
  let importDatei = $state.raw(null)
  let importVorschau = $state(null)
  let importLaeuft = $state(false)
  let importBericht = $state(null)

  const herkunftName = (p) => p?.geraet || (backupInfo(p).exportiert ? t('anderem Gerät') : t('Datei'))

  async function importZusammenfuehren() {
    if (!importDatei) return
    importLaeuft = true
    try {
      const r = await fuehreBackupZusammen(importDatei, { quelle: herkunftName(importDatei) })
      importBericht = r
      importOffen = false
      flash(t('Zusammengeführt ✓ {neu} neu · {ergaenzt} ergänzt', { neu: r.summe.neu, ergaenzt: r.summe.ergaenzt }))
    } catch (e) {
      flash(t('Zusammenführen fehlgeschlagen: ') + fehlerText(e))
    }
    importLaeuft = false
  }
  async function importErsetzen() {
    if (!(await frage({ titel: t('Alles auf diesem Gerät ersetzen?'), gefahr: true, ja: t('Ersetzen'),
      text: t('Alles, was hier neuer ist als in der Datei, geht dabei verloren. Der übliche Weg ist „Zusammenführen“.') }))) return
    wendeBackupAn(importDatei)
    importOffen = false
    flash(t('Ersetzt ✓'))
  }
  async function importZurueck() {
    const r = await importRueckgaengig()
    if (r) {
      importBericht = null
      flash(t('Zurückgenommen ✓ Stand von {datumZeit} · {wert} Reisetage', { datumZeit: datumZeit(r.zeit), wert: r.umfang?.tagebuch ?? '?' }))
    } else flash(t('Kein Schnappschuss vorhanden'))
  }

  const datumKurz = (s) => {
    try { return new Date(s + 'T12:00').toLocaleDateString(LOCALE, { day: ZWEI, month: 'short' }) }
    catch { return s }
  }

  function copyNotes() {
    const namen = new Map(orte.map((o) => [o.id, o.name]))
    const teile = []
    for (const [id, e] of Object.entries($userData)) {
      const txt = [e.notiz, e.bericht].filter((x) => x && x.trim()).join('\n')
      if (txt) teile.push('• ' + (namen.get(id) || id) + ':\n' + txt)
    }
    if (!teile.length) { flash(t('keine Notizen')); return }
    navigator.clipboard?.writeText(teile.join('\n\n')).then(() => flash(t('kopiert ({n})', { n: teile.length })))
  }

  // Einheitliches Toast-System: flash() leitet an zeigeToast weiter.
  // Titelbild: Reisebeginn plus Reisedauer (Einführung, Plan), erweitert um die Etappen
  const kopfZeit = $derived(reiseZeitraum($gesamtStart, $reiseTage, planUeberblick(etappenMitDatum($reisen, $gesamtStart))))
  const kopfDatum = (s) => new Date(s + 'T00:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).replace(/(\p{L})\./u, '$1')
  function flash(m) { zeigeToast(m, /✓/.test(m) ? 'ok' : /fehlgeschlagen|Fehler/i.test(m) ? 'fehler' : 'info') }
  // Nach dem Start: wurde etwas aus dem Notspeicher zurückgeholt, soll man das sehen.
  $effect(() => {
    const r = $rettung
    if (!r) return
    const n = r.summe.neu, e = r.summe.ergaenzt
    zeigeToast(t('Gerettet ✓ {n} {wert} aus dem Notspeicher zurückgeholt{wert2}', { n, wert: n === 1 ? t('Eintrag') : t('Einträge'), wert2: e ? t(', {e} ergänzt', { e }) : '' }), 'ok', 9000)
    rettung.set(null)   // nur einmal zeigen
  })
</script>

<RoutenDienst orte={[...orte, ...$eigeneOrte]} />

<div class="app">
<div class="sl-mac">
  <Seitenleiste {ansicht} unterpunkte={UNTER} {geh} onSuche={zurSuche} onBackup={onExport}
    onImport={() => importInput.click()} onHandbuch={() => geh('mehr/handbuch')} onEinfuehrung={einfuehrungStarten} />
</div>

<div class="inhalt">
{#if ansicht.tab === 'heute'}
<header class="hero">
  <div class="hero-musik"><MusikSymbol {geh} hell /></div>
  <div class="kicker"><span>{t('Roadtrip')}</span>{#if kopfZeit}<span class="k-datum" class:k-wartet={!$ready}>{kopfDatum(kopfZeit.von)}<span class="k-bis">{kopfDatum(kopfZeit.bis)}</span></span>{/if}</div>
  <h1>
    <span class="stretch">{#each 'WESTERN'.split('') as ch}<span>{ch}</span>{/each}</span>
    <span class="akz">{t('Australia')}</span>
  </h1>
</header>
{:else}
  <!-- Unter Mehr gibt es am iPhone sonst nichts zum Zurückgehen; bleibt beim Scrollen stehen -->
  {#if ansicht.tab === 'mehr' && ansicht.unter}
    <div class="zurueck-leiste"><button class="zurueck-knopf" onclick={() => zurueck('mehr')}><span aria-hidden="true">‹</span> {t('Zurück')}</button></div>
  {/if}
  <header class="sk">
    <h1 class="sk-titel">{ansicht.unter === 'handbuch' ? t('Handbuch') : TITEL[ansicht.tab]}</h1>
    <span class="sk-musik"><MusikSymbol {geh} /></span>
    {#if ansicht.tab === 'plan'}<button class="sk-neu" onclick={() => oeffneNeu(ansicht.unter === 'wanderungen' ? 'wanderung' : 'route')}>{t('+ Neu')}</button>{/if}
    {#if ansicht.tab === 'logbuch' && ansicht.unter !== 'notizen'}<button class="sk-neu" onclick={() => oeffneNeu('tag')}>{t('+ Tag')}</button>{/if}
  </header>
  {#if UNTER[ansicht.tab] && !(ansicht.tab === 'mehr' && !ansicht.unter) && !['etappe', 'route', 'tag', 'handbuch'].includes(ansicht.unter)}
    <nav class="seg-leiste" aria-label={t('{wert}: Bereiche', { wert: TITEL[ansicht.tab] })} use:leisteRand={ansicht.pfad}>
      {#each UNTER[ansicht.tab] as [pfad, label] (pfad)}
        {@const an = ansicht.pfad === pfad || (pfad === ansicht.tab && (!ansicht.unter || ['etappe', 'route', 'tag'].includes(ansicht.unter))) || (ansicht.pfad.startsWith(pfad + '/') && pfad !== ansicht.tab) || (ansicht.tab === 'orte' && pfad === 'orte/' + orteUnter)}
        <a class="seg-chip" class:an href="#/{pfad}" aria-current={an ? 'page' : undefined} onclick={(e) => { e.preventDefault(); geh(pfad) }}>{label}</a>
      {/each}
    </nav>
  {/if}
{/if}

<main class="wrap" bind:this={hauptEl}>
  {#if laden}
    <p class="info">{t('Lade Reisedaten …')}</p>
  {:else if fehler}
    <p class="info fehler">{t('Fehler beim Laden: {fehler}', { fehler })}</p>

  {:else if ansicht.tab === 'heute'}
    <Heute warnAnzahl={betroffeneWarnungen.length} sperrAnzahl={strassenZahl.sperrungen} sperrRoute={strassenZahl.sperrungenAufRoute} onneu={oeffneNeu} ontag={(d) => geh('logbuch/tag/' + d)} {geh} />
    <section class="heute-zahlen" aria-label={t('Zahlen zur Reise')}>
      <button type="button" class="hz-auf" aria-expanded={zahlenOffen} aria-controls="hz-inhalt" onclick={() => (zahlenOffen = !zahlenOffen)}>
        <span class="hz-titel">{t('📊 Zahlen zur Reise')}</span>
        <span class="hz-kurz">{[bilanz.tage ? tn(bilanz.tage, '{n} Reisetag', '{n} Reisetage') : '', fakten.km ? zahl(fakten.km) + ' km' : '', anzeige.gesamt.eur > 0 ? eur(anzeige.gesamt.eur) : ''].filter(Boolean).join(' · ')}</span>
        <span class="aufklapp" class:offen={zahlenOffen} aria-hidden="true"></span>
      </button>
      {#if zahlenOffen}
      <div id="hz-inhalt" class="hz-inhalt">
      <!-- Roadtrip-Cockpit: die wichtigsten Kennzahlen auf einen Blick -->
      <div class="cockpit">
        {#if quizData.fragen.length}
          <!-- Kachel = Knopf zum Aufklappen + Panel daneben. Ein Link im Knopf wäre ungültiges HTML
               und für Screenreader nicht erreichbar. -->
          <div class="kachel klick quiz-kachel" class:offen={zeigeLevel}>
            <button type="button" class="qk-toggle" aria-expanded={zeigeLevel} onclick={() => (zeigeLevel = !zeigeLevel)}>
              <span class="k-zahl">{quizErgebnis.level?.emoji} {quizErgebnis.level?.stufe}<span class="k-plus">/{quizData.levels.length}</span></span>
              <span class="k-lbl">{t('🏆 Quiz-Level')}{#if quizErgebnis.beantwortet}&nbsp;{t('· {richtig}/{gesamt} richtig', { richtig: quizErgebnis.richtig, gesamt: quizErgebnis.gesamt })}{/if} {zeigeLevel ? '▲' : '▾'}</span>
            </button>
            {#if zeigeLevel}
              <div class="qk-panel">
                <div class="qk-titel">{t('{emoji} Stufe {stufe}: {titel}', { emoji: quizErgebnis.level?.emoji, stufe: quizErgebnis.level?.stufe, titel: quizErgebnis.level?.titel })}</div>
                {#if quizErgebnis.beantwortet}<div class="qk-stat">{t('{richtig}/{gesamt} richtig ({prozent}%) · {beantwortet}/{gesamt2} Fragen beantwortet', { richtig: quizErgebnis.richtig, gesamt: quizErgebnis.gesamt, prozent: quizErgebnis.prozent, beantwortet: quizErgebnis.beantwortet, gesamt2: quizErgebnis.gesamt })}</div>{/if}
                {#if quizErgebnis.level?.text}<p class="qk-text">{quizErgebnis.level.text}</p>{/if}
                <button type="button" class="qk-link" onclick={() => springeZu('quiz')}>{t('→ Zum Quiz')}</button>
              </div>
            {/if}
          </div>
        {/if}
        {#if bilanz.tage > 0}
          <div class="kachel"><span class="k-zahl" use:zaehlHoch={{ wert: bilanz.tage }}></span><span class="k-lbl">{t('📓 Reisetage')}</span></div>
          {#if bilanz.km > 0}<div class="kachel"><span class="k-zahl" use:zaehlHoch={{ wert: Math.round(bilanz.km) }}></span><span class="k-lbl">🛣️ km</span></div>{/if}
          {#if bilanz.avgTemp != null}<div class="kachel"><span class="k-zahl">{bilanz.avgTemp.toFixed(0)}°</span><span class="k-lbl">{t('🌡️ Ø Temperatur')}</span></div>{/if}
          {#if bilanz.avgFly != null}<div class="kachel"><span class="k-zahl">{dezimal(bilanz.avgFly, 1)}<span class="k-plus">/5</span></span><span class="k-lbl">{t('🪰 Ø Fliegen')}</span></div>{/if}
          {#if bilanz.lebend > 0}<div class="kachel"><span class="k-zahl" use:zaehlHoch={{ wert: bilanz.lebend }}></span><span class="k-lbl">{t('🦘 lebend gesehen')}</span></div>{/if}
          {#if bilanz.tot > 0}<div class="kachel"><span class="k-zahl" use:zaehlHoch={{ wert: bilanz.tot }}></span><span class="k-lbl">{t('💀 Roadkill')}</span></div>{/if}
        {/if}
      </div>

      <!-- Daten & Fakten: kumulierte Distanz, Sprit, Vergleiche -->
      <div class="fakten-box" use:erscheine>
        <div class="fb-titel">{t('📊 Daten & Fakten')}</div>
        {#if fakten.km > 0}
          <div class="fb-grid">
            {#if fakten.gesamtReise > fakten.km}
              <div class="fb-kachel"><span class="fb-zahl" use:zaehlHoch={{ wert: fakten.gesamtReise }}></span><span class="fb-lbl">{t('🌍 km kumulierte Distanz')}</span></div>
            {/if}
            <div class="fb-kachel"><span class="fb-zahl" use:zaehlHoch={{ wert: fakten.km }}></span><span class="fb-lbl">{t('🛣️ km gefahren')}</span></div>
            {#if fakten.flugKm > 0}
              <div class="fb-kachel"><span class="fb-zahl" use:zaehlHoch={{ wert: fakten.flugKm }}></span><span class="fb-lbl">{t('✈️ km geflogen')}</span></div>
            {/if}
            <div class="fb-kachel"><span class="fb-zahl"><span use:zaehlHoch={{ wert: fakten.liter }}></span> L</span><span class="fb-lbl">{t('⛽ Sprit · ~{tank}× volltanken', { tank: fakten.tank })}</span></div>
            <div class="fb-kachel"><span class="fb-zahl">≈ <span use:zaehlHoch={{ wert: fakten.kosten }}></span> AU$</span><span class="fb-lbl">{t('💰 Spritkosten')}</span></div>
            {#if fakten.stunden > 0}<div class="fb-kachel"><span class="fb-zahl"><span use:zaehlHoch={{ wert: fakten.stunden }}></span> h</span><span class="fb-lbl">{t('🕒 am Steuer')}</span></div>{/if}
          </div>
          {#if fakten.facts.length}
            <ul class="fb-facts">{#each fakten.facts as f}<li>{f}</li>{/each}</ul>
          {/if}
          {#if fakten.gesamtReise > fakten.km}
            <div class="fb-gesamt">{t('🌏 Die kumulierte Distanz (inkl. Anflug ab Frankfurt & Flüge) sind')} <b>{fakten.gesamtProzent.toFixed(0)} %</b> {t('einmal um die Erde.')}</div>
          {/if}
          <div class="fb-hinweis">{t('Je Reise ist ✈️ Flug oder 🚗 Auto einstellbar. Nur gefahrene Strecken zählen in Sprit und Zeit am Steuer; geflogene nur in die kumulierte Distanz (inkl. Anflug ab Frankfurt). Sprit-Schätzung: {VERBRAUCH} L/100 km · ~{replace} AU$/L.', { VERBRAUCH, replace: dezimal(SPRIT_PREIS, 2) })}</div>
        {:else}
          <p class="fb-leer">{t('🧮 Noch keine berechnete Route. Leg im')} <b>{t('Plan')}</b> {t('eine Route mit Stopps an. km, Fahrzeit, Sprit & Fun-Facts erscheinen hier dann automatisch.')}</p>
        {/if}
      </div>

      <!-- Ausgaben & Verkehr: kumuliert aus beiden Tagebüchern -->
      <div class="fakten-box" use:erscheine>
        <div class="fb-titel">{t('💶 Ausgaben & Verkehr')}</div>
          <div class="budget">
            <label class="bg-set">{t('🎯 Budget')} <input type="number" min="0" step="100" value={$reiseBudget || ''} oninput={(e) => reiseBudget.set(Number(e.target.value) || 0)} placeholder={t('€ gesamt')} /> €</label>
            {#if $reiseBudget > 0}
              {@const spent = anzeige.gesamt.eur}
              {@const rest = $reiseBudget - spent}
              {@const pct = Math.min(100, (spent / $reiseBudget) * 100)}
              <div class="bg-bar"><div class="bg-fill" class:warn={pct >= 75 && spent <= $reiseBudget} class:over={spent > $reiseBudget} style="transform:scaleX({Math.min(100, Math.max(2, pct)) / 100})"></div></div>
              <div class="bg-zahlen">
                <span>{t('ausgegeben')} <b>{eur(spent)}</b></span>
                <span class:neg={rest < 0}>{rest >= 0 ? t('übrig') : t('über Budget')} <b>{eur(Math.abs(rest))}</b></span>
                {#if anzeige.vorab.eur > 0}<span>{t('davon vorab')} <b>{eur(anzeige.vorab.eur)}</b></span>{/if}
                {#if ausgaben.tage > 0 && anzeige.unterwegs.eur > 0}<span title={t('Nur unterwegs erfasste Kosten – ohne einmalige Vorab-Ausgaben')}>{t('Ø/Reisetag')} <b>{eur(ausgaben.unterwegs.eur / ausgaben.tage)}</b></span>{/if}
              </div>
            {/if}
          </div>
          {#if ausgaben.hatDaten}
          <div class="fb-grid">
            <div class="fb-kachel"><span class="fb-zahl">{eur(anzeige.gesamt.eur)}</span><span class="fb-aud">{aud(anzeige.gesamt.aud)}</span><span class="fb-lbl">{t('💶 Gesamt ausgegeben')}</span></div>
            <div class="fb-kachel"><span class="fb-zahl">{eur(anzeige.verkehr.eur)}</span><span class="fb-aud">{aud(anzeige.verkehr.aud)}</span><span class="fb-lbl">{t('🚦 Verkehr')}</span></div>
            <div class="fb-kachel"><span class="fb-zahl">{eur(anzeige.unterkunft.eur)}</span><span class="fb-aud">{aud(anzeige.unterkunft.aud)}</span><span class="fb-lbl">{t('🏨 Unterkünfte')}</span></div>
            <div class="fb-kachel"><span class="fb-zahl">{eur(anzeige.attraktion.eur)}</span><span class="fb-aud">{aud(anzeige.attraktion.aud)}</span><span class="fb-lbl">{t('🎟️ Attraktionen/Touren')}</span></div>
            {#if anzeige.vorab.eur > 0}
              <div class="fb-kachel"><span class="fb-zahl">{eur(anzeige.vorab.eur)}</span><span class="fb-aud">{aud(anzeige.vorab.aud)}</span><span class="fb-lbl">{t('🧾 vor der Reise')}</span></div>
            {/if}
            {#if anzeige.unterwegs.eur > 0}
              <div class="fb-kachel"><span class="fb-zahl">{eur(anzeige.unterwegs.eur)}</span><span class="fb-aud">{aud(anzeige.unterwegs.aud)}</span><span class="fb-lbl">{t('🚙 unterwegs')}</span></div>
            {/if}
          </div>
          {#if anzeige.short.eur > 0 || anzeige.long.eur > 0}
            <div class="fb-split">
              <span class="fs-zeile"><b>{t('🪙 Short-Values')}</b> <span class="fs-sub">{t('(Lebensmittel, Genuss, Bedarf, Telefon, Internet)')}</span> {eur(anzeige.short.eur)} · {aud(anzeige.short.aud)}</span>
              <span class="fs-zeile"><b>{t('📦 Long-Values')}</b> <span class="fs-sub">{t('(Drohne, Kamera, Kleidung, Souvenirs)')}</span> {eur(anzeige.long.eur)} · {aud(anzeige.long.aud)}</span>
            </div>
          {/if}
          <ul class="fb-facts">
            {#if anzeige.cat.kosten_flug.eur > 0}<li>{t('✈️ Flüge {eur} · {aud}', { eur: eur(anzeige.cat.kosten_flug.eur), aud: aud(anzeige.cat.kosten_flug.aud) })}</li>{/if}
            {#if anzeige.cat.kosten_sprit.eur > 0}<li>{t('⛽ Sprit {eur} · {aud}', { eur: eur(anzeige.cat.kosten_sprit.eur), aud: aud(anzeige.cat.kosten_sprit.aud) })}</li>{/if}
            {#if anzeige.cat.kosten_boot.eur > 0}<li>{t('🚤 Boot/Fähre {eur} · {aud}', { eur: eur(anzeige.cat.kosten_boot.eur), aud: aud(anzeige.cat.kosten_boot.aud) })}</li>{/if}
            {#if anzeige.cat.kosten_bahn.eur > 0}<li>{t('🚆 Bahn {eur} · {aud}', { eur: eur(anzeige.cat.kosten_bahn.eur), aud: aud(anzeige.cat.kosten_bahn.aud) })}</li>{/if}
            {#if anzeige.cat.kosten_bus.eur > 0}<li>{t('🚌 Bus {eur} · {aud}', { eur: eur(anzeige.cat.kosten_bus.eur), aud: aud(anzeige.cat.kosten_bus.aud) })}</li>{/if}
            {#if anzeige.cat.kosten_mietfahrzeug.eur > 0}<li>{t('🚐 Mietfahrzeug {eur} · {aud}', { eur: eur(anzeige.cat.kosten_mietfahrzeug.eur), aud: aud(anzeige.cat.kosten_mietfahrzeug.aud) })}</li>{/if}
            {#if anzeige.cat.kosten_technik.eur > 0}<li>{t('🎥 Technik {eur} · {aud}', { eur: eur(anzeige.cat.kosten_technik.eur), aud: aud(anzeige.cat.kosten_technik.aud) })}</li>{/if}
            {#if anzeige.cat.kosten_behoerde.eur > 0}<li>{t('🏛️ Behörde {eur} · {aud}', { eur: eur(anzeige.cat.kosten_behoerde.eur), aud: aud(anzeige.cat.kosten_behoerde.aud) })}</li>{/if}
            {#if anzeige.cat.kosten_sonstiges.eur > 0}<li>{t('🛒 Sonstiges {eur} · {aud}', { eur: eur(anzeige.cat.kosten_sonstiges.eur), aud: aud(anzeige.cat.kosten_sonstiges.aud) })}</li>{/if}
            {#each ausgaben.mittel as [t, n]}<li>{t} ×{n}</li>{/each}
          </ul>
          <div class="fb-hinweis">{t('Beträge in der je Tag gewählten Währung erfasst (standardmäßig AUD), automatisch zum Tageskurs in beide umgerechnet. {wert}', { wert: $online ? '' : t('⚠︎ offline: Näherungskurs, wird online aktualisiert.') })}</div>
          {:else}
            <p class="fb-leer">{t('💡 Ausgaben erfasst du unterwegs im')} <b>{t('Logbuch')}</b> {t('(Modul „💰 Kosten & Verkehr“) oder vorab in der')} <b>{t('Reisevorbereitung')}</b>{t('. Hier laufen sie automatisch zusammen (€ + AU$, Umrechnung zum Tageskurs). Oben kannst du jetzt schon dein 🎯 Budget setzen.')}</p>
          {/if}
        </div>

      {#if bilanz.roadkill.length || bilanz.roadside.length}
        <div class="bilanz-detail">
          {#if bilanz.roadkill.length}
            <div class="b-block"><span class="b-lbl">{t('💀 Roadkill je Tier:')}</span>
              {#each bilanz.roadkill as r}<span class="b-item">{r.emoji} {r.label} <b>{r.n}</b></span>{/each}
            </div>
          {/if}
          {#if bilanz.roadside.length}
            <div class="b-block"><span class="b-lbl">{t('🗿 Kuriositäten am Straßenrand:')}</span>
              {#each bilanz.roadside as r}<span class="b-item">{r.emoji} {r.label} <b>{r.n}</b></span>{/each}
            </div>
          {/if}
        </div>
      {/if}
      </div>
      {/if}

      <!-- Reise-Karte: echte Karte mit allen Routen, nummerierten Stopps,
           Infofenster je Route und Vollbild-Ansicht -->
      <div use:erscheine>
        <ReiseKarte reisen={$reisen} journal={$journal}
          orte={orte} eigeneOrte={$eigeneOrte} {springeZu} />
      </div>



    </section>

  {:else if ansicht.tab === 'plan'}
    {#if ansicht.unter === 'etappe' || ansicht.unter === 'route'}
      {@const teile = ansicht.id.split('/')}
      {#key ansicht.id}
        <EtappeDetail etappeId={ansicht.unter === 'etappe' ? teile[0] : null} routeId={ansicht.unter === 'etappe' ? (teile[1] || null) : teile[0]}
          orte={[...orte, ...$eigeneOrte]} {warnungen} {umkreisKm}
          onzurueck={() => zurueck('plan')} onneu={oeffneNeu}
          onlogbuch={(id) => geh('logbuch/etappe/' + id)} onwanderung={(id) => geh('plan/wanderungen/' + id)} />
      {/key}
    {:else if ansicht.unter === 'wanderungen'}
      <Wanderungen orte={[...orte, ...$eigeneOrte]} reisen={$reisen} fokusId={ansicht.id || null} onneu={() => oeffneNeu('wanderung')} />
    {:else if ansicht.unter === 'karte'}
      <Karte {orte} reisen={$reisen} />
    {:else if ansicht.unter === 'kalender'}
      <Kalender kalender={inhalt?.kalender ?? []} box={inhalt?.kalenderBox ?? ''} />
    {:else}
      <PlanAnsicht onoeffne={(eid, rid) => geh(eid ? `plan/etappe/${eid}${rid ? '/' + rid : ''}` : 'plan/route/' + rid)} onneu={oeffneNeu} />
    {/if}

  {:else if ansicht.tab === 'orte'}
    {#if orteUnter !== 'meine' && orteUnter !== 'routen'}
      <div class="orte-neu"><button class="btn" onclick={() => (ortNeuOffen = true)}>{t('+ Ort hinzufügen')}</button></div>
    {/if}
    {#if filternAktiv}
    <div class="filter-hinweis" role="status">
      <span class="fh-text">🔍 {#if suche.trim()}„{suche.trim()}“{/if}{#if suche.trim() && aktiveTags.length}&nbsp;· {/if}{aktiveTags.map((x) => t(x)).join(' · ')}</span>
      <button class="btn" onclick={() => (sucheOffen = true)}>{t('Ändern')}</button>
      <button class="btn" onclick={reset}>{t('✕ Filter aufheben')}</button>
    </div>
    <h2 class="abschnitt">{t('Suchergebnisse')} <span class="count">{treffer.reduce((n, r) => n + r.orte.length, 0)}</span></h2>
    {#if treffer.length === 0}
      <p class="info">{t('Keine Orte für diese Filter.')}</p>
    {:else}
      {#each treffer as r}
        <section class="region">
          <div class="region-titel">{t(r.titel)} <span class="anz">{r.orte.length}</span></div>
          <div class="grid">{#each r.orte as o (o.id)}<Ort ort={o} gefahr={ortGefahren[o.id]} warnung={ortWarnungen[o.id]} />{/each}</div>
        </section>
      {/each}
    {/if}
    {:else if orteUnter === 'norden'}
      <h2 class="abschnitt">{t('Norden: Steep Point, Ningaloo & Pilbara')}</h2>
      {#each norden as r}
        <section class="region">
          <div class="region-titel">{t(r.titel)} <span class="anz">{r.orte.length}</span></div>
          <div class="grid">{#each r.orte as o (o.id)}<Ort ort={o} gefahr={ortGefahren[o.id]} warnung={ortWarnungen[o.id]} />{/each}</div>
        </section>
      {/each}
    {:else if orteUnter === 'osten'}
      <h2 class="abschnitt">{t('Ostküste: Melbourne, Cairns & Whitsundays')}</h2>
      {#each osten as r}
        <section class="region">
          <div class="region-titel">{t(r.titel)} <span class="anz">{r.orte.length}</span></div>
          <div class="grid">{#each r.orte as o (o.id)}<Ort ort={o} gefahr={ortGefahren[o.id]} warnung={ortWarnungen[o.id]} />{/each}</div>
        </section>
      {/each}
    {:else if orteUnter === 'meine'}
      <h2 class="abschnitt">{t('Meine Orte')} <span class="count">{$eigeneOrte.length}</span></h2>
      <div class="mo-kopf">
        <p class="mo-intro">{t('Lege eigene Orte an, so wie die Vorschläge. Sie erscheinen hier und lassen sich in deine Routen einplanen.')}</p>
        <button class="btn" onclick={() => (ortNeuOffen = true)}>{t('+ Ort hinzufügen')}</button>
        {#if unvollstaendig.length && $online}
          <button class="btn voll" onclick={alleVervollstaendigen} disabled={sammelLaeuft}
            title={t('Holt Koordinaten, Beschreibung, Vorschaubild und Rubrik aus dem Netz')}>
            {sammelLaeuft ? t('⏳ läuft …') : tn(unvollstaendig.length, '✨ {n} Ort vervollständigen', '✨ {n} Orte vervollständigen')}
          </button>
        {/if}
      </div>
      {#if $eigeneOrte.length}
        <div class="grid">
          {#each $eigeneOrte as o (o.id)}
            <div class="mo-card">
              <Ort ort={o} gefahr={ortGefahren[o.id]} warnung={ortWarnungen[o.id]} />
              <button class="mo-del" onclick={async () => { if (await loeschFrage(t('Ort „{name}“', { name: o.name }))) loescheEigenenOrt(o.id) }}>{t('🗑 löschen')}</button>
            </div>
          {/each}
        </div>
      {/if}
    {:else if orteUnter === 'routen'}
      <h2 class="abschnitt">{t('Routen-Ideen Süden')}</h2>
      <Routen routen={routenSued} />
      <h2 class="abschnitt">{t('Routen-Ideen Norden')}</h2>
      <Routen routen={routenNord} />
      <div class="ueberblick-konzept"><Uebersicht tour={inhalt?.tour} /></div>
    {:else}
      <h2 class="abschnitt">{t('Süden: Margaret River bis jenseits von Esperance')}</h2>
      {#each sueden as r}
        <section class="region">
          <div class="region-titel">{t(r.titel)} <span class="anz">{r.orte.length}</span></div>
          <div class="grid">{#each r.orte as o (o.id)}<Ort ort={o} gefahr={ortGefahren[o.id]} warnung={ortWarnungen[o.id]} />{/each}</div>
        </section>
      {/each}
    {/if}

  {:else if ansicht.tab === 'logbuch'}
    {#if ansicht.unter === 'tag'}
      {#key ansicht.id}
        <TagBlatt datum={ansicht.id} orte={[...orte, ...$eigeneOrte]} warnungen={warnungenSortiert} {umkreisKm}
          onzurueck={() => zurueck('logbuch')} ontag={(d) => { history.replaceState(null, '', '#/logbuch/tag/' + d); window.dispatchEvent(new HashChangeEvent('hashchange')) }}
          onwanderung={(id) => geh('plan/wanderungen/' + id)} />
      {/key}
    {:else if ansicht.unter === 'lesen'}
      <TagebuchLese orte={[...orte, ...$eigeneOrte]} reisen={$reisen} />
    {:else if ansicht.unter === 'notizen'}
      <Notizen />
    {:else if ansicht.unter === 'tiere'}
      <Tierwelt orte={[...orte, ...$eigeneOrte]} ontag={(d) => geh('logbuch/tag/' + d)} />
    {:else}
      <LogbuchAnsicht orte={[...orte, ...$eigeneOrte]} fokusEtappe={ansicht.unter === 'etappe' ? ansicht.id : null}
        ontag={(d) => geh('logbuch/tag/' + d)} onneu={oeffneNeu} />
    {/if}

  {:else if ansicht.tab === 'mehr'}
    {#if ansicht.unter === 'notfall'}
      <h2 class="abschnitt">{t('🆘 Notfall-Karte')}</h2>
      <Notfall />
    {:else if ansicht.unter === 'vorbereitung'}
      <h2 class="abschnitt">{t('🧳 Reisevorbereitung')}</h2>
      <OfflineCheck {geh} onbackup={onExport} />
      <Reisevorbereitung />
    {:else if ansicht.unter === 'gefahren'}
      <h2 class="abschnitt">{t('Gefahrenlage')} {#if warnungen.length}<span class="warnzahl">{t('{length} amtlich', { length: warnungen.length })}</span>{/if}{#if betroffene.length}<span class="count"> {t('· {length} Wetter-betroffen', { length: betroffene.length })}</span>{/if}{#if strassenZahl.sperrungen}<span class="count"> {t('· {sperrungen} Straßensperrungen', { sperrungen: strassenZahl.sperrungen })}</span>{/if}</h2>
      <Gefahren orte={[...orte, ...$eigeneOrte]} standort={standortGefahr} laden={gefahrenLaden} fehler={gefahrenFehler}
        stand={gefahrenStand} ausCache={ausCache} betroffene={betroffene}
        warnungen={warnungenSortiert} betroffeneWarnungen={betroffeneWarnungen} onRefresh={() => pruefeGefahren(true)}
        bind:umkreisKm={umkreisKm} bedingungen={auffaelligeBedingungen(bedingungen)}
        quellenFehler={quellenFehler}
        meinOrt={$standort} ortStatus={$standortStatus}
        ortText={standortHinweis($standortStatus, $standortFehler)}
        onOrt={() => frageStandortAn({ hoheGenauigkeit: true, alterMs: 0 })} />
    {:else if ansicht.unter === 'packliste'}
      <h2 class="abschnitt">{t('🎒 Packliste: Solo Outback')}</h2>
      <Packliste />
    {:else if ansicht.unter === 'praxis'}
      <h2 class="abschnitt">{t('Praxis & Sicherheit')}</h2>
      <Praxis warnung={inhalt?.praxisWarnung ?? ''} liste={inhalt?.praxisListe ?? []}
        quellen={inhalt?.quellen ?? ''} fussnote={inhalt?.fussnote ?? ''} />
    {:else if ansicht.unter === 'musik'}
      <h2 class="abschnitt">{t('🎵 Musik unterwegs')}</h2>
      <MusikSeite orte={[...orte, ...$eigeneOrte]} />
    {:else if ansicht.unter === 'teilen'}
      <h2 class="abschnitt">{t('📤 Reisebericht teilen')}</h2>
      <Teilen orte={[...orte, ...$eigeneOrte]} />
    {:else if ansicht.unter === 'handbuch'}
      <Handbuch />
    {:else if ansicht.unter === 'quiz'}
      <h2 class="abschnitt">{t('🇦🇺 Australien-Quiz')} {#if quizErgebnis.beantwortet}<span class="count">{t('{richtig}/{gesamt} · {emoji} Stufe {stufe}', { richtig: quizErgebnis.richtig, gesamt: quizErgebnis.gesamt, emoji: quizErgebnis.level?.emoji, stufe: quizErgebnis.level?.stufe })}</span>{/if}</h2>
      <Quiz fragen={quizData.fragen} levels={quizData.levels} />
    {:else}
      <ul class="mehr-liste">
        {#each UNTER.mehr as [pfad, label] (pfad)}
          <li><a href="#/{pfad}" onclick={(e) => { e.preventDefault(); geh(pfad) }}><span class="ml-txt"><b>{label}</b><small>{MEHR_INFO[pfad]}</small></span><span class="ml-pfeil" aria-hidden="true">›</span></a></li>
        {/each}
      </ul>
    {/if}
  {/if}
</main>

<footer class="app-footer">TravelBuddy <span class="af-by">by <a href="https://github.com/Kotdesigner" target="_blank" rel="noopener">Kotdesigner</a></span><span class="af-build" title={t('Stand dieser Fassung. Zeigt der Browser eine ältere, hilft ein harter Neuladen.')}>{t('Basic · Build {__BUILD__}', { __BUILD__: buildText })}</span></footer>
</div>
</div>

<Toast />

<!-- Unten fürs iPhone, am Mac steht links die Seitenleiste -->
<div class="bb-mobil">
  <BottomBar {aktivTab} onTab={tabZu} {springeZu}
    onSuche={zurSuche} onBackup={onExport} onImport={() => importInput.click()}
    onHandbuch={() => geh('mehr/handbuch')}
    onEinfuehrung={einfuehrungStarten} />
</div>

<svelte:window bind:scrollY onkeydown={globaleTaste} />

{#if sucheOffen}
  <Suchblatt orte={[...orte, ...$eigeneOrte]} alleTags={ALLE_TAGS} {tagClass}
    begriff={suche} etiketten={aktiveTags}
    onclose={() => (sucheOffen = false)} onwahl={zuOrt} onkacheln={alsKacheln}
    onxoxo={() => { sucheOffen = false; xoxoOffen = true }}
    onsnake={() => { sucheOffen = false; snakeOffen = true }}
    onvier={() => { sucheOffen = false; vierOffen = true }}
    ongeh={(p) => { sucheOffen = false; geh(p) }} />
{/if}

<!-- Datei-Input immer im DOM (sonst bricht der Import ab, wenn das Dock während der Dateiauswahl zuklappt) -->
<input bind:this={importInput} type="file" accept="application/json,.json" onchange={onImport} hidden />

<!-- Zusammenführender Import: ein Bildschirm vorher, einer danach. Keine Rückfrage
     je Konflikt — 40-mal „welchen willst du behalten?“ beantwortet niemand ehrlich. -->
{#if importOffen && importVorschau}
  <div class="imp-hg" data-dialog-hg onclick={() => (importOffen = false)} aria-hidden="true"></div>
  <div class="imp" role="dialog" aria-label={t('Backup übernehmen')} use:modal={{ onclose: () => (importOffen = false) }}>
    <h3>{t('Backup von {herkunftName}', { herkunftName: herkunftName(importDatei) })}</h3>
    <p class="imp-zeit">{importDatei?.exportiert ? datumZeit(importDatei.exportiert) : t('ohne Datum')}</p>
    <p class="imp-kern"><b>{t('Zusammenführen.')}</b> {t('Nichts auf diesem Gerät wird gelöscht.')}</p>

    {#if importVorschau.bericht.length}
      <table class="imp-tab">
        <thead><tr><th></th><th>{t('kommt dazu')}</th><th>{t('wird ergänzt')}</th><th>{t('bleibt')}</th></tr></thead>
        <tbody>
          {#each importVorschau.bericht as b}
            <tr>
              <td class="t-name">{b.topf}</td>
              <td class:null={!b.neu}>{b.neu || '–'}</td>
              <td class:null={!b.ergaenzt}>{b.ergaenzt || '–'}</td>
              <td class="t-grau">{b.gleich || '–'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="imp-nix">{t('Die Datei enthält nichts, was hier fehlt. Ein Zusammenführen ändert nichts.')}</p>
    {/if}

    {#each importVorschau.hinweise as h}<div class="imp-warn">{h}</div>{/each}
    {#if importVorschau.summe.geloescht}
      <div class="imp-warn">{t('{geloescht} Eintrag/Einträge verschwinden auch hier, weil du sie auf dem anderen Gerät gelöscht hast.', { geloescht: importVorschau.summe.geloescht })}</div>
    {/if}

    <div class="imp-akt">
      <button class="imp-ok" onclick={importZusammenfuehren} disabled={importLaeuft}>
        {importLaeuft ? t('einen Moment …') : t('Zusammenführen')}
      </button>
      <button class="imp-ab" onclick={() => (importOffen = false)}>{t('Abbrechen')}</button>
    </div>
    <button class="imp-ersetz" onclick={importErsetzen}>{t('Stattdessen alles auf diesem Gerät ersetzen')}</button>
  </div>
{/if}

{#if importBericht}
  <div class="imp-hg" data-dialog-hg onclick={() => (importBericht = null)} aria-hidden="true"></div>
  <div class="imp" role="dialog" aria-label={t('Ergebnis')} use:modal={{ onclose: () => (importBericht = null) }}>
    <h3>{t('✓ Übernommen')}</h3>
    <p class="imp-kern">{t('{neu} neu · {ergaenzt} ergänzt · {gleich} unverändert', { neu: importBericht.summe.neu, ergaenzt: importBericht.summe.ergaenzt, gleich: importBericht.summe.gleich })}{#if importBericht.summe.geloescht}&nbsp;{t('· {geloescht} gelöscht', { geloescht: importBericht.summe.geloescht })}{/if}</p>
    {#each importBericht.hinweise as h}<div class="imp-warn">{h}</div>{/each}
    <div class="imp-akt">
      <button class="imp-ok" onclick={() => (importBericht = null)}>{t('Fertig')}</button>
      <!-- Nur wenn DIESER Import etwas geändert hat. Sonst gehörte der Schnappschuss zu einem
           früheren Import, und „Rückgängig“ würfe dessen Ergebnis weg. -->
      {#if importBericht.summe.neu || importBericht.summe.ergaenzt || importBericht.summe.geloescht}
        <button class="imp-ab" onclick={importZurueck}>
          {t('Rückgängig')}{#if $schnappschuss?.umfang} {t('(zurück auf {tagebuch} Reisetage)', { tagebuch: $schnappschuss.umfang.tagebuch })}{/if}
        </button>
      {/if}
    </div>
  </div>
{/if}

{#if scrollY > 900}
  <button class="nach-oben" onclick={nachOben} title={t('Nach ganz oben')} aria-label={t('Nach ganz oben')}>↑</button>
{/if}

{#if ortNeuOffen}
  <OrtNeu orte={[...orte, ...$eigeneOrte]} onclose={() => (ortNeuOffen = false)} onfertig={ortNeuFertig}
    onzeigen={(o) => { ortNeuOffen = false; zuOrt(o) }} />
{/if}

<Einfuehrung {geh} anzahlOrte={orte.length} />

{#if neuOffen}
  <NeuBlatt typ={neuOffen.typ} vorlage={neuOffen.vorlage} orte={[...orte, ...$eigeneOrte]}
    onclose={() => neuAnfrage.set(null)} onfertig={neuFertig} />
{/if}

<DialogHost />
<TresorDialog />

{#if xoxoOffen}
  <XoxoSpiel onClose={() => (xoxoOffen = false)} />
{/if}

{#if snakeOffen}
  <SnakeSpiel onClose={() => (snakeOffen = false)} />
{/if}

{#if vierOffen}
  <VierSpiel onClose={() => (vierOffen = false)} />
{/if}

<style>
  .hero > .hero-musik { position: absolute; z-index: 2; top: calc(env(safe-area-inset-top, 0px) + 14px); right: 14px; text-shadow: none; }
  .sk-musik { margin-left: auto; display: inline-flex; }
  .sk-musik + .sk-neu { margin-left: 0; }
  .hero {
    position: relative; overflow: hidden;
    background: #14110e url('/header.jpg') center 52% / cover no-repeat;
    color: #fff; padding: 62px 24px 52px; padding-top: calc(env(safe-area-inset-top, 0px) + 62px);
    text-shadow: 0 2px 10px rgba(0,0,0,0.6);
  }
  .hero::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background:
      linear-gradient(93deg, rgba(9,7,5,0.90) 0%, rgba(9,7,5,0.78) 32%, rgba(9,7,5,0.45) 52%, rgba(9,7,5,0.12) 70%, rgba(9,7,5,0) 84%),
      linear-gradient(0deg, rgba(9,7,5,0.60) 0%, rgba(9,7,5,0) 42%);
  }
  .hero > * { position: relative; z-index: 1; }
  .hero .kicker {
    display: flex; flex-direction: column; align-items: center; gap: 2px; width: max-content;
    letter-spacing: 3px; font-size: calc(12px * var(--schrift, 1)); text-transform: uppercase; font-weight: 700; opacity: 0.9; line-height: 1.4;
  }
  .hero .kicker .k-datum { text-align: center; transition: opacity var(--t-med, 0.25s) ease; }
  /* bis die Daten geladen sind, nicht das Vorgabe-Datum aufblitzen lassen */
  .hero .kicker .k-datum.k-wartet { opacity: 0; }
  .hero .kicker .k-bis { display: block; }
  .hero h1 {
    font-family: 'Anton', 'Arial Narrow', sans-serif; font-weight: 400;
    font-size: calc(clamp(44px, 7.4vw, 68px) * var(--schrift, 1)); line-height: 0.92; margin: 8px 0 10px;
    text-transform: uppercase; letter-spacing: 0;
    color: #fff; text-shadow: 0 3px 16px rgba(0,0,0,0.78), 0 1px 2px rgba(0,0,0,0.9);
    /* zweizeilig gestapelt; Breite = das breitere Wort (AUSTRALIA) */
    display: inline-flex; flex-direction: column; align-items: stretch; width: max-content; max-width: 100%;
  }
  /* WESTERN über die volle Breite spreizen -> vorne & hinten bündig mit AUSTRALIA */
  .hero h1 .stretch { display: flex; justify-content: space-between; }
  .hero h1 .akz { color: #f0b453; }
  .app-footer {
    /* Steht immer am unteren Rand, auch auf kurzen Seiten. */
    margin-top: auto; text-align: center; padding: 18px 16px calc(22px + env(safe-area-inset-bottom, 0px));
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); border-top: 1px solid var(--line);
  }
  .app-footer .af-by { color: var(--brand-text); }
  .app-footer .af-by a { color: inherit; text-decoration: underline; text-underline-offset: 2px; padding: 8px 2px; }
  /* Stand der geladenen Fassung — macht sofort sichtbar, wenn der Service-Worker
     noch eine ältere Version ausliefert. */
  .app-footer .af-build { display: block; margin-top: 4px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }   /* vorher opacity .5: 2,2 : 1 */

  .filter-hinweis {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    margin: 4px 0 8px; padding: 10px 12px; border-radius: var(--radius-m);
    background: var(--flaeche-2); border: 1px solid var(--line);
  }
  .fh-text { flex: 1; min-width: 0; font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
  /* ---- Rahmen. Mac: Seitenleiste links + Inhalt. iPhone: Inhalt + Leiste unten ---- */
  .app { display: flex; align-items: flex-start; min-height: 100dvh; }
  .inhalt { flex: 1; min-width: 0; min-height: 100dvh; display: flex; flex-direction: column; }
  .inhalt > main { width: 100%; }
  .sl-mac { display: contents; }
  .bb-mobil { display: none; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 18px 28px 90px; }
  .sk {
    max-width: 1100px; width: 100%; margin: 0 auto; display: flex; align-items: center; gap: 12px;
    padding: 26px 28px 4px; padding-top: max(26px, calc(env(safe-area-inset-top, 0px) + 10px));
  }
  .zurueck-leiste {
    position: sticky; top: 0; z-index: 30; background: var(--bg);
    padding: calc(env(safe-area-inset-top, 0px) + 4px) 8px 0;
  }
  .zurueck-leiste + .sk { padding-top: 0; }
  .zurueck-knopf { display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 12px 0 4px; border: none; background: none; color: var(--brand-text); font-size: calc(16px * var(--schrift, 1)); font-weight: 600; cursor: pointer; }
  .zurueck-knopf span { font-size: calc(28px * var(--schrift, 1)); line-height: 1; margin-top: -3px; }
  @media (min-width: 900px) { .zurueck-leiste { display: none; } .zurueck-leiste + .sk { padding-top: 26px; } }
  .sk-titel { min-height: 44px; display: flex; align-items: center; margin: 0; font-family: 'Anton', Impact, 'Arial Narrow', sans-serif; font-weight: 400; font-size: calc(40px * var(--schrift, 1)); line-height: 1.05; letter-spacing: 0.3px; color: var(--ink); }
  .sk-neu {
    margin-left: auto; min-height: 44px; padding: 0 18px; border-radius: 22px; border: none; cursor: pointer;
    background: var(--brand); color: #fff; font-size: calc(15px * var(--schrift, 1)); font-weight: 800; box-shadow: var(--shadow);
  }
  .seg-leiste {
    max-width: 1100px; width: 100%; box-sizing: border-box; margin: 0 auto; display: flex; gap: 6px; overflow-x: auto; padding: 10px 28px 4px;
    scrollbar-width: none; -webkit-overflow-scrolling: touch; scroll-padding: 0 28px;
  }
  /* Am Mac stehen dieselben Unterpunkte schon in der Seitenleiste */
  @media (min-width: 900px) { .seg-leiste { display: none; } }
  .seg-leiste::-webkit-scrollbar { display: none; }
  .seg-chip {
    flex: 0 0 auto; display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border-radius: 22px;
    border: 1px solid var(--line); background: var(--card); color: var(--muted); font-size: calc(14.5px * var(--schrift, 1)); font-weight: 700;
    text-decoration: none; white-space: nowrap;
    transition: background-color var(--t-med) var(--ease-out), color var(--t-med) var(--ease-out), border-color var(--t-med) var(--ease-out), transform 120ms var(--ease-out);
  }
  .seg-chip:active { transform: scale(0.96); }
  .seg-chip.an { background: var(--ink); border-color: var(--ink); color: var(--bg); }
  .mehr-liste { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-width: 520px; }
  .mehr-liste a {
    display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 64px; padding: 10px 16px;
    background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); color: var(--ink);
    text-decoration: none; font-size: calc(16px * var(--schrift, 1)); box-shadow: var(--shadow);
    transition: transform 120ms var(--ease-out), box-shadow var(--t-fast) var(--ease-out);
  }
  .mehr-liste a:active { transform: scale(0.98); }
  .mehr-liste a:hover { box-shadow: var(--shadow-float); }
  .ml-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .ml-txt b { font-weight: 700; }
  .ml-txt small { font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); line-height: 1.35; }
  .mehr-liste .ml-pfeil { font-size: calc(22px * var(--schrift, 1)); color: var(--muted); }
  .mehr-liste li { animation: rein-unten var(--t-slow) var(--ease-out) backwards; }
  .mehr-liste li:nth-child(2) { animation-delay: 30ms; } .mehr-liste li:nth-child(3) { animation-delay: 60ms; }
  .mehr-liste li:nth-child(4) { animation-delay: 90ms; } .mehr-liste li:nth-child(5) { animation-delay: 120ms; }
  .mehr-liste li:nth-child(6) { animation-delay: 150ms; }
  .heute-zahlen { margin-top: 18px; }
  .wrap > .abschnitt:first-child { margin-top: 8px; }
  @media (min-width: 900px) {
    .hero { padding: 48px 28px 40px; }
  }
  @media (max-width: 899px) {
    .sl-mac { display: none; }
    .bb-mobil { display: contents; }
    .wrap { padding: 14px 14px calc(96px + env(safe-area-inset-bottom, 0px)); }
    .sk { padding: 14px 14px 2px; padding-top: max(18px, calc(env(safe-area-inset-top, 0px) + 8px)); }
    .sk-titel { font-size: calc(34px * var(--schrift, 1)); }
    .seg-leiste { padding: 8px 14px 2px; scroll-padding: 0 14px; }
    /* Läuft die Leiste über, blendet der rechte Rand weich aus: man sieht, dass es weitergeht */
    .seg-leiste.mehr-rechts { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 44px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 44px), transparent); }
    .seg-leiste.mehr-links.mehr-rechts { -webkit-mask-image: linear-gradient(90deg, transparent, #000 32px, #000 calc(100% - 44px), transparent); mask-image: linear-gradient(90deg, transparent, #000 32px, #000 calc(100% - 44px), transparent); }
    .seg-leiste.mehr-links:not(.mehr-rechts) { -webkit-mask-image: linear-gradient(90deg, transparent, #000 32px); mask-image: linear-gradient(90deg, transparent, #000 32px); }
    .app-footer { padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)); }
    .nach-oben { display: none !important; }
  }
  .anchor { scroll-margin-top: 96px; }
  .abschnitt {
    font-size: calc(24px * var(--schrift, 1)); color: var(--brand-text); font-weight: 800; margin: 30px 0 12px;
    border-bottom: 3px solid var(--brand-2); padding-bottom: 8px;
  }
  .abschnitt .count { font-size: calc(14px * var(--schrift, 1)); color: var(--muted); font-weight: 600; }
  .abschnitt .warnzahl { font-size: calc(13px * var(--schrift, 1)); color: #fff; background: #c0392b; font-weight: 700; padding: 2px 10px; border-radius: 12px; vertical-align: middle; }
  /* Roadtrip-Cockpit (Kennzahl-Kacheln) */
  .hz-auf {
    width: 100%; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 52px; margin: 0 0 14px;
    padding: 10px 14px; background: var(--card); color: var(--ink); border: 1px solid var(--line); border-radius: 12px;
    box-shadow: var(--shadow); cursor: pointer; text-align: left; font: inherit;
  }
  .hz-titel { font-size: calc(15px * var(--schrift, 1)); font-weight: 800; }
  .hz-kurz { flex: 1; min-width: 0; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
  .hz-auf .aufklapp { margin-left: auto; }
  .cockpit {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 10px; margin-bottom: 14px;
  }
  .kachel {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow);
    padding: 13px 12px; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-decoration: none;
  }
  .kachel.fest { background: linear-gradient(140deg, var(--btn-flaeche), var(--card)); }
  .kachel.klick { cursor: pointer; }
  .kachel.klick:hover { border-color: var(--brand-2); }
  .k-zahl { font-size: calc(26px * var(--schrift, 1)); font-weight: 800; color: var(--ink); line-height: 1; font-variant-numeric: tabular-nums; }
  .k-plus { font-size: calc(14px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-left: 2px; }
  .k-lbl { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  /* Quiz-Kachel: eine Kachel breiter, klappt beim Klick auf volle Breite auf */
  .quiz-kachel { grid-column: span 2; text-align: left; font-family: inherit; }
  .quiz-kachel.offen { grid-column: 1 / -1; }
  .qk-panel { width: 100%; margin-top: 9px; padding-top: 9px; border-top: 1px solid var(--line); }
  .qk-titel { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }
  .qk-stat { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; margin-top: 3px; }
  .qk-text { font-size: calc(13px * var(--schrift, 1)); color: var(--ink); line-height: 1.55; margin: 7px 0 0; white-space: normal; }
  .qk-toggle { display: flex; flex-direction: column; align-items: inherit; gap: inherit; width: 100%; padding: 0; margin: 0;
    border: none; background: none; color: inherit; font: inherit; text-align: inherit; cursor: pointer; }
  .qk-link { display: inline-flex; align-items: center; min-height: 32px; margin-top: 4px; padding: 0; border: none; background: none; cursor: pointer; font: inherit; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--brand-text); }
  .qk-link:hover { text-decoration: underline; }

  .ub-platzhalter { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); background: var(--flaeche); border: 1px dashed #d8c9ac; padding: 16px; border-radius: 10px; line-height: 1.5; }

  .fakten-box { background: linear-gradient(150deg, var(--btn-flaeche), var(--card)); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 14px 16px; margin-bottom: 20px; }
  .fb-titel { font-size: calc(15px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); margin-bottom: 10px; }
  .fb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
  .fb-kachel { display: flex; flex-direction: column; gap: 2px; }
  .fb-zahl { font-size: calc(22px * var(--schrift, 1)); font-weight: 800; color: var(--ink); line-height: 1; font-variant-numeric: tabular-nums; }
  .fb-aud { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); line-height: 1.2; }
  .budget { margin-bottom: 12px; }
  .bg-set { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); display: inline-flex; align-items: center; gap: 6px; }
  .bg-set input { width: 110px; font-size: calc(13px * var(--schrift, 1)); padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--eingabe); color: var(--ink); font-weight: 700; }
  .bg-bar { height: 9px; background: #ece2cf; border-radius: 6px; overflow: hidden; margin: 10px 0 7px; }
  .bg-fill { height: 100%; background: #2f7a63; transform-origin: left; transition: transform var(--t-slow) var(--ease-spring), background-color var(--t-med); }
  .bg-fill.warn { background: #e0a72b; }
  .bg-fill.over { background: #c0392b; }
  .bg-zahlen { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .bg-zahlen b { color: var(--ink); font-size: calc(15px * var(--schrift, 1)); }
  .bg-zahlen .neg b { color: var(--danger-text); }
  .fb-lbl { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .fb-facts { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 8px; }
  .fb-facts li { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 600; color: var(--ink); background: var(--flaeche); border: 1px solid var(--line); border-radius: 18px; padding: 5px 11px; }
  .fb-gesamt { margin-top: 12px; font-size: calc(13.5px * var(--schrift, 1)); color: var(--ink); background: var(--ok-flaeche); border-left: 3px solid #2f7a63; padding: 8px 12px; border-radius: 0 8px 8px 0; }
  .fb-gesamt b { color: var(--brand-text); }
  .fb-split { display: flex; flex-direction: column; gap: 5px; margin-top: 12px; background: var(--ok-flaeche); border-left: 3px solid #2f7a63; padding: 9px 12px; border-radius: 0 8px 8px 0; }
  .fs-zeile { font-size: calc(13px * var(--schrift, 1)); color: var(--ink); font-weight: 700; }
  .fs-zeile .fs-sub { font-weight: 500; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); }
  .fb-hinweis { margin-top: 10px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .fb-leer { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.55; margin: 4px 0 0; }
  .fb-leer b { color: var(--ink); }
  .bilanz-detail { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; box-shadow: var(--shadow); }
  .ueberblick-zeit { margin-bottom: 20px; }
  .ub-titel { font-size: calc(15px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); margin: 0 0 10px; }
  .ueberblick-konzept { border-top: 1px solid var(--line); padding-top: 18px; }
  .b-block { margin-top: 8px; font-size: calc(13px * var(--schrift, 1)); line-height: 1.9; }
  .b-block:first-child { margin-top: 0; }
  .b-lbl { font-weight: 700; color: var(--ink); margin-right: 6px; }
  .b-item { display: inline-block; background: #faf1e4; border-radius: 8px; padding: 2px 9px; margin: 0 5px 5px 0; color: var(--muted); }
  .b-item b { color: var(--warn-text); }

  .region { margin: 16px 0 24px; }
  .region-titel {
    color: #fff; font-weight: 700; font-size: calc(15px * var(--schrift, 1)); padding: 9px 16px; border-radius: 8px 8px 0 0;
    background: #7a5c8e; display: flex; align-items: center; gap: 8px;
  }
  .region-titel .anz { font-size: calc(12px * var(--schrift, 1)); background: rgba(0,0,0,0.28); padding: 1px 8px; border-radius: 10px; }
  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;
    background: var(--card); border: 1px solid var(--line); border-top: none; padding: 16px; border-radius: 0 0 8px 8px;
  }
  .info { color: var(--muted); padding: 40px 0; text-align: center; }
  .fehler { color: var(--danger-text); }

  .mo-kopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .mo-intro { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); margin: 0; flex: 1 1 300px; }
  .btn.voll { background: var(--ok-flaeche); border-color: var(--ok-linie); color: var(--ok-text); }
  .btn { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 8px 13px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; }
  .btn:disabled { opacity: 0.4; }
  .mo-card { display: flex; flex-direction: column; }
  .orte-neu { display: flex; justify-content: flex-end; margin: 4px 0 -6px; }
  .mo-del { margin-top: 2px; min-height: 32px; padding: 0 6px 0 0; display: inline-flex; align-items: center; font-size: calc(12px * var(--schrift, 1)); color: var(--danger-text); background: none; border: none; cursor: pointer; align-self: flex-start; }

  .nach-oben {
    /* Rechts unten. Links lag er über der Seitenleiste und verdeckte „Online“ */
    position: fixed; right: 20px; bottom: 20px; z-index: 100;
    animation: rein-auf var(--t-med) var(--ease-spring);
    width: 46px; height: 46px; border-radius: 50%; border: none; cursor: pointer;
    background: #2b2621; color: #fff; font-size: calc(22px * var(--schrift, 1)); line-height: 1;
    box-shadow: 0 3px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .nach-oben:hover { background: var(--brand); }
  @media (max-width: 520px) {
    .hero { padding: 30px 16px 30px; padding-top: calc(env(safe-area-inset-top, 0px) + 34px); }
    .hero h1 { font-size: calc(28px * var(--schrift, 1)); }
    .wrap { padding: 18px 13px 90px; }
    .abschnitt { font-size: calc(20px * var(--schrift, 1)); }
    /* Orte am Handy ZWEISPALTIG. Eine Spalte hieß: knapp zwei Orte je Bildschirm,
       und bei 142 Orten scrollt man sich tot. Zwei Kacheln nebeneinander zeigen
       fünf bis sechs auf einmal — man überfliegt sie, statt sie abzuarbeiten.
       minmax(0,1fr) statt 1fr: sonst sprengen lange Ortsnamen die Spalte. */
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 12px; }
    /* Mit großer Schrift passen zwei Karten nicht mehr nebeneinander (darstellung.js entscheidet) */
    :global(html[data-eine-spalte]) .grid { grid-template-columns: minmax(0, 1fr); }
    .region-titel { font-size: calc(13px * var(--schrift, 1)); }
    /* Kennzahl-Kacheln: 2 kleine nebeneinander, große (Quiz) volle Breite */
    .cockpit { grid-template-columns: 1fr 1fr; }
    .fb-grid { grid-template-columns: 1fr 1fr; }
  }

  /* ---- Zusammenführender Import ---- */
  .imp-hg { position: fixed; inset: 0; background: rgba(20,15,10,0.45); z-index: calc(var(--z-sheet) - 1); }
  .imp {
    position: fixed; z-index: var(--z-sheet); left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: min(520px, calc(100vw - 28px)); max-height: 86vh; max-height: 86dvh; overflow: auto; overscroll-behavior: contain;
    background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    padding: 20px 22px; box-shadow: var(--shadow-float);
  }
  .imp h3 { margin: 0 0 2px; font-size: calc(17px * var(--schrift, 1)); color: var(--brand-text); }
  .imp-zeit { margin: 0 0 12px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .imp-kern { margin: 0 0 14px; font-size: calc(14px * var(--schrift, 1)); }
  .imp-nix { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); background: var(--flaeche); padding: 10px; border-radius: 8px; }
  .imp-tab { width: 100%; border-collapse: collapse; font-size: calc(13px * var(--schrift, 1)); margin-bottom: 12px; }
  .imp-tab th { text-align: right; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); padding: 0 6px 5px; }
  .imp-tab th:first-child { text-align: left; }
  .imp-tab td { padding: 5px 6px; text-align: right; border-top: 1px solid var(--line); font-variant-numeric: tabular-nums; font-weight: 700; }
  .imp-tab td.t-name { text-align: left; font-weight: 600; }
  .imp-tab td.t-grau, .imp-tab td.null { color: var(--muted); font-weight: 400; }
  .imp-warn {
    font-size: calc(12px * var(--schrift, 1)); line-height: 1.5; color: #8a4a12; background: var(--warn-flaeche);
    border-radius: 8px; padding: 8px 10px; margin-bottom: 6px;
  }
  .imp-akt { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .imp-ok { flex: 1 1 auto; min-height: 44px; font-size: calc(14px * var(--schrift, 1)); font-weight: 800; border: none;
    border-radius: 10px; background: #2f7a63; color: #fff; cursor: pointer; }
  .imp-ok:disabled { opacity: 0.6; }
  .imp-ab { min-height: 44px; padding: 0 16px; font-size: calc(13px * var(--schrift, 1)); font-weight: 700; border: 1px solid var(--line-stark);
    border-radius: 10px; background: var(--card); color: var(--btn-ink); cursor: pointer; }
  .imp-ersetz { display: block; margin: 12px auto 0; background: none; border: none; cursor: pointer;
    font-size: calc(12px * var(--schrift, 1)); color: var(--danger-text); text-decoration: underline; }
</style>
