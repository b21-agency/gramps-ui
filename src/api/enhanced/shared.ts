import type { FetchBaseQueryError, FetchBaseQueryMeta } from '@reduxjs/toolkit/query'
import { api } from '../index'
import { endpointOf, type ObjectKind } from '@/lib/types'
import type { Query } from '@/lib/api'
import { cleanParams } from './objects'
import { tagOf, type TagType } from './tags'

// Endpoints for shared components and the browse pages (home, search, objects, help,
// personal) that the generated slices describe too loosely or that need X-Total-Count,
// several requests in one cache entry, or custom tags.

const totalOf = (meta: FetchBaseQueryMeta | undefined) => {
  const h = meta?.response?.headers.get('X-Total-Count')
  return h ? Number(h) : 0
}

type AnyObj = { handle: string } & Record<string, unknown>

/** One change of an object (`/transactions/history/objects/{Class}/{handle}`). */
export interface ObjectChange {
  trans_type: 0 | 1 | 2
  timestamp: number
  transaction_id?: number
  connection?: { user?: { name?: string; full_name?: string } }
}

export const OBJECT_HISTORY_PAGE = 10
export const OBJECT_HISTORY_MAX = 50

const tagOfClass: Record<string, TagType> = {
  Person: 'People',
  Family: 'Families',
  Event: 'Events',
  Place: 'Places',
  Source: 'Sources',
  Citation: 'Citations',
  Repository: 'Repositories',
  Note: 'Notes',
  Media: 'Media',
}

export type TreeConfig = Record<string, unknown>

export const sharedApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /**
     * Total hit count per object type for the search chips (one cheap request each,
     * `pagesize=1` + X-Total-Count). `types[i] === null` counts everything.
     */
    searchCounts: build.query<number[], { query: string; types: Array<string | null>; params?: Query }>({
      async queryFn({ query, types, params }, _api, _extra, fetchWithBQ) {
        const results = await Promise.all(
          types.map((type) =>
            fetchWithBQ({ url: '/api/search/', params: cleanParams({ ...params, query, type, page: 1, pagesize: 1 }) }),
          ),
        )
        const failed = results.find((r) => r.error)
        if (failed?.error) return { error: failed.error as FetchBaseQueryError }
        return { data: results.map((r) => totalOf(r.meta as FetchBaseQueryMeta | undefined)) }
      },
      providesTags: ['Search'],
    }),

    /** Objects of mixed kinds by handle (bookmarks): handle -> object; missing handles are absent. */
    getObjectsMixed: build.query<Record<string, AnyObj>, { refs: Array<{ kind: ObjectKind; handle: string }>; query?: Query }>({
      async queryFn({ refs, query }, _api, _extra, fetchWithBQ) {
        const byKind = new Map<ObjectKind, string[]>()
        for (const r of refs) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.handle])
        const results = await Promise.all(
          [...byKind].map(([kind, handles]) =>
            fetchWithBQ({ url: `/api/${endpointOf[kind]}/`, params: cleanParams({ ...query, handles }) }),
          ),
        )
        const failed = results.find((r) => r.error)
        if (failed?.error) return { error: failed.error as FetchBaseQueryError }
        const out: Record<string, AnyObj> = {}
        for (const r of results) for (const o of (r.data as AnyObj[]) ?? []) if (o?.handle) out[o.handle] = o
        return { data: out }
      },
      providesTags: (_r, _e, { refs }) => [
        ...[...new Set(refs.map((r) => tagOf[r.kind]))].map((type) => ({ type, id: 'LIST' })),
        ...refs.map((r) => ({ type: tagOf[r.kind], id: r.handle })),
      ],
    }),

    /** Change history of one object, newest first, paged ("show more"). */
    objectHistory: build.infiniteQuery<
      { items: ObjectChange[]; total: number },
      { objClass: string; handle: string; lastChange?: number },
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (last, all, lastParam) => {
          const n = all.reduce((s, p) => s + p.items.length, 0)
          return n < last.total && n < OBJECT_HISTORY_MAX && last.items.length === OBJECT_HISTORY_PAGE ? lastParam + 1 : undefined
        },
      },
      query: ({ queryArg: { objClass, handle }, pageParam }) => ({
        url: `/api/transactions/history/objects/${objClass}/${handle}`,
        params: { sort: '-id', page: pageParam, pagesize: OBJECT_HISTORY_PAGE },
      }),
      transformResponse: (data: ObjectChange[], meta) => ({ items: data, total: totalOf(meta) || data.length }),
      providesTags: (_r, _e, { objClass, handle }) => [
        'Transactions',
        ...(tagOfClass[objClass] ? [{ type: tagOfClass[objClass], id: handle }] : []),
      ],
    }),

    /** Merge a patch into the tree's UI config (re-read from the server first) and save it. */
    updateTreeConfig: build.mutation<TreeConfig, TreeConfig>({
      async queryFn(patch, _api, _extra, fetchWithBQ) {
        const current = await fetchWithBQ({ url: '/api/trees/-/config' })
        const merged = { ...((current.data as TreeConfig | undefined) ?? {}), ...patch }
        const put = await fetchWithBQ({ url: '/api/trees/-/config', method: 'PUT', body: merged })
        if (put.error) return { error: put.error as FetchBaseQueryError }
        return { data: merged }
      },
      invalidatesTags: ['Trees'],
    }),
    /** Replace the whole tree UI config ("import settings"). */
    replaceTreeConfig: build.mutation<TreeConfig, TreeConfig>({
      query: (config) => ({ url: '/api/trees/-/config', method: 'PUT', body: config }),
      transformResponse: (_r, _m, config) => config,
      invalidatesTags: ['Trees'],
    }),

    /**
     * Suggested face rectangles of an image. Expensive, so cached per image content
     * (`checksum` is part of the cache key) and never invalidated by tags.
     */
    faceDetection: build.query<number[][], { handle: string; checksum?: string }>({
      query: ({ handle }) => ({ url: `/api/media/${handle}/face_detection` }),
      keepUnusedDataFor: 3600,
    }),

    /** Text recognition for an image; reads only, so nothing to invalidate. May answer with a task. */
    runOcr: build.mutation<unknown, { handle: string; lang?: string }>({
      query: ({ handle, lang }) => ({ url: `/api/media/${handle}/ocr`, method: 'POST', params: cleanParams({ lang }) }),
      invalidatesTags: [],
    }),
  }),
})

export const {
  useSearchCountsQuery,
  useGetObjectsMixedQuery,
  useObjectHistoryInfiniteQuery,
  useUpdateTreeConfigMutation,
  useReplaceTreeConfigMutation,
  useRunOcrMutation,
  useFaceDetectionQuery,
} = sharedApi
