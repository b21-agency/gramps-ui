import { api } from '../index'
import type { TypeMaps } from '@/features/revisions/history'
import { run } from './compose'
import { metadataApi } from './metadata-slice-enhanced'
import type { Page } from './page'
import { transactionsApi, type ObjectChange } from './transactions-slice-enhanced'

// Composites for the change history (codegen has no infinite queries and no fan-out):
// the paged history of one object ("show more") and the type maps of all default types.
// Both run the generated endpoints; the plain history pages use them directly.

/** Like the classic UI, only the most recent revisions of an object are listed. */
export const OBJECT_HISTORY_PAGE = 10
export const OBJECT_HISTORY_MAX = 50

/** Gramps type class → datatype of /types/default/{datatype}/map. */
export const TYPE_DATATYPES = [
  'event_role_types',
  'name_types',
  'name_origin_types',
  'event_types',
  'family_relation_types',
  'child_reference_types',
  'attribute_types',
  'source_attribute_types',
  'note_types',
  'place_types',
  'repository_types',
  'source_media_types',
  'url_types',
]

const tagOfClass: Record<string, 'People' | 'Families' | 'Events' | 'Places' | 'Sources' | 'Citations' | 'Repositories' | 'Notes' | 'Media'> = {
  Person: 'People',
  Family: 'Families',
  Event: 'Events',
  Place: 'Places',
  Source: 'Sources',
  Citation: 'Citations',
  Repository: 'Repositories',
  Note: 'Notes',
  Media: 'Media',
}

export const revisionsApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /** Changes of one object, newest first, OBJECT_HISTORY_PAGE per page, at most OBJECT_HISTORY_MAX. */
    objectHistory: build.infiniteQuery<
      Page<ObjectChange>,
      // lastChange only keys the cache: a newer change of the object starts a fresh list
      { objClass: string; handle: string; lastChange?: number },
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (last, all, lastParam) => {
          const n = all.reduce((s, p) => s + p.items.length, 0)
          return n < last.total && n < OBJECT_HISTORY_MAX && last.items.length === OBJECT_HISTORY_PAGE ? lastParam + 1 : undefined
        },
      },
      async queryFn({ queryArg: { objClass, handle }, pageParam }, queryApi) {
        return run<Page<ObjectChange>>(
          queryApi,
          transactionsApi.endpoints.getObjectHistory.initiate(
            { objClass, objHandle: handle, sort: '-id', page: pageParam, pagesize: OBJECT_HISTORY_PAGE },
            { subscribe: false, forceRefetch: true },
          ),
        )
      },
      providesTags: (_r, _e, { objClass, handle }) => [
        'Transactions',
        ...(tagOfClass[objClass] ? [{ type: tagOfClass[objClass], id: handle }] : []),
      ],
    }),

    /** Value → English name maps for all Gramps default types (fetched once per session). */
    typeMaps: build.query<TypeMaps, void>({
      async queryFn(_arg, queryApi) {
        const entries = await Promise.all(
          TYPE_DATATYPES.map(async (datatype) => {
            const r = await run<Record<string, string>>(
              queryApi,
              metadataApi.endpoints.getDefaultTypeMap.initiate({ datatype }, { subscribe: false, forceRefetch: true }),
            )
            return [datatype, 'data' in r ? r.data : {}] as const
          }),
        )
        return { data: Object.fromEntries(entries) as TypeMaps }
      },
      keepUnusedDataFor: 24 * 3600,
    }),
  }),
})

export type { ObjectChange }
export const { useObjectHistoryInfiniteQuery, useTypeMapsQuery } = revisionsApi
