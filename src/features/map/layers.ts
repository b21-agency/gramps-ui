// Extra map layers: historic map overlays (media with a `map:bounds` attribute), vector files
// (KML/GPX/GeoJSON) attached to a place, OpenHistoricalMap date filtering, label localization
// and external (Nominatim) place search.
import { useMemo } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import type { Map as MapLibre, StyleSpecification } from 'maplibre-gl'
import { qs, tokens } from '@/lib/api'
import { overlayMediaArg, useMapPlaceVectorFilesQuery, vectorFormat, type MapMediaRow, type VectorFormat } from '@/api/enhanced/map'
import { useGetMediaObjectsQuery } from '@/api/enhanced/media-slice-enhanced'

export { vectorFormat }

export const MAP_STYLE_OHM = 'https://www.openhistoricalmap.org/map-styles/main/main.json'
export type BaseLayer = 'base' | 'ohm'

/* ---------------- historic map overlays ---------------- */

export interface MapOverlay {
  handle: string
  gramps_id: string
  desc: string
  checksum: string
  /** [west, south, east, north] */
  bounds: [number, number, number, number] | null
}

/** `map:bounds` = [[latA, lngA], [latB, lngB]] -> [west, south, east, north] */
function parseBounds(v: string | undefined): MapOverlay['bounds'] {
  if (!v) return null
  try {
    const b = JSON.parse(v)
    if (!Array.isArray(b) || b.length !== 2) return null
    const [[latA, lngA], [latB, lngB]] = b
    if (![latA, lngA, latB, lngB].every(Number.isFinite)) return null
    return [Math.min(lngA, lngB), Math.min(latA, latB), Math.max(lngA, lngB), Math.max(latA, latB)]
  } catch {
    return null
  }
}

/** Media objects that are georeferenced historic maps (served as tiles by the API). */
export function useMapOverlays() {
  const q = useGetMediaObjectsQuery(overlayMediaArg)
  const data = useMemo(
    () =>
      (q.data?.items as MapMediaRow[] | undefined)?.map((m): MapOverlay => {
        const attr = m.attribute_list?.find((a) => (typeof a.type === 'string' ? a.type : a.type?.string) === 'map:bounds')
        return { handle: m.handle, gramps_id: m.gramps_id, desc: m.desc, checksum: m.checksum, bounds: parseBounds(attr?.value) }
      }),
    [q.data],
  )
  return { ...q, data }
}

/** Tile URL template (absolute: MapLibre needs it); the token goes in a header, see `authRequest`. */
export function overlayTileUrl(o: MapOverlay) {
  return `${window.location.origin}/api/media/${o.handle}/tile/{z}/{x}/{y}${qs({ checksum: o.checksum })}`
}

/** MapLibre `transformRequest`: same-origin /api/ requests carry the access token as a header. */
export function authRequest(url: string) {
  const token = tokens.access
  if (!token || !url.startsWith(`${window.location.origin}/api/`)) return { url }
  return { url, headers: { Authorization: `Bearer ${token}` } }
}

/* ---------------- vector files of a place ---------------- */

type Format = VectorFormat

type Position = [number, number]
type Geometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: string; coordinates?: unknown; geometries?: Geometry[] }
export interface FeatureCollection {
  type: 'FeatureCollection'
  features: Array<{ type: 'Feature'; geometry: Geometry; properties: Record<string, unknown> }>
}

