import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useCallback, useEffect, useRef } from 'react'
import { api } from '../index'
import { store } from '@/store'
import { ApiError } from '@/lib/api'
import { tagsForTransaction, type TxEntry } from './tags'

// Editor helpers: invalidating a write transaction now or after leaving the page (the
// generated deletes invalidate nothing themselves, see objects.ts), and turning RTK errors
// into `ApiError`s (the editors show `error.message` in toasts).

/** Invalidate everything a write transaction touched (objects, lists, derived views). */
export const invalidateTransaction = (tx: ReadonlyArray<{ _class?: string; handle?: string }> | null | undefined) =>
  api.util.invalidateTags(tagsForTransaction(tx as TxEntry[] | null | undefined))

/**
 * For deleting the record a page shows: returns `defer(tx)`; the transaction is invalidated
 * when the calling component unmounts (i.e. after navigating away), once the page's own
 * queries have unsubscribed. Their cache entries are then dropped instead of refetched
 * (a refetch would cache "not found", which an Undo + navigate back would then show).
 */
export function useInvalidateOnUnmount() {
  const pending = useRef<TxEntry[]>([])
  useEffect(
    () => () => {
      const tx = pending.current
      pending.current = []
      if (tx.length) setTimeout(() => store.dispatch(invalidateTransaction(tx)), 0)
    },
    [],
  )
  return useCallback((tx: ReadonlyArray<{ _class?: string; handle?: string }>) => {
    pending.current.push(...(tx as TxEntry[]))
  }, [])
}

/** RTK error (`{status, data}` / serialized error) → `ApiError` with a readable message. */
export function toApiError(e: unknown): unknown {
  if (e instanceof Error) return e
  const err = e as Partial<FetchBaseQueryError> & Partial<SerializedError>
  if (err && typeof err === 'object' && 'status' in err) {
    const status = err.status
    const data = (err as { data?: unknown }).data
    const msg =
      (data as { error?: { message?: string } })?.error?.message ??
      (data as { message?: string })?.message ??
      (err as { error?: string }).error ??
      `HTTP ${status}`
    return new ApiError(typeof status === 'number' ? status : 0, msg, data)
  }
  if (err?.name === 'AbortError') return new DOMException(err.message ?? 'aborted', 'AbortError')
  if (err && typeof err === 'object' && 'message' in err) return new Error(String(err.message))
  return e
}

/** `await unwrapApi(dispatch(endpoint.initiate(arg)))` or `unwrapApi(trigger(arg))`: like `.unwrap()`, throwing `ApiError`s. */
export async function unwrapApi<T>(p: { unwrap(): Promise<T> }): Promise<T> {
  try {
    return await p.unwrap()
  } catch (e) {
    throw toApiError(e)
  }
}
