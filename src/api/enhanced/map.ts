import { api } from '../index'
import type { GEvent } from '@/lib/types'
import { chunks, run } from './compose'
import { eventsApi } from './events-slice-enhanced'
import type { Page } from './page'
import { placesApi, type CoordRow } from './places-slice-enhanced'

// Composites for the map page (src/features/map): place coordinates (with a fallback for
// servers before 3.23), the events at a place (fetched in URL-sized slices) and the vector
// files in a place's gallery. The event and overlay lists are the generated list endpoints
// (MAP_EVENT_KEYS, overlayMediaArg). The cache holds raw rows; the feature hooks derive
// maps and bounds from them.

export type { CoordRow }

export interface MapEventRow {
  handle: string
  place?: string
  type: string | { string?: string }
  date?: { sortval?: number; year?: number; dateval?: number[] }
}

/** Keys of every event the map loads for its time and type filters. */
export const MAP_EVENT_KEYS = ['date', 'handle', 'place', 'type']

export interface MapMediaRow {
  handle: string
  gramps_id: string
  desc: string
  checksum: string
  mime: string
  path: string
  attribute_list?: Array<{ type: string | { string: string }; value: string }>
}

/** Media that are georeferenced historic maps (`map:bounds` attribute). */
export const overlayMediaArg = {
  rules: JSON.stringify({ rules: [{ name: 'HasAttribute', values: ['map:bounds', '*'], regex: true }] }),
  keys: ['handle', 'gramps_id', 'desc', 'checksum', 'mime', 'path', 'attribute_list'],
}

export interface PlaceVectorFileRaw {
  handle: string
  gramps_id: string
  desc: string
  mime: string
  path: string
  /** file content, null when unreadable */
  text: string | null
}

export type VectorFormat = 'kml' | 'gpx' | 'geojson'

/** The backend labels GeoJSON as JSON and GPX as XML, so the file extension counts too. */
export function vectorFormat(m: { mime?: string; path?: string }): VectorFormat | null {
  const mime = m.mime ?? ''
  const path = m.path ?? ''
  if (mime === 'application/vnd.google-earth.kml+xml' || /\.kml$/i.test(path)) return 'kml'
  if (mime === 'application/gpx+xml' || /\.gpx$/i.test(path)) return 'gpx'
  if (mime === 'application/geo+json' || mime === 'application/vnd.geo+json' || /\.geojson$/i.test(path)) return 'geojson'
  return null
}

export const mapApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /** All places with coordinates: /places/coordinates/ (API >= 3.23), else the place list. */
    mapPlaceCoordinates: build.query<CoordRow[], { locale: string }>({
      async queryFn({ locale }, queryApi) {
        const r = await run<CoordRow[]>(queryApi, placesApi.endpoints.getPlacesCoordinates.initiate(undefined, { subscribe: false, forceRefetch: true }))
        if (!('error' in r) || r.error.status !== 404) return r
        type P = { handle: string; profile?: { name?: string; lat?: number | null; long?: number | null } }
        const list = await run<Page<P>>(
          queryApi,
          placesApi.endpoints.getPlaces.initiate(
            { keys: ['handle', 'profile'], profile: ['self'], placeHierarchy: false, locale },
            { subscribe: false, forceRefetch: true },
          ),
        )
        if ('error' in list) return list
        return {
          data: list.data.items.map((p) => ({
            handle: p.handle,
            name: p.profile?.name ?? '',
            lat: p.profile?.lat ?? null,
            long: p.profile?.long ?? null,
          })),
        }
      },
      providesTags: [{ type: 'Places', id: 'LIST' }],
    }),

    /** Events by handle (the events at a place), fetched in slices to keep URLs short. */
    mapEventsByHandle: build.query<GEvent[], { handles: string[]; locale: string }>({
      async queryFn({ handles, locale }, queryApi) {
        const out: GEvent[] = []
        for (const chunk of chunks(handles)) {
          const r = await run<Page<GEvent>>(
            queryApi,
            eventsApi.endpoints.getEvents.initiate(
              { handles: chunk, keys: ['handle', 'gramps_id', 'date', 'type', 'profile'], profile: ['participants'], locale },
              { subscribe: false, forceRefetch: true },
            ),
          )
          if ('error' in r) return r
          out.push(...r.data.items)
        }
        return { data: out }
      },
      providesTags: (_r, _e, { handles }) => [{ type: 'Events', id: 'LIST' }, ...handles.map((id) => ({ type: 'Events' as const, id }))],
    }),

    /** Vector files (KML/GPX/GeoJSON) in a place's gallery, downloaded as text. */
    mapPlaceVectorFiles: build.query<PlaceVectorFileRaw[], string>({
      async queryFn(place, queryApi, _extra, baseQuery) {
        const r = await run<{ extended?: { media?: MapMediaRow[] } }>(
          queryApi,
          placesApi.endpoints.getPlace.initiate({ handle: place, extend: ['media_list'], keys: ['handle', 'extended'] }, { subscribe: false, forceRefetch: true }),
        )
        if ('error' in r) return r
        const media = (r.data.extended?.media ?? []).filter((m) => !!vectorFormat(m))
        const unique = [...new Map(media.map((m) => [m.handle, m])).values()]
        // file contents are file responses, not JSON: plain requests to the file URL
        const files = await Promise.all(
          unique.map(async (m) => {
            const f = await baseQuery({ url: `/api/media/${m.handle}/file`, responseHandler: 'text' })
            return { handle: m.handle, gramps_id: m.gramps_id, desc: m.desc, mime: m.mime, path: m.path, text: f.error ? null : (f.data as string) }
          }),
        )
        return { data: files }
      },
      providesTags: (res, _e, place) => [
        { type: 'Places', id: place },
        ...(res ?? []).map((m) => ({ type: 'Media' as const, id: m.handle })),
      ],
      keepUnusedDataFor: 60,
    }),
  }),
})

export const { useMapPlaceCoordinatesQuery, useMapEventsByHandleQuery, useMapPlaceVectorFilesQuery } = mapApi
