// Background tasks of the Gramps Web API: an endpoint answers 202 {task: {id, href}},
// then GET /tasks/{id} is polled until it succeeds or fails. Some endpoints run
// synchronously when no task queue is configured and return the result directly.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TagDescription } from '@reduxjs/toolkit/query'
import { api as rtkApi } from '@/api'
import { api as tasksApi } from '@/api/tasks-api-slice.gen'
import type { TagType } from '@/api/enhanced/tags'
import { store } from '@/store'
import { ApiError, freshAccessToken, tokens } from '@/lib/api'

export type TaskPhase = 'idle' | 'running' | 'success' | 'failure'

export interface TaskProgress {
  /** 0..1 when the server reports it */
  progress?: number
  current?: number
  total?: number
  title?: string
  message?: string
}

interface TaskStatusJson {
  state: 'PENDING' | 'STARTED' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'REVOKED' | string
  info?: unknown
  result?: unknown
  result_object?: unknown
}

export class TaskFailedError extends Error {
  detail: unknown
  constructor(message: string, detail?: unknown) {
    super(message)
    this.detail = detail
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = window.setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(id)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })

function parseMaybeJson(v: unknown): unknown {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}

/** True for `{task: {id}}` responses of async endpoints. */
export function isTaskRef(v: unknown): v is { task: { id: string; href: string } } {
  return !!v && typeof v === 'object' && 'task' in v && !!(v as { task?: { id?: string } }).task?.id
}

/** One GET /tasks/{id} through RTK Query (forced, not cached). */
async function fetchTaskStatus(id: string, signal?: AbortSignal): Promise<TaskStatusJson> {
  const req = store.dispatch(tasksApi.endpoints.getTask.initiate({ taskId: id }, { subscribe: false, forceRefetch: true }))
  const onAbort = () => req.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    return (await req.unwrap()) as TaskStatusJson
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Run an RTK mutation as a task starter: `start((signal) => unwrapWith(signal, trigger(arg)))`.
 * Aborting the signal aborts the request.
 */
export function unwrapWith<T>(signal: AbortSignal, req: { unwrap: () => Promise<T>; abort: () => void }): Promise<T> {
  if (signal.aborted) req.abort()
  else signal.addEventListener('abort', () => req.abort(), { once: true })
  return req.unwrap()
}

/** Poll /tasks/{id} until it finishes. Resolves with the task result, rejects with TaskFailedError. */
export async function pollTask<R = unknown>(
  id: string,
  opts: { onProgress?: (p: TaskProgress) => void; signal?: AbortSignal; interval?: number } = {},
): Promise<R> {
  const { onProgress, signal, interval = 1000 } = opts
  let wait = 400
  for (;;) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const s = await fetchTaskStatus(id, signal)
    const obj = s.result_object ?? parseMaybeJson(s.result ?? s.info)
    if (s.state === 'SUCCESS') return obj as R
    if (s.state === 'FAILURE' || s.state === 'REVOKED') {
      const o = obj as { message?: string; error?: { message?: string } } | null
      const msg = typeof obj === 'string' ? obj : (o?.error?.message ?? o?.message ?? s.state)
      throw new TaskFailedError(msg, obj)
    }
    if (s.state === 'PROGRESS' && obj && typeof obj === 'object') onProgress?.(obj as TaskProgress)
    await sleep(wait, signal)
    wait = Math.min(interval, wait * 1.5)
  }
}

/** Await the response of an endpoint that may answer with a task reference or directly. */
export async function resolveTask<R = unknown>(
  response: unknown,
  opts?: Parameters<typeof pollTask>[1],
): Promise<R> {
  if (isTaskRef(response)) return pollTask<R>(response.task.id, opts)
  return response as R
}

/** Download URL for a generated file (`/api/...` path from a task result), authenticated via ?jwt=. */
export async function authedUrl(url: string, extra: Record<string, string> = {}) {
  const token = await freshAccessToken()
  const u = new URL(url.startsWith('/api') ? url : `/api${url.startsWith('/') ? '' : '/'}${url}`, window.location.origin)
  if (token) u.searchParams.set('jwt', token)
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v)
  return u.pathname + u.search
}

