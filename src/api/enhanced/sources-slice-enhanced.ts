import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Source } from '@/lib/types'
import { api as baseApi } from '../sources-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'

// Sources: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getSources' | 'getSource' | 'postSources' | 'putSource' | 'postMergeSource' | 'deleteSource'> & {
  getSources: OverrideResultType<Definitions['getSources'], Page<Source>>
  getSource: OverrideResultType<Definitions['getSource'], Source>
  postSources: OverrideResultType<Definitions['postSources'], TxEntry[]>
  putSource: OverrideResultType<Definitions['putSource'], TxEntry[]>
  postMergeSource: OverrideResultType<Definitions['postMergeSource'], TxEntry[]>
  deleteSource: OverrideResultType<Definitions['deleteSource'], TxEntry[]>
}

export const sourcesApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getSources: { transformResponse: (data, meta) => pageOf<Source>(data, meta), providesTags: listTags('Sources') },
    getSource: { providesTags: oneTags('Sources') },
    postSources: { invalidatesTags: writeTags('Sources') },
    putSource: { invalidatesTags: writeTags('Sources') },
    postMergeSource: { invalidatesTags: writeTags('Sources') },
    deleteSource: { invalidatesTags: [] },
  },
})

export const {
  useGetSourcesQuery,
  useLazyGetSourcesQuery,
  useGetSourceQuery,
  usePostSourcesMutation,
  usePutSourceMutation,
  usePostMergeSourceMutation,
  useDeleteSourceMutation,
} = sourcesApi
/** The source body as the spec describes it (for writes). */
export type { Source as SourceBody } from '../sources-api-slice.gen'