function coords(text: string | null | undefined): Position[] {
  return (text ?? '')
    .trim()
    .split(/\s+/)
    .map((t) => t.split(',').map(Number))
    .filter((c) => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
    .map((c) => [c[0], c[1]] as Position)
}

const byTag = (el: Element | Document, tag: string) => Array.from(el.getElementsByTagName(tag))

function kmlToGeoJSON(doc: Document): FeatureCollection {
  const features: FeatureCollection['features'] = []
  for (const pm of byTag(doc, 'Placemark')) {
    const name = byTag(pm, 'name')[0]?.textContent ?? ''
    for (const p of byTag(pm, 'Point')) {
      const c = coords(byTag(p, 'coordinates')[0]?.textContent)[0]
      if (c) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: { name } })
    }
    for (const l of byTag(pm, 'LineString')) {
      const c = coords(byTag(l, 'coordinates')[0]?.textContent)
      if (c.length > 1) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: { name } })
    }
    for (const poly of byTag(pm, 'Polygon')) {
      const rings = [...byTag(poly, 'outerBoundaryIs'), ...byTag(poly, 'innerBoundaryIs')]
        .map((b) => coords(byTag(b, 'coordinates')[0]?.textContent))
        .filter((r) => r.length > 2)
      if (rings.length) features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: rings }, properties: { name } })
    }
  }
  return { type: 'FeatureCollection', features }
}

function gpxToGeoJSON(doc: Document): FeatureCollection {
  const features: FeatureCollection['features'] = []
  const pt = (e: Element): Position => [Number(e.getAttribute('lon')), Number(e.getAttribute('lat'))]
  const ok = (p: Position) => Number.isFinite(p[0]) && Number.isFinite(p[1])
  for (const w of byTag(doc, 'wpt')) {
    const p = pt(w)
    if (ok(p)) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { name: byTag(w, 'name')[0]?.textContent ?? '' } })
  }
  const lines = [...byTag(doc, 'trkseg').map((s) => byTag(s, 'trkpt')), ...byTag(doc, 'rte').map((r) => byTag(r, 'rtept'))]
  for (const pts of lines) {
    const c = pts.map(pt).filter(ok)
    if (c.length > 1) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: {} })
  }
  return { type: 'FeatureCollection', features }
}

function toFC(obj: unknown): FeatureCollection | null {
  const o = obj as { type?: string; features?: unknown[]; coordinates?: unknown; geometries?: unknown }
  if (o?.type === 'FeatureCollection' && Array.isArray(o.features)) return o as FeatureCollection
  if (o?.type === 'Feature') return { type: 'FeatureCollection', features: [o as FeatureCollection['features'][0]] }
  if (Array.isArray(o?.coordinates) || Array.isArray(o?.geometries))
    return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: o as Geometry, properties: {} }] }
  return null
}

export function parseVector(text: string, format: Format): FeatureCollection | null {
  try {
    if (format === 'geojson') return toFC(JSON.parse(text))
    const doc = new DOMParser().parseFromString(text, 'text/xml')
    if (doc.getElementsByTagName('parsererror').length) return null
    return format === 'kml' ? kmlToGeoJSON(doc) : gpxToGeoJSON(doc)
  } catch {
    return null
  }
}

export interface VectorFile {
  handle: string
  gramps_id: string
  desc: string
  data: FeatureCollection | null
}

/** KML/GPX/GeoJSON files in the gallery of a place, downloaded and converted to GeoJSON. */
export function usePlaceVectors(placeHandle: string | null) {
  const q = useMapPlaceVectorFilesQuery(placeHandle ?? skipToken)
  const data = useMemo(
    () =>
      q.data?.map(
        (m): VectorFile => ({
          handle: m.handle,
          gramps_id: m.gramps_id,
          desc: m.desc,
          // unreadable file: listed, but nothing drawn
          data: m.text != null ? parseVector(m.text, vectorFormat(m)!) : null,
        }),
      ),
    [q.data],
  )
  return { ...q, data }
}

/** [[west, south], [east, north]] of all features, or null. */
export function vectorBounds(fcs: FeatureCollection[]): [Position, Position] | null {
  const box = [Infinity, Infinity, -Infinity, -Infinity]
  const walk = (c: unknown) => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === 'number') {
      const [x, y] = c as number[]
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      box[0] = Math.min(box[0], x)
      box[1] = Math.min(box[1], y)
      box[2] = Math.max(box[2], x)
      box[3] = Math.max(box[3], y)
      return
    }
    c.forEach(walk)
  }
  const geom = (g?: Geometry) => {
    if (!g) return
    if (g.type === 'GeometryCollection') (g.geometries ?? []).forEach(geom)
    else walk(g.coordinates)
  }
  fcs.forEach((fc) => fc.features.forEach((f) => geom(f.geometry)))
  if (box[0] === Infinity) return null
  return [
    [box[0], box[1]],
    [box[2], box[3]],
  ]
}

