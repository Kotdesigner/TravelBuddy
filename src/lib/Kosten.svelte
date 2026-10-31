<script>
  // Mehr → Kosten: alles, was die Reise gekostet hat, aus Vorabausgaben und Logbuch, nach Clustern.
  // Eine Reihe Balken je Liste in einer Farbe, die Beträge stehen immer als Zahl daneben.
  import { t, tn } from './i18n.js'
  import { journal, vorabKosten, reisen, gesamtStart } from './userdata.js'
  import { etappenMitDatum } from './plan.js'
  import { fxKurse } from './fx.js'
  import { eur, aud, dezimal, tagMonat, bereich } from './format.js'
  import { kostenAuswertung, postenAuswahl, KATEGORIE } from './kosten.js'

  const a = $derived(kostenAuswertung({ journal: $journal, vorab: $vorabKosten, kurse: $fxKurse, eintraege: etappenMitDatum($reisen, $gesamtStart) }))
  const paar = (x) => `${eur(x.eur)} · ${aud(x.aud)}`
  const breite = (teil, ganz) => `${Math.max(1.5, ganz ? (teil / ganz) * 100 : 0)}%`
  const groessteEtappe = $derived(Math.max(0, ...a.etappen.map((e) => e.eur)))
  const cluster = (id) => a.cluster.find((c) => c.id === id)

  const ZEIGEN = 40
  let wahl = $state('alle')
  const auswahl = $derived(postenAuswahl(a, wahl))
</script>

