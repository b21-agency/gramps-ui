import { createListenerMiddleware } from '@reduxjs/toolkit'
import { api } from '../index'

// Gramps updates its full-text index in a background task after every write, so results
// that come from /search/ (lists with a quick filter, the search page, "recently changed")
// can still miss a restored or renamed object right after the write's own invalidation.
// After any write that answers with a transaction, the 'Search' tag is invalidated once
// more when the index has caught up. Deleted objects never show (search reads the database).

export const SEARCH_INDEX_DELAYS_MS = [1500, 5000]

export const searchRefresh = createListenerMiddleware()

searchRefresh.startListening({
  predicate: (action) => action.type === `${api.reducerPath}/executeMutation/fulfilled`,
  effect: async (action, listenerApi) => {
    const payload = (action as unknown as { payload?: unknown }).payload
    const isTransaction = Array.isArray(payload) && payload.some((e) => e && typeof e === 'object' && '_class' in e)
    if (!isTransaction) return
    let waited = 0
    for (const ms of SEARCH_INDEX_DELAYS_MS) {
      await listenerApi.delay(ms - waited)
      waited = ms
      listenerApi.dispatch(api.util.invalidateTags(['Search']))
    }
  },
})
