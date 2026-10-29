<script>
  import { t, LOCALE, tn } from '../i18n.js'
  import { ZWEI } from '../format.js'
  // Musik unterwegs (Mehr → Musik): neue Titel, Playlist, Einrichtung, Standort, Protokoll.
  import { onDestroy } from 'svelte'
  import { musik, musikCfg, aendere } from './speicher.js'
  import { neueTitel, alleGesehen, standortVergessen, eigeneUris } from './zustand.js'
  import { EBENE_TEXT, ART_TEXT, QUELLEN } from './quellen.js'
  import { anmelden, istVerbunden, trennen, playlistIdAus, rueckAdresseFuer, aktuelleUmgebung } from './spotify.js'
  import { position, nachholen, playlistVerbinden, vonVorneAnfangen } from './dienst.js'
  import { frage } from '../dialog.js'
  import { zeigeToast } from '../toast.js'
  import { online } from '../netz.js'
  import { dauer, klapp } from '../motion.js'

  let { orte = [] } = $props()

  const neu = $derived(neueTitel($musik))
  const alle = $derived(Object.values($musik.titel || {}).filter((t) => t.status === 'hinzugefuegt').sort((a, b) => (b.hinzugefuegt || '').localeCompare(a.hinzugefuegt || '')))
  const probleme = $derived(Object.values($musik.titel || {}).filter((t) => t.status === 'fehler'))
  const nachRegion = $derived.by(() => {
    const m = new Map()
    for (const ti of alle) { const k = ti.regionName || t('ohne Ort'); if (!m.has(k)) m.set(k, []); m.get(k).push(ti) }
    return [...m.entries()]
  })
  let verbunden = $state(istVerbunden())
  $effect(() => { $musik; verbunden = istVerbunden() })   // nach Anmeldung oder Trennen neu prüfen
  let plLink = $state('')
  let plLaeuft = $state(false)
  let einrichtungAuf = $state(!istVerbunden())
  let protokollAuf = $state(false)
  let alleAuf = $state(false)
  let handOrt = $state('')
  const rueckAdresse = rueckAdresseFuer()
  const umg = aktuelleUmgebung()
  const lokal = umg.lokal
  const kannTeilen = typeof navigator !== 'undefined' && !!navigator.share
  async function adresseKopieren() {
    try { await navigator.clipboard.writeText(rueckAdresse); zeigeToast(t('Adresse kopiert'), 'ok') }
    catch { zeigeToast(t('Kopieren nicht möglich, bitte markieren'), 'info') }
  }
  // Vom iPhone an den Mac schicken (AirDrop, Notizen, Mail), wo das Spotify-Dashboard bequemer geht
  async function adresseTeilen() {
    try { await navigator.share({ title: t('Redirect URI für Spotify'), text: rueckAdresse }) } catch {}
  }
  const datum = (iso) => { try { return new Date(iso).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: ZWEI, minute: '2-digit' }) } catch { return '' } }

  // Wer die Seite mit neuen Titeln gesehen hat, hat sie gesehen: beim Verlassen zurücksetzen
  let warNeu = false
  $effect(() => { if (neu.length) warNeu = true })
  onDestroy(() => { if (warNeu) aendere(alleGesehen) })

  const setze = (patch) => musikCfg.update((c) => ({ ...c, ...patch }))
  const setzeQuelle = (id, an) => musikCfg.update((c) => ({ ...c, quellen: { ...c.quellen, [id]: an } }))

  async function verbinden() {
    if (!$musikCfg.spotifyClientId.trim()) { zeigeToast(t('Erst die Client-ID eintragen'), 'info'); return }
    try { await anmelden({ clientId: $musikCfg.spotifyClientId.trim(), redirectUri: rueckAdresse }) }
    catch (e) { zeigeToast(t('Anmeldung: ') + e.message, 'fehler') }
  }
  async function abmelden() {
    if (await frage({ titel: t('Spotify trennen?'), text: t('Die Playlist bleibt bei Spotify bestehen. Neue Titel kommen erst wieder dazu, wenn du dich erneut verbindest.'), ja: t('Trennen'), gefahr: true })) {
      trennen(); verbunden = false
      aendere((z) => ({ ...z, playlist: null }))
    }
  }
  async function playlistSetzen() {
    const link = plLink.trim()
    if (link && !playlistIdAus(link)) { zeigeToast(t('Das ist kein Playlist-Link'), 'info'); return }
    plLaeuft = true
    try { const { playlist } = await playlistVerbinden({ linkOderId: link || undefined }); plLink = ''; zeigeToast(t('Playlist „{name}“ verknüpft', { name: playlist.name }), 'ok') }
    catch (e) { zeigeToast(e.message, 'fehler') }
    finally { plLaeuft = false }
  }
  async function einschalten(an) {
    if (an && !(await frage({ titel: t('Musik unterwegs einschalten?'), text: t('Die App fragt dann nach deinem Standort und sucht bei jedem neuen Ort (ab 10 km und 30 min) Musik aus der Gegend. Das geht nur, solange die App offen ist.'), ja: t('Einschalten') }))) return
    setze({ aktiv: an })
  }
  let ortet = $state(false)
  function meldeErgebnis(r) {
    if (!r) { zeigeToast(t('Suche läuft schon'), 'info'); return }
    const was = r.status === 'ok' ? t('{n} Titel in „{name}“', { n: r.hinzugefuegt.length, name: $musik.playlist?.name || t('die Playlist') })
      : r.status === 'ohne-spotify' ? t('Spotify ist nicht verbunden')
      : r.status === 'keine-daten' ? t('keine Musikdaten für diese Gegend')
      : r.status === 'nichts-neues' ? t('nichts Neues') : t('siehe Protokoll')
    zeigeToast(r.region ? `${r.region.name}: ${was}` : t('Kein neuer Ort'), r.status === 'ok' ? 'ok' : 'info')
  }
  /** Jetzt, an diesem Ort: einmal orten und sofort suchen (auch ohne „eingeschaltet“). */
  function hierUndJetzt() {
    if (!navigator.geolocation) { zeigeToast(t('Dieses Gerät kann den Standort nicht bestimmen'), 'info'); return }
    ortet = true
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try { meldeErgebnis(await position({ lat: pos.coords.latitude, lon: pos.coords.longitude, zeit: Date.now() }, { vonHand: true })) }
      finally { ortet = false }
    }, (e) => {
      ortet = false
      zeigeToast(e.code === 1 ? t('Standort nicht freigegeben. Erlauben in den Einstellungen unter Safari → Standort.') : t('Standort gerade nicht bestimmbar'), 'info')
    }, { enableHighAccuracy: false, maximumAge: 120000, timeout: 20000 })
  }
  async function vonHand() {
    const o = orte.find((x) => x.id === handOrt)
    if (!o) return
    meldeErgebnis(await position({ lat: o.lat, lon: o.lon, zeit: Date.now() }, { vonHand: true }))
  }
  async function vergessen() {
    if (await frage({ titel: t('Standortverlauf löschen?'), text: t('Gelöscht werden der letzte Ort, die besuchten Regionen und der Ortsbezug der Titel. Die Titel bleiben in der Playlist.'), ja: t('Löschen'), gefahr: true })) {
      aendere(standortVergessen); zeigeToast(t('Standortverlauf gelöscht'), 'ok')
    }
  }
  let zurueckLaeuft = $state(false)
  async function vonVorne() {
    const n = eigeneUris($musik).length
    const name = $musik.playlist?.name || $musikCfg.playlistName || t('Playlist')
    if (!(await frage({ titel: t('Von vorne anfangen?'), text: t('Die App vergisst alle gesammelten Titel, Orte und das Protokoll. Spotify-Anmeldung, Playlist und Einstellungen bleiben.'), ja: t('Zurücksetzen'), gefahr: true }))) return
    let raus = false
    if (n) raus = await frage({ titel: t('{n} Titel aus „{name}“ nehmen?', { n, name }), text: t('Diese {n} Titel hat TravelBuddy eingetragen. Bleiben sie drin, gelten sie als vorhanden und kommen nicht noch einmal dazu. Titel, die du selbst hinzugefügt hast, bleiben auf jeden Fall.', { n }), ja: t('Herausnehmen'), nein: t('Drinlassen'), gefahr: true })
    zurueckLaeuft = true
    try {
      const { entfernt } = await vonVorneAnfangen({ ausPlaylist: raus })
      zeigeToast(entfernt ? t('Zurückgesetzt, {n} Titel aus der Playlist genommen', { n: entfernt }) : t('Zurückgesetzt'), 'ok')
    } catch (e) { zeigeToast(t('Nicht zurückgesetzt: ') + (e.message || e), 'fehler') }
    finally { zurueckLaeuft = false }
  }
  const mitKoord = $derived(orte.filter((o) => o.lat != null && o.lon != null).sort((a, b) => a.name.localeCompare(b.name, LOCALE)))
