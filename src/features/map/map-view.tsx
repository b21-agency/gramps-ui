import { useEffect, useRef, type RefObject } from 'react'
import {
  AttributionControl,
  GeolocateControl,
  LngLatBounds,
  Map as MapLibre,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import { freshAccessToken } from '@/lib/api'
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from './maplibre'
import { cssVar, type PlacePoint } from './data'
import {
  MAP_STYLE_OHM,
  authRequest,
  filterOhmByYear,
  localizedStyle,
  type BaseLayer,
  type Bounds,
  type FeatureCollection,
  type WikidataBuilding,
} from './layers'

export interface MapRasterOverlay {
  handle: string
  tiles: string
  bounds: [number, number, number, number] | null
}
export interface MapVectorOverlay {
  handle: string
  data: FeatureCollection
}

const STYLE_LIGHT = MAP_STYLE_LIGHT
const STYLE_DARK = MAP_STYLE_DARK

export interface Viewport {
  center: [number, number]
  zoom: number
}

export interface LifeStop {
  /** numbers of the events at this place, in chronological order (1-based) */
  numbers: number[]
  handle: string
  lat: number
  long: number
}

export interface MapApi {
  flyTo: (long: number, lat: number, zoom?: number) => void
  fit: (points: Array<[number, number]>, maxZoom?: number) => void
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * MapLibre map with clustered place markers and an optional "life path" (numbered stops joined
 * by a line). Layers are re-added whenever the base style changes (light/dark).
 */
export function MapView({
  places,
  selected,
  onSelect,
  lifeStops,
  lifeLine,
  dark,
  initialView,
  onViewChange,
  apiRef,
  showPlaces = true,
  base = 'base',
  year = null,
  lang = 'en',
  overlays = [],
  vectors = [],
  buildings = [],
  selectedBuilding = null,
  onBuildingClick,
  onBoundsChange,
}: {
  places: PlacePoint[]
  selected: string | null
  onSelect: (handle: string | null) => void
  lifeStops?: LifeStop[] | null
  lifeLine?: Array<[number, number]> | null
  dark: boolean
  initialView: Viewport | null
  onViewChange: (v: Viewport) => void
  apiRef: RefObject<MapApi | null>
  showPlaces?: boolean
  /** base map: modern (light/dark by theme) or OpenHistoricalMap */
  base?: BaseLayer
  /** year the historic map shows */
  year?: number | null
  /** label language */
  lang?: string
  /** georeferenced historic maps (raster tiles) */
  overlays?: MapRasterOverlay[]
  /** KML/GPX/GeoJSON files of the selected place */
  vectors?: MapVectorOverlay[]
  /** Wikidata buildings */
  buildings?: WikidataBuilding[]
  selectedBuilding?: string | null
  onBuildingClick?: (qid: string) => void
  onBoundsChange?: (b: Bounds, zoom: number) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const state = useRef({ places, selected, lifeLine, showPlaces, onSelect, onViewChange, overlays, vectors, base, year, buildings, onBuildingClick, onBoundsChange })
  state.current = { places, selected, lifeLine, showPlaces, onSelect, onViewChange, overlays, vectors, base, year, buildings, onBuildingClick, onBoundsChange }
  const markers = useRef<Marker[]>([])
  const styleKey = useRef('')
  // map.isStyleLoaded() stays false while tiles load, so track "our layers can be added" ourselves
  const styleReady = useRef(false)

  /* ---------- create ---------- */
  useEffect(() => {
    if (!container.current) return
    const map = new MapLibre({
      container: container.current,
      // the real (localized) style is set by the style effect below
      style: { version: 8, sources: {}, layers: [] },
      transformRequest: authRequest,
      center: initialView?.center ?? [10, 30],
      zoom: initialView?.zoom ?? 1.5,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true } }), 'bottom-right')
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    mapRef.current = map

    map.on('style.load', () => {
      styleReady.current = true
      addLayers(map, state.current)
      syncOverlays(map, state.current.overlays, state.current.vectors)
      if (state.current.base === 'ohm' && state.current.year) filterOhmByYear(map, state.current.year)
    })
    const reportBounds = () => {
      const b = map.getBounds()
      state.current.onBoundsChange?.({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() }, map.getZoom())
    }
    map.on('load', reportBounds)
    map.on('moveend', reportBounds)
    map.on('click', 'wd-buildings', (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (f) state.current.onBuildingClick?.(String(f.properties.qid))
    })
    map.on('moveend', () => {
      const c = map.getCenter()
      state.current.onViewChange({ center: [round(c.lng), round(c.lat)], zoom: Math.round(map.getZoom() * 100) / 100 })
    })

    map.on('click', 'clusters', async (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (!f) return
      const src = map.getSource('places') as GeoJSONSource
      const zoom = await src.getClusterExpansionZoom(f.properties.cluster_id as number)
      const [lng, lat] = (f.geometry as unknown as { coordinates: [number, number] }).coordinates
      map.easeTo({ center: [lng, lat], zoom: Math.min(zoom, 16), animate: !reduceMotion() })
    })
    map.on('click', 'place', (e: MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (f) state.current.onSelect(String(f.properties.handle))
    })
    for (const layer of ['clusters', 'place', 'wd-buildings']) {
      map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'))
      map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''))
    }

    apiRef.current = {
      flyTo: (long, lat, zoom) =>
        map.flyTo({ center: [long, lat], zoom: Math.max(zoom ?? 10, map.getZoom()), animate: !reduceMotion(), essential: true }),
      fit: (points, maxZoom = 11) => {
        if (!points.length) return
        if (points.length === 1) {
          map.jumpTo({ center: points[0], zoom: Math.min(maxZoom, 10) })
          return
        }
        const b = new LngLatBounds(points[0], points[0])
        points.forEach((p) => b.extend(p))
        map.fitBounds(b, { padding: fitPadding(), maxZoom, animate: !reduceMotion() })
      },
    }

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(container.current)
    // tile requests read the token synchronously (authRequest): keep it from expiring meanwhile
    const keepFresh = setInterval(() => void freshAccessToken(), 60_000)
    return () => {
      clearInterval(keepFresh)
      ro.disconnect()
      apiRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- base style (theme, historic, label language) ---------- */
  useEffect(() => {
    const map = mapRef.current
    const url = base === 'ohm' ? MAP_STYLE_OHM : dark ? STYLE_DARK : STYLE_LIGHT
    const key = `${url}|${lang}`
    if (!map || styleKey.current === key) return
    styleKey.current = key
    let cancelled = false
    localizedStyle(url, lang, base === 'ohm').then((style) => {
      if (cancelled || styleKey.current !== key) return
      styleReady.current = false
      map.setStyle(style, { diff: false })
    })
    return () => {
      cancelled = true
    }
  }, [dark, base, lang])

  /* ---------- historic map year ---------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || base !== 'ohm' || !year || !styleReady.current) return
    filterOhmByYear(map, year)
  }, [base, year])

  /* ---------- Wikidata buildings ---------- */
  useEffect(() => {
    const src = mapRef.current?.getSource('wd') as GeoJSONSource | undefined
    src?.setData(buildingsGeoJSON(buildings) as GeoData)
  }, [buildings])
  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('wd-selected')) return
    map.setFilter('wd-selected', ['==', ['get', 'qid'], selectedBuilding ?? ''])
  }, [selectedBuilding])

  /* ---------- overlays ---------- */
  useEffect(() => {
    const map = mapRef.current
    if (map && styleReady.current) syncOverlays(map, overlays, vectors)
  }, [overlays, vectors])

  /* ---------- data ---------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const src = map.getSource('places') as GeoJSONSource | undefined
    src?.setData(placesGeoJSON(showPlaces ? places : []) as GeoData)
  }, [places, showPlaces])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.getLayer('place-selected')) return
    map.setFilter('place-selected', ['==', ['get', 'handle'], selected ?? ''])
  }, [selected])

  useEffect(() => {
    const map = mapRef.current
    const src = map?.getSource('life') as GeoJSONSource | undefined
    src?.setData(lineGeoJSON(lifeLine) as GeoData)
  }, [lifeLine])

  /* ---------- numbered life stops (HTML markers survive style changes) ---------- */
  useEffect(() => {
    const map = mapRef.current
    markers.current.forEach((m) => m.remove())
    markers.current = []
    if (!map || !lifeStops?.length) return
    for (const stop of lifeStops) {
      const el = document.createElement('button')
      el.type = 'button'
      const label = stop.numbers.length > 2 ? `${stop.numbers[0]}…` : stop.numbers.join(',')
      el.className =
        'flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-card bg-brass px-1.5 font-serif text-sm font-semibold tabular-nums text-brass-foreground shadow-[0_0_0_5px_color-mix(in_oklab,var(--brass)_22%,transparent),0_6px_16px_-6px_rgb(0_0_0/0.6)] outline-none transition-transform duration-150 ease-out hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50'
      el.textContent = label
      el.setAttribute('aria-label', stop.numbers.join(', '))
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        state.current.onSelect(stop.handle)
      })
      markers.current.push(new Marker({ element: el }).setLngLat([stop.long, stop.lat]).addTo(map))
    }
  }, [lifeStops])

  // maplibre sets position:relative on its container, so the container fills an absolute wrapper
  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  )
}

