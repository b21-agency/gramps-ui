import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { apiLocale } from '@/i18n'
import type { Person, PersonProfile } from '@/lib/types'

export type Side = 'M' | 'P' | 'U'

export interface DnaSegment {
  chromosome: string
  start: number
  stop: number
  cM: number
  SNPs: number
  side: Side
  comment?: string
}

/** One item of GET /people/{h}/dna/matches */
export interface DnaMatch {
  handle: string
  segments: DnaSegment[]
  relation: string
  ancestor_handles: string[]
  ancestor_profiles: PersonProfile[]
  person_ref_idx: number
  note_handles: string[]
  raw_data?: string[]
}

/** Chromosome lengths in base pairs (GRCh37, the build most consumer DNA exports use). */
export const CHROMOSOMES: Array<{ name: string; length: number }> = [
  ['1', 249250621],
  ['2', 243199373],
  ['3', 198022430],
  ['4', 191154276],
  ['5', 180915260],
  ['6', 171115067],
  ['7', 159138663],
  ['8', 146364022],
  ['9', 141213431],
  ['10', 135534747],
  ['11', 135006516],
  ['12', 133851895],
  ['13', 115169878],
  ['14', 107349540],
  ['15', 102531392],
  ['16', 90354753],
  ['17', 81195210],
  ['18', 78077248],
  ['19', 59128983],
  ['20', 63025520],
  ['21', 48129895],
  ['22', 51304566],
  ['X', 155270560],
].map(([name, length]) => ({ name: name as string, length: length as number }))

export function normChromosome(c: string) {
  const s = String(c).trim().replace(/^chr/i, '').toUpperCase()
  return s === '23' ? 'X' : s
}

export function matchStats(m: DnaMatch) {
  const segs = m.segments ?? []
  const total = segs.reduce((s, x) => s + (Number(x.cM) || 0), 0)
  const largest = segs.reduce((s, x) => Math.max(s, Number(x.cM) || 0), 0)
  const sides = new Set(segs.map((s) => s.side))
  const side: Side = sides.size === 1 ? ([...sides][0] as Side) : 'U'
  return { total, largest, count: segs.length, side }
}

const DNA_RULES = JSON.stringify({ rules: [{ name: 'HasAssociationType', values: ['DNA'] }] })

export type DnaPerson = Pick<Person, 'handle' | 'gramps_id' | 'profile' | 'person_ref_list' | 'media_list'>

/** People that have at least one association of type "DNA". */
export function useDnaPeople() {
  return useQuery({
    queryKey: ['people', 'dna', apiLocale()],
    queryFn: () =>
      api<DnaPerson[]>('/people/', {
        query: {
          rules: DNA_RULES,
          keys: 'handle,gramps_id,profile,person_ref_list,media_list',
          profile: 'self',
          sort: 'name',
          locale: apiLocale(),
        },
      }),
  })
}

export function useDnaMatches(handle: string | undefined) {
  return useQuery({
    queryKey: ['people', handle, 'dna', 'matches', apiLocale()],
    enabled: !!handle,
    queryFn: () => api<DnaMatch[]>(`/people/${handle}/dna/matches`, { query: { locale: apiLocale(), raw: 1 } }),
  })
}

/** Profiles (+ portrait) for a set of people. */
export function usePeopleByHandle(handles: string[]) {
  const key = [...new Set(handles)].sort()
  return useQuery({
    queryKey: ['people', 'by-handles', key, apiLocale()],
    enabled: key.length > 0,
    queryFn: () =>
      api<DnaPerson[]>('/people/', {
        query: { handles: key.join(','), keys: 'handle,gramps_id,profile,media_list', profile: 'self', locale: apiLocale() },
      }),
    select: (list) => new Map(list.map((p) => [p.handle, p])),
  })
}

/** Segment colour by side (maternal, paternal, unknown). */
export const sideColor: Record<string, string> = {
  M: 'bg-chart-4',
  P: 'bg-chart-3',
  U: 'bg-primary',
}
