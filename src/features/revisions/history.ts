// Change history (undo log) of the Gramps Web API: types, readable values, field-level diff.
import type { TFunction } from 'i18next'
import { useTypeMapsQuery } from '@/api/enhanced/revisions'
import { displayName } from '@/lib/format'
import { normalizeKind } from '@/lib/objects'
import type { Name, ObjectKind } from '@/lib/types'

/* ---------- API shapes ---------- */

export type TransType = 0 | 1 | 2 // added, changed, deleted
export type RawObject = Record<string, unknown>

export interface Change {
  id: number
  obj_class: string
  trans_type: TransType
  obj_handle: string
  ref_handle: string | null
  timestamp: number
  old_data?: RawObject | unknown[]
  new_data?: RawObject | unknown[]
}

export interface Transaction {
  id: number
  connection: { id: number; timestamp: number; user: { name: string; full_name: string } | null }
  description: string
  first: number
  last: number
  undo: boolean
  timestamp: number
  changes: Change[]
}

export interface UndoCheck {
  transaction_id: number
  can_undo_without_force: boolean
  total_changes: number
  conflicts_count: number
  conflicts: Array<{ change_index: number; object_class: string; handle: string; conflict_type: string; description: string }>
}

/** Changes on primary objects; numeric classes ("7" = reference table) are internal bookkeeping. */
export function primaryChanges(tx: Transaction) {
  return tx.changes.filter((c) => !/^\d+$/.test(String(c.obj_class)))
}

/** Whether the transaction reverted an earlier one (desktop undo flag or an API undo). */
export function isUndo(tx: Transaction) {
  return tx.undo || /^_?undo\b/i.test(tx.description)
}

export const transVerb = ['added', 'changed', 'deleted'] as const

export function asObject(d: unknown): RawObject | null {
  return d && typeof d === 'object' && !Array.isArray(d) && Object.keys(d).length ? (d as RawObject) : null
}

/** The object's state that best identifies it (new after add/update, old after delete). */
export function changeObject(c: Change) {
  return c.trans_type === 2 ? asObject(c.old_data) : (asObject(c.new_data) ?? asObject(c.old_data))
}

/* ---------- typed values ---------- */

const typeDatatype: Record<string, string> = {
  EventRoleType: 'event_role_types',
  NameType: 'name_types',
  NameOriginType: 'name_origin_types',
  EventType: 'event_types',
  FamilyRelType: 'family_relation_types',
  ChildRefType: 'child_reference_types',
  AttributeType: 'attribute_types',
  SrcAttributeType: 'source_attribute_types',
  NoteType: 'note_types',
  PlaceType: 'place_types',
  RepositoryType: 'repository_types',
  SourceMediaType: 'source_media_types',
  UrlType: 'url_types',
}

export type TypeMaps = Record<string, Record<string, string>>

/** Value → English name maps for all Gramps default types (fetched once per session). */
export function useTypeMaps() {
  return useTypeMapsQuery()
}

interface RawTyped {
  _class: string
  string?: string
  value?: number
}

function isTyped(v: unknown): v is RawTyped {
  return !!v && typeof v === 'object' && typeof (v as RawTyped)._class === 'string' && (v as RawTyped)._class.endsWith('Type') && 'value' in (v as object)
}

export function typedLabel(v: unknown, maps?: TypeMaps): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (!isTyped(v)) return ''
  if (v.value === 0 && v.string) return v.string // custom type
  const dt = typeDatatype[v._class]
  return (dt && maps?.[dt]?.[String(v.value)]) || v.string || String(v.value ?? '')
}

/* ---------- dates ---------- */

interface RawDate {
  _class: 'Date'
  calendar?: number
  modifier?: number
  quality?: number
  dateval?: Array<number | boolean>
  text?: string
  sortval?: number
}

function isDate(v: unknown): v is RawDate {
  return !!v && typeof v === 'object' && (v as { _class?: string })._class === 'Date'
}