interface FC {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    geometry: { type: 'Point'; coordinates: [number, number] } | { type: 'LineString'; coordinates: Array<[number, number]> }
    properties: Record<string, unknown>
  }>
}
type GeoData = Parameters<GeoJSONSource['setData']>[0]

function round(n: number) {
  return Math.round(n * 10000) / 10000
}

function fitPadding() {
  const w = window.innerWidth
  if (w < 768) return { top: 80, bottom: 120, left: 40, right: 40 }
  return { top: 90, bottom: 60, left: 420, right: 80 }
}

function placesGeoJSON(places: PlacePoint[]): FC {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.long, p.lat] },
      properties: { handle: p.handle, name: p.name },
    })),
  }
}

function buildingsGeoJSON(list: WikidataBuilding[]): FC {
  return {
    type: 'FeatureCollection',
    features: list.map((b) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [b.long, b.lat] },
      properties: { qid: b.qid, label: b.label },
    })),
  }
}

function lineGeoJSON(line?: Array<[number, number]> | null): FC {
  return {
    type: 'FeatureCollection',
    features:
      line && line.length > 1
        ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: {} }]
        : [],
  }
}

function addLayers(
  map: MapLibre,
  s: {
    places: PlacePoint[]
    selected: string | null
    lifeLine?: Array<[number, number]> | null
    showPlaces: boolean
    buildings?: WikidataBuilding[]
  },
) {
  // Album palette: gold clusters with a soft halo, moss places, gold selection
  const moss = cssVar('--chart-1', '#3e6a4e')
  const onBrass = cssVar('--brass-foreground', '#2b2310')
  const card = cssVar('--card', '#ffffff')
  const brass = cssVar('--brass', '#a9833a')
  const ink = cssVar('--foreground', '#18242a')

  if (!map.getSource('places')) {
    map.addSource('places', {
      type: 'geojson',
      data: placesGeoJSON(s.showPlaces ? s.places : []) as GeoData,
      cluster: true,
      clusterRadius: 44,
      clusterMaxZoom: 12,
    })
  }
  if (!map.getSource('life')) {
    map.addSource('life', { type: 'geojson', data: lineGeoJSON(s.lifeLine) as GeoData })
  }
  if (!map.getSource('wd')) {
    map.addSource('wd', { type: 'geojson', data: buildingsGeoJSON(s.buildings ?? []) as GeoData })
  }
  const lineage = cssVar('--lineage', '#7a6a8a')
  addLayer(map, {
    id: 'wd-buildings',
    type: 'circle',
    source: 'wd',
    paint: { 'circle-color': lineage, 'circle-radius': 5, 'circle-stroke-width': 1.5, 'circle-stroke-color': card, 'circle-opacity': 0.9 },
  })
  addLayer(map, {
    id: 'wd-selected',
    type: 'circle',
    source: 'wd',
    filter: ['==', ['get', 'qid'], ''],
    paint: { 'circle-color': brass, 'circle-radius': 8, 'circle-stroke-width': 2.5, 'circle-stroke-color': card },
  })
  addLayer(map, {
    id: 'wd-label',
    type: 'symbol',
    source: 'wd',
    minzoom: 16,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 1],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': card, 'text-halo-width': 1.5 },
  })

  addLayer(map, {
    id: 'life-line',
    type: 'line',
    source: 'life',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': brass, 'line-width': 3, 'line-opacity': 0.85 },
  })
  addLayer(map, {
    id: 'clusters-halo',
    type: 'circle',
    source: 'places',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': brass,
      'circle-opacity': 0.16,
      'circle-blur': 0.35,
      'circle-radius': ['step', ['get', 'point_count'], 22, 10, 27, 50, 33, 200, 39],
    },
  })
  addLayer(map, {
    id: 'clusters',
    type: 'circle',
    source: 'places',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': brass,
      'circle-opacity': 0.95,
      'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 23, 200, 28],
      'circle-stroke-width': 2,
      'circle-stroke-color': card,
      'circle-stroke-opacity': 0.9,
    },
  })
  addLayer(map, {
    id: 'cluster-count',
    type: 'symbol',
    source: 'places',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': onBrass },
  })
  addLayer(map, {
    id: 'place',
    type: 'circle',
    source: 'places',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': moss,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 12, 7.5],
      'circle-stroke-width': 2,
      'circle-stroke-color': card,
    },
  })
  addLayer(map, {
    id: 'place-selected',
    type: 'circle',
    source: 'places',
    filter: ['==', ['get', 'handle'], s.selected ?? ''],
    paint: {
      'circle-color': brass,
      'circle-radius': 10,
      'circle-stroke-width': 3,
      'circle-stroke-color': card,
      'circle-stroke-opacity': 0.95,
    },
  })
  addLayer(map, {
    id: 'place-label',
    type: 'symbol',
    source: 'places',
    filter: ['!', ['has', 'point_count']],
    minzoom: 7,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-color': ink, 'text-halo-color': card, 'text-halo-width': 1.5 },
  })
}

