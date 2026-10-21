import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Page } from '@/components/app-shell'
import { EmptyState, ErrorState } from '@/components/states'
import { api } from '@/lib/api'
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
import { ClassIcon, LeafValue } from './parts'

export function RevisionPage() {
  const { t } = useTranslation('revisions')
  const { can } = useAuth()
  useTitle(t('title'))
  if (!can('ViewPrivate'))
    return (
      <Page title={t('title')}>
        <EmptyState icon={ShieldOff} title={t('noAccess.title')}>
          {t('noAccess.body')}
        </EmptyState>
      </Page>
    )
  return <RevisionDetail />
}

function RevisionDetail() {
  const { id } = useParams()
  const { t, i18n } = useTranslation('revisions')
  const { can } = useAuth()
  const { data: maps } = useTypeMaps()
  const q = useQuery({
    queryKey: ['transactions', 'history', 'detail', id],
    queryFn: () => api<Transaction>(`/transactions/history/${id}`, { query: { old: 1, new: 1 } }),
  })
  const tx = q.data
  const summary = tx ? summarize(tx, maps, t) : null
  useTitle(summary?.headline ?? t('title'))

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!tx || !summary)
    return (
      <Page>
        <Skeleton className="mb-3 h-5 w-28" />
        <Skeleton className="mb-2 h-9 w-96 max-w-full" />
        <Skeleton className="mb-8 h-4 w-60" />
        <Skeleton className="h-64 w-full" />
      </Page>
    )

  const changes = primaryChanges(tx)
  const who = tx.connection?.user?.full_name || tx.connection?.user?.name
  const canUndo = can('AddObject') && can('EditObject') && can('DeleteObject') && changes.length > 0

  return (
    <Page>
      <Link to="/revisions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t('title')}
      </Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium tracking-tight">
            {changes.length > 1 ? t('changeCount', { count: changes.length }) : summary.headline}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[tx.description && changes.length > 0 && tx.description, who && t('by', { name: who }), formatTimestamp(tx.timestamp, i18n.language), timeAgo(tx.timestamp, i18n.language)]
              .filter(Boolean)
              .join(' · ')}
            <span className="ml-2 tabular-nums">#{tx.id}</span>
          </p>
          {isUndo(tx) && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              <Undo2 className="size-3" />
              {t('undoBadgeLong')}
            </p>
          )}
        </div>
        {canUndo && <UndoButton id={tx.id} />}
      </div>

      {!changes.length ? (
        <EmptyState title={tx.description}>{t('noObjectChanges')}</EmptyState>
      ) : (
        <div className="space-y-6">
          {changes.map((c) => (
            <ChangeCard key={c.id} change={c} maps={maps} t={t} />
          ))}
        </div>
      )}
    </Page>
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
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <ClassIcon cls={change.obj_class} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">
            {t(`objectClass.${change.obj_class}`, { defaultValue: change.obj_class })}
            {gid && <span className="ml-1.5 tabular-nums">{gid}</span>}
          </div>
          {linkable ? (
            <Link to={objectPath(kind!, gid!)} className="block truncate font-serif text-lg hover:underline">
              {title}
            </Link>
          ) : (
            <span className="block truncate font-serif text-lg">{title}</span>
          )}
        </div>
        <span
          className={
            'rounded-full px-2 py-0.5 text-xs ' +
            (verb === 'added'
              ? 'bg-primary/10 text-primary'
              : verb === 'deleted'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-brass/15 text-foreground')
          }
        >
          {t(`verb.${verb}`)}
        </span>
      </header>
      <div className="px-4 py-3">
        {change.trans_type === 1 ? (
          <UpdateDiff change={change} maps={maps} t={t} />
        ) : (
          <FieldList obj={change.trans_type === 0 ? asObject(change.new_data) : asObject(change.old_data)} maps={maps} t={t} />
        )}
      </div>
    </section>
  )
}

function UpdateDiff({ change, maps, t }: { change: Change; maps?: TypeMaps; t: TFunction }) {
  const rows = diffObjects(asObject(change.old_data), asObject(change.new_data), maps, t)
  if (!rows.length) return <p className="text-sm text-muted-foreground">{t('noVisibleChanges')}</p>
  return (
    <div className="text-sm">
      <div className="hidden grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] gap-4 pb-2 text-xs text-muted-foreground sm:grid">
        <span>{t('field')}</span>
        <span>{t('before')}</span>
        <span>{t('after')}</span>
      </div>
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.key} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
            <span className="font-medium sm:font-normal sm:text-muted-foreground">{r.labels.join(' › ')}</span>
            <span className="flex min-w-0 gap-2">
              <span className="text-xs text-muted-foreground sm:hidden">{t('before')}</span>
              <LeafValue leaf={r.before} className="min-w-0 text-muted-foreground line-through decoration-destructive/50" />
            </span>
            <span className="flex min-w-0 gap-2">
              <span className="text-xs text-muted-foreground sm:hidden">{t('after')}</span>
              <LeafValue leaf={r.after} className="min-w-0" />
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
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const task = useTask<unknown>()
  const check = useQuery({
    queryKey: ['transactions', 'history', 'undo-check', id],
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => api<UndoCheck>(`/transactions/history/${id}/undo`),
  })
  const conflicts = check.data?.conflicts ?? []
  const force = !!check.data && !check.data.can_undo_without_force

  const run = async () => {
    try {
      await task.start((signal) =>
        api(`/transactions/history/${id}/undo`, { method: 'POST', query: { force: force ? 1 : undefined }, signal }),
      )
      toast.success(t('undo.success'))
      setOpen(false)
      task.reset()
      void qc.invalidateQueries()
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return
      const msg = String((e as Error)?.message ?? '')
      toast.error(/changed/i.test(msg) ? t('undo.conflictFailed') : taskErrorText(t, e))
      void check.refetch()
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
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
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
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
