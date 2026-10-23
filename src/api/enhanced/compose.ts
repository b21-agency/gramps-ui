import type { BaseQueryApi, FetchBaseQueryError } from '@reduxjs/toolkit/query'

// Composite queries (several requests in one cache entry) are built from the generated
// endpoints: a `queryFn` dispatches them through `run`, so URLs, params and response
// transforms stay in one place. Dispatch them with `{ subscribe: false, forceRefetch: true }`:
// the composite is the cache entry that counts, so its parts always come from the server.

type Result<T> = { data: T } | { error: FetchBaseQueryError }
type Initiated = PromiseLike<{ data?: unknown; error?: unknown }> & { unsubscribe?: () => void }

/** Run an endpoint thunk (`endpoint.initiate(arg, { subscribe: false })`) inside a queryFn. */
export async function run<T>(api: Pick<BaseQueryApi, 'dispatch'>, thunk: unknown): Promise<Result<T>> {
  const r = await (api.dispatch(thunk as never) as unknown as Initiated)
  return r.error ? { error: r.error as FetchBaseQueryError } : { data: r.data as T }
}

/** Split handles into URL-sized chunks. */
export function chunks<T>(list: T[], size = 80): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/**
 * Batches per-handle `queryFn` calls made in the same tick into list requests by handle
 * (chunks of `size`), so a screen of rows costs one request while each row keeps its own
 * cache entry and tag. `fetchRows` loads rows for some handles; `pick` maps a row (or
 * undefined when missing) to the result.
 */
export function handleBatcher<Row extends { handle: string }, R>(
  fetchRows: (api: Pick<BaseQueryApi, 'dispatch'>, handles: string[]) => Promise<Result<Row[]>>,
  pick: (row: Row | undefined) => R,
  size = 80,
) {
  let pending = new Map<string, Array<(r: Result<R>) => void>>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let latest: Pick<BaseQueryApi, 'dispatch'> | null = null
  const flush = () => {
    const batch = pending
    const api = latest!
    pending = new Map()
    timer = null
    for (const chunk of chunks([...batch.keys()], size)) {
      void fetchRows(api, chunk).then((r) => {
        const rows = 'data' in r ? new Map(r.data.map((row) => [row.handle, row])) : null
        for (const h of chunk) for (const done of batch.get(h) ?? []) done(rows ? { data: pick(rows.get(h)) } : (r as { error: FetchBaseQueryError }))
      })
    }
  }
  return (api: Pick<BaseQueryApi, 'dispatch'>, handle: string) =>
    new Promise<Result<R>>((resolve) => {
      latest = api
      pending.set(handle, [...(pending.get(handle) ?? []), resolve])
      timer ??= setTimeout(flush, 15)
    })
}
