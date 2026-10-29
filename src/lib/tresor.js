// Tresor für die Belege (29.10.2026): Tickets, Pass, Visum und alle anderen Belege liegen auf dem
// Gerät verschlüsselt und sind erst nach Face ID (iPhone) oder Touch ID (Mac) lesbar. Ohne Netz.
//
// Wie: Beim Einrichten entsteht ein Schlüsselpaar (ECDH P-256). Der öffentliche Teil liegt offen
// und verschlüsselt jeden neuen Beleg, ohne zu fragen; Belege hinzufügen bleibt also so einfach
// wie vorher. Der private Teil liegt zweimal verschlüsselt da:
//   · mit einem Schlüssel aus dem Passkey. Die WebAuthn-Erweiterung „PRF“ gibt nach Face ID oder
//     Touch ID ein festes Geheimnis heraus (Safari ab 18, iOS ab 18). Das Gerät prüft selbst.
//   · mit dem Notfall-Code, den man beim Einrichten aufschreibt (PBKDF2, 600 000 Runden).
// Ohne eines von beiden ist kein Beleg lesbar. Entsperrt bleibt es fünf Minuten nach dem letzten
// Öffnen, nur im Arbeitsspeicher. Jeder Beleg hat einen eigenen Wegwerf-Schlüssel (ECDH → HKDF →
// AES-GCM), siehe verschluessele().
//
// Eigene Datenbank `wa-tresor`, nicht im Backup, wie die Belege selbst.
import { writable, get } from 'svelte/store'
import { t } from './i18n.js'

export const ITERATIONEN = 600000
export const OFFEN_MS = 5 * 60 * 1000
const KURVE = { name: 'ECDH', namedCurve: 'P-256' }
const AES = { name: 'AES-GCM', length: 256 }
const enc = new TextEncoder()
const zufall = (n) => crypto.getRandomValues(new Uint8Array(n))
const u8 = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x))

// ---------- Notfall-Code ----------

// Ohne I, O, 0 und 1: nichts, was man beim Abschreiben verwechselt. 32 Zeichen = 5 Bit je Zeichen.
const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Neuer Notfall-Code, 16 Zeichen in Vierergruppen (80 Bit): „K7QM-2XPA-…“ */
export function erzeugeCode() {
  const z = zufall(16)
  const s = [...z].map((b) => ZEICHEN[b & 31]).join('')
  return s.match(/.{4}/g).join('-')
}
/** Eingabe vereinheitlichen: Groß/klein, Leerzeichen und Striche egal. */
export const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
export const codeVollstaendig = (s) => normCode(s).length === 16 && [...normCode(s)].every((c) => ZEICHEN.includes(c))

// ---------- Schlüssel ----------

async function kekAusCode(code, salz, iter) {
  const basis = await crypto.subtle.importKey('raw', enc.encode(normCode(code)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: u8(salz), iterations: iter, hash: 'SHA-256' }, basis, AES, false, ['encrypt', 'decrypt'])
}
async function kekAusPrf(prf) {
  const basis = await crypto.subtle.importKey('raw', u8(prf), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('travelbuddy-tresor-passkey') }, basis, AES, false, ['encrypt', 'decrypt'])
}
async function einpacken(kek, bytes) {
  const iv = zufall(12)
  return { iv, daten: u8(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, bytes)) }
}
const auspacken = async (kek, p) => u8(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8(p.iv) }, kek, u8(p.daten)))
const privatImport = (pkcs8) => crypto.subtle.importKey('pkcs8', pkcs8, KURVE, false, ['deriveBits'])

/**
 * Neuer Tresor-Datensatz. `prf` (32 Byte aus dem Passkey) ist optional: ohne ihn öffnet nur der Code.
 * @returns { datensatz, privat }  privat = CryptoKey, nicht exportierbar
 */
export async function neuerTresor({ code, prf = null, credId = null, prfSalz = null, iterationen = ITERATIONEN }) {
  if (!codeVollstaendig(code)) throw new Error(t('Der Notfall-Code ist nicht vollständig.'))
  const paar = await crypto.subtle.generateKey(KURVE, true, ['deriveBits'])
  const pub = u8(await crypto.subtle.exportKey('raw', paar.publicKey))
  const priv = u8(await crypto.subtle.exportKey('pkcs8', paar.privateKey))
  const codeSalz = zufall(16)
  const datensatz = {
    version: 1, angelegt: new Date().toISOString(), pub,
    codeSalz, iterationen, privCode: await einpacken(await kekAusCode(code, codeSalz, iterationen), priv),
    credId: credId ? u8(credId) : null, prfSalz: prfSalz ? u8(prfSalz) : null,
    privPrf: prf ? await einpacken(await kekAusPrf(prf), priv) : null,
  }
  const privat = await privatImport(priv)
  priv.fill(0)
  return { datensatz, privat }
}