function ymd(d: number, m: number, y: number) {
  if (!y && !m && !d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return [y || '????', m ? pad(m) : null, m && d ? pad(d) : null].filter(Boolean).join('-')
}

export function dateLabel(d: RawDate, t: TFunction): string {
  const mod = d.modifier ?? 0
  if (mod === 6) return d.text ?? '' // text only
  const v = (d.dateval ?? []) as number[]
  const a = ymd(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0)
  const b = ymd(v[4] ?? 0, v[5] ?? 0, v[6] ?? 0)
  if (!a && !b) return d.text ?? ''
  let s: string
  switch (mod) {
    case 1:
      s = t('revisions:date.before', { date: a })
      break
    case 2:
      s = t('revisions:date.after', { date: a })
      break
    case 3:
      s = t('revisions:date.about', { date: a })
      break
    case 4:
      s = t('revisions:date.range', { from: a, to: b })
      break
    case 5:
      s = t('revisions:date.span', { from: a, to: b })
      break
    case 7:
      s = t('revisions:date.from', { date: a })
      break
    case 8:
      s = t('revisions:date.to', { date: a })
      break
    default:
      s = a
  }
  if (d.quality === 1) s = t('revisions:date.estimated', { date: s })
  if (d.quality === 2) s = t('revisions:date.calculated', { date: s })
  return s
}

/* ---------- object titles ---------- */

export function objectKind(cls: string): ObjectKind | null {
  return normalizeKind(cls)
}

/** Readable title from raw object data. */
export function rawTitle(cls: string, o: RawObject | null, maps: TypeMaps | undefined, t: TFunction): string {
  if (!o) return ''
  const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : '')
  switch (cls) {
    case 'Person':
      return displayName(o.primary_name as Name) || s('gramps_id')
    case 'Family':
      return t('revisions:familyTitle', { id: s('gramps_id') })
    case 'Event': {
      const type = typedLabel(o.type, maps)
      const date = isDate(o.date) ? dateLabel(o.date, t) : ''
      return [type, date].filter(Boolean).join(', ') || s('description') || s('gramps_id')
    }
    case 'Place':
      return ((o.name as { value?: string })?.value ?? '') || s('title') || s('gramps_id')
    case 'Source':
      return s('title') || s('gramps_id')
    case 'Citation':
      return s('page') || s('gramps_id')
    case 'Repository':
      return s('name') || s('gramps_id')
    case 'Note': {
      const text = ((o.text as { string?: string })?.string ?? '').trim()
      return text ? (text.length > 80 ? `${text.slice(0, 80)}…` : text) : s('gramps_id')
    }
    case 'Media':
      return s('desc') || s('path') || s('gramps_id')
    case 'Tag':
      return s('name')
    default:
      return s('gramps_id') || s('name') || s('title')
  }
}

/** One-line summary of what a transaction did, e.g. "Changed person Anna Huber". */
export function summarize(tx: Transaction, maps: TypeMaps | undefined, t: TFunction) {
  const changes = primaryChanges(tx)
  if (!changes.length) return { headline: tx.description, more: 0, first: null }
  // Prefer the "main" change: added/deleted objects over side effects on others
  const sorted = [...changes].sort((a, b) => (a.trans_type === 1 ? 1 : 0) - (b.trans_type === 1 ? 1 : 0))
  const first = sorted[0]
  const title = rawTitle(first.obj_class, changeObject(first), maps, t)
  const headline = t(`verbObject.${transVerb[first.trans_type]}`, {
    object: t(`objectClass.${first.obj_class}`, { defaultValue: first.obj_class }),
    title: title || first.obj_handle,
  })
  return { headline, more: changes.length - 1, first }
}

/* ---------- flatten + diff ---------- */

export type RefKind = ObjectKind | 'tag'

export type Leaf =
  | { type: 'text'; text: string; long?: boolean }
  | { type: 'refs'; kind: RefKind; handles: string[] }

export interface FlatField {
  key: string // stable path, e.g. primary_name.surname_list.0.surname
  labels: string[] // readable path segments
  leaf: Leaf
}

const SKIP = new Set(['_class', 'change', 'handle'])
const HANDLE_LISTS: Record<string, RefKind> = {
  note_list: 'note',
  citation_list: 'citation',
  family_list: 'family',
  parent_family_list: 'family',
  tag_list: 'tag',
}
const HANDLE_FIELDS: Record<string, RefKind> = {
  father_handle: 'person',
  mother_handle: 'person',
  source_handle: 'source',
  place: 'place',
}
const REF_LISTS: Record<string, RefKind> = {
  event_ref_list: 'event',
  media_list: 'media',
  child_ref_list: 'person',
  person_ref_list: 'person',
  reporef_list: 'repository',
  placeref_list: 'place',
}

