<script>
  import { t } from './i18n.js'
  import { notizen, neueNotiz, toggleNotiz, loescheNotiz } from './userdata.js'
  import { NOTIZ_TYPEN as TYPEN, NOTIZ_TYP as TYP } from './notizen-typen.js'

  let filter = $state('alle')
  let neuTyp = $state('notiz')
  let neuText = $state('')

  const liste = $derived(filter === 'alle' ? $notizen : $notizen.filter((n) => n.typ === filter))
  const zaehler = $derived.by(() => { const z = {}; for (const n of $notizen) z[n.typ] = (z[n.typ] || 0) + 1; return z })

  function add() { neueNotiz(neuTyp, neuText); neuText = '' }
  function waehle(id) { filter = id; if (id !== 'alle') neuTyp = id }

  // Stabile lokale Wanduhr vom Erfassungs-Zeitpunkt (unabhängig von der aktuellen Gerätezeitzone).
  function lokalString(n) {
    if (n.tsLokal) return n.tsLokal
    try {
      const d = new Date(n.ts); const p = (x) => String(x).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
    } catch { return '' }
  }
  function kurzTs(n) {
    const lok = lokalString(n)
    if (!lok) return ''
    const [datum, zeit] = lok.split('T')
    const teile = datum.split('-')
    return `${teile[2]}.${teile[1]}. ${zeit || ''}`.trim()
  }

  function exportNotizen() {
    const lines = [t('WA Roadtrip — Notizen'), '']
    for (const t of TYPEN) {
      const items = $notizen.filter((n) => n.typ === t.id)
      if (!items.length) continue
      lines.push(`${t.icon} ${t.label.toUpperCase()}`)
      for (const n of items) lines.push(`  ${n.erledigt ? '☑' : '☐'} ${n.text}  ·  ${kurzTs(n)}`)
      lines.push('')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const d = new Date()
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `WA-Notizen_${stamp}.txt`
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 800)
  }
</script>

<div class="notizen">
  <div class="kopf">
    <p class="intro">{t('Alles festhalten, damit nichts verloren geht: nach Kategorie, abhakbar, mit Zeitstempel.')}</p>
    <button class="btn exp" onclick={exportNotizen} disabled={!$notizen.length}>{t('⬇︎ Export')}</button>
  </div>

  <div class="chips">
    <button class="chip" class:an={filter === 'alle'} onclick={() => waehle('alle')}>{t('Alle')}{#if $notizen.length}<span class="b">{$notizen.length}</span>{/if}</button>
    {#each TYPEN as t}
      <button class="chip" class:an={filter === t.id} onclick={() => waehle(t.id)}>{t.icon} {t.label}{#if zaehler[t.id]}<span class="b">{zaehler[t.id]}</span>{/if}</button>
    {/each}
  </div>

  <div class="add">
    <select bind:value={neuTyp} aria-label={t('Kategorie')}>{#each TYPEN as t}<option value={t.id}>{t.icon} {t.label}</option>{/each}</select>
    <input placeholder={t('Neuer Eintrag …')} bind:value={neuText} onkeydown={(e) => e.key === 'Enter' && add()} />
    <button class="add-btn" onclick={add} disabled={!neuText.trim()}>{t('+ Hinzufügen')}</button>
  </div>

  {#if liste.length === 0}
    <p class="leer">{t('Noch keine Einträge{wert}. Oben eintippen und „+ Hinzufügen".', { wert: filter !== 'alle' ? t(' in dieser Kategorie') : '' })}</p>
  {:else}
    <ul class="liste">
      {#each liste as n (n.id)}
        <li class="eintrag" class:erledigt={n.erledigt}>
          <button class="check" onclick={() => toggleNotiz(n.id)} aria-label={t('als erledigt markieren')} title={t('erledigt')}>{n.erledigt ? '☑' : '☐'}</button>
          <span class="ic" title={TYP[n.typ]?.label}>{TYP[n.typ]?.icon}</span>
          <span class="txt">{n.text}</span>
          <span class="ts">{kurzTs(n)}</span>
          <button class="del" onclick={() => loescheNotiz(n.id)} aria-label={t('löschen')} title={t('löschen')}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .kopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
  .intro { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); margin: 0; flex: 1 1 260px; }
  .btn.exp { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; padding: 8px 13px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; }
  .btn.exp:disabled { opacity: 0.4; }

  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .chip {
    font-size: calc(12.5px * var(--schrift, 1)); font-weight: 600; padding: 6px 11px; border-radius: 16px; cursor: pointer;
    border: 1px solid var(--line-stark); background: var(--card); color: var(--muted); display: inline-flex; align-items: center; gap: 6px;
  }
  .chip.an { background: var(--brand); color: #fff; border-color: var(--brand); }
  .chip .b { font-size: calc(12px * var(--schrift, 1)); font-weight: 800; background: rgba(0,0,0,0.12); padding: 1px 6px; border-radius: 9px; }
  .chip.an .b { background: rgba(255,255,255,0.28); }

  .add { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
  .add select { font-size: calc(13px * var(--schrift, 1)); padding: 8px; border: 1px solid var(--line-stark); border-radius: 8px; background: var(--eingabe); color: var(--ink); }
  .add input { flex: 1 1 160px; font-size: calc(14px * var(--schrift, 1)); padding: 9px 11px; border: 1px solid var(--line-stark); border-radius: 8px; background: var(--eingabe); color: var(--ink); }
  .add-btn { font-size: calc(13px * var(--schrift, 1)); font-weight: 700; padding: 9px 14px; border: none; background: #2f7a63; color: #fff; border-radius: 8px; cursor: pointer; }
  .add-btn:disabled { opacity: 0.4; }

  .leer { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)); background: var(--flaeche); padding: 16px; border-radius: 10px; }
  .liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .eintrag {
    display: flex; align-items: center; gap: 9px; background: var(--card); border: 1px solid var(--line);
    border-radius: 9px; padding: 9px 11px; box-shadow: var(--shadow);
  }
  .check { border: none; background: none; cursor: pointer; font-size: calc(18px * var(--schrift, 1)); color: #2f7a63; line-height: 1; flex: none; min-width: 36px; min-height: 36px; }
  .ic { font-size: calc(15px * var(--schrift, 1)); flex: none; }
  .txt { flex: 1; font-size: calc(14px * var(--schrift, 1)); color: var(--ink); word-break: break-word; }
  .ts { font-size: calc(12px * var(--schrift, 1)); color: var(--muted); white-space: nowrap; flex: none; font-variant-numeric: tabular-nums; }
  .del { border: none; background: none; cursor: pointer; font-size: calc(12px * var(--schrift, 1)); color: var(--danger-text); flex: none; opacity: 0.75; min-width: 36px; min-height: 36px; }
  .del:hover { opacity: 1; }

  /* erledigt: leicht ergraut & kleiner */
  .eintrag.erledigt { background: #f6f2ea; }
  .eintrag.erledigt .check { color: #9bb5aa; }
  .eintrag.erledigt .txt { color: #a89a86; font-size: calc(12.5px * var(--schrift, 1)); }
  .eintrag.erledigt .ic { opacity: 0.5; }
</style>
