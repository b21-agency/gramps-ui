import type { SerializedError } from '@reduxjs/toolkit'
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useCallback, useEffect, useRef } from 'react'
import { api } from '../index'
import { store } from '@/store'
import { ApiError } from '@/lib/api'
import { endpointOf, type ObjectKind } from '@/lib/types'
import { tagsForTransaction, type TxEntry } from './tags'

// Editor data: the object being edited (an uncached snapshot), Gramps type vocabularies,
// deletes whose cache invalidation must wait until the page has been left, and a helper
// that turns RTK errors into `ApiError`s (the editors show `error.message` in toasts).

type AnyObj = { handle: string } & Record<string, unknown>

export const editorApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /**
     * The object for the edit sheet (extend=all). Deliberately provides no tags and is
     * dropped right after the sheet closes: a form must not be re-seeded under the user's
     * hands, and every opening starts from the server's current state.
     */
    editableObject: build.query<AnyObj, { kind: ObjectKind; handle: string }>({
      query: ({ kind, handle }) => ({ url: `/api/${endpointOf[kind]}/${handle}`, params: { extend: 'all' } }),
      keepUnusedDataFor: 0,
    }),

    /** English → UI-language map for Gramps type names, POST /translations/{lang}. */
    editorTypeTranslations: build.query<Record<string, string>, { lang: string; strings: string[] }>({
      query: ({ lang, strings }) => ({ url: `/api/translations/${lang}`, method: 'POST', body: { strings } }),
      transformResponse: (res: Array<{ original: string; translation: string }>) =>
        Object.fromEntries(res.map((r) => [r.original, r.translation])),
      // the string list only grows with the vocabulary; its length is a good enough key
      serializeQueryArgs: ({ endpointName, queryArgs }) => `${endpointName}(${queryArgs.lang},${queryArgs.strings.length})`,
      keepUnusedDataFor: 24 * 3600,
    }),

    /**
     * DELETE without automatic invalidation (the result is wrapped so the write listener
     * ignores it too). Used when deleting the object of the current page: navigate away
     * first, then `dispatch(invalidateTransaction(tx))`, so the deleted record isn't
     * refetched (and cached as "not found") while its page is still mounted.
     */
    deleteObjectDeferred: build.mutation<{ tx: TxEntry[] }, { kind: ObjectKind; handle: string }>({
      query: ({ kind, handle }) => ({ url: `/api/${endpointOf[kind]}/${handle}`, method: 'DELETE' }),
      transformResponse: (tx: TxEntry[]) => ({ tx: Array.isArray(tx) ? tx : [] }),
    }),
  }),
})

export const { useEditableObjectQuery, useEditorTypeTranslationsQuery, useDeleteObjectDeferredMutation } = editorApi

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
