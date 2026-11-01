<script>
  // Sprachfrage beim allerersten Start. Sie steht in beiden Sprachen da, weil noch keine gewählt ist.
  import { sprache, setzeSprache } from './i18n.js'
  import { modal } from './modal.js'

  let { onfertig = () => {} } = $props()

  function waehle(s) {
    onfertig()
    setzeSprache(s)
  }
</script>

<div class="sw-hg" data-dialog-hg aria-hidden="true"></div>
<div class="sw" role="dialog" aria-labelledby="sw-titel" use:modal={{ onclose: () => waehle(sprache) }}>
  <h2 id="sw-titel" lang="en">Choose your language</h2>
  <p lang="de">Wähle deine Sprache</p>
  <div class="sw-knoepfe">
    <button class="btn-primary" lang="en" onclick={() => waehle('en')}>English</button>
    <button class="btn" lang="de" onclick={() => waehle('de')}>Deutsch</button>
  </div>
</div>

<style>
  .sw-hg { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.6); }
  .sw { position: fixed; left: 50%; top: 50%; z-index: 1001; transform: translate(-50%, -50%); width: min(340px, calc(100vw - 32px)); padding: 20px 18px 18px; border-radius: var(--radius-l); background: var(--card); color: var(--ink); box-shadow: var(--shadow); text-align: center; }
  .sw h2 { margin: 0; font-size: calc(20px * var(--schrift, 1)); }
  .sw p { margin: 4px 0 16px; color: var(--muted); font-size: calc(15px * var(--schrift, 1)); }
  .sw-knoepfe { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .sw-knoepfe button { min-height: 48px; font-size: calc(16px * var(--schrift, 1)); font-weight: 700; }
</style>
