import { api } from '../index'
import type { GEvent } from '@/lib/types'

// Map page (src/features/map): place coordinates, events per place (time/type filters, place
// panel), georeferenced historic maps and vector files attached to a place. The cache holds
// the raw (serializable) rows; the feature hooks derive maps/bounds from them.

export interface CoordRow {
  handle: string
  name: string
  lat: number | string | null
  long: number | string | null
}

export interface MapEventRow {
  handle: string
  place?: string
  type: string | { string?: string }
  date?: { sortval?: number; year?: number; dateval?: number[] }
}

export interface MapMediaRow {
  handle: string
  gramps_id: string
  desc: string
  checksum: string
  mime: string
  path: string
  attribute_list?: Array<{ type: string | { string: string }; value: string }>
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
      async queryFn({ locale }, _api, _extra, baseQuery) {
        const r = await baseQuery({ url: '/api/places/coordinates/' })
        if (!r.error) return { data: r.data as CoordRow[] }
        if (r.error.status !== 404) return { error: r.error }
        const list = await baseQuery({
          url: '/api/places/',
          params: { keys: 'handle,profile', profile: 'self', place_hierarchy: 0, locale },
        })
        if (list.error) return { error: list.error }
        type P = { handle: string; profile?: { name?: string; lat?: number | null; long?: number | null } }
        return {
          data: (list.data as P[]).map((p) => ({
            handle: p.handle,
            name: p.profile?.name ?? '',
            lat: p.profile?.lat ?? null,
            long: p.profile?.long ?? null,
          })),
        }
      },
      providesTags: [{ type: 'Places', id: 'LIST' }],
    }),

    /** Every event's date, type and place (map time / type filters). */
    mapEvents: build.query<MapEventRow[], void>({
      query: () => ({ url: '/api/events/', params: { keys: 'date,handle,place,type' } }),
      providesTags: [{ type: 'Events', id: 'LIST' }],
    }),

    /** Events by handle (the events at a place), fetched in slices to keep URLs short. */
    mapEventsByHandle: build.query<GEvent[], { handles: string[]; locale: string }>({
      async queryFn({ handles, locale }, _api, _extra, baseQuery) {
        const out: GEvent[] = []
        for (let i = 0; i < handles.length; i += 80) {
          const r = await baseQuery({
            url: '/api/events/',
            params: {
              handles: handles.slice(i, i + 80).join(','),
              keys: 'handle,gramps_id,date,type,profile',
              profile: 'participants',
              locale,
            },
          })
          if (r.error) return { error: r.error }
          out.push(...(r.data as GEvent[]))
        }
        return { data: out }
      },
      providesTags: (_r, _e, { handles }) => [{ type: 'Events', id: 'LIST' }, ...handles.map((id) => ({ type: 'Events' as const, id }))],
    }),

    /** Media that are georeferenced historic maps (`map:bounds` attribute). */
    mapOverlayMedia: build.query<MapMediaRow[], void>({
      query: () => ({
        url: '/api/media/',
        params: {
          rules: JSON.stringify({ rules: [{ name: 'HasAttribute', values: ['map:bounds', '*'], regex: true }] }),
          keys: 'handle,gramps_id,desc,checksum,mime,path,attribute_list',
        },
      }),
      providesTags: (res) => [{ type: 'Media', id: 'LIST' }, ...(res ?? []).map((m) => ({ type: 'Media' as const, id: m.handle }))],
    }),

    /** Vector files (KML/GPX/GeoJSON) in a place's gallery, downloaded as text. */
    mapPlaceVectorFiles: build.query<PlaceVectorFileRaw[], string>({
      async queryFn(place, _api, _extra, baseQuery) {
        const r = await baseQuery({ url: `/api/places/${place}`, params: { extend: 'media_list', keys: 'handle,extended' } })
        if (r.error) return { error: r.error }
        const media = ((r.data as { extended?: { media?: MapMediaRow[] } }).extended?.media ?? []).filter((m) => !!vectorFormat(m))
        const unique = [...new Map(media.map((m) => [m.handle, m])).values()]
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

export const {
  useMapPlaceCoordinatesQuery,
  useMapEventsQuery,
  useMapEventsByHandleQuery,
  useMapOverlayMediaQuery,
  useMapPlaceVectorFilesQuery,
} = mapApi
