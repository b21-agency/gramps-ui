import { api } from '../index'
import type { GEvent } from '@/lib/types'
import { handleBatcher, run } from './compose'
import { eventsApi } from './events-slice-enhanced'
import type { Page } from './page'
import { peopleApi } from './people-slice-enhanced'
import { placesApi } from './places-slice-enhanced'

// Composites for the global timeline (src/features/timeline): the person/place scope and
// event details for the rows on screen (one cache entry per event, batched per tick). The
// list of all dated events is the generated `getEvents` (TIMELINE_EVENT_KEYS).

export interface TimelineEventRow {
  handle: string
  gramps_id: string
  place?: string
  type: string | { string: string }
  date?: { sortval?: number; year?: number; dateval?: number[]; modifier?: number; quality?: number }
}

/** Keys of every event the timeline loads up front. */
export const TIMELINE_EVENT_KEYS = ['handle', 'gramps_id', 'date', 'type', 'place']

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

const rules = (name: string, values: string[]) => JSON.stringify({ rules: [{ name, values }] })

const detailBatchers = new Map<string, ReturnType<typeof handleBatcher<TimelineEventDetail, TimelineEventDetail | null>>>()
function detailBatcher(locale: string) {
  let b = detailBatchers.get(locale)
  if (!b) {
    b = handleBatcher<TimelineEventDetail, TimelineEventDetail | null>(
      (queryApi, handles) =>
        run<Page<TimelineEventDetail>>(
          queryApi,
          eventsApi.endpoints.getEvents.initiate(
            { handles, keys: ['handle', 'gramps_id', 'description', 'profile'], profile: ['participants'], locale },
            { subscribe: false, forceRefetch: true },
          ),
        ).then((r) => ('data' in r ? { data: r.data.items } : r)),
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
    timelineScope: build.query<TimelineScope, TimelineScopeArg>({
      async queryFn({ kind, id, mode }, queryApi) {
        if (kind === 'person') {
          const select =
            mode === 'ancestors' || mode === 'descendants'
              ? { rules: rules(mode === 'ancestors' ? 'IsLessThanNthGenerationAncestorOf' : 'IsLessThanNthGenerationDescendantOf', [id, '100']) }
              : { grampsId: id }
          const r = await run<Page<{ event_ref_list?: Array<{ ref: string }> }>>(
            queryApi,
            peopleApi.endpoints.getPeople.initiate({ ...select, keys: ['handle', 'event_ref_list'] }, { subscribe: false, forceRefetch: true }),
          )
          if ('error' in r) return r
          return { data: { events: [...new Set(r.data.items.flatMap((p) => (p.event_ref_list ?? []).map((x) => x.ref)))] } }
        }
        const select = mode === 'enclosed' ? { rules: rules('IsEnclosedBy', [id, '1']) } : { grampsId: id }
        const r = await run<Page<{ handle: string }>>(
          queryApi,
          placesApi.endpoints.getPlaces.initiate({ ...select, keys: ['handle'] }, { subscribe: false, forceRefetch: true }),
        )
        if ('error' in r) return r
        return { data: { places: r.data.items.map((p) => p.handle) } }
      },
      providesTags: (_r, _e, { kind }) => [kind === 'person' ? { type: 'People', id: 'LIST' } : { type: 'Places', id: 'LIST' }, 'Timeline'],
    }),

    /** One event with participants (rows on screen request these; merged into one call per tick). */
    timelineEventDetail: build.query<TimelineEventDetail | null, { handle: string; locale: string }>({
      queryFn: ({ handle, locale }, queryApi) => detailBatcher(locale)(queryApi, handle),
      providesTags: (_r, _e, { handle }) => [{ type: 'Events', id: handle }, 'Timeline'],
      keepUnusedDataFor: 600,
    }),
  }),
})

export const { useTimelineScopeQuery } = timelineApi
