// Write helpers for the "Source tagged X" pattern used by the blog (tag "Blog") and
// tasks (tag "ToDo"): ensure the tag exists, create Note+Source atomically, PUT full objects.
import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Attribute, MediaRef, Note, Source, Tag } from '@/lib/types'

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
  const tags = await api<Tag[]>('/tags/')
  const found = tags.find((t) => t.name === name)
  if (found) return found.handle
  const txn = await api<TxnEntry[]>('/tags/', { method: 'POST', json: { _class: 'Tag', name, color, priority: 0 } })
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

/** Invalidate everything a source-backed write may have touched. */
export function invalidateSources(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ['sources'] })
  void qc.invalidateQueries({ queryKey: ['notes'] })
  void qc.invalidateQueries({ queryKey: ['tags'] })
  void qc.invalidateQueries({ queryKey: ['media'] })
  void qc.invalidateQueries({ queryKey: ['metadata'] })
  void qc.invalidateQueries({ queryKey: ['search'] })
}

/** Upload one file as a new Media object; returns its handle. */
export async function uploadMedia(file: File, desc?: string): Promise<{ handle: string; gramps_id: string }> {
  const txn = await api<TxnEntry[]>('/media/', {
    method: 'POST',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  })
  const media = txnObject<Record<string, unknown> & { handle: string; gramps_id: string }>(txn, 'Media')
  if (!media) throw new Error('Upload failed')
  if (desc) {
    await api(`/media/${media.handle}`, { method: 'PUT', json: { ...media, _class: 'Media', desc } })
  }
  return media
}