</script>

<div class="mu">
  <header class="mu-kopf">
    <span class="mu-note" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M9 17.5a2.5 2.5 0 1 1-2.5-2.5c.53 0 1 .16 1.4.43V6.2l10-2.2v11.5a2.5 2.5 0 1 1-2.5-2.5c.53 0 1 .16 1.4.43V7.3L10 8.9v8.6Z" fill="currentColor" /></svg></span>
    <div class="mu-titel">
      <h2>{$musikCfg.playlistName}</h2>
      <p>{tn(alle.length, '{n} Titel unterwegs gesammelt · {wert2} · {wert3}', '{n} Titel unterwegs gesammelt · {wert2} · {wert3}', { wert2: verbunden ? t('mit Spotify verbunden') : t('Spotify nicht verbunden'), wert3: $musikCfg.aktiv ? t('läuft') : t('aus') })}</p>
    </div>
    {#if $musik.playlist?.url}<a class="btn mu-auf" href={$musik.playlist.url} target="_blank" rel="noopener">{t('In Spotify öffnen')}</a>{/if}
  </header>

  {#if neu.length}
    <section class="mu-block mu-neu" aria-live="polite">
      <h3>{tn(neu.length, '{n} neue Titel aus deiner Gegend', '{n} neue Titel aus deiner Gegend')}</h3>
      <ul class="mu-liste">
        {#each neu as song (song.spotifyId)}
          <li>
            <span class="mu-t"><b>{song.titel}</b><small>{song.kuenstler}</small></span>
            <span class="mu-wo"><small>{song.gebiet && song.gebiet !== song.regionName ? song.gebiet : (song.regionName || t('ohne Ort'))}</small><small class="mu-ebene">{EBENE_TEXT[song.ebene] || song.ebene}{song.art ? ' · ' + (ART_TEXT[song.art] || '') : ''}{song.stil ? ' · ' + song.stil : ''}</small></span>
            {#if song.url}<a class="mu-link" href={song.url} target="_blank" rel="noopener" aria-label={t('{titel} in Spotify öffnen', { titel: song.titel })}>↗</a>{/if}
          </li>
        {/each}
      </ul>
      <button class="btn" onclick={() => aendere(alleGesehen)}>{t('Gesehen')}</button>
    </section>
  {:else}
    <p class="mu-hinweis">{t('Keine neuen Titel. Sobald Spotify einen Titel aus deiner aktuellen Gegend in die Playlist übernommen hat, erscheint er hier und am Symbol oben.')}</p>
  {/if}

  {#if alle.length}
    <section class="mu-block">
      <button class="mu-auf-zu" aria-expanded={alleAuf} onclick={() => (alleAuf = !alleAuf)}><span class="aufklapp klein" class:offen={alleAuf} aria-hidden="true"></span>{t('Alle Titel nach Ort ({length})', { length: alle.length })}</button>
      {#if alleAuf}
        <div transition:klapp={{ duration: dauer(220) }}>
          {#each nachRegion as [name, liste] (name)}
            <h4 class="mu-ort">{name}</h4>
            <ul class="mu-liste klein">{#each liste as t (t.spotifyId)}<li><span class="mu-t"><b>{t.titel}</b><small>{t.kuenstler} · {datum(t.hinzugefuegt)}</small></span></li>{/each}</ul>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if probleme.length}
    <p class="mu-warn">{tn(probleme.length, '{n} Titel konnte nicht hinzugefügt werden. Details im Protokoll.', '{n} Titel konnten nicht hinzugefügt werden. Details im Protokoll.')}</p>
  {/if}

  <section class="mu-block">
    <button class="mu-auf-zu" aria-expanded={einrichtungAuf} onclick={() => (einrichtungAuf = !einrichtungAuf)}><span class="aufklapp klein" class:offen={einrichtungAuf} aria-hidden="true"></span>{t('Einrichtung und Einstellungen')}</button>
    {#if einrichtungAuf}
      <div class="mu-einr" transition:klapp={{ duration: dauer(220) }}>
        {#if umg.iosSafari && !verbunden}
          <p class="mu-stand">{t('Du bist gerade in Safari. Verbinde Spotify in TravelBuddy vom Home-Bildschirm. Safari und die App haben getrennte Speicher, die Anmeldung gilt nur dort, wo du sie machst.')}</p>
        {/if}
        <ol class="mu-schritte">
          <li>{t('In deiner Spotify-App auf')} <b>{t('developer.spotify.com')}</b> {t('unter „Redirect URIs“ genau diese Adresse eintragen:')}
            <code class="mu-code">{rueckAdresse}</code>
            {#if lokal}<small class="mu-klein">{t('Das ist die Adresse für den Mac (Spotify nimmt „localhost“ nicht an, 127.0.0.1 schon). Fürs iPhone kommt die Adresse dazu, unter der TravelBuddy dort läuft. Sie steht am iPhone genau an dieser Stelle.')}</small>
            {:else if umg.ios}<small class="mu-klein">{t('Am bequemsten am Mac: hier „Kopieren“ tippen und am Mac im Spotify-Dashboard einfügen. Mit derselben Apple-ID und Handoff kommt die Zwischenablage am Mac an. Sonst mit „Teilen“ per AirDrop schicken.')}</small>{/if}
            <small class="mu-klein">{t('Zeigt Spotify beim Verbinden „INVALID_CLIENT: Invalid redirect URI“, fehlt genau dieser Eintrag. Er muss Zeichen für Zeichen stimmen, auch der Schrägstrich am Ende.')}</small>
            <span class="mu-knoepfe">
              <button class="btn klein" onclick={adresseKopieren}>{t('Kopieren')}</button>
              {#if kannTeilen && !lokal}<button class="btn klein" onclick={adresseTeilen}>{t('Teilen')}</button>{/if}
            </span>
          </li>
          <li>{t('Unter „User Management“ dein Spotify-Konto eintragen (Name und E-Mail). Ohne Eintrag lehnt Spotify die Anmeldung ab. Das gilt fürs Konto, nicht fürs Gerät: Hat es am Mac geklappt, ist dieser Schritt erledigt.')}</li>
          <li>{#if verbunden}<button class="btn" onclick={abmelden}>{t('Spotify trennen')}</button>{:else}<button class="btn-primary" onclick={verbinden} disabled={!$online}>{t('Mit Spotify verbinden')}</button>
            {#if umg.ios}<small class="mu-klein">{t('Spotify fragt dabei einmal nach deinem Konto, auch wenn die Spotify-App angemeldet ist. Danach geht es von selbst zurück in TravelBuddy.')}</small>{/if}{/if}</li>
          {#if verbunden}
            <li>{t('Playlist:')} {#if $musik.playlist?.id}<b>{$musik.playlist.name}</b>{:else}{t('noch nicht verknüpft')}{/if}
              <div class="mu-hand">
                <input class="mu-feld" bind:value={plLink} placeholder={t('Anderer Playlist-Link (leer: Sounds of the Road)')} autocomplete="off" spellcheck="false" aria-label={t('Playlist-Link')} />
                <button class="btn" onclick={playlistSetzen} disabled={plLaeuft || !$online}>{$musik.playlist?.id ? t('Ändern') : t('Verknüpfen')}</button>
              </div>
            </li>
          {/if}
        </ol>
        <details class="mu-klein"><summary>{t('Client-ID')}</summary><input class="mu-feld" value={$musikCfg.spotifyClientId} oninput={(e) => setze({ spotifyClientId: e.target.value.trim() })} autocomplete="off" spellcheck="false" aria-label={t('Client-ID')} /></details>
        {#if !$musikCfg.lastfmKey}<p class="mu-stand">{t('Ohne Last.fm-Schlüssel kommen die Titel nur von Künstlern aus der Gegend (MusicBrainz). Mit Schlüssel kommen die Charts des Landes dazu, in dem du gerade bist.')}</p>{/if}

        <label class="mu-schalter"><input type="checkbox" switch checked={$musikCfg.aktiv} onchange={(e) => { const an = e.target.checked; e.target.checked = $musikCfg.aktiv; einschalten(an) }} /> {t('Musik unterwegs eingeschaltet')}</label>
        <div class="mu-raster">
          <label>{t('Name der Playlist')}<input class="mu-feld" value={$musikCfg.playlistName} oninput={(e) => setze({ playlistName: e.target.value || 'Sounds of the Road' })} /></label>
          <label>{t('Titel je Ort')}<input class="mu-feld" type="number" min="1" max="30" value={$musikCfg.titelJeOrt} onchange={(e) => setze({ titelJeOrt: Math.max(1, Math.min(30, +e.target.value || 10)) })} /></label>
          <label>{t('Neuer Ort ab (km)')}<input class="mu-feld" type="number" min="1" max="200" value={$musikCfg.mindestAbstandM / 1000} onchange={(e) => setze({ mindestAbstandM: Math.max(1, +e.target.value || 10) * 1000 })} /></label>
          <label>{t('Umkreis (km)')}<input class="mu-feld" type="number" min="25" max="300" step="25" value={$musikCfg.umkreisKm} onchange={(e) => setze({ umkreisKm: Math.max(25, Math.min(300, +e.target.value || 200)) })} /></label>
          <label>{t('Frühestens nach (min)')}<input class="mu-feld" type="number" min="5" max="600" value={$musikCfg.mindestAbstandMin} onchange={(e) => setze({ mindestAbstandMin: Math.max(5, +e.target.value || 30) })} /></label>
        </div>
        <label class="mu-stile">{t('Lieblingsstile, die zuerst kommen (durch Komma getrennt, leer = alle gleich)')}<input class="mu-feld" value={($musikCfg.stile || []).join(', ')} onchange={(e) => setze({ stile: e.target.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) })} autocomplete="off" spellcheck="false" /></label>
        <fieldset class="mu-quellen">
          <legend>{t('Musikquellen')}</legend>
          {#each QUELLEN as q (q.id)}
            <label class="mu-schalter"><input type="checkbox" switch checked={$musikCfg.quellen[q.id] !== false} onchange={(e) => setzeQuelle(q.id, e.target.checked)} /> {q.name} <small>({ART_TEXT[q.art]})</small></label>
          {/each}
          <label>{t('Last.fm-Schlüssel (für die Charts des Landes)')}<input class="mu-feld" value={$musikCfg.lastfmKey} oninput={(e) => setze({ lastfmKey: e.target.value })} autocomplete="off" spellcheck="false" /></label>
        </fieldset>
      </div>
    {/if}
  </section>

  <section class="mu-block">
    <h3>{t('Standort')}</h3>
    {#if $musik.letzterOrt}
      {@const reg = $musik.regionen[$musik.letzterOrt.regionId]}
      <p class="mu-k">{t('Zuletzt gesucht:')} <b>{reg?.name || 'unbekannt'}</b> ({EBENE_TEXT[reg?.ebene === 'land' ? 'national' : reg?.ebene] || ''}) · {datum(new Date($musik.letzterOrt.zeit).toISOString())}</p>
    {:else}
      <p class="mu-k">{t('Noch kein Ort ausgewertet.')}</p>
    {/if}
    {#if $musik.ausstehend.length}<p class="mu-k">{tn($musik.ausstehend.length, '{n} Ort wartet auf Netz oder Spotify.', '{n} Orte warten auf Netz oder Spotify.')} <button class="mu-textknopf" onclick={nachholen}>{t('Jetzt nachholen')}</button></p>{/if}
    <button class="btn-primary mu-jetzt" onclick={hierUndJetzt} disabled={ortet || !$online}>{ortet ? t('Suche Standort …') : t('📍 Musik von hier, jetzt')}</button>
    <div class="mu-hand">
      <label class="mu-hand-feld">{t('Ort von Hand wählen')}
        <select class="mu-feld" bind:value={handOrt}>
          <option value="">{t('Ort aus der Sammlung …')}</option>
          {#each mitKoord as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
        </select>
      </label>
      <button class="btn" onclick={vonHand} disabled={!handOrt}>{t('Hier suchen')}</button>
    </div>
    <button class="mu-textknopf gefahr" onclick={vergessen}>{t('Standortverlauf löschen')}</button>
    <button class="mu-textknopf gefahr" onclick={vonVorne} disabled={zurueckLaeuft}>{zurueckLaeuft ? t('Setze zurück …') : t('Von vorne anfangen …')}</button>
  </section>

  <section class="mu-block">
    <button class="mu-auf-zu" aria-expanded={protokollAuf} onclick={() => (protokollAuf = !protokollAuf)}><span class="aufklapp klein" class:offen={protokollAuf} aria-hidden="true"></span>{t('Protokoll ({length})', { length: $musik.protokoll.length })}</button>
    {#if protokollAuf}
      <ul class="mu-protokoll" transition:klapp={{ duration: dauer(220) }}>
        {#each $musik.protokoll.slice(0, 40) as e, i (i)}<li class={e.art}><time>{datum(e.zeit)}</time> {e.text}</li>{:else}<li>{t('Noch nichts passiert.')}</li>{/each}
      </ul>
    {/if}
  </section>
</div>

<style>
  .mu { display: flex; flex-direction: column; gap: 14px; max-width: 760px; }
  .mu-kopf { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .mu-note { width: 48px; height: 48px; border-radius: 50%; background: #1db954; color: #062b14; display: grid; place-items: center; flex: none; }
  .mu-titel { flex: 1; min-width: 0; }
  .mu-titel h2 { margin: 0; font-size: calc(21px * var(--schrift, 1)); }
  .mu-titel p { margin: 2px 0 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .mu-auf { min-height: 44px; display: inline-flex; align-items: center; text-decoration: none; }
  .mu-block { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); padding: 12px 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; }
  .mu-block h3 { margin: 0; font-size: calc(16px * var(--schrift, 1)); }
  .mu-neu { border-color: #1db954; box-shadow: 0 0 0 1px #1db954, var(--shadow); }
  .mu-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .mu-liste li { display: flex; align-items: center; gap: 10px; min-height: 44px; border-bottom: 1px solid color-mix(in srgb, var(--line) 60%, transparent); padding-bottom: 6px; }
  .mu-liste.klein li { min-height: 0; }
  .mu-t { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.3; }
  .mu-t b { font-size: calc(14.5px * var(--schrift, 1)); } .mu-t small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .mu-wo { display: flex; flex-direction: column; align-items: flex-end; text-align: right; line-height: 1.3; }
  .mu-wo small { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); } .mu-ebene { font-weight: 700; }
  .mu-link { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--line); text-decoration: none; color: var(--ink); flex: none; }
  .mu-ort { margin: 8px 0 4px; font-size: calc(13px * var(--schrift, 1)); color: var(--brand-text); }
  .mu-hinweis, .mu-k, .mu-stand { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--muted); }
  .mu-stand { background: var(--info-flaeche); color: var(--info-text); border-radius: 10px; padding: 8px 10px; }
  .mu-warn { margin: 0; font-size: calc(13.5px * var(--schrift, 1)); color: var(--danger-text); background: var(--danger-flaeche); border-radius: 10px; padding: 8px 10px; }
  .mu-auf-zu { display: flex; align-items: center; gap: 10px; min-height: 44px; border: none; background: none; padding: 0; font-size: calc(15px * var(--schrift, 1)); font-weight: 700; color: var(--ink); cursor: pointer; text-align: left; }
  .mu-auf-zu:active { transform: none; }
  .mu-einr { display: flex; flex-direction: column; gap: 12px; }
  .mu-schritte { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; font-size: calc(14px * var(--schrift, 1)); }
  .mu-schritte li { line-height: 1.45; }
  .mu-klein { display: block; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); margin-bottom: 6px; }
  .mu-code { display: block; margin: 6px 0; padding: 6px 8px; background: var(--flaeche); border-radius: 6px; font-size: calc(13px * var(--schrift, 1)); overflow-wrap: anywhere; }
  .mu-feld { display: block; width: 100%; min-height: 44px; margin-top: 4px; padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); font-size: calc(15px * var(--schrift, 1)); }
  .mu-raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .mu-raster label, .mu-quellen label:not(.mu-schalter), .mu-hand-feld { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .mu-schalter { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: calc(14.5px * var(--schrift, 1)); font-weight: 600; color: var(--ink); }
  .mu-schalter small { color: var(--muted); font-weight: 500; }
  .mu-quellen { border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px 12px; margin: 0; display: flex; flex-direction: column; gap: 4px; }
  .mu-quellen legend { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; color: var(--muted); padding: 0 4px; }
  .mu-jetzt { min-height: 48px; align-self: flex-start; }
  .mu-hand { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
  .mu-hand-feld { flex: 1 1 200px; }
  .mu-hand .btn { min-height: 44px; }
  .mu-textknopf { align-self: flex-start; background: none; border: none; padding: 6px 0; min-height: 36px; color: var(--brand-text); font-weight: 700; font-size: calc(13.5px * var(--schrift, 1)); cursor: pointer; }
  .mu-textknopf.gefahr { color: var(--danger-text); }
  .mu-protokoll { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: calc(12.5px * var(--schrift, 1)); color: var(--ink); }
  .mu-protokoll time { color: var(--muted); margin-right: 6px; font-variant-numeric: tabular-nums; }
  .mu-protokoll .fehler { color: var(--danger-text); } .mu-protokoll .ok { color: var(--ok-text); }
  .btn.klein { min-height: 36px; padding: 0 12px; font-size: calc(13px * var(--schrift, 1)); }
  .mu-knoepfe { display: flex; gap: 8px; flex-wrap: wrap; }
  .mu-stile { display: grid; gap: 4px; margin-top: 10px; font-size: .85rem; }
</style>
