import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Person } from '@/lib/types'
import { api as baseApi } from '../people-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'

// People: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

type DnaRow = Record<string, unknown>

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getPeople' | 'getPerson' | 'postPeople' | 'putPerson' | 'postMergePerson' | 'deletePerson' | 'getPersonDnaMatches' | 'getPersonYdna' | 'postDnaMatchParser'> & {
  getPeople: OverrideResultType<Definitions['getPeople'], Page<Person>>
  getPerson: OverrideResultType<Definitions['getPerson'], Person>
  postPeople: OverrideResultType<Definitions['postPeople'], TxEntry[]>
  putPerson: OverrideResultType<Definitions['putPerson'], TxEntry[]>
  postMergePerson: OverrideResultType<Definitions['postMergePerson'], TxEntry[]>
  deletePerson: OverrideResultType<Definitions['deletePerson'], TxEntry[]>
  getPersonDnaMatches: OverrideResultType<Definitions['getPersonDnaMatches'], DnaRow[]>
  getPersonYdna: OverrideResultType<Definitions['getPersonYdna'], Record<string, unknown>>
  postDnaMatchParser: OverrideResultType<Definitions['postDnaMatchParser'], DnaRow[]>
}

export const peopleApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getPeople: { transformResponse: (data, meta) => pageOf<Person>(data, meta), providesTags: listTags('People') },
    getPerson: { providesTags: oneTags('People') },
    postPeople: { invalidatesTags: writeTags('People') },
    putPerson: { invalidatesTags: writeTags('People') },
    postMergePerson: { invalidatesTags: writeTags('People') },
    deletePerson: { invalidatesTags: [] },
    // a person's matches change with the person, the match notes and their associations
    getPersonDnaMatches: { providesTags: (_r, _e, { handle }) => [{ type: 'People', id: handle }, { type: 'Notes', id: 'LIST' }, 'Relations'] },
    getPersonYdna: { providesTags: (_r, _e, { handle }) => [{ type: 'People', id: handle }] },
    // parses pasted match data for the live preview; reads nothing
    postDnaMatchParser: { providesTags: [], keepUnusedDataFor: 120 },
  },
})

export const {
  useGetPeopleQuery,
  useLazyGetPeopleQuery,
  useGetPersonQuery,
  usePostPeopleMutation,
  usePutPersonMutation,
  usePostMergePersonMutation,
  useDeletePersonMutation,
  useGetPersonDnaMatchesQuery,
  useGetPersonYdnaQuery,
  usePostDnaMatchParserQuery,
  useGetRelationQuery,
  useGetPersonTimelineQuery,
} = peopleApi
