// MapLibre v6 loads its web worker from a URL next to its own module. Under Vite (pre-bundled
// deps in dev, hashed assets in build) that sibling file does not exist, so point it explicitly
// at the worker asset. Import this module (side effect) before creating any map.
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(workerUrl)

export const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty'
export const MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark'
