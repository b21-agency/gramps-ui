// Background jobs of this tree (GET /api/tasks/): what is running now and what finished
// recently, with the outcome and who started it. The server keeps this list, so unlike the
// classic in-memory log it survives reloads and shows jobs started on other devices.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { Bell, CircleAlert, CircleCheck, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Panel } from '@/components/detail/panel'
import { cn } from '@/lib/utils'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { tasksApi, useGetTaskQuery, useGetTasksQuery } from '@/api/enhanced/tasks-slice-enhanced'
import { timeAgo } from '@/lib/format'
import { useTitle } from '@/hooks/use-title'
import { toast } from 'sonner'

export interface ServerTask {
  task_id: string
  name: string
  created_at?: string
  state: string
  status?: string
  user_name?: string | null
}

/** Celery task names worth showing, as in the classic UI (internal housekeeping is left out). */
export const taskKinds = [
  'import_file',
  'export_db',
  'generate_report',
  'export_media',
  'import_media_archive',
  'search_reindex_full',
  'search_reindex_incremental',
  'search_reindex_full_semantic',
  'search_reindex_incremental_semantic',
  'media_ocr',
  'check_repair_database',
  'verify_database',
  'upgrade_database_schema',
  'delete_objects',
  'process_transactions',
  'restore_backup',
  'create_backup',
  'restore_backup_archive',
] as const

const TERMINAL = new Set(['SUCCESS', 'FAILURE', 'REVOKED'])
const shortName = (n: string) => n.split('.').pop() ?? n
const ts = (v?: string) => (v ? Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(v) ? v : `${v}Z`) / 1000 : 0)

export function useServerTasks() {
  const arg = { includeState: true }
  // poll fast while something runs, slowly otherwise
  const cached = tasksApi.endpoints.getTasks.useQueryState(arg)
  const active = (cached.data as ServerTask[] | undefined)?.some((t) => !TERMINAL.has(t.state))
  const r = useGetTasksQuery(arg, { pollingInterval: active ? 2000 : 30_000 })
  const data = useMemo(
    () => (r.data as ServerTask[] | undefined)?.filter((t) => (taskKinds as readonly string[]).includes(shortName(t.name))),
    [r.data],
  )
  return { ...r, data }
}

export function NotificationsPage() {
  const { t, i18n } = useTranslation('help')
  useTitle(t('notifications.title'))
  const q = useServerTasks()
  const [detail, setDetail] = useState<ServerTask | null>(null)
  const tasks = [...(q.data ?? [])].sort((a, b) => ts(b.created_at) - ts(a.created_at))
  const running = tasks.filter((x) => !TERMINAL.has(x.state))
  const done = tasks.filter((x) => TERMINAL.has(x.state)).slice(0, 50)
  const label = (x: ServerTask) => t(`notifications.kind.${shortName(x.name)}`, { defaultValue: shortName(x.name) })

  const row = (x: ServerTask) => {
    const ok = x.state === 'SUCCESS'
    const isRunning = !TERMINAL.has(x.state)
    return (
      <li key={x.task_id}>
        <button
          type="button"
          onClick={() => setDetail(x)}
          className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent sm:gap-4"
        >
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full',
              ok || isRunning ? 'bg-brass/15 text-brass' : 'bg-destructive/15 text-destructive',
            )}
          >
            {isRunning ? <Loader2 className="size-5 animate-spin" /> : ok ? <CircleCheck className="size-5" /> : <CircleAlert className="size-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{label(x)}</span>
            <span className="block truncate text-sm text-muted-foreground">
              {[
                isRunning ? t('notifications.running') : ok ? t('notifications.succeeded') : t('notifications.failed'),
                x.created_at && timeAgo(ts(x.created_at), i18n.language),
                x.user_name,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
      <header className="mb-8">
        <h1 className="font-serif text-[2.6rem] font-medium leading-[1] tracking-[-0.02em] sm:text-6xl">{t('notifications.title')}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t('notifications.description')}</p>
      </header>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} className="rounded-3xl bg-card" />
      ) : q.isLoading ? (
        <div className="rounded-3xl bg-card p-5 sm:p-6">
          <RowsSkeleton rows={5} />
        </div>
      ) : !tasks.length ? (
        <EmptyState icon={Bell} title={t('notifications.empty')} className="rounded-3xl bg-card py-20">
          {t('notifications.emptyHint')}
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          {!!running.length && (
            <Panel title={t('notifications.runningTitle')} count={running.length}>
              <ul className="grid gap-0.5 [&>li]:min-w-0">{running.map(row)}</ul>
            </Panel>
          )}
          {!!done.length && (
            <Panel title={t('notifications.recentTitle')} count={done.length}>
              <ul className="grid gap-x-6 gap-y-0.5 md:grid-cols-2 [&>li]:min-w-0">{done.map(row)}</ul>
            </Panel>
          )}
        </div>
      )}
      <TaskDetail task={detail} label={detail ? label(detail) : ''} onClose={() => setDetail(null)} />
    </div>
  )
}

function TaskDetail({ task, label, onClose }: { task: ServerTask | null; label: string; onClose: () => void }) {
  const { t, i18n } = useTranslation('help')
  const r = useGetTaskQuery(task ? { taskId: task.task_id } : skipToken)
  // never show the previously opened task's details while the next one loads
  const q = { ...r, data: r.currentData as Record<string, unknown> | undefined, isLoading: r.isFetching && !r.currentData }
  const info = q.data?.info ?? q.data?.result
  const text = typeof info === 'string' ? info : info != null ? JSON.stringify(info, null, 2) : ''
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {task?.created_at && new Date(ts(task.created_at) * 1000).toLocaleString(i18n.language)}
            {task?.user_name && ` · ${task.user_name}`}
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <RowsSkeleton rows={2} />
        ) : (
          <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">{t('notifications.state')}</dt>
            <dd>{String(q.data?.state ?? task?.state ?? '')}</dd>
            {text && (
              <>
                <dt className="text-muted-foreground">{t('notifications.details')}</dt>
                <dd>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-2 text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {text.length > 4000 ? `${text.slice(0, 4000)}…` : text}
                  </pre>
                </dd>
              </>
            )}
          </dl>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(JSON.stringify(q.data ?? task, null, 2))
                .then(() => toast.success(t('notifications.copied')))
            }
          >
            <Copy />
            {t('notifications.copy')}
          </Button>
          <Button onClick={onClose}>{t('common:actions.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
