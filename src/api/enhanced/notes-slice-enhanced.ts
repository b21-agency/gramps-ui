import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Note } from '@/lib/types'
import { api as baseApi } from '../notes-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'

// Notes: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getNotes' | 'getNote' | 'postNotes' | 'putNote' | 'postMergeNote' | 'deleteNote'> & {
  getNotes: OverrideResultType<Definitions['getNotes'], Page<Note>>
  getNote: OverrideResultType<Definitions['getNote'], Note>
  postNotes: OverrideResultType<Definitions['postNotes'], TxEntry[]>
  putNote: OverrideResultType<Definitions['putNote'], TxEntry[]>
  postMergeNote: OverrideResultType<Definitions['postMergeNote'], TxEntry[]>
  deleteNote: OverrideResultType<Definitions['deleteNote'], TxEntry[]>
}

export const notesApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getNotes: { transformResponse: (data, meta) => pageOf<Note>(data, meta), providesTags: listTags('Notes') },
    getNote: { providesTags: oneTags('Notes') },
    postNotes: { invalidatesTags: writeTags('Notes') },
    putNote: { invalidatesTags: writeTags('Notes') },
    postMergeNote: { invalidatesTags: writeTags('Notes') },
    deleteNote: { invalidatesTags: [] },
  },
})

export const {
  useGetNotesQuery,
  useLazyGetNotesQuery,
  useGetNoteQuery,
  usePostNotesMutation,
  usePutNoteMutation,
  usePostMergeNoteMutation,
  useDeleteNoteMutation,
} = notesApi
/** The note body as the spec describes it (for writes). */
export type { Note as NoteBody } from '../notes-api-slice.gen'
