// Write helpers for the Gramps Web API (create / update / delete / undo).
// Writes go through the RTK Query mutations (src/api/enhanced/objects.ts), so every write
// invalidates exactly what its transaction touched; errors are thrown as `ApiError`s.
import { store } from '@/store'
import { api } from '@/api'
import { objectsApi } from '@/api/enhanced/objects'
import { tagsForKind, type TxEntry as RtkTxEntry } from '@/api/enhanced/tags'
import { unwrapApi } from '@/api/enhanced/editor'
import { type DateVal, type ObjectKind } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyObj = Record<string, any>

export const classOf: Record<ObjectKind, string> = {
  person: 'Person',
  family: 'Family',
  event: 'Event',
  place: 'Place',
  source: 'Source',
  citation: 'Citation',
  repository: 'Repository',
  note: 'Note',
  media: 'Media',
}

export const kindOfClass: Record<string, ObjectKind> = Object.fromEntries(
  Object.entries(classOf).map(([k, c]) => [c, k as ObjectKind]),
) as Record<string, ObjectKind>

export const listPathOf: Record<ObjectKind, string> = {
  person: '/people',
  family: '/families',
  event: '/events',
  place: '/places',
  source: '/sources',
  citation: '/citations',
  repository: '/repositories',
  note: '/notes',
  media: '/medialist',
}

/** One entry of the transaction list returned by every write. */
export interface TxEntry {
  type: 'add' | 'update' | 'delete'
  handle: string
  _class: string
  old: AnyObj | null
  new: AnyObj | null
}
export type Transaction = TxEntry[]

