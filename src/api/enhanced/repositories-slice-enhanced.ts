import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Repository } from '@/lib/types'
import { api as baseApi } from '../repositories-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'

// Repositories: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getRepositories' | 'getRepository' | 'postRepositories' | 'putRepository' | 'postMergeRepository' | 'deleteRepository'> & {
  getRepositories: OverrideResultType<Definitions['getRepositories'], Page<Repository>>
  getRepository: OverrideResultType<Definitions['getRepository'], Repository>
  postRepositories: OverrideResultType<Definitions['postRepositories'], TxEntry[]>
  putRepository: OverrideResultType<Definitions['putRepository'], TxEntry[]>
  postMergeRepository: OverrideResultType<Definitions['postMergeRepository'], TxEntry[]>
  deleteRepository: OverrideResultType<Definitions['deleteRepository'], TxEntry[]>
}

export const repositoriesApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getRepositories: { transformResponse: (data, meta) => pageOf<Repository>(data, meta), providesTags: listTags('Repositories') },
    getRepository: { providesTags: oneTags('Repositories') },
    postRepositories: { invalidatesTags: writeTags('Repositories') },
    putRepository: { invalidatesTags: writeTags('Repositories') },
    postMergeRepository: { invalidatesTags: writeTags('Repositories') },
    deleteRepository: { invalidatesTags: [] },
  },
})

export const {
  useGetRepositoriesQuery,
  useLazyGetRepositoriesQuery,
  useGetRepositoryQuery,
  usePostRepositoriesMutation,
  usePutRepositoryMutation,
  usePostMergeRepositoryMutation,
  useDeleteRepositoryMutation,
} = repositoriesApi
