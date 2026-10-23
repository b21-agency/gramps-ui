import { skipToken, type SkipToken } from '@reduxjs/toolkit/query'
import type { ObjectKind } from '@/lib/types'
import type { GetPeopleApiArg, GetPersonApiArg } from '../people-api-slice.gen'
import { citationsApi } from './citations-slice-enhanced'
import { eventsApi } from './events-slice-enhanced'
import { familiesApi } from './families-slice-enhanced'
import { mediaApi } from './media-slice-enhanced'
import { notesApi } from './notes-slice-enhanced'
import type { Page } from './page'
import { peopleApi } from './people-slice-enhanced'
import { placesApi } from './places-slice-enhanced'
import { repositoriesApi } from './repositories-slice-enhanced'
import { sourcesApi } from './sources-slice-enhanced'
import { tagsApi } from './tags-slice-enhanced'
import type { TxEntry } from './tags'

// Pages that work with any object kind (lists, object pages, the editor) reach the
// generated endpoints of that kind through this registry. It defines no endpoints:
// tags, result types and invalidation live in the *-slice-enhanced files.

export type { Page }
export type AnyKind = ObjectKind | 'tag'
export type AnyObject = { handle: string } & Record<string, unknown>

/** Query params of every object list endpoint (identical for all kinds). */
export type ObjectListArg = GetPeopleApiArg
/** Query params of every single-object endpoint, without the handle. */
export type ObjectArg = Omit<GetPersonApiArg, 'handle'>

const registry = {
  person: { api: peopleApi, list: 'getPeople', one: 'getPerson', create: 'postPeople', update: 'putPerson', remove: 'deletePerson', merge: 'postMergePerson', body: 'person' },
  family: { api: familiesApi, list: 'getFamilies', one: 'getFamily', create: 'postFamilies', update: 'putFamily', remove: 'deleteFamily', merge: 'postMergeFamily', body: 'family' },
  event: { api: eventsApi, list: 'getEvents', one: 'getEvent', create: 'postEvents', update: 'putEvent', remove: 'deleteEvent', merge: 'postMergeEvent', body: 'event' },
  place: { api: placesApi, list: 'getPlaces', one: 'getPlace', create: 'postPlaces', update: 'putPlace', remove: 'deletePlace', merge: 'postMergePlace', body: 'place' },
  source: { api: sourcesApi, list: 'getSources', one: 'getSource', create: 'postSources', update: 'putSource', remove: 'deleteSource', merge: 'postMergeSource', body: 'source' },
  citation: { api: citationsApi, list: 'getCitations', one: 'getCitation', create: 'postCitations', update: 'putCitation', remove: 'deleteCitation', merge: 'postMergeCitation', body: 'citation' },
  repository: { api: repositoriesApi, list: 'getRepositories', one: 'getRepository', create: 'postRepositories', update: 'putRepository', remove: 'deleteRepository', merge: 'postMergeRepository', body: 'repository' },
  note: { api: notesApi, list: 'getNotes', one: 'getNote', create: 'postNotes', update: 'putNote', remove: 'deleteNote', merge: 'postMergeNote', body: 'note' },
  media: { api: mediaApi, list: 'getMediaObjects', one: 'getMediaObject', create: 'postMediaObjects', update: 'putMediaObject', remove: 'deleteMediaObject', merge: 'postMergeMedia', body: 'media' },
  tag: { api: tagsApi, list: 'getTags', one: 'getTag', create: 'postTags', update: 'putTag', remove: 'deleteTag', merge: null, body: 'tag' },
} as const

// All kinds share the same argument shapes, so one kind's endpoint types describe them all;
// the result type is the caller's (`T`).
const people = peopleApi.endpoints
type ListEndpoint = typeof people.getPeople
type OneEndpoint = typeof people.getPerson
type WriteEndpoint = typeof people.postPeople
/** Subscription options of the generated hooks (no `selectFromResult`: results keep their type). */
type QueryOptions = {
  skip?: boolean
  pollingInterval?: number
  refetchOnMountOrArgChange?: boolean | number
  refetchOnReconnect?: boolean
  refetchOnFocus?: boolean
}