async function oeffne(kek, paket) {
  let priv
  try { priv = await auspacken(kek, paket) } catch { throw Object.assign(new Error(t('Der Code stimmt nicht.')), { name: 'FalscherSchluessel' }) }
  const k = await privatImport(priv)
  priv.fill(0)
  return k
}
export const oeffneMitCode = async (d, code) => oeffne(await kekAusCode(code, d.codeSalz, d.iterationen || ITERATIONEN), d.privCode)
export async function oeffneMitPrf(d, prf) {
  if (!d.privPrf) throw new Error(t('Dieser Tresor hat keinen Passkey.'))
  return oeffne(await kekAusPrf(prf), d.privPrf)
}

// ---------- Ein Beleg ----------

async function dateiSchluessel(privat, oeffentlich, nutzung) {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: oeffentlich }, privat, 256)
  const basis = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('travelbuddy-beleg') }, basis, AES, false, [nutzung])
}

/** Bytes mit dem öffentlichen Schlüssel verschlüsseln. Braucht kein Entsperren. */
export async function verschluessele(pubRaw, bytes) {
  const empfaenger = await crypto.subtle.importKey('raw', u8(pubRaw), KURVE, false, [])
  const weg = await crypto.subtle.generateKey(KURVE, true, ['deriveBits'])
  const k = await dateiSchluessel(weg.privateKey, empfaenger, 'encrypt')
  const iv = zufall(12)
  const daten = u8(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, u8(bytes)))
  return { epk: u8(await crypto.subtle.exportKey('raw', weg.publicKey)), iv, daten }
}
export async function entschluessele(privat, paket) {
  const epk = await crypto.subtle.importKey('raw', u8(paket.epk), KURVE, false, [])
  const k = await dateiSchluessel(privat, epk, 'decrypt')
  return u8(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u8(paket.iv) }, k, u8(paket.daten)))
}

// ---------- Passkey (nur im Browser) ----------

/** Face ID, Touch ID oder Windows Hello vorhanden? */
export async function passkeyMoeglich() {
  try { return !!globalThis.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() } catch { return false }
}
/** Wie das Gerät die Sperre nennt. */
export function bioName() {
  const n = globalThis.navigator || {}
  if (/iPhone|iPad|iPod/.test(n.userAgent || '') || (/Macintosh/.test(n.userAgent || '') && n.maxTouchPoints > 1)) return 'Face ID'
  if (/Macintosh/.test(n.userAgent || '')) return 'Touch ID'
  return t('Gerätesperre')
}

/**
 * Passkey anlegen. MUSS direkt im Fingertipp aufgerufen werden (Safari verlangt das).
 * @returns { credId, prfSalz, prf (oder null), prfGeht }  prfGeht: der Passkey kann PRF, liefert es aber erst beim Anmelden
 */
export function passkeyAnlegen() {
  const prfSalz = zufall(32)
  return navigator.credentials.create({
    publicKey: {
      rp: { name: 'TravelBuddy' },
      user: { id: zufall(16), name: t('TravelBuddy Belege'), displayName: t('TravelBuddy Belege') },
      challenge: zufall(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
      attestation: 'none', timeout: 120000,
      extensions: { prf: { eval: { first: prfSalz } } },
    },
  }).then((c) => {
    const erw = c.getClientExtensionResults?.() || {}
    const first = erw.prf?.results?.first
    return { credId: u8(c.rawId), prfSalz, prf: first ? u8(first) : null, prfGeht: !!first || erw.prf?.enabled === true }
  })
}
/** PRF-Geheimnis holen: Face ID oder Touch ID. MUSS direkt im Fingertipp aufgerufen werden. */
export function passkeyPrf(credId, prfSalz) {
  return navigator.credentials.get({
    publicKey: {
      challenge: zufall(32), timeout: 120000, userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: u8(credId), transports: ['internal'] }],
      extensions: { prf: { eval: { first: u8(prfSalz) } } },
    },
  }).then((a) => {
    const first = a.getClientExtensionResults?.()?.prf?.results?.first
    if (!first) throw new Error(t('Dieses Gerät gibt kein Passkey-Geheimnis heraus.'))
    return u8(first)
  })
}

// ---------- Zustand ----------

const DB = 'wa-tresor', TOPF = 'kv', SCHLUESSEL = 'tresor-v1'
function db() {
  return new Promise((ok, nein) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(TOPF)) r.result.createObjectStore(TOPF) }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => nein(r.error)
  })
}
async function schreibe(wert) {
  const d = await db()
  await new Promise((ok, nein) => {
    const x = d.transaction(TOPF, 'readwrite')
    if (wert) x.objectStore(TOPF).put(wert, SCHLUESSEL); else x.objectStore(TOPF).delete(SCHLUESSEL)
    x.oncomplete = ok; x.onerror = () => nein(x.error); x.onabort = () => nein(x.error)
  })
}
async function lies() {
  const d = await db()
  return new Promise((ok, nein) => {
    const q = d.transaction(TOPF).objectStore(TOPF).get(SCHLUESSEL)
    q.onsuccess = () => ok(q.result || null); q.onerror = () => nein(q.error)
  })
}

