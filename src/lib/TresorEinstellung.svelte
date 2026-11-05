<script>
  import { t, tn, je } from './i18n.js'
  // Belege mit Face ID oder Touch ID schützen (tresor.js): einrichten, Zustand, sperren, aufheben.
  // Einrichten: Notfall-Code zeigen, zur Kontrolle eintippen lassen, dann Passkey anlegen (Face ID
  // oder Touch ID), dann alle Belege auf dem Gerät verschlüsseln. Kann das Gerät keinen Passkey mit
  // Geheimnis (PRF), schützt nur der Code.
  import { onMount } from 'svelte'
  import { frage } from './dialog.js'
  import { zeigeToast } from './toast.js'
  import { klapp, dauer } from './motion.js'
  import {
    tresor, ladeTresor, erzeugeCode, normCode, passkeyMoeglich, passkeyAnlegen, passkeyPrf, richteEin, sperre,
    entsperreDann, entferneTresor, bioName, codeGueltig,
  } from './tresor.js'
  import { verschluesseleAlleBelege, entschluesseleAlleBelege, belegSchutz } from './belege.js'

  /** kontext 'dokumente': Texte für „Dokumente sperren“ (Reisevorbereitung → Dokumente). Derselbe Tresor. */
  let { anzahl = 0, kontext = 'belege' } = $props()   // anzahl: Belege auf diesem Gerät (zum Auffrischen der Zählung)
  const dok = kontext === 'dokumente'
  // V17: eigene PIN oder eigenes Passwort statt Notfall-Code (geht auch ohne Passkey, z. B. in der Mac-App)
  let art = $state('notfall')
  let eigen1 = $state(''), eigen2 = $state('')
  const eigenOk = $derived(codeGueltig(eigen1, art) && eigen1 === eigen2)
  const artName = (a) => (a === 'pin' ? je('PIN', 'PIN') : a === 'passwort' ? je('Passwort', 'password') : t('Notfall-Code'))
  function eigenStarten(a) { art = a; eigen1 = ''; eigen2 = ''; meldung = ''; schritt = 'eigen' }
  function eigenFertig() { if (!eigenOk) return; code = eigen1; fertigstellen(null, null) }

  const bio = bioName()
  let schritt = $state('zu')       // zu | code | bestaetigen | arbeit
  let code = $state('')
  let kontrolle = $state('')
  let passkey = $state.raw(null)    // Ergebnis von passkeyAnlegen, wenn PRF erst beim Anmelden kommt
  let mitPasskey = $state(false)
  let meldung = $state('')
  let arbeit = $state({ n: 0, von: 0, text: '' })
  let schutz = $state({ verschluesselt: 0, offen: 0 })

  const zaehle = async () => { schutz = await belegSchutz() }
  onMount(async () => {
    await ladeTresor()
    mitPasskey = await passkeyMoeglich()
    // Falls das Verschlüsseln einmal abgebrochen wurde: der Rest kommt jetzt dran
    if ($tresor.aktiv) await verschluesseleAlleBelege()
    zaehle()
  })
  $effect(() => { anzahl; $tresor.aktiv; zaehle() })

  function starten() {
    art = 'notfall'
    code = erzeugeCode()
    kontrolle = ''
    meldung = ''
    schritt = 'code'
  }
  const codeStimmt = $derived(normCode(kontrolle) === normCode(code))

  // Im Fingertipp: Safari erlaubt den Passkey nur direkt hier
  function weiter() {
    if (!codeStimmt) return
    meldung = ''
    if (!mitPasskey) return fertigstellen(null, null)
    passkeyAnlegen().then((pk) => {
      if (pk.prf) return fertigstellen(pk, pk.prf)
      if (pk.prfGeht) { passkey = pk; schritt = 'bestaetigen'; return }
      meldung = t('Dieses Gerät kann den Passkey nicht zum Verschlüsseln nutzen. Die Belege lassen sich trotzdem schützen, dann nur mit dem Notfall-Code.')
      mitPasskey = false
    }).catch((e) => { meldung = e?.name === 'NotAllowedError' ? t('Abgebrochen. Du kannst es gleich nochmal versuchen.') : t('Das hat nicht geklappt. ') + (e?.message || e) })
  }
  // Zweiter Fingertipp, wenn das Gerät das Geheimnis erst beim Anmelden herausgibt
  function bestaetigen() {
    passkeyPrf(passkey.credId, passkey.prfSalz).then((prf) => fertigstellen(passkey, prf))
      .catch((e) => { meldung = e?.name === 'NotAllowedError' ? t('Abgebrochen. Du kannst es gleich nochmal versuchen.') : String(e?.message || e) })
  }

  async function fertigstellen(pk, prf) {
    schritt = 'arbeit'
    arbeit = { n: 0, von: 0, text: t('Richte den Schutz ein …') }
    try {
      await richteEin({ code, codeArt: art, passkey: pk, prf })
      code = ''; kontrolle = ''; passkey = null; eigen1 = ''; eigen2 = ''
      arbeit = { n: 0, von: 0, text: t('Verschlüssele die Belege …') }
      const r = await verschluesseleAlleBelege((n, von) => (arbeit = { n, von, text: t('Verschlüssele die Belege …') }))
      zeigeToast(prf ? t('🔒 Geschützt: Belege öffnen sich nur noch mit {bio} oder dem Notfall-Code.', { bio })
        : art === 'pin' ? je('🔒 Geschützt: Dokumente und Belege öffnen sich nur noch mit deiner PIN.', '🔒 Protected: documents and vouchers now only open with your PIN.')
        : art === 'passwort' ? je('🔒 Geschützt: Dokumente und Belege öffnen sich nur noch mit deinem Passwort.', '🔒 Protected: documents and vouchers now only open with your password.')
        : t('🔒 Geschützt: Belege öffnen sich nur noch mit dem Notfall-Code.'), 'ok', 5000)
      schritt = 'zu'
      if (!r.verschluesselt && !anzahl) meldung = t('Neue Belege werden ab jetzt verschlüsselt abgelegt.')
    } catch (e) {
      meldung = t('Das hat nicht geklappt. ') + (e?.message || e)
      schritt = 'zu'
    }
    zaehle()
  }

  function aufhebenStarten() {
    entsperreDann(aufheben, { sofort: true })
  }
  async function aufheben() {
    if (!(await frage({ titel: t('Schutz aufheben?'), text: $tresor.passkey ? t('Die Belege liegen danach wieder unverschlüsselt auf diesem Gerät. Den Passkey „TravelBuddy Belege“ kannst du danach in der App „Passwörter“ löschen.') : t('Die Belege liegen danach wieder unverschlüsselt auf diesem Gerät.'), ja: t('Aufheben'), gefahr: true }))) return
    schritt = 'arbeit'
    arbeit = { n: 0, von: schutz.verschluesselt, text: t('Entschlüssele die Belege …') }
    try {
      await entschluesseleAlleBelege((n) => (arbeit = { ...arbeit, n }))
      await entferneTresor()
      zeigeToast(t('Schutz aufgehoben.'), 'ok')
    } catch (e) { meldung = t('Das hat nicht geklappt. ') + (e?.message || e) }
    schritt = 'zu'
    zaehle()
  }
