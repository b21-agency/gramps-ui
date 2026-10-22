import { api } from "./index";
export const addTagTypes = ["Trees", "Backups"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      getTree: build.query<GetTreeApiResponse, GetTreeApiArg>({
        query: (queryArg) => ({ url: `/api/trees/${queryArg.treeId}` }),
        providesTags: ["Trees"],
      }),
      putTree: build.mutation<PutTreeApiResponse, PutTreeApiArg>({
        query: (queryArg) => ({
          url: `/api/trees/${queryArg.treeId}`,
          method: "PUT",
          body: queryArg.treeUpdateBodyArgs,
        }),
        invalidatesTags: ["Trees"],
      }),
      getTrees: build.query<GetTreesApiResponse, GetTreesApiArg>({
        query: () => ({ url: `/api/trees/` }),
        providesTags: ["Trees"],
      }),
      postTrees: build.mutation<PostTreesApiResponse, PostTreesApiArg>({
        query: (queryArg) => ({
          url: `/api/trees/`,
          method: "POST",
          body: queryArg.treeCreateBodyArgs,
        }),
        invalidatesTags: ["Trees"],
      }),
      postDisableTree: build.mutation<
        PostDisableTreeApiResponse,
        PostDisableTreeApiArg
      >({
        query: (queryArg) => ({
          url: `/api/trees/${queryArg.treeId}/disable`,
          method: "POST",
        }),
        invalidatesTags: ["Trees"],
      }),
      postEnableTree: build.mutation<
        PostEnableTreeApiResponse,
        PostEnableTreeApiArg
      >({
        query: (queryArg) => ({
          url: `/api/trees/${queryArg.treeId}/enable`,
          method: "POST",
        }),
        invalidatesTags: ["Trees"],
      }),
      postRepairTree: build.mutation<
        PostRepairTreeApiResponse,
        PostRepairTreeApiArg
      >({
        query: (queryArg) => ({
          url: `/api/trees/${queryArg.treeId}/repair`,
          method: "POST",
        }),
        invalidatesTags: ["Trees"],
      }),
      postMigrateTree: build.mutation<
        PostMigrateTreeApiResponse,
        PostMigrateTreeApiArg
      >({
        query: (queryArg) => ({
          url: `/api/trees/${queryArg.treeId}/migrate`,
          method: "POST",
        }),
        invalidatesTags: ["Trees"],
      }),
      getTreeConfig: build.query<GetTreeConfigApiResponse, GetTreeConfigApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/trees/${queryArg.treeId}/config`,
          }),
          providesTags: ["Trees"],
        },
      ),
      putTreeConfig: build.mutation<
        PutTreeConfigApiResponse,
        PutTreeConfigApiArg
      >({
        query: (queryArg) => ({
          url: `/api/trees/${queryArg.treeId}/config`,
          method: "PUT",
          body: queryArg.treeConfigBodyArgs,
        }),
        invalidatesTags: ["Trees"],
      }),
      getBackups: build.query<GetBackupsApiResponse, GetBackupsApiArg>({
        query: () => ({ url: `/api/backups/` }),
        providesTags: ["Backups"],
      }),
      postBackups: build.mutation<PostBackupsApiResponse, PostBackupsApiArg>({
        query: () => ({ url: `/api/backups/`, method: "POST" }),
        invalidatesTags: ["Backups"],
      }),
      postBackupUploadRestore: build.mutation<
        PostBackupUploadRestoreApiResponse,
        PostBackupUploadRestoreApiArg
      >({
        query: (queryArg) => ({
          url: `/api/backups/restore`,
          method: "POST",
          params: {
            jwt: queryArg.jwt,
            dry_run: queryArg.dryRun,
            data: queryArg.data,
            tree_settings: queryArg.treeSettings,
            users: queryArg.users,
          },
        }),
        invalidatesTags: ["Backups"],
      }),
      getBackup: build.query<GetBackupApiResponse, GetBackupApiArg>({
        query: (queryArg) => ({ url: `/api/backups/${queryArg.backupId}` }),
        providesTags: ["Backups"],
      }),
      deleteBackup: build.mutation<DeleteBackupApiResponse, DeleteBackupApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/backups/${queryArg.backupId}`,
            method: "DELETE",
          }),
          invalidatesTags: ["Backups"],
        },
      ),
      postBackupRestore: build.mutation<
        PostBackupRestoreApiResponse,
        PostBackupRestoreApiArg
      >({
        query: (queryArg) => ({
          url: `/api/backups/${queryArg.backupId}/restore`,
          method: "POST",
          params: {
            jwt: queryArg.jwt,
            dry_run: queryArg.dryRun,
            data: queryArg.data,
            tree_settings: queryArg.treeSettings,
            users: queryArg.users,
          },
        }),
        invalidatesTags: ["Backups"],
      }),
      postVerify: build.mutation<PostVerifyApiResponse, PostVerifyApiArg>({
        query: (queryArg) => ({
          url: `/api/trees/${queryArg.treeId}/verify`,
          method: "POST",
          params: {
            oldage: queryArg.oldage,
            hwdif: queryArg.hwdif,
            cspace: queryArg.cspace,
            cbspan: queryArg.cbspan,
            yngmar: queryArg.yngmar,
            oldmar: queryArg.oldmar,
            oldmom: queryArg.oldmom,
            yngmom: queryArg.yngmom,
            yngdad: queryArg.yngdad,
            olddad: queryArg.olddad,
            wedder: queryArg.wedder,
            mxchildmom: queryArg.mxchildmom,
            mxchilddad: queryArg.mxchilddad,
            lngwdw: queryArg.lngwdw,
            oldunm: queryArg.oldunm,
            estimate_age: queryArg.estimateAge,
            invdate: queryArg.invdate,
            locale: queryArg.locale,
          },
        }),
        invalidatesTags: ["Trees"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type GetTreeApiResponse = /** status 200 OK */ Tree;
export type GetTreeApiArg = {
  treeId: string;
};
export type PutTreeApiResponse = unknown;
export type PutTreeApiArg = {
  treeId: string;
  treeUpdateBodyArgs: TreeUpdateBodyArgs;
};
export type GetTreesApiResponse = /** status 200 OK */ Tree[];
export type GetTreesApiArg = void;
export type PostTreesApiResponse = /** status 201 Created */ Tree;
export type PostTreesApiArg = {
  treeCreateBodyArgs: TreeCreateBodyArgs;
};
export type PostDisableTreeApiResponse = unknown;
export type PostDisableTreeApiArg = {
  treeId: string;
};
export type PostEnableTreeApiResponse = unknown;
export type PostEnableTreeApiArg = {
  treeId: string;
};
export type PostRepairTreeApiResponse = unknown;
export type PostRepairTreeApiArg = {
  treeId: string;
};
export type PostMigrateTreeApiResponse = unknown;
export type PostMigrateTreeApiArg = {
  treeId: string;
};
export type GetTreeConfigApiResponse = /** status 200 OK */ TreeConfig;
export type GetTreeConfigApiArg = {
  treeId: string;
};
export type PutTreeConfigApiResponse = /** status 200 OK */ TreeConfig;
export type PutTreeConfigApiArg = {
  treeId: string;
  treeConfigBodyArgs: TreeConfigBodyArgs;
};
export type GetBackupsApiResponse = /** status 200 OK */ Backup[];
export type GetBackupsApiArg = void;
export type PostBackupsApiResponse = /** status 201 Created */ Backup;
export type PostBackupsApiArg = void;
export type PostBackupUploadRestoreApiResponse =
  /** status 200 OK */ BackupRestoreResult;
export type PostBackupUploadRestoreApiArg = {
  /** JWT token for upload authentication. */
  jwt?: string;
  /** If true, return what the restore would change without changing anything. */
  dryRun?: boolean;
  /** If true (default), reset the family tree data to the backup's. */
  data?: boolean;
  /** If true (default), replace the tree settings with the backup's. */
  treeSettings?: boolean;
  /** If true (default), add the backup's users that don't exist yet. */
  users?: boolean;
};
export type GetBackupApiResponse = unknown;
export type GetBackupApiArg = {
  backupId: string;
};
export type DeleteBackupApiResponse = unknown;
export type DeleteBackupApiArg = {
  backupId: string;
};
export type PostBackupRestoreApiResponse =
  /** status 200 OK */ BackupRestoreResult;
export type PostBackupRestoreApiArg = {
  backupId: string;
  /** JWT token for upload authentication. */
  jwt?: string;
  /** If true, return what the restore would change without changing anything. */
  dryRun?: boolean;
  /** If true (default), reset the family tree data to the backup's. */
  data?: boolean;
  /** If true (default), replace the tree settings with the backup's. */
  treeSettings?: boolean;
  /** If true (default), add the backup's users that don't exist yet. */
  users?: boolean;
};
export type PostVerifyApiResponse = unknown;
export type PostVerifyApiArg = {
  treeId: string;
  /** Maximum age at death (years) */
  oldage?: number;
  /** Maximum husband-wife age difference (years) */
  hwdif?: number;
  /** Maximum years between consecutive children */
  cspace?: number;
  /** Maximum total span of children's births (years) */
  cbspan?: number;
  /** Minimum age to marry (years) */
  yngmar?: number;
  /** Maximum age to marry (years) */
  oldmar?: number;
  /** Maximum age for a mother to bear a child (years) */
  oldmom?: number;
  /** Minimum age for a mother to bear a child (years) */
  yngmom?: number;
  /** Minimum age for a father (years) */
  yngdad?: number;
  /** Maximum age for a father (years) */
  olddad?: number;
  /** Maximum number of spouses */
  wedder?: number;
  /** Maximum number of children for a woman */
  mxchildmom?: number;
  /** Maximum number of children for a man */
  mxchilddad?: number;
  /** Maximum consecutive years of widowhood before next marriage */
  lngwdw?: number;
  /** Maximum age for an unmarried person (years) */
  oldunm?: number;
  /** Estimate missing or inexact dates */
  estimateAge?: boolean;
  /** Flag invalid date formats */
  invdate?: boolean;
  /** Language code for translating result messages (e.g. 'de', 'fr'). */
  locale?: string | null;
};
export type Tree = {
  /** Human-readable name of the tree. */
  name?: string;
  /** Unique identifier of the tree. */
  id?: string;
  /** Maximum total size in bytes for media objects. */
  quota_media?: number | null;
  /** Maximum number of people allowed in the tree. */
  quota_people?: number | null;
  /** Current total size of media objects in bytes. */
  usage_media?: number;
  /** Current number of people in the tree. */
  usage_people?: number;
  /** Whether the tree is enabled. */
  enabled?: boolean;
  /** Minimum user role required to use the AI chat endpoint. */
  min_role_ai?: number | null;
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
export type TreeUpdateBodyArgs = {
  /** The name of the tree. */
  name?: string | null;
  /** Maximum total size in bytes for media objects. */
  quota_media?: number;
  /** Maximum number of people allowed in the tree. */
  quota_people?: number;
  /** Minimum user role level required to use the AI chat endpoint. */
  min_role_ai?: number;
};
export type TreeCreateBodyArgs = {
  /** The name of the tree. */
  name: string;
  /** Maximum total size in bytes for media objects. */
  quota_media?: number;
  /** Maximum number of people allowed in the tree. */
  quota_people?: number;
  /** Minimum user role level required to use the AI chat endpoint. */
  min_role_ai?: number;
};
export type TreeConfig = {
  [key: string]: any;
};
export type TreeConfigBodyArgs = {
  [key: string]: any;
};
export type Backup = {
  /** ID of the backup. */
  id?: string;
  /** Size of the archive in bytes. */
  size?: number;
  /** Whether this server can restore the backup. False e.g. for a backup made with a newer database schema, after a downgrade. */
  restorable?: boolean;
  /** The backup's manifest: when and from which tree it was made, the versions, object counts and number of media files. */
  manifest?: {
    [key: string]: any;
  };
  [key: string]: any;
};
export type TaskReference = {
  /** URL of the task status endpoint. */
  href?: string;
  /** Unique identifier of the task. */
  id?: string;
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
export type TreeSettingsRestore = {
  /** Whether the backup's tree settings differ from the current ones. */
  changed?: boolean;
  [key: string]: any;
};
export type UsersRestore = {
  /** Names of the users added to the tree, with a random password and a role of at most owner. They log in after resetting their password. */
  added?: string[];
  /** Names of the users not added because a user with that name already exists on the server, in any tree. Existing users are never changed. */
  skipped?: string[];
  [key: string]: any;
};
export type BackupRestoreResult = {
  /** The backup's manifest: when and from which tree it was made, the versions, object counts and media totals. */
  manifest?: {
    [key: string]: any;
  };
  /** Changeset of the family tree data. Absent if not selected. */
  data?: RestoreSummary;
  /** Gramps IDs of the backup's media objects whose files don't exist on the server. Media files are not part of the backup. Absent if the data was not selected. */
  missing_media?: string[];
  /** Absent if not selected. */
  tree_settings?: TreeSettingsRestore;
  /** Absent if not selected. */
  users?: UsersRestore;
  /** Background tasks updating the search indices after the data was restored, see the restore endpoint. Absent for a dry run or if the data was not selected. */
  index_tasks?: TaskReference[];
  [key: string]: any;
};
export const {
  useGetTreeQuery,
  useLazyGetTreeQuery,
  usePutTreeMutation,
  useGetTreesQuery,
  useLazyGetTreesQuery,
  usePostTreesMutation,
  usePostDisableTreeMutation,
  usePostEnableTreeMutation,
  usePostRepairTreeMutation,
  usePostMigrateTreeMutation,
  useGetTreeConfigQuery,
  useLazyGetTreeConfigQuery,
  usePutTreeConfigMutation,
  useGetBackupsQuery,
  useLazyGetBackupsQuery,
  usePostBackupsMutation,
  usePostBackupUploadRestoreMutation,
  useGetBackupQuery,
  useLazyGetBackupQuery,
  useDeleteBackupMutation,
  usePostBackupRestoreMutation,
  usePostVerifyMutation,
} = injectedRtkApi;
