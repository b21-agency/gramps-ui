import type { FetchArgs, FetchBaseQueryError, FetchBaseQueryMeta, QueryReturnValue } from '@reduxjs/toolkit/query'
import { api } from '../index'
import { endpointOf, type MediaRef, type ObjectKind, type SearchHit } from '@/lib/types'
import type { Query } from '@/lib/api'
import { cleanParams, type Page } from './objects'
import { tagOf } from './tags'

// Data for the virtualized object lists (src/features/lists): one cache entry per page of
// rows, so only the pages on screen are fetched and each page refreshes on its own after a
// write (every page provides `{type, id: 'LIST'}` plus its rows' handles).

type Row = { handle: string } & Record<string, unknown>

export interface ListPageArg {
  kind: ObjectKind
  /** GET /{endpoint}/ params (rules, sort, pagesize, keys …), without `page` */
  query: Query
  /** full-text search params for /search/ (without `page`); falls back to `query` without an index */
  search?: Query | null
  /** 1-based */
  page: number
}

const totalOf = (meta: FetchBaseQueryMeta | undefined, fallback: number) => {
  const h = meta?.response?.headers.get('X-Total-Count')
  return h ? Number(h) : fallback
}

/** The `baseQuery` handed to a `queryFn` (auth + refresh included). */
type Result = QueryReturnValue<unknown, FetchBaseQueryError, FetchBaseQueryMeta>
export type BaseQueryFn = (args: string | FetchArgs) => Result | PromiseLike<Result>

async function fetchRules(baseQuery: BaseQueryFn, arg: ListPageArg) {
  const r = await baseQuery({ url: `/api/${endpointOf[arg.kind]}/`, params: cleanParams({ ...arg.query, page: arg.page }) })
  if (r.error) return { error: r.error }
  const data = r.data as Row[]
  return { data: { items: data, total: totalOf(r.meta, data.length) } }
}

/* ---------------- per-handle queries, merged into one request per tick ---------------- */

type BatchResult<R> = { data: R } | { error: FetchBaseQueryError }

/**
 * Batches per-handle `queryFn` calls made in the same tick into `GET url?handles=…` requests
 * (chunks of `size`), so a screen of rows costs one request while each row keeps its own
 * cache entry (and tag). `pick` maps a fetched row (or undefined when missing) to the result.
 */
export function handleBatcher<Raw extends { handle: string }, R>(
  url: string,
  params: Record<string, string | number | boolean>,
  pick: (row: Raw | undefined) => R,
  size = 80,
) {
  let pending = new Map<string, Array<(r: BatchResult<R>) => void>>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let bq: BaseQueryFn | null = null
  const flush = () => {
    const batch = pending
    const baseQuery = bq!
    pending = new Map()
    timer = null
    const handles = [...batch.keys()]
    for (let i = 0; i < handles.length; i += size) {
      const chunk = handles.slice(i, i + size)
      void Promise.resolve(baseQuery({ url, params: { ...params, handles: chunk.join(',') } })).then((r) => {
        const map = new Map(((r.data ?? []) as Raw[]).map((row) => [row.handle, row]))
        chunk.forEach((h) => batch.get(h)?.forEach((done) => done(r.error ? { error: r.error } : { data: pick(map.get(h)) })))
      })
    }
  }
  return (baseQuery: BaseQueryFn, handle: string) =>
    new Promise<BatchResult<R>>((resolve) => {
      bq = baseQuery
      const list = pending.get(handle) ?? []
      list.push(resolve)
      pending.set(handle, list)
      timer ??= setTimeout(flush, 15)
    })
}

const loadPortrait = handleBatcher<{ handle: string; media_list?: MediaRef[] }, MediaRef | null>(
  '/api/people/',
  { keys: 'handle,media_list' },
  (p) => p?.media_list?.[0] ?? null,
)

export const listsApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /** One page of a list, with the X-Total-Count total. */
    listPage: build.query<Page<Row>, ListPageArg>({
      async queryFn(arg, _api, _extra, baseQuery) {
        if (!arg.search) return fetchRules(baseQuery, arg)
        const r = await baseQuery({ url: '/api/search/', params: cleanParams({ ...arg.search, page: arg.page }) })
        // no search index for this tree -> answer with the filter rules instead
        if (r.error && typeof r.error.status === 'number' && r.error.status >= 500) return fetchRules(baseQuery, arg)
        if (r.error) return { error: r.error }
        const hits = r.data as SearchHit[]
        return { data: { items: hits.map((h) => h.object as unknown as Row), total: totalOf(r.meta, hits.length) } }
      },
      providesTags: (res, _e, { kind, search }) => {
        const type = tagOf[kind]
        return [
          { type, id: 'LIST' },
          ...(search ? (['Search'] as const) : []),
          ...(res?.items ?? []).filter((o) => o?.handle).map((o) => ({ type, id: o.handle })),
        ]
      },
      keepUnusedDataFor: 120,
    }),

    /** First media reference of a person (list rows that only know a handle). */
    personPortrait: build.query<MediaRef | null, string>({
      queryFn: (handle, _api, _extra, baseQuery) => loadPortrait(baseQuery, handle),
      providesTags: (_r, _e, handle) => [{ type: 'People', id: handle }],
      keepUnusedDataFor: 600,
    }),

    /** Gramps core strings (type names …) in the given language: POST /translations/{lang}. */
    grampsTypeTranslations: build.query<Array<{ original: string; translation: string }>, { lang: string; strings: string[] }>({
      query: ({ lang, strings }) => ({ url: `/api/translations/${lang}`, method: 'POST', body: { strings } }),
      keepUnusedDataFor: 3600,
    }),
  }),
})

export const { useListPageQuery, usePersonPortraitQuery, useGrampsTypeTranslationsQuery } = listsApi
