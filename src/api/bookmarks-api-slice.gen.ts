import { api } from "./index";
export const addTagTypes = ["Bookmarks"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getBookmark: build.query<GetBookmarkApiResponse, GetBookmarkApiArg>({
        query: (queryArg) => ({
          url: `/api/bookmarks/${queryArg["namespace"]}`,
        }),
        providesTags: ["Bookmarks"],
      }),
      getBookmarks: build.query<GetBookmarksApiResponse, GetBookmarksApiArg>({
        query: () => ({ url: `/api/bookmarks/` }),
        providesTags: ["Bookmarks"],
      }),
      putBookmarkEdit: build.mutation<
        PutBookmarkEditApiResponse,
        PutBookmarkEditApiArg
      >({
        query: (queryArg) => ({
          url: `/api/bookmarks/${queryArg["namespace"]}/${queryArg.handle}`,
          method: "PUT",
        }),
        invalidatesTags: ["Bookmarks"],
      }),
      deleteBookmarkEdit: build.mutation<
        DeleteBookmarkEditApiResponse,
        DeleteBookmarkEditApiArg
      >({
        query: (queryArg) => ({
          url: `/api/bookmarks/${queryArg["namespace"]}/${queryArg.handle}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Bookmarks"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type GetBookmarkApiResponse = /** status 200 OK */ Schema[];
export type GetBookmarkApiArg = {
  namespace: string;
};
export type GetBookmarksApiResponse = /** status 200 OK */ Bookmarks;
export type GetBookmarksApiArg = void;
export type PutBookmarkEditApiResponse = unknown;
export type PutBookmarkEditApiArg = {
  namespace: string;
  handle: string;
};
export type DeleteBookmarkEditApiResponse = unknown;
export type DeleteBookmarkEditApiArg = {
  namespace: string;
  handle: string;
};
export type Schema = {};
export type Error = {
  /** Error code */
  code?: number;
  /** Error name */
  status?: string;
  /** Error message */
  message?: string;
  /** Errors */
  errors?: {
    [key: string]: any;
  };
};
export type Bookmarks = {
  [key: string]: any;
};
export const {
  useGetBookmarkQuery,
  useLazyGetBookmarkQuery,
  useGetBookmarksQuery,
  useLazyGetBookmarksQuery,
  usePutBookmarkEditMutation,
  useDeleteBookmarkEditMutation,
} = injectedRtkApi;
