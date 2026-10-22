import { api } from "./index";
export const addTagTypes = [
  "Types",
  "Name Formats",
  "Name Groups",
  "Filters",
  "Translations",
  "Facts",
  "Holidays",
  "Metadata",
  "Anniversaries",
  "Config",
  "api",
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getCustomType: build.query<GetCustomTypeApiResponse, GetCustomTypeApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/types/custom/${queryArg.datatype}`,
          }),
          providesTags: ["Types"],
        },
      ),
      getCustomTypes: build.query<
        GetCustomTypesApiResponse,
        GetCustomTypesApiArg
      >({
        query: () => ({ url: `/api/types/custom/` }),
        providesTags: ["Types"],
      }),
      getDefaultTypeMap: build.query<
        GetDefaultTypeMapApiResponse,
        GetDefaultTypeMapApiArg
      >({
        query: (queryArg) => ({
          url: `/api/types/default/${queryArg.datatype}/map`,
        }),
        providesTags: ["Types"],
      }),
      getDefaultType: build.query<
        GetDefaultTypeApiResponse,
        GetDefaultTypeApiArg
      >({
        query: (queryArg) => ({
          url: `/api/types/default/${queryArg.datatype}`,
          params: {
            locale: queryArg.locale,
          },
        }),
        providesTags: ["Types"],
      }),
      getDefaultTypes: build.query<
        GetDefaultTypesApiResponse,
        GetDefaultTypesApiArg
      >({
        query: (queryArg) => ({
          url: `/api/types/default/`,
          params: {
            locale: queryArg.locale,
          },
        }),
        providesTags: ["Types"],
      }),
      getTypes: build.query<GetTypesApiResponse, GetTypesApiArg>({
        query: (queryArg) => ({
          url: `/api/types/`,
          params: {
            locale: queryArg.locale,
          },
        }),
        providesTags: ["Types"],
      }),
      getNameFormats: build.query<
        GetNameFormatsApiResponse,
        GetNameFormatsApiArg
      >({
        query: () => ({ url: `/api/name-formats/` }),
        providesTags: ["Name Formats"],
      }),
      getSetNameGroup: build.query<
        GetSetNameGroupApiResponse,
        GetSetNameGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/api/name-groups/${queryArg.surname}/${queryArg.group}`,
        }),
        providesTags: ["Name Groups"],
      }),
      postSetNameGroup: build.mutation<
        PostSetNameGroupApiResponse,
        PostSetNameGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/api/name-groups/${queryArg.surname}/${queryArg.group}`,
          method: "POST",
        }),
        invalidatesTags: ["Name Groups"],
      }),
      getGetNameGroup: build.query<
        GetGetNameGroupApiResponse,
        GetGetNameGroupApiArg
      >({
        query: (queryArg) => ({ url: `/api/name-groups/${queryArg.surname}` }),
        providesTags: ["Name Groups"],
      }),
      postGetNameGroup: build.mutation<
        PostGetNameGroupApiResponse,
        PostGetNameGroupApiArg
      >({
        query: (queryArg) => ({
          url: `/api/name-groups/${queryArg.surname}`,
          method: "POST",
        }),
        invalidatesTags: ["Name Groups"],
      }),
      getNameGroups: build.query<GetNameGroupsApiResponse, GetNameGroupsApiArg>(
        {
          query: () => ({ url: `/api/name-groups/` }),
          providesTags: ["Name Groups"],
        },
      ),
      postNameGroups: build.mutation<
        PostNameGroupsApiResponse,
        PostNameGroupsApiArg
      >({
        query: () => ({ url: `/api/name-groups/`, method: "POST" }),
        invalidatesTags: ["Name Groups"],
      }),
      getFilter: build.query<GetFilterApiResponse, GetFilterApiArg>({
        query: (queryArg) => ({
          url: `/api/filters/${queryArg["namespace"]}/${queryArg.name}`,
        }),
        providesTags: ["Filters"],
      }),
      deleteFilter: build.mutation<DeleteFilterApiResponse, DeleteFilterApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/filters/${queryArg["namespace"]}/${queryArg.name}`,
            method: "DELETE",
            params: {
              force: queryArg.force,
            },
          }),
          invalidatesTags: ["Filters"],
        },
      ),
      getFiltersNamespace: build.query<
        GetFiltersNamespaceApiResponse,
        GetFiltersNamespaceApiArg
      >({
        query: (queryArg) => ({
          url: `/api/filters/${queryArg["namespace"]}`,
          params: {
            filters: queryArg.filters,
            rules: queryArg.rules,
            locale: queryArg.locale,
          },
        }),
        providesTags: ["Filters"],
      }),
      postFiltersNamespace: build.mutation<
        PostFiltersNamespaceApiResponse,
        PostFiltersNamespaceApiArg
      >({
        query: (queryArg) => ({
          url: `/api/filters/${queryArg["namespace"]}`,
          method: "POST",
          body: queryArg.customFilterCreate,
        }),
        invalidatesTags: ["Filters"],
      }),
      putFiltersNamespace: build.mutation<
        PutFiltersNamespaceApiResponse,
        PutFiltersNamespaceApiArg
      >({
        query: (queryArg) => ({
          url: `/api/filters/${queryArg["namespace"]}`,
          method: "PUT",
          body: queryArg.customFilterCreate,
        }),
        invalidatesTags: ["Filters"],
      }),
      getFilters: build.query<GetFiltersApiResponse, GetFiltersApiArg>({
        query: (queryArg) => ({
          url: `/api/filters/`,
          params: {
            locale: queryArg.locale,
          },
        }),
        providesTags: ["Filters"],
      }),
      getTranslation: build.query<
        GetTranslationApiResponse,
        GetTranslationApiArg
      >({
        query: (queryArg) => ({
          url: `/api/translations/${queryArg.language}`,
          params: {
            strings: queryArg.strings,
          },
        }),
        providesTags: ["Translations"],
      }),
      postTranslation: build.mutation<
        PostTranslationApiResponse,
        PostTranslationApiArg
      >({
        query: (queryArg) => ({
          url: `/api/translations/${queryArg.language}`,
          method: "POST",
          body: queryArg.translationPostArgs,
        }),
        invalidatesTags: ["Translations"],
      }),
      getTranslations: build.query<
        GetTranslationsApiResponse,
        GetTranslationsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/translations/`,
          params: {
            locale: queryArg.locale,
            sort: queryArg.sort,
          },
        }),
        providesTags: ["Translations"],
      }),
      getFacts: build.query<GetFactsApiResponse, GetFactsApiArg>({
        query: (queryArg) => ({
          url: `/api/facts/`,
          params: {
            gramps_id: queryArg.grampsId,
            handle: queryArg.handle,
            living: queryArg.living,
            locale: queryArg.locale,
            person: queryArg.person,
            private: queryArg["private"],
            rank: queryArg.rank,
          },
        }),
        providesTags: ["Facts"],
      }),
      getHoliday: build.query<GetHolidayApiResponse, GetHolidayApiArg>({
        query: (queryArg) => ({
          url: `/api/holidays/${queryArg.country}/${queryArg.year}/${queryArg.month}/${queryArg.day}`,
        }),
        providesTags: ["Holidays"],
      }),
      getHolidays: build.query<GetHolidaysApiResponse, GetHolidaysApiArg>({
        query: () => ({ url: `/api/holidays/` }),
        providesTags: ["Holidays"],
      }),
      getMetadata: build.query<GetMetadataApiResponse, GetMetadataApiArg>({
        query: (queryArg) => ({
          url: `/api/metadata/`,
          params: {
            surnames: queryArg.surnames,
          },
        }),
        providesTags: ["Metadata"],
      }),
      getMetadataResearcher: build.query<
        GetMetadataResearcherApiResponse,
        GetMetadataResearcherApiArg
      >({
        query: () => ({ url: `/api/metadata/researcher/` }),
        providesTags: ["Metadata"],
      }),
      putMetadataResearcher: build.mutation<
        PutMetadataResearcherApiResponse,
        PutMetadataResearcherApiArg
      >({
        query: (queryArg) => ({
          url: `/api/metadata/researcher/`,
          method: "PUT",
          body: queryArg.researcherUpdate,
        }),
        invalidatesTags: ["Metadata"],
      }),
      getMetadataServer: build.query<
        GetMetadataServerApiResponse,
        GetMetadataServerApiArg
      >({
        query: () => ({ url: `/api/metadata/server/` }),
        providesTags: ["Metadata"],
      }),
      getAnniversariesIcs: build.query<
        GetAnniversariesIcsApiResponse,
        GetAnniversariesIcsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/anniversaries.ics`,
          params: {
            token: queryArg.token,
            event_types: queryArg.eventTypes,
            living_only: queryArg.livingOnly,
            primary_participants_only: queryArg.primaryParticipantsOnly,
            anchor_gramps_id: queryArg.anchorGrampsId,
            generation_depth: queryArg.generationDepth,
            filter: queryArg.filter,
            rules: queryArg.rules,
            person_filter: queryArg.personFilter,
            person_rules: queryArg.personRules,
            locale: queryArg.locale,
          },
        }),
        providesTags: ["Anniversaries"],
      }),
      getConfigs: build.query<GetConfigsApiResponse, GetConfigsApiArg>({
        query: () => ({ url: `/api/config/` }),
        providesTags: ["Config"],
      }),
      getConfig: build.query<GetConfigApiResponse, GetConfigApiArg>({
        query: (queryArg) => ({ url: `/api/config/${queryArg.key}/` }),
        providesTags: ["Config"],
      }),
      putConfig: build.mutation<PutConfigApiResponse, PutConfigApiArg>({
        query: (queryArg) => ({
          url: `/api/config/${queryArg.key}/`,
          method: "PUT",
          body: queryArg.configValueArgs,
        }),
        invalidatesTags: ["Config"],
      }),
      deleteConfig: build.mutation<DeleteConfigApiResponse, DeleteConfigApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/config/${queryArg.key}/`,
            method: "DELETE",
          }),
          invalidatesTags: ["Config"],
        },
      ),
      getMediaTile: build.query<GetMediaTileApiResponse, GetMediaTileApiArg>({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.handle}/tile/${queryArg.z}/${queryArg.x}/${queryArg.y}`,
        }),
        providesTags: ["api"],
      }),
      getMediaThumbnail: build.query<
        GetMediaThumbnailApiResponse,
        GetMediaThumbnailApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.handle}/thumbnail/${queryArg.size}`,
        }),
        providesTags: ["api"],
      }),
      getMediaCropped: build.query<
        GetMediaCroppedApiResponse,
        GetMediaCroppedApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.handle}/cropped/${queryArg.x1}/${queryArg.y1}/${queryArg.x2}/${queryArg.y2}`,
        }),
        providesTags: ["api"],
      }),
      getMediaCroppedThumbnail: build.query<
        GetMediaCroppedThumbnailApiResponse,
        GetMediaCroppedThumbnailApiArg
      >({
        query: (queryArg) => ({
          url: `/api/media/${queryArg.handle}/cropped/${queryArg.x1}/${queryArg.y1}/${queryArg.x2}/${queryArg.y2}/thumbnail/${queryArg.size}`,
        }),
        providesTags: ["api"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type GetCustomTypeApiResponse = unknown;
export type GetCustomTypeApiArg = {
  datatype: string;
};
export type GetCustomTypesApiResponse = /** status 200 OK */ CustomTypes;
export type GetCustomTypesApiArg = void;
export type GetDefaultTypeMapApiResponse = /** status 200 OK */ DefaultTypeMap;
export type GetDefaultTypeMapApiArg = {
  datatype: string;
};
export type GetDefaultTypeApiResponse = unknown;
export type GetDefaultTypeApiArg = {
  datatype: string;
  /** If true, return type names translated to the current locale. */
  locale?: boolean;
};
export type GetDefaultTypesApiResponse = /** status 200 OK */ DefaultTypes;
export type GetDefaultTypesApiArg = {
  /** If true, return type names translated to the current locale. */
  locale?: boolean;
};
export type GetTypesApiResponse = /** status 200 OK */ Types;
export type GetTypesApiArg = {
  /** If true, return type names translated to the current locale. */
  locale?: boolean;
};
export type GetNameFormatsApiResponse = /** status 200 OK */ NameFormat[];
export type GetNameFormatsApiArg = void;
export type GetSetNameGroupApiResponse = /** status 200 OK */ NameGroup[];
export type GetSetNameGroupApiArg = {
  surname: string;
  group: string;
};
export type PostSetNameGroupApiResponse = /** status 201 Created */ NameGroup;
export type PostSetNameGroupApiArg = {
  surname: string;
  group: string;
};
export type GetGetNameGroupApiResponse = /** status 200 OK */ NameGroup[];
export type GetGetNameGroupApiArg = {
  surname: string;
};
export type PostGetNameGroupApiResponse = /** status 201 Created */ NameGroup;
export type PostGetNameGroupApiArg = {
  surname: string;
};
export type GetNameGroupsApiResponse = /** status 200 OK */ NameGroup[];
export type GetNameGroupsApiArg = void;
export type PostNameGroupsApiResponse = /** status 201 Created */ NameGroup;
export type PostNameGroupsApiArg = void;
export type GetFilterApiResponse = /** status 200 OK */ CustomFilter;
export type GetFilterApiArg = {
  namespace: string;
  name: string;
};
export type DeleteFilterApiResponse = unknown;
export type DeleteFilterApiArg = {
  namespace: string;
  name: string;
  /** If present (empty string), force-delete the filter and any dependent filters. */
  force?: string;
};
export type GetFiltersNamespaceApiResponse =
  /** status 200 OK */ NamespaceFilters;
export type GetFiltersNamespaceApiArg = {
  namespace: string;
  /** Comma-delimited list of custom filter names to return. */
  filters?: string[];
  /** Comma-delimited list of rule class names to return. */
  rules?: string[];
  /** Language code of the locale to use for the names, descriptions, categories, labels and option labels of rules. Unknown or omitted codes fall back to English. */
  locale?: string | null;
};
export type PostFiltersNamespaceApiResponse = unknown;
export type PostFiltersNamespaceApiArg = {
  namespace: string;
  customFilterCreate: CustomFilterCreate;
};
export type PutFiltersNamespaceApiResponse = unknown;
export type PutFiltersNamespaceApiArg = {
  namespace: string;
  customFilterCreate: CustomFilterCreate;
};
export type GetFiltersApiResponse = /** status 200 OK */ NamespaceFilters;
export type GetFiltersApiArg = {
  /** Language code of the locale to use for the names, descriptions, categories, labels and option labels of rules. Unknown or omitted codes fall back to English. */
  locale?: string | null;
};
export type GetTranslationApiResponse = /** status 200 OK */ Translation[];
export type GetTranslationApiArg = {
  language: string;
  /** The string(s) to translate. */
  strings: string;
};
export type PostTranslationApiResponse = /** status 200 OK */ Translation[];
export type PostTranslationApiArg = {
  language: string;
  translationPostArgs: TranslationPostArgs;
};
export type GetTranslationsApiResponse = /** status 200 OK */ Language[];
export type GetTranslationsApiArg = {
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** Comma-delimited sort keys for the language list. Available: current, default, language, native. Prefix with '-' for descending. */
  sort?: string[];
};
export type GetFactsApiResponse = /** status 200 OK */ RecordFact[];
export type GetFactsApiArg = {
  /** Gramps ID of the person to use as the anchor for built-in person filters. */
  grampsId?: string | null;
  /** Handle of the person to use as the anchor for built-in person filters. Ignored if gramps_id is provided. */
  handle?: string | null;
  /** Built-in proxy controlling how living people are handled. Values: IncludeAll, FullNameOnly, LastNameOnly, ReplaceCompleteName, ExcludeAll. */
  living?:
    | "IncludeAll"
    | "FullNameOnly"
    | "LastNameOnly"
    | "ReplaceCompleteName"
    | "ExcludeAll";
  /** Language code of the locale for translated output. */
  locale?: string | null;
  /** Name of a built-in or custom person filter. Built-in values: Descendants, DescendantFamilies, Ancestors, CommonAncestor. */
  person?: string | null;
  /** If true, exclude records marked as private. */
  private?: boolean;
  /** Number of objects to return for ranked statistics items (default 1). */
  rank?: number;
};
export type GetHolidayApiResponse = /** status 200 OK */ Schema[];
export type GetHolidayApiArg = {
  country: string;
  year: number;
  month: number;
  day: number;
};
export type GetHolidaysApiResponse = /** status 200 OK */ Schema[];
export type GetHolidaysApiArg = void;
export type GetMetadataApiResponse = /** status 200 OK */ Metadata;
export type GetMetadataApiArg = {
  /** If true, include the full list of surnames found in the database. */
  surnames?: boolean;
};
export type GetMetadataResearcherApiResponse = /** status 200 OK */ Researcher;
export type GetMetadataResearcherApiArg = void;
export type PutMetadataResearcherApiResponse = /** status 200 OK */ Researcher;
export type PutMetadataResearcherApiArg = {
  researcherUpdate: ResearcherUpdate;
};
export type GetMetadataServerApiResponse = /** status 200 OK */ MetadataServer;
export type GetMetadataServerApiArg = void;
export type GetAnniversariesIcsApiResponse = /** status 200 OK */ string;
export type GetAnniversariesIcsApiArg = {
  /** Persistent access token value. */
  token: string;
  /** Comma-delimited event type names, matched case-insensitively against Gramps names and translations for the requested locale. Use 'all' by itself to include every event type. */
  eventTypes?: string[];
  /** Include non-death personal events only for living people; personal marriage events are excluded. Include non-death family events only when both spouses are known and living. Death events are not excluded. */
  livingOnly?: boolean;
  /** Exclude secondary participant roles. */
  primaryParticipantsOnly?: boolean;
  /** Anchor person Gramps ID for family-scope filtering. */
  anchorGrampsId?: string;
  /** Generation depth around the anchor person. */
  generationDepth?: number;
  /** Saved Gramps Event filter name. */
  filter?: string;
  /** Gramps Event filter rules as JSON. */
  rules?: string;
  /** Saved Gramps Person filter name. */
  personFilter?: string;
  /** Gramps Person filter rules as JSON. */
  personRules?: string;
  /** Language code used for calendar names and event text. */
  locale?: string | null;
};
export type GetConfigsApiResponse = unknown;
export type GetConfigsApiArg = void;
export type GetConfigApiResponse = unknown;
export type GetConfigApiArg = {
  key: string;
};
export type PutConfigApiResponse = unknown;
export type PutConfigApiArg = {
  key: string;
  configValueArgs: ConfigValueArgs;
};
export type DeleteConfigApiResponse = unknown;
export type DeleteConfigApiArg = {
  key: string;
};
export type GetMediaTileApiResponse = unknown;
export type GetMediaTileApiArg = {
  handle: string;
  z: number;
  x: number;
  y: number;
};
export type GetMediaThumbnailApiResponse = unknown;
export type GetMediaThumbnailApiArg = {
  handle: string;
  size: number;
};
export type GetMediaCroppedApiResponse = unknown;
export type GetMediaCroppedApiArg = {
  handle: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};
export type GetMediaCroppedThumbnailApiResponse = unknown;
export type GetMediaCroppedThumbnailApiArg = {
  handle: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  size: number;
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
export type CustomTypes = {
  [key: string]: any;
};
export type DefaultTypeMap = {
  [key: string]: any;
};
export type DefaultTypes = {
  [key: string]: any;
};
export type Types = {
  /** User-defined custom types. */
  custom?: CustomTypes;
  /** Built-in default types. */
  default?: DefaultTypes;
  [key: string]: any;
};
export type NameFormat = {
  /** Numeric identifier for the name format. */
  number?: number;
  /** Display name of the format. */
  name?: string;
  /** The format string. */
  format?: string;
  /** If true, the format is currently in use. */
  active?: boolean;
};
export type NameGroup = {
  /** The surname to be grouped. */
  surname?: string;
  /** The canonical surname this surname should be grouped with. */
  group?: string;
};
export type FilterRule = {
  /** Name of the filter rule class. */
  name?: string;
  /** Whether text values are treated as regular expressions. */
  regex?: boolean;
  /** Parameter values for the rule. */
  values?: any[];
  [key: string]: any;
};
export type CustomFilter = {
  /** Comment describing the purpose of the filter. */
  comment?: string;
  /** Logical operation: 'and', 'or', or 'one'. */
  function?: string;
  /** Whether the result set is inverted. */
  invert?: boolean;
  /** Name of the custom filter. */
  name?: string;
  /** Rules that make up this filter. */
  rules?: FilterRule[];
  [key: string]: any;
};
export type FilterRuleParamOption = {
  /** Value to pass in the rule's values. */
  value?: string;
  /** Display label of the value, in the requested locale. */
  label?: string;
  [key: string]: any;
};
export type FilterRuleParamType = {
  /** Kind of value: 'text'; 'boolean' ('1' or '0'); 'integer'; 'date' (a Gramps date string); 'datetime' ('YYYY-MM-DD HH:MM:SS', time optional); 'id' (Gramps ID of an object in 'namespace'); 'filter' (name of a custom filter in 'namespace'); 'tag' (tag name); 'select' (one of 'options'); 'gramps_type' (a type from 'default_types' or 'custom_types'); 'goql' (a GOQL expression for the rule's namespace). */
  type?:
    | "text"
    | "boolean"
    | "integer"
    | "date"
    | "datetime"
    | "id"
    | "filter"
    | "tag"
    | "select"
    | "gramps_type"
    | "goql";
  /** Object namespace for types 'id' and 'filter'. */
  namespace?: string;
  /** Minimum value for type 'integer'. */
  min?: number;
  /** Maximum value for type 'integer', if any. */
  max?: number;
  /** Allowed values for type 'select'. */
  options?: FilterRuleParamOption[];
  /** True if the rule defines its own input for this parameter in the Gramps filter editor and the format of its value is unknown. Absent otherwise. */
  custom?: boolean;
  /** For type 'gramps_type': datatype of the /types/default/{datatype} endpoint listing the standard values. */
  default_types?: string;
  /** For type 'gramps_type': datatype of the /types/custom/{datatype} endpoint listing the custom values. */
  custom_types?: string;
  [key: string]: any;
};
export type FilterRuleDescription = {
  /** Category of the filter rule. */
  category?: string;
  /** Long description of what the rule matches. */
  description?: string;
  /** Labels for the rule's parameter fields. */
  labels?: string[];
  /** Display name of the rule. */
  name?: string;
  /** Internal rule class name. */
  rule?: string;
  /** Types of the rule's parameters, one per label. */
  types?: FilterRuleParamType[];
  [key: string]: any;
};
export type NamespaceFilters = {
  /** Custom filters defined for this namespace. */
  filters?: CustomFilter[];
  /** All available built-in filter rules for this namespace. */
  rules?: FilterRuleDescription[];
  [key: string]: any;
};
export type Rule = {
  /** Rule class name (e.g. 'HasTag', 'MatchIdOf'). */
  name: string;
  /** Parameter values for the rule. */
  values?: any[];
  /** If true, treat text values as regular expressions. */
  regex?: boolean;
};
export type CustomFilterCreate = {
  /** Logical operation applied across rules: 'and', 'or', or 'one'. */
  function?: "and" | "or" | "one";
  /** If true, invert the filter result set. */
  invert?: boolean;
  /** If set on a nested sub-filter, evaluate it in this namespace and bridge results back to the parent namespace. Supported bridges: Event→Place, Person→Event, Person→Family, Family→Event, Family→Person, Citation→Source, Source→Repository. */
  namespace?:
    | "Person"
    | "Family"
    | "Event"
    | "Place"
    | "Citation"
    | "Source"
    | "Repository"
    | "Media"
    | "Note";
  /** List of rule specs. */
  rules: Rule[];
  /** Unique name for this custom filter. */
  name: string;
  /** Optional comment describing the purpose of the filter. */
  comment?: string;
};
export type Translation = {
  /** The original (English) string. */
  original?: string;
  /** The translated string. */
  translation?: string;
  [key: string]: any;
};
export type TranslationPostArgs = {
  /** The string(s) to translate. */
  strings: string[];
};
export type Language = {
  /** Language name in the current locale. */
  current?: string;
  /** Language name in the default (English) locale. */
  default?: string;
  /** Language code (e.g. 'bg', 'de'). */
  language?: string;
  /** Language name in its own native locale. */
  native?: string;
  [key: string]: any;
};
export type RecordFactObject = {
  /** Alternate user-managed identifier. */
  gramps_id?: string;
  /** Unique handle for the object. */
  handle?: string;
  /** Description of the object. */
  name?: string;
  /** Object type (e.g. 'Person'). */
  object?: string;
  /** Value supporting the fact. */
  value?: string;
  [key: string]: any;
};
export type RecordFact = {
  /** Human-readable description of the fact. */
  description?: string;
  /** Unique identifier for the fact type. */
  key?: string;
  /** Objects the fact is about. */
  objects?: RecordFactObject[];
  [key: string]: any;
};
export type Schema = {};
export type Deprecation = {
  /** Name of the deprecated configuration option. */
  option?: string;
  /** Name of the option to use instead. */
  replacement?: string;
  /** Human-readable description of the deprecation. */
  message?: string;
  /** Version of Gramps Web API in which the option will stop working. */
  removed_in?: string;
  [key: string]: any;
};
export type ThumbnailSupport = {
  /** Whether thumbnails can be generated for PDF files (requires pdf2image and Poppler). */
  pdf?: boolean;
  /** Whether thumbnails can be generated for video files (requires ffmpeg-python and the ffmpeg binary). */
  video?: boolean;
  [key: string]: any;
};
export type RateLimit = {
  /** Number of requests allowed per time window. */
  amount?: number;
  /** Length of the time window in seconds. */
  window_seconds?: number;
  [key: string]: any;
};
export type Server = {
  /** Whether the server hosts multiple family trees. */
  multi_tree?: boolean;
  /** Whether a task queue is available, so that long-running operations return a task rather than a result. */
  task_queue?: boolean;
  /** Whether OCR of images is available. */
  ocr?: boolean;
  /** Language codes available for OCR. */
  ocr_languages?: string[];
  /** Whether semantic search is available. */
  semantic_search?: boolean;
  /** Whether the AI chat endpoint is available. */
  chat?: boolean;
  /** Whether face detection in images is available (requires OpenCV and NumPy). */
  face_detection?: boolean;
  /** Availability of thumbnailing for file types needing extra dependencies. */
  thumbnails?: ThumbnailSupport;
  /** Whether the server is configured to send e-mails. If false, flows relying on e-mail (such as enabling new users) will not work. */
  email?: boolean;
  /** Configured maximum size of an uploaded media archive in bytes. Absent if no limit is configured. Note that uploads are additionally limited by the free disk space available to the server, so an upload smaller than this value can still be rejected. */
  max_media_archive_upload_bytes?: number;
  /** Maximum size in bytes of a media file for which thumbnails will be generated. Larger files are rejected by the thumbnail endpoints. */
  max_thumbnail_file_bytes?: number;
  /** Whether a backup directory is configured. If false, backups can't be created or stored, only restored from an upload. */
  backups?: boolean;
  /** Rate limits, per user, for creating a media archive for download. All of the limits apply simultaneously. */
  rate_limit_media_archive?: RateLimit[];
  /** Number of stored backups kept per tree. Creating a backup deletes the oldest ones beyond this number. Absent if backups are not configured. */
  backup_keep?: number;
  /** Rate limits, per tree, for creating a backup. All of the limits apply simultaneously. Absent if backups are not configured. */
  rate_limit_backup?: RateLimit[];
  [key: string]: any;
};
export type ObjectCounts = {
  /** Number of citations. */
  citations?: number;
  /** Number of events. */
  events?: number;
  /** Number of families. */
  families?: number;
  /** Number of media objects. */
  media?: number;
  /** Number of notes. */
  notes?: number;
  /** Number of people. */
  people?: number;
  /** Number of places. */
  places?: number;
  /** Number of repositories. */
  repositories?: number;
  /** Number of sources. */
  sources?: number;
  /** Number of tags. */
  tags?: number;
  [key: string]: any;
};
export type Researcher = {
  /** Address. */
  addr?: string;
  /** City. */
  city?: string;
  /** Country. */
  country?: string;
  /** County. */
  county?: string;
  /** Email address. */
  email?: string;
  /** Locality. */
  locality?: string;
  /** Name of the researcher. */
  name?: string;
  /** Phone number. */
  phone?: string;
  /** Postal code. */
  postal?: string;
  /** State. */
  state?: string;
  /** Street address. */
  street?: string;
  [key: string]: any;
};
export type Metadata = {
  /** Deprecated configuration options in use. Only returned for users with permission to view settings, and for tree owners in single-tree deployments. */
  deprecations?: Deprecation[];
  /** Information about the active Gramps installation. */
  gramps?: {
    [key: string]: any;
  };
  /** Information about the Gramps Web API version. */
  gramps_webapi?: {
    [key: string]: any;
  };
  /** Information about the Gramps QL library. */
  gramps_ql?: {
    [key: string]: any;
  };
  /** Information about the Gramps Object Query Language library. */
  gramps_object_query_language?: {
    [key: string]: any;
  };
  /** Information about the yclade library. */
  yclade?: {
    [key: string]: any;
  };
  /** Information about the active locale. */
  locale?: {
    [key: string]: any;
  };
  /** Information about server capabilities. */
  server?: Server;
  /** Information about the active database. */
  database?: {
    [key: string]: any;
  };
  /** Handle of the default person. */
  default_person?: string;
  /** Counts of primary object types. */
  object_counts?: ObjectCounts;
  /** Information about the primary researcher. */
  researcher?: Researcher;
  /** Information about search-related libraries. */
  search?: {
    [key: string]: any;
  };
  /** All surnames found in the database (when requested). */
  surnames?: string[];
  [key: string]: any;
};
export type ResearcherUpdate = {
  /** Address. */
  addr?: string;
  /** City. */
  city?: string;
  /** Country. */
  country?: string;
  /** County. */
  county?: string;
  /** Email address. */
  email?: string;
  /** Locality. */
  locality?: string;
  /** Name of the researcher. */
  name?: string;
  /** Phone number. */
  phone?: string;
  /** Postal code. */
  postal?: string;
  /** State. */
  state?: string;
  /** Street address. */
  street?: string;
};
export type MetadataServer = {
  /** Deprecated configuration options in use. Only returned for users with permission to view settings, and for tree owners in single-tree deployments. */
  deprecations?: Deprecation[];
  /** Information about the active Gramps installation. */
  gramps?: {
    [key: string]: any;
  };
  /** Information about the Gramps Web API version. */
  gramps_webapi?: {
    [key: string]: any;
  };
  /** Information about the Gramps QL library. */
  gramps_ql?: {
    [key: string]: any;
  };
  /** Information about the Gramps Object Query Language library. */
  gramps_object_query_language?: {
    [key: string]: any;
  };
  /** Information about the yclade library. */
  yclade?: {
    [key: string]: any;
  };
  /** Information about the active locale. */
  locale?: {
    [key: string]: any;
  };
  /** Information about server capabilities. */
  server?: Server;
  [key: string]: any;
};
export type ConfigValueArgs = {
  /** The new value for the configuration setting. */
  value: string;
};
export const {
  useGetCustomTypeQuery,
  useLazyGetCustomTypeQuery,
  useGetCustomTypesQuery,
  useLazyGetCustomTypesQuery,
  useGetDefaultTypeMapQuery,
  useLazyGetDefaultTypeMapQuery,
  useGetDefaultTypeQuery,
  useLazyGetDefaultTypeQuery,
  useGetDefaultTypesQuery,
  useLazyGetDefaultTypesQuery,
  useGetTypesQuery,
  useLazyGetTypesQuery,
  useGetNameFormatsQuery,
  useLazyGetNameFormatsQuery,
  useGetSetNameGroupQuery,
  useLazyGetSetNameGroupQuery,
  usePostSetNameGroupMutation,
  useGetGetNameGroupQuery,
  useLazyGetGetNameGroupQuery,
  usePostGetNameGroupMutation,
  useGetNameGroupsQuery,
  useLazyGetNameGroupsQuery,
  usePostNameGroupsMutation,
  useGetFilterQuery,
  useLazyGetFilterQuery,
  useDeleteFilterMutation,
  useGetFiltersNamespaceQuery,
  useLazyGetFiltersNamespaceQuery,
  usePostFiltersNamespaceMutation,
  usePutFiltersNamespaceMutation,
  useGetFiltersQuery,
  useLazyGetFiltersQuery,
  useGetTranslationQuery,
  useLazyGetTranslationQuery,
  usePostTranslationMutation,
  useGetTranslationsQuery,
  useLazyGetTranslationsQuery,
  useGetFactsQuery,
  useLazyGetFactsQuery,
  useGetHolidayQuery,
  useLazyGetHolidayQuery,
  useGetHolidaysQuery,
  useLazyGetHolidaysQuery,
  useGetMetadataQuery,
  useLazyGetMetadataQuery,
  useGetMetadataResearcherQuery,
  useLazyGetMetadataResearcherQuery,
  usePutMetadataResearcherMutation,
  useGetMetadataServerQuery,
  useLazyGetMetadataServerQuery,
  useGetAnniversariesIcsQuery,
  useLazyGetAnniversariesIcsQuery,
  useGetConfigsQuery,
  useLazyGetConfigsQuery,
  useGetConfigQuery,
  useLazyGetConfigQuery,
  usePutConfigMutation,
  useDeleteConfigMutation,
  useGetMediaTileQuery,
  useLazyGetMediaTileQuery,
  useGetMediaThumbnailQuery,
  useLazyGetMediaThumbnailQuery,
  useGetMediaCroppedQuery,
  useLazyGetMediaCroppedQuery,
  useGetMediaCroppedThumbnailQuery,
  useLazyGetMediaCroppedThumbnailQuery,
} = injectedRtkApi;
