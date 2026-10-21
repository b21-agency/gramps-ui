import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MediaRef } from '@/lib/types'

// Rows that only know a person's handle (family partners, event participants) need that
// person's first media reference for a portrait. Requests made in the same tick are merged
// into one `/people/?handles=...` call, so a screen of rows costs one request.

type Entry = { resolve: (m: MediaRef | null) => void; reject: (e: unknown) => void }
let pending = new Map<string, Entry[]>()
let timer: ReturnType<typeof setTimeout> | null = null

function flush() {
  const batch = pending
  pending = new Map()
  timer = null
  const handles = [...batch.keys()]
  for (let i = 0; i < handles.length; i += 80) {
    const chunk = handles.slice(i, i + 80)
    api<Array<{ handle: string; media_list?: MediaRef[] }>>('/people/', {
      query: { handles: chunk.join(','), keys: 'handle,media_list' },
    })
      .then((rows) => {
        const map = new Map(rows.map((r) => [r.handle, r.media_list?.[0] ?? null]))
        chunk.forEach((h) => batch.get(h)?.forEach((e) => e.resolve(map.get(h) ?? null)))
      })
      .catch((err) => chunk.forEach((h) => batch.get(h)?.forEach((e) => e.reject(err))))
  }
}

function loadPortrait(handle: string) {
  return new Promise<MediaRef | null>((resolve, reject) => {
    const list = pending.get(handle) ?? []
    list.push({ resolve, reject })
    pending.set(handle, list)
    timer ??= setTimeout(flush, 15)
  })
}

/** First media reference of a person by handle (batched). */
export function usePersonPortrait(handle: string | undefined | null) {
  const { data } = useQuery({
    queryKey: ['people', 'portrait', handle],
    enabled: !!handle,
    staleTime: 10 * 60_000,
    queryFn: () => loadPortrait(handle!),
  })
  return data ?? null
}
