import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { SearchHit } from '@/lib/types'
import { api as baseApi } from '../search-api-slice.gen'
import { pageOf, type Page } from './page'
import type { TaskStart } from './tasks-slice-enhanced'

// Full-text search: hits with the X-Total-Count total; reindexing is a background task.

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getSearch' | 'postSearchIndex'> & {
  getSearch: OverrideResultType<Definitions['getSearch'], Page<SearchHit>>
  postSearchIndex: OverrideResultType<Definitions['postSearchIndex'], TaskStart>
}

export const searchApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getSearch: { transformResponse: (data, meta) => pageOf<SearchHit>(data, meta), providesTags: ['Search'] },
    // changes nothing until the task is done; use-task invalidates TASK_TAGS.reindex then
    postSearchIndex: { invalidatesTags: [{ type: 'Tasks', id: 'LIST' }] },
  },
})

export const { useGetSearchQuery, useLazyGetSearchQuery, usePostSearchIndexMutation } = searchApi
export type { GetSearchApiArg } from '../search-api-slice.gen'
