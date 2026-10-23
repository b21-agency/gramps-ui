import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { UserInfo } from '@/lib/types'
import { api as baseApi } from '../users-api-slice.gen'
import { pageOf, type Page } from './page'

// Users, the own profile and access tokens. Any user write invalidates the plain 'Users'
// tag, which refreshes the user list and the current user (`getUser('-')`) alike; each
// token scope has its own tag so creating a sync token doesn't refetch the calendar link.

export type AdminUser = UserInfo & { user_id?: string; account_source?: string }

export interface SyncToken {
  id: number
  label: string
  created_at?: string
  last_used_at?: string | null
}

export type AccessTokenScope = 'anniversaries_ics' | 'sync'

const tokenTag = (scope: string) => [{ type: 'Users' as const, id: `tokens:${scope}` }]

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<
  Definitions,
  'getUsers' | 'getUser' | 'getUserAccessToken' | 'getUserAccessTokenList' | 'postUserAccessToken' | 'postUserAccessTokenList'
> & {
  getUsers: OverrideResultType<Definitions['getUsers'], Page<AdminUser>>
  getUser: OverrideResultType<Definitions['getUser'], UserInfo>
  getUserAccessToken: OverrideResultType<Definitions['getUserAccessToken'], { active: boolean }>
  getUserAccessTokenList: OverrideResultType<Definitions['getUserAccessTokenList'], SyncToken[]>
  postUserAccessToken: OverrideResultType<Definitions['postUserAccessToken'], { token: string }>
  postUserAccessTokenList: OverrideResultType<Definitions['postUserAccessTokenList'], { token: string }>
}

export const usersApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    getUsers: {
      transformResponse: (data, meta) => pageOf<AdminUser>(data, meta),
      providesTags: (res) => ['Users', ...(res?.items ?? []).map((u) => ({ type: 'Users' as const, id: u.name }))],
    },
    getUser: { providesTags: ['Users'] },
    postUser: { invalidatesTags: ['Users'] },
    putUser: { invalidatesTags: ['Users'] },
    deleteUser: { invalidatesTags: ['Users'] },
    postUsers: { invalidatesTags: ['Users'] },
    postChangePassword: { invalidatesTags: [] },
    // sends a reset mail; changes nothing we cache
    postTriggerResetPassword: { invalidatesTags: [] },
    getUserAccessToken: { providesTags: (_r, _e, { scope }) => tokenTag(scope) },
    getUserAccessTokenList: { providesTags: (_r, _e, { scope }) => tokenTag(scope) },
    postUserAccessToken: { invalidatesTags: (_r, _e, { scope }) => tokenTag(scope) },
    postUserAccessTokenList: { invalidatesTags: (_r, _e, { scope }) => tokenTag(scope) },
    deleteUserAccessToken: { invalidatesTags: (_r, _e, { scope }) => tokenTag(scope) },
    deleteUserAccessTokenItem: { invalidatesTags: (_r, _e, { scope }) => tokenTag(scope) },
  },
})

export const {
  useGetUsersQuery,
  useGetUserQuery,
  usePostUserMutation,
  usePutUserMutation,
  useDeleteUserMutation,
  usePostUsersMutation,
  usePostChangePasswordMutation,
  useGetUserAccessTokenQuery,
  useGetUserAccessTokenListQuery,
  usePostUserAccessTokenMutation,
  usePostUserAccessTokenListMutation,
  useDeleteUserAccessTokenMutation,
  useDeleteUserAccessTokenItemMutation,
  usePostTriggerResetPasswordMutation,
} = usersApi
