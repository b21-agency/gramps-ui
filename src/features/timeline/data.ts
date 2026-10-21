import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { apiLocale } from '@/i18n'
import type { DateVal, GEvent } from '@/lib/types'

export interface EventLite {
  handle: string
  gramps_id: string
  type: string | { string: string }
  date?: Pick<DateVal, 'sortval' | 'year' | 'dateval' | 'modifier' | 'quality'>
}

export interface DatedEvent {
  handle: string
  gramps_id: string
  type: string
  year: number
  sortval: number
}

/** All dated events, sorted chronologically (one request, cached). */
export function useAllEvents() {
  return useQuery({
    queryKey: ['events', 'timeline-all'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<DatedEvent[]> => {
      const list = await api<EventLite[]>('/events/', {
        query: { keys: 'handle,gramps_id,date,type' },
      })
      const out: DatedEvent[] = []
      for (const e of list) {
        const sortval = e.date?.sortval ?? 0
        const year = e.date?.year || e.date?.dateval?.[2] || 0
        if (!sortval || !year) continue
        out.push({
          handle: e.handle,
          gramps_id: e.gramps_id,
          type: typeof e.type === 'string' ? e.type : e.type?.string ?? '',
          year,
          sortval,
        })
      }
      return out.sort((a, b) => a.sortval - b.sortval)
    },
  })
}

/** Localized labels for English Gramps type names (POST /translations/{lang}). */
export function useTypeLabels(types: string[]) {
  const lang = apiLocale()
  const key = [...new Set(types)].sort()
  const q = useQuery({
    queryKey: ['translations', lang, key],
    enabled: key.length > 0 && lang !== 'en',
    staleTime: Infinity,
    queryFn: () =>
      api<Array<{ original: string; translation: string }>>(`/translations/${lang}`, {
        method: 'POST',
        json: { strings: key },
      }),
  })
  return useMemo(() => {
    const m = new Map<string, string>()
    q.data?.forEach((r) => m.set(r.original, r.translation))
    return (t: string) => m.get(t) ?? t
  }, [q.data])
}

export type EventDetail = Pick<GEvent, 'handle' | 'gramps_id' | 'description' | 'profile'>

const detailCache = new Map<string, EventDetail>()
const inflight = new Set<string>()

/**
 * Lazily loads event details (profile with participants) for the handles currently on screen.
 * Results are cached for the session; requests are batched and debounced while scrolling.
 */
export function useEventDetails(visible: string[]) {
  const lang = apiLocale()
  const [, setVersion] = useState(0)
  const key = visible.join(',')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const missing = visible.filter((h) => !detailCache.has(`${lang}:${h}`) && !inflight.has(`${lang}:${h}`))
      for (let i = 0; i < missing.length; i += 60) {
        const chunk = missing.slice(i, i + 60)
        chunk.forEach((h) => inflight.add(`${lang}:${h}`))
        api<EventDetail[]>('/events/', {
          query: {
            handles: chunk.join(','),
            keys: 'handle,gramps_id,description,profile',
            profile: 'participants',
            locale: lang,
          },
        })
          .then((rows) => {
            rows.forEach((r) => detailCache.set(`${lang}:${r.handle}`, r))
            setVersion((v) => v + 1)
          })
          .catch(() => {
            /* rows stay in their loading state; scrolling retries */
          })
          .finally(() => chunk.forEach((h) => inflight.delete(`${lang}:${h}`)))
      }
    }, 90)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lang])

  return (handle: string) => detailCache.get(`${lang}:${handle}`)
}

/** Item of /people/{h}/timeline */
export interface PersonTimelineItem {
  handle: string
  gramps_id: string
  date: string
  type: string
  label: string
  description: string
  role: string
  age?: string
  media?: string[]
  person?: {
    relationship?: string
    handle?: string
    gramps_id?: string
    name_given?: string
    name_surname?: string
    name_suffix?: string
    name_display?: string
    sex?: string
    birth?: { date?: string }
    death?: { date?: string }
  }
  place?: { handle?: string; gramps_id?: string; name?: string; display_name?: string }
}

/** Dot colour for an event type (token classes). */
export function typeTone(type: string) {
  switch (type) {
    case 'Birth':
    case 'Baptism':
    case 'Christening':
      return 'bg-primary'
    case 'Marriage':
    case 'Engagement':
    case 'Marriage Banns':
      return 'bg-brass'
    case 'Death':
    case 'Burial':
    case 'Cremation':
      return 'bg-foreground/60'
    default:
      return 'bg-lineage'
  }
}
