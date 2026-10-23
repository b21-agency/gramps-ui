import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Place } from '@/lib/types'
import { api as baseApi } from '../places-api-slice.gen'
import { pageOf, type Page } from './page'
import { listTags, oneTags, writeTags, type TxEntry } from './tags'

// Places: the generated endpoints with real result types and per-object cache tags.
// Writes answer with the Gramps transaction and invalidate exactly what it touched.
// Deletes invalidate nothing themselves: the caller invalidates the returned transaction
// right away or, when deleting the record a page shows, after leaving it (editor.ts).

/** A place with coordinates (`/places/coordinates/`). */
export interface CoordRow {
  handle: string
  name: string
  lat: number | string | null
  long: number | string | null
  [key: string]: unknown
}

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getPlaces' | 'getPlace' | 'postPlaces' | 'putPlace' | 'postMergePlace' | 'deletePlace' | 'getPlacesCoordinates'> & {
  getPlaces: OverrideResultType<Definitions['getPlaces'], Page<Place>>
  getPlace: OverrideResultType<Definitions['getPlace'], Place>
  postPlaces: OverrideResultType<Definitions['postPlaces'], TxEntry[]>
  putPlace: OverrideResultType<Definitions['putPlace'], TxEntry[]>
  postMergePlace: OverrideResultType<Definitions['postMergePlace'], TxEntry[]>
  deletePlace: OverrideResultType<Definitions['deletePlace'], TxEntry[]>
  getPlacesCoordinates: OverrideResultType<Definitions['getPlacesCoordinates'], CoordRow[]>
}

export const placesApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getPlaces: { transformResponse: (data, meta) => pageOf<Place>(data, meta), providesTags: listTags('Places') },
    getPlace: { providesTags: oneTags('Places') },
    postPlaces: { invalidatesTags: writeTags('Places') },
    putPlace: { invalidatesTags: writeTags('Places') },
    postMergePlace: { invalidatesTags: writeTags('Places') },
    deletePlace: { invalidatesTags: [] },
    // every place with coordinates (API >= 3.23); refreshes with any place change
    getPlacesCoordinates: { providesTags: [{ type: 'Places', id: 'LIST' }] },
  },
})

export const {
  useGetPlacesQuery,
  useLazyGetPlacesQuery,
  useGetPlaceQuery,
  usePostPlacesMutation,
  usePutPlaceMutation,
  usePostMergePlaceMutation,
  useDeletePlaceMutation,
  useGetPlacesCoordinatesQuery,
} = placesApi
