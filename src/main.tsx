import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './i18n'
import { router } from './routes'
import { AuthProvider } from '@/lib/auth'
import { ThemeProvider } from '@/components/theme'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { I18nSync } from '@/components/i18n-sync'
import { Provider as ReduxProvider } from 'react-redux'
import { store } from '@/store'

// After a new deploy the hashed chunk names change; an open tab then fails to load the next
// page's code. Reload once to pick up the new build instead of showing an error.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'gw.reloadedForChunk'
  try {
    if (sessionStorage.getItem(key) === location.pathname) return
    sessionStorage.setItem(key, location.pathname)
  } catch {
    /* storage unavailable */
  }
  event.preventDefault()
  location.reload()
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        const status = (error as { status?: number })?.status
        if (status && status >= 400 && status < 500) return false
        return count < 2
      },
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReduxProvider store={store}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            <I18nSync />
            <RouterProvider router={router} />
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ReduxProvider>
  </StrictMode>,
)
