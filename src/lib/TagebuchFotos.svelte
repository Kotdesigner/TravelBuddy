<script>
  import { t, tn } from './i18n.js'
  // Fotos fürs Tagebuch: viele Fotos auf einmal, nur auf diesem Gerät.
  // Wie „Fotos einsortieren“ im Logbuch: Aufnahmedatum und Ort aus den Bilddaten lesen,
  // jedes Foto seinem Tag und seiner Etappe zuordnen, vorher zeigen, was passiert.
  // Gespeichert wird in einer eigenen Datenbank (tagebuch-fotos.js), nicht im Logbuch und
  // nicht im Backup. Gedacht für den Mac: dort stehen im Auswahlfenster unter „Medien“
  // alle iCloud-Fotos.
  import { onMount, onDestroy } from 'svelte'
  import { journal, reisen, gesamtStart } from './userdata.js'
  import { etappenMitDatum } from './plan.js'
  import { exifAusDatei } from './exif.js'
  import { zusammenfassung } from './foto-zuordnung.js'
  import {
    tagebuchFotos, tagebuchFotosGroesse, ladeTagebuchFotos, planeTagebuchFotos, nachEtappeUndTag, tagebuchAngaben,
    macheTagebuchBild, speichereTagebuchFoto, loescheTagebuchFoto, loescheAlleTagebuchFotos, groesseText, speicherFrei,
    bitteDauerhaft, geraetBild,
  } from './tagebuch-fotos.js'
  import { mitWochentag } from './format.js'
  import { zeigeToast } from './toast.js'
  import { loeschFrage } from './dialog.js'
  import { dauer, klapp } from './motion.js'

  let { orte = [], kompakt = false } = $props()

  const uid = Math.random().toString(36).slice(2, 8)
  const ZEIGE = 12                     // so viele Fotos je Tag, bis man aufklappt
  let eingabe = $state(null)
  let phase = $state('zu')             // zu | lesen | vorschau | speichern
  let verwalten = $state(false)
  let fotos = $state([])               // [{ id, file, name, groesse, lastModified, datum, zeit, lat, lon, url }]
  let raus = $state(new Set())
  let ohneDatumTag = $state('')
  let schritt = $state({ n: 0, von: 0 })
  let aufgeklappt = $state(new Set())  // Tage, deren Fotos alle zu sehen sind
  let frei = $state(null)
  let abbruch = false

  const etappen = $derived(etappenMitDatum($reisen, $gesamtStart))
  const plan = $derived(planeTagebuchFotos(fotos, { etappen, orte, vorhandene: $tagebuchFotos, journal: $journal, ohneDatumTag: ohneDatumTag || null, ausgeschlossen: raus }))
  const ohneOrt = $derived(plan.anzahl - plan.mitOrt)
  const abgelegt = $derived(nachEtappeUndTag($tagebuchFotos, etappen))

  const gruppenTitel = (g) => (g.art === 'etappe' ? g.etappe.reise?.name || t('Etappe')
    : g.art === 'vorher' ? t('Vor der Reise') : g.art === 'nachher' ? t('Nach der Reise') : t('Zwischen den Etappen'))
  const gruppenFarbe = (g) => (g.art === 'etappe' ? g.etappe.reise?.farbe || 'var(--brand)' : 'var(--line-stark)')
  const sichtbar = (schluessel, liste) => (aufgeklappt.has(schluessel) ? liste : liste.slice(0, ZEIGE))
  const klappe = (schluessel) => { const s = new Set(aufgeklappt); s.has(schluessel) ? s.delete(schluessel) : s.add(schluessel); aufgeklappt = s }

  onMount(() => {
    ladeTagebuchFotos()
    speicherFrei().then((x) => (frei = x))
  })

  function waehlen() { eingabe?.click() }

  async function gewaehlt(e) {
    const dateien = [...(e.target.files || [])]
    e.target.value = ''
    if (!dateien.length) return
    aufraeumen()
    abbruch = false
    verwalten = false
    phase = 'lesen'
    schritt = { n: 0, von: dateien.length }
    ohneDatumTag = ''
    const liste = []
    for (const [i, f] of dateien.entries()) {
      if (abbruch) return
      const x = await exifAusDatei(f)
      liste.push({
        id: i + 1, file: f, name: f.name || t('Foto {wert}', { wert: i + 1 }), groesse: f.size, lastModified: f.lastModified,
        datum: x.datum, zeit: x.zeit, lat: x.lat, lon: x.lon,
        url: (() => { try { return URL.createObjectURL(f) } catch { return '' } })(),
      })
      schritt = { n: i + 1, von: dateien.length }
    }
    fotos = liste
    raus = new Set()
    aufgeklappt = new Set()
    phase = 'vorschau'
  }

  function aufraeumen() {
    for (const f of fotos) if (f.url) try { URL.revokeObjectURL(f.url) } catch {}
    fotos = []
  }
  function schliessen() {
    abbruch = true
    aufraeumen()
    phase = 'zu'
  }
  onDestroy(() => { abbruch = true; aufraeumen() })

  function weglassen(ids) { const s = new Set(raus); for (const id of ids) s.add(id); raus = s }

  async function uebernehmen() {
    const liste = plan.gruppen.flatMap((g) => g.tage.flatMap((tg) => tg.fotos))
    if (!liste.length) return
    phase = 'speichern'
    abbruch = false
    schritt = { n: 0, von: liste.length }
    bitteDauerhaft()
    let gespeichert = 0, fehler = 0, voll = false
    for (const foto of liste) {
      if (abbruch) break
      try {
        const bild = await macheTagebuchBild(foto.file)
        await speichereTagebuchFoto(tagebuchAngaben(foto, bild), bild, { melden: false })
        gespeichert++
        // Das Tagebuch dahinter nur alle zehn Fotos auffrischen, nicht nach jedem
        if (gespeichert % 10 === 0) await ladeTagebuchFotos()
      } catch (e) {
        if (e?.name === 'QuotaExceededError') { voll = true; break }
        fehler++
      }
      schritt = { n: schritt.n + 1, von: liste.length }
    }
    await ladeTagebuchFotos()
    aufraeumen()
    phase = 'zu'
    speicherFrei().then((x) => (frei = x))
    if (gespeichert) zeigeToast(t('{fotos} fürs Tagebuch gespeichert, nur auf diesem Gerät', { fotos: tn(gespeichert, '{n} Foto', '{n} Fotos') }), 'ok', 4000)
    if (voll) zeigeToast(t('Der Speicher im Browser ist voll. Lösche Fotos oder gib Platz auf dem Gerät frei.'), 'fehler', 8000)
    if (fehler) zeigeToast(tn(fehler, '{n} Bild ließ sich nicht öffnen. HEIC klappt nur in Safari.', '{n} Bilder ließen sich nicht öffnen. HEIC klappt nur in Safari.'), 'fehler', 6000)
  }

  async function entfernen(f) {
    try { await loescheTagebuchFoto(f.id) } catch { zeigeToast(t('Das hat nicht geklappt.'), 'fehler') }
    speicherFrei().then((x) => (frei = x))
  }
  async function alleLoeschen() {
    const n = $tagebuchFotos.length
    if (!n) return
    if (!(await loeschFrage(tn(n, '{n} Foto fürs Tagebuch', '{n} Fotos fürs Tagebuch'), t('Sie liegen nur auf diesem Gerät. Die Fotos in deiner Mediathek und im Logbuch bleiben.')))) return
    try { await loescheAlleTagebuchFotos(); verwalten = false } catch { zeigeToast(t('Das hat nicht geklappt.'), 'fehler') }
    speicherFrei().then((x) => (frei = x))
  }
