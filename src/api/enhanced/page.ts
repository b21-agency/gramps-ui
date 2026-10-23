import type { FetchBaseQueryMeta } from '@reduxjs/toolkit/query'

/** A page of a list endpoint with the `X-Total-Count` total. */
export interface Page<T> {
  items: T[]
  total: number
}

/** `X-Total-Count` of a list response (falls back to the given count). */
export function totalOf(meta: FetchBaseQueryMeta | undefined, fallback: number) {
  const h = meta?.response?.headers.get('X-Total-Count')
  return h ? Number(h) : fallback
}

/** `transformResponse` for list endpoints: rows + total. */
export function pageOf<T>(data: unknown, meta: FetchBaseQueryMeta | undefined): Page<T> {
  const items = (Array.isArray(data) ? data : []) as T[]
  return { items, total: totalOf(meta, items.length) }
}
