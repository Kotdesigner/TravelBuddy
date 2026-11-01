<script>
  import { erlebt } from './erlebt.js'
  import { eintragTage, zieleVon, streckeText } from './plan.js'
  import { tagesPunkte } from './reisefahrt.js'
  import { t, je, LOCALE, tn } from './i18n.js'
  import { ZWEI } from './format.js'
  // Feld-Beschriftungen mit ihren Eingaben verbinden (VoiceOver las nur „Textfeld“)
  const feldUid = Math.random().toString(36).slice(2, 8)
  const lblId = (fid) => `lf-${feldUid}-${fid}`
  import { warnungenFuer } from './warnungen.js'
  import { MODULE } from './journal-schema.js'
  import { get } from 'svelte/store'
  import { updateJournalEintrag, setJournalFeld, loescheJournalEintrag, userData, journal } from './userdata.js'
  import { macheThumbnail } from './thumbnail.js'
  import { audioVerfuegbar, starteAufnahme } from './audio.js'
  import SonneWetter from './SonneWetter.svelte'
  import OrtWahl from './OrtWahl.svelte'
  import { etappeAm, routenDerEtappe, tageZwischen, gueltigesDatum } from './plan.js'
  import { stimmigeLegs } from './routing.js'
  import { loeschFrage } from './dialog.js'
  import { dauer, klapp } from './motion.js'
  import { fotoInfo, bereinigeMeta } from './foto-zuordnung.js'
  import FotoImport from './FotoImport.svelte'
  import TiereGesehen from './TiereGesehen.svelte'
  import AusgabenListe from './AusgabenListe.svelte'
  import { bereich } from './format.js'

  let { eintrag, orte = [], reisen = [], warnungen = [], umkreisKm = 150, neuAngelegt = false, immerOffen = false, eintraege = [] } = $props()

  // Ein voll ausgeklappter Reisetag ist ueber 1600 px hoch. Bei 40 Tagen waere die
  // Seite unbenutzbar — also grundsaetzlich zugeklappt.
  // NUR der gerade angelegte Tag startet offen. „Leer = offen“ waere falsch: bei den
  // vorhandenen Tagen sind mehrere noch leer, die klappten dann alle auf und die Seite
  // waere wieder unübersichtlich lang.
  let aufgeklappt = $state(false)
  let zuerst = true
  $effect(() => { if (zuerst) { zuerst = false; aufgeklappt = neuAngelegt || immerOffen } })

  // Was in der zugeklappten Zeile steht.
  const kurzDatum = $derived.by(() => {
    if (!eintrag.datum) return t('ohne Datum')
    if (eintrag.bis) return bereich(eintrag.datum, eintrag.bis)
    try { return new Date(eintrag.datum + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: ZWEI, month: 'short' }) }
    catch { return eintrag.datum }
  })
  const anzahlModule = $derived(
    themenModule.reduce((n, m) => n + (anzahl(m) > 0 ? 1 : 0), 0)
  )
  const anzahlFelder = $derived(Object.values(eintrag.felder || {}).filter(
    (w) => w != null && w !== '' && !(Array.isArray(w) && !w.length)).length)
  const auszug = $derived((eintrag.text || '').trim().replace(/\s+/g, ' ').slice(0, 90))

  // Warnungen im Umkreis dieses Reisetages — nur Vorschlag, siehe Markup unten.
  const ortWarnungen = $derived(
    eintrag.lat == null || !warnungen.length ? [] : warnungenFuer(warnungen, eintrag.lat, eintrag.lon, umkreisKm)
  )
  // Freitext-Schlagworte: das Feld erlaubt eigene Werte, nicht nur die Vorgaben.
  const warnTags = $derived(ortWarnungen.map((w) => `${w.icon} ${w.titel.slice(0, 46)}`))
  const schonUebernommen = $derived(
    warnTags.length > 0 && warnTags.every((t) => (eintrag.felder?.hazards_faced || []).includes(t))
  )
  function warnungenUebernehmen() {
    const cur = eintrag.felder?.hazards_faced || []
    setFeld('hazards_faced', [...cur, ...warnTags.filter((t) => !cur.includes(t))])
  }

  // --- Nahe Ereignisse: nur was du selbst auswählst, kommt ins Tagebuch ---
  const tageDesEintrags = $derived(new Set(eintragTage(eintrag)))
  const ereignisseHier = $derived($erlebt.filter((x) => tageDesEintrags.has(x.datum)))
  const istDrin = (x) => (eintrag.ereignisse || []).some((y) => y.id === x.id)
  function ereignisUmschalten(x) {
    const alt = eintrag.ereignisse || []
    updateJournalEintrag(eintrag.id, { ereignisse: istDrin(x) ? alt.filter((y) => y.id !== x.id) : [...alt, x] })
  }

  // --- Amtliche Lage als Wortlaut ins Logbuch ---
  //
  // Der alte Knopf hing an vier Bedingungen gleichzeitig (Warnungen geladen UND
  // Koordinaten UND mindestens ein Treffer im Umkreis) und war deshalb fast nie da.
  // Jetzt ist er immer sichtbar und sagt selbst, warum er gerade nicht kann.
  // „Keine Warnung“ ist ebenfalls ein Befund und wird festgehalten — sonst weiß man
  // später nicht, ob nichts los war oder nur nichts abgefragt wurde.
  const kannLage = $derived(eintrag.lat != null && eintrag.lon != null && warnungen.length > 0)
  const lageGrund = $derived(
    eintrag.lat == null || eintrag.lon == null
      ? t('Erst oben einen Ort wählen. Ohne Kartenpunkt lässt sich kein Umkreis prüfen.')
      : !warnungen.length
        ? t('Amtliche Meldungen sind noch nicht geladen. Unter Mehr → Gefahrenlage aktualisieren (braucht Internet).')
        : ''
  )
  let lageMeldung = $state('')
  function amtlicheLageUebernehmen() {
    if (!kannLage) return
    const jetzt = new Date().toLocaleString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', hour: ZWEI, minute: '2-digit' })
    const kopf = t('Abgefragt {jetzt} · Umkreis {umkreisKm} km · {wert}', { jetzt, umkreisKm, wert: eintrag.ort || t('Position des Tages') })
    const zeilen = ortWarnungen.map((w) =>
      `${w.icon} ${w.level}: ${w.titel} (${Math.max(1, Math.round(w.km))} km, ${w.staat})`)
    const block = zeilen.length
      ? `${kopf}\n${zeilen.join('\n')}`
      : t('{kopf}\nKeine amtlichen Warnungen im Umkreis.', { kopf })

    const alt = (eintrag.felder?.amtliche_lage || '').trim()
    setFeld('amtliche_lage', alt ? `${alt}\n\n${block}` : block)
    if (warnTags.length) warnungenUebernehmen()

    // Das Modul aufklappen, sonst schreibt der Knopf sichtbar ins Nichts.
    offen.warnung = true
    lageMeldung = zeilen.length
      ? tn(zeilen.length, '✓ {n} Meldung übernommen', '✓ {n} Meldungen übernommen')
      : t('✓ festgehalten: keine Warnungen')
    setTimeout(() => (lageMeldung = ''), 4000)
  }

  const metaModul = MODULE.find((m) => m.id === 'meta')
  const themenModule = MODULE.filter((m) => !m.immer)
  let offen = $state({})
  const kannAudio = audioVerfuegbar()
  let aufnahme = $state(null) // laufende Aufnahme
  let audioFehler = $state(null)

  let startet = false
  async function toggleAufnahme() {
    if (aufnahme) {
      const a = aufnahme; aufnahme = null
      try { const url = await a.stop(); setKopf({ audios: [...(eintrag.audios || []), url] }) } catch {}
    } else {
      if (startet) return          // Doppeltipp während der Mikrofon-Abfrage
      startet = true; audioFehler = null
      try { aufnahme = await starteAufnahme() } catch (e) { audioFehler = t('Mikrofon nicht freigegeben') }
      finally { startet = false }
    }
  }
  // Wird der Tag gewechselt, während aufgenommen wird: Aufnahme beenden und trotzdem sichern
  $effect(() => () => {
    const a = aufnahme, id = eintrag.id
    if (!a) return
    aufnahme = null
    a.stop().then((url) => {
      const alt = get(journal).find((j) => j.id === id)
      updateJournalEintrag(id, { audios: [...(alt?.audios || []), url] })
    }).catch(() => {})
  })
  function delAudio(i) { setKopf({ audios: (eintrag.audios || []).filter((_, idx) => idx !== i) }) }

  const orteSort = $derived([...orte].sort((a, b) => a.name.localeCompare(b.name, LOCALE)))
  const wert = (fid) => eintrag.felder?.[fid]
  function setKopf(patch) { updateJournalEintrag(eintrag.id, patch) }
  function setFeld(fid, w) { setJournalFeld(eintrag.id, fid, w) }
  function toggleModul(id) { offen[id] = !offen[id] }

  // Die Zeile heißt „Ort / Route des Tages“ — dann muss auch die ROUTE darin
  // vorkommen. Bisher speiste sich beides nur aus der Ortssammlung; die Stopps
  // der eigenen Reisen (die einzige Stelle mit selbst gesetzten Koordinaten für
  // die Ostküste) tauchten nirgends auf.
  const reiseStopps = $derived.by(() => {
    const out = []
    for (const r of reisen) {
      (r.stops || []).forEach((s, i) => {
        if (!s?.name) return
        out.push({ schluessel: `stopp|${r.id}|${i}`, name: s.name, lat: s.lat ?? null, lon: s.lon ?? null, reiseId: r.id })
      })
    }
    return out
  })
  // Für die Tipp-Hilfe: nur Stopps, die nicht ohnehin schon als Ort in der Liste stehen.
  const nurStoppNamen = $derived.by(() => {
    const bekannt = new Set(orte.map((o) => o.name.toLowerCase()))
    const gesehen = new Set()
    return reiseStopps.filter((s) => {
      const k = s.name.toLowerCase()
      if (bekannt.has(k) || gesehen.has(k)) return false
      gesehen.add(k); return true
    })
  })
  // Gruppiert fürs Dropdown; die gerade gewählte Reise steht oben, dort sucht man zuerst.
  const stoppGruppen = $derived.by(() => {
    const g = []
    for (const r of reisen) {
      const s = reiseStopps.filter((x) => x.reiseId === r.id)
      if (s.length) g.push({ id: r.id, name: r.name, stopps: s })
    }
    return g.sort((a, b) => (a.id === eintrag.reiseId ? -1 : b.id === eintrag.reiseId ? 1 : 0))
  })

  function verknuepfe(e) {
    const v = e.target.value
    e.target.value = ''
    if (!v) return
    if (v.startsWith('stopp|')) {
      const s = reiseStopps.find((x) => x.schluessel === v)
      // Ein Stopp bringt die Reise gleich mit — genau dafür ist er da.
      if (s) setKopf({ ort: s.name, lat: s.lat, lon: s.lon, ortId: null, reiseId: s.reiseId })
      return
    }
    const o = orte.find((x) => x.id === v)
    if (o) setKopf({ ort: o.name, lat: o.lat, lon: o.lon, ortId: o.id })
  }
  // Automatische Verknüpfung: Ort-Text mit einem Routen-Ort abgleichen.
  function findeOrt(name) {
    const c = name.trim().toLowerCase()
    if (c.length < 3) return null
    return orte.find((o) => o.name.toLowerCase() === c)
      || orte.find((o) => o.name.toLowerCase().includes(c) || c.includes(o.name.toLowerCase()))
  }
  function setOrt(name) {
    const t = findeOrt(name)
    if (t) { setKopf({ ort: name, lat: t.lat, lon: t.lon, ortId: t.id }); return }
    // Ein exakt getippter Reise-Stopp zählt auch. Bewusst NUR exakt: die unscharfe
    // Suche oben würde sonst jedes „Bay“ auf den erstbesten Stopp ziehen.
    const s = reiseStopps.find((x) => x.name.toLowerCase() === name.trim().toLowerCase())
    if (s) { setKopf({ ort: name, lat: s.lat, lon: s.lon, ortId: null, reiseId: eintrag.reiseId || s.reiseId }); return }
    setKopf({ ort: name, ortId: null, lat: null, lon: null })
  }
  const verknuepfterOrt = $derived(eintrag.ortId ? orte.find((o) => o.id === eintrag.ortId) : null)
  // Notiz und Bericht liegen am Ort selbst — hier zum Nachlesen einblenden,
  // damit beim Schreiben des Tages sichtbar ist, was schon zum Ort notiert wurde.
  const ortNotiz = $derived(eintrag.ortId ? $userData[eintrag.ortId] : null)
  const hatOrtNotiz = $derived(!!(ortNotiz && ((ortNotiz.notiz || '').trim() || (ortNotiz.bericht || '').trim())))

  // Reise-Verknüpfung (+ optionaler Teilabschnitt/Etappe)
  const gewaehlteReise = $derived(eintrag.reiseId ? reisen.find((r) => r.id === eintrag.reiseId) : null)
  function legOptionen(r) {
    const s = (r?.stops || []).filter((x) => x.name)
    const out = []
    for (let i = 0; i < s.length - 1; i++) out.push({ i, label: `${s[i].name} → ${s[i + 1].name}` })
    return out
  }
  function setReise(id) { setKopf({ reiseId: id || null, legIdx: null }) }
  function setLeg(v) { setKopf({ legIdx: v === '' ? null : Number(v) }) }
  // km der gewählten Etappe (oder ganzen Reise) aus der berechneten Route.
  const abschnittKm = $derived.by(() => {
    const rt = gewaehlteReise?.route
    if (!rt) return null
    if (eintrag.legIdx == null) return rt.km
    return stimmigeLegs(rt)[eintrag.legIdx]?.km ?? null
  })
  // ---- Etappe ergibt sich aus dem Datum; Route/Abschnitt nur noch für die km ----
  const etappeHeute = $derived(etappeAm(eintraege, eintrag.datum))
  const routenHeute = $derived(etappeHeute ? routenDerEtappe(reisen, etappeHeute.reise.id) : [])
  // Wahlmöglichkeiten „Strecke des Tages“: die Etappe selbst (falls sie Stopps hat), jede Route ganz, jeder Abschnitt
  const streckenWahl = $derived.by(() => {
    const out = []
    const quellen = etappeHeute ? [...((etappeHeute.reise.stops || []).length > 1 ? [etappeHeute.reise] : []), ...routenHeute] : []
    // Ein früher gewählter Bezug, der nicht mehr zur Etappe passt, bleibt wählbar (sonst verschwände er still).
    if (gewaehlteReise && !quellen.some((r) => r.id === gewaehlteReise.id)) quellen.push(gewaehlteReise)
    for (const r of quellen) {
      out.push({ wert: r.id + '|', label: t('{name}, ganze Strecke', { name: r.name }) })
      for (const o of legOptionen(r)) out.push({ wert: r.id + '|' + o.i, label: `${r.name}: ${o.label}` })
    }
    return out
  })
  // Ein Tag zeigt nur dann auf eine Strecke, wenn man sie gewählt hat. Die Etappe ergibt
  // sich aus dem Datum. (Ältere Tage, die auf ihre Etappe zeigen, gelten als „keine Angabe“.)
  const streckenWert = $derived(eintrag.reiseId && gewaehlteReise && !(etappeHeute && eintrag.reiseId === etappeHeute.reise.id && eintrag.legIdx == null)
    ? eintrag.reiseId + '|' + (eintrag.legIdx ?? '') : '')
  function setStrecke(v) {
    if (!v) { setKopf({ reiseId: null, legIdx: null }); return }
    const [id, leg] = v.split('|')
    setKopf({ reiseId: id, legIdx: leg === '' ? null : Number(leg) })
  }
  function setDatum(d) {
    if (!gueltigesDatum(d)) return
    // Zeigte der Tag nur auf seine Etappe (keine eigene Strecke gewählt), zieht er mit.
    const nurEtappe = !eintrag.reiseId || (etappeHeute && eintrag.reiseId === etappeHeute.reise.id)
    const bis = eintrag.bis > d ? eintrag.bis : undefined
    setKopf(nurEtappe ? { datum: d, bis, reiseId: null, legIdx: null } : { datum: d, bis })
  }
  // Über mehrere Tage: leeres oder früheres Bis macht wieder einen einzelnen Tag daraus
  function setBis(d) { setKopf({ bis: gueltigesDatum(d) && d > eintrag.datum ? d : undefined }) }
  function ortGewaehlt(o) {
    setKopf({ ort: o.name, lat: o.lat ?? null, lon: o.lon ?? null, ortId: o.ortId || null })
    ortAendern = false
  }
  let ortAendern = $state(false)
  // Strecke des Tages: zum Ort kommt ein Ziel dazu
  let zielWahl = $state(false)
  function zielGewaehlt(o) {
    setKopf({ ziele: [...ziele, { name: o.name, lat: o.lat ?? null, lon: o.lon ?? null, ortId: o.ortId || null }], ziel: null })
    zielWahl = false
  }
  const ziele = $derived(zieleVon(eintrag))
  const filmPunkte = $derived(tagesPunkte(eintrag))
  const zielWeg = (i) => setKopf({ ziele: ziele.filter((_, k) => k !== i), ziel: null })
  async function loeschen() {
    if (await loeschFrage(t('Diesen Logbuch-Eintrag'), t('Text, Fotos, Sprachnotizen und alle Themen dieses Eintrags. Das lässt sich nicht rückgängig machen.'))) loescheJournalEintrag(eintrag.id)
  }

  async function addFoto(e) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    try { const t = await macheThumbnail(f); setKopf({ fotos: [...(eintrag.fotos || []), t] }) } catch {}
  }
  function delFoto(i) {
    const fotos = (eintrag.fotos || []).filter((_, idx) => idx !== i)
    // Angaben (Ort, Zeit) zu Fotos, die es nicht mehr gibt, gleich mit aufräumen
    setKopf(Array.isArray(eintrag.fotoMeta) ? { fotos, fotoMeta: bereinigeMeta(fotos, eintrag.fotoMeta) } : { fotos })
  }
  function toggleTag(fid, opt) {
    const cur = wert(fid) || []
    setFeld(fid, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt])
  }
  function setCounter(fid, label, delta) {
    const cur = { ...(wert(fid) || {}) }
    const n = Math.max(0, (cur[label] || 0) + delta)
    if (n === 0) delete cur[label]; else cur[label] = n
    setFeld(fid, Object.keys(cur).length ? cur : '')
  }
  let customInput = $state({})
  function customKeys(f) {
    const v = wert(f.id) || {}
    return Object.keys(v).filter((k) => !f.optionen.some((o) => o.label === k))
  }
  function addCustom(f) {
    const l = (customInput[f.id] || '').trim()
    if (!l) return
    setCounter(f.id, l, 1)
    customInput[f.id] = ''
  }
  function anzahl(m) {
    return m.felder.filter((f) => { const w = wert(f.id); return w != null && w !== '' && !(Array.isArray(w) && w.length === 0) }).length
  }
