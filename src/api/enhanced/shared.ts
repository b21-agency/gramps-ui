import { api } from '../index'
import type { ObjectKind } from '@/lib/types'
import type { GetSearchApiArg } from './search-slice-enhanced'
import { run } from './compose'
import { listEndpoint, type AnyObject, type ObjectListArg } from './objects'
import type { Page } from './page'
import { searchApi } from './search-slice-enhanced'
import { tagOf } from './tags'

// Composites for shared components (several generated requests in one cache entry):
// hit counts per object type for the search chips, and objects of mixed kinds (bookmarks).

export const sharedApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /**
     * Total hit count per object type (one cheap request each: `pagesize=1` + X-Total-Count).
     * `types[i] === null` counts everything.
     */
    searchCounts: build.query<number[], { search: GetSearchApiArg; types: Array<string | null> }>({
      async queryFn({ search, types }, queryApi) {
        const results = await Promise.all(
          types.map((type) =>
            run<Page<unknown>>(
              queryApi,
              searchApi.endpoints.getSearch.initiate({ ...search, type: type ? [type] : undefined, page: 1, pagesize: 1 }, { subscribe: false, forceRefetch: true }),
            ),
          ),
        )
        const failed = results.find((r) => 'error' in r)
        if (failed) return failed as { error: never }
        return { data: results.map((r) => ('data' in r ? r.data.total : 0)) }
      },
      providesTags: ['Search'],
    }),

    /** Objects of mixed kinds by handle (bookmarks): handle -> object; missing handles are absent. */
    getObjectsMixed: build.query<Record<string, AnyObject>, { refs: Array<{ kind: ObjectKind; handle: string }>; arg?: ObjectListArg }>({
      async queryFn({ refs, arg }, queryApi) {
        const byKind = new Map<ObjectKind, string[]>()
        for (const r of refs) byKind.set(r.kind, [...(byKind.get(r.kind) ?? []), r.handle])
        const results = await Promise.all(
          [...byKind].map(([kind, handles]) =>
            run<Page<AnyObject>>(queryApi, listEndpoint(kind).initiate({ ...arg, handles }, { subscribe: false, forceRefetch: true })),
          ),
        )
        const failed = results.find((r) => 'error' in r)
        if (failed) return failed as { error: never }
        const out: Record<string, AnyObject> = {}
        for (const r of results) if ('data' in r) for (const o of r.data.items) if (o?.handle) out[o.handle] = o
        return { data: out }
      },
      providesTags: (_r, _e, { refs }) => [
        ...[...new Set(refs.map((r) => tagOf[r.kind]))].map((type) => ({ type, id: 'LIST' })),
        ...refs.map((r) => ({ type: tagOf[r.kind], id: r.handle })),
      ],
    }),
  }),
})

export const { useSearchCountsQuery, useGetObjectsMixedQuery } = sharedApi
