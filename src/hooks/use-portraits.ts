import { useObjectsByHandlesQuery } from '@/api/enhanced/objects'
import type { MediaRef } from '@/lib/types'

/** First media reference (portrait) for a set of people, in one request. */
export function usePortraits(handles: string[]) {
  const unique = [...new Set(handles.filter(Boolean))].sort()
  const { data } = useObjectsByHandlesQuery<{ handle: string; media_list?: MediaRef[] }>('person', unique, { keys: ['handle', 'media_list'] })
  const map = new Map<string, MediaRef | undefined>()
  data?.forEach((p) => map.set(p.handle, p.media_list?.[0]))
  return map
}
