<script>
  import { t, LOCALE, istEn } from './i18n.js'
  import { frage } from './dialog.js'
  import { packliste, togglePack, addPackItem, delPackItem, packZuruecksetzen, istAn } from './userdata.js'
  import { PACK_VORLAGE } from './packliste-daten.js'
  import { esc } from './reisebericht.js'

  let neuItem = $state({})

  const kategorien = $derived(PACK_VORLAGE.map((k) => ({
    ...k,
    alle: [...k.items, ...$packliste.custom.filter((c) => c.kat === k.id).map((c) => ({ ...c, eigen: true }))],
  })))
  const gesamt = $derived(kategorien.reduce((n, k) => n + k.alle.length, 0))
  const erledigt = $derived(kategorien.reduce((n, k) => n + k.alle.filter((i) => istAn($packliste.checked[i.id])).length, 0))
  const prozent = $derived(gesamt ? Math.round((erledigt / gesamt) * 100) : 0)

  function addNeu(k) { addPackItem(k.id, neuItem[k.id]); neuItem[k.id] = '' }

  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
    document.body.appendChild(a); a.click(); a.remove()
  }
  function exportCSV() {
    const rows = [[t('Kategorie'), t('Artikel'), t('Kritisch'), t('Erledigt')]]
    for (const k of kategorien) for (const i of k.alle) rows.push([k.titel, i.text, i.krit ? 'ja' : '', istAn($packliste.checked[i.id]) ? 'x' : ''])
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'Packliste-Outback.csv')
  }
  function druck() {
    const datum = new Date().toLocaleDateString(LOCALE)
    let body = `<h1>🚙 ${t('Packliste — Solo Outback')}</h1><p class="meta">${t('{erledigt}/{gesamt} erledigt ({prozent}%) · Stand {datum}', { erledigt, gesamt, prozent, datum })}</p>`
    for (const k of kategorien) {
      body += `<h2>${esc(k.icon)} ${esc(k.titel)}</h2><ul>`
      for (const i of k.alle) {
        const box = istAn($packliste.checked[i.id]) ? '☑' : '☐'
        const krit = i.krit ? ` <span class="krit">${t('★ wichtig')}</span>` : ''
        body += `<li><span class="box">${box}</span> ${esc(i.text)}${krit}</li>`
      }
      body += '</ul>'
    }
    const html = `<!doctype html><html lang="${istEn ? 'en' : 'de'}"><head><meta charset="utf-8"><title>${t('Packliste — Solo Outback')}</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#2b2621;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.5}
      h1{font-size:calc(24px * var(--schrift, 1));color:#8a3f16;margin:0 0 4px} .meta{color:#666;margin:0 0 18px;font-size:calc(13px * var(--schrift, 1))}
      h2{font-size:calc(16px * var(--schrift, 1));color:#8a3f16;border-bottom:2px solid #d98a3d;padding-bottom:4px;margin:20px 0 8px;break-after:avoid}
      ul{list-style:none;padding:0;margin:0} li{padding:3px 0;font-size:calc(14px * var(--schrift, 1));break-inside:avoid}
      .box{font-size:calc(17px * var(--schrift, 1));margin-right:6px} .krit{color:#c0392b;font-size:calc(12px * var(--schrift, 1));font-weight:700}
      @media print{a{display:none}}
    </style></head><body>${body}
    <p style="margin-top:24px;color:#999;font-size:11px">★ = überlebenswichtig im Outback · erstellt mit TravelBuddy</p>
    </body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html); w.document.close(); w.focus()
    setTimeout(() => w.print(), 300)
  }
</script>

<div class="pl">
  <div class="kopf">
    <div class="fortschritt">
      <div class="f-bar"><div class="f-fill" style="transform:scaleX({prozent / 100})"></div></div>
      <div class="f-text"><b>{erledigt}/{gesamt}</b> {t('gepackt · {prozent}%', { prozent })}</div>
    </div>
    <div class="aktionen">
      <button class="btn" onclick={druck}>{t('🖨️ Drucken / PDF')}</button>
      <button class="btn" onclick={exportCSV}>{t('📊 Excel/CSV')}</button>
      {#if erledigt > 0}<button class="btn ghost" onclick={async () => { if (await frage({ titel: t('Alle Haken entfernen?'), ja: t('Entfernen'), gefahr: true })) packZuruecksetzen() }}>{t('↺ Reset')}</button>{/if}
    </div>
  </div>
  <p class="hinweis">{t('Kontext:')} <b>{t('allein mit dem Auto durchs Outback')}</b>{t('. ★-Artikel sind überlebenswichtig, bitte nicht weglassen.')}</p>

  <div class="kats">
    {#each kategorien as k (k.id)}
      {@const kErl = k.alle.filter((i) => istAn($packliste.checked[i.id])).length}
      <section class="kat">
        <div class="k-kopf"><span class="k-icon">{k.icon}</span><span class="k-titel">{k.titel}</span><span class="k-zahl">{kErl}/{k.alle.length}</span></div>
        <ul class="items">
          {#each k.alle as i (i.id)}
            <li class="item" class:done={istAn($packliste.checked[i.id])}>
              <label>
                <input type="checkbox" checked={istAn($packliste.checked[i.id])} onchange={() => togglePack(i.id)} />
                <span class="i-text">{i.text}{#if i.krit}<span class="star" title={t('überlebenswichtig')}>★</span>{/if}</span>
              </label>
              {#if i.eigen}<button class="i-del" onclick={() => delPackItem(i.id)} title={t('entfernen')}>✕</button>{/if}
            </li>
          {/each}
        </ul>
        <div class="add">
          <input placeholder={t('+ eigener Artikel …')} bind:value={neuItem[k.id]} onkeydown={(e) => e.key === 'Enter' && addNeu(k)} />
          <button onclick={() => addNeu(k)} disabled={!(neuItem[k.id] || '').trim()}>+</button>
        </div>
      </section>
    {/each}
  </div>
</div>

<style>
  .kopf { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  .fortschritt { flex: 1 1 240px; }
  .f-bar { height: 12px; background: #eee3d2; border-radius: 8px; overflow: hidden; }
  .f-fill { height: 100%; background: linear-gradient(90deg, #d98a3d, #2f7a63); transform-origin: left; transition: transform var(--t-slow) var(--ease-spring); }
  .f-text { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); margin-top: 4px; }
  .f-text b { color: var(--ink); }
  .aktionen { display: flex; gap: 6px; flex-wrap: wrap; }
  .btn { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; padding: 8px 12px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 8px; cursor: pointer; }
  .btn.ghost { background: var(--card); color: var(--muted); }
  .hinweis { font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); background: var(--flaeche); padding: 9px 12px; border-radius: 8px; margin: 0 0 16px; }
  .hinweis b { color: var(--ink); }

  .kats { columns: 2; column-gap: 16px; }
  .kat { break-inside: avoid; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; box-shadow: var(--shadow); display: inline-block; width: 100%; }
  .k-kopf { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid var(--brand-2); }
  .k-icon { font-size: calc(18px * var(--schrift, 1)); }
  .k-titel { flex: 1; font-size: calc(14.5px * var(--schrift, 1)); font-weight: 800; color: var(--brand-text); }
  .k-zahl { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: #1f1408; background: var(--brand-2); padding: 1px 8px; border-radius: 9px; }
  .items { list-style: none; padding: 0; margin: 0; }
  /* Zeilen 44 px wie in iOS-Listen, Kästchen 22 px */
  .item { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 2px 0; min-height: 44px; }
  .item label { display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1; min-height: 44px; }
  .item input { margin: 0; width: 22px; height: 22px; accent-color: #2f7a63; flex: 0 0 auto; }
  .i-text { font-size: calc(13.5px * var(--schrift, 1)); color: var(--ink); line-height: 1.35; }
  .item.done .i-text { text-decoration: line-through; color: #a89e8e; }
  .star { color: var(--danger-text); font-size: calc(12px * var(--schrift, 1)); margin-left: 4px; vertical-align: top; }
  .i-del { border: none; background: none; color: var(--danger-text); cursor: pointer; font-size: calc(12px * var(--schrift, 1)); }
  .add { display: flex; gap: 5px; margin-top: 8px; }
  .add input { flex: 1; font-size: calc(12.5px * var(--schrift, 1)); padding: 6px 8px; border: 1px solid var(--line-stark); border-radius: 6px; background: var(--eingabe); color: var(--ink); }
  .add button { font-size: calc(14px * var(--schrift, 1)); font-weight: 700; width: 30px; border: 1px solid var(--line-stark); background: var(--btn-flaeche); color: var(--btn-ink); border-radius: 6px; cursor: pointer; }
  .add button:disabled { opacity: 0.4; }
  @media (max-width: 640px) { .kats { columns: 1; } }
</style>