<section class="ko" aria-label={t('Kosten')}>
  {#if !a.gesamt.eur && !a.gesamt.aud}
    <div class="ko-karte">
      <p>{t('Noch keine Ausgaben. Trag sie im Logbuch unter „Kosten & Verkehr“ ein oder vorab in der Reisevorbereitung.')}</p>
      <a class="btn-primary ko-link" href="#/logbuch">{t('Zum Logbuch')}</a>
    </div>
  {:else}
    <div class="ko-kacheln">
      <div class="ko-kachel gross"><span>{t('Gesamt')}</span><b>{eur(a.gesamt.eur)}</b><small>{aud(a.gesamt.aud)}</small></div>
      <div class="ko-kachel"><span>{t('Vor der Reise')}</span><b>{eur(a.vorab.eur)}</b><small>{aud(a.vorab.aud)}</small></div>
      <div class="ko-kachel"><span>{t('Unterwegs')}</span><b>{eur(a.unterwegs.eur)}</b><small>{aud(a.unterwegs.aud)}</small></div>
      <div class="ko-kachel"><span>🪙 {t('Short-Values')}</span><b>{eur(cluster('short').eur)}</b><small>{aud(cluster('short').aud)}</small></div>
      <div class="ko-kachel"><span>📦 {t('Long-Values')}</span><b>{eur(cluster('long').eur)}</b><small>{aud(cluster('long').aud)}</small></div>
      {#if a.proTag}
        <div class="ko-kachel gross">
          <span>{t('Pro Tag ohne Long-Values')}</span><b>{eur(a.proTag.eur)}</b>
          <small>{aud(a.proTag.aud)} · {tn(a.tage, 'aus {n} Tag mit Ausgaben', 'aus {n} Tagen mit Ausgaben')}</small>
          <small>{t('Davon Short-Values pro Tag: {betrag}', { betrag: eur(a.shortProTag.eur) })}</small>
        </div>
      {/if}
    </div>

    {#each a.cluster.filter((c) => c.kategorien.length) as c (c.id)}
      <div class="ko-karte ko-cluster">
        <h2><span><span class="ko-c-name"><span aria-hidden="true">{c.icon}</span> {c.label}</span><small>{c.info}</small></span><b class="ko-c-summe">{paar(c)}</b></h2>
        <ul class="ko-liste">
          {#each c.kategorien as k (k.id)}
            <li>
              <span class="ko-zeile"><span><span aria-hidden="true">{k.icon}</span> {k.label}</span><b>{paar(k)}</b></span>
              <span class="ko-balken" aria-hidden="true"><span style="width:{breite(k.eur, c.eur)}"></span></span>
            </li>
          {/each}
        </ul>
      </div>
    {/each}

    <div class="ko-karte">
      <h2>{t('Posten auswerten')}</h2>
      <select aria-label={t('Auswahl')} bind:value={wahl}>
        <option value="alle">{t('Alle Ausgaben')}</option>
        {#each a.cluster.filter((c) => c.kategorien.length) as c (c.id)}
          <optgroup label={c.label}>
            <option value="cluster:{c.id}">{t('Ganzer Cluster: {label}', { label: c.label })}</option>
            {#each c.kategorien as k (k.id)}<option value={k.id}>{k.icon} {k.label}</option>{/each}
          </optgroup>
        {/each}
      </select>
      <p class="ko-auswahl"><b>{paar(auswahl)}</b><small>{tn(auswahl.anzahl, '{n} Posten', '{n} Posten')}{#if auswahl.anzahl}&nbsp;· {t('Im Schnitt {betrag} je Posten', { betrag: eur(auswahl.proPosten) })}{/if}</small></p>
      <ul class="ko-posten">
        {#each auswahl.posten.slice(0, ZEIGEN) as p, i (i)}
          <li>
            <span class="ko-tag">{bereich(p.datum, p.bis) || tagMonat(p.datum)}</span>
            <span class="ko-was"><span aria-hidden="true">{KATEGORIE[p.kat]?.icon}</span> {p.text || KATEGORIE[p.kat]?.label}{#if p.vorab}<small>{t('vorab')}</small>{/if}</span>
            <b>{dezimal(p.betrag, 2)} {p.waehrung}</b>
          </li>
        {/each}
      </ul>
      {#if auswahl.anzahl > ZEIGEN}<p class="ko-hinweis">{t('… und {n} weitere', { n: auswahl.anzahl - ZEIGEN })}</p>{/if}
    </div>

    <div class="ko-karte ko-etappen">
      <h2>{t('Je Etappe')}</h2>
      <ul class="ko-liste">
        {#each a.etappen as e (e.id)}
          <li>
            <span class="ko-zeile"><span>{e.name}</span><b>{paar(e)}</b></span>
            <span class="ko-balken" aria-hidden="true"><span style="width:{breite(e.eur, groessteEtappe)}"></span></span>
          </li>
        {/each}
      </ul>
    </div>

    <p class="ko-hinweis">{t('Beide Währungen stehen zum Tageskurs der Ausgabe da. Einträge über mehrere Tage zählen einmal.')}</p>
  {/if}
</section>

<style>
  .ko { display: flex; flex-direction: column; gap: 12px; }
  .ko-karte { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; }
  .ko-karte p { margin: 0; }
  .ko-karte h2 { margin: 0; font-size: calc(16px * var(--schrift, 1)); display: flex; justify-content: space-between; gap: 10px; }
  .ko-karte h2 > span { display: flex; flex-direction: column; min-width: 0; }
  .ko-c-name { display: block; }
  .ko-karte h2 small { font-size: calc(12.5px * var(--schrift, 1)); font-weight: 400; color: var(--muted); }
  .ko-c-summe { flex: none; text-align: right; font-variant-numeric: tabular-nums; }
  select { font-size: max(16px, calc(14px * var(--schrift, 1))); min-height: 44px; padding: 6px 10px; border: 1px solid var(--line-stark); border-radius: var(--radius-s); background: var(--eingabe); color: var(--ink); width: 100%; }
  .ko-auswahl { display: flex; flex-direction: column; gap: 2px; font-variant-numeric: tabular-nums; }
  .ko-auswahl small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
  .ko-was small { margin-left: 6px; font-size: calc(12px * var(--schrift, 1)); color: var(--muted); }
  .ko-link { text-align: center; text-decoration: none; }
  .ko-kacheln { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .ko-kachel { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-m); padding: 12px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .ko-kachel.gross { grid-column: 1 / -1; }
  .ko-kachel span { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); font-weight: 700; }
  .ko-kachel b { font-size: calc(22px * var(--schrift, 1)); font-variant-numeric: tabular-nums; }
  .ko-kachel.gross b { font-size: calc(30px * var(--schrift, 1)); }
  .ko-kachel small { font-size: calc(13px * var(--schrift, 1)); color: var(--muted); font-variant-numeric: tabular-nums; }
  .ko-liste, .ko-posten { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .ko-zeile { display: flex; justify-content: space-between; gap: 10px; font-size: calc(14px * var(--schrift, 1)); }
  .ko-zeile b { font-variant-numeric: tabular-nums; text-align: right; flex: none; }
  .ko-balken { display: block; height: 8px; margin-top: 4px; border-radius: 4px; background: var(--flaeche-2); overflow: hidden; }
  .ko-balken span { display: block; height: 100%; border-radius: 4px; background: var(--brand); }
  .ko-posten { gap: 6px; }
  .ko-posten li { display: grid; grid-template-columns: 76px 1fr auto; gap: 8px; align-items: baseline; font-size: calc(14px * var(--schrift, 1)); }
  .ko-tag { color: var(--muted); font-size: calc(13px * var(--schrift, 1)); }
  .ko-was { min-width: 0; overflow-wrap: anywhere; }
  .ko-posten b { font-variant-numeric: tabular-nums; }
  .ko-hinweis { margin: 0; text-align: center; font-size: calc(13px * var(--schrift, 1)); color: var(--muted); }
</style>
