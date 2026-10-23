// Shared data hooks for pages that work with any object kind, on top of the generated
// endpoints (src/api/enhanced). Same result shape as RTK ({ data, isLoading, isFetching,
// isError, error, refetch }), so pages read naturally; `data` is typed by the caller.
import { skipToken } from '@reduxjs/toolkit/query'
import { apiLocale } from '@/i18n'
import type { ObjectKind, Tag } from './types'
import {
  listEndpoint,
  useObjectQuery,
  useObjectsQuery,
  type AnyKind,
  type ObjectArg,
  type ObjectListArg,
  type Page,
} from '@/api/enhanced/objects'
import { useGetMetadataQuery } from '@/api/enhanced/metadata-slice-enhanced'
import { useGetTagsQuery } from '@/api/enhanced/tags-slice-enhanced'

export type { Page, ObjectArg, ObjectListArg }

const NOT_FOUND = { status: 404, data: { message: 'not found' } }

/** Fetch one object by its Gramps ID (I0044, F0012, ...); `isError` with 404 when there is none. */
export function useObjectById<T>(kind: ObjectKind, grampsId: string | undefined, arg: ObjectListArg = {}) {
  // the list endpoint filtered by gramps_id: tagged like any list row, so edits refresh it
  const r = listEndpoint(kind).useQuery(grampsId ? { locale: apiLocale(), ...arg, grampsId } : skipToken)
  const data = r.data?.items[0] as T | undefined
  const missing = r.isSuccess && !data
  return {
    ...r,
    data,
    isError: r.isError || missing,
    error: missing ? NOT_FOUND : r.error,
  }
}

export function useObjectByHandle<T>(
  kind: ObjectKind,
  handle: string | undefined | null,
  arg: ObjectArg = {},
  opts: { enabled?: boolean } = {},
) {
  return useObjectQuery<T>(kind, handle && opts.enabled !== false ? { locale: apiLocale(), ...arg, handle } : skipToken)
}

export function useObjectList<T>(kind: AnyKind, arg: ObjectListArg, enabled = true) {
  const r = useObjectsQuery<T>(kind, enabled ? { locale: apiLocale(), ...arg } : skipToken)
  // keep showing the previous page while the next one loads (like keepPreviousData)
  return { ...r, isPlaceholderData: r.isFetching && !r.isLoading }
}

export function useMetadata() {
  return useGetMetadataQuery({})
}

/** All tags, sorted as the API returns them. */
export function useTags() {
  const r = useGetTagsQuery({})
  return { ...r, data: r.data?.items as Tag[] | undefined }
}

export class NotFoundError extends Error {
  status = 404
  constructor() {
    super('not found')
  }
}
