import type { FetchBaseQueryMeta } from '@reduxjs/toolkit/query'
import { api } from '../index'
import type { Transaction, TransType, TypeMaps } from '@/features/revisions/history'

// Change history (undo log). The generated transactions slice covers detail, undo check
// and undo; these add the X-Total-Count totals the paged views need and the type maps.
// Every write invalidates 'Transactions' (it is one of the derived tags).

export interface ObjectChange {
  obj_class: string
  trans_type: TransType
  obj_handle: string
  timestamp: number
  transaction_id?: number | null
  connection?: { user?: { name: string; full_name: string } | null } | null
}

export interface HistoryPage<T> {
  items: T[]
  total: number
  page: number
}

const totalOf = (meta: FetchBaseQueryMeta | undefined, fallback: number) => {
  const h = meta?.response?.headers.get('X-Total-Count')
  return h ? Number(h) : fallback
}

/** Gramps type class → datatype of /types/default/{datatype}/map. */
export const TYPE_DATATYPES = [
  'event_role_types',
  'name_types',
  'name_origin_types',
  'event_types',
  'family_relation_types',
  'child_reference_types',
  'attribute_types',
  'source_attribute_types',
  'note_types',
  'place_types',
  'repository_types',
  'source_media_types',
  'url_types',
]

/** Like the classic UI, only the most recent revisions of an object are listed. */
export const OBJECT_HISTORY_PAGE_SIZE = 10
export const OBJECT_HISTORY_MAX_ITEMS = 50

export const revisionsApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /** One page of the whole tree's history, newest first, with old/new object data. */
    transactionHistoryPage: build.query<HistoryPage<Transaction>, { page: number; pagesize: number }>({
      query: ({ page, pagesize }) => ({
        url: '/api/transactions/history/',
        params: { sort: '-id', page, pagesize, old: 1, new: 1 },
      }),
      transformResponse: (data: Transaction[], meta, { page }) => ({ items: data, total: totalOf(meta, data.length), page }),
      providesTags: ['Transactions'],
    }),

    /** History of one object, 10 per page ("show more"), at most 50 entries. */
    revisionsObjectHistory: build.infiniteQuery<HistoryPage<ObjectChange>, { objClass: string; handle: string }, number>({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (last, all) => {
          const n = all.reduce((s, p) => s + p.items.length, 0)
          return n < last.total && n < OBJECT_HISTORY_MAX_ITEMS && last.items.length ? last.page + 1 : undefined
        },
      },
      query: ({ queryArg: { objClass, handle }, pageParam }) => ({
        url: `/api/transactions/history/objects/${objClass}/${handle}`,
        params: { sort: '-id', page: pageParam, pagesize: OBJECT_HISTORY_PAGE_SIZE },
      }),
      transformResponse: (data: ObjectChange[], meta, arg) => ({
        items: data,
        total: totalOf(meta, data.length),
        page: (arg as unknown as { pageParam: number }).pageParam,
      }),
      providesTags: ['Transactions'],
    }),

    /** Value → English name maps for all Gramps default types (fetched once per session). */
    typeMaps: build.query<TypeMaps, void>({
      async queryFn(_arg, _api, _extra, baseQuery) {
        const entries = await Promise.all(
          TYPE_DATATYPES.map(async (dt) => {
            const r = await baseQuery({ url: `/api/types/default/${dt}/map` })
            return [dt, r.error ? {} : (r.data as Record<string, string>)] as const
          }),
        )
        return { data: Object.fromEntries(entries) as TypeMaps }
      },
      keepUnusedDataFor: 24 * 3600,
    }),
  }),
})

export const { useTransactionHistoryPageQuery, useRevisionsObjectHistoryInfiniteQuery, useTypeMapsQuery } = revisionsApi
