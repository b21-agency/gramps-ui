// Multi-select on object lists: select rows, then delete them or merge two of them.
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CheckSquare, GitMerge, Loader2, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { fetchObject, mergeObjects } from '@/api/enhanced/objects'
import { usePostDeleteObjectsByHandleMutation, usePostTransactionsMutation } from '@/api/enhanced/transactions-slice-enhanced'
import { endpointOf } from '@/lib/types'
import type { DeleteObjectsByHandleArgs } from '@/api/enhanced/transactions-slice-enhanced'
import { toApiError } from '@/api/enhanced/editor'
import { useAppDispatch } from '@/store'
import { useAuth } from '@/lib/auth'
import { describeObject } from '@/lib/objects'
import type { ObjectKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import { errorMessage } from '@/features/editor/lib'

export interface Selectable {
  handle: string
  gramps_id: string
}

export interface Selection<T extends Selectable> {
  active: boolean
  setActive: (on: boolean) => void
  items: Map<string, T>
  has: (handle: string) => boolean
  toggle: (item: T) => void
  setMany: (items: T[], on: boolean) => void
  clear: () => void
}

/** Selection state; cleared whenever `resetKey` (the result set) changes. */
export function useSelection<T extends Selectable>(resetKey: unknown): Selection<T> {
  const [active, setActiveState] = useState(false)
  const [items, setItems] = useState<Map<string, T>>(() => new Map())
  const k = JSON.stringify(resetKey)
  useEffect(() => setItems(new Map()), [k])
  const toggle = useCallback(
    (item: T) =>
      setItems((prev) => {
        const next = new Map(prev)
        if (next.has(item.handle)) next.delete(item.handle)
        else next.set(item.handle, item)
        return next
      }),
    [],
  )
  const setMany = useCallback(
    (list: T[], on: boolean) =>
      setItems((prev) => {
        const next = new Map(prev)
        for (const it of list) {
          if (on) next.set(it.handle, it)
          else next.delete(it.handle)
        }
        return next
      }),
    [],
  )
  const clear = useCallback(() => setItems(new Map()), [])
  const setActive = useCallback((on: boolean) => {
    setActiveState(on)
    if (!on) setItems(new Map())
  }, [])
  return { active, setActive, items, has: (h) => items.has(h), toggle, setMany, clear }
}

/** Whether the current user may select rows at all (delete or merge). */
export function useCanSelect() {
  const { can } = useAuth()
  return can('DeleteObject') || can('EditObject')
}

export function SelectToggle({ selection, className }: { selection: Selection<Selectable>; className?: string }) {
  const { t } = useTranslation('lists')
  const allowed = useCanSelect()
  if (!allowed) return null
  return (
    <Button
      variant={selection.active ? 'default' : 'outline'}
      className={cn(!selection.active && 'bg-card', className)}
      aria-pressed={selection.active}
      onClick={() => selection.setActive(!selection.active)}
    >
      <CheckSquare />
      <span className="max-sm:sr-only">{t('select.button')}</span>
    </Button>
  )
}

/** Floating bar with the selection count and actions. */
export function SelectionBar<T extends Selectable>({
  kind,
  selection,
  merge,
  onDone,
}: {
  kind: ObjectKind
  selection: Selection<T>
  merge: boolean
  onDone?: () => void
}) {
  const { t } = useTranslation(['lists', 'common', 'editor'])
  const { can } = useAuth()
  const dispatch = useAppDispatch()
  const [deleteByHandle] = usePostDeleteObjectsByHandleMutation()
  const [postTransactions] = usePostTransactionsMutation()
  const [confirm, setConfirm] = useState<'delete' | 'merge' | null>(null)
  const [busy, setBusy] = useState(false)
  const n = selection.items.size
  const list = [...selection.items.values()]
  const what = t(`common:object.${kind}`)
  const label = (o: T) => {
    const d = describeObject(kind, o)
    return d.title && d.title !== o.gramps_id ? `${d.title} (${o.gramps_id})` : o.gramps_id
  }

  if (!selection.active) return null

  const runDelete = async () => {
    setBusy(true)
    try {
      if (kind === 'place') {
        // a place that still encloses other places can't be deleted (as in the classic UI)
        const handles = new Set(list.map((o) => o.handle))
        const backs = (await Promise.all(
          list.map((o) =>
            dispatch(fetchObject('place', { handle: o.handle, backlinks: true, keys: ['backlinks'] })).unwrap(),
          ),
        )) as Array<{ backlinks?: { place?: string[] } }>
        if (backs.some((b) => (b.backlinks?.place ?? []).some((h) => !handles.has(h)))) {
          toast.error(t('select.placeBlocked'), { description: t('select.placeBlockedHint') })
          setConfirm(null)
          return
        }
      }
      // lists, the objects and derived views refresh through the transaction's cache tags
      const tx = await deleteByHandle({
        deleteObjectsByHandleArgs: { namespace: endpointOf[kind] as DeleteObjectsByHandleArgs['namespace'], handles: list.map((o) => o.handle) },
      }).unwrap()
      setConfirm(null)
      selection.setActive(false)
      onDone?.()
      toast.success(t('select.deleted', { count: n }), {
        duration: 10_000,
        action: tx?.length
          ? {
              label: t('editor:undo'),
              onClick: async () => {
                try {
                  await postTransactions({ undo: true, body: tx }).unwrap()
                  toast.success(t('editor:delete.restored'))
                } catch (e) {
                  toast.error(t('editor:delete.undoFailed'), { description: errorMessage(toApiError(e)) })
                }
              },
            }
          : undefined,
      })
    } catch (e) {
      toast.error(t('editor:delete.failed'), { description: errorMessage(toApiError(e)) })
    } finally {
      setBusy(false)
    }
  }

  const runMerge = async (keep: T, other: T) => {
    setBusy(true)
    try {
      await dispatch(mergeObjects(kind, keep.handle, other.handle)).unwrap()
      setConfirm(null)
      selection.setActive(false)
      onDone?.()
      toast.success(t('select.merged', { name: label(keep) }))
    } catch (e) {
      toast.error(t('select.mergeFailed'), { description: errorMessage(toApiError(e)) })
    } finally {
      setBusy(false)
    }
  }

  const canDelete = can('DeleteObject')
  const canMerge = merge && can('EditObject')

  return (
    <>
      <div
        role="toolbar"
        aria-label={t('select.toolbar')}
        className="sticky bottom-[calc(var(--tabbar-h)+0.75rem)] z-20 mx-auto mt-1 mb-3 flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center gap-1.5 rounded-3xl border bg-popover p-2 pl-4 shadow-lg sm:gap-2 sm:pl-5 [&>[data-slot=button]]:h-10 [&>[data-slot=button]]:rounded-full [&>[data-slot=button]]:px-3 sm:[&>[data-slot=button]]:px-4"
      >
        <span className="text-sm tabular-nums" aria-live="polite">
          {t('select.count', { count: n })}
        </span>
        {n > 0 && (
          <Button variant="ghost" size="sm" className="max-sm:hidden" onClick={selection.clear}>
            {t('select.none')}
          </Button>
        )}
        {canMerge && (
          <Button
            variant="outline"
            disabled={n !== 2}
            title={n !== 2 ? t('select.mergeHint') : undefined}
            onClick={() => setConfirm('merge')}
          >
            <GitMerge />
            {t('select.merge')}
          </Button>
        )}
        {canDelete && (
          <Button variant="destructive" disabled={n === 0} onClick={() => setConfirm('delete')}>
            <Trash2 />
            {t('select.delete')}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-10" aria-label={t('select.cancel')} onClick={() => selection.setActive(false)}>
          <X />
        </Button>
      </div>

      <AlertDialog open={confirm === 'delete'} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('select.deleteTitle', { count: n, what })}</AlertDialogTitle>
            <AlertDialogDescription>{t('select.deleteDescription', { count: n })}</AlertDialogDescription>
          </AlertDialogHeader>
          {n <= 8 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {list.map((o) => (
                <li key={o.handle} className="truncate">
                  {label(o)}
                </li>
              ))}
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void runDelete()
              }}
            >
              {busy && <Loader2 className="animate-spin" />}
              {t('select.deleteConfirm', { count: n })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === 'merge' && n === 2} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('select.mergeTitle', { what })}</AlertDialogTitle>
            <AlertDialogDescription>{t('select.mergeDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            {list.slice(0, 2).map((o, i) => (
              <Button
                key={o.handle}
                variant="outline"
                className="h-auto justify-start py-2.5 text-left whitespace-normal"
                disabled={busy}
                onClick={() => void runMerge(o, list[1 - i])}
              >
                <GitMerge className="text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block font-medium">{t('select.keep', { name: label(o) })}</span>
                </span>
              </Button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {t('common:actions.cancel')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
