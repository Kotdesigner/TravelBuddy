<script>
  import { t } from './i18n.js'
  // Stepper: −/＋ statt fummeligem Zahlenfeld.
  // Tippen = ±step · Wert bleibt direkt editierbar · 38-px-Ziele.
  let {
    value = 1,
    min = 1,
    max = 999,
    step = 1,
    einheit = '',
    label = t('Anzahl'),          // zugänglicher Name des Zahlenfelds (VoiceOver)
    onchange = () => {},
  } = $props()

  function setz(n) {
    const v = Math.max(min, Math.min(max, n))
    if (v !== value) onchange(v)
  }
  function tippe(e) {
    const n = parseFloat(String(e.target.value).replace(',', '.'))
    if (!isNaN(n)) setz(n)
  }
</script>

<span class="stepper">
  <button type="button" class="st-btn" onclick={() => setz(value - step)} disabled={value <= min} aria-label={t('{label} verringern', { label })}>−</button>
  <input class="st-wert" type="number" {min} {max} {step} {value} onchange={tippe} inputmode="numeric" aria-label={label} />
  {#if einheit}<span class="st-einheit">{einheit}</span>{/if}
  <button type="button" class="st-btn" onclick={() => setz(value + step)} disabled={value >= max} aria-label={t('{label} erhöhen', { label })}>＋</button>
</span>

<style>
  .stepper {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--flaeche); border: 1px solid var(--line); border-radius: var(--radius-s); padding: 3px;
  }
  .st-btn {
    width: 44px; height: 44px; min-width: 44px; border: none; border-radius: 8px;
    background: var(--card); color: var(--brand-text); font-size: calc(17px * var(--schrift, 1)); font-weight: 800; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    box-shadow: var(--shadow);
  }
  .st-btn:hover { background: var(--btn-flaeche); }
  .st-btn:disabled { opacity: 0.3; cursor: default; box-shadow: none; }
  .st-wert {
    width: 52px; min-height: 42px; border: none; background: none; text-align: center;
    font-size: calc(14px * var(--schrift, 1)); font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums;
    -moz-appearance: textfield; appearance: textfield;
  }
  .st-wert::-webkit-outer-spin-button, .st-wert::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .st-einheit { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
</style>
