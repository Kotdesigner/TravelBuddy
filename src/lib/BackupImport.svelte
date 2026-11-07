<script>
  // Mehr → Backup & Import: beides an einem Ort, mit kurzer Erklärung, wofür es da ist.
  // Die eigentlichen Abläufe (Datei speichern und teilen, Vorschau, Zusammenführen, Rückgängig)
  // bleiben in App.svelte und userdata.js; diese Seite ruft sie nur auf.
  import { je, LOCALE } from './i18n.js'
  import { syncZeiten, schnappschuss } from './userdata.js'
  import SpeicherStand from './SpeicherStand.svelte'
  import { zeigeToast } from './toast.js'
  import { autoStand, groesse, setzeAn, ladeStand, sichere, alsDatei, ordnerMoeglich, waehleOrdner, vergissOrdner, ordnerFreigeben, SCHLUSS_STUNDE } from './autosicherung.js'

  let { onBackup = () => {}, onImport = () => {}, onRueckgaengig = null, onImportDatei = null, baueBackup = null, autoPause = false } = $props()
  ladeStand()
  const wannMs = (ms) => wann(new Date(ms).toISOString())
  async function jetztAuto() {
    if (!baueBackup) return
    if (!baueBackup()) { zeigeToast(je('Während der Testreise wird nicht automatisch gesichert', 'No automatic backup during the test trip'), 'info'); return }
    const ok = await sichere(baueBackup, { erzwingen: true })
    zeigeToast(ok ? je('Automatische Sicherung angelegt', 'Automatic backup created') : je('Sichern hat nicht geklappt', 'Backup did not work'), ok ? 'ok' : 'fehler')
  }
  async function zurueckholen(zeit) {
    const f = await alsDatei(zeit)
    if (f && onImportDatei) onImportDatei(f)
  }
  async function ordnerWaehlen() {
    try { const n = await waehleOrdner(); zeigeToast(je('Ordner gewählt: ', 'Folder chosen: ') + n, 'ok'); if (baueBackup) sichere(baueBackup, { erzwingen: true }) } catch {}
  }

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
    <h2>🕙 {je('Automatische Sicherung', 'Automatic backup')}</h2>
    <p>{je('Jeden Tag sichert die App deinen Stand von selbst: um {h} Uhr, wenn sie offen ist, sonst beim nächsten Start gleich im Hintergrund. Die letzten drei Tage bleiben auf diesem Gerät.', 'Every day the app saves your data by itself: at {h}:00 if it is open, otherwise right away in the background the next time you start it. The last three days are kept on this device.').replace('{h}', SCHLUSS_STUNDE)}</p>
    <label class="bi-schalter"><input type="checkbox" switch checked={$autoStand.an} onchange={(e) => setzeAn(e.currentTarget.checked)} /> {je('Automatisch sichern', 'Back up automatically')}</label>
    {#if $autoStand.an}
      {#if $autoStand.liste.length}
        <ul class="bi-liste">
          {#each $autoStand.liste as s, i (s.zeit)}
            <li><span><b>{wannMs(s.zeit)}</b>{#if i === 0} · {je('neueste', 'latest')}{/if}<small>{groesse(s.groesse)}</small></span>
              {#if onImportDatei}<button class="btn bi-klein" onclick={() => zurueckholen(s.zeit)}>{je('Zurückholen', 'Restore')}</button>{/if}</li>
          {/each}
        </ul>
      {:else}
        <p class="bi-stand fehlt">{autoPause ? je('Während der Testreise wird nicht automatisch gesichert. Danach geht es von selbst weiter.', 'No automatic backup during the test trip. It continues by itself afterwards.') : je('Noch keine automatische Sicherung. Die erste entsteht in wenigen Sekunden.', 'No automatic backup yet. The first one is made within seconds.')}</p>
      {/if}
      {#if $autoStand.fehler === 'speicher'}<p class="bi-stand fehlt">{je('Die letzte automatische Sicherung hat nicht geklappt, vermutlich ist der Speicher voll.', 'The last automatic backup failed, storage is probably full.')}</p>{/if}
      <button class="btn bi-knopf" onclick={jetztAuto} disabled={$autoStand.laeuft}>{$autoStand.laeuft ? je('Sichert …', 'Saving …') : je('Jetzt automatisch sichern', 'Back up automatically now')}</button>
      {#if ordnerMoeglich()}
        <div class="bi-ordner">
          <p class="bi-leise">{je('Dieser Browser kann die Sicherung zusätzlich als Datei in einen Ordner schreiben, zum Beispiel in einen Cloud-Ordner. Dann liegt sie auch außerhalb der App.', 'This browser can also write the backup as a file into a folder, for example a cloud folder. Then it is kept outside the app too.')}</p>
          {#if $autoStand.ordner}
            <p class="bi-stand">{je('Ordner:', 'Folder:')} <b>{$autoStand.ordner}</b></p>
            {#if $autoStand.ordnerNeu}<p class="bi-stand fehlt">{je('Der Browser möchte den Zugriff auf den Ordner neu bestätigt haben.', 'The browser wants access to the folder confirmed again.')}</p>
              <button class="btn bi-klein" onclick={() => baueBackup && ordnerFreigeben(baueBackup)}>{je('Zugriff bestätigen', 'Confirm access')}</button>{/if}
            <div class="bi-reihe"><button class="btn bi-klein" onclick={ordnerWaehlen}>{je('Anderen Ordner wählen', 'Choose another folder')}</button><button class="btn bi-klein" onclick={vergissOrdner}>{je('Ordner entfernen', 'Remove folder')}</button></div>
          {:else}
            <button class="btn bi-klein" onclick={ordnerWaehlen}>📁 {je('Ordner für Sicherungen wählen', 'Choose a folder for backups')}</button>
          {/if}
        </div>
      {/if}
    {/if}
    <p class="bi-leise">{je('Gegen Verlust oder Wechsel des Geräts hilft nur ein Backup außerhalb: „Backup sichern“ oben, dann per AirDrop, Mail oder in die Cloud.', 'Only a backup kept elsewhere protects against losing or switching the device: use “Save backup” above, then AirDrop, mail or the cloud.')}</p>
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
  .bi-schalter { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: calc(14.5px * var(--schrift, 1)); font-weight: 600; cursor: pointer; }
  .bi-liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .bi-liste li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: calc(14px * var(--schrift, 1)); }
  .bi-liste li span { display: flex; flex-direction: column; gap: 1px; }
  .bi-liste small { color: var(--muted); font-size: calc(12.5px * var(--schrift, 1)); }
  .bi-klein { min-height: 40px; font-size: calc(13.5px * var(--schrift, 1)); align-self: flex-start; }
  .bi-ordner { display: flex; flex-direction: column; gap: 6px; padding-top: 6px; border-top: 1px solid var(--line); }
  .bi-schritte { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 6px; font-size: calc(14.5px * var(--schrift, 1)); line-height: 1.5; }
</style>
