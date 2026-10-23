import type { DefinitionsFromApi, OverrideResultType, TagTypesFromApi } from '@reduxjs/toolkit/query'
import type { Transaction, TransType, UndoCheck } from '@/features/revisions/history'
import { api as baseApi } from '../transactions-api-slice.gen'
import { pageOf, totalOf, type Page } from './page'
import { kindOfEndpoint, tagsForKind, tagsForTransaction, type TxEntry } from './tags'
import type { TaskStart } from './tasks-slice-enhanced'

// Multi-object writes (one transaction for several objects, bulk delete, undo) and the
// change history. Every write answers with the transaction it committed, so exactly the
// objects it touched refresh (plus the lists and derived views).

/** One change of an object (`/transactions/history/objects/{Class}/{handle}`). */
export interface ObjectChange {
  obj_class: string
  trans_type: TransType
  obj_handle: string
  timestamp: number
  transaction_id?: number | null
  connection?: { user?: { name: string; full_name: string } | null } | null
}

export interface HistoryPage<T> {
  items: T[]
  total: number
  page: number
}

type Definitions = DefinitionsFromApi<typeof baseApi>
type TagTypes = TagTypesFromApi<typeof baseApi>
type Enhanced = Omit<
  Definitions,
  | 'postObjects'
  | 'postTransactions'
  | 'postDeleteObjectsByHandle'
  | 'postDeleteObjects'
  | 'getTransactionsHistory'
  | 'getTransactionHistory'
  | 'getTransactionUndo'
  | 'postTransactionUndo'
  | 'getObjectHistory'
> & {
  postObjects: OverrideResultType<Definitions['postObjects'], TxEntry[]>
  postTransactions: OverrideResultType<Definitions['postTransactions'], TxEntry[]>
  postDeleteObjectsByHandle: OverrideResultType<Definitions['postDeleteObjectsByHandle'], TxEntry[]>
  postDeleteObjects: OverrideResultType<Definitions['postDeleteObjects'], TaskStart>
  getTransactionsHistory: OverrideResultType<Definitions['getTransactionsHistory'], HistoryPage<Transaction>>
  getTransactionHistory: OverrideResultType<Definitions['getTransactionHistory'], Transaction>
  getTransactionUndo: OverrideResultType<Definitions['getTransactionUndo'], UndoCheck>
  postTransactionUndo: OverrideResultType<Definitions['postTransactionUndo'], TaskStart>
  getObjectHistory: OverrideResultType<Definitions['getObjectHistory'], Page<ObjectChange>>
}

export const transactionsApi = baseApi.enhanceEndpoints<TagTypes, Enhanced>({
  endpoints: {
    postObjects: { invalidatesTags: (tx) => tagsForTransaction(tx) },
    // undo: the reverse transaction plus the one that was undone
    postTransactions: { invalidatesTags: (back, _e, arg) => tagsForTransaction([...(back ?? []), ...(arg.body as TxEntry[])]) },
    postDeleteObjectsByHandle: {
      invalidatesTags: (tx, _e, arg) =>
        tx?.length ? tagsForTransaction(tx) : tagsForKind(kindOfEndpoint[arg.deleteObjectsByHandleArgs.namespace] ?? 'tag'),
    },
    // background tasks: they change nothing until done; use-task invalidates TASK_TAGS then
    postDeleteObjects: { invalidatesTags: [{ type: 'Tasks', id: 'LIST' }] },
    postTransactionUndo: { invalidatesTags: [{ type: 'Tasks', id: 'LIST' }] },
    getTransactionsHistory: {
      transformResponse: (data, meta, arg) => {
        const items = (Array.isArray(data) ? data : []) as Transaction[]
        return { items, total: totalOf(meta, items.length), page: arg.page ?? 1 }
      },
      providesTags: ['Transactions'],
    },
    getTransactionHistory: { providesTags: ['Transactions'] },
    getTransactionUndo: { providesTags: ['Transactions'] },
    getObjectHistory: { transformResponse: (data, meta) => pageOf<ObjectChange>(data, meta), providesTags: ['Transactions'] },
  },
})

export const {
  usePostObjectsMutation,
  usePostTransactionsMutation,
  usePostDeleteObjectsByHandleMutation,
  usePostDeleteObjectsMutation,
  useGetTransactionsHistoryQuery,
  useGetTransactionHistoryQuery,
  useGetTransactionUndoQuery,
  usePostTransactionUndoMutation,
} = transactionsApi
export type { DeleteObjectsByHandleArgs } from '../transactions-api-slice.gen'
