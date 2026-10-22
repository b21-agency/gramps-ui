import { api } from "./index";
export const addTagTypes = ["Transactions"] as const;
const injectedRtkApi = api
  .enhanceEndpoints({
    addTagTypes,
  })
  .injectEndpoints({
    endpoints: (build) => ({
      postObjects: build.mutation<PostObjectsApiResponse, PostObjectsApiArg>({
        query: () => ({ url: `/api/objects/`, method: "POST" }),
        invalidatesTags: ["Transactions"],
      }),
      postDeleteObjects: build.mutation<
        PostDeleteObjectsApiResponse,
        PostDeleteObjectsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/objects/delete/`,
          method: "POST",
          params: {
            namespaces: queryArg.namespaces,
          },
        }),
        invalidatesTags: ["Transactions"],
      }),
      postDeleteObjectsByHandle: build.mutation<
        PostDeleteObjectsByHandleApiResponse,
        PostDeleteObjectsByHandleApiArg
      >({
        query: (queryArg) => ({
          url: `/api/objects/delete-by-handle/`,
          method: "POST",
          body: queryArg.deleteObjectsByHandleArgs,
        }),
        invalidatesTags: ["Transactions"],
      }),
      postTransactions: build.mutation<
        PostTransactionsApiResponse,
        PostTransactionsApiArg
      >({
        query: (queryArg) => ({
          url: `/api/transactions/`,
          method: "POST",
          params: {
            undo: queryArg.undo,
            message: queryArg.message,
            force: queryArg.force,
            background: queryArg.background,
          },
        }),
        invalidatesTags: ["Transactions"],
      }),
      getTransactionsHistory: build.query<
        GetTransactionsHistoryApiResponse,
        GetTransactionsHistoryApiArg
      >({
        query: (queryArg) => ({
          url: `/api/transactions/history/`,
          params: {
            old: queryArg.old,
            new: queryArg["new"],
            page: queryArg.page,
            pagesize: queryArg.pagesize,
            sort: queryArg.sort,
            before: queryArg.before,
            after: queryArg.after,
            before_id: queryArg.beforeId,
            after_id: queryArg.afterId,
          },
        }),
        providesTags: ["Transactions"],
      }),
      getTransactionHistory: build.query<
        GetTransactionHistoryApiResponse,
        GetTransactionHistoryApiArg
      >({
        query: (queryArg) => ({
          url: `/api/transactions/history/${queryArg.transactionId}`,
          params: {
            old: queryArg.old,
            new: queryArg["new"],
          },
        }),
        providesTags: ["Transactions"],
      }),
      getTransactionUndo: build.query<
        GetTransactionUndoApiResponse,
        GetTransactionUndoApiArg
      >({
        query: (queryArg) => ({
          url: `/api/transactions/history/${queryArg.transactionId}/undo`,
        }),
        providesTags: ["Transactions"],
      }),
      postTransactionUndo: build.mutation<
        PostTransactionUndoApiResponse,
        PostTransactionUndoApiArg
      >({
        query: (queryArg) => ({
          url: `/api/transactions/history/${queryArg.transactionId}/undo`,
          method: "POST",
          params: {
            force: queryArg.force,
            message: queryArg.message,
          },
        }),
        invalidatesTags: ["Transactions"],
      }),
      getObjectHistory: build.query<
        GetObjectHistoryApiResponse,
        GetObjectHistoryApiArg
      >({
        query: (queryArg) => ({
          url: `/api/transactions/history/objects/${queryArg.objClass}/${queryArg.objHandle}`,
          params: {
            old: queryArg.old,
            new: queryArg["new"],
            page: queryArg.page,
            pagesize: queryArg.pagesize,
            sort: queryArg.sort,
            before: queryArg.before,
            after: queryArg.after,
          },
        }),
        providesTags: ["Transactions"],
      }),
    }),
    overrideExisting: false,
  });
export { injectedRtkApi as api };
export type PostObjectsApiResponse = /** status 201 Created */ Transaction[];
export type PostObjectsApiArg = void;
export type PostDeleteObjectsApiResponse = /** status 200 OK */ TaskReference;
export type PostDeleteObjectsApiArg = {
  /** Comma-delimited list of object types to delete (e.g. 'people,families,events'). */
  namespaces?: string[];
};
export type PostDeleteObjectsByHandleApiResponse =
  /** status 200 OK */ Transaction[];
export type PostDeleteObjectsByHandleApiArg = {
  deleteObjectsByHandleArgs: DeleteObjectsByHandleArgs;
};
export type PostTransactionsApiResponse = /** status 200 OK */ Transaction[];
export type PostTransactionsApiArg = {
  /** If true, apply the inverse of the transaction. */
  undo?: boolean;
  /** Message to use for the transaction in the undo log. */
  message?: string;
  /** If true, force applying the transaction even if objects have been modified. */
  force?: boolean;
  /** If true and Celery is configured, apply the transactions in the background and return HTTP 202. Use this for anything but a few objects. */
  background?: boolean;
};
export type GetTransactionsHistoryApiResponse =
  /** status 200 OK */ UndoTransaction[];
export type GetTransactionsHistoryApiArg = {
  /** If true, include the raw object data before the change. */
  old?: boolean;
  /** If true, include the raw object data after the change. */
  new?: boolean;
  /** Page number of the result subset to return. If omitted, all results are returned. */
  page?: number;
  /** Number of items per page when pagination is active. */
  pagesize?: number;
  /** Sort order for transactions. Use 'id' for ascending or '-id' for descending. */
  sort?: string;
  /** Unix timestamp; if provided, return only transactions committed before this time. */
  before?: number | null;
  /** Unix timestamp; if provided, return only transactions committed after this time. */
  after?: number | null;
  /** Transaction ID; if provided, return only transactions with an id strictly less than this value. Unlike the timestamp-based `before`/`after` cursor, this is exact and has no floating-point precision loss. */
  beforeId?: number | null;
  /** Transaction ID; if provided, return only transactions with an id strictly greater than this value. Unlike the timestamp-based `before`/`after` cursor, this is exact and has no floating-point precision loss. 0 means 'from the beginning'. */
  afterId?: number | null;
};
export type GetTransactionHistoryApiResponse =
  /** status 200 OK */ UndoTransaction;
export type GetTransactionHistoryApiArg = {
  transactionId: number;
  /** If true, include the raw object data before the change. */
  old?: boolean;
  /** If true, include the raw object data after the change. */
  new?: boolean;
};
export type GetTransactionUndoApiResponse = unknown;
export type GetTransactionUndoApiArg = {
  transactionId: number;
};
export type PostTransactionUndoApiResponse = unknown;
export type PostTransactionUndoApiArg = {
  transactionId: number;
  /** If true, force the undo even if there are conflicts. */
  force?: boolean;
  /** Message to use for the transaction in the undo log. Defaults to 'Undo'. */
  message?: string | null;
};
export type GetObjectHistoryApiResponse = /** status 200 OK */ ObjectChange[];
export type GetObjectHistoryApiArg = {
  objClass: string;
  objHandle: string;
  /** If true, include the raw object data before the change. */
  old?: boolean;
  /** If true, include the raw object data after the change. */
  new?: boolean;
  /** Page number of the result subset to return. If omitted, all results are returned. */
  page?: number;
  /** Number of items per page when pagination is active. */
  pagesize?: number;
  /** Sort order for changes. Use 'id' for ascending or '-id' for descending (by timestamp). */
  sort?: string;
  /** Unix timestamp; if provided, return only changes committed before this time. */
  before?: number | null;
  /** Unix timestamp; if provided, return only changes committed after this time. */
  after?: number | null;
};
export type Transaction = {
  /** Action type: 'add', 'update', or 'delete'. */
  type?: string;
  /** Object class name (e.g. 'Person', 'Event'). */
  _class?: string;
  /** Handle of the affected object. */
  handle?: string;
  /** Object state before the change (null for adds). */
  old?: any;
  /** Object state after the change (null for deletes). */
  new?: any;
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
export type TaskReference = {
  /** URL of the task status endpoint. */
  href?: string;
  /** Unique identifier of the task. */
  id?: string;
  [key: string]: any;
};
export type DeleteObjectsByHandleArgs = {
  /** Object type of the objects to delete (e.g. 'people'). */
  namespace:
    | "people"
    | "families"
    | "events"
    | "places"
    | "citations"
    | "sources"
    | "repositories"
    | "media"
    | "notes"
    | "tags";
  /** List of handles of the objects to delete. */
  handles: string[];
};
export type UndoTransaction = {
  /** Transaction ID. */
  id?: number;
  /** Internal connection object. */
  connection?: any;
  /** ID of the first change in this transaction. */
  first?: number;
  /** ID of the last change in this transaction. */
  last?: number;
  /** Whether this transaction is from an undo action. */
  undo?: boolean;
  /** Unix timestamp when the transaction was committed. */
  timestamp?: number;
  /** List of individual object changes. */
  changes?: any[];
  [key: string]: any;
};
export type ObjectChange = {
  /** Change ID (unique only within its connection). */
  id?: number;
  /** Internal connection object. */
  connection?: any;
  /** ID of the transaction this change was part of, if known. */
  transaction_id?: number | null;
  /** Object class name (e.g. 'Person', 'Event'). */
  obj_class?: string;
  /** Handle of the changed object. */
  obj_handle?: string;
  /** Handle of a referenced object, if this change is a reference update. */
  ref_handle?: string;
  /** Change type: 0 (add), 1 (update), or 2 (delete). */
  trans_type?: number;
  /** Unix timestamp when the change was committed. */
  timestamp?: number;
  /** Object state before the change (only included if requested). */
  old_data?: any;
  /** Object state after the change (only included if requested). */
  new_data?: any;
  [key: string]: any;
};
export const {
  usePostObjectsMutation,
  usePostDeleteObjectsMutation,
  usePostDeleteObjectsByHandleMutation,
  usePostTransactionsMutation,
  useGetTransactionsHistoryQuery,
  useLazyGetTransactionsHistoryQuery,
  useGetTransactionHistoryQuery,
  useLazyGetTransactionHistoryQuery,
  useGetTransactionUndoQuery,
  useLazyGetTransactionUndoQuery,
  usePostTransactionUndoMutation,
  useGetObjectHistoryQuery,
  useLazyGetObjectHistoryQuery,
} = injectedRtkApi;
