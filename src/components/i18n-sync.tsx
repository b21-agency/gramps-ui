import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** Keeps <html lang> and the document title in sync with the UI language. */
export function I18nSync() {
  const { i18n, t } = useTranslation()
  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? 'en'
    document.title = t('appName')
  }, [i18n.resolvedLanguage, t])
  return null
}
