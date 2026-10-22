import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { toast } from 'sonner'
import { ArrowLeft, ShieldOff, TriangleAlert, Undo2 } from 'lucide-react'
import type { TFunction } from 'i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlbumPage, albumFrame } from '@/components/album-page'
import { cn } from '@/lib/utils'
import { EmptyState, ErrorState } from '@/components/states'
import { api } from '@/api'
import {
  useGetTransactionHistoryQuery,
  useGetTransactionUndoQuery,
  usePostTransactionUndoMutation,
} from '@/api/transactions-api-slice.gen'
import { unwrapApi } from '@/api/enhanced/editor'
import { DERIVED, type TagType } from '@/api/enhanced/tags'
import { useAppDispatch } from '@/store'
import { useAuth } from '@/lib/auth'
import { formatTimestamp, timeAgo } from '@/lib/format'
import { objectPath } from '@/lib/objects'
import { useTitle } from '@/hooks/use-title'
import { useTask } from '@/features/tools/use-task'
import { TaskStatusLine, taskErrorText } from '@/features/tools/task-status'
import {
  asObject,
  changeObject,
  diffObjects,
  isUndo,
  meaningfulFields,
  objectKind,
  primaryChanges,
  rawTitle,
  summarize,
  transVerb,
  useTypeMaps,
  type Change,
  type Transaction,
  type TypeMaps,
  type UndoCheck,
} from './history'
import { LeafValue } from './parts'
import { ChangeThumb, RevisionTimeline, RevisionsSplit, useMinWidth, verbTone } from './timeline'

/** An undo can touch any object (and may run as a background task): refresh all tree data. */
const TREE_DATA_TAGS: TagType[] = ['People', 'Families', 'Events', 'Places', 'Sources', 'Citations', 'Repositories', 'Notes', 'Media', 'Tags', ...DERIVED]

export function RevisionPage() {
  const { t } = useTranslation('revisions')
  const { can } = useAuth()
  useTitle(t('title'))
  if (!can('ViewPrivate'))
    return (
      <AlbumPage title={t('title')}>
        <div className="rounded-3xl bg-card">
          <EmptyState icon={ShieldOff} title={t('noAccess.title')}>
            {t('noAccess.body')}
          </EmptyState>
        </div>
      </AlbumPage>
    )
  return <RevisionRoute />
}

/** /revision/:id — on wide screens the timeline stays next to the change. */
function RevisionRoute() {
  const { id } = useParams()
  const { t } = useTranslation('revisions')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const wide = useMinWidth(1280)
  const back = `/revisions${page > 1 ? `?page=${page}` : ''}`
  return (
    <div className={albumFrame}>
      <Link
        to={back}
        className="-ml-2 mb-4 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground sm:h-9"
      >
        <ArrowLeft className="size-4" />
        {t('title')}
      </Link>
      {wide ? (
        <RevisionsSplit
          timeline={
            <RevisionTimeline
              page={page}
              onPage={(p) => navigate(p > 1 ? `/revisions?page=${p}` : '/revisions')}
              activeId={Number(id)}
              linkSuffix={page > 1 ? `?page=${page}` : ''}
              compact
            />
          }
          detail={<RevisionDetail id={Number(id)} embedded />}
        />
      ) : (
        <RevisionDetail id={Number(id)} />
      )}
    </div>
  )
}

