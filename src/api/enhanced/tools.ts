import type { TagDescription } from '@reduxjs/toolkit/query'
import { api } from '../index'
import type { ReportDef } from '@/features/tools/report-options'
import { DERIVED, type TagType } from './tags'
import { cleanParams } from './objects'

// Tools: reports, export, import, background tasks.
// The generated getReports/getExporters/getImporters type every field as optional, so the
// lists are re-declared here with real types. Long-running endpoints answer 202
// {task: {id, href}}; use-task.ts polls the generated `getTask` (through RTK `initiate`)
// until the task is final, then invalidates what the task changed (see `TASK_TAGS`).

export interface Exporter {
  extension: string
  name: string
  description: string
  module: string
}

export interface Importer {
  extension: string
  name: string
  description: string
}

/** `{task: {id, href}}` (queued) or the result itself (no task queue configured). */
export type TaskStart = unknown

/** Every cache entry derived from tree data (for imports, repair, delete-all …). */
export const ALL_DATA_TAGS: TagType[] = [
  'People',
  'Families',
  'Events',
  'Places',
  'Sources',
  'Citations',
  'Repositories',
  'Notes',
  'Media',
  'Tags',
  'Bookmarks',
  'Trees',
  ...DERIVED,
]

/** What a finished background task changed, for `api.util.invalidateTags`. */
export const TASK_TAGS = {
  import: ALL_DATA_TAGS,
  mediaArchiveUpload: ['Media', 'Trees', ...DERIVED] as TagType[],
  reindex: ['Search', 'Metadata'] as TagType[],
  repair: ALL_DATA_TAGS,
  migrate: ALL_DATA_TAGS,
  deleteAll: ALL_DATA_TAGS,
} satisfies Record<string, TagDescription<TagType>[]>

export const toolsApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    reportList: build.query<ReportDef[], void>({
      query: () => ({ url: '/api/reports/', params: { include_help: 1 } }),
      providesTags: [{ type: 'Tasks', id: 'reports' }],
      keepUnusedDataFor: 30 * 60,
    }),
    exporterList: build.query<Exporter[], void>({
      query: () => ({ url: '/api/exporters/' }),
      providesTags: [{ type: 'Tasks', id: 'exporters' }],
      keepUnusedDataFor: 30 * 60,
    }),
    importerList: build.query<Importer[], void>({
      query: () => ({ url: '/api/importers/' }),
      providesTags: [{ type: 'Tasks', id: 'importers' }],
      keepUnusedDataFor: 30 * 60,
    }),
    /** Gramps translations of English strings (report names, option labels …); static. */
    grampsTranslations: build.query<Record<string, string>, { lang: string; strings: string[] }>({
      query: ({ lang, strings }) => ({ url: `/api/translations/${lang}`, method: 'POST', body: { strings } }),
      transformResponse: (res: Array<{ original: string; translation: string }>) =>
        Object.fromEntries(res.map((r) => [r.original, r.translation])),
      providesTags: [],
      keepUnusedDataFor: 60 * 60,
    }),

    // Task starters: they change nothing until the task is done, so they invalidate
    // only the task list; callers invalidate TASK_TAGS once the task succeeded.
    runReport: build.mutation<TaskStart, { id: string; options: Record<string, string> }>({
      query: ({ id, options }) => ({
        url: `/api/reports/${id}/file`,
        method: 'POST',
        params: { options: JSON.stringify(options) },
      }),
      invalidatesTags: [{ type: 'Tasks', id: 'LIST' }],
    }),
    runExport: build.mutation<TaskStart, { ext: string; params: Record<string, string | number | boolean> }>({
      query: ({ ext, params }) => ({ url: `/api/exporters/${ext}/file`, method: 'POST', params: cleanParams(params) }),
      invalidatesTags: [{ type: 'Tasks', id: 'LIST' }],
    }),
    createMediaArchive: build.mutation<TaskStart, void>({
      query: () => ({ url: '/api/media/archive/', method: 'POST' }),
      invalidatesTags: [{ type: 'Tasks', id: 'LIST' }],
    }),
    reindexSearch: build.mutation<TaskStart, { full?: boolean } | void>({
      query: (arg) => ({ url: '/api/search/index/', method: 'POST', params: { full: arg?.full === false ? undefined : 1 } }),
      invalidatesTags: [{ type: 'Tasks', id: 'LIST' }],
    }),
  }),
})

export const {
  useReportListQuery,
  useExporterListQuery,
  useImporterListQuery,
  useGrampsTranslationsQuery,
  useRunReportMutation,
  useRunExportMutation,
  useCreateMediaArchiveMutation,
  useReindexSearchMutation,
} = toolsApi
