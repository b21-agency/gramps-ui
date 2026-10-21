import { lazy, Suspense, useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { describeObject, objectPath } from '@/lib/objects'
import { endpointOf, type ObjectKind } from '@/lib/types'
import {
  deleteObject,
  endpointsOfTx,
  errorMessage,
  invalidateAfterWrite,
  listPathOf,
  toWritable,
  undoTransaction,
  extendedObjects,
  type AnyObj,
} from './lib'

const ObjectEditor = lazy(async () => ({ default: (await import('./object-editor')).ObjectEditor }))

/**
 * Edit entry point placed on every object page header.
 * Renders nothing for users without EditObject.
 */
export function EditButton({ kind, object, onSaved }: { kind: ObjectKind; object: unknown; onSaved?: () => void }) {
  const { t } = useTranslation(['editor', 'common'])
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const obj = object as AnyObj
  if (!can('EditObject') || !obj?.handle) return null
  return (
    <>
      <Button variant="outline" size="sm" className="ml-1" onClick={() => setOpen(true)}>
        <Pencil />
        <span className="max-sm:sr-only">{t('common:actions.edit')}</span>
      </Button>
      {can('DeleteObject') && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('editor:more')}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
              <Trash2 />
              {t('editor:delete.action', { what: t(`common:object.${kind}`) })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <EditSheet kind={kind} handle={obj.handle} open={open} onOpenChange={setOpen} onSaved={onSaved} />
      <DeleteDialog kind={kind} object={obj} open={confirmDelete} onOpenChange={setConfirmDelete} />
    </>
  )
}

/** Right-side sheet (full screen on phones) with the editor for one object. */
export function EditSheet({
  kind,
  handle,
  open,
  onOpenChange,
  onSaved,
}: {
  kind: ObjectKind
  handle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const { t } = useTranslation(['editor', 'common'])
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const close = useCallback(() => {
    setDirty(false)
    onOpenChange(false)
  }, [onOpenChange])
  const requestClose = () => (dirty ? setConfirmClose(true) : close())

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <SheetContent
          side="right"
          className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
          onEscapeKeyDown={(e) => {
            // let inner popovers close first; then guard unsaved changes
            if (dirty) {
              e.preventDefault()
              setConfirmClose(true)
            }
          }}
        >
          <EditSheetBody
            kind={kind}
            handle={handle}
            onDirtyChange={setDirty}
            onCancel={requestClose}
            onSaved={() => {
              toast.success(t('editor:saved'))
              close()
              onSaved?.()
            }}
          />
        </SheetContent>
      </Sheet>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editor:discard.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('editor:discard.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('editor:discard.keep')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmClose(false)
                close()
              }}
            >
              {t('editor:discard.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Header + editor; mounted only while the sheet is open, so every opening loads fresh data. */
function EditSheetBody({
  kind,
  handle,
  onDirtyChange,
  onCancel,
  onSaved,
}: {
  kind: ObjectKind
  handle: string
  onDirtyChange: (d: boolean) => void
  onCancel: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation(['editor', 'common'])
  const endpoint = endpointOf[kind]
  const q = useQuery({
    queryKey: ['editor', endpoint, handle],
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () => api<AnyObj>(`/${endpoint}/${handle}`, { query: { extend: 'all' } }),
  })
  const title = q.data ? describeObject(kind, q.data).title : ''
  return (
    <>
      <SheetHeader className="border-b px-4 py-3 pr-12 sm:px-6">
        <SheetTitle className="font-serif text-xl font-medium">{t('editor:editTitle', { what: t(`common:object.${kind}`) })}</SheetTitle>
        <SheetDescription className="truncate">
          {title}
          {q.data?.gramps_id && <span className="ml-2 tabular-nums">{q.data.gramps_id}</span>}
        </SheetDescription>
      </SheetHeader>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <EditorSkeleton />
      ) : (
        <Suspense fallback={<EditorSkeleton />}>
        <ObjectEditor
          kind={kind}
          mode="edit"
          initial={toWritable(kind, q.data)}
          seeds={[q.data, ...extendedObjects(q.data)]}
          onDirtyChange={onDirtyChange}
          onCancel={onCancel}
          bodyClassName="overflow-y-auto px-4 py-5 sm:px-6"
          footerClassName="bg-popover px-4 sm:px-6"
          onSaved={onSaved}
        />
        </Suspense>
      )}
    </>
  )
}

function EditorSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-32 w-full" />
      <div className="flex justify-center pt-4">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    </div>
  )
}

/** Confirm + delete, then go to the list page; the toast offers Undo. */
export function DeleteDialog({
  kind,
  object,
  open,
  onOpenChange,
}: {
  kind: ObjectKind
  object: AnyObj
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { t } = useTranslation(['editor', 'common'])
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const title = describeObject(kind, object).title || object.gramps_id
  const run = async () => {
    setBusy(true)
    try {
      const tx = await deleteObject(kind, object.handle)
      invalidateAfterWrite(qc, [kind, ...endpointsOfTx(tx)])
      onOpenChange(false)
      navigate(listPathOf[kind])
      toast.success(t('editor:delete.done', { name: title }), {
        duration: 10_000,
        action: {
          label: t('editor:undo'),
          onClick: async () => {
            try {
              const back = await undoTransaction(tx)
              invalidateAfterWrite(qc, [kind, ...endpointsOfTx(back)])
              toast.success(t('editor:delete.restored'))
              navigate(objectPath(kind, object.gramps_id))
            } catch (e) {
              toast.error(t('editor:delete.undoFailed'), { description: errorMessage(e) })
            }
          },
        },
      })
    } catch (e) {
      toast.error(t('editor:delete.failed'), { description: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('editor:delete.title', { name: title })}</AlertDialogTitle>
          <AlertDialogDescription>{t(`editor:delete.description`, { what: t(`common:object.${kind}`) })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('common:actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              void run()
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {t('common:actions.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
