import { useTranslation } from 'react-i18next'
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { taskErrorMessage, type TaskPhase, type TaskProgress } from './use-task'

/** Inline status line for a running/finished background task. */
export function TaskStatusLine({
  phase,
  progress,
  error,
  runningLabel,
  successLabel,
  className,
}: {
  phase: TaskPhase
  progress?: TaskProgress | null
  error?: unknown
  runningLabel?: string
  successLabel?: string
  className?: string
}) {
  const { t } = useTranslation('tools')
  if (phase === 'idle') return null
  if (phase === 'running') {
    const pct = progress?.progress != null ? Math.round(progress.progress * 100) : null
    return (
      <div className={cn('w-full space-y-3 rounded-2xl bg-secondary/60 p-4', className)} role="status" aria-live="polite">
        <div className="flex items-center gap-2.5 text-sm">
          <Loader2 className="size-4 animate-spin text-brass" />
          <span className="min-w-0 flex-1 truncate">{progress?.title || runningLabel || t('task.running')}</span>
          {pct != null && <span className="font-serif text-lg leading-none tabular-nums text-brass">{pct}%</span>}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background/60">
          <div
            className={cn('h-full rounded-full bg-brass transition-[width] duration-500', pct == null && 'w-1/3 animate-pulse')}
            style={pct != null ? { width: `${Math.max(4, pct)}%` } : undefined}
          />
        </div>
      </div>
    )
  }
  if (phase === 'success')
    return (
      <p className={cn('flex w-full items-center gap-2.5 rounded-2xl bg-chart-1/12 px-4 py-3 text-sm text-chart-1', className)} role="status">
        <CircleCheck className="size-4" />
        {successLabel ?? t('task.done')}
      </p>
    )
  return (
    <p className={cn('flex w-full items-start gap-2.5 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive', className)} role="alert">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      <span>{taskErrorText(t, error)}</span>
    </p>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function taskErrorText(t: (k: string, o?: any) => string, error: unknown) {
  const m = taskErrorMessage(error)
  if (m === 'task_locked') return t('tools:task.locked')
  if (m === 'rate_limited') return t('tools:task.rateLimited')
  return t('tools:task.failed', { message: m })
}
