import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MediaRef } from '@/lib/types'

/** First media reference (portrait) for a set of people, in one request. */
export function usePortraits(handles: string[]) {
  const unique = [...new Set(handles.filter(Boolean))].sort()
  const { data } = useQuery({
    queryKey: ['people', 'portraits', unique],
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
    queryFn: () =>
      api<Array<{ handle: string; media_list: MediaRef[] }>>('/people/', {
        query: { handles: unique.join(','), keys: 'handle,media_list' },
      }),
  })
  const map = new Map<string, MediaRef | undefined>()
  data?.forEach((p) => map.set(p.handle, p.media_list?.[0]))
  return map
}