/** One transaction: headline, who/when, undo, then every changed record as a panel. */
export function RevisionDetail({ id, embedded }: { id: number; embedded?: boolean }) {
  const { t, i18n } = useTranslation('revisions')
  const { can } = useAuth()
  const { data: maps } = useTypeMaps()
  const q = useGetTransactionHistoryQuery(Number.isFinite(id) ? { transactionId: id, old: true, new: true } : skipToken)
  const tx = q.data as Transaction | undefined
  const summary = tx ? summarize(tx, maps, t) : null
  useTitle(embedded ? undefined : (summary?.headline ?? t('title')))

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!tx || !summary)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-14 w-3/4" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    )

  const changes = primaryChanges(tx)
  const who = tx.connection?.user?.full_name || tx.connection?.user?.name
  const canUndo = can('AddObject') && can('EditObject') && can('DeleteObject') && changes.length > 0
  const first = summary.first

  return (
    <div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ChangeThumb change={first} size={embedded ? 88 : 104} className="rounded-3xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brass tabular-nums">
            {formatTimestamp(tx.timestamp, i18n.language)} · {timeAgo(tx.timestamp, i18n.language)}
          </p>
          <h1
            className={cn(
              'mt-2 font-serif font-medium leading-[1.05] tracking-[-0.02em] text-balance [overflow-wrap:anywhere]',
              embedded ? 'text-4xl lg:text-5xl' : 'text-[2.4rem] sm:text-5xl lg:text-6xl',
            )}
          >
            {changes.length > 1 ? t('changeCount', { count: changes.length }) : summary.headline}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {[tx.description && changes.length > 0 && tx.description, who && t('by', { name: who })].filter(Boolean).join(' · ')}
            <span className="ml-2 text-sm tabular-nums">#{tx.id}</span>
          </p>
          {isUndo(tx) && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
              <Undo2 className="size-3" />
              {t('undoBadgeLong')}
            </p>
          )}
          {canUndo && (
            <div className="mt-6">
              <UndoButton id={tx.id} />
            </div>
          )}
        </div>
      </header>

      {!changes.length ? (
        <div className="mt-8 rounded-3xl bg-card">
          <EmptyState title={tx.description}>{t('noObjectChanges')}</EmptyState>
        </div>
      ) : (
        <div className="mt-8 grid gap-6">
          {changes.map((c) => (
            <ChangeCard key={c.id} change={c} maps={maps} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChangeCard({ change, maps, t }: { change: Change; maps?: TypeMaps; t: TFunction }) {
  const obj = changeObject(change)
  const kind = objectKind(change.obj_class)
  const title = rawTitle(change.obj_class, obj, maps, t) || change.obj_handle
  const gid = typeof obj?.gramps_id === 'string' ? obj.gramps_id : null
  const linkable = change.trans_type !== 2 && kind && gid
  const verb = transVerb[change.trans_type]
  return (
    <section className="min-w-0 rounded-3xl bg-card p-5 sm:p-6">
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <ChangeThumb change={change} size={52} />
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted-foreground">
            {t(`objectClass.${change.obj_class}`, { defaultValue: change.obj_class })}
            {gid && <span className="ml-1.5 tabular-nums">{gid}</span>}
          </div>
          {linkable ? (
            <Link to={objectPath(kind!, gid!)} className="block truncate font-serif text-2xl font-medium hover:text-brass">
              {title}
            </Link>
          ) : (
            <span className="block truncate font-serif text-2xl font-medium">{title}</span>
          )}
        </div>
        <span className={cn('rounded-full px-3 py-1 text-sm font-medium', verbTone[verb])}>{t(`verb.${verb}`)}</span>
      </header>
      {change.trans_type === 1 ? (
        <UpdateDiff change={change} maps={maps} t={t} />
      ) : (
        <FieldList obj={change.trans_type === 0 ? asObject(change.new_data) : asObject(change.old_data)} maps={maps} t={t} />
      )}
    </section>
  )
}

function UpdateDiff({ change, maps, t }: { change: Change; maps?: TypeMaps; t: TFunction }) {
  const rows = diffObjects(asObject(change.old_data), asObject(change.new_data), maps, t)
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t('noVisibleChanges')}</p>
  return (
    <div className="text-sm">
      <div className="hidden grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] gap-4 px-3 pb-2 text-xs text-muted-foreground sm:grid">
        <span>{t('field')}</span>
        <span>{t('before')}</span>
        <span>{t('after')}</span>
      </div>
      <ul className="grid gap-1.5">
        {rows.map((r) => (
          <li key={r.key} className="grid gap-1 rounded-2xl bg-secondary/50 px-3 py-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
            <span className="font-medium sm:font-normal sm:text-muted-foreground">{r.labels.join(' › ')}</span>
            <span className="flex min-w-0 gap-2">
              <span className="text-xs text-muted-foreground sm:hidden">{t('before')}</span>
              <LeafValue leaf={r.before} className="min-w-0 text-muted-foreground line-through decoration-destructive/50" />
            </span>
            <span className="flex min-w-0 gap-2">
              <span className="text-xs text-muted-foreground sm:hidden">{t('after')}</span>
              <LeafValue leaf={r.after} className="min-w-0 font-medium" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FieldList({ obj, maps, t }: { obj: ReturnType<typeof asObject>; maps?: TypeMaps; t: TFunction }) {
  const fields = meaningfulFields(obj, maps, t)
  if (!fields.length) return <p className="text-sm text-muted-foreground">{t('noDetails')}</p>
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      {fields.map((f) => (
        <div key={f.key} className="contents">
          <dt className="text-muted-foreground">{f.labels.join(' › ')}</dt>
          <dd className="mb-1 min-w-0 sm:mb-0">
            <LeafValue leaf={f.leaf} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function UndoButton({ id }: { id: number }) {
  const { t } = useTranslation('revisions')
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(false)
  const task = useTask<unknown>()
  const [postUndo] = usePostTransactionUndoMutation()
  // fresh check every time the dialog opens
  const checkQ = useGetTransactionUndoQuery(open ? { transactionId: id } : skipToken, { refetchOnMountOrArgChange: true })
  const check = { ...checkQ, data: checkQ.data as UndoCheck | undefined }
  const conflicts = check.data?.conflicts ?? []
  const force = !!check.data && !check.data.can_undo_without_force

  const run = async () => {
    try {
      await task.start((signal) => {
        const req = postUndo({ transactionId: id, force: force || undefined })
        signal?.addEventListener('abort', () => req.abort())
        return unwrapApi(req)
      })
      toast.success(t('undo.success'))
      setOpen(false)
      task.reset()
      dispatch(api.util.invalidateTags(TREE_DATA_TAGS))
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return
      const msg = String((e as Error)?.message ?? '')
      toast.error(/changed/i.test(msg) ? t('undo.conflictFailed') : taskErrorText(t, e))
      void check.refetch()
    }
  }

  return (
    <>
      <Button variant="secondary" className="h-11 rounded-full px-5 sm:h-10" onClick={() => setOpen(true)}>
        <Undo2 />
        {t('undo.button')}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (task.running) return
          setOpen(o)
          if (!o) task.reset()
        }}
      >
        <AlertDialogContent className="data-[size=default]:sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('undo.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('undo.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          {check.isLoading ? (
            <Skeleton className="h-10" />
          ) : check.isError ? (
            <p className="text-sm text-destructive">{taskErrorText(t, check.error)}</p>
          ) : force ? (
            <div className="rounded-2xl bg-destructive/10 p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 text-destructive" />
                {t('undo.conflictTitle')}
              </p>
              <p className="mb-2 text-muted-foreground">{t('undo.conflictBody')}</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    {t(`undo.conflict.${c.conflict_type}`, {
                      object: t(`objectClass.${c.object_class}`, { defaultValue: c.object_class }),
                      defaultValue: c.description,
                    })}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <TaskStatusLine phase={task.phase === 'failure' ? 'idle' : task.phase} progress={task.progress} runningLabel={t('undo.running')} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={task.running}>{t('common:actions.cancel')}</AlertDialogCancel>
            <Button variant={force ? 'destructive' : 'default'} disabled={!check.data || task.running} onClick={run}>
              <Undo2 />
              {force ? t('undo.force') : t('undo.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