/* ---------------- OpenHistoricalMap date filter ---------------- */

const originalFilters = new WeakMap<MapLibre, Map<string, unknown>>()

function isLegacyFilter(f: unknown): boolean {
  if (!Array.isArray(f)) return false
  if (['all', 'any', 'none'].includes(f[0])) return f.slice(1).some(isLegacyFilter)
  return typeof f[1] === 'string' && ['==', '!=', '<', '>', '<=', '>=', 'in', '!in', 'has', '!has'].includes(f[0])
}

/**
 * Shows the OpenHistoricalMap as it was in `year`: features carry `start_decdate`/`end_decdate`
 * (the same rule the `maplibre-gl-dates` plugin applies).
 */
export function filterOhmByYear(map: MapLibre, year: number) {
  const style = map.getStyle()
  if (!style?.layers) return
  let orig = originalFilters.get(map)
  if (!orig || !style.layers.some((l) => orig!.has(l.id))) {
    orig = new Map()
    originalFilters.set(map, orig)
    for (const l of style.layers) if ('source' in l && l.source === 'ohm') orig.set(l.id, 'filter' in l ? l.filter : undefined)
  }
  const date = year + 0.5
  const dateFilter = [
    'all',
    ['any', ['!', ['has', 'start_decdate']], ['<=', ['get', 'start_decdate'], date]],
    ['any', ['!', ['has', 'end_decdate']], ['>', ['get', 'end_decdate'], date]],
  ]
  orig.forEach((f, id) => {
    if (!map.getLayer(id) || isLegacyFilter(f)) return
    map.setFilter(id, (f ? ['all', f, dateFilter] : dateFilter) as Parameters<MapLibre['setFilter']>[1])
  })
}

/* ---------------- label language ---------------- */

function readsName(e: unknown): boolean {
  if (!Array.isArray(e) || e[0] === 'literal') return false
  if (e[0] === 'get') return typeof e[1] === 'string' && /^name([:_]|$)/.test(e[1])
  return e.slice(1).some(readsName)
}

/** Labels of the base map in the UI language, falling back to the local name. */
export async function localizedStyle(url: string, lang: string, ohm: boolean): Promise<StyleSpecification | string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const style = (await res.json()) as StyleSpecification
    const key = ohm ? `name_${lang}` : `name:${lang}`
    for (const layer of style.layers) {
      const layout = (layer as { layout?: Record<string, unknown> }).layout
      if (layer.type === 'symbol' && layout && readsName(layout['text-field'])) {
        layout['text-field'] = ['coalesce', ['get', key], ['get', 'name']]
      }
    }
    return style
  } catch {
    return url
  }
}

/* ---------------- external search ---------------- */

export interface ExternalHit {
  name: string
  display_name: string
  lat: number
  long: number
}

