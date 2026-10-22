import { api } from "./index";
export const addTagTypes = ["Search"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getSearch: build.query<GetSearchApiResponse, GetSearchApiArg>({
        query: (queryArg) => ({
          url: `/api/search/`,
          params: {
            locale: queryArg.locale,
            query: queryArg.query,
            semantic: queryArg.semantic,
            page: queryArg.page,
            pagesize: queryArg.pagesize,
            sort: queryArg.sort,
            precision: queryArg.precision,
            profile: queryArg.profile,
            strip: queryArg.strip,
            type: queryArg["type"],
            change: queryArg.change,
          },
        }),
        providesTags: ["Search"],
      }),
      postSearchIndex: build.mutation<
        PostSearchIndexApiResponse,
        PostSearchIndexApiArg
      >({
        query: (queryArg) => ({
          url: `/api/search/index/`,
          method: "POST",
          params: {
            full: queryArg.full,
            semantic: queryArg.semantic,
          },
        }),
        invalidatesTags: ["Search"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type GetSearchApiResponse = /** status 200 OK */ SearchResult[];
export type GetSearchApiArg = {
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** The search string. */
  query: string;
  /** If true, use semantic (vector) search rather than full-text search. Deprecated: will be ignored from version 3.25.0 on. */
  semantic?: boolean;
  /** Page number of the result subset to return. */
  page?: number;
  /** Number of search results per page. */
  pagesize?: number;
  /** Comma-delimited sort keys for search results. Available: change, type. Prefix with '-' for descending. */
  sort?: string[];
  /** Number of significant time components in age/span strings when profile is used: 1=year only, 2=year+month, 3=year+month+day. */
  precision?: number;
  /** Comma-delimited profile sections to include for matching objects. Possible values: all, age, self, span, events, families, references. */
  profile?: string[];
  /** If true, strip keys with empty values from the response. */
  strip?: boolean;
  /** Comma-delimited list of object types to include (e.g. 'person,family,source'). */
  type?: string[];
  /** ISO-8601 timestamp filter (prefix with '>' or '<') to filter by last-change date. */
  change?: string;
};
export type PostSearchIndexApiResponse = unknown;
export type PostSearchIndexApiArg = {
  /** If true, perform a full reindex; otherwise incremental. */
  full?: boolean;
  /** If true, rebuild the semantic (vector) index rather than the full-text index. Deprecated: will be ignored from version 3.25.0 on. */
  semantic?: boolean;
};
export type SearchResult = {
  /** Handle of the matching object. */
  handle?: string;
  /** The matching object data. */
  object?: any;
  /** Type of the matching object (e.g. 'person'). */
  object_type?: string;
  /** Relevance score. */
  score?: number;
  [key: string]: any;
};
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
export const {
  useGetSearchQuery,
  useLazyGetSearchQuery,
  usePostSearchIndexMutation,
} = injectedRtkApi;
