<script>
  // Mehr → Fun Facts: Einstellungen, Vorab-Laden für die Route und alle gemerkten Fakten.
  import { je, istEn, LOCALE } from './i18n.js'
  import { online } from './netz.js'
  import { reisen } from './userdata.js'
  import { zeigeToast } from './toast.js'
  import { funfactsCfg, fakten, vorabStand, ladeFuerRoute, ladeGespeicherte, routenPunkte, vorlesen } from './funfacts.js'
  import { gemerkt, vergiss } from './funfacts-merken.js'

  ladeGespeicherte()
  const setze = (patch) => funfactsCfg.update((c) => ({ ...c, ...patch }))
  const anzahl = $derived(Object.keys($fakten).length)
  const punkte = $derived(routenPunkte($reisen).length)
  const wann = (ms) => { try { return new Date(ms).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
  const datum = (iso) => { try { return new Date(iso + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }) } catch { return iso } }

  async function jetztLaden() {
    await ladeFuerRoute($reisen, { sprache: istEn ? 'en' : 'de' })
    const s = $vorabStand
    zeigeToast(s.fehler ? je('Nicht alle Orte geladen, später noch einmal versuchen', 'Not every place loaded, try again later') : je('Fakten für die Route gespeichert', 'Facts for the route saved'), s.fehler ? 'info' : 'ok')
  }
</script>

<div class="fp">
  <p class="fp-intro">{je('Kurze Fakten zu dem Ort, an dem du bist, und entlang deiner Route. Für die geplanten Etappen und Routen lädt die App sie vorab, solange du Netz hast. Unterwegs ohne Netz sind sie dann schon da. Mit Netz kommen frische Fakten aus der Nähe dazu.', 'Short facts about where you are and along your route. For your planned legs and routes the app loads them ahead while you have a connection, so they are there offline. With a connection, fresh facts from nearby are added.')}</p>

  <section class="fp-karte">
    <h2>⚙️ {je('Einstellungen', 'Settings')}</h2>
    <label class="fp-schalter"><input type="checkbox" switch checked={$funfactsCfg.an} onchange={(e) => setze({ an: e.currentTarget.checked })} /> {je('Fun Facts zeigen', 'Show fun facts')}</label>
    <label class="fp-schalter"><input type="checkbox" switch checked={$funfactsCfg.fahren} disabled={!$funfactsCfg.an} onchange={(e) => setze({ fahren: e.currentTarget.checked })} /> {je('Beim Fahren Hinweise zeigen, wenn ein Ort in der Nähe ist', 'Show a note while driving when a place is nearby')}</label>
    <label class="fp-schalter"><input type="checkbox" switch checked={$funfactsCfg.vorlesen} disabled={!$funfactsCfg.an} onchange={(e) => setze({ vorlesen: e.currentTarget.checked })} /> {je('Hinweise beim Fahren automatisch vorlesen', 'Read notes aloud automatically while driving')}</label>
    <label class="fp-zeile">{je('Umkreis', 'Radius')}
      <select value={String($funfactsCfg.umkreisKm)} onchange={(e) => setze({ umkreisKm: Number(e.currentTarget.value) })} disabled={!$funfactsCfg.an}>
        {#each [5, 10, 20, 50] as km}<option value={String(km)}>{km} km</option>{/each}
      </select>
    </label>
  </section>

  <section class="fp-karte">
    <h2>🧭 {je('Für deine Route', 'For your route')}</h2>
    <p class="fp-stand">
      {je('{n} Fakten offline gespeichert', '{n} facts saved offline').replace('{n}', anzahl.toLocaleString(LOCALE))}
      {#if $vorabStand.zeit} · {je('zuletzt geladen', 'last loaded')} {wann($vorabStand.zeit)}{/if}
    </p>
    {#if $vorabStand.laeuft}
      <p class="fp-klein" role="status">{je('Lädt … {a} von {b} Orten', 'Loading … {a} of {b} places').replace('{a}', $vorabStand.fertig).replace('{b}', $vorabStand.gesamt)}</p>
      <progress max={$vorabStand.gesamt || 1} value={$vorabStand.fertig}></progress>
    {:else}
      <p class="fp-klein">{punkte ? je('{n} Orte deiner geplanten Etappen und Routen. Die App lädt einmal am Tag von selbst nach, wenn du Netz hast.', '{n} places of your planned legs and routes. The app refreshes once a day by itself when you are online.').replace('{n}', punkte) : je('Noch keine Stopps mit Koordinaten geplant. Fakten kommen dann nur live mit Netz und aus den Ortsinfos.', 'No stops with coordinates planned yet. Facts then come live with a connection and from the place info.')}</p>
    {/if}
    <button class="btn-primary fp-knopf" onclick={jetztLaden} disabled={!$online || $vorabStand.laeuft || !punkte}>{$online ? je('Jetzt für die Route laden', 'Load for the route now') : je('Braucht Netz', 'Needs a connection')}</button>
  </section>

  <section class="fp-karte">
    <h2>⭐ {je('Gemerkt', 'Saved')} <small>{$gemerkt.length}</small></h2>
    {#if !$gemerkt.length}
      <p class="fp-klein">{je('Noch nichts gemerkt. Tippe bei einem Fakt auf „Merken“, dann steht er im Logbuch unter „Heute gelernt“ und später im Reisetagebuch.', 'Nothing saved yet. Tap “Save” on a fact and it appears in the logbook under “Learned today” and later in your travel journal.')}</p>
    {:else}
      <ul class="fp-liste">
        {#each $gemerkt as g (g.eintragId + g.id)}
          <li>
            <span class="fp-datum">{datum(g.datum)}{#if g.titel} · {g.titel}{/if}</span>
            <span class="fp-text">{g.text}</span>
            <span class="fp-aktion">
              {#if g.quelle}<a href={g.quelle} target="_blank" rel="noopener">{je('Quelle', 'Source')} ↗</a>{/if}
              <button class="fp-leise" onclick={() => vorlesen(g.text, istEn ? 'en' : 'de')}>🔊</button>
              <button class="fp-leise" onclick={() => vergiss(g.eintragId, g.id)}>{je('Entfernen', 'Remove')}</button>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <p class="fp-klein fp-fuss">{je('Quellen: Wikipedia (Artikel in der Nähe, Text unverändert übernommen) und die Ortsinfos der App. Wikipedia sieht dabei nur die Koordinaten der Abfrage.', 'Sources: Wikipedia (nearby articles, text taken as is) and the app’s place info. Wikipedia only sees the coordinates of the request.')}</p>
</div>

<style>
  .fp { display: flex; flex-direction: column; gap: 12px; max-width: 720px; }
  .fp-intro { margin: 0; font-size: calc(15px * var(--schrift, 1)); line-height: 1.5; color: var(--ink); }
  .fp-karte { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 16px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; }
  .fp-karte h2 { margin: 0; font-size: calc(17px * var(--schrift, 1)); display: flex; align-items: baseline; gap: 8px; }
  .fp-karte h2 small { color: var(--muted); font-size: calc(13px * var(--schrift, 1)); }
  .fp-schalter { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: calc(14.5px * var(--schrift, 1)); cursor: pointer; }
  .fp-zeile { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; font-size: calc(14.5px * var(--schrift, 1)); }
  .fp-zeile select { min-height: 40px; font-size: max(16px, calc(14px * var(--schrift, 1))); border-radius: var(--radius-s); border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); padding: 0 8px; }
  .fp-stand { margin: 0; font-weight: 700; font-size: calc(14.5px * var(--schrift, 1)); }
  .fp-klein { margin: 0; color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.45; }
  .fp-knopf { align-self: flex-start; min-height: 48px; }
  progress { width: 100%; height: 8px; accent-color: var(--brand); }
  .fp-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .fp-liste li { display: flex; flex-direction: column; gap: 3px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .fp-datum { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .fp-text { font-size: calc(14.5px * var(--schrift, 1)); line-height: 1.5; }
  .fp-aktion { display: flex; gap: 10px; align-items: center; font-size: calc(13px * var(--schrift, 1)); }
  .fp-aktion a { color: var(--brand-text); }
  .fp-leise { min-height: 36px; padding: 0; border: none; background: none; color: var(--brand-text); font-weight: 700; cursor: pointer; font-size: calc(13px * var(--schrift, 1)); }
  .fp-fuss { text-align: center; }
</style>
