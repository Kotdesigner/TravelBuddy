<script>
  // V14: Zu einem Termin, wo immer er steht: Buchungsnummer zum Kopieren, Kosten (offen oder bezahlt)
  // und die Belege der ganzen Buchung (der Voucher vom Check-in steht auch am Check-out).
  import { je } from './i18n.js'
  import { dezimal, tagMonat } from './format.js'
  import { betragVon } from './kosten.js'
  import { updateVorabKosten } from './userdata.js'
  import { heuteTag } from './heute.js'
  import { zeigeToast } from './toast.js'
  import { buchungsIndex } from './buchung-dienst.js'
  import BelegKnoepfe from './BelegKnoepfe.svelte'

  let { termin, klein = false, nummer = true } = $props()
  const info = $derived($buchungsIndex.get(termin?.id))
  const ref = $derived(termin?.ref || info?.buchung.ref || '')
  const docs = $derived(info?.buchung.docs?.length ? info.buchung.docs : (termin?.docs || []))
  const kosten = $derived(info?.kosten || [])

  async function kopieren() {
    try { await navigator.clipboard.writeText(ref); zeigeToast(je('Buchungsnummer kopiert ✓', 'Booking number copied ✓'), 'ok') }
    catch { zeigeToast(ref, 'info', 4000) }
  }
</script>

{#if (nummer && ref) || kosten.length || docs.length}
  <span class="bz" class:klein>
    {#if nummer && ref}<button class="bz-ref" onclick={kopieren} title={je('Buchungsnummer kopieren', 'Copy booking number')}>#{ref} <span aria-hidden="true">📋</span></button>{/if}
    {#each kosten as k (k.id)}
      <span class="bz-k" class:offen={k.zahlung === 'vorOrt'}>💳 {dezimal(betragVon(k.betrag), 2)} {k.waehrung}
        {#if k.zahlung === 'vorOrt'}· {je('vor Ort zu zahlen', 'pay on site')}
          <button class="bz-ok" onclick={() => { updateVorabKosten(k.id, { zahlung: 'bezahlt', datum: $heuteTag }); zeigeToast(je('Als bezahlt vermerkt ✓', 'Marked as paid ✓'), 'ok') }}>{je('✓ bezahlt', '✓ paid')}</button>
        {:else}<small>· {je('bezahlt', 'paid')} {tagMonat(k.datum)}</small>{/if}
      </span>
    {/each}
    <BelegKnoepfe {docs} {klein} />
  </span>
{/if}

<style>
  .bz { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 4px; font-size: calc(13px * var(--schrift, 1)); }
  .bz.klein { font-size: calc(12px * var(--schrift, 1)); gap: 4px; }
  .bz-ref::after { content: ''; position: absolute; inset: -6px 0; }
  .bz-ref { position: relative; border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); border-radius: var(--radius-s); min-height: 32px; padding: 2px 8px; font-size: 1em; font-weight: 700; letter-spacing: 0.03em; cursor: pointer; }
  .bz-k { display: inline-flex; gap: 4px; align-items: center; flex-wrap: wrap; font-weight: 700; }
  .bz-k small { font-weight: 400; color: var(--muted); font-size: 1em; }
  .bz-k.offen { color: var(--warn, #b45309); }
  .bz-ok { border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); border-radius: var(--radius-s); min-height: 32px; padding: 2px 8px; font-size: 1em; cursor: pointer; }
</style>