</script>

<div class="tf" class:kompakt>
  {#if !kompakt}
    <h3 class="tf-titel"><span aria-hidden="true">📷</span> {t('Fotos fürs Tagebuch')}</h3>
    <p class="tf-tipp">{t('Für viele Fotos auf einmal, am besten am Mac: Jedes Foto landet an seinem Aufnahmetag und in seiner Etappe. Im Auswahlfenster links unter „Medien“ auf „Fotos“ klicken, dort sind alle iCloud-Fotos. Die Fotos bleiben nur auf diesem Gerät und kommen nicht ins Backup.')}</p>
  {/if}
  <div class="tf-zeile">
    <button type="button" class="btn tf-knopf" onclick={waehlen} disabled={phase === 'lesen' || phase === 'speichern'}
      aria-expanded={phase !== 'zu'} aria-controls="tf-panel-{uid}">
      <span aria-hidden="true">🖼️</span> {t('Fotos fürs Tagebuch hinzufügen')}
    </button>
    {#if $tagebuchFotos.length}
      <button type="button" class="btn btn-ghost tf-knopf" onclick={() => (verwalten = !verwalten)} aria-expanded={verwalten} aria-controls="tf-verwalten-{uid}"
        disabled={phase !== 'zu'}>{verwalten ? t('Fertig') : t('Verwalten')}</button>
    {/if}
  </div>
  <input bind:this={eingabe} class="tf-datei" type="file" accept="image/*,.heic,.heif" multiple onchange={gewaehlt} tabindex="-1" aria-hidden="true" />
  <p class="tf-stand" aria-live="polite">
    {#if $tagebuchFotos.length}
      {t('{fotos} · {groesse} auf diesem Gerät, nicht im Backup', { fotos: tn($tagebuchFotos.length, '{n} Foto', '{n} Fotos'), groesse: groesseText($tagebuchFotosGroesse) })}{#if frei != null}{t(' · noch {wert} frei', { wert: groesseText(frei) })}{/if}
    {:else if kompakt}
      {t('Noch keine Fotos fürs Tagebuch auf diesem Gerät.')}
    {/if}
  </p>

  {#if phase !== 'zu'}
    <section class="tf-panel" id="tf-panel-{uid}" aria-labelledby="tf-ptitel-{uid}" transition:klapp={{ duration: dauer(220) }}>
      <h4 id="tf-ptitel-{uid}">{t('Fotos fürs Tagebuch einsortieren')}</h4>

      {#if phase === 'lesen'}
        <p class="tf-status" aria-live="polite">{t('Lese Aufnahmedaten … {n} von {von}', { n: schritt.n, von: schritt.von })}</p>
        <div class="tf-balken" aria-hidden="true"><span style="transform: scaleX({schritt.von ? schritt.n / schritt.von : 0})"></span></div>
        <button class="btn" onclick={schliessen}>{t('Abbrechen')}</button>

      {:else if phase === 'speichern'}
        <p class="tf-status" aria-live="polite">{t('Verkleinere und speichere … {n} von {von}', { n: schritt.n, von: schritt.von })}</p>
        <div class="tf-balken" aria-hidden="true"><span style="transform: scaleX({schritt.von ? schritt.n / schritt.von : 0})"></span></div>
        <button class="btn" onclick={() => (abbruch = true)}>{t('Anhalten')}</button>
        <p class="tf-leise">{t('Was schon gespeichert ist, bleibt.')}</p>

      {:else}
        <p class="tf-summe" aria-live="polite"><b>{zusammenfassung(plan)}</b></p>
        {#if plan.schonDa}
          <p class="tf-hinweis">{tn(plan.schonDa, '{n} Foto ist schon im Tagebuch und wird übersprungen.', '{n} Fotos sind schon im Tagebuch und werden übersprungen.')}</p>
        {/if}
        {#if plan.imLogbuch}
          <p class="tf-hinweis">{tn(plan.imLogbuch, '{n} Foto ist schon im Logbuch und wird übersprungen.', '{n} Fotos sind schon im Logbuch und werden übersprungen.')}</p>
        {/if}
        {#if plan.anzahl && ohneOrt > 0}
          <p class="tf-hinweis">{ohneOrt === plan.anzahl ? t('Kein Foto hat einen Aufnahmeort.') : tn(ohneOrt, '{n} Foto hat keinen Aufnahmeort.', '{n} Fotos haben keinen Aufnahmeort.')} {t('Tag und Etappe stimmen trotzdem, sie kommen aus dem Aufnahmedatum.')}</p>
        {/if}

        {#if plan.ohneDatum.length}
          <div class="tf-ohne">
            <label for="tf-tag-{uid}">{tn(plan.ohneDatum.length, '{n} Foto hat kein Aufnahmedatum. Auf welchen Tag?', '{n} Fotos haben kein Aufnahmedatum. Auf welchen Tag?')}</label>
            <input id="tf-tag-{uid}" type="date" bind:value={ohneDatumTag} />
            {#if !ohneDatumTag}<span class="tf-leise">{t('Ohne Tag bleiben sie draußen.')}</span>{/if}
          </div>
        {/if}

        <div class="tf-gruppen">
          {#each plan.gruppen as g (g.id)}
            <section class="tf-gruppe" style="--gf:{gruppenFarbe(g)}" aria-label={gruppenTitel(g)}>
              <h5 class="tf-gkopf">{gruppenTitel(g)} <span>{tn(g.tage.reduce((n, x) => n + x.fotos.length, 0), '{n} Foto', '{n} Fotos')}</span></h5>
              <ol class="tf-tage">
                {#each g.tage as tg (tg.datum)}
                  <li class="tf-tag">
                    <div class="tf-tag-kopf">
                      <b>{mitWochentag(tg.datum)}</b>
                      <span class="tf-pill">{tn(tg.fotos.length, '{n} Foto', '{n} Fotos')}</span>
                      <button class="tf-klein" onclick={() => weglassen(tg.fotos.map((f) => f.id))}>{t('Tag weglassen')}</button>
                    </div>
                    <ul class="tf-bilder">
                      {#each sichtbar('v' + tg.datum, tg.fotos) as f (f.id)}
                        <li class="tf-bild">
                          {#if f.url}<img src={f.url} alt="" loading="lazy" decoding="async" onerror={(e) => e.currentTarget.classList.add('kaputt')} />{/if}
                          <span class="tf-ph" aria-hidden="true">📷</span>
                          {#if f.lat != null}<span class="tf-pin" title={f.ort?.name || t('mit Ort')} aria-hidden="true">📍</span>{/if}
                          <button class="tf-weg" onclick={() => weglassen([f.id])} aria-label={t('{name} nicht übernehmen', { name: f.name })}>✕</button>
                          {#if f.ort}<span class="tf-ort">{f.ort.name}</span>{/if}
                        </li>
                      {/each}
                    </ul>
                    {#if tg.fotos.length > ZEIGE}
                      <button class="tf-klein" onclick={() => klappe('v' + tg.datum)} aria-expanded={aufgeklappt.has('v' + tg.datum)}>
                        {aufgeklappt.has('v' + tg.datum) ? t('Weniger zeigen') : t('Alle {n} zeigen', { n: tg.fotos.length })}
                      </button>
                    {/if}
                  </li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>

        <div class="tf-aktion">
          <button class="btn" onclick={schliessen}>{t('Abbrechen')}</button>
          <button class="btn-primary" onclick={uebernehmen} disabled={!plan.zumSpeichern}>
            {plan.zumSpeichern ? tn(plan.zumSpeichern, '{n} Foto speichern', '{n} Fotos speichern') : t('Nichts zu übernehmen')}
          </button>
        </div>
      {/if}
    </section>
  {/if}

  {#if verwalten && phase === 'zu' && $tagebuchFotos.length}
    <section class="tf-panel" id="tf-verwalten-{uid}" aria-labelledby="tf-vtitel-{uid}" transition:klapp={{ duration: dauer(220) }}>
      <h4 id="tf-vtitel-{uid}">{t('Fotos fürs Tagebuch auf diesem Gerät')}</h4>
      <div class="tf-gruppen">
        {#each abgelegt as g (g.id)}
          <section class="tf-gruppe" style="--gf:{gruppenFarbe(g)}" aria-label={gruppenTitel(g)}>
            <h5 class="tf-gkopf">{gruppenTitel(g)} <span>{tn(g.tage.reduce((n, x) => n + x.fotos.length, 0), '{n} Foto', '{n} Fotos')}</span></h5>
            <ol class="tf-tage">
              {#each g.tage as tg (tg.datum)}
                <li class="tf-tag">
                  <div class="tf-tag-kopf"><b>{mitWochentag(tg.datum)}</b><span class="tf-pill">{tn(tg.fotos.length, '{n} Foto', '{n} Fotos')}</span></div>
                  <ul class="tf-bilder">
                    {#each sichtbar('g' + tg.datum, tg.fotos) as f (f.id)}
                      <li class="tf-bild">
                        <img use:geraetBild={f.id} alt="" decoding="async" />
                        <span class="tf-ph" aria-hidden="true">📷</span>
                        <button class="tf-weg" onclick={() => entfernen(f)} aria-label={t('Foto vom {datum} entfernen', { datum: mitWochentag(tg.datum) })}>✕</button>
                        {#if f.ort}<span class="tf-ort">{f.ort}</span>{/if}
                      </li>
                    {/each}
                  </ul>
                  {#if tg.fotos.length > ZEIGE}
                    <button class="tf-klein" onclick={() => klappe('g' + tg.datum)} aria-expanded={aufgeklappt.has('g' + tg.datum)}>
                      {aufgeklappt.has('g' + tg.datum) ? t('Weniger zeigen') : t('Alle {n} zeigen', { n: tg.fotos.length })}
                    </button>
                  {/if}
                </li>
              {/each}
            </ol>
          </section>
        {/each}
      </div>
      <div class="tf-aktion">
        <button class="btn-danger" onclick={alleLoeschen}>{t('Alle löschen')}</button>
      </div>
    </section>
  {/if}
</div>

<style>
  .tf {
    display: flex; flex-direction: column; gap: 8px; align-items: flex-start; min-width: 0;
    background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); padding: 12px 14px; margin-bottom: 16px;
  }
  .tf.kompakt { background: none; border: none; padding: 0; margin: 0 0 10px; }
  .tf-titel { margin: 0; font-size: calc(15px * var(--schrift, 1)); display: flex; gap: 6px; align-items: center; }
  .tf-tipp { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); line-height: 1.45; max-width: 68ch; }
  .tf-zeile { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; }
  .tf-knopf { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; }
  .tf-knopf:disabled { opacity: 0.5; cursor: default; }
  .tf-datei { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; overflow: hidden; }
  .tf-stand { margin: 0; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .tf-stand:empty { display: none; }

  .tf-panel {
    align-self: stretch; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m);
    box-shadow: var(--shadow); padding: 12px 14px; display: flex; flex-direction: column; gap: 10px;
  }
  .tf-panel h4 { margin: 0; font-size: calc(16px * var(--schrift, 1)); }
  .tf-status { margin: 0; font-size: calc(14px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .tf-balken { height: 6px; border-radius: 3px; background: var(--flaeche-2); overflow: hidden; }
  .tf-balken span { display: block; height: 100%; background: var(--brand); transform-origin: left; transition: transform var(--t-med) var(--ease-out); }
  .tf-summe { margin: 0; font-size: calc(16px * var(--schrift, 1)); font-variant-numeric: tabular-nums; }
  .tf-hinweis { margin: 0; font-size: calc(13px * var(--schrift, 1)); line-height: 1.45; background: var(--flaeche); border-radius: var(--radius-s); padding: 8px 10px; color: var(--ink); }
  .tf-leise { margin: 0; font-size: calc(12.5px * var(--schrift, 1)); color: var(--muted); }
  .tf-ohne { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: calc(13.5px * var(--schrift, 1)); }
  .tf-ohne input { min-height: 44px; padding: 6px 10px; border: 1px solid var(--line-stark); background: var(--eingabe); color: var(--ink); font-size: calc(15px * var(--schrift, 1)); }

  .tf-gruppen { display: flex; flex-direction: column; gap: 14px; max-height: 60vh; overflow-y: auto; overscroll-behavior: contain; }
  .tf-gruppe { border-left: 5px solid var(--gf); padding-left: 10px; }
  .tf-gkopf { margin: 0 0 8px; font-size: calc(14.5px * var(--schrift, 1)); }
  .tf-gkopf span { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); margin-left: 4px; }
  .tf-tage { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .tf-tag { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
  .tf-tag-kopf { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: calc(14px * var(--schrift, 1)); }
  .tf-pill { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; padding: 2px 8px; border-radius: 9px; background: var(--flaeche-2); color: var(--muted); }
  .tf-klein {
    font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--btn-ink); background: none; border: 1px dashed var(--line-stark);
    border-radius: 8px; padding: 6px 10px; min-height: 32px; cursor: pointer;
  }
  .tf-bilder { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
  .tf-bild { position: relative; width: 72px; display: flex; flex-direction: column; gap: 3px; }
  .tf-bild img, .tf-ph { width: 72px; height: 72px; border-radius: 8px; object-fit: cover; border: 1px solid var(--line); background: var(--flaeche-2); }
  .tf-bild img { position: relative; z-index: 1; }
  .tf-bild img:not([src]) { visibility: hidden; }
  .tf-bild :global(img.kaputt) { visibility: hidden; }
  .tf-ph { position: absolute; top: 0; left: 0; display: grid; place-items: center; font-size: calc(22px * var(--schrift, 1)); }
  .tf-pin { position: absolute; z-index: 2; left: 3px; top: 50px; font-size: calc(13px * var(--schrift, 1)); filter: drop-shadow(0 1px 1px rgba(0,0,0,.4)); }
  .tf-weg {
    position: absolute; z-index: 2; top: -8px; right: -8px; width: 30px; height: 30px; border-radius: 50%;
    border: 2px solid var(--card); background: var(--ink); color: var(--bg); font-size: calc(12px * var(--schrift, 1)); cursor: pointer; line-height: 1;
  }
  .tf-weg::after { content: ''; position: absolute; inset: -7px; }
  .tf-ort { font-size: calc(12px * var(--schrift, 1)); line-height: 1.2; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tf-aktion { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
</style>
