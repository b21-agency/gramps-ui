import { useEffect, useMemo, useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { MAP_EVENT_KEYS, useMapPlaceCoordinatesQuery, type MapEventRow } from '@/api/enhanced/map'
import { useGetEventsQuery } from '@/api/enhanced/events-slice-enhanced'
import { apiLocale } from '@/i18n'

export interface PlacePoint {
  handle: string
  name: string
  lat: number
  long: number
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** A (lat, long) pair that is usable on a map (0/0 means "not geocoded" in Gramps). */
export function validCoords(lat: unknown, long: unknown): [number, number] | null {
  const a = num(lat)
  const b = num(long)
  if (a === null || b === null) return null
  if (a === 0 && b === 0) return null
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null
  return [a, b]
}

/**
 * All geocoded places. Uses the compact /places/coordinates/ endpoint (API >= 3.23) and falls
 * back to the place list with profiles on older servers.
 */
export function usePlaceCoordinates() {
  const q = useMapPlaceCoordinatesQuery({ locale: apiLocale() })
  const data = useMemo(() => {
    if (!q.data) return undefined
    const out: PlacePoint[] = []
    for (const r of q.data) {
      const c = validCoords(r.lat, r.long)
      if (c) out.push({ handle: r.handle, name: r.name, lat: c[0], long: c[1] })
    }
    return out
  }, [q.data])
  return { ...q, data }
}

export interface PlaceEvent {
  /** null = undated */
  year: number | null
  type: string
}

export interface PlaceYears {
  /** place handle -> sorted distinct years of events that happened there */
  byPlace: Map<string, number[]>
  /** place handle -> every event there (year + English type name) */
  events: Map<string, PlaceEvent[]>
  /** event types of events with a place, most frequent first */
  typeCounts: Array<[string, number]>
  min: number
  max: number
}

/**
 * Places with at least one event matching all active filters (year range, event types); without
 * active filters every place, also those without events (same rule as the classic map).
 */
export function filterPlacesByEvents(
  places: PlacePoint[],
  data: PlaceYears | undefined,
  range: [number, number] | null,
  types: string[],
): PlacePoint[] {
  if (!data || (!range && !types.length)) return places
  const set = new Set(types)
  return places.filter((p) =>
    (data.events.get(p.handle) ?? []).some(
      (e) =>
        (!range || (e.year != null && e.year >= range[0] && e.year <= range[1])) && (!set.size || set.has(e.type)),
    ),
  )
}

/** Years of all dated events per place, for the time filter. Fetched only when needed. */
export function usePlaceYears(enabled: boolean) {
  const q = useGetEventsQuery(enabled ? { keys: MAP_EVENT_KEYS } : skipToken)
  const data = useMemo(() => (q.data ? placeYears(q.data.items as unknown as MapEventRow[]) : undefined), [q.data])
  return { ...q, data }
}

function placeYears(events: MapEventRow[]): PlaceYears {
  const byPlace = new Map<string, Set<number>>()
  const all = new Map<string, PlaceEvent[]>()
  const counts = new Map<string, number>()
  let min = Infinity
  let max = -Infinity
  for (const e of events) {
    if (!e.place) continue
    const type = typeof e.type === 'string' ? e.type : (e.type?.string ?? '')
    const y = e.date?.year || e.date?.dateval?.[2]
    const dated = !!y && !!e.date?.sortval
    let list = all.get(e.place)
    if (!list) all.set(e.place, (list = []))
    list.push({ year: dated ? y! : null, type })
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1)
    if (!dated) continue
    let s = byPlace.get(e.place)
    if (!s) byPlace.set(e.place, (s = new Set()))
    s.add(y)
    if (y < min) min = y
    if (y > max) max = y
  }
  const out = new Map<string, number[]>()
  byPlace.forEach((s, k) => out.set(k, [...s].sort((a, b) => a - b)))
  const typeCounts = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (!Number.isFinite(min)) {
    const now = new Date().getFullYear()
    return { byPlace: out, events: all, typeCounts, min: now - 100, max: now }
  }
  return { byPlace: out, events: all, typeCounts, min, max }
}

/** Whether any of the (sorted) years falls into [from, to]. */
export function hasYearIn(years: number[] | undefined, from: number, to: number) {
  if (!years?.length) return false
  let lo = 0
  let hi = years.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (years[mid] < from) lo = mid + 1
    else hi = mid
  }
  return lo < years.length && years[lo] <= to
}

/** Item of /people/{h}/timeline */
export interface TimelineItem {
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
    birth?: Record<string, string>
    death?: Record<string, string>
  }
  place?: {
    handle?: string
    gramps_id?: string
    name?: string
    display_name?: string
    type?: string
    lat?: number
    long?: number
  }
}

/** Track the html.dark class (set by ThemeProvider). */
export function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setDark(el.classList.contains('dark')))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

/** Resolve a CSS custom property (design token) to a concrete colour for canvas/WebGL use. */
export function cssVar(name: string, fallback = '#a7adb7') {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}
