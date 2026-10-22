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
