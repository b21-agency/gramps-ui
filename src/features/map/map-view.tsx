import { useEffect, useRef, type RefObject } from 'react'
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibre,
  Marker,
  NavigationControl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
} from 'maplibre-gl'
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from './maplibre'
import { cssVar, type PlacePoint } from './data'

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
}) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const state = useRef({ places, selected, lifeLine, showPlaces, onSelect, onViewChange })
  state.current = { places, selected, lifeLine, showPlaces, onSelect, onViewChange }
  const markers = useRef<Marker[]>([])
  const styleDark = useRef(dark)

  /* ---------- create ---------- */
  useEffect(() => {
    if (!container.current) return
    const map = new MapLibre({
      container: container.current,
      style: dark ? STYLE_DARK : STYLE_LIGHT,
      center: initialView?.center ?? [10, 30],
      zoom: initialView?.zoom ?? 1.5,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    mapRef.current = map

    map.on('style.load', () => addLayers(map, state.current))
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
    for (const layer of ['clusters', 'place']) {
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
    return () => {
      ro.disconnect()
      apiRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- theme ---------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || styleDark.current === dark) return
    styleDark.current = dark
    map.setStyle(dark ? STYLE_DARK : STYLE_LIGHT, { diff: false })
  }, [dark])

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
        'flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-card bg-brass px-1.5 text-xs font-semibold tabular-nums text-brass-foreground shadow-md outline-none transition-transform hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50'
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
  s: { places: PlacePoint[]; selected: string | null; lifeLine?: Array<[number, number]> | null; showPlaces: boolean },
) {
  const primary = cssVar('--primary')
  const onPrimary = cssVar('--primary-foreground', '#ffffff')
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

  addLayer(map, {
    id: 'life-line',
    type: 'line',
    source: 'life',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': brass, 'line-width': 3, 'line-opacity': 0.85 },
  })
  addLayer(map, {
    id: 'clusters',
    type: 'circle',
    source: 'places',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': primary,
      'circle-opacity': 0.9,
      'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 23, 200, 28],
      'circle-stroke-width': 3,
      'circle-stroke-color': card,
      'circle-stroke-opacity': 0.8,
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
    paint: { 'text-color': onPrimary },
  })
  addLayer(map, {
    id: 'place',
    type: 'circle',
    source: 'places',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': primary,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 12, 7],
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

function addLayer(map: MapLibre, layer: Parameters<MapLibre['addLayer']>[0]) {
  if (!map.getLayer(layer.id)) map.addLayer(layer)
}
