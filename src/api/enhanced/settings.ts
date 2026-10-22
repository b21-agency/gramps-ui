import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { api } from '../index'
import type { UserInfo } from '@/lib/types'
import type { Page } from './objects'
import type { TaskStart } from './tools'

// Settings: users (list with X-Total-Count, CRUD), own profile, access tokens, tree rename
// and the admin task starters (repair, migrate, verify, delete all). Tags:
//   Users  – any user/profile/token write invalidates the plain 'Users' tag, so the
//            generated user endpoints (current user `getUser('-')`, …) refresh too
//   Trees/Metadata – renaming the tree changes both
// Generated hooks are used directly where they fit: getTree (usage), getMetadataResearcher /
// putMetadataResearcher ('Metadata'); tree config lives in ./shared (updateTreeConfig).

export type AdminUser = UserInfo & { user_id?: string; account_source?: string }

export interface SyncToken {
  id: string
  label: string
  created_at?: string
  last_used_at?: string | null
}

export type AccessTokenScope = 'anniversaries_ics' | 'sync'

const enc = encodeURIComponent

export const settingsApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /* ---------- users (admin) ---------- */
    userList: build.query<Page<AdminUser>, void>({
      query: () => ({ url: '/api/users/', params: { page: 1, pagesize: 500 } }),
      transformResponse: (data: AdminUser[], meta) => {
        const h = meta?.response?.headers.get('X-Total-Count')
        return { items: data, total: h ? Number(h) : data.length }
      },
      providesTags: (res) => ['Users', { type: 'Users', id: 'LIST' }, ...(res?.items ?? []).map((u) => ({ type: 'Users' as const, id: u.name }))],
    }),
    createUser: build.mutation<unknown, { name: string; full_name: string; email: string; password: string; role: number }>({
      query: ({ name, ...body }) => ({ url: `/api/users/${enc(name)}/`, method: 'POST', body }),
      invalidatesTags: ['Users'],
    }),
    /** PUT /users/{name}/ ('-' = me): full_name, email, role, name_new. */
    updateUser: build.mutation<unknown, { name: string; body: Partial<Pick<UserInfo, 'full_name' | 'email' | 'role'>> & { name_new?: string } }>({
      query: ({ name, body }) => ({ url: `/api/users/${name === '-' ? '-' : enc(name)}/`, method: 'PUT', body }),
      invalidatesTags: ['Users'],
    }),
    removeUser: build.mutation<unknown, string>({
      query: (name) => ({ url: `/api/users/${enc(name)}/`, method: 'DELETE' }),
      invalidatesTags: ['Users'],
    }),
    importUsers: build.mutation<unknown, Array<Pick<UserInfo, 'name' | 'full_name' | 'email' | 'role'>>>({
      query: (body) => ({ url: '/api/users/', method: 'POST', body }),
      invalidatesTags: ['Users'],
    }),
    changePassword: build.mutation<unknown, { old_password: string; new_password: string }>({
      query: (body) => ({ url: '/api/users/-/password/change', method: 'POST', body }),
      invalidatesTags: [],
    }),

    /* ---------- access tokens (own) ---------- */
    accessTokenStatus: build.query<{ active: boolean }, AccessTokenScope>({
      query: (scope) => ({ url: `/api/users/-/access-tokens/${scope}/` }),
      providesTags: (_r, _e, scope) => [{ type: 'Users', id: `tokens:${scope}` }],
    }),
    /** Sync device tokens; null when the server has no sync tokens (404). */
    syncTokens: build.query<SyncToken[] | null, void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const r = await baseQuery({ url: '/api/users/-/access-tokens/sync/tokens/' })
        if (r.error) return (r.error as FetchBaseQueryError).status === 404 ? { data: null } : { error: r.error as FetchBaseQueryError }
        return { data: r.data as SyncToken[] }
      },
      providesTags: [{ type: 'Users', id: 'tokens:sync' }],
    }),
    createAccessToken: build.mutation<{ token: string }, { scope: AccessTokenScope; label?: string }>({
      query: ({ scope, label }) =>
        scope === 'sync'
          ? { url: '/api/users/-/access-tokens/sync/tokens/', method: 'POST', body: { label } }
          : { url: `/api/users/-/access-tokens/${scope}/`, method: 'POST', body: {} },
      invalidatesTags: (_r, _e, { scope }) => [{ type: 'Users', id: `tokens:${scope}` }],
    }),
    revokeAccessToken: build.mutation<unknown, { scope: AccessTokenScope; id?: string }>({
      query: ({ scope, id }) => ({
        url: `/api/users/-/access-tokens/${scope}/${id ? `tokens/${enc(id)}/` : ''}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, { scope }) => [{ type: 'Users', id: `tokens:${scope}` }],
    }),

    /* ---------- tree ---------- */
    renameTree: build.mutation<unknown, string>({
      query: (name) => ({ url: '/api/trees/-', method: 'PUT', body: { name } }),
      invalidatesTags: ['Trees', 'Metadata'],
    }),
    /* ---------- admin task starters (see use-task.ts; TASK_TAGS after success) ---------- */
    repairTree: build.mutation<TaskStart, void>({
      query: () => ({ url: '/api/trees/-/repair', method: 'POST' }),
      invalidatesTags: [{ type: 'Tasks', id: 'LIST' }],
    }),
    migrateTree: build.mutation<TaskStart, void>({
      query: () => ({ url: '/api/trees/-/migrate', method: 'POST' }),
      invalidatesTags: [{ type: 'Tasks', id: 'LIST' }],
    }),
    verifyTree: build.mutation<TaskStart, Record<string, string | number | boolean>>({
      query: (params) => ({ url: '/api/trees/-/verify', method: 'POST', params }),
      invalidatesTags: [{ type: 'Tasks', id: 'LIST' }],
    }),
    /** Delete all objects (optionally only some namespaces). */
    deleteAllObjects: build.mutation<TaskStart, { namespaces?: string[] }>({
      query: ({ namespaces }) => ({
        url: '/api/objects/delete/',
        method: 'POST',
        params: namespaces?.length ? { namespaces: namespaces.join(',') } : undefined,
      }),
      invalidatesTags: [{ type: 'Tasks', id: 'LIST' }],
    }),
  }),
})

export const {
  useUserListQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useRemoveUserMutation,
  useImportUsersMutation,
  useChangePasswordMutation,
  useAccessTokenStatusQuery,
  useSyncTokensQuery,
  useCreateAccessTokenMutation,
  useRevokeAccessTokenMutation,
  useRenameTreeMutation,
  useRepairTreeMutation,
  useMigrateTreeMutation,
  useVerifyTreeMutation,
  useDeleteAllObjectsMutation,
} = settingsApi
