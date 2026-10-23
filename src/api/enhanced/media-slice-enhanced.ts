import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Media } from '@/lib/types'
import { api as baseApi } from '../media-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'
import type { TaskStart } from './tasks-slice-enhanced'

// Media: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getMediaObjects' | 'getMediaObject' | 'postMediaObjects' | 'putMediaObject' | 'postMergeMedia' | 'deleteMediaObject' | 'getMediaFaceDetection' | 'postMediaOcr' | 'postMediaArchive'> & {
  getMediaObjects: OverrideResultType<Definitions['getMediaObjects'], Page<Media>>
  getMediaObject: OverrideResultType<Definitions['getMediaObject'], Media>
  postMediaObjects: OverrideResultType<Definitions['postMediaObjects'], TxEntry[]>
  putMediaObject: OverrideResultType<Definitions['putMediaObject'], TxEntry[]>
  postMergeMedia: OverrideResultType<Definitions['postMergeMedia'], TxEntry[]>
  deleteMediaObject: OverrideResultType<Definitions['deleteMediaObject'], TxEntry[]>
  getMediaFaceDetection: OverrideResultType<Definitions['getMediaFaceDetection'], number[][]>
  postMediaOcr: OverrideResultType<Definitions['postMediaOcr'], unknown>
  postMediaArchive: OverrideResultType<Definitions['postMediaArchive'], TaskStart>
}

export const mediaApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getMediaObjects: { transformResponse: (data, meta) => pageOf<Media>(data, meta), providesTags: listTags('Media') },
    getMediaObject: { providesTags: oneTags('Media') },
    postMediaObjects: { invalidatesTags: writeTags('Media') },
    putMediaObject: { invalidatesTags: writeTags('Media') },
    postMergeMedia: { invalidatesTags: writeTags('Media') },
    deleteMediaObject: { invalidatesTags: [] },
    // suggested face rectangles: expensive, cached for an hour, not refreshed by edits
    getMediaFaceDetection: { providesTags: [], keepUnusedDataFor: 3600 },
    // text recognition reads only (it may answer with a task)
    postMediaOcr: { invalidatesTags: [] },
    postMediaArchive: { invalidatesTags: [{ type: 'Tasks', id: 'LIST' }] },
  },
})

export const {
  useGetMediaObjectsQuery,
  useLazyGetMediaObjectsQuery,
  useGetMediaObjectQuery,
  usePostMediaObjectsMutation,
  usePutMediaObjectMutation,
  usePostMergeMediaMutation,
  useDeleteMediaObjectMutation,
  useGetMediaFaceDetectionQuery,
  usePostMediaOcrMutation,
  usePostMediaArchiveMutation,
} = mediaApi
