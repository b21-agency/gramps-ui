import { api } from '../index'
import type { MediaRef, ObjectKind, SearchHit } from '@/lib/types'
import type { GetSearchApiArg } from './search-slice-enhanced'
import { handleBatcher, run } from './compose'
import { listEndpoint, type AnyObject, type ObjectListArg } from './objects'
import type { Page } from './page'
import { peopleApi } from './people-slice-enhanced'
import { searchApi } from './search-slice-enhanced'
import { profileTags, tagOf } from './tags'

// Composites for the virtualized object lists (src/features/lists): one cache entry per page
// of rows, so only the pages on screen are fetched and each page refreshes on its own after a
// write (every page provides `{type, id: 'LIST'}` plus its rows' handles).

export interface ListPageArg {
  kind: ObjectKind
  /** list params (rules, sort, pagesize, keys …), without `page` */
  list: ObjectListArg
  /** full-text search (without `page`); falls back to `list` when the tree has no search index */
  search?: GetSearchApiArg | null
  /** 1-based */
  page: number
}

const loadPortrait = handleBatcher<{ handle: string; media_list?: MediaRef[] }, MediaRef | null>(
  (queryApi, handles) =>
    run(queryApi, peopleApi.endpoints.getPeople.initiate({ handles, keys: ['handle', 'media_list'] }, { subscribe: false, forceRefetch: true })).then((r) =>
      'data' in r ? { data: (r.data as Page<{ handle: string; media_list?: MediaRef[] }>).items } : r,
    ),
  (p) => p?.media_list?.[0] ?? null,
)

export const listsApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /** One page of a list, with the X-Total-Count total. */
    listPage: build.query<Page<AnyObject>, ListPageArg>({
      async queryFn(arg, queryApi) {
        const byRules = () =>
          run<Page<AnyObject>>(queryApi, listEndpoint(arg.kind).initiate({ ...arg.list, page: arg.page }, { subscribe: false, forceRefetch: true }))
        if (!arg.search) return byRules()
        const r = await run<Page<SearchHit>>(queryApi, searchApi.endpoints.getSearch.initiate({ ...arg.search, page: arg.page }, { subscribe: false, forceRefetch: true }))
        // no search index for this tree -> answer with the filter rules instead
        if ('error' in r && typeof r.error.status === 'number' && r.error.status >= 500) return byRules()
        if ('error' in r) return r
        return { data: { items: r.data.items.map((h) => h.object as unknown as AnyObject), total: r.data.total } }
      },
      providesTags: (res, _e, { kind, list, search }) => {
        const type = tagOf[kind]
        return [
          { type, id: 'LIST' },
          ...profileTags(search ?? list),
          ...(search ? (['Search'] as const) : []),
          ...(res?.items ?? []).filter((o) => o?.handle).map((o) => ({ type, id: o.handle })),
        ]
      },
      keepUnusedDataFor: 120,
    }),

    /** First media reference of a person (list rows that only know a handle); batched per tick. */
    personPortrait: build.query<MediaRef | null, string>({
      queryFn: (handle, queryApi) => loadPortrait(queryApi, handle),
      providesTags: (_r, _e, handle) => [{ type: 'People', id: handle }],
      keepUnusedDataFor: 600,
    }),
  }),
})

export const { useListPageQuery, usePersonPortraitQuery } = listsApi
