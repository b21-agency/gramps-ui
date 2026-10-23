import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Citation } from '@/lib/types'
import { api as baseApi } from '../citations-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'

// Citations: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getCitations' | 'getCitation' | 'postCitations' | 'putCitation' | 'postMergeCitation' | 'deleteCitation'> & {
  getCitations: OverrideResultType<Definitions['getCitations'], Page<Citation>>
  getCitation: OverrideResultType<Definitions['getCitation'], Citation>
  postCitations: OverrideResultType<Definitions['postCitations'], TxEntry[]>
  putCitation: OverrideResultType<Definitions['putCitation'], TxEntry[]>
  postMergeCitation: OverrideResultType<Definitions['postMergeCitation'], TxEntry[]>
  deleteCitation: OverrideResultType<Definitions['deleteCitation'], TxEntry[]>
}

export const citationsApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getCitations: { transformResponse: (data, meta) => pageOf<Citation>(data, meta), providesTags: listTags('Citations') },
    getCitation: { providesTags: oneTags('Citations') },
    postCitations: { invalidatesTags: writeTags('Citations') },
    putCitation: { invalidatesTags: writeTags('Citations') },
    postMergeCitation: { invalidatesTags: writeTags('Citations') },
    deleteCitation: { invalidatesTags: [] },
  },
})

export const {
  useGetCitationsQuery,
  useLazyGetCitationsQuery,
  useGetCitationQuery,
  usePostCitationsMutation,
  usePutCitationMutation,
  usePostMergeCitationMutation,
  useDeleteCitationMutation,
} = citationsApi
