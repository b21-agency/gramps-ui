import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { type TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'
import { api } from '@/api'
import { writeListener } from '@/api/enhanced/writes'
import { onAuthChange, tokens } from '@/lib/api'

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer },
  middleware: (getDefault) => getDefault().prepend(writeListener.middleware).concat(api.middleware),
})

// refetchOnReconnect / refetchOnFocus support
setupListeners(store.dispatch)

// another user signs in (or the session ends): never show the previous user's data
let lastRefresh = tokens.refresh
onAuthChange(() => {
  if (tokens.refresh !== lastRefresh) {
    lastRefresh = tokens.refresh
    store.dispatch(api.util.resetApiState())
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
