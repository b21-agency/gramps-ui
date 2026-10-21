import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, ListChecks, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Page } from '@/components/app-shell'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { useDebounced } from '@/components/command-search'
import { apiRaw } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useTitle } from '@/hooks/use-title'
import { excerpt } from '@/features/blog/prose'
import {
  PriorityBadge,
  STATUSES,
  StatusIcon,
  TODO_TAG,
  sortTasks,
  taskPriority,
  taskStatus,
  useUpdateTask,
  type Task,
  type TaskStatus,
} from './task-model'

function useTasks() {
  return useQuery({
    queryKey: ['sources', 'tasks', apiLocale()],
    queryFn: async () => {
      const r = await apiRaw<Task[]>('/sources/', {
        query: {
          rules: JSON.stringify({ rules: [{ name: 'HasTag', values: [TODO_TAG] }] }),
          extend: 'note_list',
          sort: '-gramps_id',
          page: 1,
          pagesize: 1000,
          locale: apiLocale(),
        },
      })
      return r.data
    },
  })
}

const descriptionOf = (task: Task) => {
  const first = task.note_list?.[0]
  return task.extended?.notes?.find((n) => n.handle === first)?.text.string
}

export function TasksPage() {
  const { t } = useTranslation('tasks')
  const { can } = useAuth()
  useTitle(t('title'))
  const q = useTasks()
  const [filter, setFilter] = useState<'all' | TaskStatus>('all')
  const [showDone, setShowDone] = useState(false)
  const [search, setSearch] = useState('')
  const dq = useDebounced(search, 150).trim().toLowerCase()

  const groups = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>(STATUSES.map((s) => [s, []]))
    for (const task of q.data ?? []) {
      if (dq && !`${task.title} ${descriptionOf(task) ?? ''} ${task.gramps_id}`.toLowerCase().includes(dq)) continue
      map.get(taskStatus(task))!.push(task)
    }
    for (const list of map.values()) list.sort(sortTasks)
    return map
  }, [q.data, dq])

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>
    for (const task of q.data ?? []) c[taskStatus(task)]++
    return c
  }, [q.data])

  const total = q.data?.length ?? 0
  const newButton = can('AddObject') && (
    <Button asChild>
      <Link to="/new_task">
        <Plus />
        {t('newTask')}
      </Link>
    </Button>
  )

  const visible = filter === 'all' ? STATUSES.filter((s) => s !== 'Done' || showDone || dq) : [filter]
  const shown = visible.reduce((n, s) => n + groups.get(s)!.length, 0)

  return (
    <Page title={t('title')} description={t('description')} actions={total > 0 && newButton}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <RowsSkeleton rows={6} />
      ) : total === 0 ? (
        <EmptyState icon={ListChecks} title={t('empty.title')} className="py-24">
          <p>{can('AddObject') ? t('empty.body') : t('empty.bodyReadOnly')}</p>
          {newButton && <div className="mt-5">{newButton}</div>}
        </EmptyState>
      ) : (
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="-mx-1 flex flex-wrap gap-1" role="tablist" aria-label={t('status.label')}>
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={t('all')} count={total} />
              {STATUSES.map((s) => (
                <FilterChip
                  key={s}
                  active={filter === s}
                  onClick={() => setFilter(s)}
                  label={t(`status.${s}`)}
                  count={counts[s]}
                  icon={<StatusIcon status={s} className="size-3.5" />}
                />
              ))}
            </div>
            <div className="relative ml-auto w-full sm:w-60">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="pl-8"
                aria-label={t('searchPlaceholder')}
              />
            </div>
          </div>

          {dq && shown === 0 ? (
            <EmptyState title={t('noMatches', { q: search.trim() })} />
          ) : (
            <div className="space-y-10">
              {visible.map((s) => (
                <TaskGroup key={s} status={s} tasks={groups.get(s)!} hideWhenEmpty={filter === 'all'} />
              ))}
            </div>
          )}

          {filter === 'all' && !dq && counts.Done > 0 && (
            <div className="mt-8 flex justify-center">
              <Button variant="ghost" onClick={() => setShowDone((v) => !v)}>
                <ChevronDown className={cn('transition-transform', showDone && 'rotate-180')} />
                {showDone ? t('hideDone') : t('showDone', { count: counts.Done })}
              </Button>
            </div>
          )}
        </div>
      )}
    </Page>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary/40 bg-primary/10 text-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </button>
  )
}

function TaskGroup({ status, tasks, hideWhenEmpty }: { status: TaskStatus; tasks: Task[]; hideWhenEmpty: boolean }) {
  const { t } = useTranslation('tasks')
  if (hideWhenEmpty && tasks.length === 0) return null
  return (
    <section aria-labelledby={`group-${status}`}>
      <div className="mb-1 flex items-baseline gap-2 border-b pb-2">
        <StatusIcon status={status} className="translate-y-0.5" />
        <h2 id={`group-${status}`} className="text-xl font-medium">
          {t(`status.${status}`)}
        </h2>
        <span className="text-sm tabular-nums text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">{t('groupEmpty')}</p>
      ) : (
        <ul className="divide-y">
          {tasks.map((task) => (
            <TaskRow key={task.handle} task={task} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function StatusMenu({
  task,
  trigger,
  onChanged,
}: {
  task: Task
  trigger?: (status: TaskStatus, pending: boolean) => React.ReactNode
  onChanged?: () => void
}) {
  const { t } = useTranslation('tasks')
  const { can } = useAuth()
  const update = useUpdateTask()
  const [pending, setPending] = useState(false)
  const status = taskStatus(task)
  const defaultTrigger = (
    <Button variant="ghost" size="icon-sm" aria-label={`${t('changeStatus')}: ${t(`status.${status}`)}`} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <StatusIcon status={status} className="size-[18px]" />}
    </Button>
  )
  if (!can('EditObject'))
    return trigger ? null : (
      <span className="inline-flex size-7 items-center justify-center" title={t(`status.${status}`)}>
        <StatusIcon status={status} className="size-[18px]" />
      </span>
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger ? trigger(status, pending) : defaultTrigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('changeStatus')}</DropdownMenuLabel>
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={pending}
            onSelect={async () => {
              if (s === status) return
              setPending(true)
              try {
                await update(task, { Status: s })
                onChanged?.()
              } catch {
                /* toast shown */
              } finally {
                setPending(false)
              }
            }}
          >
            <StatusIcon status={s} />
            <span className="flex-1">
              <span className="block">{t(`status.${s}`)}</span>
              <span className="block text-xs text-muted-foreground">{t(`statusHint.${s}`)}</span>
            </span>
            {s === status && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TaskRow({ task }: { task: Task }) {
  const desc = excerpt(descriptionOf(task), 140)
  const done = taskStatus(task) === 'Done'
  return (
    <li className="flex items-start gap-2 py-3">
      <div className="pt-0.5">
        <StatusMenu task={task} />
      </div>
      <Link to={`/task/${task.gramps_id}`} className="group min-w-0 flex-1 py-0.5">
        <span
          className={cn(
            'block font-medium group-hover:underline group-hover:underline-offset-2',
            done && 'text-muted-foreground line-through decoration-muted-foreground/50',
          )}
        >
          {task.title || task.gramps_id}
        </span>
        {desc && <span className="mt-0.5 block truncate text-sm text-muted-foreground">{desc}</span>}
      </Link>
      <div className="flex shrink-0 items-center gap-3 pt-1">
        <PriorityBadge priority={taskPriority(task)} quiet />
        <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{task.gramps_id}</span>
      </div>
    </li>
  )
}
