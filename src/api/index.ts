import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError, type FetchBaseQueryMeta } from '@reduxjs/toolkit/query/react'
import { freshAccessToken, refreshAccessToken, tokens } from '@/lib/api'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/',
  prepareHeaders: async (headers) => {
    const token = await freshAccessToken()
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

/** Base query with JWT refresh: on 401 refresh once and retry, then sign out. */
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta> = async (args, api, extra) => {
  let result = await rawBaseQuery(args, api, extra)
  if (result.error?.status === 401 && tokens.refresh) {
    if (await refreshAccessToken()) result = await rawBaseQuery(args, api, extra)
    if (result.error?.status === 401) tokens.clear()
  }
  return result
}
export type BaseQuery = typeof baseQuery

/**
 * Tag types: one per Gramps object class plus the derived views that change when
 * objects change. Generated slices add their OpenAPI tags; the enhanced slices in
 * ./enhanced attach per-object ids and invalidate precisely from write transactions.
 */
export const tagTypes = [
  'People',
  'Families',
  'Events',
  'Places',
  'Sources',
  'Citations',
  'Repositories',
  'Notes',
  'Media',
  'Tags',
  'Search',
  'Metadata',
  'Timeline',
  'Relations',
  'Transactions',
  'Users',
  'Trees',
  'Tasks',
  'Bookmarks',
] as const

export const api = createApi({
  baseQuery,
  tagTypes,
  // keep data a while so going back is instant; refetch on reconnect
  keepUnusedDataFor: 300,
  refetchOnReconnect: true,
  endpoints: () => ({}),
})
