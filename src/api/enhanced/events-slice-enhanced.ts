import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { GEvent } from '@/lib/types'
import { api as baseApi } from '../events-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'

// Events: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getEvents' | 'getEvent' | 'postEvents' | 'putEvent' | 'postMergeEvent' | 'deleteEvent'> & {
  getEvents: OverrideResultType<Definitions['getEvents'], Page<GEvent>>
  getEvent: OverrideResultType<Definitions['getEvent'], GEvent>
  postEvents: OverrideResultType<Definitions['postEvents'], TxEntry[]>
  putEvent: OverrideResultType<Definitions['putEvent'], TxEntry[]>
  postMergeEvent: OverrideResultType<Definitions['postMergeEvent'], TxEntry[]>
  deleteEvent: OverrideResultType<Definitions['deleteEvent'], TxEntry[]>
}

export const eventsApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getEvents: { transformResponse: (data, meta) => pageOf<GEvent>(data, meta), providesTags: listTags('Events') },
    getEvent: { providesTags: oneTags('Events') },
    postEvents: { invalidatesTags: writeTags('Events') },
    putEvent: { invalidatesTags: writeTags('Events') },
    postMergeEvent: { invalidatesTags: writeTags('Events') },
    deleteEvent: { invalidatesTags: [] },
  },
})

export const {
  useGetEventsQuery,
  useLazyGetEventsQuery,
  useGetEventQuery,
  usePostEventsMutation,
  usePutEventMutation,
  usePostMergeEventMutation,
  useDeleteEventMutation,
} = eventsApi
