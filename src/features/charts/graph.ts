// Data loading for the tree charts: one people query per chart (see docs §8.1), turned into a
// small client-side graph index (person -> parents via primary parent family, partner families
// -> partners + children).
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { profileName, yearOf } from '@/lib/format'
import type { ChildRef, Handle, MediaRef, PersonProfile } from '@/lib/types'

export const CHARTS = ['ancestor', 'descendant', 'hourglass', 'fan', 'relationship'] as const
export type ChartKind = (typeof CHARTS)[number]
export const isChart = (s: string | undefined): s is ChartKind => !!s && (CHARTS as readonly string[]).includes(s)

export type Orientation = 'horizontal' | 'vertical'
export type FanColour = 'generation' | 'line'

/** Per-chart settings, persisted per tree. Ancestor counts include the centre person. */
export interface ChartSettings {
  ancestor: { gens: number; orientation: Orientation }
  descendant: { gens: number; orientation: Orientation }
  hourglass: { anc: number; desc: number; orientation: Orientation }
  fan: { gens: number; colour: FanColour }
  relationship: { degrees: number }
}

export const DEFAULT_SETTINGS: ChartSettings = {
  ancestor: { gens: 4, orientation: 'horizontal' },
  descendant: { gens: 3, orientation: 'horizontal' },
  hourglass: { anc: 3, desc: 2, orientation: 'vertical' },
  fan: { gens: 5, colour: 'line' },
  relationship: { degrees: 2 },
}

export const LIMITS = {
  ancestor: [2, 8],
  descendant: [1, 5],
  hourglassAnc: [2, 5],
  hourglassDesc: [1, 4],
  fan: [2, 8],
  relationship: [1, 4],
} as const

/* ---------- graph ---------- */

export interface GPerson {
  handle: Handle
  id: string
  sex: 'M' | 'F' | 'U'
  name: string
  given: string
  surname: string
  birth: number | null
  death: number | null
  dead: boolean
  media: MediaRef | null
  /** Primary parent family handle (or null). */
  parentFamily: Handle | null
  parentFamilies: Handle[]
  families: Handle[]
}

export interface GFamily {
  handle: Handle
  father: Handle | null
  mother: Handle | null
  children: Handle[]
}

export interface Graph {
  people: Map<Handle, GPerson>
  families: Map<Handle, GFamily>
  byId: Map<string, Handle>
  centre: Handle | null
  /** Second highlighted person of a relationship path (?with=). */
  target: Handle | null
}

interface RawFamily {
  handle: Handle
  father_handle: Handle | null
  mother_handle: Handle | null
  child_ref_list: ChildRef[]
}

interface RawPerson {
  handle: Handle
  gramps_id: string
  gender: number
  media_list?: MediaRef[]
  family_list?: Handle[]
  parent_family_list?: Handle[]
  profile?: PersonProfile
  extended?: {
    primary_parent_family?: RawFamily | Record<string, never>
    families?: RawFamily[]
    parent_families?: RawFamily[]
  }
}

function addFamily(g: Graph, f: RawFamily | Record<string, never> | undefined) {
  if (!f || !('handle' in f) || !f.handle || g.families.has(f.handle)) return
  g.families.set(f.handle, {
    handle: f.handle,
    father: f.father_handle || null,
    mother: f.mother_handle || null,
    children: (f.child_ref_list ?? []).map((c) => c.ref),
  })
}

function addPerson(g: Graph, p: RawPerson) {
  const pr = p.profile
  const birth = yearOf((pr?.birth as { date?: string } | undefined)?.date)
  const deathEv = pr?.death as { date?: string; type?: string } | undefined
  const death = yearOf(deathEv?.date)
  const ppf = p.extended?.primary_parent_family
  g.people.set(p.handle, {
    handle: p.handle,
    id: p.gramps_id,
    sex: p.gender === 1 ? 'M' : p.gender === 0 ? 'F' : 'U',
    name: profileName(pr) || p.gramps_id,
    given: pr?.name_given ?? '',
    surname: pr?.name_surname ?? '',
    birth,
    death,
    dead: !!deathEv && Object.keys(deathEv).length > 0,
    media: p.media_list?.[0] ?? null,
    parentFamily: ppf && 'handle' in ppf ? ppf.handle : null,
    parentFamilies: p.parent_family_list ?? [],
    families: p.family_list ?? [],
  })
  g.byId.set(p.gramps_id, p.handle)
  addFamily(g, ppf)
  p.extended?.families?.forEach((f) => addFamily(g, f))
  p.extended?.parent_families?.forEach((f) => addFamily(g, f))
}

export function buildGraph(people: RawPerson[], centreId: string): Graph {
  const g: Graph = { people: new Map(), families: new Map(), byId: new Map(), centre: null, target: null }
  people.forEach((p) => addPerson(g, p))
  g.centre = g.byId.get(centreId) ?? null
  return g
}

/* ---------- graph helpers ---------- */

export function parentsOf(g: Graph, h: Handle): { father: GPerson | null; mother: GPerson | null; family: GFamily | null } {
  const p = g.people.get(h)
  const fam = p?.parentFamily ? g.families.get(p.parentFamily) ?? null : null
  return {
    family: fam,
    father: fam?.father ? g.people.get(fam.father) ?? null : null,
    mother: fam?.mother ? g.people.get(fam.mother) ?? null : null,
  }
}

