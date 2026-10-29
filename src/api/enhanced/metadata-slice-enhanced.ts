import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Metadata } from '@/lib/types'
import { api as baseApi } from '../metadata-api-slice.gen'

// Tree metadata, Gramps translations and type vocabularies. Translations and default type
// maps are static per server version, so they stay cached for long and carry no tags.

export type Translation = { original: string; translation: string }

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getMetadata' | 'postTranslation' | 'getDefaultTypeMap' | 'getConfigs'> & {
  getMetadata: OverrideResultType<Definitions['getMetadata'], Metadata>
  postTranslation: OverrideResultType<Definitions['postTranslation'], Translation[]>
  getDefaultTypeMap: OverrideResultType<Definitions['getDefaultTypeMap'], Record<string, string>>
  /** server settings saved in the user database (admins only); keys missing here come from the server config */
  getConfigs: OverrideResultType<Definitions['getConfigs'], Record<string, string | null>>
}

// Type names the server's catalogue leaves untranslated (they carry a context there),
// so editors and pages would show them in English.
const CATALOGUE_GAPS: Record<string, Record<string, string>> = {
  de: {
    Taken: 'Angenommen',
    Inherited: 'Geerbt',
    Patrilineal: 'Patrilinear',
    Matrilineal: 'Matrilinear',
    Unknown: 'Unbekannt',
    'Father Age': 'Alter des Vaters',
    'Mother Age': 'Alter der Mutter',
    'To Do': 'Zu erledigen',
    Safe: 'Tresor',
    'Bas Mitzvah': 'Bat Mizwa',
  },
}

export const metadataApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getMetadata: { providesTags: ['Metadata'], keepUnusedDataFor: 600 },
    postTranslation: {
      providesTags: [],
      keepUnusedDataFor: 24 * 3600,
      transformResponse: (data: Translation[], _meta, arg) => {
        const gaps = CATALOGUE_GAPS[arg.language]
        return gaps
          ? data.map((r) => (r.translation === r.original && gaps[r.original.trim()] ? { ...r, translation: gaps[r.original.trim()] } : r))
          : data
      },
    },
    getDefaultTypeMap: { providesTags: [], keepUnusedDataFor: 24 * 3600 },
  },
})

/** Translation list → English → translated map. */
export const translationMap = (list: Translation[] | undefined) =>
  Object.fromEntries((list ?? []).map((r) => [r.original, r.translation])) as Record<string, string>

export const {
  useGetMetadataQuery,
  usePostTranslationQuery,
  useGetDefaultTypeMapQuery,
  useGetTypesQuery,
  useGetFiltersNamespaceQuery,
  useGetMetadataResearcherQuery,
  usePutMetadataResearcherMutation,
  useGetConfigsQuery,
  usePutConfigMutation,
  useDeleteConfigMutation,
} = metadataApi
