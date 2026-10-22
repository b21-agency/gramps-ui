import { api } from '../index'
import type { BaseQueryFn } from './lists'

// Tree charts (src/features/charts): one people query per chart, plus a second request for
// partners of descendants (they are not part of the descendant filter rule). The cache holds
// the raw people (serializable); the chart builds its graph index from them.

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

/** A person as the chart query returns it (see `KEYS`). */
export interface ChartRawPerson {
  handle: string
  gramps_id: string
  family_list?: string[]
  extended?: {
    families?: Array<{ handle: string; father_handle: string | null; mother_handle: string | null }>
  }
  [key: string]: unknown
}

export const CHART_KEYS =
  'handle,gramps_id,gender,media_list,profile,extended,family_list,parent_family_list,event_ref_list,note_list,birth_ref_index,death_ref_index'

async function loadChart(baseQuery: BaseQueryFn, arg: ChartGraphArg) {
  const done = (people: ChartRawPerson[]) => ({ data: { centreId: arg.centreId, targetId: arg.targetId ?? null, people } })
  const r = await baseQuery({
    url: '/api/people/',
    params: {
      rules: arg.rules,
      profile: 'self',
      locale: arg.locale,
      extend: `primary_parent_family,family_list,parent_family_list${arg.events ? ',event_ref_list' : ''}`,
      keys: CHART_KEYS,
    },
  })
  if (r.error) return { error: r.error }
  const people = [...(r.data as ChartRawPerson[])]
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
  const list = [...missing]
  for (let i = 0; i < list.length; i += 80) {
    const extra = await baseQuery({
      url: '/api/people/',
      params: {
        handles: list.slice(i, i + 80).join(','),
        profile: 'self',
        locale: arg.locale,
        extend: 'primary_parent_family,family_list',
        keys: CHART_KEYS,
      },
    })
    if (extra.error) return { error: extra.error }
    people.push(...(extra.data as ChartRawPerson[]))
  }
  return done(people)
}

export const chartsApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    chartGraph: build.query<ChartData, ChartGraphArg>({
      queryFn: (arg, _api, _extra, baseQuery) => loadChart(baseQuery, arg),
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
