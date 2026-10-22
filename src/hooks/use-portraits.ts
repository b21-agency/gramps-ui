import { skipToken } from '@reduxjs/toolkit/query'
import { useGetObjectsByHandlesQuery } from '@/api/enhanced/objects'
import type { MediaRef } from '@/lib/types'

/** First media reference (portrait) for a set of people, in one request. */
export function usePortraits(handles: string[]) {
  const unique = [...new Set(handles.filter(Boolean))].sort()
  const { data } = useGetObjectsByHandlesQuery(
    unique.length ? { kind: 'person', handles: unique, query: { keys: 'handle,media_list' } } : skipToken,
  )
  const map = new Map<string, MediaRef | undefined>()
  ;(data as Array<{ handle: string; media_list?: MediaRef[] }> | undefined)?.forEach((p) => map.set(p.handle, p.media_list?.[0]))
  return map
}
