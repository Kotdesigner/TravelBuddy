// Kern der Meldungen (V32): Speichern, Abstimmen, Ausblenden, Zurückziehen und die Telegram-Anbindung.
// Liegt außerhalb von netlify/functions, damit Netlify ihn nicht als eigene Funktion ausliefert.
// Speicher und Netz kommen von außen, damit Tests ohne echte Dienste laufen.
//
// Telegram (alles in Netlify-Variablen, nie im Code):
//   TELEGRAM_BOT_TOKEN  Schlüssel des Bots von @BotFather
//   TELEGRAM_GRUPPE     Chat-ID der TravelBuddy-Gruppe (Bot schreibt dort jede Meldung hinein)
//   TELEGRAM_ADMIN      Chat-ID des Anbieters mit dem Bot (Prüfen mit „Passt“, „Löschen“, „Wieder zeigen“)
//   TELEGRAM_GEHEIM     eigenes Geheimwort, prüft, dass Anfragen an den Bot wirklich von Telegram kommen
// Fehlt etwas davon, laufen die Meldungen in der App trotzdem, nur ohne Telegram.
//
// Speicher (Netlify Blobs „meldungen“):
//   m/<id>          eine Meldung mit allem, auch den Prüfwerten der Stimmen
//   index           alle Meldungen in der öffentlichen Form, damit die Liste ein einziger Lesevorgang ist
//   grenze/<stunde> Zähler für die Spam-Grenzen dieser Stunde
//   geheim/salz     Zufallswert, mit dem Geräte und Adressen zu Prüfwerten werden; ohne ihn nicht zurückzurechnen
// Geändert wird nur mit bedingtem Schreiben (ETag): Zwei gleichzeitige Anfragen überschreiben sich nicht.

import { createHash, randomBytes } from 'node:crypto'
import { pruefeNeu, oeffentlich, aktiv, verlaengert, TAGE, TAG_MS, AUSBLENDEN_AB, PRO_STUNDE, GEGENDEN } from '../src/lib/meldungen-regeln.js'

export const MAX_AKTIV = 400
/** Spam-Grenzen je Stunde: je Gerät und je Netzadresse (Campingplatz-WLAN: viele Geräte hinter einer Adresse) */
export const GRENZEN = {
  neu: { geraet: PRO_STUNDE, adresse: 20 },
  stimme: { geraet: 30, adresse: 60 },
  unpassend: { geraet: 10, adresse: 20 },
}
const ART_NAME = { weg: 'Weg · Road', tiere: 'Tiere · Wildlife', tanken: 'Tanken · Fuel', camping: 'Camping', wetter: 'Wetter · Weather', tipp: 'Tipp · Tip' }
const INDEX = 'index'
const SALZ = 'geheim/salz'
const VERSUCHE = 6

const hash = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 20)
const gegendName = (id) => GEGENDEN.find((g) => g.id === id)?.de || 'Australien'
const istGeraet = (g) => /^[a-f0-9]{16,64}$/.test(String(g))
/** Stimmen und Unpassend-Hinweise: { g: Gerät, a: Adresse } (ältere Einträge waren nur der Geräte-Prüfwert) */
const eintrag = (v) => (typeof v === 'string' ? { g: v, a: null } : v || {})

export class Konflikt extends Error {}

