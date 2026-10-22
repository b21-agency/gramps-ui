import { api } from '../index'
import type { GEvent } from '@/lib/types'
import { handleBatcher } from './lists'

// Global timeline (src/features/timeline): every dated event, the person/place scope, and
// event details for the rows on screen (one cache entry per event, batched per tick).

export interface TimelineEventRow {
  handle: string
  gramps_id: string
  place?: string
  type: string | { string: string }
  date?: { sortval?: number; year?: number; dateval?: number[]; modifier?: number; quality?: number }
}

export type TimelineScopeMode = 'self' | 'ancestors' | 'descendants' | 'exact' | 'enclosed'

export interface TimelineScopeArg {
  kind: 'person' | 'place'
  id: string
  mode: TimelineScopeMode
}

/** Event handles (person scope) or place handles (place scope). */
export interface TimelineScope {
  events?: string[]
  places?: string[]
}

export type TimelineEventDetail = Pick<GEvent, 'handle' | 'gramps_id' | 'description' | 'profile'>

const detailBatchers = new Map<string, ReturnType<typeof handleBatcher<TimelineEventDetail, TimelineEventDetail | null>>>()
function detailBatcher(locale: string) {
  let b = detailBatchers.get(locale)
  if (!b) {
    b = handleBatcher<TimelineEventDetail, TimelineEventDetail | null>(
      '/api/events/',
      { keys: 'handle,gramps_id,description,profile', profile: 'participants', locale },
      (row) => row ?? null,
      60,
    )
    detailBatchers.set(locale, b)
  }
  return b
}

export const timelineApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    timelineEvents: build.query<TimelineEventRow[], void>({
      query: () => ({ url: '/api/events/', params: { keys: 'handle,gramps_id,date,type,place' } }),
      providesTags: [{ type: 'Events', id: 'LIST' }, 'Timeline'],
    }),

    timelineScope: build.query<TimelineScope, TimelineScopeArg>({
      async queryFn({ kind, id, mode }, _api, _extra, baseQuery) {
        if (kind === 'person') {
          const params =
            mode === 'ancestors' || mode === 'descendants'
              ? {
                  rules: JSON.stringify({
                    rules: [
                      {
                        name: mode === 'ancestors' ? 'IsLessThanNthGenerationAncestorOf' : 'IsLessThanNthGenerationDescendantOf',
                        values: [id, '100'],
                      },
                    ],
                  }),
                }
              : { gramps_id: id }
          const r = await baseQuery({ url: '/api/people/', params: { ...params, keys: 'handle,event_ref_list' } })
          if (r.error) return { error: r.error }
          const people = r.data as Array<{ event_ref_list?: Array<{ ref: string }> }>
          return { data: { events: [...new Set(people.flatMap((p) => (p.event_ref_list ?? []).map((x) => x.ref)))] } }
        }
        const params =
          mode === 'enclosed' ? { rules: JSON.stringify({ rules: [{ name: 'IsEnclosedBy', values: [id, '1'] }] }) } : { gramps_id: id }
        const r = await baseQuery({ url: '/api/places/', params: { ...params, keys: 'handle' } })
        if (r.error) return { error: r.error }
        return { data: { places: (r.data as Array<{ handle: string }>).map((p) => p.handle) } }
      },
      providesTags: (_r, _e, { kind }) => [kind === 'person' ? { type: 'People', id: 'LIST' } : { type: 'Places', id: 'LIST' }, 'Timeline'],
    }),

    /** One event with participants (rows on screen request these; merged into one call per tick). */
    timelineEventDetail: build.query<TimelineEventDetail | null, { handle: string; locale: string }>({
      queryFn: ({ handle, locale }, _api, _extra, baseQuery) => detailBatcher(locale)(baseQuery, handle),
      providesTags: (_r, _e, { handle }) => [{ type: 'Events', id: handle }, 'Timeline'],
      keepUnusedDataFor: 600,
    }),
  }),
})

export const { useTimelineEventsQuery, useTimelineScopeQuery } = timelineApi
