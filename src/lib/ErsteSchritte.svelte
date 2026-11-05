<script>
  // V18: Erste Schritte auf Heute. Fünf Schritte, die eine Reise rund machen. Jeder hakt sich von selbst
  // ab, sobald es das gibt. Sind alle erledigt oder blendet man die Liste aus, verschwindet sie.
  import { je } from './i18n.js'
  import { reisen, buchungen, dokumente, journal } from './userdata.js'
  import { istRoute, istEtappe } from './plan.js'
  import { oeffneNeu } from './neu.js'
  import InfoKnopf from './InfoKnopf.svelte'

  let { geh = () => {} } = $props()
  const KEY = 'tb-erste-schritte-v1'
  let zu = $state((() => { try { return localStorage.getItem(KEY) === 'zu' } catch { return false } })())
  function ausblenden() { zu = true; try { localStorage.setItem(KEY, 'zu') } catch {} }

  const schritte = $derived([
    { id: 'etappe', icon: '🗓️', titel: je('Erste Etappe anlegen', 'Add your first leg'), text: je('Ein Zeitabschnitt mit Datum, das Rückgrat der Reise', 'A period with dates, the backbone of the trip'),
      fertig: $reisen.some(istEtappe), los: () => oeffneNeu('etappe') },
    { id: 'route', icon: '🛣️', titel: je('Eine Route planen', 'Plan a route'), text: je('Start, Ziel, Stopps: die App rechnet km, Zeit und Tank-Lücken', 'Start, destination, stops: the app works out km, time and fuel gaps'),
      fertig: $reisen.some((r) => istRoute(r) && (r.stops || []).length >= 2), los: () => oeffneNeu('route') },
    { id: 'buchung', icon: '🎫', titel: je('Eine Buchung eintragen', 'Add a booking'), text: je('Mail einfügen, die Felder füllen sich aus', 'Paste the email, the fields fill in'),
      fertig: ($buchungen?.events || []).length > 0, los: () => oeffneNeu('buchung') },
    { id: 'dokumente', icon: '🗂️', titel: je('Dokumente einpflegen', 'Add your documents'), text: je('Pass und Visum mit Datei, auf Wunsch gesperrt', 'Passport and visa with their file, locked if you like'),
      fertig: $dokumente.length > 0, los: () => geh('mehr/vorbereitung') },
    { id: 'tag', icon: '📖', titel: je('Den ersten Tag schreiben', 'Write your first day'), text: je('Daraus wird später dein Tagebuch', 'This becomes your journal later'),
      fertig: $journal.length > 0, los: () => oeffneNeu('tag') },
  ])
  const erledigt = $derived(schritte.filter((s) => s.fertig).length)
  const zeigen = $derived(!zu && erledigt < schritte.length)
</script>

{#if zeigen}
  <section class="es" aria-labelledby="es-titel">
    <div class="es-kopf">
      <h2 id="es-titel">{je('Erste Schritte', 'First steps')}<InfoKnopf id="zusammenhang" /></h2>
      <span class="es-zahl">{je(`${erledigt} von ${schritte.length}`, `${erledigt} of ${schritte.length}`)}</span>
    </div>
    <div class="es-balken" aria-hidden="true"><span style="width:{(erledigt / schritte.length) * 100}%"></span></div>
    <ol>
      {#each schritte as s (s.id)}
        <li class:fertig={s.fertig}>
          <button type="button" class="es-schritt" onclick={s.los} disabled={s.fertig} aria-label={s.fertig ? je(`${s.titel}: erledigt`, `${s.titel}: done`) : s.titel}>
            <span class="es-i" aria-hidden="true">{s.fertig ? '✓' : s.icon}</span>
            <span class="es-t"><b>{s.titel}</b><small>{s.text}</small></span>
            {#if !s.fertig}<span class="es-pfeil" aria-hidden="true">›</span>{/if}
          </button>
        </li>
      {/each}
    </ol>
    <button type="button" class="btn btn-ghost es-weg" onclick={ausblenden}>{je('Ausblenden', 'Hide')}</button>
  </section>
{/if}

<style>
  .es { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 16px 18px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; }
  .es-kopf { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  h2 { margin: 0; font-size: calc(17px * var(--schrift, 1)); display: inline-flex; align-items: center; }
  .es-zahl { font-size: calc(13px * var(--schrift, 1)); font-weight: 800; color: var(--muted); font-variant-numeric: tabular-nums; }
  .es-balken { height: 6px; border-radius: 3px; background: var(--flaeche-2); overflow: hidden; }
  .es-balken span { display: block; height: 100%; background: var(--ok); border-radius: 3px; transition: width var(--t-med) var(--ease-out); }
  ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  li { border-top: 1px solid var(--line); }
  li:first-child { border-top: none; }
  .es-schritt { width: 100%; display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 6px 2px; border: none; background: none; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
  .es-schritt:disabled { cursor: default; }
  .es-i { flex: none; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: var(--flaeche); font-size: calc(15px * var(--schrift, 1)); }
  li.fertig .es-i { background: var(--ok-flaeche); color: var(--ok-text); font-weight: 800; }
  .es-t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .es-t b { font-size: calc(14.5px * var(--schrift, 1)); }
  .es-t small { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  li.fertig .es-t b { color: var(--muted); text-decoration: line-through; font-weight: 600; }
  .es-pfeil { flex: none; color: var(--brand-text); font-size: calc(20px * var(--schrift, 1)); font-weight: 700; }
  .es-weg { align-self: flex-end; }
</style>
