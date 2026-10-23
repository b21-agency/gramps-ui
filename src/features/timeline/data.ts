import { useEffect, useMemo, useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { shallowEqual } from 'react-redux'
import { TIMELINE_EVENT_KEYS, timelineApi, useTimelineScopeQuery, type TimelineEventDetail, type TimelineEventRow } from '@/api/enhanced/timeline'
import { useGetEventsQuery } from '@/api/enhanced/events-slice-enhanced'
import { useGrampsTranslations } from '@/features/lists/use-types'
import { useAppDispatch, useAppSelector } from '@/store'
import { apiLocale } from '@/i18n'
import type { DateVal } from '@/lib/types'

export interface EventLite {
  handle: string
  gramps_id: string
  place?: string
  type: string | { string: string }
  date?: Pick<DateVal, 'sortval' | 'year' | 'dateval' | 'modifier' | 'quality'>
}

export interface DatedEvent {
  handle: string
  gramps_id: string
  /** place handle */
  place?: string
  type: string
  year: number
  sortval: number
}

/** Gregorian year of a Julian day number (Gramps' `sortval`). */
function gregorianYear(jdn: number) {
  const a = jdn + 32044
  const b = Math.floor((4 * a + 3) / 146097)
  const c = a - Math.floor((146097 * b) / 4)
  const d = Math.floor((4 * c + 3) / 1461)
  const m = Math.floor((5 * (c - Math.floor((1461 * d) / 4)) + 2) / 153)
  return 100 * b + d - 4800 + Math.floor(m / 10)
}

/** All dated events, sorted chronologically (one request, cached). */
export function useAllEvents() {
  const q = useGetEventsQuery({ keys: TIMELINE_EVENT_KEYS })
  const data = useMemo(() => {
    if (!q.data) return undefined
    const out: DatedEvent[] = []
    for (const e of q.data.items as unknown as TimelineEventRow[]) {
      const sortval = e.date?.sortval ?? 0
      // non-Gregorian dates carry their own calendar's year; place them by the day number
      const year = e.date?.calendar ? gregorianYear(sortval) : e.date?.year || e.date?.dateval?.[2] || 0
      if (!sortval || !year) continue
      out.push({
        handle: e.handle,
        gramps_id: e.gramps_id,
        place: e.place || undefined,
        type: typeof e.type === 'string' ? e.type : (e.type?.string ?? ''),
        year,
        sortval,
      })
    }
    return out.sort((a, b) => a.sortval - b.sortval)
  }, [q.data])
  return { ...q, data }
}

export type ScopeMode = 'self' | 'ancestors' | 'descendants' | 'exact' | 'enclosed'

/**
 * Restricts the global timeline to one person (their own events, or those of all their
 * ancestors/descendants) or one place (exactly, or with every place it encloses).
 * Returns the matching event handles (person) or place handles (place); undefined while loading.
 */
export function useTimelineScope(kind: 'person' | 'place' | null, id: string | null, mode: ScopeMode) {
  const q = useTimelineScopeQuery(kind && id ? { kind, id, mode } : skipToken)
  // only the scope asked for, never the previous one
  const raw = q.currentData
  const data = useMemo(
    () => (raw ? { events: raw.events && new Set(raw.events), places: raw.places && new Set(raw.places) } : undefined),
    [raw],
  )
  return { ...q, data }
}

/** Localized labels for English Gramps type names (POST /translations/{lang}). */
export function useTypeLabels(types: string[]) {
  return useGrampsTranslations(types)
}

export type EventDetail = TimelineEventDetail

/**
 * Lazily loads event details (profile with participants) for the handles currently on screen.
 * Each event is its own cache entry (refreshed after writes); the requests of one tick are
 * merged, and nothing is requested while the list is scrolling fast (debounced).
 */
export function useEventDetails(visible: string[]) {
  const locale = apiLocale()
  const dispatch = useAppDispatch()
  const key = visible.join(',')
  const [settled, setSettled] = useState(key)
  useEffect(() => {
    const t = setTimeout(() => setSettled(key), 90)
    return () => clearTimeout(t)
  }, [key])
  useEffect(() => {
    if (!settled) return
    const subs = settled
      .split(',')
      .map((handle) => dispatch(timelineApi.endpoints.timelineEventDetail.initiate({ handle, locale })))
    return () => subs.forEach((s) => s.unsubscribe())
  }, [dispatch, settled, locale])
  const details = useAppSelector(
    (state) => visible.map((handle) => timelineApi.endpoints.timelineEventDetail.select({ handle, locale })(state).data),
    shallowEqual,
  )
  return useMemo(() => {
    const m = new Map<string, EventDetail>()
    visible.forEach((h, i) => {
      const d = details[i]
      if (d) m.set(h, d)
    })
    return (handle: string) => m.get(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, details])
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
