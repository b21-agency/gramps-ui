import type { DefinitionsFromApi, OverrideResultType, TagDescription, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { ReportDef } from '@/features/tools/report-options'
import { api as baseApi } from '../tasks-api-slice.gen'
import { DERIVED, type TagType } from './tags'

// Reports, export, import and background tasks. The report/exporter/importer lists are
// static per server, so they stay cached for long. Long-running endpoints answer 202
// {task: {id, href}}; use-task.ts polls `getTask` until the task is final, then
// invalidates what the task changed (`TASK_TAGS`).

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

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getReports' | 'getExporters' | 'getImporters' | 'postReportFile' | 'postExporterFile'> & {
  getReports: OverrideResultType<Definitions['getReports'], ReportDef[]>
  getExporters: OverrideResultType<Definitions['getExporters'], Exporter[]>
  getImporters: OverrideResultType<Definitions['getImporters'], Importer[]>
  postReportFile: OverrideResultType<Definitions['postReportFile'], TaskStart>
  postExporterFile: OverrideResultType<Definitions['postExporterFile'], TaskStart>
}

export const tasksApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getReports: { providesTags: [{ type: 'Tasks', id: 'reports' }], keepUnusedDataFor: 30 * 60 },
    getExporters: { providesTags: [{ type: 'Tasks', id: 'exporters' }], keepUnusedDataFor: 30 * 60 },
    getImporters: { providesTags: [{ type: 'Tasks', id: 'importers' }], keepUnusedDataFor: 30 * 60 },
    // task starters change nothing until the task is done
    postReportFile: { invalidatesTags: [{ type: 'Tasks', id: 'LIST' }] },
    postExporterFile: { invalidatesTags: [{ type: 'Tasks', id: 'LIST' }] },
  },
})

export const {
  useGetReportsQuery,
  useGetExportersQuery,
  useGetImportersQuery,
  usePostReportFileMutation,
  usePostExporterFileMutation,
  useGetTaskQuery,
  useGetTasksQuery,
} = tasksApi
export type { PostExporterFileApiArg } from '../tasks-api-slice.gen'
