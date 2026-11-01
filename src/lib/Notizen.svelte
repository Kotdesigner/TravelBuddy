<script>
  import { t, je } from './i18n.js'
  import { notizen, neueNotiz, toggleNotiz, updateNotiz, loescheNotiz, reisen, gesamtStart, berechneKalender, ymd } from './userdata.js'
  import { NOTIZ_TYPEN as TYPEN, NOTIZ_TYP as TYP } from './notizen-typen.js'

  let filter = $state('alle')
  let neuTyp = $state('notiz')
  let neuText = $state('')
  let neuEtappe = $state('')

  // Etappen zur Auswahl. Vorgeschlagen wird die Etappe, in der die Reise gerade steht.
  const etappen = $derived(berechneKalender($reisen, $gesamtStart).eintraege.map((e) => ({ id: e.reise.id, name: e.reise.name, von: ymd(e.von), bis: ymd(e.bis) })))
  const etappeName = (id) => etappen.find((e) => e.id === id)?.name || ''
  const heute = ymd(new Date())
  let vorgeschlagen = false
  $effect(() => {
    if (vorgeschlagen || !etappen.length) return
    vorgeschlagen = true
    neuEtappe = etappen.find((e) => heute >= e.von && heute <= e.bis)?.id || ''
  })

  const liste = $derived(filter === 'alle' ? $notizen : $notizen.filter((n) => n.typ === filter))
  const zaehler = $derived.by(() => { const z = {}; for (const n of $notizen) z[n.typ] = (z[n.typ] || 0) + 1; return z })

  function add() { neueNotiz(neuTyp, neuText, neuEtappe || null); neuText = '' }
  function waehle(id) { filter = id; neuTyp = id === 'alle' ? 'notiz' : id }

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
  <div class="bedien">
    <p class="bedien-text">{t('Alles festhalten, damit nichts verloren geht: nach Kategorie, abhakbar, mit Zeitstempel.')}</p>
    <div class="bedien-block">
      <span class="bedien-titel" id="nz-kat">{je('Kategorie', 'Category')}</span>
      <div class="bedien-raster" role="group" aria-labelledby="nz-kat">
        <button class="bedien-wahl" class:an={filter === 'alle'} aria-pressed={filter === 'alle'} onclick={() => waehle('alle')}>{t('Alle')}{#if $notizen.length}<span class="bedien-zahl">{$notizen.length}</span>{/if}</button>
        {#each TYPEN as t}
          <button class="bedien-wahl" class:an={filter === t.id} aria-pressed={filter === t.id} onclick={() => waehle(t.id)}>{t.label}{#if zaehler[t.id]}<span class="bedien-zahl">{zaehler[t.id]}</span>{/if}</button>
        {/each}
      </div>
    </div>
    <div class="bedien-block">
      <span class="bedien-titel">{je('Neuer Eintrag', 'New entry')}</span>
      <input class="bedien-feld" placeholder={t('Neuer Eintrag …')} bind:value={neuText} onkeydown={(e) => e.key === 'Enter' && add()} />
      <select class="bedien-feld" bind:value={neuEtappe} aria-label={je('Etappe', 'Leg')}>
        <option value="">{je('Keine Etappe', 'No leg')}</option>
        {#each etappen as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
      </select>
    </div>
    <div class="bedien-zwei">
      <button class="bedien-knopf haupt" onclick={add} disabled={!neuText.trim()}>{je('Hinzufügen', 'Add')}</button>
      <button class="bedien-knopf" onclick={exportNotizen} disabled={!$notizen.length}>{je('Exportieren', 'Export')}</button>
    </div>
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
          <span class="meta">
            <span class="ts">{kurzTs(n)}</span>
            {#if etappen.length}
              <select class="n-etappe" value={n.etappeId || ''} aria-label={je('Etappe', 'Leg')} onchange={(e) => updateNotiz(n.id, { etappeId: e.target.value || null })}>
                <option value="">{je('Keine Etappe', 'No leg')}</option>
                {#each etappen as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
              </select>
            {:else if n.etappeId}<span class="ts">{etappeName(n.etappeId)}</span>{/if}
          </span>
          <button class="lb" class:aus={n.imLogbuch === false} aria-pressed={n.imLogbuch !== false} title={n.imLogbuch === false ? je('Nicht im Logbuch', 'Not in the logbook') : je('Steht im Logbuch', 'In the logbook')} aria-label={je('Im Logbuch zeigen', 'Show in the logbook')} onclick={() => updateNotiz(n.id, { imLogbuch: n.imLogbuch === false })}>📖</button>
          <button class="del" onclick={() => loescheNotiz(n.id)} aria-label={t('löschen')} title={t('löschen')}>✕</button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .meta { grid-area: meta; display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
  .eintrag { display: grid !important; grid-template-columns: auto auto minmax(0, 1fr) auto auto; grid-template-areas: 'check ic txt lb del' 'meta meta meta meta meta'; align-items: center; column-gap: 6px; }
  .check { grid-area: check; }
  .ic { grid-area: ic; }
  .txt { grid-area: txt; }
  .lb { grid-area: lb; }
  .del { grid-area: del; }
  .n-etappe { max-width: 100%; border: none; background: none; color: var(--muted); font-size: calc(12px * var(--schrift, 1)); text-align: right; min-width: 0; }
  .lb { flex: none; width: 44px; height: 44px; border: none; background: none; font-size: calc(17px * var(--schrift, 1)); cursor: pointer; }
  .lb.aus { filter: grayscale(1); opacity: .35; }



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