</script>

<div class="ts">
  {#if $tresor.aktiv}
    <div class="ts-kopf">
      <span class="ts-titel">{$tresor.entsperrt ? '🔓' : '🔒'} {$tresor.passkey ? t('Geschützt mit {bio}', { bio }) : $tresor.codeArt === 'pin' ? je('Geschützt mit PIN', 'Protected with PIN') : $tresor.codeArt === 'passwort' ? je('Geschützt mit Passwort', 'Protected with password') : t('Geschützt mit Notfall-Code')}</span>
      <span class="ts-zahl">{dok ? (schutz.verschluesselt === 1 ? je('1 Datei verschlüsselt', '1 file encrypted') : je(`${schutz.verschluesselt} Dateien verschlüsselt`, `${schutz.verschluesselt} files encrypted`)) : tn(schutz.verschluesselt, '{n} Beleg verschlüsselt', '{n} Belege verschlüsselt')}{#if $tresor.entsperrt}{' · '}{t('gerade offen')}{/if}</span>
    </div>
    {#if schritt === 'arbeit'}
      <p class="ts-status" aria-live="polite">{arbeit.text}{#if arbeit.von} {t('{n} von {von}', { n: arbeit.n, von: arbeit.von })}{/if}</p>
    {:else}
      <div class="ts-akt">
        {#if $tresor.entsperrt}<button class="btn" onclick={sperre}>{t('Jetzt sperren')}</button>{/if}
        <button class="btn btn-ghost" onclick={aufhebenStarten}>{t('Schutz aufheben')}</button>
      </div>
    {/if}
  {:else if schritt === 'zu'}
    <div class="ts-kopf"><span class="ts-titel">{dok ? je('🔒 Dokumente sperren', '🔒 Lock documents') : t('🔒 Belege schützen')}</span></div>
    <p class="ts-k">{dok
      ? je('Deine Dokumente und Belege öffnen sich dann nur nach Entsperren, auch ohne Netz. Die Dateien liegen verschlüsselt auf diesem Gerät.', 'Your documents and vouchers then only open after unlocking, even without signal. The files are stored encrypted on this device.')
      : mitPasskey
      ? t('Tickets, Pass und Visum öffnen sich dann nur nach {bio}, auch ohne Netz. Die Belege liegen verschlüsselt auf diesem Gerät.', { bio })
      : t('Tickets, Pass und Visum öffnen sich dann nur mit deinem Notfall-Code. Die Belege liegen verschlüsselt auf diesem Gerät.')}</p>
    <div class="ts-akt">
      {#if mitPasskey}<button class="btn" onclick={starten}>{t('Mit {bio} schützen', { bio })}</button>{/if}
      <button class="btn" onclick={() => eigenStarten('pin')}>{je('Mit PIN', 'With PIN')}</button>
      <button class="btn" onclick={() => eigenStarten('passwort')}>{je('Mit Passwort', 'With password')}</button>
      {#if !mitPasskey}<button class="btn btn-ghost" onclick={starten}>{t('Mit Notfall-Code schützen')}</button>{/if}
    </div>
  {:else if schritt === 'eigen'}
    <form class="ts-panel" onsubmit={(e) => { e.preventDefault(); eigenFertig() }} transition:klapp={{ duration: dauer(220) }}>
      <span class="ts-titel">{art === 'pin' ? je('Eigene PIN', 'Your own PIN') : je('Eigenes Passwort', 'Your own password')}</span>
      <p class="ts-k">{art === 'pin'
        ? je('6 bis 12 Ziffern. Merk sie dir gut: ohne PIN sind die Dateien nicht mehr lesbar. Ein Passwort ist sicherer als eine PIN.', '6 to 12 digits. Remember it well: without the PIN the files can no longer be read. A password is safer than a PIN.')
        : je('Mindestens 8 Zeichen. Merk es dir gut: ohne Passwort sind die Dateien nicht mehr lesbar.', 'At least 8 characters. Remember it well: without the password the files can no longer be read.')}</p>
      <label class="ts-feld">{artName(art)}
        <input type="password" bind:value={eigen1} autocomplete="new-password" inputmode={art === 'pin' ? 'numeric' : 'text'} autocapitalize="off" spellcheck="false" />
      </label>
      <label class="ts-feld">{je('Noch einmal', 'Once more')}
        <input type="password" bind:value={eigen2} autocomplete="new-password" inputmode={art === 'pin' ? 'numeric' : 'text'} autocapitalize="off" spellcheck="false" />
      </label>
      {#if eigen2 && eigen1 !== eigen2}<p class="ts-k">{je('Die beiden Eingaben sind nicht gleich.', 'The two entries do not match.')}</p>{/if}
      <div class="ts-akt">
        <button type="button" class="btn btn-ghost" onclick={() => (schritt = 'zu')}>{t('Abbrechen')}</button>
        <button type="submit" class="btn" disabled={!eigenOk}>{je('Sperren', 'Lock')}</button>
      </div>
    </form>
  {:else if schritt === 'code' || schritt === 'bestaetigen'}
    <div class="ts-panel" transition:klapp={{ duration: dauer(220) }}>
      {#if schritt === 'code'}
        <span class="ts-titel">{t('Dein Notfall-Code')}</span>
        <p class="ts-code" aria-label={t('Notfall-Code')}>{code}</p>
        <p class="ts-k"><b>{t('Schreib ihn auf Papier und nimm ihn mit.')}</b> {mitPasskey
          ? t('Mit ihm öffnest du die Belege, wenn {bio} einmal nicht geht. Ohne Code und ohne {bio} sind sie nicht mehr lesbar; dann lädst du sie aus iCloud neu.', { bio })
          : t('Mit ihm öffnest du die Belege. Ohne Code sind sie nicht mehr lesbar; dann lädst du sie aus iCloud neu.')}</p>
        <label class="ts-feld">{t('Zur Kontrolle eintippen')}
          <input bind:value={kontrolle} autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" />
        </label>
        <div class="ts-akt">
          <button class="btn btn-ghost" onclick={() => (schritt = 'zu')}>{t('Abbrechen')}</button>
          <button class="btn" onclick={weiter} disabled={!codeStimmt}>{mitPasskey ? t('Weiter mit {bio}', { bio }) : t('Schützen')}</button>
        </div>
      {:else}
        <span class="ts-titel">{t('Fast fertig')}</span>
        <p class="ts-k">{t('Der Passkey ist angelegt. Bestätige noch einmal mit {bio}, dann werden die Belege verschlüsselt.', { bio })}</p>
        <div class="ts-akt"><button class="btn" onclick={bestaetigen}>{t('Mit {bio} bestätigen', { bio })}</button></div>
      {/if}
    </div>
  {:else}
    <p class="ts-status" aria-live="polite">{arbeit.text}{#if arbeit.von} {t('{n} von {von}', { n: arbeit.n, von: arbeit.von })}{/if}</p>
  {/if}
  {#if meldung}<p class="ts-meldung" role="status">{meldung}</p>{/if}
</div>

<style>
  .ts { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--line); }
  .ts-kopf { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 10px; }
  .ts-titel { font-size: calc(13.5px * var(--schrift, 1)); font-weight: 800; color: var(--ink); }
  .ts-zahl { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--ok-text); }
  .ts-k { margin: 0; font-size: calc(12px * var(--schrift, 1)); line-height: 1.5; color: var(--muted); }
  .ts-akt { display: flex; flex-wrap: wrap; gap: 8px; }
  .ts-panel { display: flex; flex-direction: column; gap: 8px; background: var(--flaeche); border-radius: var(--radius-s); padding: 10px 12px; }
  .ts-code { margin: 0; font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: calc(clamp(18px, 5.4vw, 24px) * var(--schrift, 1)); font-weight: 800; letter-spacing: 1px; color: var(--ink); user-select: all; overflow-wrap: anywhere; }
  .ts-feld { display: flex; flex-direction: column; gap: 4px; font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .ts-feld input { min-height: 44px; font-size: max(16px, calc(16px * var(--schrift, 1))); letter-spacing: 1px; font-family: ui-monospace, 'SF Mono', Menlo, monospace; padding: 6px 10px; border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); }
  .ts-status { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .ts-meldung { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--ink); background: var(--flaeche); border-radius: var(--radius-s); padding: 8px 10px; }
</style>
