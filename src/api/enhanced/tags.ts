import type { TagDescription } from '@reduxjs/toolkit/query'
import { endpointOf, type ObjectKind } from '@/lib/types'
import type { tagTypes } from '../index'

export type TagType = (typeof tagTypes)[number]

/** Cache tag type for each Gramps object kind (same names as the API's OpenAPI tags). */
export const tagOf: Record<ObjectKind | 'tag', TagType> = {
  person: 'People',
  family: 'Families',
  event: 'Events',
  place: 'Places',
  source: 'Sources',
  citation: 'Citations',
  repository: 'Repositories',
  note: 'Notes',
  media: 'Media',
  tag: 'Tags',
}

const tagOfClass: Record<string, TagType> = {
  Person: 'People',
  Family: 'Families',
  Event: 'Events',
  Place: 'Places',
  Source: 'Sources',
  Citation: 'Citations',
  Repository: 'Repositories',
  Note: 'Notes',
  Media: 'Media',
  Tag: 'Tags',
}

export const kindOfEndpoint = Object.fromEntries(Object.entries(endpointOf).map(([k, v]) => [v, k])) as Record<string, ObjectKind>

/** Views derived from the object data that any write can change. */
export const DERIVED: TagType[] = ['Search', 'Metadata', 'Timeline', 'Relations', 'Transactions']

export interface TxEntry {
  type?: string
  _class?: string
  handle?: string
  old?: unknown
  new?: { gramps_id?: string } & Record<string, unknown>
}

/**
 * Tags to invalidate after a write. Gramps answers every write with the transaction
 * (all objects it touched, incl. reciprocal links it updated), so we refresh exactly
 * those objects, their lists, and the derived views.
 */
export function tagsForTransaction(tx: TxEntry[] | undefined | null): TagDescription<TagType>[] {
  const out: TagDescription<TagType>[] = [...DERIVED]
  const seenLists = new Set<TagType>()
  for (const e of tx ?? []) {
    const type = e._class ? tagOfClass[e._class] : undefined
    if (!type) continue
    if (e.handle) out.push({ type, id: e.handle })
    if (!seenLists.has(type)) {
      seenLists.add(type)
      out.push({ type, id: 'LIST' })
    }
  }
  return out
}

/** Fallback when a write's response carries no transaction: refresh the whole kind. */
export function tagsForKind(kind: ObjectKind | 'tag', handle?: string): TagDescription<TagType>[] {
  const type = tagOf[kind]
  return [...DERIVED, { type, id: 'LIST' }, ...(handle ? [{ type, id: handle }] : [type])]
}

/* ---------- providesTags / invalidatesTags for the generated object endpoints ---------- */

type Obj = { handle?: string; _class?: string; extended?: unknown } & Record<string, unknown>

/** Tag type of an object in an `extended` section (by `_class`, else by its shape). */
function tagOfObject(o: Obj): TagType | undefined {
  if (typeof o._class === 'string') return tagOfClass[o._class]
  if ('primary_name' in o) return 'People'
  if ('child_ref_list' in o) return 'Families'
  if ('placeref_list' in o) return 'Places'
  if ('mime' in o) return 'Media'
  if ('source_handle' in o) return 'Citations'
  if ('text' in o && 'format' in o) return 'Notes'
  return undefined
}

/** Objects pulled in via `extend=…` are part of a response too, so they tag it as well. */
function extendedTags(o: Obj | undefined): TagDescription<TagType>[] {
  return Object.values((o?.extended as Record<string, unknown>) ?? {}).flatMap((v) =>
    (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : [])
      .filter((x): x is Obj => !!(x as Obj)?.handle)
      .flatMap((x) => {
        const type = tagOfObject(x)
        return type ? [{ type, id: x.handle! }] : []
      }),
  )
}

/** `providesTags` of a list endpoint: the list, each row and what the rows extend. */
export const listTags =
  (type: TagType) =>
  <T extends object>(res: { items: T[] } | undefined): TagDescription<TagType>[] => [
    { type, id: 'LIST' },
    ...((res?.items ?? []) as Obj[]).flatMap((o) => (o?.handle ? [{ type, id: o.handle }, ...extendedTags(o)] : [])),
  ]

/** `providesTags` of a single-object endpoint. */
export const oneTags =
  (type: TagType) =>
  <T extends object>(res: T | undefined, _e: unknown, arg: { handle: string }): TagDescription<TagType>[] => [
    { type, id: arg.handle },
    ...extendedTags(res as Obj | undefined),
  ]

/**
 * `invalidatesTags` of a create/update/merge: Gramps answers with the transaction (every
 * object it touched, incl. reciprocal links), so exactly those objects, their lists and
 * the derived views refresh. Without a transaction the whole kind does.
 */
export const writeTags =
  (type: TagType) =>
  (tx: TxEntry[] | undefined, _e: unknown, arg: { handle?: string } | unknown): TagDescription<TagType>[] => {
    if (Array.isArray(tx) && tx.length) return tagsForTransaction(tx)
    const handle = (arg as { handle?: string } | undefined)?.handle
    return [...DERIVED, { type, id: 'LIST' }, ...(handle ? [{ type, id: handle }] : [type])]
  }