let datensatz = null, privat = null, timer = null
/** { geladen, aktiv, passkey, entsperrt } */
export const tresor = writable({ geladen: false, aktiv: false, passkey: false, entsperrt: false })
const melde = () => tresor.set({ geladen: true, aktiv: !!datensatz, passkey: !!datensatz?.privPrf, entsperrt: !!privat })

let laden = null
export function ladeTresor() {
  if (!laden) laden = lies().catch(() => null).then((d) => { datensatz = d; melde(); return d })
  return laden
}
export const tresorAktiv = () => !!datensatz
export const istGesperrt = () => !!datensatz && !privat
export const oeffentlicherSchluessel = () => datensatz?.pub || null
/** Der private Schlüssel, solange entsperrt; jeder Zugriff verlängert die fünf Minuten. */
export function privaterSchluessel() { if (privat) verlaengere(); return privat }
function verlaengere() {
  clearTimeout(timer)
  timer = setTimeout(sperre, OFFEN_MS)
  timer?.unref?.()
}
function entsperrt(k) { privat = k; verlaengere(); melde() }
export function sperre() { clearTimeout(timer); privat = null; melde() }

/** Tresor anlegen und gleich entsperren. passkey = Ergebnis von passkeyAnlegen (optional), prf dazu. */
export async function richteEin({ code, passkey = null, prf = null, iterationen = ITERATIONEN }) {
  const { datensatz: d, privat: k } = await neuerTresor({ code, prf, credId: passkey?.credId, prfSalz: passkey?.prfSalz, iterationen })
  await schreibe(d)
  datensatz = d; laden = Promise.resolve(d)
  entsperrt(k)
  return d
}
export async function entsperreMitCode(code) {
  if (!datensatz) return false
  entsperrt(await oeffneMitCode(datensatz, code))
  return true
}
/** Face ID oder Touch ID. MUSS direkt im Fingertipp aufgerufen werden. */
export function entsperreMitPasskey() {
  if (!datensatz?.privPrf) return Promise.reject(new Error(t('Dieser Tresor hat keinen Passkey.')))
  return passkeyPrf(datensatz.credId, datensatz.prfSalz).then(async (prf) => { entsperrt(await oeffneMitPrf(datensatz, prf)); return true })
}
/** Tresor löschen. Vorher müssen die Belege entschlüsselt sein (belege.js), sonst sind sie verloren. */
export async function entferneTresor() {
  await schreibe(null)
  datensatz = null; laden = Promise.resolve(null)
  sperre()
}

// ---------- Entsperren vor dem Öffnen ----------
//
// Ablauf beim Antippen eines gesperrten Belegs: Face ID startet sofort (im selben Fingertipp),
// danach ein Knopf „Beleg öffnen“. Den braucht es, weil iOS ein neues Fenster nur direkt in einem
// Fingertipp öffnet, und der erste ist nach Face ID verbraucht. Klappt Face ID nicht: nochmal oder
// Notfall-Code. Die Oberfläche dazu ist TresorDialog.svelte.

/** { zustand: 'passkey' | 'wahl' | 'code' | 'bereit', fehler, danach, knopf, sofort } */
export const tresorAnfrage = writable(null)

/**
 * `danach` ausführen, sobald entsperrt ist. Direkt im Fingertipp aufrufen.
 * @param opt.knopf   Text des Knopfs nach dem Entsperren (Vorgabe „Beleg öffnen“)
 * @param opt.sofort  nach dem Entsperren ohne Knopf weitermachen (wenn danach kein Fenster aufgeht)
 */
export function entsperreDann(danach, { knopf = null, sofort = false } = {}) {
  if (!istGesperrt()) { danach(); return }
  tresorAnfrage.set({ zustand: datensatz.privPrf ? 'passkey' : 'code', fehler: '', danach, knopf: knopf || t('Beleg öffnen'), sofort })
  if (datensatz.privPrf) starteFaceId()
}
const aendere = (f) => tresorAnfrage.update((a) => (a ? { ...a, ...f } : a))
function fertig() {
  const a = get(tresorAnfrage)
  if (a?.sofort) { tresorAnfrage.set(null); a.danach() } else aendere({ zustand: 'bereit', fehler: '' })
}
/** Face ID (erneut) versuchen. Direkt im Fingertipp aufrufen. */
export function starteFaceId() {
  aendere({ zustand: 'passkey', fehler: '' })
  entsperreMitPasskey().then(fertig).catch((e) => {
    // Abgebrochen (NotAllowedError) ist kein Fehler, den man erklären muss
    aendere({ zustand: 'wahl', fehler: e?.name === 'NotAllowedError' ? '' : String(e?.message || e) })
  })
}
export async function codeEingeben(code) {
  try { await entsperreMitCode(code); fertig(); return true }
  catch (e) { aendere({ zustand: 'code', fehler: String(e?.message || e) }); return false }
}
/** Nach dem Entsperren: der Knopf „Beleg öffnen“ (ein neuer Fingertipp). */
export function weiter() {
  const a = get(tresorAnfrage)
  tresorAnfrage.set(null)
  a?.danach?.()
}
export const abbrechen = () => tresorAnfrage.set(null)
