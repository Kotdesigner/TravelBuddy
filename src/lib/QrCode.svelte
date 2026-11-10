<script>
  // QR-Code als SVG, ganz auf dem Gerät gezeichnet (qrcode-generator, MIT). Immer dunkel auf weiß,
  // auch im dunklen Design, sonst lesen ihn manche Kameras nicht.
  import qrcode from 'qrcode-generator'

  let { inhalt = '', groesse = 220, label = '' } = $props()

  const svg = $derived.by(() => {
    if (!inhalt) return ''
    try {
      const q = qrcode(0, 'M')
      q.addData(inhalt, 'Byte')
      q.make()
      return q.createSvgTag({ cellSize: 4, margin: 3, scalable: true })
    } catch { return '' }
  })
</script>

{#if svg}
  <div class="qr" style="width: {groesse}px" role="img" aria-label={label}>{@html svg}</div>
{/if}

<style>
  .qr { max-width: 100%; aspect-ratio: 1; margin: 0 auto; background: #fff; border-radius: 12px; padding: 6px; box-sizing: border-box; }
  .qr :global(svg) { display: block; width: 100%; height: 100%; }
  .qr :global(svg path), .qr :global(svg rect[fill="black"]) { fill: #111; }
</style>
