<script>
  // Eingeklappter Zugang mit grünem Haken: erscheint, sobald ein Schlüssel, Link oder eine Anmeldung
  // nachweislich funktioniert. „Ändern“ klappt das Feld wieder auf. Der Schlüssel selbst wird nie gezeigt.
  import { je } from './i18n.js'
  let { titel, detail = '', onAendern = null, knopf = je('Ändern', 'Change') } = $props()
</script>

<div class="zo">
  <span class="zo-haken" aria-hidden="true">✓</span>
  <span class="zo-txt"><b>{titel}</b>{#if detail}<small>{detail}</small>{/if}</span>
  {#if onAendern}<button type="button" class="zo-knopf" onclick={onAendern}>{knopf}</button>{/if}
</div>

<style>
  .zo { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 6px 10px; border: 1px solid var(--ok-linie); border-radius: var(--radius-s); background: var(--ok-flaeche); }
  .zo-haken { flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--ok); color: #fff; font-size: calc(14px * var(--schrift, 1)); font-weight: 800; line-height: 1; }
  .zo-txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; color: var(--ok-text); font-size: calc(14.5px * var(--schrift, 1)); }
  .zo-txt small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); overflow-wrap: anywhere; }
  .zo-knopf { flex: none; min-height: 40px; padding: 0 10px; border: none; background: none; color: var(--brand-text); font-weight: 700; font-size: calc(13.5px * var(--schrift, 1)); cursor: pointer; }
</style>
