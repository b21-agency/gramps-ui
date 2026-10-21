import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** Sets the browser tab title: "<title> · <app name>". */
export function useTitle(title?: string | null) {
  const { t } = useTranslation()
  useEffect(() => {
    if (!title) return
    document.title = `${title} · ${t('appName')}`
    return () => {
      document.title = t('appName')
    }
  }, [title, t])
}
