import { useEffect } from 'react'
import { useAppTitle } from '@/lib/tree-config'

/** Sets the browser tab title: "<title> · <app name>". */
export function useTitle(title?: string | null) {
  const appName = useAppTitle()
  useEffect(() => {
    if (!title) return
    document.title = `${title} · ${appName}`
    return () => {
      document.title = appName
    }
  }, [title, appName])
}
