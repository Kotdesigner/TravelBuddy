<script>
  // V35: SOS an deine Leute. Ein Tipp auf SOS (Heute oder Notfall) öffnet dieses Blatt, ein zweiter auf
  // „SOS jetzt senden“ schickt los: als SMS an alle (auch ohne Internet), danach WhatsApp an alle mit WhatsApp,
  // am iPhone und Mac mit Kurzbefehl ganz ohne Tipp auf Senden. Zwei Tipps mit Absicht: kein Alarm aus Versehen,
  // und SMS und WhatsApp öffnen sich im Browser nur direkt nach einem Tipp. Ein Countdown, der von selbst sendet,
  // würde vom Browser blockiert.
  import { get } from 'svelte/store'
  import { je } from './i18n.js'
  import { modal } from './modal.js'
  import { standort, frageStandortAn } from './standort.js'
  import { notfallKontakte } from './userdata.js'
  import { personBlatt, naechsterOrt, wegeVon, kurzbefehlAn, kurzbefehlBereit, geraetArt } from './bescheid.js'
  import { schnellBescheid } from './bescheid-aktion.js'

  let { orte = [], onclose = () => {}, onnotfall = null } = $props()

  const geraet = geraetArt()
  // Standort im Hintergrund erneuern, das SOS wartet nicht darauf
  let suche = $state(false)
  async function ortHolen() {
    const s = get(standort)
    if (s && Date.now() - s.zeit < 60000) return
    suche = true
    await frageStandortAn({ hoheGenauigkeit: true, alterMs: 30000 })
    suche = false
  }
  ortHolen()

  const pos = $derived($standort)
  const ort = $derived(pos ? naechsterOrt(pos.lat, pos.lon, orte) : null)
  const altMin = $derived(pos?.zeit ? Math.round((Date.now() - pos.zeit) / 60000) : 0)
  const smsAn = $derived($notfallKontakte.map((p) => p.name))
  const waAn = $derived($notfallKontakte.filter((p) => wegeVon(p).includes('whatsapp')).map((p) => p.name))
  const direkt = $derived(kurzbefehlBereit($kurzbefehlAn, geraet))

  function senden() { onclose(); schnellBescheid('sos', { orte }) }
  function personNeu() { onclose(); personBlatt.set({}) }
</script>

<div class="sb-hg" data-dialog-hg aria-hidden="true" onclick={onclose}></div>
<div class="sb" role="dialog" aria-labelledby="sb-titel" aria-describedby="sb-wer" use:modal={{ onclose, fokus: '.sb-senden' }}>
  <h2 id="sb-titel">🆘 {je('SOS an deine Leute', 'SOS to your people')}</h2>
  {#if !$notfallKontakte.length}
    <p id="sb-wer" class="sb-k">{je('Noch niemand angelegt. Leg Mama, Papa oder deine Partnerin an, dann geht das SOS mit einem Tipp an alle.', 'Nobody added yet. Add your mum, dad or partner, then the SOS goes to everyone with one tap.')}</p>
    <button class="bedien-knopf haupt" onclick={personNeu}>＋ {je('Person anlegen', 'Add a person')}</button>
  {:else}
    <div id="sb-wer" class="sb-wer">
      <p><b>{je('Geht an:', 'Goes to:')}</b> {smsAn.join(', ')}</p>
      <p class="sb-k">{direkt ? je('Direkt über deinen Kurzbefehl, ohne weiteren Tipp.', 'Directly via your shortcut, no further tap.') : je('Als SMS an alle, auch ohne Internet.', 'As a text to everyone, even without internet.')}{#if waAn.length}{je(` Danach WhatsApp an ${waAn.join(', ')}.`, ` Then WhatsApp to ${waAn.join(', ')}.`)}{/if}</p>
      <p class="sb-ort" role="status">📍 {#if pos}{ort || `${(+pos.lat).toFixed(4)}, ${(+pos.lon).toFixed(4)}`}{#if pos.genauigkeit}{` · ± ${pos.genauigkeit} m`}{/if}{#if altMin > 5}{je(` · vor ${altMin} min`, ` · ${altMin} min ago`)}{/if}{#if suche}<span class="sb-leise">{je(' · wird erneuert …', ' · updating …')}</span>{/if}
        {:else if suche}{je('Standort wird bestimmt … Das SOS geht auch ohne.', 'Getting your location … The SOS goes out without it too.')}
        {:else}{je('Ohne Standort. Das SOS geht trotzdem raus.', 'Without location. The SOS goes out anyway.')}{/if}</p>
    </div>
    <button class="sb-senden" onclick={senden}>🆘 {je('SOS jetzt senden', 'Send SOS now')}</button>
  {/if}
  <a class="bedien-knopf sb-000" href="tel:000">📞 {je('000 anrufen', 'Call 000')}<small>{je('Polizei · Feuer · Ambulanz', 'Police · fire · ambulance')}</small></a>
  <div class="sb-unten">
    <button class="bedien-knopf" onclick={onclose}>{je('Abbrechen', 'Cancel')}</button>
    {#if onnotfall}<button class="bedien-knopf" onclick={() => { onclose(); onnotfall() }}>{je('Notfall-Seite', 'Emergency page')}</button>{/if}
  </div>
</div>

<style>
  .sb-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.66); }
  .sb { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(420px, calc(100% - 24px)); max-height: calc(100dvh - 32px); overflow-y: auto;
    padding: 18px; border-radius: 18px; border: 2px solid #c0392b; background: var(--card); color: var(--ink); display: flex; flex-direction: column; gap: 12px; }
  h2 { margin: 0; font-size: calc(21px * var(--schrift, 1)); }
  .sb-wer { display: flex; flex-direction: column; gap: 4px; }
  .sb-wer p { margin: 0; font-size: calc(15px * var(--schrift, 1)); line-height: 1.45; }
  .sb-k { margin: 0; font-size: calc(13px * var(--schrift, 1)) !important; color: var(--muted); line-height: 1.45; }
  .sb-ort { font-weight: 700; }
  .sb-leise { font-weight: 400; color: var(--muted); }
  .sb-senden { min-height: 72px; border: none; border-radius: 14px; background: #c0392b; color: #fff; font: inherit; font-size: calc(21px * var(--schrift, 1)); font-weight: 900; letter-spacing: 0.02em; cursor: pointer;
    box-shadow: 0 2px 10px rgba(192, 57, 43, 0.35); }
  .sb-senden:active { transform: scale(0.99); }
  .sb-000 { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 56px; text-decoration: none; font-weight: 800; color: var(--danger-text); border: 2px solid var(--danger-text); }
  .sb-000 small { font-size: calc(12px * var(--schrift, 1)); font-weight: 600; color: var(--muted); }
  .sb-unten { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .sb-unten:has(> :only-child) { grid-template-columns: 1fr; }
</style>
