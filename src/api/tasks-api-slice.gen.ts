import { api } from "./index";
export const addTagTypes = [
  "Reports",
  "Exporters",
  "Importers",
  "Chat",
  "Tasks",
] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getReportFile: build.query<GetReportFileApiResponse, GetReportFileApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/reports/${queryArg.reportId}/file`,
            params: {
              options: queryArg.options,
              locale: queryArg.locale,
              jwt: queryArg.jwt,
            },
          }),
          providesTags: ["Reports"],
        },
      ),
      postReportFile: build.mutation<
        PostReportFileApiResponse,
        PostReportFileApiArg
      >({
        query: (queryArg) => ({
          url: `/api/reports/${queryArg.reportId}/file`,
          method: "POST",
          params: {
            options: queryArg.options,
            locale: queryArg.locale,
            jwt: queryArg.jwt,
          },
        }),
        invalidatesTags: ["Reports"],
      }),
      getReport: build.query<GetReportApiResponse, GetReportApiArg>({
        query: (queryArg) => ({
          url: `/api/reports/${queryArg.reportId}`,
          params: {
            include_help: queryArg.includeHelp,
          },
        }),
        providesTags: ["Reports"],
      }),
      getReports: build.query<GetReportsApiResponse, GetReportsApiArg>({
        query: (queryArg) => ({
          url: `/api/reports/`,
          params: {
            include_help: queryArg.includeHelp,
          },
        }),
        providesTags: ["Reports"],
      }),
      getReportFileResult: build.query<
        GetReportFileResultApiResponse,
        GetReportFileResultApiArg
      >({
        query: (queryArg) => ({
          url: `/api/reports/${queryArg.reportId}/file/processed/${queryArg.filename}`,
        }),
        providesTags: ["Reports"],
      }),
      getExporterFile: build.query<
        GetExporterFileApiResponse,
        GetExporterFileApiArg
      >({
        query: (queryArg) => ({
          url: `/api/exporters/${queryArg.extension}/file`,
          params: {
            compress: queryArg.compress,
            current_year: queryArg.currentYear,
            event: queryArg.event,
            gramps_id: queryArg.grampsId,
            handle: queryArg.handle,
            include_children: queryArg.includeChildren,
            include_individuals: queryArg.includeIndividuals,
            include_marriages: queryArg.includeMarriages,
            include_media: queryArg.includeMedia,
            include_places: queryArg.includePlaces,
            include_witnesses: queryArg.includeWitnesses,
            living: queryArg.living,
            locale: queryArg.locale,
            note: queryArg.note,
            person: queryArg.person,
            private: queryArg["private"],
            reference: queryArg.reference,
            sequence: queryArg.sequence,
            translate_headers: queryArg.translateHeaders,
            years_after_death: queryArg.yearsAfterDeath,
            jwt: queryArg.jwt,
          },
        }),
        providesTags: ["Exporters"],
      }),
      postExporterFile: build.mutation<
        PostExporterFileApiResponse,
        PostExporterFileApiArg
      >({
        query: (queryArg) => ({
          url: `/api/exporters/${queryArg.extension}/file`,
          method: "POST",
          params: {
            compress: queryArg.compress,
            current_year: queryArg.currentYear,
            event: queryArg.event,
            gramps_id: queryArg.grampsId,
            handle: queryArg.handle,
            include_children: queryArg.includeChildren,
            include_individuals: queryArg.includeIndividuals,
            include_marriages: queryArg.includeMarriages,
            include_media: queryArg.includeMedia,
            include_places: queryArg.includePlaces,
            include_witnesses: queryArg.includeWitnesses,
            living: queryArg.living,
            locale: queryArg.locale,
            note: queryArg.note,
            person: queryArg.person,
            private: queryArg["private"],
            reference: queryArg.reference,
            sequence: queryArg.sequence,
            translate_headers: queryArg.translateHeaders,
            years_after_death: queryArg.yearsAfterDeath,
            jwt: queryArg.jwt,
          },
        }),
        invalidatesTags: ["Exporters"],
      }),
      getExporterFileResult: build.query<
        GetExporterFileResultApiResponse,
        GetExporterFileResultApiArg
      >({
        query: (queryArg) => ({
          url: `/api/exporters/${queryArg.extension}/file/processed/${queryArg.filename}`,
        }),
        providesTags: ["Exporters"],
      }),
      getExporter: build.query<GetExporterApiResponse, GetExporterApiArg>({
        query: (queryArg) => ({ url: `/api/exporters/${queryArg.extension}` }),
        providesTags: ["Exporters"],
      }),
      getExporters: build.query<GetExportersApiResponse, GetExportersApiArg>({
        query: () => ({ url: `/api/exporters/` }),
        providesTags: ["Exporters"],
      }),
      postImporterFile: build.mutation<
        PostImporterFileApiResponse,
        PostImporterFileApiArg
      >({
        query: (queryArg) => ({
          url: `/api/importers/${queryArg.extension}/file`,
          method: "POST",
          params: {
            jwt: queryArg.jwt,
            dry_run: queryArg.dryRun,
          },
        }),
        invalidatesTags: ["Importers"],
      }),
      postRestoreFile: build.mutation<
        PostRestoreFileApiResponse,
        PostRestoreFileApiArg
      >({
        query: (queryArg) => ({
          url: `/api/importers/${queryArg.extension}/file/restore`,
          method: "POST",
          params: {
            jwt: queryArg.jwt,
            dry_run: queryArg.dryRun,
          },
        }),
        invalidatesTags: ["Importers"],
      }),
      getImporter: build.query<GetImporterApiResponse, GetImporterApiArg>({
        query: (queryArg) => ({ url: `/api/importers/${queryArg.extension}` }),
        providesTags: ["Importers"],
      }),
      getImporters: build.query<GetImportersApiResponse, GetImportersApiArg>({
        query: () => ({ url: `/api/importers/` }),
        providesTags: ["Importers"],
      }),
      postChat: build.mutation<PostChatApiResponse, PostChatApiArg>({
        query: (queryArg) => ({
          url: `/api/chat/`,
          method: "POST",
          body: queryArg.chatBodyArgs,
          params: {
            background: queryArg.background,
            verbose: queryArg.verbose,
          },
        }),
        invalidatesTags: ["Chat"],
      }),
      getTasks: build.query<GetTasksApiResponse, GetTasksApiArg>({
        query: (queryArg) => ({
          url: `/api/tasks/`,
          params: {
            include_state: queryArg.includeState,
            limit: queryArg.limit,
          },
        }),
        providesTags: ["Tasks"],
      }),
      getTask: build.query<GetTaskApiResponse, GetTaskApiArg>({
        query: (queryArg) => ({ url: `/api/tasks/${queryArg.taskId}` }),
        providesTags: ["Tasks"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type GetReportFileApiResponse = unknown;
export type GetReportFileApiArg = {
  reportId: string;
  /** Report options as a JSON string. See the report's options_help for available keys. */
  options?: string;
  /** Language code of the locale to use for the report output. */
  locale?: string | null;
  /** JWT token for download authentication (used when the browser fetches the file directly). */
  jwt?: string;
};
export type PostReportFileApiResponse = unknown;
export type PostReportFileApiArg = {
  reportId: string;
  /** Report options as a JSON string. See the report's options_help for available keys. */
  options?: string;
  /** Language code of the locale to use for the report output. */
  locale?: string | null;
  /** JWT token for download authentication (used when the browser fetches the file directly). */
  jwt?: string;
};
export type GetReportApiResponse = /** status 200 OK */ Report;
export type GetReportApiArg = {
  reportId: string;
  /** If true, include the options help dictionary in the response. */
  includeHelp?: boolean;
};
export type GetReportsApiResponse = /** status 200 OK */ Report[];
export type GetReportsApiArg = {
  /** If true, include the options help dictionary in the response. */
  includeHelp?: boolean;
};
export type GetReportFileResultApiResponse = unknown;
export type GetReportFileResultApiArg = {
  reportId: string;
  filename: string;
};
export type GetExporterFileApiResponse = unknown;
export type GetExporterFileApiArg = {
  extension: string;
  /** If true (default), use compression if supported by the exporter. */
  compress?: boolean;
  /** Year to treat as 'current' when evaluating whether someone may still be alive. Defaults to the actual current year. */
  currentYear?: number | null;
  /** Name of a custom event filter to apply during export. */
  event?: string | null;
  /** Gramps ID of the person for built-in person filter. */
  grampsId?: string | null;
  /** Handle of the person for built-in person filter. Ignored if gramps_id is provided. */
  handle?: string | null;
  /** If true (default), include children in CSV export. */
  includeChildren?: boolean;
  /** If true (default), include individuals in CSV export. */
  includeIndividuals?: boolean;
  /** If true (default), include marriages in CSV export. */
  includeMarriages?: boolean;
  /** If true (default), include media in GED2 export. */
  includeMedia?: boolean;
  /** If true (default), include places in CSV export. */
  includePlaces?: boolean;
  /** If true (default), include witnesses in GED2 export. */
  includeWitnesses?: boolean;
  /** Built-in proxy controlling how living people are handled. Values: IncludeAll, FullNameOnly, LastNameOnly, ReplaceCompleteName, ExcludeAll. */
  living?:
    | "IncludeAll"
    | "FullNameOnly"
    | "LastNameOnly"
    | "ReplaceCompleteName"
    | "ExcludeAll";
  /** Language code for translation of living-person name filters. */
  locale?: string | null;
  /** Name of a custom note filter to apply during export. */
  note?: string | null;
  /** Name of a built-in or custom person filter. Built-in values: Descendants, DescendantFamilies, Ancestors, CommonAncestor. */
  person?: string | null;
  /** If true, exclude records marked as private from the export. */
  private?: boolean;
  /** If true, include records not directly linked to the selected person. */
  reference?: boolean;
  /** Comma-delimited order in which filters are applied (default: privacy,living,person,event,note,reference). */
  sequence?: string;
  /** If true (default), translate CSV headers to the current locale. */
  translateHeaders?: boolean;
  /** Number of years after death during which a person is still treated as living (default 0). */
  yearsAfterDeath?: number;
  /** JWT token for download authentication. */
  jwt?: string;
};
export type PostExporterFileApiResponse =
  /** status 201 Created */ ExportResult;
export type PostExporterFileApiArg = {
  extension: string;
  /** If true (default), use compression if supported by the exporter. */
  compress?: boolean;
  /** Year to treat as 'current' when evaluating whether someone may still be alive. Defaults to the actual current year. */
  currentYear?: number | null;
  /** Name of a custom event filter to apply during export. */
  event?: string | null;
  /** Gramps ID of the person for built-in person filter. */
  grampsId?: string | null;
  /** Handle of the person for built-in person filter. Ignored if gramps_id is provided. */
  handle?: string | null;
  /** If true (default), include children in CSV export. */
  includeChildren?: boolean;
  /** If true (default), include individuals in CSV export. */
  includeIndividuals?: boolean;
  /** If true (default), include marriages in CSV export. */
  includeMarriages?: boolean;
  /** If true (default), include media in GED2 export. */
  includeMedia?: boolean;
  /** If true (default), include places in CSV export. */
  includePlaces?: boolean;
  /** If true (default), include witnesses in GED2 export. */
  includeWitnesses?: boolean;
  /** Built-in proxy controlling how living people are handled. Values: IncludeAll, FullNameOnly, LastNameOnly, ReplaceCompleteName, ExcludeAll. */
  living?:
    | "IncludeAll"
    | "FullNameOnly"
    | "LastNameOnly"
    | "ReplaceCompleteName"
    | "ExcludeAll";
  /** Language code for translation of living-person name filters. */
  locale?: string | null;
  /** Name of a custom note filter to apply during export. */
  note?: string | null;
  /** Name of a built-in or custom person filter. Built-in values: Descendants, DescendantFamilies, Ancestors, CommonAncestor. */
  person?: string | null;
  /** If true, exclude records marked as private from the export. */
  private?: boolean;
  /** If true, include records not directly linked to the selected person. */
  reference?: boolean;
  /** Comma-delimited order in which filters are applied (default: privacy,living,person,event,note,reference). */
  sequence?: string;
  /** If true (default), translate CSV headers to the current locale. */
  translateHeaders?: boolean;
  /** Number of years after death during which a person is still treated as living (default 0). */
  yearsAfterDeath?: number;
  /** JWT token for download authentication. */
  jwt?: string;
};
export type GetExporterFileResultApiResponse = unknown;
export type GetExporterFileResultApiArg = {
  extension: string;
  filename: string;
};
export type GetExporterApiResponse = /** status 200 OK */ Exporter;
export type GetExporterApiArg = {
  extension: string;
};
export type GetExportersApiResponse = /** status 200 OK */ Exporter[];
export type GetExportersApiArg = void;
export type PostImporterFileApiResponse =
  | /** status 200 Dry run result. */ ImportResult
  | /** status 201 Created */ ImportResult;
export type PostImporterFileApiArg = {
  extension: string;
  /** JWT token for upload authentication. */
  jwt?: string;
  /** If true, compute and return the object counts in the file without importing it. */
  dryRun?: boolean;
};
export type PostRestoreFileApiResponse = /** status 200 OK */ RestoreSummary;
export type PostRestoreFileApiArg = {
  extension: string;
  /** JWT token for upload authentication. */
  jwt?: string;
  /** If true, compute and return the changeset summary without modifying the tree. */
  dryRun?: boolean;
};
export type GetImporterApiResponse = /** status 200 OK */ Importer;
export type GetImporterApiArg = {
  extension: string;
};
export type GetImportersApiResponse = /** status 200 OK */ Importer[];
export type GetImportersApiArg = void;
export type PostChatApiResponse = /** status 200 OK */ ChatResponse;
export type PostChatApiArg = {
  /** If true, process the chat in the background and return HTTP 202. */
  background?: boolean;
  /** If true, include detailed agent metadata (tool calls, token usage) in the response. */
  verbose?: boolean;
  chatBodyArgs: ChatBodyArgs;
};
export type GetTasksApiResponse = /** status 200 OK */ TaskListItem[];
export type GetTasksApiArg = {
  /** Include the task state in Celery's spelling (see 'status' for the lifecycle status). */
  includeState?: boolean;
  /** Maximum number of tasks to return (default 100). */
  limit?: number;
};
export type GetTaskApiResponse = /** status 200 OK */ TaskStatus;
export type GetTaskApiArg = {
  taskId: string;
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
export type Report = {
  /** Report author names. */
  authors?: string[];
  /** Email addresses of report authors. */
  authors_email?: string[];
  /** Report category code. */
  category?: number;
  /** Description of the report. */
  description?: string;
  /** Report identifier. */
  id?: string;
  /** Display name of the report. */
  name?: string;
  /** All report options with their default values. */
  options_dict?: {
    [key: string]: any;
  };
  /** Help information for all report options. */
  options_help?: {
    [key: string]: any;
  };
  /** Supported report output modes. */
  report_modes?: number[];
  /** Version of the report plugin. */
  version?: string;
  [key: string]: any;
};
export type ExportResult = {
  /** Name of the exported file on the server. */
  file_name?: string;
  /** Extension of the exported file, e.g. `.ged`. */
  file_type?: string;
  /** URL to download the exported file from. */
  url?: string;
  /** What the exporter left out, one line each, e.g. attributes the GEDCOM 7 export has no place for. Empty for exporters that report nothing, which is all but GEDCOM 7. A long report is truncated, with a final line stating how much was omitted. */
  messages?: string[];
  [key: string]: any;
};
export type Exporter = {
  /** Description of the export format and its use. */
  description?: string;
  /** Default file extension for this format. */
  extension?: string;
  /** Plugin module name. */
  module?: string;
  [key: string]: any;
};
export type TaskReference = {
  /** URL of the task status endpoint. */
  href?: string;
  /** Unique identifier of the task. */
  id?: string;
  [key: string]: any;
};
export type ImportResult = {
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
  /** Diagnostic messages emitted by the importer, e.g. the GEDCOM import report listing lines that could not be parsed. Empty for importers that emit no diagnostics. Also returned for a dry run, where it describes what a real import would report. A long report is truncated, with a final line stating how much was omitted. */
  messages?: string[];
  /** Background tasks updating the search indices after the import. The import is complete when this result is returned; search results may be incomplete until these tasks have finished. Empty when the server runs without a task queue, in which case the indices were already updated. Absent for a dry run. */
  index_tasks?: TaskReference[];
  [key: string]: any;
};
export type RestoreSummary = {
  /** Number of objects, by type, present in the backup but not in the tree, which would be added. */
  to_add?: {
    [key: string]: number;
  };
  /** Number of objects, by type, present in both but differing, which would be overwritten with the backup version. */
  to_update?: {
    [key: string]: number;
  };
  /** Number of objects, by type, present in the tree but not in the backup, which would be deleted. */
  to_delete?: {
    [key: string]: number;
  };
  /** Number of objects, by type, present in both the tree and the backup with identical content, which would be left as is. */
  unchanged?: {
    [key: string]: number;
  };
  /** Background tasks updating the search indices after the restore. The restore is complete when this result is returned; search results may be incomplete until these tasks have finished. Empty when the server runs without a task queue, in which case the indices were already updated. Absent for a dry run. */
  index_tasks?: TaskReference[];
  [key: string]: any;
};
export type Importer = {
  /** Description of the import format and its use. */
  description?: string;
  /** File extension this importer handles. */
  extension?: string;
  /** Plugin module name. */
  module?: string;
  [key: string]: any;
};
export type ChatResponse = {
  /** The assistant's answer. */
  response?: string;
  /** Optional execution metadata (included when verbose=true). */
  metadata?: {
    [key: string]: any;
  };
  /** Serialized full message history for multi-turn conversations. Pass back in subsequent requests as message_history_raw to preserve tool call context. */
  message_history_raw?: string;
  [key: string]: any;
};
export type ChatMessage = {
  /** Role of the message sender: one of 'human', 'ai', 'system', 'assistant', or 'error'. */
  role: string;
  /** The message content. */
  message: string;
};
export type ChatBodyArgs = {
  /** The chat prompt to answer. */
  query: string;
  /** Optional list of prior conversation messages ({role, message}). */
  history?: ChatMessage[];
  /** Serialized message history from a previous response's message_history_raw field. Preserves full tool call context across turns. Takes precedence over history when both are provided. */
  message_history_raw?: string | null;
};
export type TaskListItem = {
  /** The Celery task UUID. */
  task_id?: string;
  /** Celery task function name, e.g. 'import_file'. */
  name?: string;
  /** Lifecycle status: 'queued', 'running', 'succeeded', 'failed', 'lost' (abandoned after it stopped responding), or 'unknown' for tasks recorded before the status was tracked. */
  status?: string;
  /** UTC timestamp when the task was dispatched. */
  created_at?: string;
  /** UUID of the user who dispatched the task. */
  user_id?: string;
  /** Username of the user who dispatched the task. */
  user_name?: string;
  /** The current task state (e.g. 'PENDING', 'STARTED', 'SUCCESS', 'FAILURE'). Only populated when include_state=true. */
  state?: string;
};
export type TaskStatus = {
  /** The current task state (e.g. 'PENDING', 'STARTED', 'SUCCESS', 'FAILURE'). */
  state?: string;
  /** The task result object if available. */
  result_object?: any;
  /** Human-readable status information. */
  info?: string;
  /** The task result as a string. */
  result?: string;
  /** The Celery task UUID. */
  task_id?: string;
  /** Celery task function name, e.g. 'import_file'. */
  name?: string;
  /** Lifecycle status: 'queued', 'running', 'succeeded', 'failed', 'lost' (abandoned after it stopped responding), or 'unknown' for tasks recorded before the status was tracked. */
  status?: string;
  /** UTC timestamp when the task was dispatched. */
  created_at?: string;
  /** UUID of the user who dispatched the task. */
  user_id?: string;
  /** Username of the user who dispatched the task. */
  user_name?: string;
};
export const {
  useGetReportFileQuery,
  useLazyGetReportFileQuery,
  usePostReportFileMutation,
  useGetReportQuery,
  useLazyGetReportQuery,
  useGetReportsQuery,
  useLazyGetReportsQuery,
  useGetReportFileResultQuery,
  useLazyGetReportFileResultQuery,
  useGetExporterFileQuery,
  useLazyGetExporterFileQuery,
  usePostExporterFileMutation,
  useGetExporterFileResultQuery,
  useLazyGetExporterFileResultQuery,
  useGetExporterQuery,
  useLazyGetExporterQuery,
  useGetExportersQuery,
  useLazyGetExportersQuery,
  usePostImporterFileMutation,
  usePostRestoreFileMutation,
  useGetImporterQuery,
  useLazyGetImporterQuery,
  useGetImportersQuery,
  useLazyGetImportersQuery,
  usePostChatMutation,
  useGetTasksQuery,
  useLazyGetTasksQuery,
  useGetTaskQuery,
  useLazyGetTaskQuery,
} = injectedRtkApi;
