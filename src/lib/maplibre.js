// MapLibre 6 startet seine Arbeit in einem eigenen Worker. Die Datei muss der Bau mitliefern.
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

maplibregl.setWorkerUrl(workerUrl)
export * from 'maplibre-gl'
export default maplibregl
