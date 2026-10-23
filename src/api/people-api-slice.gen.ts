import { api } from "./index";
export const addTagTypes = [
  "Timeline",
  "People",
  "DNA",
  "Relations",
  "Living",
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getPersonTimeline: build.query<
        GetPersonTimelineApiResponse,
        GetPersonTimelineApiArg
      >({
        query: (queryArg) => ({
          url: `/api/people/${queryArg.handle}/timeline`,
          params: {
            ancestors: queryArg.ancestors,
            dates: queryArg.dates,
            discard_empty: queryArg.discardEmpty,
            event_classes: queryArg.eventClasses,
            events: queryArg.events,
            first: queryArg.first,
            keys: queryArg.keys,
            last: queryArg.last,
            locale: queryArg.locale,
            name_format: queryArg.nameFormat,
            offspring: queryArg.offspring,
            omit_anchor: queryArg.omitAnchor,
            page: queryArg.page,
            pagesize: queryArg.pagesize,
            precision: queryArg.precision,
            ratings: queryArg.ratings,
            relative_event_classes: queryArg.relativeEventClasses,
            relative_events: queryArg.relativeEvents,
            relatives: queryArg.relatives,
            skipkeys: queryArg.skipkeys,
            strip: queryArg.strip,
          },
        }),
        providesTags: ["Timeline"],
      }),
      getPerson: build.query<GetPersonApiResponse, GetPersonApiArg>({
        query: (queryArg) => ({
          url: `/api/people/${queryArg.handle}`,
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
        providesTags: ["People"],
      }),
      putPerson: build.mutation<PutPersonApiResponse, PutPersonApiArg>({
        query: (queryArg) => ({
          url: `/api/people/${queryArg.handle}`,
          method: "PUT",
          body: queryArg.person,
        }),
        invalidatesTags: ["People"],
      }),
      deletePerson: build.mutation<DeletePersonApiResponse, DeletePersonApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/people/${queryArg.handle}`,
            method: "DELETE",
          }),
          invalidatesTags: ["People"],
        },
      ),
      getPersonDnaMatches: build.query<
        GetPersonDnaMatchesApiResponse,
        GetPersonDnaMatchesApiArg
      >({
        query: (queryArg) => ({
          url: `/api/people/${queryArg.handle}/dna/matches`,
          params: {
            locale: queryArg.locale,
            raw: queryArg.raw,
          },
        }),
        providesTags: ["DNA"],
      }),
      getPersonYdna: build.query<GetPersonYdnaApiResponse, GetPersonYdnaApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/people/${queryArg.handle}/ydna`,
            params: {
              locale: queryArg.locale,
              raw: queryArg.raw,
            },
          }),
          providesTags: ["DNA"],
        },
      ),
      getPeople: build.query<GetPeopleApiResponse, GetPeopleApiArg>({
        query: (queryArg) => ({
          url: `/api/people/`,
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
        providesTags: ["People"],
      }),
      postPeople: build.mutation<PostPeopleApiResponse, PostPeopleApiArg>({
        query: (queryArg) => ({
          url: `/api/people/`,
          method: "POST",
          body: queryArg.person,
        }),
        invalidatesTags: ["People"],
      }),
      postPeopleQuery: build.mutation<
        PostPeopleQueryApiResponse,
        PostPeopleQueryApiArg
      >({
        query: (queryArg) => ({
          url: `/api/people/query/`,
          method: "POST",
          body: queryArg.queryBodyArgs,
        }),
        invalidatesTags: ["People"],
      }),
      postMergePerson: build.mutation<
        PostMergePersonApiResponse,
        PostMergePersonApiArg
      >({
        query: (queryArg) => ({
          url: `/api/people/${queryArg.phoenixHandle}/merge/${queryArg.titanicHandle}`,
          method: "POST",
          body: queryArg.personMergeArgs,
        }),
        invalidatesTags: ["People"],
      }),
      getFamilyTimeline: build.query<
        GetFamilyTimelineApiResponse,
        GetFamilyTimelineApiArg
      >({
        query: (queryArg) => ({
          url: `/api/families/${queryArg.handle}/timeline`,
          params: {
            dates: queryArg.dates,
            discard_empty: queryArg.discardEmpty,
            event_classes: queryArg.eventClasses,
            events: queryArg.events,
            keys: queryArg.keys,
            locale: queryArg.locale,
            name_format: queryArg.nameFormat,
            page: queryArg.page,
            pagesize: queryArg.pagesize,
            ratings: queryArg.ratings,
            skipkeys: queryArg.skipkeys,
            strip: queryArg.strip,
          },
        }),
        providesTags: ["Timeline"],
      }),
      getTimelinePeople: build.query<
        GetTimelinePeopleApiResponse,
        GetTimelinePeopleApiArg
      >({
        query: (queryArg) => ({
          url: `/api/timelines/people/`,
          params: {
            anchor: queryArg.anchor,
            dates: queryArg.dates,
            discard_empty: queryArg.discardEmpty,
            event_classes: queryArg.eventClasses,
            events: queryArg.events,
            filter: queryArg.filter,
            first: queryArg.first,
            handles: queryArg.handles,
            keys: queryArg.keys,
            last: queryArg.last,
            locale: queryArg.locale,
            omit_anchor: queryArg.omitAnchor,
            page: queryArg.page,
            pagesize: queryArg.pagesize,
            precision: queryArg.precision,
            ratings: queryArg.ratings,
            rules: queryArg.rules,
            skipkeys: queryArg.skipkeys,
            strip: queryArg.strip,
          },
        }),
        providesTags: ["Timeline"],
      }),
      getTimelineFamilies: build.query<
        GetTimelineFamiliesApiResponse,
        GetTimelineFamiliesApiArg
      >({
        query: (queryArg) => ({
          url: `/api/timelines/families/`,
          params: {
            dates: queryArg.dates,
            discard_empty: queryArg.discardEmpty,
            event_classes: queryArg.eventClasses,
            events: queryArg.events,
            filter: queryArg.filter,
            keys: queryArg.keys,
            handles: queryArg.handles,
            locale: queryArg.locale,
            page: queryArg.page,
            pagesize: queryArg.pagesize,
            ratings: queryArg.ratings,
            rules: queryArg.rules,
            skipkeys: queryArg.skipkeys,
            strip: queryArg.strip,
          },
        }),
        providesTags: ["Timeline"],
      }),
      postDnaMatchParser: build.query<
        PostDnaMatchParserApiResponse,
        PostDnaMatchParserApiArg
      >({
        query: (queryArg) => ({
          url: `/api/parsers/dna-match`,
          method: "POST",
          body: queryArg.dnaMatchParserBodyArgs,
        }),
        providesTags: ["DNA"],
      }),
      getRelation: build.query<GetRelationApiResponse, GetRelationApiArg>({
        query: (queryArg) => ({
          url: `/api/relations/${queryArg.handle1}/${queryArg.handle2}`,
          params: {
            depth: queryArg.depth,
            locale: queryArg.locale,
          },
        }),
        providesTags: ["Relations"],
      }),
      getRelations: build.query<GetRelationsApiResponse, GetRelationsApiArg>({
        query: (queryArg) => ({
          url: `/api/relations/${queryArg.handle1}/${queryArg.handle2}/all`,
          params: {
            depth: queryArg.depth,
            locale: queryArg.locale,
          },
        }),
        providesTags: ["Relations"],
      }),
      getLivingDates: build.query<
        GetLivingDatesApiResponse,
        GetLivingDatesApiArg
      >({
        query: (queryArg) => ({
          url: `/api/living/${queryArg.handle}/dates`,
          params: {
            average_generation_gap: queryArg.averageGenerationGap,
            locale: queryArg.locale,
            max_age_probably_alive: queryArg.maxAgeProbablyAlive,
            max_sibling_age_difference: queryArg.maxSiblingAgeDifference,
          },
        }),
        providesTags: ["Living"],
      }),
      getLiving: build.query<GetLivingApiResponse, GetLivingApiArg>({
        query: (queryArg) => ({
          url: `/api/living/${queryArg.handle}`,
          params: {
            average_generation_gap: queryArg.averageGenerationGap,
            max_age_probably_alive: queryArg.maxAgeProbablyAlive,
            max_sibling_age_difference: queryArg.maxSiblingAgeDifference,
          },
        }),
        providesTags: ["Living"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type GetPersonTimelineApiResponse =
  /** status 200 OK */ TimelineEventProfile[];
export type GetPersonTimelineApiArg = {
  handle: string;
  /** Number of ancestor generations to include (default 1, max 5). */
  ancestors?: number;
  /** Date range filter. Formats: '-y/m/d' (before), 'y/m/d-' (after), 'y/m/d-y/m/d' (range). Components may use '*' as wildcard. */
  dates?: string | null;
  /** If true (default), discard undated events from the timeline. */
  discardEmpty?: boolean;
  /** Comma-delimited list of event class keywords to include: vital, family, religious, vocational, academic, travel, legal, residence, other, custom. */
  eventClasses?: string[];
  /** Comma-delimited list of specific event type names to include. Birth and death are always included. */
  events?: string[];
  /** If true, discard events before the person's first recorded event. */
  first?: boolean;
  /** Comma-delimited list of top-level keys to return; all others are omitted. */
  keys?: string[];
  /** If true, discard events after the person's last recorded event. */
  last?: boolean;
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** Format string for name display (see gramps.gen.display.name for syntax). */
  nameFormat?: string;
  /** Number of offspring generations to include (default 1, max 5). */
  offspring?: number;
  /** If true (default), omit the anchor person's own data from relative-event entries. */
  omitAnchor?: boolean;
  /** Page number of the result subset to return. If omitted, all results are returned. */
  page?: number;
  /** Number of items per page when pagination is active. */
  pagesize?: number;
  /** Number of significant time components in date strings: 1=year only, 2=year+month, 3=year+month+day. */
  precision?: number;
  /** If true, include total citation count and highest confidence score. */
  ratings?: boolean;
  /** Comma-delimited list of event class keywords to include for relatives. */
  relativeEventClasses?: string[];
  /** Comma-delimited list of event type names to include for relatives. */
  relativeEvents?: string[];
  /** Comma-delimited list of relationship types: father, mother, brother, sister, wife, husband, son, daughter. */
  relatives?: string[];
  /** Comma-delimited list of top-level keys to omit from the response; all others are kept. */
  skipkeys?: string[];
  /** If true, strip keys with empty values from the response. */
  strip?: boolean;
};
export type GetPersonApiResponse = /** status 200 OK */ Schema;
export type GetPersonApiArg = {
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
export type PutPersonApiResponse = unknown;
export type PutPersonApiArg = {
  handle: string;
  /** The Person object to store. The `_class` field is optional; if present it must be `Person`. */
  person: Person;
};
export type DeletePersonApiResponse = unknown;
export type DeletePersonApiArg = {
  handle: string;
};
export type GetPersonDnaMatchesApiResponse = /** status 200 OK */ DnaMatch[];
export type GetPersonDnaMatchesApiArg = {
  handle: string;
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** If true, include the raw segment data strings in the response. */
  raw?: boolean;
};
export type GetPersonYdnaApiResponse = /** status 200 OK */ YDnaResponse;
export type GetPersonYdnaApiArg = {
  handle: string;
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** If true, include the raw Y-chromosome SNP data in the response. */
  raw?: boolean;
};
export type GetPeopleApiResponse = /** status 200 OK */ Schema[];
export type GetPeopleApiArg = {
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
export type PostPeopleApiResponse = /** status 201 Created */ Schema[];
export type PostPeopleApiArg = {
  /** The Person object to store. The `_class` field is optional; if present it must be `Person`. */
  person: Person;
};
export type PostPeopleQueryApiResponse =
  /** status 200 OK */ ObjectQueryResponse;
export type PostPeopleQueryApiArg = {
  queryBodyArgs: QueryBodyArgs;
};
export type PostMergePersonApiResponse = /** status 200 OK */ Schema;
export type PostMergePersonApiArg = {
  phoenixHandle: string;
  titanicHandle: string;
  personMergeArgs: PersonMergeArgs;
};
export type GetFamilyTimelineApiResponse =
  /** status 200 OK */ TimelineEventProfile[];
export type GetFamilyTimelineApiArg = {
  handle: string;
  /** Date range filter. Formats: '-y/m/d' (before), 'y/m/d-' (after), 'y/m/d-y/m/d' (range). Components may use '*' as wildcard. */
  dates?: string | null;
  /** If true (default), discard undated events from the timeline. */
  discardEmpty?: boolean;
  /** Comma-delimited list of event class keywords to include: vital, family, religious, vocational, academic, travel, legal, residence, other, custom. */
  eventClasses?: string[];
  /** Comma-delimited list of specific event type names to include. Birth and death are always included. */
  events?: string[];
  /** Comma-delimited list of top-level keys to return; all others are omitted. */
  keys?: string[];
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** Format string for name display (see gramps.gen.display.name for syntax). */
  nameFormat?: string;
  /** Page number of the result subset to return. If omitted, all results are returned. */
  page?: number;
  /** Number of items per page when pagination is active. */
  pagesize?: number;
  /** If true, include total citation count and highest confidence score. */
  ratings?: boolean;
  /** Comma-delimited list of top-level keys to omit from the response; all others are kept. */
  skipkeys?: string[];
  /** If true, strip keys with empty values from the response. */
  strip?: boolean;
};
export type GetTimelinePeopleApiResponse =
  /** status 200 OK */ TimelineEventProfile[];
export type GetTimelinePeopleApiArg = {
  /** Handle of the central person; all other timeline persons are treated as their relatives. */
  anchor?: string;
  /** Date range filter. Formats: '-y/m/d' (before), 'y/m/d-' (after), 'y/m/d-y/m/d' (range). Components may use '*' as wildcard. */
  dates?: string | null;
  /** If true (default), discard undated events from the timeline. */
  discardEmpty?: boolean;
  /** Comma-delimited list of event class keywords to include: vital, family, religious, vocational, academic, travel, legal, residence, other, custom. */
  eventClasses?: string[];
  /** Comma-delimited list of specific event type names to include. Birth and death are always included. */
  events?: string[];
  /** Name of an existing custom filter to apply. */
  filter?: string;
  /** If true, discard events before the person's first recorded event. */
  first?: boolean;
  /** Comma-delimited list of specific person or family handles to include in the timeline. */
  handles?: string[];
  /** Comma-delimited list of top-level keys to return; all others are omitted. */
  keys?: string[];
  /** If true, discard events after the person's last recorded event. */
  last?: boolean;
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** If true (default), omit the anchor person's own data from relative-event entries. */
  omitAnchor?: boolean;
  /** Page number of the result subset to return. If omitted, all results are returned. */
  page?: number;
  /** Number of items per page when pagination is active. */
  pagesize?: number;
  /** Number of significant time components in date strings: 1=year only, 2=year+month, 3=year+month+day. */
  precision?: number;
  /** If true, include total citation count and highest confidence score. */
  ratings?: boolean;
  /** Inline filter expression as JSON: {"function": "and"|"or"|"one", "invert": bool, "rules": [{"name": str, "values": [...], "regex": bool}]}. */
  rules?: string;
  /** Comma-delimited list of top-level keys to omit from the response; all others are kept. */
  skipkeys?: string[];
  /** If true, strip keys with empty values from the response. */
  strip?: boolean;
};
export type GetTimelineFamiliesApiResponse =
  /** status 200 OK */ TimelineEventProfile[];
export type GetTimelineFamiliesApiArg = {
  /** Date range filter. Formats: '-y/m/d' (before), 'y/m/d-' (after), 'y/m/d-y/m/d' (range). Components may use '*' as wildcard. */
  dates?: string | null;
  /** If true (default), discard undated events from the timeline. */
  discardEmpty?: boolean;
  /** Comma-delimited list of event class keywords to include: vital, family, religious, vocational, academic, travel, legal, residence, other, custom. */
  eventClasses?: string[];
  /** Comma-delimited list of specific event type names to include. Birth and death are always included. */
  events?: string[];
  /** Name of an existing custom filter to apply. */
  filter?: string;
  /** Comma-delimited list of top-level keys to return; all others are omitted. */
  keys?: string[];
  /** Comma-delimited list of specific person or family handles to include in the timeline. */
  handles?: string[];
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** Page number of the result subset to return. If omitted, all results are returned. */
  page?: number;
  /** Number of items per page when pagination is active. */
  pagesize?: number;
  /** If true, include total citation count and highest confidence score. */
  ratings?: boolean;
  /** Inline filter expression as JSON: {"function": "and"|"or"|"one", "invert": bool, "rules": [{"name": str, "values": [...], "regex": bool}]}. */
  rules?: string;
  /** Comma-delimited list of top-level keys to omit from the response; all others are kept. */
  skipkeys?: string[];
  /** If true, strip keys with empty values from the response. */
  strip?: boolean;
};
export type PostDnaMatchParserApiResponse = /** status 200 OK */ DnaSegment[];
export type PostDnaMatchParserApiArg = {
  dnaMatchParserBodyArgs: DnaMatchParserBodyArgs;
};
export type GetRelationApiResponse = /** status 200 OK */ Relationship;
export type GetRelationApiArg = {
  handle1: string;
  handle2: string;
  /** Maximum number of generations to search for a common ancestor (default 15). */
  depth?: number;
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
};
export type GetRelationsApiResponse = /** status 200 OK */ RelationshipItem[];
export type GetRelationsApiArg = {
  handle1: string;
  handle2: string;
  /** Maximum number of generations to search for a common ancestor (default 15). */
  depth?: number;
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
};
export type GetLivingDatesApiResponse = /** status 200 OK */ LivingDatesRead;
export type GetLivingDatesApiArg = {
  handle: string;
  /** Average number of years between generations (default 20). */
  averageGenerationGap?: number | null;
  /** Language code of the locale to use where applicable. Must be a valid code from the available translations. */
  locale?: string | null;
  /** Maximum age in years at which a person could still be considered alive (default 110). */
  maxAgeProbablyAlive?: number | null;
  /** Maximum age difference in years between the youngest and oldest sibling (default 20). */
  maxSiblingAgeDifference?: number | null;
};
export type GetLivingApiResponse = /** status 200 OK */ Living;
export type GetLivingApiArg = {
  handle: string;
  /** Average number of years between generations (default 20). */
  averageGenerationGap?: number | null;
  /** Maximum age in years at which a person could still be considered alive (default 110). */
  maxAgeProbablyAlive?: number | null;
  /** Maximum age difference in years between the youngest and oldest sibling (default 20). */
  maxSiblingAgeDifference?: number | null;
};
export type EventProfile = {
  /** Total number of citations supporting this event. */
  citations?: number;
  /** Highest confidence rating among the supporting citations. */
  confidence?: number;
  /** Date of the event as a formatted string. */
  date?: string;
  /** Name of the place where the event occurred. */
  place?: string;
  /** Short name of the event place. */
  place_name?: string;
  /** Type of the event (e.g. 'Birth', 'Death'). */
  type?: string;
  /** People and families participating in this event. */
  participants?: {
    [key: string]: any;
  };
  /** References to this event from other objects. */
  references?: {
    [key: string]: any;
  };
  [key: string]: any;
};
export type TimelinePersonProfile = {
  /** Age of the person at the time of the event. */
  age?: string;
  /** Birth event profile. */
  birth?: EventProfile;
  /** Death event profile. */
  death?: EventProfile;
  /** Alternate user-managed identifier for the person. */
  gramps_id?: string;
  /** Unique handle for the person. */
  handle?: string;
  /** Full display name. */
  name_display?: string;
  /** Given (first) name. */
  name_given?: string;
  /** Surname. */
  name_surname?: string;
  /** Name suffix. */
  name_suffix?: string;
  /** Relationship to the anchor person. */
  relationship?: string;
  /** Sex identifier ('M', 'F', 'X', or 'U'). */
  sex?: string;
  [key: string]: any;
};
export type PlaceProfile = {
  /** Alternate names of the place. */
  alternate_names?: string[];
  /** Alternate names with associated dates. */
  alternate_place_names?: any[];
  /** Alternate user-managed identifier for the place. */
  gramps_id?: string;
  /** Geographic latitude. */
  lat?: number;
  /** Geographic longitude. */
  long?: number;
  /** Place title. */
  name?: string;
  /** List of parent place profiles. */
  parent_places?: PlaceProfile[];
  /** Direct parent places with corresponding dates. */
  direct_parent_places?: any[];
  /** References to this place from other objects. */
  references?: {
    [key: string]: any;
  };
  [key: string]: any;
};
export type TimelineEventProfile = {
  /** Age of the anchor person at the time of the event. */
  age?: string;
  /** Total number of supporting citations. */
  citations?: number;
  /** Highest confidence rating among citations. */
  confidence?: number;
  /** Date of the event as a formatted string. */
  date?: string;
  /** Description of the event. */
  description?: string;
  /** Alternate user-managed identifier for the event. */
  gramps_id?: string;
  /** Unique handle for the event. */
  handle?: string;
  /** Generated label accounting for the relationship (e.g. 'Birth of Stepsister'). */
  label?: string;
  /** Handles of media items for this event. */
  media?: string[];
  /** Profile of the person associated with this event. */
  person?: TimelinePersonProfile;
  /** Profile of the place where the event occurred. */
  place?: PlaceProfile;
  /** Type of the event. */
  type?: string;
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
export type Schema = {};
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
export type Address = {
  /** Handles of citations supporting this address. */
  citation_list?: string[];
  /** City. */
  city?: string;
  /** Country. */
  country?: string;
  /** County. */
  county?: string;
  /** Date the person resided at this address. */
  date?: Date;
  /** Locality. */
  locality?: string;
  /** Handles of research notes about this address. */
  note_list?: string[];
  /** Phone number. */
  phone?: string;
  /** Postal code. */
  postal?: string;
  /** Private object indicator. */
  private?: boolean;
  /** State. */
  state?: string;
  /** Street address. */
  street?: string;
  [key: string]: any;
};
export type Surname = {
  /** Connector word between given name and surname. */
  connector?: string;
  /** Name origin type (e.g. 'Inherited'). */
  origintype?: string;
  /** Surname prefix (e.g. 'von', 'de'). */
  prefix?: string;
  /** Whether this is the primary surname. */
  primary?: boolean;
  /** The surname text. */
  surname?: string;
  [key: string]: any;
};
export type Name = {
  /** Call name (the name by which the person is known). */
  call?: string;
  /** Handles of citations supporting this name. */
  citation_list?: string[];
  /** Period during which this name was in use. */
  date?: Date;
  /** Identifier for how to display the name. */
  display_as?: number;
  /** Family nickname. */
  famnick?: string;
  /** Given (first) name. */
  first_name?: string;
  /** Override for grouping this name. */
  group_as?: string;
  /** Nickname. */
  nick?: string;
  /** Handles of research notes about this name. */
  note_list?: string[];
  /** Private object indicator. */
  private?: boolean;
  /** Identifier for how to sort the name. */
  sort_as?: number;
  /** Name suffix (e.g. 'Sr', 'Jr'). */
  suffix?: string;
  /** List of surname components. */
  surname_list?: Surname[];
  /** Name title or prefix (e.g. 'Dr.', 'Rev.'). */
  title?: string;
  /** Type of name (e.g. 'Birth Name', 'Also Known As'). */
  type?: string;
  [key: string]: any;
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
export type EventReference = {
  /** Attributes related to the person's role in the event. */
  attribute_list?: Attribute[];
  /** Handles of research notes about this participation. */
  note_list?: string[];
  /** Private object indicator. */
  private?: boolean;
  /** Handle of the referenced event. */
  ref?: string;
  /** Role of the person or family in the event. */
  role?: string;
  [key: string]: any;
};
export type LdsOrdination = {
  /** Handles of citations supporting this LDS event. */
  citation_list?: string[];
  /** Date of the ordinance. */
  date?: Date;
  /** Handle of the family associated with this ordinance. */
  famc?: string;
  /** Handles of research notes about this ordinance. */
  note_list?: string[];
  /** Handle of the place where the ordinance was performed. */
  place?: string;
  /** Private object indicator. */
  private?: boolean;
  /** Status code of the ordinance. */
  status?: number;
  /** Temple where the ordinance was performed. */
  temple?: string;
  /** Type code of the ordinance. */
  type?: number;
  [key: string]: any;
};
export type MediaReference = {
  /** Attributes related to this media reference. */
  attribute_list?: Attribute[];
  /** Handles of citations supporting this media reference. */
  citation_list?: string[];
  /** Handles of research notes about this media reference. */
  note_list?: string[];
  /** Private object indicator. */
  private?: boolean;
  /** Crop rectangle [left, top, right, bottom] as percentages. */
  rect?: number[];
  /** Handle of the referenced media object. */
  ref?: string;
  [key: string]: any;
};
export type PersonReference = {
  /** Handles of citations supporting this association. */
  citation_list?: string[];
  /** Handles of research notes about this association. */
  note_list?: string[];
  /** Private object indicator. */
  private?: boolean;
  /** Handle of the referenced person. */
  ref?: string;
  /** Relationship type between the two people. */
  rel?: string;
  [key: string]: any;
};
export type Url = {
  /** Description of the URL. */
  desc?: string;
  /** The URL itself. */
  path?: string;
  /** Private object indicator. */
  private?: boolean;
  /** Type of URL (e.g. 'Web Home'). */
  type?: string;
  [key: string]: any;
};
export type Person = {
  /** Object class name; must be 'Person'. */
  _class?: string;
  /** Addresses associated with this person. */
  address_list?: Address[];
  /** Alternate names used by this person. */
  alternate_names?: Name[];
  /** Attributes about this person. */
  attribute_list?: Attribute[];
  /** Index into event_ref_list for the birth event, or -1. */
  birth_ref_index?: number;
  /** Unix timestamp of the last modification. */
  change?: number;
  /** Handles of citations supporting this person. */
  citation_list?: string[];
  /** Index into event_ref_list for the death event, or -1. */
  death_ref_index?: number;
  /** References to events this person participated in. */
  event_ref_list?: EventReference[];
  /** Handles of families this person is a parent of. */
  family_list?: string[];
  /** Gender code (0=female, 1=male, 2=unknown, 3=other). */
  gender?: number;
  /** Alternate user-managed identifier. */
  gramps_id?: string;
  /** Unique handle for the person. */
  handle?: string;
  /** LDS ordinance events for this person. */
  lds_ord_list?: LdsOrdination[];
  /** Media references associated with this person. */
  media_list?: MediaReference[];
  /** Handles of research notes related to this person. */
  note_list?: string[];
  /** Handles of families this person is a child of. */
  parent_family_list?: string[];
  /** References to other people this person has a relationship with. */
  person_ref_list?: PersonReference[];
  /** Primary name of this person. */
  primary_name?: Name;
  /** Private object indicator. */
  private?: boolean;
  /** Handles of tags attached to this person. */
  tag_list?: string[];
  /** URLs associated with this person. */
  urls?: Url[];
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
export type AddressProfile = {
  /** Date of the address as a formatted string. */
  date_str?: string;
  [key: string]: any;
};
export type FamilyProfile = {
  /** Profiles of children in the family. */
  children?: PersonProfile[];
  /** Divorce event profile (or best available fallback). */
  divorce?: EventProfile;
  /** All event profiles for this family. */
  events?: EventProfile[];
  /** Surname of the family (from father, or mother if no father). */
  family_surname?: string;
  /** Profile of the father. */
  father?: PersonProfile;
  /** Alternate user-managed identifier for the family. */
  gramps_id?: string;
  /** Unique handle for the family. */
  handle?: string;
  /** Marriage event profile (or best available fallback). */
  marriage?: EventProfile;
  /** Profile of the mother. */
  mother?: PersonProfile;
  /** References to this family from other objects. */
  references?: {
    [key: string]: any;
  };
  /** Type of relationship between the parents. */
  relationship?: string;
  [key: string]: any;
};
export type PersonProfile = {
  /** Addresses with formatted dates, parallel to address_list. */
  addresses?: AddressProfile[];
  /** Birth event profile (or best available fallback). */
  birth?: EventProfile;
  /** Death event profile (or best available fallback). */
  death?: EventProfile;
  /** All event profiles for this person. */
  events?: EventProfile[];
  /** Profiles of families this person is a parent of. */
  families?: FamilyProfile[];
  /** Alternate user-managed identifier for the person. */
  gramps_id?: string;
  /** Unique handle for the person. */
  handle?: string;
  /** Full display name. */
  name_display?: string;
  /** Given (first) name. */
  name_given?: string;
  /** Surname. */
  name_surname?: string;
  /** Name suffix. */
  name_suffix?: string;
  /** Profiles of non-primary parent families. */
  other_parent_families?: FamilyProfile[];
  /** Profile of the primary parent family. */
  primary_parent_family?: FamilyProfile;
  /** References to this person from other objects. */
  references?: {
    [key: string]: any;
  };
  /** Sex of the person ('M', 'F', 'X', or 'U'). */
  sex?: string;
  [key: string]: any;
};
export type PersonRead = {
  /** Object class name; must be 'Person'. */
  _class?: string;
  /** Addresses associated with this person. */
  address_list?: Address[];
  /** Alternate names used by this person. */
  alternate_names?: Name[];
  /** Attributes about this person. */
  attribute_list?: Attribute[];
  /** Objects referring to this person, grouped by type. */
  backlinks?: Backlinks;
  /** Index into event_ref_list for the birth event, or -1. */
  birth_ref_index?: number;
  /** Unix timestamp of the last modification. */
  change?: number;
  /** Handles of citations supporting this person. */
  citation_list?: string[];
  /** Index into event_ref_list for the death event, or -1. */
  death_ref_index?: number;
  /** References to events this person participated in. */
  event_ref_list?: EventReference[];
  /** Optional extended section with full referenced records. */
  extended?: any;
  /** Handles of families this person is a parent of. */
  family_list?: string[];
  /** Gender code (0=female, 1=male, 2=unknown, 3=other). */
  gender?: number;
  /** Alternate user-managed identifier. */
  gramps_id?: string;
  /** Unique handle for the person. */
  handle?: string;
  /** LDS ordinance events for this person. */
  lds_ord_list?: LdsOrdination[];
  /** Media references associated with this person. */
  media_list?: MediaReference[];
  /** Handles of research notes related to this person. */
  note_list?: string[];
  /** Handles of families this person is a child of. */
  parent_family_list?: string[];
  /** References to other people this person has a relationship with. */
  person_ref_list?: PersonReference[];
  /** Primary name of this person. */
  primary_name?: Name;
  /** Private object indicator. */
  private?: boolean;
  /** Optional summary of key biographical information. */
  profile?: PersonProfile;
  /** Handles of tags attached to this person. */
  tag_list?: string[];
  /** URLs associated with this person. */
  urls?: Url[];
  [key: string]: any;
};
export type DnaSegment = {
  /** Chromosome identifier. */
  chromosome?: string;
  /** Start position of the segment. */
  start?: number;
  /** End position of the segment. */
  stop?: number;
  /** Side: 'M' (maternal), 'P' (paternal), or 'U' (unknown). */
  side?: string;
  /** Genetic distance in centiMorgans. */
  cM?: number;
  /** Number of matching SNPs. */
  SNPs?: number;
  /** Optional comment about the segment. */
  comment?: string;
  [key: string]: any;
};
export type DnaMatch = {
  /** Handle of the matching person. */
  handle?: string;
  /** Estimated relationship to the matching person. */
  relation?: string;
  /** Handles of latest common ancestors. */
  ancestor_handles?: string[];
  /** Profiles of latest common ancestors. */
  ancestor_profiles?: PersonProfile[][];
  /** Details of each matching chromosome segment. */
  segments?: DnaSegment[];
  /** Index into the person's person_ref_list for this match. */
  person_ref_idx?: number;
  /** Handles of notes associated with the match's segments. */
  note_handles?: string[];
  /** Raw note strings containing segment data. */
  raw_data?: string[];
  [key: string]: any;
};
export type CladeAgeInfo = {
  /** Estimated years ago the clade was formed. */
  formed?: number | null;
  /** 95% confidence interval [lower, upper] for the formed age. */
  formed_confidence_interval?: number[] | null;
  /** Estimated years ago the most recent common ancestor was born. */
  most_recent_common_ancestor?: number | null;
  /** 95% confidence interval for the most recent common ancestor age. */
  most_recent_common_ancestor_confidence_interval?: number[] | null;
  [key: string]: any;
};
export type CladeInfo = {
  /** Clade ID (e.g. 'BY61636'). */
  name?: string;
  /** Age information for the clade. */
  age_info?: CladeAgeInfo | (object | null);
  /** Match score for this clade. */
  score?: number | null;
  [key: string]: any;
};
export type YDnaResponse = {
  /** Ordered list of Y-DNA haplogroup clade assignments, from broadest to most specific. */
  clade_lineage?: CladeInfo[];
  /** Version of the YFull tree used for clade assignment. */
  tree_version?: string;
  /** Raw Y-DNA SNP data string. Only present if raw=true was requested. */
  raw_data?: string;
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
export type PersonMergeArgs = {
  /** If true (default), merge duplicate spouse/parent families that result from merging the two persons. */
  family_merger?: boolean;
};
export type DnaMatchParserBodyArgs = {
  /** The raw DNA match data string to parse. */
  string: string;
};
export type Relationship = {
  /** Human-readable relationship description. */
  relationship_string?: string;
  /** Generations from person 1 to the common ancestor (-1 if none). */
  distance_common_origin?: number;
  /** Generations from person 2 to the common ancestor (-1 if none). */
  distance_common_other?: number;
  [key: string]: any;
};
export type RelationshipItem = {
  /** Human-readable relationship description. */
  relationship_string?: string;
  /** Handles of common ancestors. */
  common_ancestors?: string[];
  [key: string]: any;
};
export type LivingDates = {
  /** Estimated birth date. */
  birth?: string;
  /** Estimated death date. */
  death?: string;
  /** Explanation of how the dates were determined. */
  explain?: string;
  /** Related person record used in the estimation. */
  other?: Person;
  [key: string]: any;
};
export type LivingDatesRead = {
  /** Estimated birth date. */
  birth?: string;
  /** Estimated death date. */
  death?: string;
  /** Explanation of how the dates were determined. */
  explain?: string;
  /** Related person record used in the estimation. */
  other?: PersonRead;
  [key: string]: any;
};
export type Living = {
  /** True if the person is estimated to be alive. */
  living?: boolean;
  [key: string]: any;
};
export const {
  useGetPersonTimelineQuery,
  useLazyGetPersonTimelineQuery,
  useGetPersonQuery,
  useLazyGetPersonQuery,
  usePutPersonMutation,
  useDeletePersonMutation,
  useGetPersonDnaMatchesQuery,
  useLazyGetPersonDnaMatchesQuery,
  useGetPersonYdnaQuery,
  useLazyGetPersonYdnaQuery,
  useGetPeopleQuery,
  useLazyGetPeopleQuery,
  usePostPeopleMutation,
  usePostPeopleQueryMutation,
  usePostMergePersonMutation,
  useGetFamilyTimelineQuery,
  useLazyGetFamilyTimelineQuery,
  useGetTimelinePeopleQuery,
  useLazyGetTimelinePeopleQuery,
  useGetTimelineFamiliesQuery,
  useLazyGetTimelineFamiliesQuery,
  usePostDnaMatchParserQuery,
  useLazyPostDnaMatchParserQuery,
  useGetRelationQuery,
  useLazyGetRelationQuery,
  useGetRelationsQuery,
  useLazyGetRelationsQuery,
  useGetLivingDatesQuery,
  useLazyGetLivingDatesQuery,
  useGetLivingQuery,
  useLazyGetLivingQuery,
} = injectedRtkApi;