/** Replaces the overlay layers (raster `ovl-*`, vector `vec-*`) below the place markers. */
function syncOverlays(map: MapLibre, overlays: MapRasterOverlay[], vectors: MapVectorOverlay[]) {
  const style = map.getStyle()
  if (!style) return
  const want = new Set([...overlays.map((o) => `ovl-${o.handle}`), ...vectors.map((v) => `vec-${v.handle}`)])
  for (const l of style.layers) {
    const src = 'source' in l ? String(l.source) : ''
    if ((src.startsWith('ovl-') || src.startsWith('vec-')) && !want.has(src)) map.removeLayer(l.id)
  }
  for (const id of Object.keys(style.sources)) {
    if ((id.startsWith('ovl-') || id.startsWith('vec-')) && !want.has(id)) map.removeSource(id)
  }
  const before = map.getLayer('life-line') ? 'life-line' : undefined
  for (const o of overlays) {
    const id = `ovl-${o.handle}`
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'raster', tiles: [o.tiles], tileSize: 256, maxzoom: 18, ...(o.bounds ? { bounds: o.bounds } : {}) })
      map.addLayer({ id, type: 'raster', source: id }, before)
    }
  }
  const brass = cssVar('--brass', '#a9833a')
  for (const v of vectors) {
    const id = `vec-${v.handle}`
    const src = map.getSource(id) as GeoJSONSource | undefined
    if (src) {
      src.setData(v.data as unknown as GeoData)
      continue
    }
    map.addSource(id, { type: 'geojson', data: v.data as unknown as GeoData })
    map.addLayer(
      { id: `${id}-fill`, type: 'fill', source: id, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': brass, 'fill-opacity': 0.18 } },
      before,
    )
    map.addLayer(
      {
        id: `${id}-line`,
        type: 'line',
        source: id,
        filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': brass, 'line-width': 2.5 },
      },
      before,
    )
    map.addLayer(
      {
        id: `${id}-point`,
        type: 'circle',
        source: id,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': brass, 'circle-radius': 5, 'circle-stroke-width': 2, 'circle-stroke-color': cssVar('--card', '#ffffff') },
      },
      before,
    )
  }
}

function addLayer(map: MapLibre, layer: Parameters<MapLibre['addLayer']>[0]) {
  if (!map.getLayer(layer.id)) map.addLayer(layer)
}
