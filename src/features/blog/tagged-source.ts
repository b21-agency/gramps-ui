// Write helpers for the "Source tagged X" pattern used by the blog (tag "Blog") and
// tasks (tag "ToDo"): ensure the tag exists, create Note+Source atomically, PUT full objects.
// All writes go through the RTK Query object mutations (cache invalidation from the
// returned transaction); only the binary media upload is a raw request.
import { store } from '@/store'
import { api } from '@/lib/api'
import { objectsApi } from '@/api/enhanced/objects'
import { editorApi, invalidateTransaction, unwrapApi } from '@/api/enhanced/editor'
import type { ObjectKind, Attribute, MediaRef, Note, Source, Tag } from '@/lib/types'

export const newHandle = () => crypto.randomUUID().replace(/-/g, '')

export interface TxnEntry {
  type: 'add' | 'update' | 'delete'
  handle: string
  _class: string
  old: Record<string, unknown> | null
  new: Record<string, unknown> | null
}

/** Find the object of a class in a write transaction response. */
export function txnObject<T = Record<string, unknown>>(txn: TxnEntry[], cls: string, handle?: string): T | undefined {
  const hit = txn.find((e) => e._class === cls && (!handle || e.handle === handle))
  return (hit?.new ?? undefined) as T | undefined
}

/** Handle of the tag with this name; creates it when missing. */
export async function ensureTag(name: string, color = '#2f6f5e'): Promise<string> {
  const tags = (await unwrapApi(
    store.dispatch(objectsApi.endpoints.allTags.initiate(undefined, { subscribe: false, forceRefetch: true })),
  )) as Tag[]
  const found = tags.find((t) => t.name === name)
  if (found) return found.handle
  const txn = (await createObject('tag', { _class: 'Tag', name, color, priority: 0 })) as TxnEntry[]
  const tag = txnObject<Tag>(txn, 'Tag')
  if (!tag) throw new Error(`Could not create tag ${name}`)
  return tag.handle
}

const readOnlyKeys = ['extended', 'profile', 'backlinks', 'formatted']

function strip<T extends object>(o: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(o as Record<string, unknown>) }
  for (const k of readOnlyKeys) delete out[k]
  return out
}

/** Full writable Source (with `_class` on nested records) for PUT /sources/{h}. */
export function writableSource(src: Source, patch: Partial<Source> = {}) {
  const s = { ...strip(src), ...patch } as Source & Record<string, unknown>
  return {
    ...s,
    _class: 'Source',
    attribute_list: (s.attribute_list ?? []).map((a: Attribute) => ({ ...a, _class: 'SrcAttribute' })),
    media_list: (s.media_list ?? []).map((m: MediaRef) => ({ ...m, _class: 'MediaRef' })),
    reporef_list: (s.reporef_list ?? []).map((r) => ({ ...r, _class: 'RepoRef' })),
  }
}

/** Full writable Note for PUT /notes/{h}; replaces the text (and its styling). */
export function writableNote(note: Note, text: { string: string; tags: unknown[] }) {
  return { ...strip(note), _class: 'Note', text: { _class: 'StyledText', ...text } }
}

/* ---------- writes (RTK mutations: each invalidates what its transaction touched) ---------- */

/** Unwrap a write: a mutable copy of the transaction (RTK results are frozen). */
const txOf = (p: { unwrap(): Promise<unknown> }) =>
  unwrapApi(p).then((r) => (Array.isArray(r) ? [...r] : []) as TxnEntry[])

export function createObject(kind: ObjectKind | 'tag', body: Record<string, unknown>) {
  return txOf(store.dispatch(objectsApi.endpoints.createObject.initiate({ kind, body })))
}

export function updateObject(kind: ObjectKind | 'tag', handle: string, body: Record<string, unknown>) {
  return txOf(store.dispatch(objectsApi.endpoints.updateObject.initiate({ kind, handle, body })))
}

/** Several linked objects in one atomic transaction (POST /objects/). */
export function postObjects(objects: Array<Record<string, unknown>>) {
  return txOf(store.dispatch(objectsApi.endpoints.createObjects.initiate(objects)))
}

/**
 * Delete a tagged Source (blog post / task) and its text note unless something else links
 * to it. Cache invalidation is left to the caller (`dispatch(invalidateTransaction(tx))`
 * after leaving the page), so the deleted record isn't refetched while it is shown.
 */
export async function deleteTaggedSource(sourceHandle: string, noteHandle?: string): Promise<TxnEntry[]> {
  const del = (kind: ObjectKind, handle: string) =>
    unwrapApi(store.dispatch(editorApi.endpoints.deleteObjectDeferred.initiate({ kind, handle }))).then((r) => [...r.tx] as TxnEntry[]) // copy: RTK results are frozen
  const tx = await del('source', sourceHandle)
  if (noteHandle) {
    const n = (await unwrapApi(
      store.dispatch(
        objectsApi.endpoints.getObject.initiate(
          { kind: 'note', handle: noteHandle, query: { backlinks: true } },
          { subscribe: false, forceRefetch: true },
        ),
      ),
    )) as { backlinks?: Record<string, string[]> }
    if (Object.values(n.backlinks ?? {}).flat().length === 0) tx.push(...(await del('note', noteHandle)))
  }
  return tx
}

/** Upload one file as a new Media object; returns its handle. */
export async function uploadMedia(file: File, desc?: string): Promise<{ handle: string; gramps_id: string }> {
  // binary body: raw request, then invalidate what it touched
  const txn = await api<TxnEntry[]>('/media/', {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  })
  store.dispatch(invalidateTransaction(txn))
  const media = txnObject<Record<string, unknown> & { handle: string; gramps_id: string }>(txn, 'Media')
  if (!media) throw new Error('Upload failed')
  if (desc) {
    await updateObject('media', media.handle, { ...media, _class: 'Media', desc })
  }
  return media
}
