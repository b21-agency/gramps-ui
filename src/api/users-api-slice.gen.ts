import { api } from "./index";
export const addTagTypes = ["Token", "OIDC", "Users"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      postToken: build.mutation<PostTokenApiResponse, PostTokenApiArg>({
        query: (queryArg) => ({
          url: `/api/token/`,
          method: "POST",
          body: queryArg.tokenLogin,
        }),
        invalidatesTags: ["Token"],
      }),
      postTokenRefresh: build.mutation<
        PostTokenRefreshApiResponse,
        PostTokenRefreshApiArg
      >({
        query: () => ({ url: `/api/token/refresh/`, method: "POST" }),
        invalidatesTags: ["Token"],
      }),
      postTokenSync: build.mutation<
        PostTokenSyncApiResponse,
        PostTokenSyncApiArg
      >({
        query: (queryArg) => ({
          url: `/api/token/sync/`,
          method: "POST",
          body: queryArg.tokenSync,
        }),
        invalidatesTags: ["Token"],
      }),
      getTokenCreateOwner: build.query<
        GetTokenCreateOwnerApiResponse,
        GetTokenCreateOwnerApiArg
      >({
        query: () => ({ url: `/api/token/create_owner/` }),
        providesTags: ["Token"],
      }),
      postTokenCreateOwner: build.mutation<
        PostTokenCreateOwnerApiResponse,
        PostTokenCreateOwnerApiArg
      >({
        query: (queryArg) => ({
          url: `/api/token/create_owner/`,
          method: "POST",
          body: queryArg.tokenCreateOwnerPost,
        }),
        invalidatesTags: ["Token"],
      }),
      getOidcloginresource: build.query<
        GetOidcloginresourceApiResponse,
        GetOidcloginresourceApiArg
      >({
        query: (queryArg) => ({
          url: `/api/oidc/login/`,
          params: {
            provider: queryArg.provider,
            tree: queryArg.tree,
            link: queryArg.link,
          },
        }),
        providesTags: ["OIDC"],
      }),
      getOidccallbackresource: build.query<
        GetOidccallbackresourceApiResponse,
        GetOidccallbackresourceApiArg
      >({
        query: (queryArg) => ({
          url: `/api/oidc/callback/`,
          params: {
            provider: queryArg.provider,
            tree: queryArg.tree,
            code: queryArg.code,
            state: queryArg.state,
            session_state: queryArg.sessionState,
            error: queryArg.error,
            error_description: queryArg.errorDescription,
          },
        }),
        providesTags: ["OIDC"],
      }),
      getOidccallbackresourceProvider: build.query<
        GetOidccallbackresourceProviderApiResponse,
        GetOidccallbackresourceProviderApiArg
      >({
        query: (queryArg) => ({
          url: `/api/oidc/callback/${queryArg.providerId}`,
          params: {
            provider: queryArg.provider,
            tree: queryArg.tree,
            code: queryArg.code,
            state: queryArg.state,
            session_state: queryArg.sessionState,
            error: queryArg.error,
            error_description: queryArg.errorDescription,
          },
        }),
        providesTags: ["OIDC"],
      }),
      getOidcconfigresource: build.query<
        GetOidcconfigresourceApiResponse,
        GetOidcconfigresourceApiArg
      >({
        query: () => ({ url: `/api/oidc/config/` }),
        providesTags: ["OIDC"],
      }),
      postOidctokenexchangeresource: build.mutation<
        PostOidctokenexchangeresourceApiResponse,
        PostOidctokenexchangeresourceApiArg
      >({
        query: (queryArg) => ({
          url: `/api/oidc/tokens/`,
          method: "POST",
          body: queryArg.oidcTokenExchange,
        }),
        invalidatesTags: ["OIDC"],
      }),
      getOidclogoutresource: build.query<
        GetOidclogoutresourceApiResponse,
        GetOidclogoutresourceApiArg
      >({
        query: (queryArg) => ({
          url: `/api/oidc/logout/`,
          params: {
            provider: queryArg.provider,
            id_token: queryArg.idToken,
            post_logout_redirect_uri: queryArg.postLogoutRedirectUri,
          },
        }),
        providesTags: ["OIDC"],
      }),
      postOidclinkresource: build.mutation<
        PostOidclinkresourceApiResponse,
        PostOidclinkresourceApiArg
      >({
        query: (queryArg) => ({
          url: `/api/oidc/link/`,
          method: "POST",
          body: queryArg.oidcLink,
        }),
        invalidatesTags: ["OIDC"],
      }),
      postOidclinkcompleteresource: build.mutation<
        PostOidclinkcompleteresourceApiResponse,
        PostOidclinkcompleteresourceApiArg
      >({
        query: (queryArg) => ({
          url: `/api/oidc/link/complete/`,
          method: "POST",
          body: queryArg.oidcLinkComplete,
        }),
        invalidatesTags: ["OIDC"],
      }),
      getUsers: build.query<GetUsersApiResponse, GetUsersApiArg>({
        query: (queryArg) => ({
          url: `/api/users/`,
          params: {
            user_id: queryArg.userId,
            tree: queryArg.tree,
            role: queryArg.role,
            page: queryArg.page,
            pagesize: queryArg.pagesize,
          },
        }),
        providesTags: ["Users"],
      }),
      postUsers: build.mutation<PostUsersApiResponse, PostUsersApiArg>({
        query: () => ({ url: `/api/users/`, method: "POST" }),
        invalidatesTags: ["Users"],
      }),
      getUser: build.query<GetUserApiResponse, GetUserApiArg>({
        query: (queryArg) => ({ url: `/api/users/${queryArg.userName}/` }),
        providesTags: ["Users"],
      }),
      postUser: build.mutation<PostUserApiResponse, PostUserApiArg>({
        query: (queryArg) => ({
          url: `/api/users/${queryArg.userName}/`,
          method: "POST",
          body: queryArg.userPostBodyArgs,
        }),
        invalidatesTags: ["Users"],
      }),
      putUser: build.mutation<PutUserApiResponse, PutUserApiArg>({
        query: (queryArg) => ({
          url: `/api/users/${queryArg.userName}/`,
          method: "PUT",
          body: queryArg.userPutBodyArgs,
        }),
        invalidatesTags: ["Users"],
      }),
      deleteUser: build.mutation<DeleteUserApiResponse, DeleteUserApiArg>({
        query: (queryArg) => ({
          url: `/api/users/${queryArg.userName}/`,
          method: "DELETE",
        }),
        invalidatesTags: ["Users"],
      }),
      getUserPushSubscriptions: build.query<
        GetUserPushSubscriptionsApiResponse,
        GetUserPushSubscriptionsApiArg
      >({
        query: () => ({ url: `/api/users/-/push-subscriptions/` }),
        providesTags: ["Users"],
      }),
      postUserPushSubscriptions: build.mutation<
        PostUserPushSubscriptionsApiResponse,
        PostUserPushSubscriptionsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/push-subscriptions/`,
          method: "POST",
          body: queryArg.pushSubscriptionBody,
        }),
        invalidatesTags: ["Users"],
      }),
      deleteUserPushSubscriptions: build.mutation<
        DeleteUserPushSubscriptionsApiResponse,
        DeleteUserPushSubscriptionsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/push-subscriptions/`,
          method: "DELETE",
          body: queryArg.pushSubscriptionDelete,
        }),
        invalidatesTags: ["Users"],
      }),
      getUserAccessToken: build.query<
        GetUserAccessTokenApiResponse,
        GetUserAccessTokenApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/access-tokens/${queryArg.scope}/`,
        }),
        providesTags: ["Users"],
      }),
      postUserAccessToken: build.mutation<
        PostUserAccessTokenApiResponse,
        PostUserAccessTokenApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/access-tokens/${queryArg.scope}/`,
          method: "POST",
        }),
        invalidatesTags: ["Users"],
      }),
      deleteUserAccessToken: build.mutation<
        DeleteUserAccessTokenApiResponse,
        DeleteUserAccessTokenApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/access-tokens/${queryArg.scope}/`,
          method: "DELETE",
        }),
        invalidatesTags: ["Users"],
      }),
      getUserAccessTokenList: build.query<
        GetUserAccessTokenListApiResponse,
        GetUserAccessTokenListApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/access-tokens/${queryArg.scope}/tokens/`,
        }),
        providesTags: ["Users"],
      }),
      postUserAccessTokenList: build.mutation<
        PostUserAccessTokenListApiResponse,
        PostUserAccessTokenListApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/access-tokens/${queryArg.scope}/tokens/`,
          method: "POST",
          body: queryArg.accessTokenLabel,
        }),
        invalidatesTags: ["Users"],
      }),
      deleteUserAccessTokenItem: build.mutation<
        DeleteUserAccessTokenItemApiResponse,
        DeleteUserAccessTokenItemApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/access-tokens/${queryArg.scope}/tokens/${queryArg.tokenId}/`,
          method: "DELETE",
        }),
        invalidatesTags: ["Users"],
      }),
      postRegister: build.mutation<PostRegisterApiResponse, PostRegisterApiArg>(
        {
          query: (queryArg) => ({
            url: `/api/users/${queryArg.userName}/register/`,
            method: "POST",
            body: queryArg.userRegisterBodyArgs,
          }),
          invalidatesTags: ["Users"],
        },
      ),
      postUserCreateOwner: build.mutation<
        PostUserCreateOwnerApiResponse,
        PostUserCreateOwnerApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/${queryArg.userName}/create_owner/`,
          method: "POST",
          body: queryArg.userCreateOwnerBodyArgs,
        }),
        invalidatesTags: ["Users"],
      }),
      getConfirmEmail: build.query<
        GetConfirmEmailApiResponse,
        GetConfirmEmailApiArg
      >({
        query: () => ({ url: `/api/users/-/email/confirm/` }),
        providesTags: ["Users"],
      }),
      postChangePassword: build.mutation<
        PostChangePasswordApiResponse,
        PostChangePasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/${queryArg.userName}/password/change`,
          method: "POST",
          body: queryArg.userChangePasswordBodyArgs,
        }),
        invalidatesTags: ["Users"],
      }),
      getResetPassword: build.query<
        GetResetPasswordApiResponse,
        GetResetPasswordApiArg
      >({
        query: () => ({ url: `/api/users/-/password/reset/` }),
        providesTags: ["Users"],
      }),
      postResetPassword: build.mutation<
        PostResetPasswordApiResponse,
        PostResetPasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/password/reset/`,
          method: "POST",
          body: queryArg.userResetPasswordBodyArgs,
        }),
        invalidatesTags: ["Users"],
      }),
      postTriggerResetPassword: build.mutation<
        PostTriggerResetPasswordApiResponse,
        PostTriggerResetPasswordApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/${queryArg.userName}/password/reset/trigger/`,
          method: "POST",
        }),
        invalidatesTags: ["Users"],
      }),
      getUserOidcAccounts: build.query<
        GetUserOidcAccountsApiResponse,
        GetUserOidcAccountsApiArg
      >({
        query: () => ({ url: `/api/users/-/oidc-accounts/` }),
        providesTags: ["Users"],
      }),
      deleteUserOidcAccount: build.mutation<
        DeleteUserOidcAccountApiResponse,
        DeleteUserOidcAccountApiArg
      >({
        query: (queryArg) => ({
          url: `/api/users/-/oidc-accounts/${queryArg.accountId}/`,
          method: "DELETE",
          body: queryArg.userOidcUnlink,
        }),
        invalidatesTags: ["Users"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type PostTokenApiResponse = /** status 200 OK */ TokenPair;
export type PostTokenApiArg = {
  tokenLogin: TokenLoginWrite;
};
export type PostTokenRefreshApiResponse = /** status 200 OK */ Token;
export type PostTokenRefreshApiArg = void;
export type PostTokenSyncApiResponse = /** status 200 OK */ Token;
export type PostTokenSyncApiArg = {
  tokenSync: TokenSyncWrite;
};
export type GetTokenCreateOwnerApiResponse = /** status 200 OK */ Token;
export type GetTokenCreateOwnerApiArg = void;
export type PostTokenCreateOwnerApiResponse = /** status 201 Created */ Token;
export type PostTokenCreateOwnerApiArg = {
  tokenCreateOwnerPost: TokenCreateOwnerPost;
};
export type GetOidcloginresourceApiResponse = unknown;
export type GetOidcloginresourceApiArg = {
  /** The OIDC provider ID (e.g. 'google', 'microsoft'). */
  provider: string;
  /** ID of the tree to associate with the OIDC login. Required for multi-tree installations, optional in single-tree ones. Ignored when linking. */
  tree?: string;
  /** Ticket from /oidc/link/. If given, the callback returns a code for linking the identity instead of logging in. */
  link?: string;
};
export type GetOidccallbackresourceApiResponse = unknown;
export type GetOidccallbackresourceApiArg = {
  /** The OIDC provider ID (e.g. 'google', 'microsoft'). */
  provider?: string;
  /** ID of the tree to associate with the OIDC login. Deprecated: the tree is now carried in the session from /oidc/login/, since providers require an exact redirect URI match. */
  tree?: string;
  /** Authorization code returned by the OIDC provider. */
  code?: string;
  /** State parameter returned by the OIDC provider. */
  state?: string;
  /** Session state parameter returned by the OIDC provider. */
  sessionState?: string;
  /** Error code returned by the OIDC provider. */
  error?: string;
  /** Error description returned by the OIDC provider. */
  errorDescription?: string;
};
export type GetOidccallbackresourceProviderApiResponse = unknown;
export type GetOidccallbackresourceProviderApiArg = {
  providerId: string;
  /** The OIDC provider ID (e.g. 'google', 'microsoft'). */
  provider?: string;
  /** ID of the tree to associate with the OIDC login. Deprecated: the tree is now carried in the session from /oidc/login/, since providers require an exact redirect URI match. */
  tree?: string;
  /** Authorization code returned by the OIDC provider. */
  code?: string;
  /** State parameter returned by the OIDC provider. */
  state?: string;
  /** Session state parameter returned by the OIDC provider. */
  sessionState?: string;
  /** Error code returned by the OIDC provider. */
  error?: string;
  /** Error description returned by the OIDC provider. */
  errorDescription?: string;
};
export type GetOidcconfigresourceApiResponse = /** status 200 OK */ OidcConfig;
export type GetOidcconfigresourceApiArg = void;
export type PostOidctokenexchangeresourceApiResponse =
  /** status 200 OK */ OidcTokens;
export type PostOidctokenexchangeresourceApiArg = {
  oidcTokenExchange: OidcTokenExchange;
};
export type GetOidclogoutresourceApiResponse = /** status 200 OK */ OidcLogout;
export type GetOidclogoutresourceApiArg = {
  /** The OIDC provider ID (e.g. 'google', 'microsoft'). */
  provider: string;
  /** ID token to use as id_token_hint for logout. */
  idToken?: string;
  /** URI to redirect to after logout. */
  postLogoutRedirectUri?: string;
};
export type PostOidclinkresourceApiResponse =
  /** status 200 OK */ OidcLinkTicket;
export type PostOidclinkresourceApiArg = {
  oidcLink: OidcLink;
};
export type PostOidclinkcompleteresourceApiResponse =
  /** status 200 OK */ OidcLinked;
export type PostOidclinkcompleteresourceApiArg = {
  oidcLinkComplete: OidcLinkComplete;
};
export type GetUsersApiResponse = /** status 200 OK */ User[];
export type GetUsersApiArg = {
  /** Filter to a single user by their UUID. */
  userId?: string | null;
  /** Filter to the users of a single tree by its tree ID. Filtering by a tree other than one's own requires site admin permissions. */
  tree?: string | null;
  /** Filter to users having any of these integer role IDs, e.g. `-2,-1` for unconfirmed and disabled accounts. */
  role?: number[];
  /** Page number of the result subset to return. If omitted, all results are returned. */
  page?: number;
  /** Number of users per page when pagination is active. */
  pagesize?: number;
};
export type PostUsersApiResponse = unknown;
export type PostUsersApiArg = void;
export type GetUserApiResponse = /** status 200 OK */ User;
export type GetUserApiArg = {
  userName: string;
};
export type PostUserApiResponse = unknown;
export type PostUserApiArg = {
  userName: string;
  userPostBodyArgs: UserPostBodyArgs;
};
export type PutUserApiResponse = unknown;
export type PutUserApiArg = {
  userName: string;
  userPutBodyArgs: UserPutBodyArgs;
};
export type DeleteUserApiResponse = unknown;
export type DeleteUserApiArg = {
  userName: string;
};
export type GetUserPushSubscriptionsApiResponse =
  /** status 200 OK */ PushSubscriptionConfig;
export type GetUserPushSubscriptionsApiArg = void;
export type PostUserPushSubscriptionsApiResponse = unknown;
export type PostUserPushSubscriptionsApiArg = {
  pushSubscriptionBody: PushSubscriptionBody;
};
export type DeleteUserPushSubscriptionsApiResponse = unknown;
export type DeleteUserPushSubscriptionsApiArg = {
  pushSubscriptionDelete: PushSubscriptionDelete;
};
export type GetUserAccessTokenApiResponse =
  /** status 200 OK */ AccessTokenStatus;
export type GetUserAccessTokenApiArg = {
  scope: string;
};
export type PostUserAccessTokenApiResponse =
  /** status 200 OK */ AccessTokenCreate;
export type PostUserAccessTokenApiArg = {
  scope: string;
};
export type DeleteUserAccessTokenApiResponse =
  /** status 200 OK */ AccessTokenStatus;
export type DeleteUserAccessTokenApiArg = {
  scope: string;
};
export type GetUserAccessTokenListApiResponse =
  /** status 200 OK */ AccessTokenInfo[];
export type GetUserAccessTokenListApiArg = {
  scope: string;
};
export type PostUserAccessTokenListApiResponse =
  /** status 201 Created */ AccessTokenInfoCreate;
export type PostUserAccessTokenListApiArg = {
  scope: string;
  accessTokenLabel: AccessTokenLabel;
};
export type DeleteUserAccessTokenItemApiResponse = unknown;
export type DeleteUserAccessTokenItemApiArg = {
  scope: string;
  tokenId: number;
};
export type PostRegisterApiResponse = unknown;
export type PostRegisterApiArg = {
  userName: string;
  userRegisterBodyArgs: UserRegisterBodyArgs;
};
export type PostUserCreateOwnerApiResponse = unknown;
export type PostUserCreateOwnerApiArg = {
  userName: string;
  userCreateOwnerBodyArgs: UserCreateOwnerBodyArgs;
};
export type GetConfirmEmailApiResponse = unknown;
export type GetConfirmEmailApiArg = void;
export type PostChangePasswordApiResponse = unknown;
export type PostChangePasswordApiArg = {
  userName: string;
  userChangePasswordBodyArgs: UserChangePasswordBodyArgs;
};
export type GetResetPasswordApiResponse = unknown;
export type GetResetPasswordApiArg = void;
export type PostResetPasswordApiResponse = unknown;
export type PostResetPasswordApiArg = {
  userResetPasswordBodyArgs: UserResetPasswordBodyArgs;
};
export type PostTriggerResetPasswordApiResponse = unknown;
export type PostTriggerResetPasswordApiArg = {
  userName: string;
};
export type GetUserOidcAccountsApiResponse =
  /** status 200 OK */ UserOidcAccount[];
export type GetUserOidcAccountsApiArg = void;
export type DeleteUserOidcAccountApiResponse = unknown;
export type DeleteUserOidcAccountApiArg = {
  accountId: number;
  userOidcUnlink: UserOidcUnlink;
};
export type TokenPair = {
  /** A valid JWT access token. */
  access_token: string;
  /** A valid JWT refresh token. */
  refresh_token: string;
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
export type TokenLogin = {
  /** The username for authentication. */
  username: string;
};
export type TokenLoginWrite = {
  /** The username for authentication. */
  username: string;
  /** The user's password. */
  password: string;
};
export type Token = {
  /** A valid JWT access token. */
  access_token: string;
};
export type TokenSync = {};
export type TokenSyncWrite = {
  /** A persistent access token with the sync scope. */
  token: string;
};
export type TokenCreateOwnerPost = {
  /** Tree ID to authenticate against (multi-tree mode). */
  tree?: string | null;
};
export type OidcProvider = {
  /** Provider identifier (e.g. 'google'). */
  id?: string;
  /** Human-readable provider name (e.g. 'Google'). */
  name?: string;
  /** URL to initiate login with this provider. */
  login_url?: string;
  [key: string]: any;
};
export type OidcConfig = {
  /** Whether OIDC authentication is enabled. */
  enabled?: boolean;
  /** List of configured OIDC providers. */
  providers?: OidcProvider[];
  /** Whether local username/password authentication is disabled. */
  disable_local_auth?: boolean;
  /** Whether to auto-redirect when only one provider is configured. */
  auto_redirect?: boolean;
  [key: string]: any;
};
export type OidcTokens = {
  /** JWT access token. */
  access_token?: string;
  /** JWT refresh token. */
  refresh_token?: string;
  /** Token type, always 'Bearer'. */
  token_type?: string;
  /** OIDC ID token, if the provider issued one. Needed to pass as id_token_hint when logging out. */
  id_token?: string;
  [key: string]: any;
};
export type OidcTokenExchange = {
  /** Single-use code from the fragment of the OIDC login redirect. */
  code: string;
  [key: string]: any;
};
export type OidcLogout = {
  /** URL to redirect to in order to end the session at the provider, or null if the provider does not support it. */
  logout_url?: string | null;
  [key: string]: any;
};
export type OidcLinkTicket = {
  /** Short-lived, single-use ticket to pass as `link` to /oidc/login/. */
  ticket?: string;
  [key: string]: any;
};
export type OidcLink = {
  /** ID of the OIDC provider to link, e.g. 'custom'. */
  provider: string;
  [key: string]: any;
};
export type OidcLinked = {
  /** ID of the OIDC provider that was linked. */
  provider?: string;
  [key: string]: any;
};
export type OidcLinkComplete = {
  /** Single-use `link_code` from the fragment of the redirect after linking at the provider. */
  code: string;
  [key: string]: any;
};
export type UserOidcAccount = {
  /** ID of the link, used to unlink the account. */
  id?: number;
  /** ID of the OIDC provider. */
  provider_id?: string;
  /** Subject identifier of the user at the provider. */
  subject_id?: string;
  /** E-mail address reported by the provider. */
  email?: string | null;
  /** Date and time the account was linked. */
  created_at?: string;
  [key: string]: any;
};
export type User = {
  /** User name. */
  name?: string;
  /** Unique identifier of the user. */
  user_id?: string;
  /** E-mail address of the user. */
  email?: string | null;
  /** Full name of the user. */
  full_name?: string | null;
  /** Integer role ID: 5 admin, 4 owner, 3 editor, 2 contributor, 1 member, 0 guest, -1 disabled, -2 unconfirmed. */
  role?: number;
  /** ID of the tree the user belongs to; empty for treeless site admins. */
  tree?: string | null;
  /** OIDC accounts linked to the user. Only present if OIDC is enabled and, for a single user, if the caller may view other users. */
  oidc_accounts?: UserOidcAccount[];
  /** Where the account comes from: `Local` or the OIDC provider's display name. Only present in the user list if OIDC is enabled. */
  account_source?: string;
  [key: string]: any;
};
export type UserPostBodyArgs = {
  /** The user's e-mail address. */
  email: string;
  /** The user's full name. */
  full_name: string;
  /** The user's password. */
  password: string;
  /** Integer user role ID. */
  role: number;
  /** Tree ID the user belongs to. */
  tree?: string;
};
export type UserPutBodyArgs = {
  /** The user's e-mail address. */
  email?: string;
  /** The user's full name. */
  full_name?: string;
  /** New username when renaming the user. */
  name_new?: string;
  /** Integer user role ID. */
  role?: number;
  /** Tree ID the user belongs to. */
  tree?: string;
};
export type PushSubscriptionConfig = {
  /** VAPID public key, or null when Web Push is not configured. */
  public_key: string | null;
};
export type PushSubscriptionKeys = {
  /** P-256 ECDH public key for payload encryption. */
  p256dh: string;
  /** Authentication secret for payload encryption. */
  auth: string;
};
export type PushSubscriptionBody = {
  /** HTTPS endpoint assigned by the push service. */
  endpoint: string;
  /** Encryption keys assigned to this subscription. */
  keys: PushSubscriptionKeys;
};
export type PushSubscriptionDelete = {
  /** Endpoint of the subscription to delete. */
  endpoint: string;
};
export type AccessTokenStatus = {
  /** Whether a token is currently active. */
  active: boolean;
};
export type AccessTokenCreate = {
  /** Whether a token is currently active. */
  active: boolean;
  /** Newly created persistent token value. */
  token: string;
};
export type AccessTokenInfo = {
  /** ID of the token, used to revoke it. */
  id: number;
  /** Name of the device or client using the token. */
  label: string;
  /** When the token was created (UTC). */
  created_at: string;
  /** When the token was last used (UTC), if ever. */
  last_used_at?: string | null;
};
export type AccessTokenInfoCreate = {
  /** ID of the token, used to revoke it. */
  id: number;
  /** Name of the device or client using the token. */
  label: string;
  /** When the token was created (UTC). */
  created_at: string;
  /** When the token was last used (UTC), if ever. */
  last_used_at?: string | null;
  /** The token value. It is only returned once and can't be retrieved later. */
  token: string;
};
export type AccessTokenLabel = {
  /** Name of the device or client using the token, unique among the user's tokens of this scope. */
  label: string;
};
export type UserRegisterBodyArgs = {
  /** The user's e-mail address. */
  email: string;
  /** The user's full name. */
  full_name: string;
  /** The user's password. */
  password: string;
  /** Tree ID the user belongs to. */
  tree?: string;
};
export type UserCreateOwnerBodyArgs = {
  /** The user's e-mail address. */
  email: string;
  /** The user's full name. */
  full_name: string;
  /** The user's password. */
  password: string;
  /** Tree ID the user belongs to. */
  tree?: string;
};
export type UserChangePasswordBodyArgs = {
  /** The current (old) password. */
  old_password: string;
  /** The new password. */
  new_password: string;
};
export type UserResetPasswordBodyArgs = {
  /** The new password. */
  new_password: string;
};
export type UserOidcUnlink = {
  /** The user's current password. Required to unlink their last OIDC account. */
  password?: string | null;
  [key: string]: any;
};
export const {
  usePostTokenMutation,
  usePostTokenRefreshMutation,
  usePostTokenSyncMutation,
  useGetTokenCreateOwnerQuery,
  useLazyGetTokenCreateOwnerQuery,
  usePostTokenCreateOwnerMutation,
  useGetOidcloginresourceQuery,
  useLazyGetOidcloginresourceQuery,
  useGetOidccallbackresourceQuery,
  useLazyGetOidccallbackresourceQuery,
  useGetOidccallbackresourceProviderQuery,
  useLazyGetOidccallbackresourceProviderQuery,
  useGetOidcconfigresourceQuery,
  useLazyGetOidcconfigresourceQuery,
  usePostOidctokenexchangeresourceMutation,
  useGetOidclogoutresourceQuery,
  useLazyGetOidclogoutresourceQuery,
  usePostOidclinkresourceMutation,
  usePostOidclinkcompleteresourceMutation,
  useGetUsersQuery,
  useLazyGetUsersQuery,
  usePostUsersMutation,
  useGetUserQuery,
  useLazyGetUserQuery,
  usePostUserMutation,
  usePutUserMutation,
  useDeleteUserMutation,
  useGetUserPushSubscriptionsQuery,
  useLazyGetUserPushSubscriptionsQuery,
  usePostUserPushSubscriptionsMutation,
  useDeleteUserPushSubscriptionsMutation,
  useGetUserAccessTokenQuery,
  useLazyGetUserAccessTokenQuery,
  usePostUserAccessTokenMutation,
  useDeleteUserAccessTokenMutation,
  useGetUserAccessTokenListQuery,
  useLazyGetUserAccessTokenListQuery,
  usePostUserAccessTokenListMutation,
  useDeleteUserAccessTokenItemMutation,
  usePostRegisterMutation,
  usePostUserCreateOwnerMutation,
  useGetConfirmEmailQuery,
  useLazyGetConfirmEmailQuery,
  usePostChangePasswordMutation,
  useGetResetPasswordQuery,
  useLazyGetResetPasswordQuery,
  usePostResetPasswordMutation,
  usePostTriggerResetPasswordMutation,
  useGetUserOidcAccountsQuery,
  useLazyGetUserOidcAccountsQuery,
  useDeleteUserOidcAccountMutation,
} = injectedRtkApi;
