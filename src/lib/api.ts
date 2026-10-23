// Thin client for the Gramps Web API (same origin, /api/...).
// Access tokens live 15 min; on 401 we refresh once with the refresh token.

const ACCESS_KEY = 'gw.access'
const REFRESH_KEY = 'gw.refresh'

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

type Listener = () => void
const listeners = new Set<Listener>()
export function onAuthChange(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
function emit() {
  listeners.forEach((fn) => fn())
}

export const tokens = {
  get access() {
    return safeGet(ACCESS_KEY)
  },
  get refresh() {
    return safeGet(REFRESH_KEY)
  },
  set(access: string | null, refresh?: string | null) {
    safeSet(ACCESS_KEY, access)
    if (refresh !== undefined) safeSet(REFRESH_KEY, refresh)
    emit()
  },
  clear() {
    safeSet(ACCESS_KEY, null)
    safeSet(REFRESH_KEY, null)
    emit()
  },
}

function safeGet(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function safeSet(k: string, v: string | null) {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* storage unavailable */
  }
}

export interface JwtClaims {
  sub: string
  exp: number
  permissions: string[]
  tree?: string
}

export function decodeJwt(token: string | null): JwtClaims | null {
  if (!token) return null
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(escape(atob(part))))
  } catch {
    return null
  }
}

/**
 * True for a response that rejects the access token itself: 401, or the 422 that the JWT
 * layer answers for a token it cannot read (bad signature after a server key change, a
 * mangled value). Those carry only `{message}`; validation errors carry `error`/`errors`.
 */
export function isAuthFailure(status: unknown, body: unknown) {
  if (status === 401) return true
  if (status !== 422 || !body || typeof body !== 'object') return false
  return typeof (body as { message?: unknown }).message === 'string' && !('error' in body) && !('errors' in body)
}

async function authFailed(res: Response) {
  if (res.status === 401) return true
  if (res.status !== 422) return false
  try {
    return isAuthFailure(422, await res.clone().json())
  } catch {
    return false
  }
}

let refreshing: Promise<boolean> | null = null

export async function refreshAccessToken(): Promise<boolean> {
  const refresh = tokens.refresh
  if (!refresh) return false
  refreshing ??= (async () => {
    try {
      let res: Response | null = null
      for (let attempt = 0; attempt < 4; attempt++) {
        res = await fetch('/api/token/refresh/', {
          method: 'POST',
          headers: { Authorization: `Bearer ${refresh}`, Accept: 'application/json' },
        })
        if (res.status !== 429) break
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500))
      }
      if (!res || !res.ok) {
        if (res && [401, 403, 422].includes(res.status)) tokens.clear()
        return false
      }
      const data = await res.json()
      tokens.set(data.access_token)
      return true
    } catch {
      return false
    } finally {
      setTimeout(() => (refreshing = null), 0)
    }
  })()
  return refreshing
}

/** Returns a valid access token, refreshing it when it is about to expire. */
export async function freshAccessToken(): Promise<string | null> {
  const claims = decodeJwt(tokens.access)
  if (claims && claims.exp * 1000 - Date.now() > 60_000) return tokens.access
  await refreshAccessToken()
  return tokens.access
}

export type Query = Record<string, string | number | boolean | undefined | null | string[]>

export function qs(params?: Query) {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export interface ApiResult<T> {
  data: T
  total: number | null
  headers: Headers
}

export async function apiRaw<T>(
  path: string,
  init: RequestInit & { query?: Query; json?: unknown; auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const { query, json, auth = true, ...rest } = init
  const url = `/api${path}${qs(query)}`
  const doFetch = async () => {
    const headers = new Headers(rest.headers)
    if (json !== undefined) headers.set('Content-Type', 'application/json')
    if (auth) {
      const t = await freshAccessToken()
      if (t) headers.set('Authorization', `Bearer ${t}`)
    }
    return fetch(url, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body })
  }
  let res = await doFetch()
  if (auth && tokens.refresh && (await authFailed(res))) {
    if (await refreshAccessToken()) res = await doFetch()
  }
  if (auth && (await authFailed(res))) tokens.clear()
  if (!res.ok) {
    let body: unknown = undefined
    try {
      body = await res.json()
    } catch {
      /* not json */
    }
    const msg =
      (body as { error?: { message?: string } })?.error?.message ??
      (body as { message?: string })?.message ??
      res.statusText
    throw new ApiError(res.status, msg || `HTTP ${res.status}`, body)
  }
  const total = res.headers.get('X-Total-Count')
  const ct = res.headers.get('Content-Type') ?? ''
  const data = (ct.includes('json') ? await res.json() : await res.text()) as T
  return { data, total: total ? Number(total) : null, headers: res.headers }
}

export async function api<T>(path: string, init?: Parameters<typeof apiRaw>[1]): Promise<T> {
  return (await apiRaw<T>(path, init)).data
}

export async function login(username: string, password: string) {
  const res = await fetch('/api/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    let type = res.status === 403 || res.status === 401 ? 'invalid_credentials' : res.status === 429 ? 'rate_limited' : 'failed'
    let body: unknown = undefined
    try {
      body = await res.json()
      type = (body as { error?: { type?: string } })?.error?.type ?? type
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, type, body)
  }
  const data = await res.json()
  try {
    localStorage.setItem('gw.hasUsers', '1')
  } catch {
    /* storage unavailable */
  }
  tokens.set(data.access_token, data.refresh_token)
}

export function logout() {
  tokens.clear()
}

/** URL for <img>: the API accepts the access token as ?jwt= for media files. */
export function mediaThumbUrl(handle: string, size = 200, opts: { square?: boolean } = {}) {
  return `/api/media/${handle}/thumbnail/${size}${qs({ square: opts.square || undefined, jwt: tokens.access })}`
}
export function mediaCroppedUrl(
  handle: string,
  rect: [number, number, number, number],
  size = 200,
  opts: { square?: boolean } = {},
) {
  return `/api/media/${handle}/cropped/${rect.join('/')}/thumbnail/${size}${qs({ square: opts.square || undefined, jwt: tokens.access })}`
}
export function mediaFileUrl(handle: string, download = false) {
  return `/api/media/${handle}/file${qs({ jwt: tokens.access, download: download || undefined })}`
}
