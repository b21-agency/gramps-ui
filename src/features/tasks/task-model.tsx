// Tasks are Sources tagged "ToDo" with SrcAttributes "Status" and "Priority" (1 = highest … 9).
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Circle, CircleCheck, CircleDot, CircleSlash } from 'lucide-react'
import { api } from '@/lib/api'
import type { Attribute, Note, Source } from '@/lib/types'
import { cn } from '@/lib/utils'
import { invalidateSources, writableSource } from '@/features/blog/tagged-source'

export const TODO_TAG = 'ToDo'
export const STATUSES = ['Open', 'In Progress', 'Blocked', 'Done'] as const
export type TaskStatus = (typeof STATUSES)[number]

export type Task = Source & { extended?: Source['extended'] & { notes?: Note[] } }

const attrType = (a: Attribute) => (typeof a.type === 'string' ? a.type : (a.type as { string?: string })?.string ?? '')

export function getAttr(src: Source, name: string) {
  return src.attribute_list?.find((a) => attrType(a) === name)?.value
}

export function taskStatus(src: Source): TaskStatus {
  const v = getAttr(src, 'Status')
  return (STATUSES as readonly string[]).includes(v ?? '') ? (v as TaskStatus) : 'Open'
}

export function taskPriority(src: Source): number {
  const n = Number(getAttr(src, 'Priority'))
  return Number.isFinite(n) && n >= 1 && n <= 9 ? n : 5
}

export type PriorityLevel = 'high' | 'normal' | 'low'
export const priorityLevel = (p: number): PriorityLevel => (p <= 3 ? 'high' : p <= 6 ? 'normal' : 'low')
export const levelValue: Record<PriorityLevel, string> = { high: '1', normal: '5', low: '9' }

/** attribute_list with Status/Priority replaced (other attributes kept). */
export function withAttrs(src: Pick<Source, 'attribute_list'>, patch: { Status?: string; Priority?: string }) {
  const list = (src.attribute_list ?? []).map((a) => ({ ...a }))
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) continue
    const i = list.findIndex((a) => attrType(a) === k)
    if (i >= 0) list[i] = { ...list[i], value: v }
    else list.push({ type: k, value: v, private: false } as Attribute)
  }
  return list
}

export function sortTasks(a: Source, b: Source) {
  return taskPriority(a) - taskPriority(b) || b.gramps_id.localeCompare(a.gramps_id)
}

export const statusIcon: Record<TaskStatus, typeof Circle> = {
  Open: Circle,
  'In Progress': CircleDot,
  Blocked: CircleSlash,
  Done: CircleCheck,
}

export const statusColor: Record<TaskStatus, string> = {
  Open: 'text-muted-foreground',
  'In Progress': 'text-primary',
  Blocked: 'text-destructive',
  Done: 'text-primary',
}

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  const Icon = statusIcon[status]
  return <Icon className={cn('size-4 shrink-0', statusColor[status], className)} aria-hidden />
}

export function PriorityBadge({ priority, className, quiet }: { priority: number; className?: string; quiet?: boolean }) {
  const { t } = useTranslation('tasks')
  const level = priorityLevel(priority)
  if (quiet && level === 'normal') return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs whitespace-nowrap',
        level === 'high' && 'border-brass/50 bg-brass/10 text-foreground',
        level === 'low' && 'text-muted-foreground',
        className,
      )}
      title={`${t('priority.label')}: ${priority}`}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          level === 'high' ? 'bg-brass' : level === 'normal' ? 'bg-muted-foreground' : 'bg-muted-foreground/40',
        )}
      />
      {t(`priority.${level}`)}
    </span>
  )
}

/** PUT the task with new Status/Priority; toast with undo for status moves. */
export function useUpdateTask() {
  const { t } = useTranslation('tasks')
  const qc = useQueryClient()
  const put = (task: Source, patch: { Status?: string; Priority?: string }) =>
    api(`/sources/${task.handle}`, {
      method: 'PUT',
      json: writableSource(task, { attribute_list: withAttrs(task, patch) }),
    })
  return async (task: Source, patch: { Status?: TaskStatus; Priority?: string }, opts: { undo?: boolean } = {}) => {
    const before = { Status: taskStatus(task), Priority: String(taskPriority(task)) }
    try {
      await put(task, patch)
      invalidateSources(qc)
      if (patch.Status && opts.undo !== false)
        toast.success(t('movedTo', { status: t(`status.${patch.Status}`) }), {
          action: {
            label: t('undo'),
            onClick: async () => {
              // re-read: the PUT changed `change`, and the server wants the full current object
              const fresh = await api<Source>(`/sources/${task.handle}`)
              await put(fresh, { Status: before.Status })
              invalidateSources(qc)
            },
          },
        })
    } catch (e) {
      toast.error(t('updateFailed', { message: (e as Error).message }))
      throw e
    }
  }
}