const endpointsOf = (kind: AnyKind) => registry[kind].api.endpoints as unknown as Record<string, unknown>

/** The generated list endpoint of a kind (`getPeople`, `getFamilies`, …). */
export const listEndpoint = (kind: AnyKind) => endpointsOf(kind)[registry[kind].list] as ListEndpoint
/** The generated single-object endpoint of a kind (`getPerson`, …). */
export const oneEndpoint = (kind: AnyKind) => endpointsOf(kind)[registry[kind].one] as OneEndpoint

/* ---------------- hooks ---------------- */
// A page keeps one kind for its lifetime (routes are keyed by kind), so choosing the
// endpoint's hook by kind keeps the hook order stable.

/** A page of objects of one kind (`X-Total-Count` total). */
export function useObjectsQuery<T = AnyObject>(kind: AnyKind, arg: ObjectListArg | SkipToken, opts?: QueryOptions) {
  const r = listEndpoint(kind).useQuery(arg, opts)
  return { ...r, data: r.data as Page<T> | undefined }
}

/** One object by handle. */
export function useObjectQuery<T = AnyObject>(kind: AnyKind, arg: GetPersonApiArg | SkipToken, opts?: QueryOptions) {
  const r = oneEndpoint(kind).useQuery(arg, opts)
  return { ...r, data: r.data as T | undefined }
}

/** Several objects of one kind by handle (portraits, participants …). */
export function useObjectsByHandlesQuery<T = AnyObject>(kind: AnyKind, handles: string[] | null | undefined, arg: ObjectListArg = {}) {
  const r = listEndpoint(kind).useQuery(handles?.length ? { ...arg, handles } : skipToken)
  return { ...r, data: r.data?.items as T[] | undefined }
}

/* ---------------- thunks (dispatch them) ---------------- */

/** Read one object (e.g. `dispatch(fetchObject('source', { handle }))` + unwrap). */
export const fetchObject = (kind: AnyKind, arg: GetPersonApiArg, opts?: { forceRefetch?: boolean }) =>
  oneEndpoint(kind).initiate(arg, { subscribe: false, forceRefetch: opts?.forceRefetch ?? true })

/** Read a page of objects without subscribing. */
export const fetchObjects = (kind: AnyKind, arg: ObjectListArg) =>
  listEndpoint(kind).initiate(arg, { subscribe: false, forceRefetch: true })

const write = (kind: AnyKind, op: 'create' | 'update' | 'remove') =>
  endpointsOf(kind)[registry[kind][op]] as WriteEndpoint

/** Create an object; resolves to the transaction. */
export const createObject = (kind: AnyKind, body: Record<string, unknown>) =>
  write(kind, 'create').initiate({ [registry[kind].body]: body } as never)

/** Replace an object; resolves to the transaction. */
export const updateObject = (kind: AnyKind, handle: string, body: Record<string, unknown>) =>
  write(kind, 'update').initiate({ handle, [registry[kind].body]: body } as never)

/**
 * Delete an object; resolves to the transaction. Invalidates nothing by itself: dispatch
 * `invalidateTransaction(tx)` right away, or after leaving the deleted record's page.
 */
export const deleteObject = (kind: AnyKind, handle: string) => write(kind, 'remove').initiate({ handle } as never)

/** Merge `other` into `keep` (both of `kind`); resolves to the transaction. */
export function mergeObjects(kind: ObjectKind, keep: string, other: string) {
  const name = registry[kind].merge
  return (endpointsOf(kind)[name] as WriteEndpoint).initiate({ phoenixHandle: keep, titanicHandle: other } as never)
}

export type { TxEntry }