export async function searchNominatim(q: string, lang: string, signal?: AbortSignal): Promise<ExternalHit[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=10&accept-language=${lang}`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status })
  const rows = (await res.json()) as Array<{ name: string; display_name: string; lat: string; lon: string }>
  return rows.map((r) => ({ name: r.name, display_name: r.display_name, lat: Number(r.lat), long: Number(r.lon) }))
}

/* ---------------- Wikidata buildings (read-only, as on domus.genealogy.net) ---------------- */

export const WIKIDATA_MIN_ZOOM = 14
const WIKIDATA_LIMIT = 3000
const EXTRA_BUILDING_TYPES = ['Q131596', 'Q72030539', 'Q2116450', 'Q2523674', 'Q477195', 'Q2066754', 'Q1497364']
export const FARM_TYPES = ['Q131596', 'Q72030539', 'Q2523674', 'Q477195']

export interface Bounds {
  west: number
  south: number
  east: number
  north: number
}

export interface WikidataBuilding {
  qid: string
  label: string
  lat: number
  long: number
  inceptionYear: number | null
  demolishedYear: number | null
}

/** Buildings without dates count as existing. */
export function existedIn(b: WikidataBuilding, from: number, to: number) {
  if (b.inceptionYear !== null && b.inceptionYear > to) return false
  if (b.demolishedYear !== null && b.demolishedYear < from) return false
  return true
}

const wdYear = (v?: string) => {
  const m = /^([+-]?\d+)-\d\d-\d\dT/.exec(v ?? '')
  return m ? parseInt(m[1], 10) : null
}

export function wikidataLanguages(lang: string) {
  const code = lang.replaceAll('_', '-').toLowerCase()
  return [...new Set([code, code.split('-')[0], 'en', 'mul'])].join(',')
}

export async function queryWikidataBuildings(b: Bounds, lang: string, signal?: AbortSignal) {
  const c = (n: number) => n.toFixed(6)
  const roots = [...EXTRA_BUILDING_TYPES, 'Q41176'].map((q) => `wd:${q}`).join(', ')
  const query = `SELECT ?item ?itemLabel ?coord ?inception ?demolished
WITH {
  SELECT DISTINCT ?item WHERE {
    SERVICE wikibase:box {
      ?item wdt:P625 ?c .
      bd:serviceParam wikibase:cornerSouthWest "Point(${c(b.west)} ${c(b.south)})"^^geo:wktLiteral .
      bd:serviceParam wikibase:cornerNorthEast "Point(${c(b.east)} ${c(b.north)})"^^geo:wktLiteral .
    }
    ?item wdt:P31 ?type .
    ?type wdt:P279?/wdt:P279? ?r .
    FILTER(?r IN (${roots}) || EXISTS { ?r wdt:P31 wd:Q811102 })
  }
  LIMIT ${WIKIDATA_LIMIT}
} AS %buildings
WHERE {
  INCLUDE %buildings .
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P576 ?demolished . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${wikidataLanguages(lang)}" . }
}`
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
    headers: { Accept: 'application/sparql-results+json' },
    signal,
  })
  if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status })
  const json = (await res.json()) as { results?: { bindings?: Array<Record<string, { value: string } | undefined>> } }
  const byQid = new Map<string, WikidataBuilding>()
  for (const row of json.results?.bindings ?? []) {
    const qid = /\/(Q\d+)$/.exec(row.item?.value ?? '')?.[1]
    const pt = /Point\(([-+\d.eE]+)\s+([-+\d.eE]+)\)/.exec(row.coord?.value ?? '')
    if (!qid || !pt || byQid.has(qid)) continue
    byQid.set(qid, {
      qid,
      label: row.itemLabel?.value || qid,
      long: parseFloat(pt[1]),
      lat: parseFloat(pt[2]),
      inceptionYear: wdYear(row.inception?.value),
      demolishedYear: wdYear(row.demolished?.value),
    })
  }
  return { buildings: [...byQid.values()], truncated: byQid.size >= WIKIDATA_LIMIT }
}

/** Direct types of a building (to create a Gramps place of type Farm or Building). */
export async function queryWikidataTypes(qid: string): Promise<string[]> {
  const query = `SELECT ?t WHERE { wd:${qid} wdt:P31 ?t . }`
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
    headers: { Accept: 'application/sparql-results+json' },
  })
  if (!res.ok) return []
  const json = (await res.json()) as { results?: { bindings?: Array<{ t?: { value: string } }> } }
  return (json.results?.bindings ?? []).map((r) => /\/(Q\d+)$/.exec(r.t?.value ?? '')?.[1] ?? '').filter(Boolean)
}

/** Handle of a geocoded place within ~10 cm of the point (a place made from that building). */
export function findPlaceAt(places: Array<{ handle: string; lat: number; long: number }>, lat: number, long: number) {
  const scale = Math.cos((lat * Math.PI) / 180)
  return places.find((p) => Math.hypot((p.lat - lat) * 111320, (p.long - long) * 111320 * scale) <= 0.1)?.handle ?? null
}
