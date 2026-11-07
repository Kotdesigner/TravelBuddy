<script>
  // Mehr → Backup & Import: beides an einem Ort, mit kurzer Erklärung, wofür es da ist.
  // Die eigentlichen Abläufe (Datei speichern und teilen, Vorschau, Zusammenführen, Rückgängig)
  // bleiben in App.svelte und userdata.js; diese Seite ruft sie nur auf.
  import { je, LOCALE } from './i18n.js'
  import { syncZeiten, schnappschuss } from './userdata.js'
  import SpeicherStand from './SpeicherStand.svelte'

  let { onBackup = () => {}, onImport = () => {}, onRueckgaengig = null } = $props()

  const wann = (iso) => {
    if (!iso) return ''
    try { return new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
  }
  const tageHer = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 864e5) : null)
  const alt = $derived(tageHer($syncZeiten.gesichert))
</script>

<div class="bi">
  <p class="bi-intro">{je('Deine Daten liegen nur auf diesem Gerät. Ein Backup ist eine einzige Datei mit deinem ganzen Stand. Damit sicherst du alles und bringst es auf ein anderes Gerät.', 'Your data is stored only on this device. A backup is a single file with everything you have. Use it to keep your data safe and to move it to another device.')}</p>

  <section class="bi-karte">
    <h2>💾 {je('Backup sichern', 'Save backup')}</h2>
    <p>{je('Speichert alles als Datei: Reisen und Etappen, Routen, Logbuch, Kosten, Buchungen, eigene Orte, Notizen, Packliste und Einstellungen. Wo das Gerät es kann, öffnet sich danach das Teilen-Menü, zum Beispiel für AirDrop, Quick Share, Mail oder einen Cloud-Ordner.', 'Saves everything as one file: trips and legs, routes, logbook, costs, bookings, your own places, notes, packing list and settings. Where the device supports it, the share menu opens next, for example for AirDrop, Quick Share, mail or a cloud folder.')}</p>
    <p class="bi-leise">{je('Nicht in der Datei: Tickets und Ausweise, Fotos fürs Tagebuch und den Schlüssel für Flugabfragen. Die bleiben nur auf diesem Gerät.', 'Not in the file: tickets and IDs, journal photos and the key for flight lookups. They stay on this device only.')}</p>
    <p class="bi-stand" class:alt={alt != null && alt >= 7} class:fehlt={!$syncZeiten.gesichert}>
      {#if $syncZeiten.gesichert}{je('Letztes Backup von diesem Gerät:', 'Last backup from this device:')} <b>{wann($syncZeiten.gesichert)}</b>{#if alt >= 7} · {je('länger her, am besten neu sichern', 'a while ago, best save a new one')}{/if}
      {:else}{je('Von diesem Gerät gibt es noch kein Backup.', 'There is no backup from this device yet.')}{/if}
    </p>
    <button class="btn-primary bi-knopf" onclick={onBackup}>💾 {je('Backup sichern', 'Save backup')}</button>
  </section>

  <section class="bi-karte">
    <h2>📂 {je('Backup importieren', 'Import backup')}</h2>
    <p>{je('Holt eine Backup-Datei auf dieses Gerät. Vorher zeigt die App, was dazukommt. „Zusammenführen“ ergänzt nur und löscht nichts. „Ersetzen“ übernimmt die Datei ganz. Einen Import kannst du danach einmal rückgängig machen.', 'Brings a backup file onto this device. First the app shows what will be added. “Merge” only adds and deletes nothing. “Replace” takes over the file completely. You can undo an import once afterwards.')}</p>
    {#if $syncZeiten.importiert}<p class="bi-stand">{je('Letzter Import:', 'Last import:')} <b>{wann($syncZeiten.importiert)}</b></p>{/if}
    <div class="bi-reihe">
      <button class="btn bi-knopf" onclick={onImport}>📂 {je('Backup importieren', 'Import backup')}</button>
      {#if onRueckgaengig && $schnappschuss}
        <button class="btn bi-knopf" onclick={onRueckgaengig}>↩︎ {je('Letzten Import rückgängig machen', 'Undo last import')}</button>
      {/if}
    </div>
  </section>

  <section class="bi-karte">
    <h2>🔄 {je('Zwischen Geräten abgleichen', 'Sync between devices')}</h2>
    <p>{je('Die Backup-Datei ist auf jedem Gerät gleich: iPhone, Android, Mac, Windows oder Linux, im Browser oder als installierte App. Du kannst also zwischen allen hin und her abgleichen.', 'The backup file is the same on every device: iPhone, Android, Mac, Windows or Linux, in the browser or as an installed app. So you can sync between any of them.')}</p>
    <ol class="bi-schritte">
      <li>{je('Auf dem Gerät mit dem neueren Stand „Backup sichern“.', 'On the device with the newer data, tap “Save backup”.')}</li>
      <li>{je('Die Datei auf das andere Gerät bringen, egal wie: AirDrop, Quick Share, Mail, Messenger, Cloud-Ordner oder USB-Stick.', 'Get the file to the other device any way you like: AirDrop, Quick Share, mail, messenger, cloud folder or USB stick.')}</li>
      <li>{je('Dort „Backup importieren“, die Datei wählen und „Zusammenführen“ tippen.', 'There, tap “Import backup”, pick the file and choose “Merge”.')}</li>
      <li>{je('Hast du auf beiden Geräten Neues eingetragen, das Ganze auch in die andere Richtung.', 'If you added new things on both devices, do the same the other way round.')}</li>
    </ol>
    <p class="bi-leise">{je('Die Geräte gleichen sich nicht von selbst ab. Es gibt keinen Server, der deine Daten sieht.', 'The devices do not sync by themselves. There is no server that sees your data.')}</p>
  </section>

  <section class="bi-karte">
    <h2>🛟 {je('Wann sichern?', 'When to save?')}</h2>
    <p>{je('Am besten nach jedem Reisetag mit neuen Einträgen und immer vor einem Gerätewechsel, einem Update des Betriebssystems oder wenn der Speicher knapp wird.', 'Ideally after every travel day with new entries, and always before switching devices, a system update or when storage runs low.')}</p>
    <SpeicherStand />
  </section>
</div>

<style>
  .bi { display: flex; flex-direction: column; gap: 12px; max-width: 720px; }
  .bi-intro { margin: 0; font-size: calc(15px * var(--schrift, 1)); line-height: 1.5; color: var(--ink); }
  .bi-karte { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius-l); padding: 16px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 8px; }
  .bi-karte h2 { margin: 0; font-size: calc(17px * var(--schrift, 1)); }
  .bi-karte p { margin: 0; font-size: calc(14.5px * var(--schrift, 1)); line-height: 1.5; }
  .bi-leise { color: var(--muted); font-size: calc(13.5px * var(--schrift, 1)) !important; }
  .bi-stand { padding: 8px 10px; border-radius: var(--radius-s); background: var(--flaeche); font-size: calc(13.5px * var(--schrift, 1)) !important; }
  .bi-stand.alt, .bi-stand.fehlt { background: var(--warn-flaeche); color: var(--warn-text); }
  .bi-knopf { align-self: flex-start; min-height: 48px; }
  .bi-reihe { display: flex; flex-wrap: wrap; gap: 8px; }
  .bi-schritte { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 6px; font-size: calc(14.5px * var(--schrift, 1)); line-height: 1.5; }
</style>