function humanize(key: string) {
  const s = key.replace(/_/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fieldLabel(key: string, t: TFunction) {
  return t(`revisions:fields.${key}`, { defaultValue: humanize(key) })
}

/** Drop a segment that repeats the previous one ("Surname › Surname"). */
function dedupe(labels: string[]) {
  return labels.filter((l, i) => i === 0 || l !== labels[i - 1])
}

function primitiveText(key: string, v: unknown, t: TFunction): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? t('revisions:yes') : t('revisions:no')
  if (typeof v === 'number') {
    if (key === 'gender') return t(`revisions:gender.${v}`, { defaultValue: String(v) })
    if (key === 'confidence') return t(`revisions:confidence.${v}`, { defaultValue: String(v) })
    if (key === 'format') return t(`revisions:noteFormat.${v}`, { defaultValue: String(v) })
    return String(v)
  }
  return String(v)
}

/** Flatten a raw Gramps object into readable leaf fields. */
export function flatten(obj: RawObject | null, maps: TypeMaps | undefined, t: TFunction): FlatField[] {
  const out: FlatField[] = []
  if (!obj) return out
  const walk = (v: unknown, key: string, path: string[], labels: string[], parentList?: string) => {
    if (SKIP.has(key)) return
    const p = [...path, key]
    const l = [...labels, fieldLabel(key, t)]
    const push = (leaf: Leaf, lbl = l) => out.push({ key: p.join('.'), labels: dedupe(lbl), leaf })

    if (key === 'ref' && parentList && REF_LISTS[parentList] && typeof v === 'string') {
      push({ type: 'refs', kind: REF_LISTS[parentList], handles: [v] }, [...labels, fieldLabel('ref', t)])
      return
    }
    if (HANDLE_FIELDS[key] && (typeof v === 'string' || v === null)) {
      push({ type: 'refs', kind: HANDLE_FIELDS[key], handles: v ? [v as string] : [] })
      return
    }
    if (Array.isArray(v)) {
      if (HANDLE_LISTS[key] || v.every((x) => typeof x === 'string')) {
        if (HANDLE_LISTS[key]) push({ type: 'refs', kind: HANDLE_LISTS[key], handles: v as string[] })
        else push({ type: 'text', text: (v as string[]).filter(Boolean).join(', ') })
        return
      }
      if (v.every((x) => typeof x === 'number' || typeof x === 'boolean')) {
        push({ type: 'text', text: v.join(', ') })
        return
      }
      v.forEach((item, i) => {
        const itemLabels = [...labels, key === 'surname_list' && v.length === 1 ? fieldLabel(key, t) : `${fieldLabel(key, t)} ${i + 1}`]
        const itemPath = [...p, String(i)]
        if (item && typeof item === 'object' && !Array.isArray(item) && !isTyped(item) && !isDate(item)) {
          for (const [k, x] of Object.entries(item as RawObject)) walk(x, k, itemPath, itemLabels, key)
        } else {
          const text = isTyped(item) ? typedLabel(item, maps) : isDate(item) ? dateLabel(item, t) : primitiveText(key, item, t)
          out.push({ key: itemPath.join('.'), labels: dedupe(itemLabels), leaf: { type: 'text', text } })
        }
      })
      return
    }
    if (isTyped(v)) return push({ type: 'text', text: typedLabel(v, maps) })
    if (isDate(v)) return push({ type: 'text', text: dateLabel(v, t) })
    if (v && typeof v === 'object') {
      const o = v as RawObject
      if (o._class === 'StyledText') return push({ type: 'text', text: String(o.string ?? ''), long: true })
      for (const [k, x] of Object.entries(o)) walk(x, k, p, l)
      return
    }
    push({ type: 'text', text: primitiveText(key, v, t), long: key === 'text' || key === 'description' })
  }
  for (const [k, v] of Object.entries(obj)) walk(v, k, [], [])
  return out
}

export function leafEmpty(l: Leaf | undefined) {
  if (!l) return true
  return l.type === 'text' ? l.text === '' : l.handles.length === 0
}

function leafKey(l: Leaf | undefined) {
  if (!l) return ''
  return l.type === 'text' ? `t:${l.text}` : `r:${l.handles.join(',')}`
}

export interface DiffRow {
  key: string
  labels: string[]
  before?: Leaf
  after?: Leaf
}

/** Fields whose readable value differs between old and new. */
export function diffObjects(
  oldObj: RawObject | null,
  newObj: RawObject | null,
  maps: TypeMaps | undefined,
  t: TFunction,
): DiffRow[] {
  const a = new Map(flatten(oldObj, maps, t).map((f) => [f.key, f]))
  const b = new Map(flatten(newObj, maps, t).map((f) => [f.key, f]))
  const keys = [...new Set([...a.keys(), ...b.keys()])]
  const rows: DiffRow[] = []
  for (const k of keys) {
    const fa = a.get(k)
    const fb = b.get(k)
    if (leafKey(fa?.leaf) === leafKey(fb?.leaf)) continue
    if (leafEmpty(fa?.leaf) && leafEmpty(fb?.leaf)) continue
    const no = t('revisions:no')
    const isNo = (l?: Leaf) => l?.type === 'text' && l.text === no
    if ((!fa && isNo(fb?.leaf)) || (!fb && isNo(fa?.leaf))) continue // a flag on an added/removed list item
    rows.push({ key: k, labels: (fb ?? fa)!.labels, before: fa?.leaf, after: fb?.leaf })
  }
  return rows
}

const NOISE = new Set(['gramps_id', 'primary', 'checksum', 'display_as', 'sort_as', 'format', 'birth_ref_index', 'death_ref_index', 'calendar', 'newyear'])

/** Non-empty fields of a newly added or deleted object, for a compact summary. */
export function meaningfulFields(obj: RawObject | null, maps: TypeMaps | undefined, t: TFunction) {
  return flatten(obj, maps, t).filter((f) => {
    if (leafEmpty(f.leaf)) return false
    const last = f.key.split('.').at(-1)!
    if (NOISE.has(last)) return false
    if (f.leaf.type === 'text' && f.leaf.text === t('revisions:no')) return false // private: false, primary: false
    return true
  })
}
