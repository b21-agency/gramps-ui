import type { FetchBaseQueryMeta } from '@reduxjs/toolkit/query'
import { api } from '../index'
import { endpointOf, type Metadata, type ObjectKind, type SearchHit, type Tag } from '@/lib/types'
import type { Query } from '@/lib/api'
import { tagOf, tagsForKind, tagsForTransaction, type TagType, type TxEntry } from './tags'

// Typed, tag-aware endpoints for the nine Gramps object kinds. The generated slices
// (../*-api-slice.gen.ts) cover the rest of the API; these are what pages use for
// reading and writing objects, so cache invalidation stays in one place.

export interface Page<T> {
  items: T[]
  total: number
}

/** Drop empty params; arrays become comma lists (the API's convention). */
export function cleanParams(q: Query | undefined) {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(q ?? {})) {
    if (v === undefined || v === null || v === '') continue
    out[k] = Array.isArray(v) ? v.join(',') : v
  }
  return out
}

const totalOf = (meta: FetchBaseQueryMeta | undefined, fallback: number) => {
  const h = meta?.response?.headers.get('X-Total-Count')
  return h ? Number(h) : fallback
}

type AnyObj = { handle: string } & Record<string, unknown>

export const objectsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Paged/filtered list: GET /api/{kind}/ with X-Total-Count. */
    getObjects: build.query<Page<AnyObj>, { kind: ObjectKind | 'tag'; query?: Query }>({
      query: ({ kind, query }) => ({
        url: `/api/${kind === 'tag' ? 'tags' : endpointOf[kind]}/`,
        params: cleanParams(query),
      }),
      transformResponse: (data: AnyObj[], meta) => ({ items: data, total: totalOf(meta, data.length) }),
      providesTags: (res, _e, { kind }) => {
        const type = tagOf[kind]
        return [{ type, id: 'LIST' }, ...(res?.items ?? []).filter((o) => o?.handle).map((o) => ({ type, id: o.handle }))]
      },
    }),
    /** One object by Gramps ID (I0044 …); 404 when missing. */
    getObjectById: build.query<AnyObj, { kind: ObjectKind; grampsId: string; query?: Query }>({
      query: ({ kind, grampsId, query }) => ({
        url: `/api/${endpointOf[kind]}/`,
        params: cleanParams({ ...query, gramps_id: grampsId }),
      }),
      transformResponse: (data: AnyObj[]) => data[0],
      transformErrorResponse: (e) => e,
      providesTags: (res, _e, { kind, grampsId }) => {
        const type = tagOf[kind]
        // objects pulled in via extend=… are part of this response too
        const extended = Object.entries((res?.extended as Record<string, unknown>) ?? {}).flatMap(([, v]) =>
          (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : [])
            .filter((o): o is AnyObj => !!(o as AnyObj)?.handle)
            .map((o) => ({ type: classTag(o) ?? type, id: o.handle })),
        )
        return res ? [{ type, id: res.handle }, ...extended] : [{ type, id: `gid:${grampsId}` }]
      },
    }),
    /** One object by handle. */
    getObject: build.query<AnyObj, { kind: ObjectKind | 'tag'; handle: string; query?: Query }>({
      query: ({ kind, handle, query }) => ({
        url: `/api/${kind === 'tag' ? 'tags' : endpointOf[kind]}/${handle}`,
        params: cleanParams(query),
      }),
      providesTags: (_r, _e, { kind, handle }) => [{ type: tagOf[kind], id: handle }],
    }),
    /** Several objects by handle (portraits, participants …). */
    getObjectsByHandles: build.query<AnyObj[], { kind: ObjectKind; handles: string[]; query?: Query }>({
      query: ({ kind, handles, query }) => ({
        url: `/api/${endpointOf[kind]}/`,
        params: cleanParams({ ...query, handles }),
      }),
      providesTags: (_r, _e, { kind, handles }) => handles.map((h) => ({ type: tagOf[kind], id: h })),
    }),

    createObject: build.mutation<TxEntry[], { kind: ObjectKind | 'tag'; body: Record<string, unknown> }>({
      query: ({ kind, body }) => ({ url: `/api/${kind === 'tag' ? 'tags' : endpointOf[kind]}/`, method: 'POST', body }),
      invalidatesTags: (tx, _e, { kind }) => (tx ? tagsForTransaction(tx) : tagsForKind(kind)),
    }),
    updateObject: build.mutation<TxEntry[], { kind: ObjectKind | 'tag'; handle: string; body: Record<string, unknown> }>({
      query: ({ kind, handle, body }) => ({
        url: `/api/${kind === 'tag' ? 'tags' : endpointOf[kind]}/${handle}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (tx, _e, { kind, handle }) => (Array.isArray(tx) && tx.length ? tagsForTransaction(tx) : tagsForKind(kind, handle)),
    }),
    deleteObject: build.mutation<TxEntry[], { kind: ObjectKind | 'tag'; handle: string }>({
      query: ({ kind, handle }) => ({ url: `/api/${kind === 'tag' ? 'tags' : endpointOf[kind]}/${handle}`, method: 'DELETE' }),
      invalidatesTags: (tx, _e, { kind, handle }) => (Array.isArray(tx) && tx.length ? tagsForTransaction(tx) : tagsForKind(kind, handle)),
    }),
    /** Several linked objects in one atomic transaction. */
    postObjects: build.mutation<TxEntry[], Array<Record<string, unknown>>>({
      query: (body) => ({ url: '/api/objects/', method: 'POST', body }),
      invalidatesTags: (tx) => tagsForTransaction(tx),
    }),
    deleteObjectsByHandle: build.mutation<TxEntry[], { kind: ObjectKind; handles: string[] }>({
      query: ({ kind, handles }) => ({
        url: '/api/objects/delete-by-handle/',
        method: 'POST',
        body: { namespace: endpointOf[kind], handles },
      }),
      invalidatesTags: (tx, _e, { kind }) => (Array.isArray(tx) && tx.length ? tagsForTransaction(tx) : tagsForKind(kind)),
    }),
    mergeObjects: build.mutation<TxEntry[], { kind: ObjectKind; keep: string; other: string }>({
      query: ({ kind, keep, other }) => ({ url: `/api/${endpointOf[kind]}/${keep}/merge/${other}`, method: 'POST' }),
      invalidatesTags: (tx, _e, { kind }) => (Array.isArray(tx) && tx.length ? tagsForTransaction(tx) : tagsForKind(kind)),
    }),
    /** Undo a write by replaying its transaction backwards. */
    undoTransaction: build.mutation<TxEntry[], TxEntry[]>({
      query: (tx) => ({ url: '/api/transactions/', method: 'POST', params: { undo: 1 }, body: tx }),
      invalidatesTags: (back, _e, tx) => tagsForTransaction([...(back ?? []), ...tx]),
    }),

    search: build.query<Page<SearchHit>, Query>({
      query: (q) => ({ url: '/api/search/', params: cleanParams(q) }),
      transformResponse: (data: SearchHit[], meta) => ({ items: data, total: totalOf(meta, data.length) }),
      providesTags: ['Search'],
    }),
    metadata: build.query<Metadata, void>({
      query: () => ({ url: '/api/metadata/' }),
      providesTags: ['Metadata'],
      keepUnusedDataFor: 600,
    }),
    allTags: build.query<Tag[], void>({
      query: () => ({ url: '/api/tags/' }),
      providesTags: (res) => [{ type: 'Tags', id: 'LIST' }, ...(res ?? []).map((t) => ({ type: 'Tags' as const, id: t.handle }))],
    }),
  }),
})

const classTags: Record<string, TagType> = {
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
function classTag(o: AnyObj): TagType | undefined {
  if (typeof o._class === 'string') return classTags[o._class]
  if ('primary_name' in o) return 'People'
  if ('child_ref_list' in o) return 'Families'
  if ('placeref_list' in o) return 'Places'
  if ('mime' in o) return 'Media'
  if ('source_handle' in o) return 'Citations'
  if ('text' in o && 'format' in o) return 'Notes'
  return undefined
}

export const {
  useGetObjectsQuery,
  useGetObjectByIdQuery,
  useGetObjectQuery,
  useGetObjectsByHandlesQuery,
  useCreateObjectMutation,
  useUpdateObjectMutation,
  useDeleteObjectMutation,
  usePostObjectsMutation,
  useDeleteObjectsByHandleMutation,
  useMergeObjectsMutation,
  useUndoTransactionMutation,
  useSearchQuery,
  useLazySearchQuery,
  useMetadataQuery,
  useAllTagsQuery,
} = objectsApi