</script>

{#snippet feld(f)}
  <div class="feld" role="group" aria-labelledby={lblId(f.id)}>
    <span class="f-label" id={lblId(f.id)}>{f.icon} {f.label}</span>
    {#if f.typ === 'text' || f.typ === 'zahl'}
      <div class="f-in">
        <input aria-labelledby={lblId(f.id)} type={f.typ === 'zahl' ? 'number' : 'text'} value={wert(f.id) ?? ''}
          oninput={(e) => setFeld(f.id, f.typ === 'zahl' ? e.target.value : e.target.value)}
          placeholder={f.einheit || ''} />
      </div>
    {:else if f.typ === 'textlang'}
      <div class="f-in">
        <textarea aria-labelledby={lblId(f.id)} rows="2" value={wert(f.id) ?? ''} oninput={(e) => setFeld(f.id, e.target.value)}></textarea>
      </div>
    {:else if f.typ === 'rating'}
      <div class="rating">
        {#each Array(f.max) as _, i}
          <button class="r-icon" class:an={(wert(f.id) || 0) > i}
            onclick={() => setFeld(f.id, (wert(f.id) === i + 1) ? 0 : i + 1)}>{f.symbol}</button>
        {/each}
        {#if wert(f.id)}<span class="r-zahl">{wert(f.id)}/{f.max}</span>{/if}
      </div>
    {:else if f.typ === 'dropdown'}
      {#if f.optionen.length <= 3}
        <div class="toggle">
          {#each f.optionen as o}
            <button class="t-opt" class:an={wert(f.id) === o} onclick={() => setFeld(f.id, wert(f.id) === o ? '' : o)}>{t(o)}</button>
          {/each}
        </div>
      {:else}
        <select aria-labelledby={lblId(f.id)} value={wert(f.id) ?? ''} onchange={(e) => setFeld(f.id, e.target.value)}>
          <option value="">{t('— wählen —')}</option>
          {#each f.optionen as o}<option value={o}>{t(o)}</option>{/each}
        </select>
      {/if}
    {:else if f.typ === 'toggle'}
      <div class="toggle">
        {#each f.optionen as o}
          <button class="t-opt" class:an={wert(f.id) === o} onclick={() => setFeld(f.id, wert(f.id) === o ? '' : o)}>{t(o)}</button>
        {/each}
      </div>
    {:else if f.typ === 'tags'}
      <div class="tags">
        {#each f.optionen as o}
          <button class="tag" class:an={(wert(f.id) || []).includes(o)} onclick={() => toggleTag(f.id, o)}>{t(o)}</button>
        {/each}
      </div>
    {:else if f.typ === 'counter'}
      <div class="counter">
        {#each f.optionen as o}
          {@const c = (wert(f.id) || {})[o.label] || 0}
          <div class="c-row" class:hat={c > 0}>
            <span class="c-lbl">{o.emoji} {t(o.label)}</span>
            <div class="c-ctrl">
              <button onclick={() => setCounter(f.id, o.label, -1)} disabled={c === 0} aria-label={t('{label} weniger', { label: t(o.label) })}>−</button>
              <span class="c-n">{c}</span>
              <button onclick={() => setCounter(f.id, o.label, 1)} aria-label={t('{label} mehr', { label: t(o.label) })}>+</button>
            </div>
          </div>
        {/each}
        {#each customKeys(f) as label}
          {@const c = (wert(f.id) || {})[label] || 0}
          <div class="c-row hat eigen">
            <span class="c-lbl">📝 {label}</span>
            <div class="c-ctrl">
              <button onclick={() => setCounter(f.id, label, -1)} aria-label={t('{label} weniger', { label })}>−</button>
              <span class="c-n">{c}</span>
              <button onclick={() => setCounter(f.id, label, 1)} aria-label={t('{label} mehr', { label })}>+</button>
              <button class="c-del" title={t('entfernen')} onclick={() => setCounter(f.id, label, -c)}>✕</button>
            </div>
          </div>
        {/each}
        <div class="c-add">
          <input aria-label={t('{label}: anderes hinzufügen', { label: f.label })} placeholder={t('Anderes … (z.B. Kühlschrank)')} bind:value={customInput[f.id]}
            onkeydown={(e) => e.key === 'Enter' && addCustom(f)} />
          <button onclick={() => addCustom(f)} disabled={!(customInput[f.id] || '').trim()}>{t('+ zählen')}</button>
        </div>
      </div>
    {:else if f.typ === 'farbe'}
      <div class="farbe">
        {#each ['#b5451b', '#d98a3d', '#e8c079', '#2f7a63', '#1a5276', '#a83c6e', '#7a5c8e', '#5a5248'] as c}
          <button class="sw" class:an={wert(f.id) === c} style="background:{c}" onclick={() => setFeld(f.id, wert(f.id) === c ? '' : c)} aria-label={c}></button>
        {/each}
        <input class="farb-txt" value={wert(f.id) ?? ''} oninput={(e) => setFeld(f.id, e.target.value)} placeholder={t('oder Text: Outback-Rot')} />
      </div>
    {/if}
  </div>
{/snippet}

<article class="je" class:zu={!aufgeklappt}>
  {#if !aufgeklappt}
    <!-- Zugeklappt: eine Zeile, alles Wichtige auf einen Blick -->
    <button class="je-kurz" onclick={() => (aufgeklappt = true)}>
      <span class="k-datum">{kurzDatum}</span>
      <span class="k-ort">{streckeText(eintrag) || t('— ohne Ort —')}</span>
      {#if auszug}<span class="k-text">{auszug}{(eintrag.text || '').length > 90 ? '…' : ''}</span>{/if}
      <span class="k-marken">
        {#if (eintrag.fotos || []).length}<span class="k-m">📷 {eintrag.fotos.length}</span>{/if}
        {#if (eintrag.audios || []).length}<span class="k-m">🎙️ {eintrag.audios.length}</span>{/if}
        {#if (eintrag.sichtungen || []).length}<span class="k-m">🦘 {eintrag.sichtungen.length}</span>{/if}
        {#if anzahlFelder}<span class="k-m">✅ {anzahlFelder}</span>{/if}
        {#if gewaehlteReise}<span class="k-m">🧭 {gewaehlteReise.name}</span>{/if}
        {#if ortWarnungen.length}<span class="k-m warn">⚠️ {ortWarnungen.length}</span>{/if}
      </span>
      <span class="k-pfeil">▾</span>
    </button>
  {:else}
  <!-- Kopf: Datum → Etappe automatisch; Ort per Suche; Strecke nur, wenn es um km geht -->
  <div class="k4">
    {#if !immerOffen}<button class="je-zu" onclick={() => (aufgeklappt = false)} title={t('Eintrag zuklappen')} aria-label={t('Eintrag zuklappen')}>▲</button>{/if}
    <label class="k4-datum">{eintrag.bis ? t('Von') : t('Datum')}<input class="datum" type="date" value={eintrag.datum} onchange={(e) => setDatum(e.target.value)} /></label>
    <label class="k4-datum">{t('Bis (mehrere Tage)')}<input class="datum" type="date" min={eintrag.datum} value={eintrag.bis || ''} onchange={(e) => setBis(e.target.value)} /></label>
    {#if !immerOffen}
    <span class="k4-etappe">
      {#if etappeHeute}
        <span class="k4-band" style="background:{etappeHeute.reise.farbe || 'var(--brand)'}" aria-hidden="true"></span>
        <span><b>{etappeHeute.reise.name}</b><small>{t('Tag {wert} von {tage} dieser Etappe', { wert: tageZwischen(etappeHeute.von, eintrag.datum) + 1, tage: etappeHeute.tage })}</small></span>
      {:else if eintraege.length}
        <span><small>{t('außerhalb deiner Etappen')}</small></span>
      {/if}
    </span>
    {/if}
  </div>

  <div class="k4-ort">
    <span class="k4-lbl" id="ortlbl-{eintrag.id}">{t('Ort oder Strecke des Tages')}</span>
    {#if eintrag.ort && !ortAendern}
      <div class="k4-ort-wert">
        <span class="k4-ort-name">📍 {streckeText(eintrag)}{#if eintrag.lat == null}<small>{t('ohne Kartenpunkt')}</small>{/if}</span>
        <button class="btn" onclick={() => (ortAendern = true)}>{t('Ändern')}</button>
      </div>
      {#if zielWahl}
        <OrtWahl {orte} {reisen} freiText koordinaten={false} autofokus label={je('Ziel der Strecke suchen', 'Search destination')} platzhalter={je('z. B. Cervantes', 'e.g. Cervantes')} onwahl={zielGewaehlt} />
        <button class="hw-link" onclick={() => (zielWahl = false)}>{t('Abbrechen')}</button>
      {:else}
        {#if ziele.length}
          <ul class="k4-ziele">
            {#each ziele as z, i}<li><span>→ {z.name}</span><button aria-label={je(`Ziel ${z.name} entfernen`, `Remove destination ${z.name}`)} onclick={() => zielWeg(i)}>✕</button></li>{/each}
          </ul>
        {/if}
        {#if ziele.length}
          {#if filmPunkte.vollstaendig}
            <label class="k4-film"><input type="checkbox" checked={!!eintrag.imFilm} onchange={(e) => setKopf({ imFilm: e.currentTarget.checked })} /><span>{je('Im Animationsfilm', 'In the animated film')}</span></label>
          {:else}
            <p class="k4-film-tipp">{je('Für den Animationsfilm braucht jeder Ort einen Kartenpunkt. Wähle ihn aus der Vorschlagsliste.', 'For the animated film every place needs a map point. Pick it from the suggestions.')}</p>
          {/if}
        {/if}
        <button class="hw-link" onclick={() => (zielWahl = true)}>{ziele.length ? je('+ Weiteres Ziel', '+ Another destination') : je('+ Strecke: Ziel hinzufügen', '+ Route: add destination')}</button>
      {/if}
    {:else}
      <OrtWahl {orte} {reisen} freiText koordinaten={false} autofokus={ortAendern} label={t('Ort des Tages suchen')} platzhalter="z. B. Kalbarri oder Perth → Cervantes" onwahl={ortGewaehlt} />
      {#if ortAendern}<button class="hw-link" onclick={() => (ortAendern = false)}>{t('Abbrechen')}</button>{/if}
    {/if}
  </div>

  <div class="haupt">
    <textarea rows="2" value={eintrag.text} oninput={(e) => setKopf({ text: e.target.value })} placeholder={t('Der Tag in ein paar Worten …')}></textarea>
  </div>

  <!-- Sprachnotizen (Audio) -->
  {#if kannAudio}
    <div class="audio">
      <button class="rec" class:an={aufnahme} onclick={toggleAufnahme}>
        {aufnahme ? t('⏹ Aufnahme stoppen & speichern') : t('🎙️ Sprachnotiz aufnehmen')}
      </button>
      {#if audioFehler}<span class="a-fehler">{audioFehler}</span>{/if}
      {#each eintrag.audios || [] as a, i}
        <div class="a-zeile">
          <audio controls src={a}></audio>
          <button class="a-del" onclick={() => delAudio(i)} title={t('löschen')}>✕</button>
        </div>
      {/each}
    </div>
  {/if}

  {#if eintrag.fotos?.length}
    <div class="fotos">
      {#each eintrag.fotos as f, i}
        {@const fi = fotoInfo(eintrag, f)}
        <div class="foto"><img src={f} alt={fi?.ort ? t('Foto bei {ort}', { ort: fi.ort }) : t('Foto')} />{#if fi && fi.lat != null}<span class="foto-ort" title={fi.ort || `${fi.lat.toFixed(3)}, ${fi.lon.toFixed(3)}`} aria-hidden="true">📍</span>{/if}<button class="x" onclick={() => delFoto(i)} aria-label={t('Foto {wert} entfernen', { wert: i + 1 })}>✕</button></div>
      {/each}
    </div>
  {/if}
  <div class="foto-knoepfe">
    <label class="foto-btn">{t('📷 Foto (wird verkleinert)')}<input type="file" accept="image/*" onchange={addFoto} /></label>
    <FotoImport {orte} vorgabeTag={eintrag.datum} kompakt />
  </div>

  <TiereGesehen {eintrag} {orte} />

  {#if eintrag.lat != null && eintrag.lon != null}
    <div class="je-wetter"><SonneWetter lat={eintrag.lat} lon={eintrag.lon} datum={eintrag.datum} /></div>
  {/if}

  {#if hatOrtNotiz}
    <div class="ort-notiz">
      <div class="on-titel">{t('📝 Deine Notizen zu {wert}', { wert: verknuepfterOrt?.name || t('diesem Ort') })}</div>
      {#if (ortNotiz.notiz || '').trim()}<p class="on-text">{ortNotiz.notiz}</p>{/if}
      {#if (ortNotiz.bericht || '').trim()}<p class="on-text">{ortNotiz.bericht}</p>{/if}
      <span class="on-quelle">{t('stehen beim Ort, hier nur zum Nachlesen')}</span>
    </div>
  {/if}

  <!-- Quick-Stats (Meta-Modul immer offen) -->
  <div class="quickstats">
    {#each metaModul.felder as f}{@render feld(f)}{/each}
  </div>

  {#if streckenWahl.length}
    <label class="k4-strecke">{t('Gefahrene Strecke (für die km)')}
      <select value={streckenWert} onchange={(e) => setStrecke(e.target.value)}>
        <option value="">{t('keine Angabe')}</option>
        {#each streckenWahl as o}<option value={o.wert}>{o.label}</option>{/each}
      </select>
      {#if abschnittKm != null && streckenWert}<span class="abschnitt-km">🛣️ {abschnittKm} km</span>{/if}
    </label>
  {/if}

  <!-- Amtliche Warnungen an diesem Ort. Bewusst nur ein VORSCHLAG: das Logbuch soll
       deine Beobachtungen enthalten, keine automatisch eingetragenen Fremddaten.
       Ein Tipp übernimmt sie ins Feld „Gefahren begegnet“. -->
  {#if ortWarnungen.length}
    <div class="je-warn">
      <div class="jw-kopf">
        {tn(ortWarnungen.length, '⚠️ {n} amtliche Warnung an diesem Ort', '⚠️ {n} amtliche Warnungen an diesem Ort')}
        <span class="jw-quelle">{ortWarnungen[0].staat}</span>
      </div>
      {#each ortWarnungen.slice(0, 3) as w}
        <div class="jw-z">
          <b style="color:{w.farbe}">{w.icon} {w.level}:</b> {w.titel}
          {#if w.km > 1}<span class="jw-km">{t('· {round} km entfernt', { round: Math.round(w.km) })}</span>{:else}<span class="jw-km">{t('· direkt hier')}</span>{/if}
        </div>
      {/each}
      {#if !schonUebernommen}
        <button class="jw-btn" onclick={warnungenUebernehmen}>
          {t('→ in „Gefahren begegnet“ übernehmen')}
        </button>
      {:else}
        <span class="jw-ok">{t('✓ übernommen')}</span>
      {/if}
    </div>
  {/if}

  {#if ereignisseHier.length}
    <div class="je-ereignis">
      <b>{je('Nah bei dir an diesem Tag', 'Near you on this day')}</b>
      <small>{je('Wähle aus, was ins Tagebuch soll.', 'Choose what goes into your journal.')}</small>
      {#each ereignisseHier as x (x.id)}
        <label class="je-e-zeile"><input type="checkbox" checked={istDrin(x)} onchange={() => ereignisUmschalten(x)} /><span>{x.icon} {x.level}: {x.titel}<small>{x.km > 1 ? je(`${x.km} km entfernt`, `${x.km} km away`) : je('direkt bei dir', 'right where you were')}</small></span></label>
      {/each}
    </div>
  {/if}

  <!-- Immer sichtbar: Wortlaut der Behördenmeldungen in den Tag schreiben.
       Auch „keine Warnungen“ ist ein Ergebnis und wird festgehalten. -->
  {#if eintrag.lat != null && eintrag.lon != null}
  <div class="lage">
    <button class="lage-btn" onclick={amtlicheLageUebernehmen} disabled={!kannLage}>
      {t('🏛️ Amtliche Gefahrenlage übernehmen')}
    </button>
    {#if lageMeldung}
      <span class="lage-ok">{lageMeldung}</span>
    {:else}
      <span class="lage-grund">{t('Schreibt den Wortlaut von DFES / VicEmergency / QFD mit Zeitstempel ins Feld „Amtliche Lage“.')}</span>
    {/if}
  </div>
  {/if}

  <!-- Themen-Module (ausklappbar) -->
  <div class="module">
    {#each themenModule as m}
      {@const n = anzahl(m)}
      <div class="modul" class:offen={offen[m.id]}>
        <button class="m-kopf" onclick={() => toggleModul(m.id)}>
          <span class="m-icon">{m.icon}</span>
          <span class="m-titel">{m.titel}</span>
          {#if n}<span class="m-zahl">{n}</span>{/if}
          <span class="aufklapp klein" class:offen={offen[m.id]}></span>
        </button>
        {#if offen[m.id]}
          <div class="m-body" transition:klapp={{ duration: dauer(200) }}>{#if m.id === 'kosten'}<AusgabenListe {eintrag} />{/if}{#each m.felder.filter((f) => !f.id.startsWith('kosten_')) as f}{@render feld(f)}{/each}</div>
        {/if}
      </div>
    {/each}
  </div>
  <!-- Löschen am Ende und abgesetzt, damit es nicht versehentlich getroffen wird. Mit Rückfrage. -->
  <div class="je-loeschen"><button type="button" class="btn-danger" onclick={loeschen}>🗑 {t('Diesen Eintrag löschen')}</button></div>
  {/if}
</article>

<style>
  .je-ereignis { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; }
  .je-ereignis small { display: block; color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .je-e-zeile { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: calc(14px * var(--schrift, 1)); cursor: pointer; }
  .je-e-zeile input { flex: none; width: 20px; height: 20px; accent-color: var(--brand); }
  .k4 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .k4-datum { display: flex; flex-direction: column; gap: 3px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .k4-datum .datum { min-height: 44px; font-size: calc(16px * var(--schrift, 1)); padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); }
  .k4-etappe { flex: 1 1 180px; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .k4-etappe > span:last-child { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
  .k4-etappe b { font-size: calc(14.5px * var(--schrift, 1)); }
  .k4-etappe small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .k4-band { width: 6px; align-self: stretch; min-height: 34px; border-radius: 3px; flex: none; }
  .je-loeschen { display: flex; justify-content: flex-end; margin-top: 18px; padding-top: 12px; border-top: 1px dashed var(--line); }
  .k4-ort { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
  .k4-lbl { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .k4-film { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: calc(14px * var(--schrift, 1)); font-weight: 600; cursor: pointer; }
  .k4-film input { width: 20px; height: 20px; accent-color: var(--brand); }
  .k4-film-tipp { margin: 4px 0; color: var(--muted); font-size: calc(13px * var(--schrift, 1)); }
  .k4-ziele { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; }
  .k4-ziele li { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: calc(14px * var(--schrift, 1)); }
  .k4-ziele button { width: 44px; height: 44px; border: none; background: none; color: var(--muted); font-size: calc(14px * var(--schrift, 1)); cursor: pointer; }
  .k4-ort-wert { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--flaeche); border: 1px solid var(--line); border-radius: var(--radius-m); padding: 6px 6px 6px 12px; min-height: 52px; }
  .k4-ort-name { font-size: calc(16px * var(--schrift, 1)); font-weight: 700; display: flex; flex-direction: column; line-height: 1.3; }
  .k4-ort-name small { font-size: calc(12px * var(--schrift, 1)); font-weight: 400; color: var(--muted); }
  .k4-ort-wert .btn { min-height: 44px; }
  .k4-strecke { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .k4-strecke select { min-height: 44px; font-size: calc(15px * var(--schrift, 1)); padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); font-weight: 400; }
  .hw-link { align-self: flex-start; background: none; border: none; padding: 6px 0; min-height: 36px; color: var(--brand-text); font-weight: 700; font-size: calc(13px * var(--schrift, 1)); cursor: pointer; }
  .je { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; box-shadow: var(--shadow); }
  .datum { font-size: calc(13px * var(--schrift, 1)); padding: 5px 7px; border: 1px solid var(--line-stark); border-radius: 6px; }
  .ort-notiz { margin: 6px 0; padding: 7px 10px; background: var(--flaeche); border-left: 3px solid var(--brand-2); border-radius: 0 6px 6px 0; }
  .on-titel { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--brand-2); }
  .on-text { font-size: calc(12.5px * var(--schrift, 1)); color: var(--ink); margin: 4px 0 0; line-height: 1.45; }
  .on-quelle { display: block; margin-top: 4px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-style: italic; }
  .abschnitt-km { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }

  .lage { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-top: 8px; }
  .lage-btn {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 7px 12px; border-radius: 8px; cursor: pointer;
    border: 1px solid #d8a56b; background: var(--warn-flaeche); color: #8a4a12;
  }
  .lage-btn:disabled { opacity: 0.45; cursor: default; }
  .lage-ok { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: #1a7f37; }
  .lage-grund { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); flex: 1 1 200px; min-width: 0; }
  .je-wetter { margin-top: 8px; }
  .haupt { position: relative; margin-top: 8px; }
  .haupt textarea { width: 100%; font-size: calc(13.5px * var(--schrift, 1)); padding: 8px 34px 8px 10px; border: 1px solid var(--line-stark); border-radius: 8px; background: var(--eingabe); font-family: inherit; resize: vertical; color: var(--ink); }
  @keyframes puls { 50% { opacity: 0.5; } }
  .audio { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .rec { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; padding: 7px 12px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 20px; cursor: pointer; }
  .rec.an { background: var(--danger-flaeche); border-color: #e3b7b0; color: var(--danger-text); animation: puls 1s infinite; }
  .a-fehler { font-size: calc(12px * var(--schrift, 1)); color: var(--danger-text); }
  .a-zeile { display: flex; align-items: center; gap: 6px; }
  .a-zeile audio { height: 32px; }
  .a-del { border: none; background: none; color: var(--danger-text); cursor: pointer; font-size: calc(13px * var(--schrift, 1)); }

  .fotos { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
  .foto { position: relative; }
  .foto img { width: 66px; height: 66px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); }
  .foto .x { position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; border: none; background: #c0392b; color: #fff; font-size: calc(12px * var(--schrift, 1)); cursor: pointer; }
  .foto-btn { display: inline-block; margin-top: 8px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); border: 1px dashed var(--line-stark); border-radius: 8px; padding: 6px 10px; cursor: pointer; }
  .foto-btn input { display: none; }
  .foto-knoepfe { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0 8px; }
  .foto-ort { position: absolute; left: 3px; bottom: 3px; font-size: calc(12px * var(--schrift, 1)); line-height: 1; filter: drop-shadow(0 1px 1px rgba(0,0,0,.45)); pointer-events: none; }

  .quickstats { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; padding: 10px; background: var(--flaeche); border-radius: 8px; }
  .module { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
  .modul { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .modul.offen { border-color: #d5c9b3; }
  .m-kopf { width: 100%; display: flex; align-items: center; gap: 8px; padding: 9px 11px; background: var(--flaeche); border: none; cursor: pointer; font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); }
  .m-icon { font-size: calc(15px * var(--schrift, 1)); }
  .m-titel { flex: 1; text-align: left; }
  .m-zahl { background: var(--brand-2); color: #1f1408; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; padding: 1px 7px; border-radius: 9px; }
  .m-body { padding: 10px 11px; display: flex; flex-direction: column; gap: 10px; }

  .feld { display: flex; flex-direction: column; gap: 4px; }
  .f-label { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .f-in { position: relative; }
  .feld input[type=text], .feld input[type=number], .feld textarea, .feld select {
    width: 100%; font-size: calc(13px * var(--schrift, 1)); padding: 7px 9px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--eingabe); font-family: inherit; color: var(--ink);
  }
  .feld textarea { padding-right: 34px; resize: vertical; }
  .rating { display: flex; align-items: center; gap: 2px; }
  .r-icon { border: none; background: none; cursor: pointer; font-size: calc(18px * var(--schrift, 1)); filter: grayscale(1) opacity(0.4); padding: 0 1px; }
  .r-icon.an { filter: none; }
  .r-zahl { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin-left: 6px; font-weight: 700; }
  .toggle, .tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .t-opt, .tag { font-size: calc(12px * var(--schrift, 1)); padding: 5px 10px; border: 1px solid var(--line-stark); background: var(--card); border-radius: 14px; cursor: pointer; color: var(--muted); }
  .t-opt.an, .tag.an { background: var(--brand); color: #fff; border-color: var(--brand); }
  .counter { display: flex; flex-direction: column; gap: 3px; }
  .c-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 8px; border-radius: 6px; }
  .c-row.hat { background: var(--btn-flaeche); }
  .c-lbl { font-size: calc(12.5px * var(--schrift, 1)); color: var(--ink); }
  .c-ctrl { display: inline-flex; align-items: center; gap: 6px; }
  .c-ctrl button { width: 26px; height: 26px; border: 1px solid var(--line-stark); background: var(--card); border-radius: 6px; cursor: pointer; font-size: calc(15px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); }
  .c-ctrl button:disabled { opacity: 0.35; }
  .c-n { min-width: 18px; text-align: center; font-weight: 800; font-size: calc(13px * var(--schrift, 1)); }
  .c-row.eigen { background: var(--ok-flaeche); }
  .c-del { border: none !important; color: var(--danger-text); background: none !important; font-size: calc(13px * var(--schrift, 1)); }
  .c-add { display: flex; gap: 5px; margin-top: 4px; }
  .c-add input { flex: 1; font-size: calc(12.5px * var(--schrift, 1)); padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--eingabe); color: var(--ink); }
  .c-add button { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 6px 10px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 6px; cursor: pointer; }
  .c-add button:disabled { opacity: 0.4; }
  .farbe { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .sw { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #ccc; cursor: pointer; }
  .sw.an { box-shadow: 0 0 0 2px var(--ink); }
  .farb-txt { flex: 1 1 120px; }
  @media (max-width: 520px) { .quickstats { grid-template-columns: 1fr; } }
  .je-warn {
    background: #fff6ec; border: 1px solid #eab98d; border-radius: 10px;
    padding: 9px 11px; margin: 8px 0 4px; font-size: calc(12.5px * var(--schrift, 1));
  }
  :global([data-theme='dark']) .je-warn { background: #3a2a1c; border-color: #6b4a2a; }
  .jw-kopf { font-weight: 800; margin-bottom: 4px; }
  .jw-quelle { font-weight: 600; opacity: .65; font-size: calc(12px * var(--schrift, 1)); margin-left: 4px; }
  .jw-z { margin: 3px 0; line-height: 1.4; }
  .jw-km { opacity: .7; }
  .jw-btn {
    margin-top: 6px; padding: 5px 11px; border: 1px solid #c0392b; background: none;
    color: var(--danger-text); border-radius: 14px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; cursor: pointer;
  }
  .jw-ok { display: inline-block; margin-top: 6px; font-weight: 700; color: #1a7f37; font-size: calc(12px * var(--schrift, 1)); }
  .je.zu { padding: 0; }
  .je-kurz {
    display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;
    padding: 11px 13px; background: none; border: none; cursor: pointer;
    font: inherit; color: inherit;
  }
  .k-datum { font-weight: 800; font-size: calc(12.5px * var(--schrift, 1)); white-space: nowrap; color: var(--brand-text); }
  .k-ort { font-weight: 700; font-size: calc(13.5px * var(--schrift, 1)); white-space: nowrap; max-width: 34%; overflow: hidden; text-overflow: ellipsis; }
  .k-text { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .k-marken { display: flex; gap: 5px; flex-shrink: 0; }
  .k-m { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; background: var(--flaeche-2); border-radius: 9px; padding: 2px 6px; white-space: nowrap; }
  .k-m.warn { background: #fdf0e6; color: #8a5a2b; }
  .k-pfeil { color: var(--muted); font-size: calc(12px * var(--schrift, 1)); flex-shrink: 0; }
  .je-zu {
    background: none; border: none; color: var(--muted); font-size: calc(13px * var(--schrift, 1));
    cursor: pointer; padding: 4px 6px; align-self: flex-start;
  }

  /* Sterne, Fliegen und Umschalter groß genug für den Daumen (auch mit Sonnencreme) */
  .r-icon { min-width: 44px; min-height: 44px; font-size: calc(22px * var(--schrift, 1)); }
  .t-opt { min-height: 44px; }
  .f-in input, .f-in textarea, .feld select { min-height: 44px; }
  .rec { min-height: 44px; }
</style>
