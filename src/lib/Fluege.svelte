<script>
  // Mehr → Flüge & Bahn: alle Fahrten der Reise mit Status, was noch fehlt, Kontingent und Schlüssel.
  // Jeder Termin mit Flug- oder Zugnummer erscheint hier von selbst, auch aus Route und Vorabausgaben.
  import { t } from './i18n.js'
  import { mitWochentag } from './format.js'
  import { buchungen, vorabKosten, updateVorabKosten } from './userdata.js'
  import { fluege, flugspeicher, fluglauf, uhr, hatSchluessel, setzeSchluessel, jetztAbfragen, FEHLER } from './flug-dienst.js'
  import { KONTINGENT, genutzt, umstiege, landungMs, abflugMs, offeneVorab, verkehrOk, nummernImText, zugnummernImText } from './flug.js'
  import { speichereVerkehr, angabenAus, leereAngaben } from './verkehr.js'
  import { zeigeToast } from './toast.js'
  import FlugKarte from './FlugKarte.svelte'
  import VerkehrFormular from './VerkehrFormular.svelte'

  const STUNDE = 3600e3
  const staende = $derived($flugspeicher.staende)
  const anstehend = $derived($fluege.alle.filter((f) => (landungMs(staende[f.id]) ?? abflugMs(f, staende[f.id], staende) + 3 * STUNDE) + 24 * STUNDE > $uhr))
  const umstiegVon = $derived(Object.fromEntries(umstiege($fluege.fluege, staende).map((u) => [u.nachFlug, u])))
  const unbekannt = $derived(anstehend.filter((f) => f.art === 'flug' && staende[f.id]?.leer))
  const vorab = $derived(offeneVorab($vorabKosten, $fluege.alle))
  const rest = $derived(KONTINGENT - genutzt($flugspeicher.zaehler, $uhr))
  const kannAktualisieren = $derived($hatSchluessel || $fluege.zuege.length > 0)

  let schluesselFeld = $state('')
  let aendern = $state(false)
  function schluesselSichern() {
    if (!schluesselFeld.trim()) return
    setzeSchluessel(schluesselFeld)
    schluesselFeld = ''; aendern = false
    zeigeToast(t('Schlüssel gespeichert'), 'ok')
  }

  // Ein Formular zur Zeit: neue Fahrt, fehlende Angaben oder Vorabausgabe
  let form = $state(null)   // { stelle, art, id, titel, vorabId }
  let angaben = $state(leereAngaben())
  let datei = $state(null)
  function oeffne(stelle, art, werte, weiteres = {}) { form = { stelle, art, ...weiteres }; angaben = werte; datei = null }
  const artVonTermin = (e) => (e.kat === 'train' ? 'bahn' : 'flug')
  function ergaenze(f) {
    const e = ($buchungen?.events || []).find((x) => x.id === f.terminId)
    oeffne(f.id, f.art, angabenAus(e), { id: f.terminId, titel: f.titel })
  }
  async function sichern() {
    const id = await speichereVerkehr(form.art, angaben, { id: form.id, titel: form.titel, datei })
    if (form.vorabId) updateVorabKosten(form.vorabId, { terminId: id })
    zeigeToast(form.art === 'flug' ? t('Flug gespeichert ✓') : t('Zug gespeichert ✓'), 'ok')
    form = null
  }
</script>