/** Client-side handle for objects created in one batch (so they can reference each other). */
export function newHandle() {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`
  return uuid.replace(/-/g, '').slice(0, 28)
}

const READ_ONLY = ['extended', 'profile', 'backlinks', 'formatted', 'thumb']

/** Copy of a fetched object without read-only keys, with `_class` set (deep clone). */
export function toWritable(kind: ObjectKind, obj: AnyObj): AnyObj {
  const copy: AnyObj = structuredClone(obj)
  for (const k of READ_ONLY) delete copy[k]
  if (kind === 'place') delete copy.type
  copy._class = classOf[kind]
  return copy
}

export function emptyDate(): DateVal {
  return { _class: 'Date', calendar: 0, modifier: 0, quality: 0, dateval: [0, 0, 0, false], sortval: 0, newyear: 0, text: '' }
}

export function emptyName(): AnyObj {
  return {
    _class: 'Name',
    first_name: '',
    surname_list: [{ _class: 'Surname', surname: '', prefix: '', connector: '', primary: true, origintype: '' }],
    title: '',
    suffix: '',
    call: '',
    nick: '',
    famnick: '',
    type: 'Birth Name',
    private: false,
    citation_list: [],
    note_list: [],
  }
}

/** Blank writable object of the given kind (handle assigned client-side). */
export function emptyObject(kind: ObjectKind): AnyObj {
  const base = { _class: classOf[kind], handle: newHandle(), private: false, tag_list: [] as string[] }
  switch (kind) {
    case 'person':
      return {
        ...base,
        gender: 2,
        primary_name: emptyName(),
        alternate_names: [],
        event_ref_list: [],
        birth_ref_index: -1,
        death_ref_index: -1,
        family_list: [],
        parent_family_list: [],
        person_ref_list: [],
        address_list: [],
        attribute_list: [],
        urls: [],
        media_list: [],
        citation_list: [],
        note_list: [],
      }
    case 'family':
      return {
        ...base,
        father_handle: '',
        mother_handle: '',
        child_ref_list: [],
        type: 'Unknown',
        event_ref_list: [],
        attribute_list: [],
        media_list: [],
        citation_list: [],
        note_list: [],
      }
    case 'event':
      return { ...base, type: 'Birth', date: emptyDate(), place: '', description: '', attribute_list: [], media_list: [], citation_list: [], note_list: [] }
    case 'place':
      return {
        ...base,
        title: '',
        name: { _class: 'PlaceName', value: '', lang: '' },
        alt_names: [],
        place_type: 'City',
        lat: '',
        long: '',
        code: '',
        placeref_list: [],
        alt_loc: [],
        urls: [],
        media_list: [],
        citation_list: [],
        note_list: [],
      }
    case 'source':
      return { ...base, title: '', author: '', pubinfo: '', abbrev: '', reporef_list: [], attribute_list: [], media_list: [], note_list: [] }
    case 'citation':
      return { ...base, source_handle: '', page: '', date: emptyDate(), confidence: 2, attribute_list: [], media_list: [], note_list: [] }
    case 'repository':
      return { ...base, name: '', type: 'Library', address_list: [], urls: [], note_list: [] }
    case 'note':
      return { ...base, text: { _class: 'StyledText', string: '', tags: [] }, format: 0, type: 'General' }
    case 'media':
      return { ...base, desc: '', date: emptyDate(), attribute_list: [], citation_list: [], note_list: [] }
  }
}

const dispatch = store.dispatch

/** Unwrap a write: a mutable copy of the transaction (RTK results are frozen; callers append to them). */
const txOf = (p: { unwrap(): Promise<unknown> }) =>
  unwrapApi(p).then((r) => (Array.isArray(r) ? [...r] : []) as Transaction)

export function putObject(kind: ObjectKind, obj: AnyObj) {
  return txOf(dispatch(objectsApi.endpoints.updateObject.initiate({ kind, handle: obj.handle, body: toWritable(kind, obj) })))
}

/** Create several objects atomically (POST /objects/). */
export function createObjects(objs: AnyObj[]) {
  // families last: the server updates the members' family lists, so they must exist first
  const sorted = [...objs.filter((o) => o._class !== 'Family'), ...objs.filter((o) => o._class === 'Family')]
  const clean = sorted.map((o) => toWritable(kindOfClass[o._class], o))
  return txOf(dispatch(objectsApi.endpoints.createObjects.initiate(clean)))
}

export function deleteObject(kind: ObjectKind, handle: string) {
  return txOf(dispatch(objectsApi.endpoints.deleteObject.initiate({ kind, handle })))
}

export function undoTransaction(tx: Transaction) {
  return txOf(dispatch(objectsApi.endpoints.undoTransaction.initiate(tx as unknown as RtkTxEntry[])))
}

/** Fetch a raw writable copy of an object (no profile/extend), always fresh from the server. */
export async function fetchWritable(kind: ObjectKind, handle: string) {
  const obj = await unwrapApi(
    dispatch(objectsApi.endpoints.getObject.initiate({ kind, handle }, { subscribe: false, forceRefetch: true })),
  )
  return toWritable(kind, obj as AnyObj)
}

/** Read-modify-write one object. */
export async function patchObject(kind: ObjectKind, handle: string, fn: (o: AnyObj) => void) {
  const obj = await fetchWritable(kind, handle)
  fn(obj)
  return putObject(kind, obj)
}

/** gramps_id of an object added/updated in a transaction. */
export function txGrampsId(tx: Transaction, handle: string) {
  return tx.find((e) => e.handle === handle && e.new)?.new?.gramps_id as string | undefined
}

/**
 * @deprecated Writes made with the helpers above (or the RTK mutations) are invalidated
 * automatically. Only for writes that bypass RTK (binary uploads): refreshes whole kinds.
 * The first argument is ignored (it used to be the TanStack QueryClient).
 */
export function invalidateAfterWrite(_unused: unknown, kinds: Array<ObjectKind | string> = []) {
  const known = kinds.filter((k): k is ObjectKind => k in classOf)
  dispatch(api.util.invalidateTags([...new Set(known)].flatMap((k) => tagsForKind(k))))
}

export function endpointsOfTx(tx: Transaction) {
  return [...new Set(tx.map((e) => kindOfClass[e._class]).filter(Boolean))]
}

/** Readable message from an API error. */
export function errorMessage(e: unknown) {
  return (e as Error)?.message ?? String(e)
}

/** All objects in `extended` (events, notes, people ...), to seed the editor session. */
export function extendedObjects(obj: AnyObj | undefined): AnyObj[] {
  const ext = obj?.extended
  if (!ext) return []
  const out: AnyObj[] = []
  for (const [k, v] of Object.entries(ext)) {
    if (k === 'backlinks' || k === 'tags') continue
    if (Array.isArray(v)) out.push(...v.filter((x) => x && typeof x === 'object' && x.handle))
    else if (v && typeof v === 'object' && (v as AnyObj).handle) out.push(v as AnyObj)
  }
  return out
}
