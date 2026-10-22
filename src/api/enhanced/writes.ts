import { createListenerMiddleware } from '@reduxjs/toolkit'
import { api } from '../index'
import { tagsForTransaction, type TxEntry } from './tags'

// Generated mutations only invalidate their own OpenAPI tag ("People" …). Gramps writes
// touch more than that (saving a family updates its members, deleting an event removes
// it from people), so after ANY successful mutation that returns a transaction we also
// invalidate exactly the objects it touched plus the derived views.

export const writeListener = createListenerMiddleware()

writeListener.startListening({
  predicate: (action) => action.type === `${api.reducerPath}/executeMutation/fulfilled`,
  effect: (action, listenerApi) => {
    const payload = (action as unknown as { payload?: unknown }).payload
    if (!Array.isArray(payload) || !payload.length) return
    const looksLikeTx = payload.every((e) => e && typeof e === 'object' && '_class' in e && 'handle' in e)
    if (!looksLikeTx) return
    listenerApi.dispatch(api.util.invalidateTags(tagsForTransaction(payload as TxEntry[])))
  },
})
