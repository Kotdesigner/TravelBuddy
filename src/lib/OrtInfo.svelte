<script>
  // Kurzinfo zu einem Ort unter einer Karte: Bild, Etiketten, Text, Sonne, Anreise, Abstand zur Route,
  // Knöpfe Google Maps, Einplanen und zur Kachel. Gleich in der Karte der Gegend und bei den Routen-Ideen.
  import { t, je } from './i18n.js'
  import { naechsteReise } from './wander-zuordnung.js'
  import { INSELN, ANREISE_ZEICHEN, abfahrtPunkt } from './inseln.js'
  import { userData } from './userdata.js'
  import { reiseDatum } from './reisedatum.js'
  import { sonnenZeiten } from './sonne.js'
  import { dauer, klapp } from './motion.js'

  let { o, nummer = null, nummerFarbe = null, reisen = [], unter = '', onzu = null, onkachel = null, kachelText = '' } = $props()

  const bildVon = (x) => $userData[x.id]?.bilder?.[0] || x.bildData || (x.bild ? '/' + x.bild : null)
  const sonne = $derived(o?.lat != null ? sonnenZeiten(o.lat, o.lon, $reiseDatum) : null)
  const nah = $derived.by(() => { const n = o ? naechsteReise(abfahrtPunkt(o), reisen) : null; return n ? { name: n.reise.name, km: n.km } : null })
  const insel = $derived(o ? INSELN[o.id] : null)
  const bild = $derived(o ? bildVon(o) : null)
  const mapsUrl = (x) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(x.mapsQuery || `${x.lat},${x.lon}`)
</script>

    <div class="rk-info" transition:klapp={{ duration: dauer(180) }} role="region" aria-label={o.anzeigeName || o.name}>
      <div class="rk-info-kopf">
        {#if bild}<img class="rk-bild" src={bild} alt="" />{:else}<span class="rk-bild leer" aria-hidden="true">{o.emoji || '📍'}</span>{/if}
        <div class="rk-info-titel">
          <b>{#if nummer}<span class="rk-nr" style={nummerFarbe ? `background:${nummerFarbe}` : null}>{nummer}</span> {/if}{o.anzeigeName || o.name}</b>
          {#if unter}<span class="rk-unter">{unter}</span>{/if}
          {#if o.tags?.length}<span class="rk-tags">{#each o.tags as tag}<span class="rk-tag" class:geheim={tag === 'GEHEIMTIPP'} class:wd={tag === 'NUR-4WD' || tag === 'EXPEDITION'}>{t(tag)}</span>{/each}</span>{/if}
        </div>
        <button class="rk-zu" onclick={() => onzu?.()} aria-label={je('Schließen', 'Close')}>✕</button>
      </div>
      {#if o.beschreibung}<p class="rk-text">{o.beschreibung}</p>{/if}
      <p class="rk-zeilen">
        {#if sonne}<span>🌅 {sonne.aufgang}</span><span>🌇 {sonne.untergang}</span>{/if}
        {#if insel}<span class="rk-anreise">{ANREISE_ZEICHEN[insel.art]} {insel.text}</span>{/if}
        {#if nah}<span class="rk-nah">🛣️ {nah.km < 1 ? je(`direkt an ${nah.name}`, `right on ${nah.name}`) : je(`${nah.km} km neben ${nah.name}`, `${nah.km} km from ${nah.name}`)}</span>{/if}
      </p>
      <div class="rk-knoepfe">
        <a class="bedien-knopf" href={mapsUrl(o)} target="_blank" rel="noopener">Google Maps</a>
        <button class="bedien-knopf" onclick={() => onkachel?.(o.id, true)}>{je('Einplanen', 'Add to trip')}</button>
        <button class="bedien-knopf haupt" onclick={() => onkachel?.(o.id)}>{kachelText || je('Zur Kachel ↓', 'To the tile ↓')}</button>
      </div>
    </div>

<style>
  .rk-info { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--line-stark); border-radius: 12px; background: var(--flaeche); }
  .rk-info-kopf { display: flex; gap: 10px; align-items: flex-start; }
  .rk-bild { width: 60px; height: 60px; flex: none; border-radius: 8px; object-fit: cover; background: var(--card); }
  .rk-bild.leer { display: flex; align-items: center; justify-content: center; font-size: calc(26px * var(--schrift, 1)); }
  .rk-info-titel { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .rk-unter { font-size: calc(12px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .rk-info-titel b { font-size: calc(15px * var(--schrift, 1)); color: var(--ink); }
  .rk-nr { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px; background: var(--karte-punkt); color: var(--karte-zahl); font-size: calc(11px * var(--schrift, 1)); font-weight: 800; vertical-align: 1px; }
  .rk-tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .rk-tag { font-size: calc(11px * var(--schrift, 1)); font-weight: 800; padding: 2px 8px; border-radius: 20px; background: var(--ok-flaeche); color: var(--ok-text); }
  .rk-tag.geheim { background: var(--info-flaeche); color: var(--info-text); }
  .rk-tag.wd { background: var(--warn-flaeche); color: var(--btn-ink); }
  .rk-zu { width: 44px; height: 44px; flex: none; border: 1px solid var(--line-stark); border-radius: 9px; background: var(--card); color: var(--btn-ink); cursor: pointer; }
  .rk-info p { margin: 0; }
  .rk-text { font-size: calc(13.5px * var(--schrift, 1)); line-height: 1.45; color: var(--ink); display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  .rk-zeilen { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: calc(12.5px * var(--schrift, 1)); font-weight: 700; color: var(--muted); }
  .rk-anreise { color: var(--info-text); }
  .rk-nah { color: var(--brand-text); }
  .rk-knoepfe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 2px; }
  .rk-knoepfe .bedien-knopf { text-decoration: none; text-align: center; padding: 0 8px; font-size: calc(13px * var(--schrift, 1)); }
  @media (max-width: 380px) { .rk-knoepfe { grid-template-columns: 1fr 1fr; } .rk-knoepfe .haupt { grid-column: 1 / -1; } }
</style>