/** True when the person has parents in the database that are not loaded. */
export function hasHiddenParents(g: Graph, h: Handle) {
  const p = g.people.get(h)
  if (!p?.parentFamily) return false
  const fam = g.families.get(p.parentFamily)
  if (!fam) return true
  return (!!fam.father && !g.people.has(fam.father)) || (!!fam.mother && !g.people.has(fam.mother))
}

export function partnerFamilies(g: Graph, h: Handle) {
  const p = g.people.get(h)
  if (!p) return []
  return p.families
    .map((fh) => g.families.get(fh))
    .filter((f): f is GFamily => !!f)
    .map((f) => {
      const other = f.father === h ? f.mother : f.mother === h ? f.father : f.father ?? f.mother
      return { family: f, partner: other && other !== h ? g.people.get(other) ?? null : null, partnerHandle: other !== h ? other : null }
    })
}

export function childrenOf(g: Graph, h: Handle) {
  return partnerFamilies(g, h).flatMap(({ family }) => family.children)
}

export function hiddenChildCount(g: Graph, h: Handle) {
  return childrenOf(g, h).filter((c) => !g.people.has(c)).length
}

/* ---------- query ---------- */

const ancRule = (id: string, n: number) => ({ name: 'IsLessThanNthGenerationAncestorOf', values: [id, String(n)] })
const descRule = (id: string, n: number) => ({ name: 'IsLessThanNthGenerationDescendantOf', values: [id, String(n)] })

/**
 * Gramps filter rules for one chart. Verified against the API: the ancestor rule with n includes
 * the person and n-1 generations of ancestors; the descendant rule with n returns n generations
 * of descendants (without the person).
 */
export function chartRules(chart: ChartKind, id: string, s: ChartSettings, withId?: string) {
  if (chart === 'relationship' && withId) return { rules: [{ name: 'RelationshipPathBetween', values: [id, withId] }] }
  switch (chart) {
    case 'ancestor':
      return { function: 'or', rules: [ancRule(id, s.ancestor.gens), descRule(id, 1)] }
    case 'descendant':
      return { function: 'or', rules: [ancRule(id, 2), descRule(id, s.descendant.gens)] }
    case 'hourglass':
      return { function: 'or', rules: [ancRule(id, s.hourglass.anc), descRule(id, s.hourglass.desc)] }
    case 'fan':
      return { function: 'or', rules: [ancRule(id, s.fan.gens), descRule(id, 1)] }
    case 'relationship':
      return { rules: [{ name: 'DegreesOfSeparation', values: [id, String(s.relationship.degrees)] }] }
  }
}

/** The part of the settings that changes which data is loaded (used in the query key). */
function dataKey(chart: ChartKind, s: ChartSettings) {
  switch (chart) {
    case 'ancestor':
      return s.ancestor.gens
    case 'descendant':
      return s.descendant.gens
    case 'hourglass':
      return `${s.hourglass.anc}/${s.hourglass.desc}`
    case 'fan':
      return s.fan.gens
    case 'relationship':
      return s.relationship.degrees
  }
}

const KEYS = 'handle,gramps_id,gender,media_list,profile,extended,family_list,parent_family_list'

async function fetchChart(chart: ChartKind, id: string, s: ChartSettings, locale: string, withId?: string): Promise<Graph> {
  const people = await api<RawPerson[]>('/people/', {
    query: {
      rules: JSON.stringify(chartRules(chart, id, s, withId)),
      profile: 'self',
      locale,
      extend: 'primary_parent_family,family_list,parent_family_list',
      keys: KEYS,
    },
  })
  const g = buildGraph(people, id)
  if (withId) g.target = g.byId.get(withId) ?? null

  // Partners of descendants are not part of the descendant rule: load them in a second request.
  if (chart === 'descendant' || chart === 'hourglass' || (chart === 'relationship' && !withId)) {
    const missing = new Set<Handle>()
    for (const p of g.people.values()) {
      if (chart === 'relationship' && p.handle !== g.centre) continue
      for (const { partnerHandle } of partnerFamilies(g, p.handle)) {
        if (partnerHandle && !g.people.has(partnerHandle)) missing.add(partnerHandle)
      }
    }
    const list = [...missing]
    for (let i = 0; i < list.length; i += 80) {
      const chunk = list.slice(i, i + 80)
      const extra = await api<RawPerson[]>('/people/', {
        query: { handles: chunk.join(','), profile: 'self', locale, extend: 'primary_parent_family,family_list', keys: KEYS },
      })
      extra.forEach((p) => addPerson(g, p))
    }
  }
  return g
}

function chartQuery(chart: ChartKind, id: string, s: ChartSettings, withId?: string) {
  const locale = apiLocale()
  const path = chart === 'relationship' && withId ? withId : undefined
  return {
    queryKey: ['tree', chart, id, path ? `path:${path}` : dataKey(chart, s), locale],
    queryFn: () => fetchChart(chart, id, s, locale, path),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  }
}

export function useChartData(chart: ChartKind, id: string | undefined, s: ChartSettings, withId?: string) {
  return useQuery({
    ...chartQuery(chart, id ?? '', s, withId),
    enabled: !!id,
    placeholderData: keepPreviousData,
  })
}

/** Warm the cache for a person the pointer rests on, so recentring feels instant. */
export function usePrefetchChart(chart: ChartKind, s: ChartSettings) {
  const qc = useQueryClient()
  return useCallback((id: string) => void qc.prefetchQuery(chartQuery(chart, id, s)), [qc, chart, s])
}
