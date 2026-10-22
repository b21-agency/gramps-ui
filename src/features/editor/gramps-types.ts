// Gramps type vocabularies (event types, roles, ...) with translated labels.
import { useCallback, useMemo } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { useGetTypesQuery } from '@/api/metadata-api-slice.gen'
import { useEditorTypeTranslationsQuery } from '@/api/enhanced/editor'
import { apiLocale } from '@/i18n'

interface TypesResponse {
  default: Record<string, string[]>
  custom: Record<string, string[]>
}

/** Default category -> custom category keys (the API uses different names for custom lists). */
export type TypeCategory =
  | 'event_types'
  | 'event_role_types'
  | 'name_types'
  | 'name_origin_types'
  | 'family_relation_types'
  | 'child_reference_types'
  | 'place_types'
  | 'note_types'
  | 'repository_types'
  | 'source_media_types'
  | 'url_types'
  | 'attribute_types'
  | 'source_attribute_types'

export const customKeys: Record<string, string[]> = {
  attribute_types: ['person_attribute_types', 'family_attribute_types', 'event_attribute_types', 'media_attribute_types'],
}

export function useGrampsTypes() {
  const lang = apiLocale()
  const typesQ = useGetTypesQuery({})
  const types = { ...typesQ, data: typesQ.data as TypesResponse | undefined }
  const strings = useMemo(() => {
    const all = new Set<string>()
    for (const list of Object.values(types.data?.default ?? {})) list.forEach((s) => all.add(s))
    return [...all].sort()
  }, [types.data])
  const translations = useEditorTypeTranslationsQuery(lang !== 'en' && strings.length > 0 ? { lang, strings } : skipToken)
  const tr = translations.data
  const label = useCallback((s: string) => (s && tr?.[s]) || s, [tr])
  const options = useCallback(
    (cat: TypeCategory) => {
      const d = types.data
      if (!d) return { defaults: [] as string[], custom: [] as string[] }
      const defaults = (d.default[cat] ?? []).filter((s) => s && s !== 'Custom')
      const ck = customKeys[cat] ?? [cat]
      const custom = [...new Set(ck.flatMap((k) => d.custom[k] ?? []))].filter((s) => !defaults.includes(s))
      return { defaults, custom }
    },
    [types.data],
  )
  return { label, options, loading: types.isLoading }
}
