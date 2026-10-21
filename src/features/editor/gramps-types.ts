// Gramps type vocabularies (event types, roles, ...) with translated labels.
import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
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
  const types = useQuery({
    queryKey: ['types', 'all'],
    queryFn: () => api<TypesResponse>('/types/'),
    staleTime: 10 * 60_000,
  })
  const strings = useMemo(() => {
    const all = new Set<string>()
    for (const list of Object.values(types.data?.default ?? {})) list.forEach((s) => all.add(s))
    return [...all].sort()
  }, [types.data])
  const translations = useQuery({
    queryKey: ['types', 'translations', lang, strings.length],
    enabled: lang !== 'en' && strings.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const res = await api<Array<{ original: string; translation: string }>>(`/translations/${lang}`, {
        method: 'POST',
        json: { strings },
      })
      return Object.fromEntries(res.map((r) => [r.original, r.translation])) as Record<string, string>
    },
  })
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
