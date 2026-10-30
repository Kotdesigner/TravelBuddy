<script>
  import { t, tn, LOCALE } from './i18n.js'
  import { dezimal, ZWEI, eur, aud } from './format.js'
  import { frage, hinweis, loeschFrage } from './dialog.js'
  import { etappenMitDatum, planUeberblick } from './plan.js'
  // Reisevorbereitung: Abreise-Countdown, Vor-Abfahrt-Checkliste (vorbefüllt) und
  // Dokumente (Pass, eTA/Visum, Versicherung … mit Nummer, Gültigkeit, Notiz).
  import {
    vorbereitung, toggleVorb, addVorbItem, delVorbItem, istAn,
    dokumente, neuesDokument, updateDokument, loescheDokument,
    vorabKosten, neueVorabKosten, updateVorabKosten, loescheVorabKosten,
    reisen, gesamtStart,
  } from './userdata.js'
  import { VORBEREITUNG, DOKUMENT_TYPEN } from './vorbereitung-daten.js'
  import { buchungen, entferneReisekalender } from './userdata.js'
  import { buchungenEinfuegen, loescheEigeneBuchung, belegeAnhaengen, belegAbnehmen } from './userdata.js'
  import BuchungEinfuegen from './BuchungEinfuegen.svelte'
  import BelegKnoepfe from './BelegKnoepfe.svelte'
  import TresorEinstellung from './TresorEinstellung.svelte'
  import { zumAnzeigen } from './pdf-portfolio.js'
  import { onDestroy } from 'svelte'
  import { klapp, dauer } from './motion.js'
  import { katInfo, KAT as BUCHUNGSARTEN, dokumentUrl, alleBelege, ladeBelegVerzeichnis, belegDa } from './reisekalender.js'
  import { lokaleBelege, lokaleGroesse, ladeBelegListe, ladeGroessen, ordneZu,
           speichereBeleg, loescheAlleBelege, loescheBeleg, oeffneBeleg, zeigeImFenster,
           schlageZielVor, eigenerPfad, belegLabel, istBildDatei, kameraName } from './belege.js'
  import { fxKurse, kursFuer, inBeide } from './fx.js'

  // Kategorien für Vorab-Ausgaben (Keys = dieselben wie im Tagebuch-Kostenmodul).
  const KAT = [
    { key: 'kosten_unterkunft', label: t('🏨 Hotel / Unterkunft') },
    { key: 'kosten_flug', label: t('✈️ Fliegen') },
    { key: 'kosten_sprit', label: t('🚗 Fahren (Sprit)') },
    { key: 'kosten_mietfahrzeug', label: t('🚐 Mietfahrzeug') },
    { key: 'kosten_boot', label: t('⛵ Schippern') },
    { key: 'kosten_bahn', label: t('🚆 Bahn') },
    { key: 'kosten_bus', label: t('🚌 Bus') },
    { key: 'kosten_technik', label: t('🎥 Technik') },
    { key: 'kosten_behoerde', label: t('🏛️ Behörde (Visum, Gebühren)') },
    { key: 'kosten_attraktion', label: t('🎟️ Tour / Aktivität') },
    { key: 'kosten_long', label: t('📦 Long-Value (Anschaffung)') },
    { key: 'kosten_short', label: t('🪙 Short-Value (Konsum)') },
    { key: 'kosten_sonstiges', label: t('🛒 Sonstiges') },
  ]
  // Reisen zum Zuordnen (Roadtrip West + Vacation Ost).
  const reiseOptionen = $derived([
    ...$reisen.map((r) => ({ id: r.id, label: '🚗 ' + r.name })),
  ])
  // Beide Bloecke sind lang (Dokumente: 3 Zeilen je Eintrag, Vorab-Ausgaben: 3-4).
  // Zugeklappt bleibt die Seite ueberschaubar; die Kopfzeile sagt trotzdem, was drin ist.
  let dokAuf = $state(false)
  let vkAuf = $state(false)
  let buAuf = $state(false)
  let einfuegenAuf = $state(false)

  // ---- Gebuchtes aus der eigenen Kalender-App (nur Anzeige) ----
  const buListe = $derived(($buchungen?.events || []).filter((e) => !e.platzhalter))
  const buBelege = $derived(buListe.reduce((n, e) => n + (e.docs?.length || 0), 0))
  // Selbst eingefügte Buchungen (aus einer Mail) neben denen aus dem Reisekalender.
  const buEigene = $derived(buListe.filter((e) => e.quelle === 'eigen').length)
  const ausKalender = $derived(!!$buchungen?.von)
  const katText = (b) => b.kat === 'tour' ? t('Tour') : katInfo(b.kat).label
  async function eigeneLoeschen(b) {
    if (!(await loeschFrage(t('Buchung „{titel}“', { titel: b.titel }), t('Check-in und Check-out bzw. Übernahme und Rückgabe verschwinden zusammen.')))) return
    loescheEigeneBuchung(b.id)
  }
  const buTage = $derived.by(() => {
    const m = new Map()
    for (const e of buListe) { if (!m.has(e.datum)) m.set(e.datum, []); m.get(e.datum).push(e) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  })
  const fmtTag = (s) => {
    try { return new Date(s + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: ZWEI, month: 'short', year: 'numeric' }) }
    catch { return s }
  }
  // Nur der Dateiname — der ganze Pfad ist auf dem Handy unlesbar, der Ordner
  // steht ohnehin im Titel darüber.
  const dateiName = (pfad) => (pfad || '').split('/').pop()
  // ---- Belege offline sichern ----
  //
  // Die PDFs sind bewusst NICHT im Vorab-Cache (29 MB wären beim ersten Start
  // eine Zumutung). Ein geöffnetes Dokument bleibt danach von selbst offline
  // verfügbar; dieser Knopf holt auf Wunsch alles auf einmal — dieselbe Logik
  // wie „alle Karten sichern“.
  // Verzeichnis der im Build enthaltenen Belege. Ein Build ohne die persoenlichen
  // Papiere darf dafuer keinen Link anbieten - ein toter Link waere schlimmer als
  // eine ehrliche Notiz.
  let verzeichnis = $state(null)
  ladeBelegVerzeichnis().then((v) => (verzeichnis = v))
  const daBelege = (pfad) => belegDa(verzeichnis, pfad)
  const ohnePersoenliche = $derived(!!verzeichnis?.bekannt && !verzeichnis.mitPersoenlichen)
  const ohneBelege = $derived(!!verzeichnis?.ausgelassen?.includes('*'))

  const belege = $derived(alleBelege($buchungen, verzeichnis))

  // ---- Belege, die nur auf DIESEM Gerät liegen ----
  //
  // Der ausgelieferte Build ist leer. Die PDFs übergibt man einmal über die
  // Dateiauswahl; danach liegen sie in der App und nirgends sonst.
  let groessen = $state(null)
  ladeBelegListe()
  ladeGroessen().then((g) => (groessen = g))

  // Alle Belegpfade, die der importierte Reisekalender kennt.
  const alleRefs = $derived.by(() => {
    const out = []
    for (const e of $buchungen?.events || []) for (const d of e.docs || []) if (!out.includes(d.datei)) out.push(d.datei)
    for (const d of $buchungen?.persoenlich || []) if (!out.includes(d.datei)) out.push(d.datei)
    return out
  })
  const istLokal = (pfad) => $lokaleBelege.has((pfad || '').normalize('NFC'))
  const anzahlLokal = $derived(alleRefs.filter(istLokal).length)
  const mb = (n) => dezimal(n / 1048576, 1) + ' MB'

  let belegInput = $state(), ordnerInput = $state(), fotoInput = $state()
  let laden = $state(null)      // { fertig, gesamt }
  let ergebnis = $state('')
  const kannOrdner = typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input')

  async function belegeLaden(e) {
    const alle = [...(e.target.files || [])]
    e.target.value = ''
    // Ein Ordner bringt Systemdateien mit (.DS_Store und Co.), die gehören nicht dazu.
    const dateien = alle.filter((f) => !f.name.startsWith('.') && f.size > 0)
    // Leere Auswahl nicht still übergehen: Am iPhone liefert manche Ordnerauswahl keine
    // Dateien. Die Meldung erklärt, wie es zuverlässig klappt.
    if (!dateien.length) {
      ergebnis = alle.length
        ? t('In der Auswahl war keine Datei, die als Beleg taugt.')
        : t('Es kam keine Datei an. Am iPhone klappt es am sichersten mit „PDFs auswählen“: im Ordner oben rechts „Auswählen“ tippen, alle markieren, „Öffnen“.')
      return
    }

    // Was die App selbst erkennt, landet gleich am Termin. Der Rest kommt in die Maske.
    // Fotos (abfotografiertes Ticket, Bildschirmfoto) nur über Name oder Pfad,
    // nie über die Größe allein: ein Foto könnte zufällig so groß sein wie ein PDF aus dem Kalender.
    const pdfs = dateien.filter((f) => !istBildDatei(f)), bilder = dateien.filter(istBildDatei)
    const leer = (u) => ({ zugeordnet: [], unklar: [], unbekannt: u, fehlend: [] })
    const zp = alleRefs.length && pdfs.length ? ordneZu(pdfs, alleRefs, groessen) : leer(pdfs)
    const vergeben = new Set(zp.zugeordnet.map((x) => x.pfad))
    const zb = alleRefs.length && bilder.length ? ordneZu(bilder, alleRefs.filter((p) => !vergeben.has((p || '').normalize('NFC'))), null) : leer(bilder)
    const z = { zugeordnet: [...zp.zugeordnet, ...zb.zugeordnet], unklar: [...zp.unklar, ...zb.unklar], unbekannt: [...zp.unbekannt, ...zb.unbekannt] }
    laden = { fertig: 0, gesamt: z.zugeordnet.length }
    for (const { pfad, datei } of z.zugeordnet) {
      try { await speichereBeleg(pfad, datei) } catch (err) {
        ergebnis = t('Speichern fehlgeschlagen: ') + (err?.message || err)
        laden = null; return
      }
      laden = { ...laden, fertig: laden.fertig + 1 }
    }
    laden = null
    // Den Browser bitten, die Belege nicht bei Platzmangel wegzuräumen — sie sollen die
    // ganze Reise offline halten. Wird es abgelehnt, ändert sich nichts.
    if (z.zugeordnet.length) { try { await navigator.storage?.persist?.() } catch {} }
    const rest = [...z.unklar.map((u) => u.datei), ...z.unbekannt]
    zuordnen = [...zuordnen, ...rest.map(neueZeile)]
    const teile = [t('{length} von {length2} zugeordnet', { length: z.zugeordnet.length, length2: dateien.length })]
    if (rest.length) teile.push(tn(rest.length, '{n} unten selbst zuordnen', '{n} unten selbst zuordnen'))
    // Was noch nicht auf dem Gerät liegt, nicht: was in dieser Auswahl fehlte.
    const nochOffen = alleRefs.filter((p) => !istLokal(p)).length
    if (nochOffen) teile.push(t('{length} fehlen noch', { length: nochOffen }))
    ergebnis = '✓ ' + teile.join(' · ')
  }

  // ---- Maske: Dateien selbst einem Termin zuordnen ----
  //
  // Für alles, was die App nicht selbst erkennt: umbenannte Dateien, Belege zu Buchungen
  // aus einer Mail, ein Foto vom Ticket. Jede Datei bekommt eine Auswahl, nach Art der
  // Buchung gruppiert (Flug, Bahn, Unterkunft …), und einen Vorschlag aus dem Dateinamen.
  // Fehlt einem Termin ein Beleg aus dem Reisekalender, lässt sich genau diese Lücke füllen.
  let zuordnen = $state([])        // [{ nr, datei: File, ziel, label, bild, vorschau }]
  let zNr = 0
  // Fotos bekommen ein kleines Vorschaubild: „IMG_1234.jpeg“ verrät nicht, welches Ticket es ist
  function neueZeile(datei) {
    const bild = istBildDatei(datei)
    let vorschau = ''
    if (bild) try { vorschau = URL.createObjectURL(datei) } catch {}
    const label = bild && kameraName(datei.name) ? t('Foto vom Beleg') : belegLabel(datei.name)
    return { nr: ++zNr, datei, ziel: vorschlag(datei), label, bild, vorschau }
  }
  function zeilenWeg(nrs = null) {
    for (const z of zuordnen) if (z.vorschau && (!nrs || nrs.includes(z.nr))) try { URL.revokeObjectURL(z.vorschau) } catch {}
    zuordnen = nrs ? zuordnen.filter((z) => !nrs.includes(z.nr)) : []
  }
  onDestroy(() => zeilenWeg())
  let zSpeichern = $state(false)
  const ART_FOLGE = Object.keys(BUCHUNGSARTEN)
  const kurzTag = (s) => {
    try { return new Date(s + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }) }
    catch { return s }
  }
  // Belege aus dem Kalender, die noch nicht auf dem Gerät liegen: je Termin bzw. bei den eigenen Dokumenten.
  const luecken = $derived.by(() => {
    const m = new Map()
    for (const e of buListe) {
      const offen = (e.docs || []).filter((d) => !d.eigen && !istLokal(d.datei))
      if (offen.length) m.set(e.id, offen)
    }
    const priv = ($buchungen?.persoenlich || []).filter((d) => !d.eigen && !istLokal(d.datei))
    if (priv.length) m.set('persoenlich', priv)
    return m
  })
  const zielGruppen = $derived.by(() => {
    const m = new Map()
    for (const e of buListe) { const k = e.kat || ''; if (!m.has(k)) m.set(k, []); m.get(k).push(e) }
    const rang = (k) => { const i = ART_FOLGE.indexOf(k); return i < 0 ? 99 : i }
    return [...m.entries()]
      .sort((a, b) => rang(a[0]) - rang(b[0]))
      .map(([kat, evs]) => ({ kat, titel: katInfo(kat).icon + ' ' + katText({ kat }), evs: [...evs].sort((x, y) => x.datum.localeCompare(y.datum)) }))
  })
  const gewaehlt = $derived(zuordnen.filter((z) => z.ziel).length)
  const pfadZuTermin = $derived.by(() => {
    const m = new Map()
    for (const [id, docs] of luecken) for (const d of docs) m.set('pf:' + d.datei, id)
    return m
  })

  // Zu welchem Termin die gewählte Lücke gehört: im zugeklappten Feld steht sonst nur „fehlt noch: Beleg“.
  function zielText(ziel) {
    if (!ziel?.startsWith('pf:')) return ''
    const id = pfadZuTermin.get(ziel)
    if (id === 'persoenlich') return t('🪪 Eigene Dokumente')
    const e = buListe.find((x) => x.id === id)
    return e ? `${katInfo(e.kat).icon} ${kurzTag(e.datum)} · ${e.titel}` : ''
  }

  function vorschlag(datei) {
    const id = schlageZielVor(datei.name, buListe)
    if (!id) return ''
    const offen = luecken.get(id) || []
    return offen.length === 1 ? 'pf:' + offen[0].datei : 'ev:' + id
  }

  // Wie beim Öffnen eines Belegs: Fenster sofort im Fingertipp, dann befüllen (iOS).
  // PDF-Portfolios (Mail aus Outlook) zeigen dabei gleich das eigentliche PDF, wie beim Öffnen am Termin
  function ansehen(datei) {
    const fenster = window.open('', '_blank')
    zumAnzeigen(datei).then((a) => zeigeImFenster(fenster, a, datei.name))
  }

  async function zuordnungSpeichern() {
    if (zSpeichern) return
    zSpeichern = true
    const belegt = new Set([...$lokaleBelege, ...alleRefs.map((p) => (p || '').normalize('NFC'))])
    const lueckeVergeben = new Set()
    const anhaengen = [], fertig = []
    try {
      for (const z of zuordnen) {
        if (!z.ziel) continue
        let pfad = null, ziel = null
        if (z.ziel.startsWith('pf:') && !lueckeVergeben.has(z.ziel)) {
          pfad = z.ziel.slice(3); lueckeVergeben.add(z.ziel)
        } else {
          // Zwei Dateien für dieselbe Lücke: die zweite hängt als eigener Beleg am Termin.
          ziel = z.ziel === 'persoenlich' ? 'persoenlich' : z.ziel.startsWith('ev:') ? z.ziel.slice(3) : pfadZuTermin.get(z.ziel)
          if (!ziel) continue
          pfad = eigenerPfad(ziel, z.datei.name, belegt)
        }
        belegt.add(pfad)
        await speichereBeleg(pfad, z.datei)
        if (ziel) anhaengen.push({ ziel, label: (z.label || '').trim() || belegLabel(z.datei.name), datei: pfad })
        fertig.push(z.nr)
      }
    } catch (err) {
      ergebnis = t('Speichern fehlgeschlagen: ') + (err?.message || err)
    }
    if (anhaengen.length) belegeAnhaengen(anhaengen)
    if (fertig.length) { try { await navigator.storage?.persist?.() } catch {} }
    zeilenWeg(fertig)
    zSpeichern = false
    if (fertig.length) ergebnis = '✓ ' + tn(fertig.length, '{n} Beleg zugeordnet', '{n} Belege zugeordnet')
      + (zuordnen.length ? ' · ' + tn(zuordnen.length, '{n} noch ohne Termin', '{n} noch ohne Termin') : '')
  }
  const groesseText = (n) => (n >= 1048576 ? mb(n) : dezimal(Math.max(1, n / 1024), 0) + ' KB')

  async function eigenesDokEntfernen(d) {
    if (!(await loeschFrage(t('Beleg „{label}“', { label: d.label }), t('Die Datei verschwindet von diesem Gerät. Deine anderen Dokumente bleiben.')))) return
    belegAbnehmen(d.datei)
    try { await loescheBeleg(d.datei) } catch {}
  }

  async function belegOeffnen(pfad) {
    if (!(await oeffneBeleg(pfad))) ergebnis = t('Dieser Beleg liegt nicht auf dem Gerät.')
  }
  async function belegeLoeschen() {
    if (!(await frage({ titel: t('Alle {anzahlLokal} gespeicherten Belege von diesem Gerät löschen?', { anzahlLokal }), text: t('Die Termine und Buchungsnummern bleiben.'), ja: t('Löschen'), gefahr: true }))) return
    await loescheAlleBelege()
    ergebnis = t('Belege gelöscht.')
  }
  let sichern = $state(null)   // { fertig, gesamt, fehler }
  async function belegeSichern() {
    if (sichern) return
    sichern = { fertig: 0, gesamt: belege.length, fehler: 0 }
    for (const b of belege) {
      try {
        const r = await fetch(b.url, { cache: 'reload' })
        if (!r.ok) throw new Error(String(r.status))
        await r.blob()                       // erst der gelesene Body landet im Cache
      } catch { sichern = { ...sichern, fehler: sichern.fehler + 1 } }
      sichern = { ...sichern, fertig: sichern.fertig + 1 }
    }
    const f = sichern.fehler
    setTimeout(() => (sichern = null), 4000)
    if (f) hinweis(t('{wert} von {length} Belegen gesichert, {f} nicht erreichbar.', { wert: belege.length - f, length: belege.length, f }))
  }

  async function kalenderEntfernen() {
    if (!(await frage({ titel: t('Buchungen und die daraus abgeleiteten Etappen entfernen?'), text: t('Deine eigenen Etappen, Routen, Orte und Logbuch-Einträge bleiben unangetastet.') + (buEigene ? t(' Auch die Buchungen, die du aus Mails eingefügt hast, bleiben.') : ''), ja: t('Entfernen'), gefahr: true }))) return
    // Aus Mails Eingefügtes gehört nicht zum Reisekalender und bleibt stehen.
    const eigene = $state.snapshot(($buchungen?.events || []).filter((e) => e.quelle === 'eigen'))
    const weg = entferneReisekalender()
    if (eigene.length) buchungenEinfuegen(eigene)
    hinweis(weg ? t('Entfernt. {weg} abgeleitete Etappen gelöscht.', { weg }) : 'Entfernt.')
  }
  const dokErledigt = $derived($dokumente.filter((d) => d.erledigt).length)
  const dokAbgelaufen = $derived($dokumente.filter((d) => abgelaufen(d.gueltigBis)).length)

  const vorabSumme = $derived.by(() => {
    let e = 0, a = 0
    for (const k of $vorabKosten) { const b = inBeide(k.betrag, k.waehrung, kursFuer($fxKurse, k.datum)); e += b.eur; a += b.aud }
    return { eur: e, aud: a }
  })

  // Abreise = frühestes Startdatum (Vacation/Ost zuerst, sonst West-Roadtrip).
  const abreise = $derived(planUeberblick(etappenMitDatum($reisen, $gesamtStart)).start || $gesamtStart)
  const countdown = $derived.by(() => {
    if (!abreise) return null
    const heute = new Date(); heute.setHours(0, 0, 0, 0)
    const ziel = new Date(abreise + 'T00:00:00')
    return Math.round((ziel - heute) / 86400000)
  })

  const alleItems = $derived([...VORBEREITUNG.flatMap((g) => g.items), ...$vorbereitung.custom])
  const erledigt = $derived(alleItems.filter((i) => istAn($vorbereitung.checked[i.id])).length)
  const prozent = $derived(alleItems.length ? Math.round(erledigt / alleItems.length * 100) : 0)

  let neuText = $state('')
  function addCustom() { addVorbItem(neuText); neuText = '' }

  const fmtDat = (d) => { try { return new Date(d + 'T12:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return d } }
  const abgelaufen = (d) => d && new Date(d + 'T23:59') < new Date()

  const dokTypVorhanden = $derived(new Set($dokumente.map((d) => d.typ)))
</script>

<!-- Countdown -->
{#if countdown != null}
  <div class="countdown" class:bald={countdown <= 30 && countdown >= 0}>
    {#if countdown > 0}
      <span class="cd-zahl">{countdown}</span><span class="cd-lbl">{t('Tage bis zur Abreise · {fmtDat}', { fmtDat: fmtDat(abreise) })}</span>
    {:else if countdown === 0}
      <span class="cd-zahl">🛫</span><span class="cd-lbl">{t('Heute geht\'s los!')}</span>
    {:else}
      <span class="cd-lbl">{t('Reise läuft / vorbei (Start {fmtDat})', { fmtDat: fmtDat(abreise) })}</span>
    {/if}
  </div>
{/if}

<!-- Checkliste -->
<section class="block">
  <div class="b-kopf">
    <h3>{t('✅ Vor-Abfahrt-Checkliste')}</h3>
    <span class="fortschritt">{t('{erledigt}/{length} erledigt', { erledigt, length: alleItems.length })}</span>
  </div>
  <div class="bar"><div class="bar-fill" style="transform:scaleX({prozent / 100})"></div></div>

  {#each VORBEREITUNG as g}
    <div class="gruppe">
      <div class="g-titel">{g.gruppe}</div>
      {#each g.items as it}
        <button class="item" class:an={istAn($vorbereitung.checked[it.id])} onclick={() => toggleVorb(it.id)}>
          <span class="box">{istAn($vorbereitung.checked[it.id]) ? '✓' : ''}</span>{it.text}
        </button>
      {/each}
    </div>
  {/each}

  {#if $vorbereitung.custom.length}
    <div class="gruppe">
      <div class="g-titel">{t('Eigene Punkte')}</div>
      {#each $vorbereitung.custom as it}
        <div class="item-zeile">
          <button class="item" class:an={istAn($vorbereitung.checked[it.id])} onclick={() => toggleVorb(it.id)}>
            <span class="box">{istAn($vorbereitung.checked[it.id]) ? '✓' : ''}</span>{it.text}
          </button>
          <button class="del" onclick={() => delVorbItem(it.id)} title={t('löschen')}>✕</button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="add">
    <input placeholder={t('Eigenen Punkt hinzufügen …')} bind:value={neuText} onkeydown={(e) => e.key === 'Enter' && addCustom()} />
    <button onclick={addCustom} disabled={!neuText.trim()}>{t('+ hinzufügen')}</button>
  </div>
</section>

<!-- Dokumente -->
<section class="block">
  <div class="b-kopf">
    <button class="b-auf" onclick={() => (dokAuf = !dokAuf)} aria-expanded={dokAuf}>
      <span class="b-pfeil">{dokAuf ? '▾' : '▸'}</span>
      <h3>{t('🗂️ Dokumente')}</h3>
      {#if !dokAuf}
        <span class="b-summe">
          {#if $dokumente.length === 0}{t('noch keine')}{:else}{t('{length} · {dokErledigt} erledigt', { length: $dokumente.length, dokErledigt })}{/if}
          {#if dokAbgelaufen}<span class="b-warn">{t('⚠︎ {dokAbgelaufen} abgelaufen', { dokAbgelaufen })}</span>{/if}
        </span>
      {/if}
    </button>
    <button class="neu" onclick={() => { dokAuf = true; neuesDokument() }}>{t('+ Dokument')}</button>
  </div>
  {#if dokAuf}
  <div class="dok-vorschlaege">
    {#each DOKUMENT_TYPEN as typ}
      {@const da = dokTypVorhanden.has(typ) || dokTypVorhanden.has(t(typ))}
      <button class="v-chip" class:da onclick={() => neuesDokument({ typ: t(typ) })}>{t(typ)}{da ? ' ✓' : ' +'}</button>
    {/each}
  </div>

  {#if $dokumente.length === 0}
    <p class="leer">{t('Noch keine Dokumente. Nimm oben einen Vorschlag (Reisepass, eTA/Visum …) oder „+ Dokument“.')}</p>
  {:else}
    <div class="dok-liste">
      {#each $dokumente as d (d.id)}
        <div class="dok" class:erledigt={d.erledigt}>
          <div class="dok-z1">
            <input class="d-typ" value={d.typ} oninput={(e) => updateDokument(d.id, { typ: e.target.value })} placeholder={t('Art (z.B. Reisepass)')} />
            <label class="d-check"><input type="checkbox" checked={d.erledigt} onchange={(e) => updateDokument(d.id, { erledigt: e.target.checked })} /> {t('erledigt')}</label>
            <button class="del" onclick={async () => { if (await loeschFrage(t('Dokument'))) loescheDokument(d.id) }} title={t('löschen')}>🗑</button>
          </div>
          <div class="dok-z2">
            <input class="d-nr" value={d.nummer} oninput={(e) => updateDokument(d.id, { nummer: e.target.value })} placeholder={t('Nummer / Referenz')} />
            <label class="d-gueltig">{t('gültig bis')} <input type="date" value={d.gueltigBis} onchange={(e) => updateDokument(d.id, { gueltigBis: e.target.value })} /></label>
            {#if abgelaufen(d.gueltigBis)}<span class="d-warn">{t('⚠︎ abgelaufen')}</span>{/if}
          </div>
          <input class="d-notiz" value={d.notiz} oninput={(e) => updateDokument(d.id, { notiz: e.target.value })} placeholder={t('Notiz (Ablageort, Police-Nr., Hotline …)')} />
        </div>
      {/each}
    </div>
    <p class="hinweis">{t('🔒 Alles bleibt nur auf deinem Gerät (offline, im Backup). Keine sensiblen Passwörter eintragen.')}</p>
  {/if}
  {/if}
</section>

<!-- Gebuchtes aus der eigenen Kalender-App. Bewusst nur Anzeige: geändert wird
     dort, hier wird die Datei einfach neu importiert. Dazu kommen Buchungen, die aus
     einer Bestätigungsmail eingefügt wurden (quelle 'eigen', hier löschbar). -->
<section class="block" aria-labelledby="bu-titel">
  <div class="b-kopf">
    <button class="b-auf" onclick={() => (buAuf = !buAuf)} aria-expanded={buAuf}>
      <span class="b-pfeil">{buAuf ? '▾' : '▸'}</span>
      <h3 id="bu-titel">{t('🎟️ Buchungen')}</h3>
      {#if !buAuf}
        <span class="b-summe">
          {#if buListe.length === 0}{t('noch keine')}{:else}{t('{length} Termine', { length: buListe.length })}{#if ausKalender}&nbsp;{t('· {buBelege} Belege', { buBelege })}{/if}{#if buEigene}&nbsp;{t('· {buEigene} aus Mails', { buEigene })}{/if}{/if}
        </span>
      {/if}
    </button>
    <button class="neu bu-neu" aria-expanded={einfuegenAuf} onclick={() => { buAuf = true; einfuegenAuf = !einfuegenAuf }}>{einfuegenAuf ? t('Schließen') : t('+ Aus Mail')}</button>
  </div>
  {#if buAuf}
    {#if einfuegenAuf}
      <div transition:klapp={{ duration: dauer(240) }}>
        <BuchungEinfuegen onfertig={() => (einfuegenAuf = false)} />
      </div>
    {/if}
    {#if buListe.length === 0 && !einfuegenAuf}
      <p class="leer">{t('Noch keine Buchungen. Importiere deinen Reisekalender (Mehr → Import) oder füge mit „+ Aus Mail“ eine Bestätigungsmail ein.')}</p>
    {/if}
    {#if ausKalender}
    <div class="bu-quelle">
      {t('Aus deinem Reisekalender · {fmtTag} – {fmtTag2}', { fmtTag: fmtTag($buchungen.von), fmtTag2: fmtTag($buchungen.bis) })}
      <button class="bu-weg" onclick={kalenderEntfernen}>{t('entfernen')}</button>
    </div>
    {/if}

    <!-- Belege vom eigenen Gerät. Der ausgelieferte Build ist leer: Tickets und
         Buchungsbestätigungen tragen Klarnamen und Buchungsnummern und haben auf
         einer im Netz erreichbaren Adresse nichts verloren. -->
    <!-- Basic: auch ohne Buchung sichtbar. Die Einführung führt hierher, und Pass oder Visum
         lassen sich dann gleich als eigene Dokumente ablegen. -->
    {#if true}
    <div class="bu-lokal">
      <div class="bl-kopf">
        <span class="bl-titel">{t('📁 Belege auf diesem Gerät')}</span>
        {#if alleRefs.length || $lokaleGroesse}
        <span class="bl-zahl" class:voll={anzahlLokal >= alleRefs.length && alleRefs.length > 0}>
          {#if alleRefs.length}{t('{anzahlLokal} von {length}', { anzahlLokal, length: alleRefs.length })}{/if}{#if $lokaleGroesse}&nbsp;· {mb($lokaleGroesse)}{/if}
        </span>
        {/if}
      </div>

      <div class="bl-akt">
        <button class="bl-btn" onclick={() => belegInput.click()} disabled={!!laden}>
          {#if laden}⏳ {laden.fertig}/{laden.gesamt} …{:else}{t('📂 PDFs auswählen')}{/if}
        </button>
        <button class="bl-btn zart" onclick={() => fotoInput.click()} disabled={!!laden}>{t('🖼️ Foto vom Ticket')}</button>
        {#if kannOrdner}
          <button class="bl-btn zart" onclick={() => ordnerInput.click()} disabled={!!laden}>{t('ganzen Ordner')}</button>
        {/if}
        {#if anzahlLokal}
          <button class="bl-btn zart" onclick={belegeLoeschen} disabled={!!laden}>{t('löschen')}</button>
        {/if}
      </div>

      <input bind:this={belegInput} type="file" multiple accept="application/pdf,.pdf" onchange={belegeLaden} hidden />
      <input bind:this={ordnerInput} type="file" webkitdirectory onchange={belegeLaden} hidden />
      <input bind:this={fotoInput} type="file" multiple accept="image/*,.heic,.heif" onchange={belegeLaden} hidden />

      {#if ergebnis}
        <span class="bl-erg">{ergebnis}</span>
      {:else}
        <span class="bl-hint">
          {t('Am iPhone:')} <b>{t('PDFs auswählen')}</b> {t('→ Dateien-App → Ordner mit deinen Belegen')} {t('→ „Auswählen“ → alle markieren → „Öffnen“. Die Zuordnung zum richtigen Termin macht die App selbst. Was sie nicht erkennt, ordnest du danach in einer Liste zu. Am besten in der App vom Home-Bildschirm laden: Safari und Home-Bildschirm haben getrennte Speicher. Danach sind sie offline verfügbar und liegen auf keinem Server.')}
          {t('Ein Ticket nur als Foto oder Bildschirmfoto:')} <b>{t('🖼️ Foto vom Ticket')}</b>{t(', danach unten dem Termin zuordnen.')}
          <br><b>{t('Wichtig:')}</b> {t('Belege wandern')} <b>{t('nicht')}</b> {t('ins Backup. Sie bleiben auf dem Gerät, auf dem du sie geladen hast. Auf einem neuen Gerät also einmal neu auswählen. Umgekehrt löscht ein Backup-Import die hier geladenen Belege auch nicht.')}
        </span>
      {/if}

      {#if zuordnen.length}
        <div class="zo" role="group" aria-labelledby="zo-titel" transition:klapp={{ duration: dauer(220) }}>
          <span class="zo-titel" id="zo-titel">{tn(zuordnen.length, '📎 {n} Datei zuordnen', '📎 {n} Dateien zuordnen')}</span>
          <p class="zo-k">{t('Diese Dateien konnte die App keinem Termin sicher zuordnen. Wähle, wozu sie gehören. Wo der Dateiname einen Hinweis gab, steht schon ein Vorschlag.')}</p>
          {#each zuordnen as z (z.nr)}
            <div class="zo-zeile" class:leer={!z.ziel}>
              <div class="zo-datei">
                {#if z.vorschau}<img class="zo-bild" src={z.vorschau} alt="" />{/if}
                <span class="zo-name">{z.bild ? '🖼️' : '📄'} {z.datei.name}</span>
                <span class="zo-gr">{groesseText(z.datei.size)}</span>
                <button class="zo-an" onclick={() => ansehen(z.datei)}>{t('ansehen')}</button>
              </div>
              <label class="zo-f">{t('Gehört zu')}
                <select bind:value={z.ziel}>
                  <option value="">{t('nicht speichern')}</option>
                  {#each zielGruppen as g (g.kat)}
                    <optgroup label={g.titel}>
                      {#each g.evs as e (e.id)}
                        <option value={'ev:' + e.id}>{kurzTag(e.datum)} · {e.titel}</option>
                        {#each luecken.get(e.id) || [] as d (d.datei)}
                          <option value={'pf:' + d.datei}>{t('↳ fehlt noch: {label}', { label: d.label })}</option>
                        {/each}
                      {/each}
                    </optgroup>
                  {/each}
                  <optgroup label={t('🪪 Eigene Dokumente')}>
                    <option value="persoenlich">{t('Neues Dokument (Pass, Visum, Versicherung …)')}</option>
                    {#each luecken.get('persoenlich') || [] as d (d.datei)}
                      <option value={'pf:' + d.datei}>{t('↳ fehlt noch: {label}', { label: d.label })}</option>
                    {/each}
                  </optgroup>
                </select>
              </label>
              {#if zielText(z.ziel)}<span class="zo-ziel">{zielText(z.ziel)}</span>{/if}
              {#if z.ziel && !z.ziel.startsWith('pf:')}
                <label class="zo-f">{t('Name am Termin')}
                  <input bind:value={z.label} maxlength="60" />
                </label>
              {/if}
            </div>
          {/each}
          <div class="bl-akt">
            <button class="bl-btn" onclick={zuordnungSpeichern} disabled={zSpeichern || !gewaehlt}>
              {#if zSpeichern}⏳ …{:else}{tn(gewaehlt, '{n} Beleg speichern', '{n} Belege speichern')}{/if}
            </button>
            <button class="bl-btn zart" onclick={() => zeilenWeg()} disabled={zSpeichern}>{t('Liste verwerfen')}</button>
          </div>
        </div>
      {/if}
      <TresorEinstellung anzahl={anzahlLokal} />
    </div>
    {/if}

    {#if belege.length}
      <div class="bu-offline">
        <button class="bu-save" onclick={belegeSichern} disabled={!!sichern}>
          {#if sichern}⏳ {sichern.fertig}/{sichern.gesamt} …{:else}{t('⬇︎ Mitgelieferte Belege offline sichern ({length})', { length: belege.length })}{/if}
        </button>
        {#if sichern && sichern.fertig >= sichern.gesamt}<span class="bu-hint">{t('✓ gesichert')}{#if sichern.fehler}&nbsp;{t('· {fehler} nicht erreichbar', { fehler: sichern.fehler })}{/if}</span>{/if}
      </div>
    {/if}

    <div class="bu-liste">
      {#each buTage as [datum, posten] (datum)}
        <div class="bu-tag">
          <div class="bu-datum">{fmtTag(datum)}</div>
          {#each posten as b (b.id)}
            {@const ki = katInfo(b.kat)}
            <div class="bu-zeile">
              <span class="bu-kat" title={katText(b)}>{b.quelle === 'eigen' && b.emoji ? b.emoji : ki.icon}</span>
              <div class="bu-text">
                <b>{b.titel}{#if b.quelle === 'eigen'}<span class="bu-eigen">{t('aus Mail')}</span>{/if}</b>
                {#if b.sub}<span class="bu-sub">{b.sub}</span>{/if}
                <BelegKnoepfe docs={b.docs} entfernbar />
              </div>
              {#if b.ref}<span class="bu-ref">{b.ref}</span>{/if}
              {#if b.quelle === 'eigen'}
                <button class="bu-x" onclick={() => eigeneLoeschen(b)} aria-label={t('Buchung „{titel}“ löschen', { titel: b.titel })}>✕</button>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>

    {#if $buchungen?.persoenlich?.length}
      <div class="bu-priv">
        <div class="bu-priv-titel">{t('🪪 Eigene Dokumente')}</div>
        {#if ohneBelege}
          <!-- Öffentliche Fassung: Hinweis nur, solange noch nichts auf dem Gerät liegt -->
          {#if !$buchungen.persoenlich.some((d) => istLokal(d.datei))}
            <div class="bu-priv-warn">
              {t('🔒 Ausweise und Belege liegen aus Datenschutz')} <b>{t('nicht im Netz')}</b>{t('. Lade sie oben mit „📂 PDFs auswählen“ auf dieses Gerät.')}
            </div>
          {/if}
        {:else if ohnePersoenliche}
          <div class="bu-priv-warn">
            {t('🔒 Dieser Build enthält Reisepass, Visum und Führerschein')} <b>{t('nicht')}</b>{t('. Für das eigene Gerät mit allem:')} <code>npm run build:privat</code>
          </div>
        {/if}
        {#each $buchungen.persoenlich as d (d.id)}
          {#if istLokal(d.datei) && d.eigen}
            <div class="bu-priv-paar">
              <button class="bu-priv-z lokal" onclick={() => belegOeffnen(d.datei)}><b>{d.label}</b><span class="bu-pfad">{dateiName(d.datei)}</span></button>
              <button class="bu-x" onclick={() => eigenesDokEntfernen(d)} aria-label={t('Beleg „{label}“ entfernen', { label: d.label })}>✕</button>
            </div>
          {:else if istLokal(d.datei)}
            <button class="bu-priv-z lokal" onclick={() => belegOeffnen(d.datei)}><b>{d.label}</b><span class="bu-pfad">{dateiName(d.datei)}</span></button>
          {:else if !d.eigen && daBelege(d.datei)}
            <a class="bu-priv-z" href={dokumentUrl(d.datei)} target="_blank" rel="noopener"><b>{d.label}</b><span class="bu-pfad">{dateiName(d.datei)}</span></a>
          {:else}
            <div class="bu-priv-z fehlt"><b>{d.label}</b><span class="bu-pfad">{t('noch nicht geladen')}</span></div>
          {/if}
        {/each}
      </div>
    {/if}
    {#if ausKalender || alleRefs.length}
    {#if ohneBelege}
      <p class="hinweis">{t('📄 Tippen öffnet den Beleg, auch offline. Die Belege liegen nur auf diesem Gerät.')}</p>
    {:else}
      <p class="hinweis">{t('📄 Tippen öffnet den Beleg. Die PDFs liegen im Projektordner')} <code>_Documente</code> {t('und werden beim Bauen mitgenommen.')}</p>
    {/if}
    {/if}
  {/if}
</section>

<!-- Vorab-Ausgaben -->
<section class="block">
  <div class="b-kopf">
    <button class="b-auf" onclick={() => (vkAuf = !vkAuf)} aria-expanded={vkAuf}>
      <span class="b-pfeil">{vkAuf ? '▾' : '▸'}</span>
      <h3>{t('💳 Vorab-Ausgaben')}</h3>
      {#if !vkAuf}
        <span class="b-summe">
          {#if $vorabKosten.length === 0}{t('noch keine')}{:else}{$vorabKosten.length} · <b>{eur(vorabSumme.eur)}</b>{/if}
        </span>
      {/if}
    </button>
    <button class="neu" onclick={() => { vkAuf = true; neueVorabKosten() }}>{t('+ Ausgabe')}</button>
  </div>
  {#if vkAuf}
  <p class="vk-intro">{t('Kosten, die schon')} <b>{t('vor der Abreise')}</b> {t('anfallen (Flüge, Visum, Versicherung, Kamera/Drohne …). Jede Ausgabe wird')} <b>{t('nur einmal')}</b> {t('gezählt. Ordne sie optional einer Etappe zu (🔗), dann ist alles lückenlos und je Etappe dokumentiert, ganz ohne Doppelzählung. Die Summe fließt in Ausgaben und Budget auf „Heute“.')}</p>
  {#if $vorabKosten.length === 0}
    <p class="leer">{t('Noch keine Vorab-Ausgaben. „+ Ausgabe“ legt die erste an.')}</p>
  {:else}
    <div class="vk-liste">
      {#each $vorabKosten as k (k.id)}
        <div class="vk">
          <input class="vk-text" value={k.text} oninput={(e) => updateVorabKosten(k.id, { text: e.target.value })} placeholder={t('Wofür? (z.B. Flug FRA→MEL)')} />
          <div class="vk-z2">
            <select value={k.kat} onchange={(e) => updateVorabKosten(k.id, { kat: e.target.value })}>
              {#each KAT as c}<option value={c.key}>{c.label}</option>{/each}
            </select>
            <input class="vk-betrag" type="number" min="0" step="any" value={k.betrag} oninput={(e) => updateVorabKosten(k.id, { betrag: e.target.value })} placeholder={t('Betrag')} />
            <select class="vk-waehrung" value={k.waehrung} onchange={(e) => updateVorabKosten(k.id, { waehrung: e.target.value })}>
              <option value="EUR">{t('EUR')}</option><option value="AUD">{t('AUD')}</option>
            </select>
            <input class="vk-datum" type="date" value={k.datum} onchange={(e) => updateVorabKosten(k.id, { datum: e.target.value })} />
            <button class="del" onclick={() => loescheVorabKosten(k.id)} title={t('löschen')}>🗑</button>
          </div>
          {#if reiseOptionen.length}
            <label class="vk-reise">{t('🔗 gehört zu')}
              <select value={k.reiseId ?? ''} onchange={(e) => updateVorabKosten(k.id, { reiseId: e.target.value || null })}>
                <option value="">{t('— keiner Reise —')}</option>
                {#each reiseOptionen as o}<option value={o.id}>{o.label}</option>{/each}
              </select>
            </label>
          {/if}
        </div>
      {/each}
    </div>
    <div class="vk-summe">{t('Summe Vorab:')} <b>{eur(vorabSumme.eur)} · {aud(vorabSumme.aud)}</b></div>
  {/if}
  {/if}
</section>

<style>
  .countdown { display: flex; align-items: baseline; gap: 12px; background: linear-gradient(140deg, #2f7a63, #1a5a48); color: #fff; border-radius: 12px; padding: 16px 20px; margin-bottom: 18px; box-shadow: var(--shadow); }
  .countdown.bald { background: linear-gradient(140deg, #c1662f, #8a3f16); }
  .cd-zahl { font-size: calc(40px * var(--schrift, 1)); font-weight: 800; line-height: 1; }
  .cd-lbl { font-size: calc(14px * var(--schrift, 1)); font-weight: 700; opacity: 0.95; }

  .block { background: var(--card); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); padding: 14px 16px; margin-bottom: 16px; }
  .b-kopf { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  .bu-quelle { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-bottom: 8px; }
  .bu-weg { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--danger-text); background: none; border: 1px solid var(--line); border-radius: 6px; padding: 3px 8px; cursor: pointer; }
  .bu-liste { display: flex; flex-direction: column; gap: 8px; }
  .bu-tag { border-left: 3px solid var(--line-stark); padding-left: 10px; }
  .bu-datum { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); margin-bottom: 3px; }
  .bu-zeile { display: flex; align-items: flex-start; gap: 8px; padding: 5px 8px; background: var(--flaeche); border-radius: 7px; margin-bottom: 3px; }
  .bu-kat { font-size: calc(15px * var(--schrift, 1)); flex: 0 0 auto; line-height: 1.3; }
  .bu-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .bu-text b { font-size: calc(13px * var(--schrift, 1)); color: var(--ink); }
  .bu-sub { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); line-height: 1.4; }
  .bu-priv-z.lokal { border: none; background: none; font: inherit; cursor: pointer; text-align: left; width: 100%; }
  .bu-priv-z.fehlt { opacity: 0.55; }
  .bu-priv-warn { font-size: calc(12px * var(--schrift, 1)); line-height: 1.5; color: var(--ok-text); background: var(--card); border-radius: 6px; padding: 7px 9px; margin-bottom: 4px; }
  .bu-priv-warn code { font-family: ui-monospace, monospace; font-size: calc(12px * var(--schrift, 1)); background: var(--flaeche); padding: 1px 5px; border-radius: 4px; }
  .bu-lokal { border: 1px solid var(--line-stark); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; background: var(--flaeche); display: flex; flex-direction: column; gap: 8px; }
  .bl-kopf { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .bl-titel { font-size: calc(13px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .bl-zahl { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .bl-zahl.voll { color: var(--ok-text); }
  .bl-akt { display: flex; flex-wrap: wrap; gap: 6px; }
  .bl-btn { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 8px 13px; border-radius: 8px; cursor: pointer; border: 1px solid #2f7a63; background: #2f7a63; color: #fff; }
  .bl-btn.zart { background: var(--card); color: var(--btn-ink); border-color: var(--line-stark); }
  .bl-btn:disabled { opacity: 0.55; cursor: default; }
  .bl-hint, .bl-erg { font-size: calc(12px * var(--schrift, 1)); line-height: 1.5; color: var(--muted); }
  /* Maske: Dateien selbst zuordnen */
  .zo { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--line-stark); padding-top: 10px; }
  .zo-titel { font-size: calc(13px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .zo-k { margin: 0; font-size: calc(12px * var(--schrift, 1)); line-height: 1.5; color: var(--muted); }
  .zo-zeile { display: flex; flex-direction: column; gap: 6px; background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--ok); border-radius: 8px; padding: 8px 10px; }
  .zo-zeile.leer { border-left-color: var(--line-stark); }
  .zo-datei { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .zo-bild { width: 56px; height: 56px; border-radius: 6px; object-fit: cover; border: 1px solid var(--line); flex: none; }
  .zo-name { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--ink); overflow-wrap: anywhere; flex: 1; min-width: 0; }
  .zo-gr { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .zo-an { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--brand-text); background: none; border: 1px solid var(--line-stark); border-radius: 13px; padding: 4px 10px; min-height: 30px; cursor: pointer; }
  .zo-ziel { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); margin-top: -2px; }
  .zo-f { display: flex; flex-direction: column; gap: 3px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .zo-f select, .zo-f input { width: 100%; font-size: calc(13px * var(--schrift, 1)); padding: 6px 8px; border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); }
  .bu-priv-paar { display: flex; align-items: center; gap: 2px; }
  .bu-priv-paar .bu-priv-z { flex: 1; min-width: 0; }
  .bl-erg { font-weight: 700; color: var(--ok-text); }

  .bu-offline { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin-bottom: 10px; }
  .bu-save { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 7px 12px; border-radius: 8px; cursor: pointer; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); }
  .bu-save:disabled { opacity: 0.6; cursor: default; }
  .bu-hint { flex: 1 1 180px; min-width: 0; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .bu-neu { min-height: 44px; }
  .bu-eigen { display: inline-block; margin-left: 6px; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--info-text); background: var(--info-flaeche); border-radius: 8px; padding: 1px 7px; vertical-align: 1px; }
  .bu-x { flex: 0 0 auto; width: 44px; height: 44px; margin: -8px -8px -8px 0; border: none; background: none; color: var(--danger-text); font-size: calc(14px * var(--schrift, 1)); cursor: pointer; border-radius: 50%; }
  .bu-ref { flex: 0 0 auto; font-size: calc(12px * var(--schrift, 1)); font-family: ui-monospace, monospace; color: var(--muted); }
  .bu-priv { margin-top: 12px; padding: 10px 12px; background: var(--ok-flaeche); border-radius: 8px; display: flex; flex-direction: column; gap: 4px; }
  .bu-priv-titel { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--ok-text); }
  .bu-priv-z { display: flex; justify-content: space-between; gap: 10px; font-size: calc(12px * var(--schrift, 1)); flex-wrap: wrap; text-decoration: none; color: var(--ink); padding: 4px 0; }
  .bu-priv-z:active { opacity: 0.6; }
  .bu-pfad { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-family: ui-monospace, monospace; }
  .b-kopf h3 { margin: 0; font-size: calc(15px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }
  .fortschritt { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .neu { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; min-height: 36px; padding: 6px 12px; border: 1px solid #2f7a63; background: #2f7a63; color: #fff; border-radius: 8px; cursor: pointer; }
  .bar { height: 8px; background: #ece2cf; border-radius: 5px; overflow: hidden; margin-bottom: 12px; }
  .bar-fill { height: 100%; background: #2f7a63; transform-origin: left; transition: transform var(--t-slow) var(--ease-spring); }

  .gruppe { margin-bottom: 10px; }
  .g-titel { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 6px 0 4px; }
  .item-zeile { display: flex; align-items: center; gap: 4px; }
  .item { flex: 1; display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-size: calc(13.5px * var(--schrift, 1)); color: var(--ink); padding: 6px 4px; border-radius: 6px; font-family: inherit; }
  .item:hover { background: var(--flaeche); }
  .item.an { color: var(--muted); text-decoration: line-through; }
  .box { width: 20px; height: 20px; flex: 0 0 auto; border: 1.5px solid #b7a888; border-radius: 5px; display: inline-flex; align-items: center; justify-content: center; font-size: calc(12px * var(--schrift, 1)); color: #2f7a63; font-weight: 800; }
  .item.an .box { background: #2f7a63; border-color: #2f7a63; color: #fff; animation: box-pop 200ms var(--ease-out); }
  @keyframes box-pop { 0% { transform: scale(0.5); } 60% { transform: scale(1.18); } 100% { transform: scale(1); } }
  .del { border: none; background: none; color: var(--danger-text); cursor: pointer; font-size: calc(13px * var(--schrift, 1)); }
  .add { display: flex; gap: 6px; margin-top: 8px; }
  .add input { flex: 1; font-size: calc(13px * var(--schrift, 1)); padding: 8px 9px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--eingabe); color: var(--ink); }
  .add button { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; padding: 8px 12px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 6px; cursor: pointer; }
  .add button:disabled { opacity: 0.4; }

  .dok-vorschlaege { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .v-chip { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 6px 11px; border: 1px solid var(--ok-linie); background: var(--ok-flaeche); color: var(--ok-text); border-radius: 16px; cursor: pointer; }
  .v-chip.da { background: var(--flaeche-2); color: var(--muted); border-color: var(--line); }
  .leer { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); background: var(--flaeche); padding: 14px; border-radius: 10px; }
  .dok-liste { display: flex; flex-direction: column; gap: 10px; }
  .dok { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 7px; background: var(--eingabe); }
  .dok.erledigt { background: #f4f8f5; border-color: #cfe4d8; }
  .dok-z1 { display: flex; align-items: center; gap: 8px; }
  .d-typ { flex: 1; font-size: calc(14px * var(--schrift, 1)); font-weight: 700; padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; color: var(--ink); }
  .d-check { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .dok-z2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .d-nr { flex: 1 1 140px; font-size: calc(13px * var(--schrift, 1)); padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--card); color: var(--ink); }
  .d-gueltig { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; display: inline-flex; align-items: center; gap: 5px; }
  .d-gueltig input { font-size: calc(12px * var(--schrift, 1)); padding: 5px 7px; border: 1px solid var(--line-stark); border-radius: 6px; }
  .d-warn { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; color: var(--danger-text); }
  .d-notiz { width: 100%; font-size: calc(12.5px * var(--schrift, 1)); padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--card); color: var(--ink); }
  .hinweis { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); margin: 10px 0 0; }

  .vk-intro { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); margin: 0 0 12px; line-height: 1.5; }
  .vk-intro b { color: var(--ink); }
  .vk-liste { display: flex; flex-direction: column; gap: 8px; }
  .vk { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; background: var(--eingabe); display: flex; flex-direction: column; gap: 6px; }
  .vk-text { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 700; padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; color: var(--ink); }
  .vk-z2 { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .vk-z2 select, .vk-z2 input { font-size: calc(12.5px * var(--schrift, 1)); padding: 6px 7px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--card); color: var(--ink); }
  .vk-z2 select:first-child { flex: 1 1 140px; }
  .vk-betrag { width: 92px; }
  .vk-waehrung { width: 68px; }
  .vk-reise { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
  .vk-reise select { font-size: calc(12px * var(--schrift, 1)); padding: 5px 7px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--card); color: var(--ink); max-width: 200px; }
  .vk-summe { margin-top: 10px; text-align: right; font-size: calc(13.5px * var(--schrift, 1)); color: var(--ink); }
  .vk-summe b { color: var(--brand-text); }
  .b-auf {
    display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;
    background: none; border: none; padding: 2px 0; cursor: pointer; text-align: left;
    font: inherit; color: inherit;
  }
  .b-pfeil { color: var(--muted); font-size: calc(12px * var(--schrift, 1)); flex-shrink: 0; }
  .b-summe {
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .b-warn { color: var(--danger-text); margin-left: 6px; }
</style>