{#snippet formular()}
  <VerkehrFormular art={form.art} bind:angaben bind:datei />
  <div class="fl-reihe">
    <button class="btn-primary" disabled={!verkehrOk(form.art, angaben)} onclick={sichern}>{t('Speichern')}</button>
    <button class="btn" onclick={() => (form = null)}>{t('Abbrechen')}</button>
  </div>
{/snippet}

<section class="fl" aria-label={t('Flüge & Bahn')}>
  <div class="fl-karte">
    <button class="btn-primary" disabled={!kannAktualisieren || $fluglauf.laden} onclick={() => jetztAbfragen()}>{$fluglauf.laden ? t('Wird aktualisiert …') : t('Jetzt aktualisieren')}</button>
    {#if $hatSchluessel}
      <p class="fl-klein">{t('Noch etwa {rest} von {gesamt} Flugabfragen in diesem Monat. Die App fragt selbst ab, solange sie offen ist.', { rest, gesamt: KONTINGENT })}</p>
      {#if !aendern}<button class="fl-leise" onclick={() => (aendern = true)}>{t('Schlüssel ändern')}</button>{/if}
    {:else}
      <p class="fl-klein">{t('Für Flüge fehlt auf diesem Gerät noch dein Schlüssel. Züge brauchen keinen.')}</p>
    {/if}
    {#if $fluglauf.fehler}<p class="fl-fehler" role="alert">{FEHLER[$fluglauf.fehler]?.()}</p>{/if}
  </div>

  {#if !$hatSchluessel || aendern}
    <form class="fl-karte" onsubmit={(e) => { e.preventDefault(); schluesselSichern() }}>
      <h2>{t('Flugabfrage einrichten')}</h2>
      <p>{t('Trag einmal deinen Schlüssel von RapidAPI ein. Er bleibt nur auf diesem Gerät und kommt nicht ins Backup. Abgefragt werden nur Flugnummer und Datum.')}</p>
      <a href="https://rapidapi.com/aedbx-aedbx/api/aerodatabox/pricing" target="_blank" rel="noopener">{t('Kostenlosen Schlüssel holen (Tarif Basic)')}</a>
      <input class="fl-eingabe" type="password" autocomplete="off" aria-label={t('Schlüssel von RapidAPI')} placeholder={t('Schlüssel von RapidAPI')} bind:value={schluesselFeld} />
      <button class="btn-primary" type="submit" disabled={!schluesselFeld.trim()}>{t('Schlüssel speichern')}</button>
    </form>
  {/if}

  {#if $fluege.ohneNummer.length || unbekannt.length || vorab.length}
    <div class="fl-karte fl-fehlt">
      <h2>{t('Hier fehlt noch etwas')}</h2>
      {#each $fluege.ohneNummer as e (e.id)}
        {@const art = artVonTermin(e)}
        <div class="fl-zeile">
          <span><b>{e.titel}</b><small>{mitWochentag(e.datum)} · {art === 'flug' ? t('Flugnummer fehlt') : t('Zugnummer fehlt')}</small></span>
          <button class="fl-knopf" onclick={() => oeffne('t' + e.id, art, angabenAus(e), { id: e.id, titel: e.titel })}>{t('Ergänzen')}</button>
        </div>
        {#if form?.stelle === 't' + e.id}{@render formular()}{/if}
      {/each}
      {#each vorab as k (k.id)}
        <div class="fl-zeile">
          <span><b>{k.text || t('Ausgabe ohne Text')}</b><small>{t('Aus den Vorabausgaben')}</small></span>
          <button class="fl-knopf" onclick={() => oeffne('v' + k.id, k.art, leereAngaben({ nr: nummernImText(k.text)[0] || zugnummernImText(k.text)[0] || '' }), { titel: k.text, vorabId: k.id })}>{t('Ergänzen')}</button>
          <button class="fl-knopf" onclick={() => updateVorabKosten(k.id, { keinTermin: true })}>{t('Schon im Kalender')}</button>
        </div>
        {#if form?.stelle === 'v' + k.id}{@render formular()}{/if}
      {/each}
      {#each unbekannt as f (f.id)}
        <p class="fl-klein"><b>{f.nr}</b> · {t('Beim Dienst für diesen Tag nicht gefunden. Prüfe Nummer und Datum oder warte auf den neuen Flugplan.')}</p>
      {/each}
    </div>
  {/if}

  {#each anstehend as f (f.id)}
    <FlugKarte flug={f} stand={staende[f.id]} {staende} jetzt={$uhr} umstieg={umstiegVon[f.id]} onabfragen={f.art === 'bahn' || $hatSchluessel ? jetztAbfragen : null} onaendern={f.anschlussVon ? null : ergaenze} laden={$fluglauf.laden} />
    {#if form?.stelle === f.id}<div class="fl-karte">{@render formular()}</div>{/if}
  {:else}
    <p class="fl-klein">{t('Noch keine Fahrten. Füge eine Buchung ein oder trag hier eine ein.')}</p>
  {/each}

  <div class="fl-karte">
    <h2>{t('Flug oder Zug hinzufügen')}</h2>
    {#if form?.stelle === 'neu'}
      <div class="segment" role="group" aria-label={t('Verkehrsmittel')}>
        <button class:an={form.art === 'flug'} aria-pressed={form.art === 'flug'} onclick={() => (form.art = 'flug')}>{t('✈️ Flug')}</button>
        <button class:an={form.art === 'bahn'} aria-pressed={form.art === 'bahn'} onclick={() => (form.art = 'bahn')}>{t('🚆 Bahn')}</button>
      </div>
      {@render formular()}
    {:else}
      <button class="btn" onclick={() => oeffne('neu', 'flug', leereAngaben())}>{t('Neue Fahrt eintragen')}</button>
    {/if}
    <p class="fl-klein">{t('Auch Fahrten aus Route, Etappe, „Buchung einfügen“, Vorabausgaben und dem Kalender werden automatisch abgefragt.')}</p>
  </div>

  <p class="fl-klein fl-quelle">{t('Flugdaten:')} <a href="https://aerodatabox.com" target="_blank" rel="noopener">AeroDataBox</a>. {t('Bahndaten:')} <a href="https://dbf.finalrewind.org" target="_blank" rel="noopener">DBF</a>, {t('nur Deutschland.')} {t('Gate und Schalter kommen nicht von jedem Flughafen.')}</p>
</section>

<style>
  .fl { display: flex; flex-direction: column; gap: 12px; }
  .fl-karte { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 8px; }
  .fl-karte h2 { margin: 0; font-size: calc(16px * var(--schrift, 1)); }
  .fl-karte p { margin: 0; }
  .fl-klein { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .fl-fehler { color: var(--danger-text); font-weight: 700; font-size: calc(13.5px * var(--schrift, 1)); }
  .fl-fehlt { border-color: var(--danger-linie); background: var(--warn-flaeche); }
  .fl-fehlt, .fl-fehlt .fl-klein { color: var(--warn-text); }
  .fl-leise { align-self: flex-start; min-height: 36px; padding: 0; border: none; background: none; color: var(--brand-text); font-size: calc(13px * var(--schrift, 1)); font-weight: 700; cursor: pointer; }
  .fl-eingabe { font-size: max(16px, calc(14px * var(--schrift, 1))); min-height: 44px; padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); min-width: 0; box-sizing: border-box; width: 100%; }
  .fl-reihe { display: flex; gap: 8px; }
  .fl-zeile { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .fl-zeile span { display: flex; flex-direction: column; min-width: 0; flex: 1 1 160px; }
  .fl-zeile small { font-size: calc(12.5px * var(--schrift, 1)); }
  .fl-knopf { min-height: 44px; padding: 0 12px; border-radius: var(--radius-s); border: 1px solid var(--line-stark); background: var(--card); color: var(--btn-ink); font-weight: 700; cursor: pointer; }
  .fl-knopf:disabled { opacity: 0.5; cursor: default; }
  .fl-quelle { text-align: center; }
</style>
