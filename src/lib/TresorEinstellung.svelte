<script>
  import { t, tn } from './i18n.js'
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
    entsperreDann, entferneTresor, bioName,
  } from './tresor.js'
  import { verschluesseleAlleBelege, entschluesseleAlleBelege, belegSchutz } from './belege.js'

  let { anzahl = 0 } = $props()   // Belege auf diesem Gerät (zum Auffrischen der Zählung)

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
      await richteEin({ code, passkey: pk, prf })
      code = ''; kontrolle = ''; passkey = null
      arbeit = { n: 0, von: 0, text: t('Verschlüssele die Belege …') }
      const r = await verschluesseleAlleBelege((n, von) => (arbeit = { n, von, text: t('Verschlüssele die Belege …') }))
      zeigeToast(prf ? t('🔒 Geschützt: Belege öffnen sich nur noch mit {bio} oder dem Notfall-Code.', { bio }) : t('🔒 Geschützt: Belege öffnen sich nur noch mit dem Notfall-Code.'), 'ok', 5000)
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
      <span class="ts-titel">{$tresor.entsperrt ? '🔓' : '🔒'} {$tresor.passkey ? t('Geschützt mit {bio}', { bio }) : t('Geschützt mit Notfall-Code')}</span>
      <span class="ts-zahl">{tn(schutz.verschluesselt, '{n} Beleg verschlüsselt', '{n} Belege verschlüsselt')}{#if $tresor.entsperrt} · {t('gerade offen')}{/if}</span>
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
    <div class="ts-kopf"><span class="ts-titel">{t('🔒 Belege schützen')}</span></div>
    <p class="ts-k">{mitPasskey
      ? t('Tickets, Pass und Visum öffnen sich dann nur nach {bio}, auch ohne Netz. Die Belege liegen verschlüsselt auf diesem Gerät.', { bio })
      : t('Tickets, Pass und Visum öffnen sich dann nur mit deinem Notfall-Code. Die Belege liegen verschlüsselt auf diesem Gerät.')}</p>
    <div class="ts-akt"><button class="btn" onclick={starten}>{mitPasskey ? t('Mit {bio} schützen', { bio }) : t('Mit Notfall-Code schützen')}</button></div>
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