/** Synchronous variant for <a href>: uses the current access token (kept fresh by AuthProvider). */
export function withJwt(url: string, extra: Record<string, string> = {}) {
  const u = new URL(url.startsWith('/api') ? url : `/api${url.startsWith('/') ? '' : '/'}${url}`, window.location.origin)
  if (tokens.access) u.searchParams.set('jwt', tokens.access)
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v)
  return u.pathname + u.search
}

export function formatBytes(n: number | undefined, lang: string) {
  if (n == null) return ''
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return new Intl.NumberFormat(lang, { style: 'unit', unit: units[i], unitDisplay: i ? 'short' : 'narrow' /* short bytes read "249 byte" */, maximumFractionDigits: i ? 1 : 0 }).format(v)
}

/** Trigger a browser download of a generated file. */
export async function downloadFile(url: string, fileName?: string) {
  const href = await authedUrl(url)
  const a = document.createElement('a')
  a.href = href
  if (fileName) a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Human message for an error thrown while starting or polling a task. */
export function taskErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const type = (e.body as { error?: { type?: string } })?.error?.type
    if (e.status === 409 && type === 'task_locked') return 'task_locked'
    if (e.status === 429) return 'rate_limited'
    return e.message
  }
  if (e instanceof Error) return e.message
  // RTK Query error: { status, data }
  if (e && typeof e === 'object' && 'status' in e) {
    const { status, data } = e as { status: unknown; data?: unknown }
    const body = data as { error?: { type?: string; message?: string }; message?: string } | undefined
    if (status === 409 && body?.error?.type === 'task_locked') return 'task_locked'
    if (status === 429) return 'rate_limited'
    return rtkErrorMessage(e)
  }
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

/** Message of an RTK Query error ({status, data}), an ApiError or any Error. */
export function rtkErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'status' in e) {
    const { status, data, error } = e as { status: unknown; data?: unknown; error?: string }
    const body = data as { error?: { message?: string }; message?: string } | string | undefined
    const msg = typeof body === 'string' ? body : (body?.error?.message ?? body?.message)
    return msg || error || `HTTP ${String(status)}`
  }
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

/** True when `e` is an aborted request/poll (no toast needed). */
export function isAbort(e: unknown) {
  return (e as { name?: string } | null)?.name === 'AbortError'
}

export interface TaskState<R> {
  phase: TaskPhase
  progress: TaskProgress | null
  result: R | null
  error: unknown
}

/**
 * start((signal) => unwrapWith(signal, trigger(arg))) → polls → result. Cancels polling on unmount.
 * `start` resolves with the result (or rejects), so callers can chain toasts.
 * `invalidates`: cache tags the task changes; invalidated once it succeeded.
 */
export function useTask<R = unknown>(opts: { invalidates?: TagDescription<TagType>[] } = {}) {
  const invalidates = useRef(opts.invalidates)
  invalidates.current = opts.invalidates
  const [state, setState] = useState<TaskState<R>>({ phase: 'idle', progress: null, result: null, error: null })
  const ctrl = useRef<AbortController | null>(null)

  useEffect(() => () => ctrl.current?.abort(), [])

  const start = useCallback(async (begin: (signal: AbortSignal) => Promise<unknown>): Promise<R> => {
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setState({ phase: 'running', progress: null, result: null, error: null })
    try {
      const first = await begin(c.signal)
      const result = await resolveTask<R>(first, {
        signal: c.signal,
        onProgress: (p) => !c.signal.aborted && setState((s) => ({ ...s, progress: p })),
      })
      if (invalidates.current?.length) store.dispatch(rtkApi.util.invalidateTags(invalidates.current))
      if (!c.signal.aborted) setState({ phase: 'success', progress: null, result, error: null })
      return result
    } catch (error) {
      if (!c.signal.aborted) setState({ phase: 'failure', progress: null, result: null, error })
      throw error
    }
  }, [])

  const reset = useCallback(() => {
    ctrl.current?.abort()
    setState({ phase: 'idle', progress: null, result: null, error: null })
  }, [])

  return { ...state, running: state.phase === 'running', start, reset }
}
