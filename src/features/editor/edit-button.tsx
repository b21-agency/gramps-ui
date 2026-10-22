import { lazy, Suspense, useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
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
import { useGetObjectQuery } from '@/api/enhanced/objects'
import { unwrapApi, useDeleteObjectDeferredMutation, useEditableObjectQuery, useInvalidateOnUnmount } from '@/api/enhanced/editor'
import { useAuth } from '@/lib/auth'
import { describeObject, objectPath } from '@/lib/objects'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import type { ObjectKind } from '@/lib/types'
import {
  errorMessage,
  listPathOf,
  toWritable,
  undoTransaction,
  extendedObjects,
  type AnyObj,
  type Transaction,
} from './lib'

const ObjectEditor = lazy(async () => ({ default: (await import('./object-editor')).ObjectEditor }))

/**
 * Edit entry point placed on every object page header.
 * Renders nothing for users without EditObject.
 */
export function EditButton({
  kind,
  object,
  onSaved,
  menu = true,
  className,
}: {
  kind: ObjectKind
  object: unknown
  onSaved?: () => void
  /** false: no "more" menu with Delete (the caller offers it, e.g. in a phone action sheet) */
  menu?: boolean
  className?: string
}) {
  const { t } = useTranslation(['editor', 'common'])
  const { can } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const obj = object as AnyObj
  if (!can('EditObject') || !obj?.handle) return null
  return (
    <>
      <Button variant="outline" size="sm" className={cn('ml-1', className)} onClick={() => setOpen(true)} data-shortcut="edit">
        <Pencil />
        <span className="max-sm:sr-only">{t('common:actions.edit')}</span>
      </Button>
      {menu && can('DeleteObject') && (
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
  const isMobile = useIsMobile()
  const close = useCallback(() => {
    setDirty(false)
    onOpenChange(false)
  }, [onOpenChange])
  const requestClose = () => (dirty ? setConfirmClose(true) : close())

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'w-full gap-0 bg-background p-0 data-[side=right]:w-full data-[side=right]:border-l-0 data-[side=right]:sm:max-w-2xl',
            // phones: a page sheet that rises from the bottom, leaving a sliver of the page above
            'data-[side=bottom]:h-[calc(100dvh-env(safe-area-inset-top,0px)-0.75rem)] data-[side=bottom]:overflow-hidden data-[side=bottom]:rounded-t-3xl data-[side=bottom]:border-t-0 data-[side=bottom]:data-open:slide-in-from-bottom data-[side=bottom]:data-closed:slide-out-to-bottom',
            'max-md:[&>[data-slot=sheet-close]]:top-2.5 max-md:[&>[data-slot=sheet-close]]:right-2.5 max-md:[&>[data-slot=sheet-close]]:size-10',
          )}
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
  // uncached snapshot, never refetched while the form is open (see editableObject)
  const eq = useEditableObjectQuery({ kind, handle }, { refetchOnReconnect: false, refetchOnMountOrArgChange: true })
  const q = { ...eq, data: eq.data as AnyObj | undefined }
  const title = q.data ? describeObject(kind, q.data).title : ''
  return (
    <>
      <SheetHeader className="gap-1 px-4 pt-5 pb-3 pr-14 sm:px-6 sm:pt-6 sm:pr-14">
        <SheetTitle className="font-serif text-3xl leading-[1.05] font-medium tracking-[-0.01em] sm:text-4xl">
          {t('editor:editTitle', { what: t(`common:object.${kind}`) })}
        </SheetTitle>
        <SheetDescription className="truncate font-serif text-lg italic">
          {title}
          {q.data?.gramps_id && <span className="ml-2 font-sans text-sm not-italic tabular-nums text-brass">{q.data.gramps_id}</span>}
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
          bodyClassName="overflow-y-auto overscroll-contain px-3 pt-2 pb-6 sm:px-6"
          footerClassName="px-4 sm:px-6 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
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
  const invalidateLater = useInvalidateOnUnmount()
  const [deleteObject] = useDeleteObjectDeferredMutation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const title = describeObject(kind, object).title || object.gramps_id
  // a place that still encloses other places can't be deleted (they would point nowhere)
  const encloses = useGetObjectQuery(
    { kind: 'place', handle: object.handle, query: { backlinks: true, keys: 'backlinks' } },
    { skip: !(open && kind === 'place'), refetchOnMountOrArgChange: true },
  )
  const blocked = kind === 'place' && ((encloses.data?.backlinks as { place?: string[] } | undefined)?.place ?? []).length > 0
  const run = async () => {
    setBusy(true)
    try {
      const { tx } = await unwrapApi(deleteObject({ kind, handle: object.handle }))
      onOpenChange(false)
      // leave the page first: refreshed once this page is gone, so the deleted record isn't refetched
      invalidateLater(tx)
      navigate(listPathOf[kind])
      toast.success(t('editor:delete.done', { name: title }), {
        duration: 10_000,
        action: {
          label: t('editor:undo'),
          onClick: async () => {
            try {
              // the undo mutation invalidates the restored objects itself
              await undoTransaction(tx as Transaction)
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
          <AlertDialogDescription>
            {blocked ? t('editor:delete.placeEncloses') : t(`editor:delete.description`, { what: t(`common:object.${kind}`) })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('common:actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy || blocked || (kind === 'place' && encloses.isLoading)}
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
