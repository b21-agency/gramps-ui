import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

// Each feature owns a pair of files: locales/<feature>.en.ts and locales/<feature>.de.ts,
// exporting a default object; they are merged into the namespace named after the feature.
type Dict = Record<string, unknown>
const modules = import.meta.glob<{ default: Dict }>('./locales/*.ts', { eager: true })

const resources: Record<string, Record<string, Dict>> = { en: {}, de: {} }
for (const [path, mod] of Object.entries(modules)) {
  const m = path.match(/\/([\w-]+)\.(en|de)\.ts$/)
  if (!m) continue
  const [, ns, lang] = m
  resources[lang][ns] = mod.default
}

export const languages = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
] as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'de'],
    nonExplicitSupportedLngs: true,
    defaultNS: 'common',
    ns: Object.keys(resources.en),
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'gw.lang', caches: ['localStorage'] },
  })

export function apiLocale() {
  return (i18n.resolvedLanguage ?? 'en').slice(0, 2)
}

export default i18n
