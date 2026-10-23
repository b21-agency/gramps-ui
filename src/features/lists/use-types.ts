import { useCallback, useMemo } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { useGetTypesQuery, usePostTranslationQuery } from '@/api/enhanced/metadata-slice-enhanced'
import { apiLocale } from '@/i18n'

export type TypeSet =
  | 'event_types'
  | 'family_relation_types'
  | 'place_types'
  | 'note_types'
  | 'repository_types'
  | 'source_media_types'

interface TypesResponse {
  default: Record<string, string[]>
  custom: Record<string, string[]>
}

/** Default + custom Gramps types of one kind; values are the English names the filter rules expect. */
function useTypes(set: TypeSet) {
  const { data: raw, ...rest } = useGetTypesQuery({})
  const data = useMemo(() => {
    const d = raw as TypesResponse | undefined
    return d ? { defaults: d.default?.[set] ?? [], custom: d.custom?.[set] ?? [] } : undefined
  }, [raw, set])
  return { ...rest, data }
}

/** Translate Gramps core strings (type names) via the backend's catalogue. */
export function useGrampsTranslations(strings: string[]) {
  const lang = apiLocale()
  const sorted = useMemo(() => [...new Set(strings.filter(Boolean))].sort(), [strings])
  const { data } = usePostTranslationQuery(
    lang !== 'en' && sorted.length > 0 ? { language: lang, translationPostArgs: { strings: sorted } } : skipToken,
  )
  const map = useMemo(() => new Map(data?.map((d) => [d.original, d.translation])), [data])
  return useCallback((s: string) => map.get(s) ?? s, [map])
}

/** Options for a type filter (value = English name, label = translated). */
export function useTypeOptions(set: TypeSet) {
  const { data } = useTypes(set)
  const all = useMemo(() => (data ? [...data.defaults.filter((s) => s !== 'Custom'), ...data.custom] : []), [data])
  const tr = useGrampsTranslations(data?.defaults ?? [])
  return useMemo(
    () => all.map((value) => ({ value, label: tr(value) })).sort((a, b) => a.label.localeCompare(b.label)),
    [all, tr],
  )
}

/** Label function for raw (untranslated) type strings in list rows. */
export function useTypeLabel(set: TypeSet) {
  const { data } = useTypes(set)
  return useGrampsTranslations(data?.defaults ?? [])
}