export function macheKern({ store, env = {}, holen = globalThis.fetch, jetzt = () => Date.now(), zufall = (n) => randomBytes(n).toString('hex') } = {}) {
  const key = (id) => 'm/' + id
  const gueltigeId = (id) => /^[a-f0-9]{8,32}$/.test(String(id))
  const lies = async (id) => (gueltigeId(id) ? await store.get(key(id), { type: 'json' }) : null)

  // ---------- Bedingt schreiben: lesen, ändern, nur schreiben, wenn sich inzwischen nichts geändert hat ----------
  const bedingt = typeof store.getWithMetadata === 'function'
  /**
   * fn(alt) gibt den neuen Wert zurück oder undefined, wenn nichts zu schreiben ist.
   * Ergebnis { wert, alt, geschrieben }. Bei dauerndem Konflikt wirft es Konflikt.
   */
  async function aendere(k, fn) {
    for (let i = 0; i < VERSUCHE; i++) {
      const g = bedingt ? await store.getWithMetadata(k, { type: 'json' }) : { data: await store.get(k, { type: 'json' }), etag: null }
      const alt = g?.data ?? null
      const neu = fn(alt === null ? null : structuredClone(alt))
      if (neu === undefined) return { wert: alt, alt, geschrieben: false }
      // Ohne ETag (ältere Speicher, der lokale Netlify-Testspeicher) geht es nur ungeschützt
      if (!bedingt || (alt !== null && !g?.etag)) { await store.setJSON(k, neu); return { wert: neu, alt, geschrieben: true } }
      const r = await store.setJSON(k, neu, g?.etag ? { onlyIfMatch: g.etag } : { onlyIfNew: true })
      if (r?.modified !== false) return { wert: neu, alt, geschrieben: true }
      // Jemand war schneller: kurz und zufällig warten, dann mit dem neuen Stand noch einmal
      await new Promise((ok) => setTimeout(ok, 5 + Math.random() * 25 * (i + 1)))
    }
    throw new Konflikt(k)
  }

  // ---------- Salz für Prüfwerte, einmal je Seite zufällig erzeugt ----------
  let salzVersprechen = null
  const salz = () => (salzVersprechen ??= aendere(SALZ, (alt) => (alt?.s ? undefined : { s: zufall(16) })).then((r) => r.wert?.s || '').catch(() => { salzVersprechen = null; return '' }))
  const pruefwert = async (s) => hash((await salz()) + '|' + s)
  /** Netzadresse als Prüfwert; ohne bekannte Adresse null */
  const adresse = async (wer) => (wer && wer !== 'unbekannt' ? await pruefwert('a|' + wer) : null)

  // ---------- Inhaltsverzeichnis ----------
  const imIndex = (m) => ({ ...oeffentlich(m), versteckt: !!m.versteckt })
  async function alleEinzeln() {
    const { blobs } = await store.list({ prefix: 'm/' })
    return (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean)
  }
  /** Verzeichnis lesen; fehlt es (erste Meldung, Umzug), aus den einzelnen Meldungen bauen */
  async function index() {
    const i = await store.get(INDEX, { type: 'json' }).catch(() => null)
    if (i && typeof i === 'object') return i
    const neu = Object.fromEntries((await alleEinzeln()).map((m) => [m.id, imIndex(m)]))
    await aendere(INDEX, (alt) => (alt ? undefined : neu)).catch(() => {})
    return neu
  }
  async function indexSetzen(m) {
    await index()
    await aendere(INDEX, (i) => ({ ...(i || {}), [m.id]: imIndex(m) })).catch(() => {})
  }
  async function indexWeg(ids) {
    await aendere(INDEX, (i) => {
      if (!i || !ids.some((id) => id in i)) return undefined
      for (const id of ids) delete i[id]
      return i
    }).catch(() => {})
  }
  /** Eine Meldung ändern (Stimme, Hinweis, Admin) und das Verzeichnis nachziehen */
  async function meldungAendern(id, fn) {
    if (!gueltigeId(id)) return null
    const r = await aendere(key(id), (m) => (m ? fn(m) : undefined))
    if (r.geschrieben) await indexSetzen(r.wert)
    return r
  }

  // ---------- Telegram ----------
  const tgBereit = () => !!env.TELEGRAM_BOT_TOKEN
  /** Gehen neue Meldungen auch in die TravelBuddy-Gruppe? Ohne Bot läuft alles nur in der App. */
  const inGruppe = () => tgBereit() && !!env.TELEGRAM_GRUPPE
  async function tg(methode, daten) {
    if (!tgBereit()) return null
    try {
      const r = await holen(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${methode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten) })
      const j = await r.json().catch(() => null)
      return j?.ok ? j.result : null
    } catch { return null }
  }
  const bis = (ms) => new Date(ms).toLocaleDateString('de-DE', { timeZone: 'Australia/Perth', weekday: 'short', day: 'numeric', month: 'numeric' })
  const gruppenText = (m) => `📣 TravelBuddy-Meldung · ${ART_NAME[m.art]}\n📍 ${m.ort || gegendName(m.gegend)}\n\n${m.text}\n\nvon ${m.name || 'Reisende/r'} · gilt bis ${bis(m.ablauf)}`
  const knoepfe = (m) => ({ inline_keyboard: [m.versteckt
    ? [{ text: 'Wieder zeigen', callback_data: 'zeigen:' + m.id }, { text: 'Löschen', callback_data: 'loeschen:' + m.id }]
    : [{ text: 'Passt', callback_data: 'passt:' + m.id }, { text: 'Löschen', callback_data: 'loeschen:' + m.id }]] })
  async function anGruppe(m) {
    if (!env.TELEGRAM_GRUPPE) return
    const r = await tg('sendMessage', { chat_id: env.TELEGRAM_GRUPPE, text: gruppenText(m), disable_web_page_preview: true })
    if (r?.message_id) await aendere(key(m.id), (x) => (x ? { ...x, tgGruppe: r.message_id } : undefined)).catch(() => {})
  }
  async function anAdmin(m, kopf) {
    if (!env.TELEGRAM_ADMIN) return
    await tg('sendMessage', { chat_id: env.TELEGRAM_ADMIN, text: `${kopf}\n\n${gruppenText(m)}`, reply_markup: knoepfe(m) })
  }
  async function ausGruppe(m) {
    if (env.TELEGRAM_GRUPPE && m.tgGruppe) await tg('deleteMessage', { chat_id: env.TELEGRAM_GRUPPE, message_id: m.tgGruppe })
  }

  // ---------- Spam-Grenzen: je Gerät und je Adresse pro Stunde, nur Prüfwerte, keine Adressen ----------
  async function grenze(art, geraet, wer) {
    const max = GRENZEN[art]
    const stunde = new Date(jetzt()).toISOString().slice(0, 13)
    const k = 'grenze/' + stunde
    const g = art + 'g' + (await pruefwert(stunde + '|' + geraet))
    const a = (await adresse(wer)) ? art + 'a' + (await pruefwert(stunde + '|' + wer)) : null
    let frei = false
    const r = await aendere(k, (d) => {
      d = d || {}
      frei = (d[g] || 0) < max.geraet && (!a || (d[a] || 0) < max.adresse)
      if (!frei) return undefined
      d[g] = (d[g] || 0) + 1
      if (a) d[a] = (d[a] || 0) + 1
      return d
    })
    // Erste Zählung dieser Stunde: alte Stunden aufräumen
    if (frei && r.alt === null) {
      const { blobs } = await store.list({ prefix: 'grenze/' }).catch(() => ({ blobs: [] }))
      await Promise.all(blobs.filter((b) => b.key !== k).map((b) => store.delete(b.key).catch(() => {})))
    }
    return frei
  }

  return {
    /** Alle aktiven Meldungen, öffentlich. Ein Lesevorgang; Abgelaufene werden dabei aufgeräumt. */
    async liste() {
      const i = await index()
      const t = jetzt()
      const alle = Object.values(i)
      // Abgelaufene nur aus dem Speicher. In der Gruppe bleiben sie als Verlauf stehen.
      const vorbei = alle.filter((m) => !(m.ablauf > t)).map((m) => m.id)
      if (vorbei.length) {
        await Promise.all(vorbei.map((id) => store.delete(key(id)).catch(() => {})))
        await indexWeg(vorbei)
      }
      return alle.filter((m) => aktiv(m, t)).sort((a, b) => b.erstellt - a.erstellt).slice(0, MAX_AKTIV).map(oeffentlich)
    },

    async neu(roh, { geraet, wer } = {}) {
      if (!istGeraet(geraet)) return { status: 400, daten: { ok: false, grund: 'geraet' } }
      const { meldung, fehler } = pruefeNeu(roh)
      if (fehler) return { status: 400, daten: { ok: false, grund: fehler } }
      if (!(await grenze('neu', geraet, wer))) return { status: 429, daten: { ok: false, grund: 'zu-viele' } }
      const schluessel = zufall(16)
      const t = jetzt()
      const m = { ...meldung, id: zufall(8), erstellt: t, ablauf: t + TAGE * TAG_MS, ja: [], nein: [], unpassend: [], versteckt: false,
        von: await pruefwert(geraet), schluessel: await pruefwert('s|' + schluessel) }
      const r = await aendere(key(m.id), (alt) => (alt ? undefined : m))
      if (!r.geschrieben) return { status: 409, daten: { ok: false, grund: 'doppelt' } }
      await indexSetzen(m)
      await anGruppe(m)
      await anAdmin(m, '🆕 Neue Meldung')
      return { status: 200, daten: { ok: true, meldung: oeffentlich(m), schluessel } }
    },

    /** „Stimmt noch“ (ja) oder „Nicht mehr“ (nein): eine Stimme je Gerät und je Netzadresse, umstellbar */
    async stimme(id, wert, geraet, wer) {
      if (!['ja', 'nein'].includes(wert) || !istGeraet(geraet)) return { status: 400, daten: { ok: false } }
      if (!gueltigeId(id) || !aktiv(await lies(id), jetzt())) return { status: 404, daten: { ok: false, grund: 'weg' } }
      if (!(await grenze('stimme', geraet, wer))) return { status: 429, daten: { ok: false, grund: 'zu-viele' } }
      const g = await pruefwert(geraet), a = await adresse(wer)
      const derselbe = (v) => { const e = eintrag(v); return e.g === g || (!!a && e.a === a) }
      const r = await meldungAendern(id, (m) => {
        if (!aktiv(m, jetzt())) return undefined
        const schonJa = (m.ja || []).some(derselbe)
        m.ja = (m.ja || []).filter((v) => !derselbe(v)); m.nein = (m.nein || []).filter((v) => !derselbe(v))
        m[wert].push({ g, a })
        // Nur wer neu „Stimmt noch“ sagt, verlängert, sonst könnte einer allein die Meldung am Leben halten
        if (wert === 'ja' && !schonJa) m.ablauf = verlaengert(m)
        return m
      })
      if (!r?.geschrieben) return { status: 404, daten: { ok: false, grund: 'weg' } }
      return { status: 200, daten: { ok: true, meldung: oeffentlich(r.wert) } }
    },

    /** Unpassend melden: ab drei verschiedenen Geräten aus drei Netzen sofort ausgeblendet, der Anbieter bekommt Bescheid */
    async unpassend(id, geraet, wer) {
      if (!istGeraet(geraet)) return { status: 400, daten: { ok: false } }
      if (!gueltigeId(id) || !(await lies(id))) return { status: 404, daten: { ok: false, grund: 'weg' } }
      if (!(await grenze('unpassend', geraet, wer))) return { status: 429, daten: { ok: false, grund: 'zu-viele' } }
      const g = await pruefwert(geraet), a = await adresse(wer)
      let neuVersteckt = false
      const r = await meldungAendern(id, (m) => {
        const liste = (m.unpassend || []).map(eintrag)
        if (liste.some((e) => e.g === g || (!!a && e.a === a))) return undefined
        m.unpassend = [...liste, { g, a }]
        neuVersteckt = !m.versteckt && m.unpassend.length >= AUSBLENDEN_AB
        if (neuVersteckt) m.versteckt = true
        return m
      })
      if (r?.geschrieben && neuVersteckt) { await ausGruppe(r.wert); await anAdmin(r.wert, `🚩 ${r.wert.unpassend.length}× als unpassend gemeldet, ausgeblendet`) }
      return { status: 200, daten: { ok: true } }
    },

    /** Eigene Meldung zurückziehen, nur mit dem Schlüssel, den das Gerät beim Melden bekam */
    async zurueck(id, schluessel) {
      const m = await lies(id)
      if (!m) return { status: 200, daten: { ok: true } }
      if (!schluessel || (await pruefwert('s|' + schluessel)) !== m.schluessel) return { status: 403, daten: { ok: false } }
      await store.delete(key(id))
      await indexWeg([id])
      await ausGruppe(m)
      return { status: 200, daten: { ok: true } }
    },

    /** Der Anbieter im Admin-Chat: passt, loeschen, zeigen */
    async admin(aktion, id) {
      const m = await lies(id)
      if (!m) return 'nicht mehr da'
      if (aktion === 'loeschen') { await store.delete(key(id)); await indexWeg([id]); await ausGruppe(m); return 'gelöscht' }
      if (aktion === 'zeigen') {
        const r = await meldungAendern(id, (x) => ({ ...x, versteckt: false, unpassend: [] }))
        if (r?.geschrieben) await anGruppe(r.wert)
        return 'wieder sichtbar'
      }
      return 'geprüft'
    },

    tg, tgBereit, inGruppe,
  }
}
