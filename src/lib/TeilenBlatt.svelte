<script>
  // Ort oder Route teilen (V31): als Link über das Teilen-Menü des Geräts oder als QR-Code zum Scannen.
  // Im Link stecken nur Name, Lage und Stopps (verbinden.js), nichts aus Logbuch, Kosten oder Buchungen.
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { zeigeToast } from './toast.js'
  import QrCode from './QrCode.svelte'
  import { teilLink, teilen, QR_MAX } from './verbinden.js'

  let { paket, titel = '', onclose = () => {} } = $props()

  const link = $derived(teilLink(paket))
  const istRoute = $derived(paket?.t === 'r')
  let zeigLink = $state(false)

  async function schicken() {
    const e = await teilen({ titel: je(`${titel} aus TravelBuddy`, `${titel} from TravelBuddy`), text: titel, url: link })
    if (e === 'kopiert') zeigeToast(je('Link kopiert', 'Link copied'), 'ok')
    else if (e === 'fehler') { zeigLink = true; zeigeToast(je('Teilen ging nicht. Kopier den Link von Hand oder halte den Code hin.', 'Sharing did not work. Copy the link by hand or show the code.'), 'info', 5000) }
  }
</script>

<div class="tb-hg" data-dialog-hg aria-hidden="true" onclick={onclose}></div>
<div class="tb" role="dialog" aria-labelledby="tb-titel" use:modal={{ onclose, fokus: '.tb-los' }}>
  <h2 id="tb-titel">{istRoute ? je('Route teilen', 'Share route') : je('Ort teilen', 'Share place')}</h2>
  <p class="tb-name">{titel}</p>
  {#if link.length <= QR_MAX}
    <QrCode inhalt={link} groesse={220} label={je('Code zum Scannen', 'Code to scan')} />
    <p class="tb-k">{je('Mit TravelBuddy scannen, unter Mehr, Unterwegs verbinden, Code scannen.', 'Scan with TravelBuddy, under More, Connect on the road, Scan a code.')}</p>
  {:else}
    <p class="tb-k">{je('Für einen Code ist die Route zu lang. Schick sie als Link.', 'The route is too long for a code. Send it as a link.')}</p>
  {/if}
  <p class="tb-k">{istRoute ? je('Geteilt werden Name, Stopps und Nächte. Datum, Logbuch, Kosten und Buchungen bleiben bei dir.', 'Shared are name, stops and nights. Dates, logbook, costs and bookings stay with you.') : je('Geteilt werden Name und Lage, bei eigenen Orten auch die kurze Beschreibung. Notizen, Fotos und Logbuch bleiben bei dir.', 'Shared are name and location, for your own places also the short description. Notes, photos and logbook stay with you.')}</p>
  {#if zeigLink}<input class="tb-link" readonly value={link} aria-label={je('Link zum Kopieren', 'Link to copy')} onfocus={(e) => e.currentTarget.select()} />{/if}
  <div class="tb-knoepfe">
    <button class="bedien-knopf" onclick={onclose}>{je('Schließen', 'Close')}</button>
    <button class="bedien-knopf haupt tb-los" onclick={schicken}>{je('Als Link schicken', 'Send as link')}</button>
  </div>
</div>

<style>
  .tb-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.6); }
  .tb { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(380px, calc(100% - 28px)); max-height: calc(100dvh - 40px); overflow-y: auto;
    padding: 18px; border-radius: 18px; border: 1px solid var(--line-stark); background: var(--card); color: var(--ink); display: flex; flex-direction: column; gap: 10px; }
  h2 { margin: 0; font-size: calc(19px * var(--schrift, 1)); }
  .tb-name { margin: 0; font-weight: 700; }
  .tb-k { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; }
  .tb-link { width: 100%; box-sizing: border-box; min-height: 44px; padding: 8px 10px; font-size: max(16px, calc(14px * var(--schrift, 1))); border: 1px solid var(--line-stark); border-radius: var(--radius-m); background: var(--eingabe); color: var(--ink); }
  .tb-knoepfe { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
</style>
