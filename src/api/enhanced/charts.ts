import { api } from '../index'
import { chunks, run } from './compose'
import type { Page } from './page'
import { peopleApi } from './people-slice-enhanced'

// Composite for the tree charts (src/features/charts): one people query per chart, plus
// requests for partners of descendants (they are not part of the descendant filter rule).
// The cache holds the raw people (serializable); the chart builds its graph index from them.

export interface ChartGraphArg {
  /** Gramps filter (JSON) selecting the chart's people */
  rules: string
  /** load events too (fan chart colours by religion / age) */
  events: boolean
  /** load missing partners: of everybody, of the centre person only, or none */
  partners: 'all' | 'centre' | 'none'
  centreId: string
  /** second person of a relationship path (?with=) */
  targetId?: string
  locale: string
}

/** The loaded people plus the ids the chart was loaded for (so a stale chart knows its centre). */
export interface ChartData {
  centreId: string
  targetId: string | null
  people: ChartRawPerson[]
}

/** A person as the chart query returns it (see `CHART_KEYS`). */
export interface ChartRawPerson {
  handle: string
  gramps_id: string
  family_list?: string[]
  extended?: {
    families?: Array<{ handle: string; father_handle: string | null; mother_handle: string | null }>
  }
  [key: string]: unknown
}

export const CHART_KEYS = [
  'handle',
  'gramps_id',
  'gender',
  'media_list',
  'profile',
  'extended',
  'family_list',
  'parent_family_list',
  'event_ref_list',
  'note_list',
  'birth_ref_index',
  'death_ref_index',
]

export const chartsApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    chartGraph: build.query<ChartData, ChartGraphArg>({
      async queryFn(arg, queryApi) {
        const load = (select: { rules: string } | { handles: string[] }, extend: string[]) =>
          run<Page<ChartRawPerson>>(
            queryApi,
            peopleApi.endpoints.getPeople.initiate(
              { ...select, profile: ['self'], locale: arg.locale, extend, keys: CHART_KEYS },
              { subscribe: false, forceRefetch: true },
            ),
          )
        const done = (people: ChartRawPerson[]) => ({ data: { centreId: arg.centreId, targetId: arg.targetId ?? null, people } })

        const r = await load({ rules: arg.rules }, [
          'primary_parent_family',
          'family_list',
          'parent_family_list',
          ...(arg.events ? ['event_ref_list'] : []),
        ])
        if ('error' in r) return r
        const people = [...r.data.items]
        if (arg.partners === 'none') return done(people)

        // partners of the loaded people (or the centre) that the rule didn't select
        const have = new Set(people.map((p) => p.handle))
        const missing = new Set<string>()
        for (const p of people) {
          if (arg.partners === 'centre' && p.gramps_id !== arg.centreId) continue
          for (const f of p.extended?.families ?? []) {
            for (const h of [f.father_handle, f.mother_handle]) if (h && h !== p.handle && !have.has(h)) missing.add(h)
          }
        }
        for (const handles of chunks([...missing])) {
          const extra = await load({ handles }, ['primary_parent_family', 'family_list'])
          if ('error' in extra) return extra
          people.push(...extra.data.items)
        }
        return done(people)
      },
      // any change to people or families can reshape a chart
      providesTags: (res) => [
        { type: 'People', id: 'LIST' },
        { type: 'Families', id: 'LIST' },
        'Relations',
        ...(res?.people ?? []).map((p) => ({ type: 'People' as const, id: p.handle })),
      ],
      // recentring back and forth stays instant
      keepUnusedDataFor: 30 * 60,
    }),
  }),
})

export const { useChartGraphQuery, usePrefetch: useChartsPrefetch } = chartsApi
