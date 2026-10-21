// Per-tree local preferences (home person, bookmarks, recently viewed, chart settings).
// The Gramps Web API has no server-side store for these; like the classic UI we keep them
// in localStorage, namespaced by the tree id from the access token.
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { decodeJwt, tokens } from './api'
import type { ObjectKind } from './types'

const listeners = new Set<() => void>()
const cache = new Map<string, unknown>()

function treeKey(key: string) {
  const tree = decodeJwt(tokens.access)?.tree ?? 'default'
  return `gw.${tree}.${key}`
}

function read<T>(key: string, fallback: T): T {
  const k = treeKey(key)
  if (cache.has(k)) return cache.get(k) as T
  let v = fallback
  try {
    const raw = localStorage.getItem(k)
    if (raw != null) v = JSON.parse(raw)
  } catch {
    /* ignore */
  }
  cache.set(k, v)
  return v
}

function write<T>(key: string, value: T) {
  const k = treeKey(key)
  cache.set(k, value)
  try {
    localStorage.setItem(k, JSON.stringify(value))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith('gw.')) {
      cache.clear()
      cb()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

/** Persisted per-tree state, like useState. */
export function usePref<T>(key: string, fallback: T): [T, (v: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key, fallback))
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(read(key, fallback)) : v
      write(key, next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  )
  return [value, set]
}

export const getPref = read
export const setPref = write

/* ---------- home person ---------- */

export function useHomePerson() {
  return usePref<string | null>('homePerson', null) // Gramps ID
}

/* ---------- bookmarks ---------- */

export interface ObjectRefLite {
  kind: ObjectKind
  handle: string
  gramps_id: string
  title?: string
}

export function useBookmarks() {
  const [list, setList] = usePref<ObjectRefLite[]>('bookmarks', [])
  const isBookmarked = (handle: string) => list.some((b) => b.handle === handle)
  const toggle = (ref: ObjectRefLite) =>
    setList((prev) =>
      prev.some((b) => b.handle === ref.handle) ? prev.filter((b) => b.handle !== ref.handle) : [ref, ...prev],
    )
  return { list, isBookmarked, toggle, setList }
}

/* ---------- recently viewed ---------- */

export function useRecent() {
  return usePref<Array<ObjectRefLite & { at: number }>>('recent', [])
}

export function recordVisit(ref: ObjectRefLite) {
  const prev = read<Array<ObjectRefLite & { at: number }>>('recent', [])
  const next = [{ ...ref, at: Date.now() }, ...prev.filter((r) => r.handle !== ref.handle)].slice(0, 100)
  write('recent', next)
}

/** Record an object page view for the "Recently viewed" page. */
export function useRecordVisit(ref: ObjectRefLite | null) {
  const key = ref ? `${ref.handle}:${ref.title}` : ''
  useEffect(() => {
    if (ref) recordVisit(ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
