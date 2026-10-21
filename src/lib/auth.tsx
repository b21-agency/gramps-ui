import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { decodeJwt, onAuthChange, refreshAccessToken, tokens } from './api'

interface AuthState {
  authenticated: boolean
  userId: string | null
  tree: string | null
  permissions: Set<string>
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

function subscribe(cb: () => void) {
  const off = onAuthChange(cb)
  const onStorage = (e: StorageEvent) => e.key?.startsWith('gw.') && cb()
  window.addEventListener('storage', onStorage)
  return () => {
    off()
    window.removeEventListener('storage', onStorage)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const access = useSyncExternalStore(subscribe, () => tokens.access)
  const refresh = useSyncExternalStore(subscribe, () => tokens.refresh)
  const qc = useQueryClient()

  // keep the access token fresh so <img src="...?jwt="> URLs stay valid
  useEffect(() => {
    if (!refresh) return
    const tick = () => {
      const c = decodeJwt(tokens.access)
      if (!c || c.exp * 1000 - Date.now() < 90_000) void refreshAccessToken()
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (!refresh) qc.clear()
  }, [refresh, qc])

  const value = useMemo<AuthState>(() => {
    const claims = decodeJwt(access)
    const permissions = new Set(claims?.permissions ?? [])
    return {
      authenticated: !!refresh,
      userId: claims?.sub ?? null,
      tree: claims?.tree ?? null,
      permissions,
      can: (p) => permissions.has(p),
    }
  }, [access, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

/** Re-render when the access token rotates (for media URLs carrying ?jwt=). */
export function useAccessToken() {
  return useSyncExternalStore(subscribe, () => tokens.access)
}
