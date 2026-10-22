import { api } from "./index";
export const addTagTypes = ["Media"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getMediaObject: build.query<
        GetMediaObjectApiResponse,
        GetMediaObjectApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.handle}`,
          params: {
            backlinks: queryArg.backlinks,
            extend: queryArg.extend,
            formats: queryArg.formats,
            format_options: queryArg.formatOptions,
            keys: queryArg.keys,
            locale: queryArg.locale,
            name_format: queryArg.nameFormat,
            precision: queryArg.precision,
            profile: queryArg.profile,
            skipkeys: queryArg.skipkeys,
            place_hierarchy: queryArg.placeHierarchy,
            soundex: queryArg.soundex,
            strip: queryArg.strip,
          },
        }),
        providesTags: ["Media"],
      }),
      putMediaObject: build.mutation<
        PutMediaObjectApiResponse,
        PutMediaObjectApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.handle}`,
          method: "PUT",
          body: queryArg.media,
        }),
        invalidatesTags: ["Media"],
      }),
      deleteMediaObject: build.mutation<
        DeleteMediaObjectApiResponse,
        DeleteMediaObjectApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.handle}`,
          method: "DELETE",
        }),
        invalidatesTags: ["Media"],
      }),
      getMediaObjects: build.query<
        GetMediaObjectsApiResponse,
        GetMediaObjectsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/`,
          params: {
            backlinks: queryArg.backlinks,
            dates: queryArg.dates,
            extend: queryArg.extend,
            filter: queryArg.filter,
            formats: queryArg.formats,
            format_options: queryArg.formatOptions,
            gql: queryArg.gql,
            gramps_id: queryArg.grampsId,
            handles: queryArg.handles,
            keys: queryArg.keys,
            locale: queryArg.locale,
            page: queryArg.page,
            pagesize: queryArg.pagesize,
            precision: queryArg.precision,
            profile: queryArg.profile,
            rules: queryArg.rules,
            skipkeys: queryArg.skipkeys,
            sort: queryArg.sort,
            place_hierarchy: queryArg.placeHierarchy,
            soundex: queryArg.soundex,
            strip: queryArg.strip,
            filemissing: queryArg.filemissing,
            name_format: queryArg.nameFormat,
          },
        }),
        providesTags: ["Media"],
      }),
      postMediaObjects: build.mutation<
        PostMediaObjectsApiResponse,
        PostMediaObjectsApiArg
      >({
        query: () => ({ url: `/api/media/`, method: "POST" }),
        invalidatesTags: ["Media"],
      }),
      postMediaQuery: build.mutation<
        PostMediaQueryApiResponse,
        PostMediaQueryApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/query/`,
          method: "POST",
          body: queryArg.queryBodyArgs,
        }),
        invalidatesTags: ["Media"],
      }),
      postMergeMedia: build.mutation<
        PostMergeMediaApiResponse,
        PostMergeMediaApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.phoenixHandle}/merge/${queryArg.titanicHandle}`,
          method: "POST",
        }),
        invalidatesTags: ["Media"],
      }),
      getMediaFile: build.query<GetMediaFileApiResponse, GetMediaFileApiArg>({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.handle}/file`,
          params: {
            download: queryArg.download,
            jwt: queryArg.jwt,
          },
        }),
        providesTags: ["Media"],
      }),
      putMediaFile: build.mutation<PutMediaFileApiResponse, PutMediaFileApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/media/${queryArg.handle}/file`,
            method: "PUT",
            params: {
              uploadmissing: queryArg.uploadmissing,
            },
          }),
          invalidatesTags: ["Media"],
        },
      ),
      getMediaFaceDetection: build.query<
        GetMediaFaceDetectionApiResponse,
        GetMediaFaceDetectionApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.handle}/face_detection`,
        }),
        providesTags: ["Media"],
      }),
      postMediaOcr: build.mutation<PostMediaOcrApiResponse, PostMediaOcrApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/media/${queryArg.handle}/ocr`,
            method: "POST",
            params: {
              lang: queryArg.lang,
              format: queryArg.format,
            },
          }),
          invalidatesTags: ["Media"],
        },
      ),
      postMediaArchive: build.mutation<
        PostMediaArchiveApiResponse,
        PostMediaArchiveApiArg
      >({
        query: () => ({ url: `/api/media/archive/`, method: "POST" }),
        invalidatesTags: ["Media"],
      }),
      getMediaArchiveFilename: build.query<
        GetMediaArchiveFilenameApiResponse,
        GetMediaArchiveFilenameApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/archive/${queryArg.filename}`,
        }),
        providesTags: ["Media"],
      }),
      postMediaArchiveUploadZip: build.mutation<
        PostMediaArchiveUploadZipApiResponse,
        PostMediaArchiveUploadZipApiArg
      >({
        query: () => ({ url: `/api/media/archive/upload/zip`, method: "POST" }),
        invalidatesTags: ["Media"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type GetMediaObjectApiResponse = /** status 200 OK */ Schema;
export type GetMediaObjectApiArg = {
  handle: string;
  /** If true, include handles of objects referring to this object, grouped by object type. */
  backlinks?: boolean;
  /** Comma-delimited list of keys for which to include full records in an 'extended' section. Use 'all' to include everything. */
  extend?: string[];
  /** Comma-delimited list of media format keys to include. */
  formats?: string[];
  /** Options for media format processing. */
  formatOptions?: string;
  /** Comma-delimited list of top-level keys to return; all others are omitted. */
  keys?: string[];
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** Format string for name display (see gramps.gen.display.name for syntax). */
  nameFormat?: string;
  /** Number of significant time components in age/span strings when profile is used: 1=year only, 2=year+month, 3=year+month+day. */
  precision?: number;
  /** Comma-delimited list of profile sections to include. 'self': name/sex/birth/death; 'families': family summaries; 'events': event list; 'age': age at events; 'span': elapsed time; 'ratings': citation count and confidence; 'references': referring objects; 'participants': event participants (people and families). Use 'all' for everything. */
  profile?: string[];
  /** Comma-delimited list of top-level keys to omit from the response; all others are kept. */
  skipkeys?: string[];
  /** If false, omit parent place hierarchy from the place profile. Only relevant when profile is requested for places. */
  placeHierarchy?: boolean;
  /** If true, include the soundex code for the surname. */
  soundex?: boolean;
  /** If true, strip keys with empty values from the response. */
  strip?: boolean;
};
export type PutMediaObjectApiResponse = unknown;
export type PutMediaObjectApiArg = {
  handle: string;
  /** The Media object to store. The `_class` field is optional; if present it must be `Media`. */
  media: Media;
};
export type DeleteMediaObjectApiResponse = unknown;
export type DeleteMediaObjectApiArg = {
  handle: string;
};
export type GetMediaObjectsApiResponse = /** status 200 OK */ Schema[];
export type GetMediaObjectsApiArg = {
  /** If true, include handles of objects referring to this object, grouped by object type. */
  backlinks?: boolean;
  /** Date range filter. Formats: '-y/m/d' (before), 'y/m/d-' (after), 'y/m/d-y/m/d' (range). Components may use '*' as wildcard. */
  dates?: string | null;
  /** Comma-delimited list of keys for which to include full records in an 'extended' section. Use 'all' to include everything. */
  extend?: string[];
  /** Name of an existing custom filter to apply. */
  filter?: string;
  /** Comma-delimited list of media format keys to include. */
  formats?: string[];
  /** Options for media format processing. */
  formatOptions?: string;
  /** A Gramps QL (GQL) query string used to filter the objects (e.g. 'media_list.length >= 10'). Full syntax reference: https://github.com/DavidMStraub/gramps-ql/blob/main/README.md */
  gql?: string;
  /** An alternate user-managed Gramps identifier. If provided, returns only the matching object. */
  grampsId?: string;
  /** Comma-delimited list of handles to fetch. If provided, returns only the matching objects (non-existing handles are silently skipped). */
  handles?: string[];
  /** Comma-delimited list of top-level keys to return; all others are omitted. */
  keys?: string[];
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** Page number of the result subset to return. If omitted, all results are returned. */
  page?: number;
  /** Number of items per page when pagination is active. */
  pagesize?: number;
  /** Number of significant time components in age/span strings when profile is used: 1=year only, 2=year+month, 3=year+month+day. */
  precision?: number;
  /** Comma-delimited list of profile sections to include. 'self': name/sex/birth/death; 'families': family summaries; 'events': event list; 'age': age at events; 'span': elapsed time; 'ratings': citation count and confidence; 'references': referring objects; 'participants': event participants (people and families). Use 'all' for everything. */
  profile?: string[];
  /** Inline filter expression as JSON: {"function": "and"|"or"|"one", "invert": bool, "rules": [{"name": str, "values": [...], "regex": bool}]}. */
  rules?: string;
  /** Comma-delimited list of top-level keys to omit from the response; all others are kept. */
  skipkeys?: string[];
  /** Comma-delimited sort keys, prefix with '-' for descending. Available keys: birth, change, death, gender, gramps_id, name, private, soundex, surname. */
  sort?: string[];
  /** If false, omit parent place hierarchy from the place profile. Only relevant when profile is requested for places. */
  placeHierarchy?: boolean;
  /** If true, include the soundex code for the surname. */
  soundex?: boolean;
  /** If true, strip keys with empty values from the response. */
  strip?: boolean;
  /** If true, return only media objects whose file is missing from storage (media endpoint only). */
  filemissing?: boolean;
  /** Format string for name display (see gramps.gen.display.name for syntax). */
  nameFormat?: string;
};
export type PostMediaObjectsApiResponse = unknown;
export type PostMediaObjectsApiArg = void;
export type PostMediaQueryApiResponse =
  /** status 200 OK */ ObjectQueryResponse;
export type PostMediaQueryApiArg = {
  queryBodyArgs: QueryBodyArgs;
};
export type PostMergeMediaApiResponse = /** status 200 OK */ Schema;
export type PostMergeMediaApiArg = {
  phoenixHandle: string;
  titanicHandle: string;
};
export type GetMediaFileApiResponse = unknown;
export type GetMediaFileApiArg = {
  handle: string;
  /** If true, return the file as an attachment (forces download). */
  download?: boolean;
  /** JWT token for download authentication (used when the browser fetches the file directly). */
  jwt?: string;
};
export type PutMediaFileApiResponse = unknown;
export type PutMediaFileApiArg = {
  handle: string;
  /** If true, upload a missing file for an existing media object without modifying the object record. */
  uploadmissing?: boolean;
};
export type GetMediaFaceDetectionApiResponse = unknown;
export type GetMediaFaceDetectionApiArg = {
  handle: string;
};
export type PostMediaOcrApiResponse = unknown;
export type PostMediaOcrApiArg = {
  handle: string;
  /** Tesseract language code for OCR (e.g. 'eng', 'deu'). */
  lang: string;
  /** Output format: 'string' (default), 'data', 'boxes', or 'hocr'. */
  format?: string;
};
export type PostMediaArchiveApiResponse = unknown;
export type PostMediaArchiveApiArg = void;
export type GetMediaArchiveFilenameApiResponse = unknown;
export type GetMediaArchiveFilenameApiArg = {
  filename: string;
};
export type PostMediaArchiveUploadZipApiResponse = unknown;
export type PostMediaArchiveUploadZipApiArg = void;
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
export type Attribute = {
  /** Handles of citations supporting this attribute. */
  citation_list?: string[];
  /** Handles of research notes about this attribute. */
  note_list?: string[];
  /** Private object indicator. */
  private?: boolean;
  /** Type of the attribute. */
  type?: string;
  /** Value of the attribute. */
  value?: string;
  [key: string]: any;
};
export type Date = {
  /** The calendar format for the date. */
  calendar?: number;
  /** Mixed array of integers and booleans. */
  dateval?: any[];
  /** Date modifier (e.g. before/after/about). */
  modifier?: number;
  /** Alternate new-year start. */
  newyear?: number;
  /** Quality / confidence of the date. */
  quality?: number;
  /** Value used for date sorting. */
  sortval?: number;
  /** Textual representation of the date. */
  text?: string;
  /** Year component of the date. */
  year?: number;
  [key: string]: any;
};
export type Media = {
  /** Object class name; must be 'Media'. */
  _class?: string;
  /** Attributes of the media object. */
  attribute_list?: Attribute[];
  /** Unix timestamp of the last modification. */
  change?: number;
  /** Checksum for file integrity validation. */
  checksum?: string;
  /** Handles of citations supporting this media object. */
  citation_list?: string[];
  /** Date associated with the media object. */
  date?: Date;
  /** Description of the media object content. */
  desc?: string;
  /** Alternate user-managed identifier. */
  gramps_id?: string;
  /** Unique handle for the media object. */
  handle?: string;
  /** MIME type of the file (e.g. 'image/jpeg'). */
  mime?: string;
  /** Handles of research notes related to this media object. */
  note_list?: string[];
  /** Storage path to locate the media file. */
  path?: string;
  /** Private object indicator. */
  private?: boolean;
  /** Handles of tags attached to this media object. */
  tag_list?: string[];
  [key: string]: any;
};
export type Backlinks = {
  /** Handles of people referring to this object. */
  person?: string[];
  /** Handles of families referring to this object. */
  family?: string[];
  /** Handles of events referring to this object. */
  event?: string[];
  /** Handles of places referring to this object. */
  place?: string[];
  /** Handles of sources referring to this object. */
  source?: string[];
  /** Handles of citations referring to this object. */
  citation?: string[];
  /** Handles of media items referring to this object. */
  media?: string[];
  [key: string]: any;
};
export type MediaProfile = {
  /** Date of the media item as a formatted string. */
  date?: string;
  /** Alternate user-managed identifier for the media object. */
  gramps_id?: string;
  /** References to this media item from other objects. */
  references?: {
    [key: string]: any;
  };
  [key: string]: any;
};
export type MediaRead = {
  /** Object class name; must be 'Media'. */
  _class?: string;
  /** Attributes of the media object. */
  attribute_list?: Attribute[];
  /** Objects referring to this media item, grouped by type. */
  backlinks?: Backlinks;
  /** Unix timestamp of the last modification. */
  change?: number;
  /** Checksum for file integrity validation. */
  checksum?: string;
  /** Handles of citations supporting this media object. */
  citation_list?: string[];
  /** Date associated with the media object. */
  date?: Date;
  /** Description of the media object content. */
  desc?: string;
  /** Optional extended section with full referenced records. */
  extended?: any;
  /** Alternate user-managed identifier. */
  gramps_id?: string;
  /** Unique handle for the media object. */
  handle?: string;
  /** MIME type of the file (e.g. 'image/jpeg'). */
  mime?: string;
  /** Handles of research notes related to this media object. */
  note_list?: string[];
  /** Storage path to locate the media file. */
  path?: string;
  /** Private object indicator. */
  private?: boolean;
  /** Optional summary of media information. */
  profile?: MediaProfile;
  /** Handles of tags attached to this media object. */
  tag_list?: string[];
  [key: string]: any;
};
export type ObjectQueryResponse = {
  /** Matching rows, each containing exactly the requested `select` columns. */
  items?: {
    [key: string]: any;
  }[];
  /** Cursor to pass as `after` to fetch the next page, or null if this was the last page. */
  next_after?: string | null;
  [key: string]: any;
};
export type QueryExistsPayloadArgs = {
  /** A registered collection name on the enclosing condition's own object type, e.g. 'notes', 'children', 'backlinks' -- the same names `where_expr`'s `exists(...)`/`count(...)` accept. */
  relationship: string;
  /** Condition narrowing which related rows count, evaluated against the collection's own target type -- the same shape as the outer 'where'. Omitted entirely means 'at least one related row at all,' with no further condition. */
  where?: QueryWhereConditionArgs[];
};
export type QueryWhereConditionArgs = {
  /** Column to compare: either a plain column name (e.g. 'gramps_id'), or {'json_path': [...]} for a path, e.g. {'json_path': ['primary_name', 'first_name']}. A path may cross a relationship (Family->Person, Person->Event, Event->Place, ...), e.g. {'json_path': ['father', 'surname']} or {'json_path': ['birth', 'date', 'sortval']}. A plain string may also be a path ('birth.date.sortval'), not only a flat column name. Required for a leaf condition (one with no 'and'/'or'/'not'/'exists'); not allowed otherwise. */
  column?: any;
  /** Comparison operator: eq, ne, lt, lte, gt, gte, like, regex, contains, or in. Required for a leaf condition; not allowed otherwise. */
  op?:
    | "in"
    | "ne"
    | "lt"
    | "eq"
    | "gte"
    | "gt"
    | "contains"
    | "like"
    | "lte"
    | "regex";
  /** Value to compare against. Must be a list when op is 'in'. Mutually exclusive with 'value_column'; for a leaf condition exactly one is required. */
  value?: any;
  /** Alternative to 'value': compare 'column' against another column/path instead of a literal, e.g. families where the mother died before the father -- column: {'json_path': ['mother', 'death', 'date', 'sortval']}, op: 'lt', value_column: {'json_path': ['father', 'death', 'date', 'sortval']}. Same shape as 'column' (plain name or {'json_path': [...]}). Not supported for 'in'/'like'/'regex'. */
  value_column?: any;
  /** True only if every condition in this list is. */
  and?: QueryWhereConditionArgs[];
  /** True if any condition in this list is. */
  or?: QueryWhereConditionArgs[];
  /** True only if the wrapped condition is false. */
  not?: QueryWhereConditionArgs;
  /** True if at least one row in the named collection (optionally narrowed by 'where') exists -- the JSON-body equivalent of where_expr's exists(relationship[, condition]). */
  exists?: QueryExistsPayloadArgs;
};
export type QueryOrderByArgs = {
  /** Column to sort by: a flat column name ('surname'), or a path ('birth.date.sortval', 'primary_name.surname_list[0].surname'), resolved exactly as the same text is in 'select'. Note the cost: flat columns like 'surname' and 'given_name' are indexed, while nothing indexes inside a record, so sorting by a path reads and parses every row in the tree, and a relationship path ('birth.date.sortval') adds a lookup per row on top. That work repeats for every page. Fine for a result set 'where' has already narrowed; slow as the default order of a large tree. */
  column: string;
  /** Sort direction: 'asc' or 'desc'. */
  direction?: "asc" | "desc";
};
export type QueryBodyArgs = {
  /** Columns to return. Defaults to all available columns. Each entry is either an expression string or a {'json_path': [...]} object, optionally with 'as': '<key>' -- omitted, the response key falls back to the path's own dotted/bracket spelling, same as the expression string form. An expression is a column name ('gramps_id'), a path ('primary_name.surname_list[0].surname'), or count(relationship[, condition]) ('count(events)'), each optionally followed by 'as <key>' to name it in the response, e.g. 'birth.place.title as birthplace' or 'count(events) as n_events'. Without 'as', the response key is the expression's own text. A path may cross a relationship (Family->Person via 'father'/'mother', Person->Event via 'birth'/'death', Event->Place via 'place', Citation->Source via 'source', Place->Place via 'enclosed_by'), e.g. 'father.surname' or 'birth.date' (the full Date struct -- format/calendar/modifier/quality/dateval/text/sortval -- of the referenced event, or null if none is recorded). Every path is checked against Gramps' own schema for the type: an unknown field is a 422 naming the fields that exist, not a column of nulls. The same paths work in 'order_by' -- see there for the cost. */
  select?: any[];
  /** Top-level conditions, implicitly combined with AND (the list itself is never wrapped in an extra 'and'). Each entry is a full condition tree -- a leaf, or an 'and'/'or'/'not'/'exists' combinator nesting further conditions of this same shape -- the JSON-native equivalent of `where_expr` below (same grammar, two wire formats; pick whichever a given client finds easier to construct, a string or a JSON tree). See `QueryWhereConditionArgs`. */
  where?: QueryWhereConditionArgs[];
  /** Alternative to `where`: an "almost Python" expression, e.g. "gender == 1 and primary_name.surname_list[0].surname == 'Smith'". See `query_lang.py`. Mutually exclusive with `where` -- a request setting both is rejected. */
  where_expr?: string | null;
  /** Sort order, most significant column first. */
  order_by?: QueryOrderByArgs[];
  /** Maximum number of rows to return. */
  limit?: number;
  /** Cursor from a previous response's `next_after`, for keyset pagination. Omit for the first page. */
  after?: string | null;
  /** Language code for locale-aware sorting of text columns (e.g. 'de', 'fr'). Affects ORDER BY only, not filtering. */
  locale?: string | null;
  /** If true, also compute the total number of rows matching `where` (and privacy), independent of `limit`/`after`, and return it in the `X-Total-Count` response header (the same convention used elsewhere in this API). Costs a second query, so it's opt-in. */
  count?: boolean;
};
export const {
  useGetMediaObjectQuery,
  useLazyGetMediaObjectQuery,
  usePutMediaObjectMutation,
  useDeleteMediaObjectMutation,
  useGetMediaObjectsQuery,
  useLazyGetMediaObjectsQuery,
  usePostMediaObjectsMutation,
  usePostMediaQueryMutation,
  usePostMergeMediaMutation,
  useGetMediaFileQuery,
  useLazyGetMediaFileQuery,
  usePutMediaFileMutation,
  useGetMediaFaceDetectionQuery,
  useLazyGetMediaFaceDetectionQuery,
  usePostMediaOcrMutation,
  usePostMediaArchiveMutation,
  useGetMediaArchiveFilenameQuery,
  useLazyGetMediaArchiveFilenameQuery,
  usePostMediaArchiveUploadZipMutation,
} = injectedRtkApi;
