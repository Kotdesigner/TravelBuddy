<script>
  import { t, tn } from '../i18n.js'
  // Kleines Musik-Symbol mit Zähler. Der Zähler zählt nur Titel, die Spotify nachweislich in
  // die Playlist übernommen hat und die noch nicht angesehen wurden. Ein bloßer Suchtreffer
  // oder ein laufender Abruf zählt nicht.
  // Bewusst ein neutrales Noten-Symbol in Spotify-Grün, nicht das Spotify-Logo selbst.
  // V35: dauerhaft grün, sobald Spotify ganz eingerichtet ist (verbunden, Playlist verknüpft, Sammeln an),
  // sonst überall neutral. Der rote Zähler kommt wie bisher dazu.
  import { musik, musikCfg, musikNeu } from './speicher.js'
  import { istVerbunden } from './spotify.js'

  let { geh = () => {}, hell = false } = $props()
  const n = $derived($musikNeu)
  const eingerichtet = $derived(!!$musik.playlist?.id && !!$musikCfg.aktiv && istVerbunden())
</script>

<button class="ms" class:hell class:hat={n > 0} class:fertig={eingerichtet} onclick={() => geh('mehr/musik')}
  aria-label={n ? tn(n, 'Musik unterwegs: {n} neuer Titel in Sounds of the Road', 'Musik unterwegs: {n} neue Titel in Sounds of the Road') : t('Musik unterwegs')}
  title={t('Sounds of the Road')}>
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 17.5a2.5 2.5 0 1 1-2.5-2.5c.53 0 1 .16 1.4.43V6.2l10-2.2v11.5a2.5 2.5 0 1 1-2.5-2.5c.53 0 1 .16 1.4.43V7.3L10 8.9v8.6Z" fill="currentColor" /></svg>
  {#if n > 0}<span class="ms-zahl" aria-hidden="true">{n > 99 ? '99+' : n}</span>{/if}
</button>

<style>
  .ms {
    position: relative; flex: none; width: 44px; height: 44px; border-radius: 50%; cursor: pointer;
    display: grid; place-items: center; border: 1px solid var(--line); background: var(--card); color: var(--muted);
    transition: transform 120ms var(--ease-out), background-color var(--t-med) var(--ease-out);
  }
  .ms.hat { background: #1db954; border-color: #1db954; color: #062b14; }
  .ms.hell { background: rgba(255, 255, 255, 0.16); border-color: rgba(255, 255, 255, 0.35); color: #fff; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
  .ms.hell.hat { background: #1db954; color: #062b14; }
  .ms.fertig, .ms.hell.fertig { background: #1db954; border-color: #1db954; color: #062b14; }
  .ms-zahl {
    position: absolute; top: -4px; right: -4px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
    background: #c0392b; color: #fff; font-size: calc(12px * var(--schrift, 1)); font-weight: 800; line-height: 20px; text-align: center;
    box-shadow: 0 0 0 2px var(--bg); animation: rein-auf var(--t-med) var(--ease-spring);
  }
</style>
