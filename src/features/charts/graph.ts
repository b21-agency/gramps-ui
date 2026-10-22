// Data loading for the tree charts: one people query per chart (see docs §8.1), turned into a
// small client-side graph index (person -> parents via primary parent family, partner families
// -> partners + children).
import { useCallback, useMemo } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { useChartGraphQuery, useChartsPrefetch, type ChartGraphArg } from '@/api/enhanced/charts'
import { usePref } from '@/lib/prefs'
import { apiLocale } from '@/i18n'
import { profileName, yearOf } from '@/lib/format'
import type { ChildRef, Handle, MediaRef, PersonProfile } from '@/lib/types'

export const CHARTS = ['ancestor', 'descendant', 'hourglass', 'fan', 'relationship'] as const
export type ChartKind = (typeof CHARTS)[number]
export const isChart = (s: string | undefined): s is ChartKind => !!s && (CHARTS as readonly string[]).includes(s)

export type Orientation = 'horizontal' | 'vertical'
/** Pattern modes colour by position; the others by a value of each person (as in Gramps Web). */
export const FAN_COLOURS = ['line', 'generation', 'nEvents', 'nNotes', 'birthYear', 'deathYear', 'age', 'surname', 'religion', 'nPaths'] as const
export type FanColour = (typeof FAN_COLOURS)[number]

/** How names are written on the charts. */
export type NameOrder = 'given' | 'surname'
export function useNameOrder() {
  return usePref<NameOrder>('chart.nameOrder', 'given')
}

/** The graph with every name written in `order` (cards, fan, export all read `name`). */
export function withNameOrder(g: Graph | undefined, order: NameOrder): Graph | undefined {
  if (!g || order === 'given') return g
  const people = new Map<Handle, GPerson>()
  for (const [h, p] of g.people) {
    people.set(h, p.surname && p.given ? { ...p, name: `${p.surname}, ${p.given}` } : p)
  }
  return { ...g, people }
}

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
  /** Full birth / death dates as displayed by the API (locale aware). */
  birthDate: string
  deathDate: string
  media: MediaRef | null
  /** Values for the fan chart colours. */
  nEvents: number
  nNotes: number
  religion: string | null
  /** Age at death in years (regular, non-estimated dates only). */
  age: number | null
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

interface RawDate {
  modifier?: number
  quality?: number
  sortval?: number
}
interface RawEvent {
  type?: string | { string?: string }
  description?: string
  date?: RawDate
}

interface RawPerson {
  handle: Handle
  gramps_id: string
  gender: number
  event_ref_list?: unknown[]
  note_list?: unknown[]
  birth_ref_index?: number
  death_ref_index?: number
  media_list?: MediaRef[]
  family_list?: Handle[]
  parent_family_list?: Handle[]
  profile?: PersonProfile
  extended?: {
    primary_parent_family?: RawFamily | Record<string, never>
    families?: RawFamily[]
    parent_families?: RawFamily[]
    events?: RawEvent[]
  }
}

function ageOf(p: RawPerson): number | null {
  const ev = p.extended?.events
  if (!ev) return null
  const regular = (d?: RawDate) => (d && d.modifier === 0 && d.quality !== 1 && d.sortval ? d.sortval : null)
  const b = regular(ev[p.birth_ref_index ?? -1]?.date)
  const d = regular(ev[p.death_ref_index ?? -1]?.date)
  return b != null && d != null ? (d - b) / 365.25 : null
}

function religionOf(p: RawPerson): string | null {
  const ev = p.extended?.events?.find((e) => (typeof e.type === 'string' ? e.type : e.type?.string) === 'Religion')
  return ev?.description || null
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
    birthDate: (pr?.birth as { date?: string } | undefined)?.date ?? '',
    deathDate: deathEv?.date ?? '',
    media: p.media_list?.[0] ?? null,
    nEvents: p.event_ref_list?.length ?? 0,
    nNotes: p.note_list?.length ?? 0,
    religion: religionOf(p),
    age: ageOf(p),
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

/** Query arguments of one chart (the cache key: rules carry the person and generations). */
function chartArg(chart: ChartKind, id: string, s: ChartSettings, locale: string, withId?: string): ChartGraphArg {
  const path = chart === 'relationship' && withId ? withId : undefined
  return {
    rules: JSON.stringify(chartRules(chart, id, s, path)),
    // the fan chart colours people by values of their events (religion, age)
    events: chart === 'fan',
    partners: chart === 'descendant' || chart === 'hourglass' ? 'all' : chart === 'relationship' && !path ? 'centre' : 'none',
    centreId: id,
    targetId: path,
    locale,
  }
}

export function useChartData(chart: ChartKind, id: string | undefined, s: ChartSettings, withId?: string) {
  const locale = apiLocale()
  const path = chart === 'relationship' && withId ? withId : undefined
  const q = useChartGraphQuery(id ? chartArg(chart, id, s, locale, path) : skipToken)
  // while a recentre loads, the previous chart stays on screen (RTK keeps `data` across args)
  const isPlaceholderData = q.isFetching && q.currentData === undefined && q.data !== undefined
  const raw = q.isError ? q.currentData : q.data
  // the graph index is built from the cached raw people (Maps don't belong in the store)
  const data = useMemo(() => {
    if (!raw) return undefined
    const g = buildGraph(raw.people as unknown as RawPerson[], raw.centreId)
    if (raw.targetId) g.target = g.byId.get(raw.targetId) ?? null
    return g
  }, [raw])
  return { ...q, data, isPlaceholderData }
}

/** Warm the cache for a person the pointer rests on, so recentring feels instant. */
export function usePrefetchChart(chart: ChartKind, s: ChartSettings) {
  const prefetch = useChartsPrefetch('chartGraph', { ifOlderThan: 5 * 60 })
  return useCallback((id: string) => prefetch(chartArg(chart, id, s, apiLocale())), [prefetch, chart, s])
}
