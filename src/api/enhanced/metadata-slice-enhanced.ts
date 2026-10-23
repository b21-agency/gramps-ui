import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Metadata } from '@/lib/types'
import { api as baseApi } from '../metadata-api-slice.gen'

// Tree metadata, Gramps translations and type vocabularies. Translations and default type
// maps are static per server version, so they stay cached for long and carry no tags.

export type Translation = { original: string; translation: string }

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getMetadata' | 'postTranslation' | 'getDefaultTypeMap'> & {
  getMetadata: OverrideResultType<Definitions['getMetadata'], Metadata>
  postTranslation: OverrideResultType<Definitions['postTranslation'], Translation[]>
  getDefaultTypeMap: OverrideResultType<Definitions['getDefaultTypeMap'], Record<string, string>>
}

export const metadataApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getMetadata: { providesTags: ['Metadata'], keepUnusedDataFor: 600 },
    postTranslation: { providesTags: [], keepUnusedDataFor: 24 * 3600 },
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
} = metadataApi
