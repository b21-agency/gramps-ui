import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Family } from '@/lib/types'
import { api as baseApi } from '../families-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'

// Families: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getFamilies' | 'getFamily' | 'postFamilies' | 'putFamily' | 'postMergeFamily' | 'deleteFamily'> & {
  getFamilies: OverrideResultType<Definitions['getFamilies'], Page<Family>>
  getFamily: OverrideResultType<Definitions['getFamily'], Family>
  postFamilies: OverrideResultType<Definitions['postFamilies'], TxEntry[]>
  putFamily: OverrideResultType<Definitions['putFamily'], TxEntry[]>
  postMergeFamily: OverrideResultType<Definitions['postMergeFamily'], TxEntry[]>
  deleteFamily: OverrideResultType<Definitions['deleteFamily'], TxEntry[]>
}

export const familiesApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getFamilies: { transformResponse: (data, meta) => pageOf<Family>(data, meta), providesTags: listTags('Families') },
    getFamily: { providesTags: oneTags('Families') },
    postFamilies: { invalidatesTags: writeTags('Families') },
    putFamily: { invalidatesTags: writeTags('Families') },
    postMergeFamily: { invalidatesTags: writeTags('Families') },
    deleteFamily: { invalidatesTags: [] },
  },
})

export const {
  useGetFamiliesQuery,
  useLazyGetFamiliesQuery,
  useGetFamilyQuery,
  usePostFamiliesMutation,
  usePutFamilyMutation,
  usePostMergeFamilyMutation,
  useDeleteFamilyMutation,
} = familiesApi
