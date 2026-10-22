// Shared data hooks on top of RTK Query (src/api). Same names and result shape as before
// ({ data, isLoading, isFetching, isError, error, refetch }), so pages read naturally.
import { skipToken } from '@reduxjs/toolkit/query'
import type { Query } from './api'
import { apiLocale } from '@/i18n'
import type { ObjectKind, Tag } from './types'
import {
  useAllTagsQuery,
  useGetObjectByIdQuery,
  useGetObjectQuery,
  useGetObjectsQuery,
  useMetadataQuery,
  type Page,
} from '@/api/enhanced/objects'

export type { Page }

const NOT_FOUND = { status: 404, data: { message: 'not found' } }

/** Fetch one object by its Gramps ID (I0044, F0012, ...). */
export function useObjectById<T>(kind: ObjectKind, grampsId: string | undefined, query: Query = {}) {
  const r = useGetObjectByIdQuery(grampsId ? { kind, grampsId, query: { locale: apiLocale(), ...query } } : skipToken)
  const missing = r.isSuccess && !r.data
  return {
    ...r,
    data: r.data as T | undefined,
    isError: r.isError || missing,
    error: missing ? NOT_FOUND : r.error,
  }
}

export function useObjectByHandle<T>(
  kind: ObjectKind,
  handle: string | undefined | null,
  query: Query = {},
  opts: { enabled?: boolean } = {},
) {
  const r = useGetObjectQuery(
    handle && opts.enabled !== false ? { kind, handle, query: { locale: apiLocale(), ...query } } : skipToken,
  )
  return { ...r, data: r.data as T | undefined }
}

export function useObjectList<T>(kind: ObjectKind | 'tag', query: Query, enabled = true) {
  const r = useGetObjectsQuery(enabled ? { kind, query: { locale: apiLocale(), ...query } } : skipToken)
  // keep showing the previous page while the next one loads (like keepPreviousData)
  return { ...r, data: r.data as Page<T> | undefined, isPlaceholderData: r.isFetching && !r.isLoading }
}

export function useMetadata() {
  return useMetadataQuery()
}

export function useTags() {
  const r = useAllTagsQuery()
  return { ...r, data: r.data as Tag[] | undefined }
}

export class NotFoundError extends Error {
  status = 404
  constructor() {
    super('not found')
  }
}
