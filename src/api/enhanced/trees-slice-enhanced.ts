import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit'
import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import { api as baseApi } from '../trees-api-slice.gen'
import type { TaskStart } from './tasks-slice-enhanced'

// The user's tree ('-'): name and usage, the UI config (accent, map layers, bookmarks …)
// and the admin tasks. Renaming changes the metadata too.

export type TreeConfig = Record<string, unknown>

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<Definitions, 'getTreeConfig' | 'postRepairTree' | 'postMigrateTree' | 'postVerify'> & {
  getTreeConfig: OverrideResultType<Definitions['getTreeConfig'], TreeConfig>
  postRepairTree: OverrideResultType<Definitions['postRepairTree'], TaskStart>
  postMigrateTree: OverrideResultType<Definitions['postMigrateTree'], TaskStart>
  postVerify: OverrideResultType<Definitions['postVerify'], TaskStart>
}

export const treesApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getTree: { providesTags: ['Trees'] },
    putTree: { invalidatesTags: ['Trees', 'Metadata'] },
    getTreeConfig: { providesTags: ['Trees'] },
    putTreeConfig: { invalidatesTags: ['Trees'] },
    // background tasks: use-task invalidates TASK_TAGS once they are done
    postRepairTree: { invalidatesTags: [{ type: 'Tasks', id: 'LIST' }] },
    postMigrateTree: { invalidatesTags: [{ type: 'Tasks', id: 'LIST' }] },
    postVerify: { invalidatesTags: [{ type: 'Tasks', id: 'LIST' }] },
  },
})

/**
 * Merge a patch into the tree's UI config and save it. Re-reads the config first, so a
 * change made elsewhere in the meantime isn't overwritten. Dispatch it; resolves to the saved config.
 */
export const patchTreeConfig =
  (patch: TreeConfig) =>
  async (dispatch: ThunkDispatch<unknown, unknown, UnknownAction>): Promise<TreeConfig> => {
    const current = await dispatch(
      treesApi.endpoints.getTreeConfig.initiate({ treeId: '-' }, { subscribe: false, forceRefetch: true }),
    ).unwrap()
    const merged = { ...current, ...patch }
    await dispatch(treesApi.endpoints.putTreeConfig.initiate({ treeId: '-', treeConfigBodyArgs: merged })).unwrap()
    return merged
  }

export const {
  useGetTreeQuery,
  usePutTreeMutation,
  useGetTreeConfigQuery,
  usePutTreeConfigMutation,
  usePostRepairTreeMutation,
  usePostMigrateTreeMutation,
  usePostVerifyMutation,
} = treesApi
