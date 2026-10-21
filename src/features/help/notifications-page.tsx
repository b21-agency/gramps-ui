// Background jobs of this tree (GET /api/tasks/): what is running now and what finished
// recently, with the outcome and who started it. The server keeps this list, so unlike the
// classic in-memory log it survives reloads and shows jobs started on other devices.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bell, CircleAlert, CircleCheck, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Page } from '@/components/app-shell'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { api } from '@/lib/api'
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
  return useQuery({
    queryKey: ['tasks', 'server'],
    queryFn: async () =>
      (await api<ServerTask[]>('/tasks/', { query: { include_state: true } })).filter((t) =>
        (taskKinds as readonly string[]).includes(shortName(t.name)),
      ),
    refetchInterval: (q) => (q.state.data?.some((t) => !TERMINAL.has(t.state)) ? 2000 : 30_000),
  })
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
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
        >
          {isRunning ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          ) : ok ? (
            <CircleCheck className="size-4 shrink-0 text-primary" />
          ) : (
            <CircleAlert className="size-4 shrink-0 text-destructive" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate">{label(x)}</span>
            <span className="block truncate text-xs text-muted-foreground">
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
    <Page title={t('notifications.title')} description={t('notifications.description')}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <RowsSkeleton rows={5} />
      ) : !tasks.length ? (
        <EmptyState icon={Bell} title={t('notifications.empty')}>
          {t('notifications.emptyHint')}
        </EmptyState>
      ) : (
        <div className="grid max-w-3xl gap-8">
          {!!running.length && (
            <section>
              <h2 className="mb-2 text-xl font-medium">{t('notifications.runningTitle')}</h2>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">{running.map(row)}</ul>
            </section>
          )}
          {!!done.length && (
            <section>
              <h2 className="mb-2 text-xl font-medium">{t('notifications.recentTitle')}</h2>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">{done.map(row)}</ul>
            </section>
          )}
        </div>
      )}
      <TaskDetail task={detail} label={detail ? label(detail) : ''} onClose={() => setDetail(null)} />
    </Page>
  )
}

function TaskDetail({ task, label, onClose }: { task: ServerTask | null; label: string; onClose: () => void }) {
  const { t, i18n } = useTranslation('help')
  const q = useQuery({
    queryKey: ['tasks', 'detail', task?.task_id],
    enabled: !!task,
    queryFn: () => api<Record<string, unknown>>(`/tasks/${task!.task_id}`),
  })
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
