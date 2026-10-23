import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Tag } from '@/lib/types'
import { api as baseApi } from '../tags-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'

// Tags: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getTags' | 'getTag' | 'postTags' | 'putTag' | 'deleteTag'> & {
  getTags: OverrideResultType<Definitions['getTags'], Page<Tag>>
  getTag: OverrideResultType<Definitions['getTag'], Tag>
  postTags: OverrideResultType<Definitions['postTags'], TxEntry[]>
  putTag: OverrideResultType<Definitions['putTag'], TxEntry[]>
  deleteTag: OverrideResultType<Definitions['deleteTag'], TxEntry[]>
}

export const tagsApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getTags: { transformResponse: (data, meta) => pageOf<Tag>(data, meta), providesTags: listTags('Tags') },
    getTag: { providesTags: oneTags('Tags') },
    postTags: { invalidatesTags: writeTags('Tags') },
    putTag: { invalidatesTags: writeTags('Tags') },
    deleteTag: { invalidatesTags: [] },
  },
})

export const {
  useGetTagsQuery,
  useLazyGetTagsQuery,
  useGetTagQuery,
  usePostTagsMutation,
  usePutTagMutation,
  useDeleteTagMutation,
} = tagsApi
/** The tag body as the spec describes it (for writes). */
export type { Tag as TagBody } from '../tags-api-slice.gen'
