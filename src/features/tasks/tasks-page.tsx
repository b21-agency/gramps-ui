import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CheckSquare, ChevronDown, ListChecks, Loader2, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TagList } from '@/components/tag-list'
import type { Tag } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResponsiveMenu } from '@/components/responsive-menu'
import { AlbumPage, pill } from '@/components/album-page'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { useDebounced } from '@/components/command-search'
import { useGetObjectsQuery } from '@/api/enhanced/objects'
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
  levelValue,
  priorityLevel,
  sortTasks,
  taskPriority,
  taskStatus,
  useUpdateTask,
  type Task,
  type TaskStatus,
} from './task-model'

function useTasks() {
  // provides the Sources list tag: any task write refreshes it
  const r = useGetObjectsQuery({
    kind: 'source',
    query: {
      rules: JSON.stringify({ rules: [{ name: 'HasTag', values: [TODO_TAG] }] }),
      extend: 'note_list,tag_list',
      sort: '-gramps_id',
      page: 1,
      pagesize: 1000,
      locale: apiLocale(),
    },
  })
  return { ...r, data: r.data?.items as Task[] | undefined }
}

/** Tags of a task other than ToDo. */
const extraTags = (task: Task) => ((task.extended as { tags?: Tag[] } | undefined)?.tags ?? []).filter((x) => x.name !== TODO_TAG)

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
  const [tagFilter, setTagFilter] = useState('all')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const update = useUpdateTask()
  const usedTags = useMemo(() => {
    const m = new Map<string, Tag>()
    for (const task of q.data ?? []) for (const tag of extraTags(task)) m.set(tag.handle, tag)
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [q.data])
  const toggleSelected = (h: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(h)) next.delete(h)
      else next.add(h)
      return next
    })
  const applyBulk = async (patch: { Status?: TaskStatus; Priority?: string }) => {
    const tasks = (q.data ?? []).filter((x) => selected.has(x.handle))
    if (!tasks.length) return
    setBulkBusy(true)
    try {
      for (const task of tasks) await update(task, patch, { undo: false })
      toast.success(t('bulk.done', { count: tasks.length }))
      setSelected(new Set())
    } catch {
      /* toast shown */
    } finally {
      setBulkBusy(false)
    }
  }
  const dq = useDebounced(search, 150).trim().toLowerCase()

  const groups = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>(STATUSES.map((s) => [s, []]))
    for (const task of q.data ?? []) {
      if (dq && !`${task.title} ${descriptionOf(task) ?? ''} ${task.gramps_id}`.toLowerCase().includes(dq)) continue
      if (tagFilter !== 'all' && !task.tag_list?.includes(tagFilter)) continue
      map.get(taskStatus(task))!.push(task)
    }
    for (const list of map.values()) list.sort(sortTasks)
    return map
  }, [q.data, dq, tagFilter])

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>
    for (const task of q.data ?? []) c[taskStatus(task)]++
    return c
  }, [q.data])

  const total = q.data?.length ?? 0
  const newButton = can('AddObject') && (
    <Button asChild className={pill}>
      <Link to="/new_task">
        <Plus />
        {t('newTask')}
      </Link>
    </Button>
  )

  const visible = filter === 'all' ? STATUSES.filter((s) => s !== 'Done' || showDone || dq) : [filter]
  const shown = visible.reduce((n, s) => n + groups.get(s)!.length, 0)

  return (
    <AlbumPage title={t('title')} description={t('description')} actions={total > 0 && newButton}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="rounded-3xl bg-card p-5 sm:p-6">
          <RowsSkeleton rows={6} />
        </div>
      ) : total === 0 ? (
        <div className="rounded-3xl bg-card">
          <EmptyState icon={ListChecks} title={t('empty.title')} className="py-24">
            <p>{can('AddObject') ? t('empty.body') : t('empty.bodyReadOnly')}</p>
            {newButton && <div className="mt-5">{newButton}</div>}
          </EmptyState>
        </div>
      ) : (
        <div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('status.label')}>
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
            <div className="relative ml-auto w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="h-11 rounded-full bg-card pl-10 sm:h-10 dark:bg-card"
                aria-label={t('searchPlaceholder')}
              />
            </div>
            {(usedTags.length > 0 || can('EditObject')) && (
              <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
                {usedTags.length > 0 && (
                  <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger className="h-11 w-48 rounded-full bg-card sm:h-10 dark:bg-card" aria-label={t('tagFilter')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('allTags')}</SelectItem>
                      {usedTags.map((tag) => (
                        <SelectItem key={tag.handle} value={tag.handle}>
                          {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {can('EditObject') && (
                  <Button
                    variant={selecting ? 'secondary' : 'ghost'}
                    className="h-11 rounded-full px-4 max-sm:ml-auto sm:h-10"
                    onClick={() => {
                      setSelecting((v) => !v)
                      setSelected(new Set())
                    }}
                  >
                    {selecting ? <X /> : <CheckSquare />}
                    {selecting ? t('bulk.stop') : t('bulk.start')}
                  </Button>
                )}
              </div>
            )}
            {selecting && (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-3xl bg-brass/10 px-4 py-2.5 sm:rounded-full sm:pl-5">
                <span className="mr-auto text-sm tabular-nums">{t('bulk.selected', { count: selected.size })}</span>
                {bulkBusy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                <ResponsiveMenu
                  title={t('bulk.setStatus')}
                  trigger={
                    <Button variant="secondary" className="h-11 rounded-full sm:h-9" disabled={!selected.size || bulkBusy}>
                      {t('bulk.setStatus')}
                      <ChevronDown className="opacity-60" />
                    </Button>
                  }
                  groups={[
                    STATUSES.map((st) => ({
                      key: st,
                      icon: <StatusIcon status={st} />,
                      label: t(`status.${st}`),
                      onSelect: () => void applyBulk({ Status: st }),
                    })),
                  ]}
                />
                <ResponsiveMenu
                  title={t('bulk.setPriority')}
                  trigger={
                    <Button variant="secondary" className="h-11 rounded-full sm:h-9" disabled={!selected.size || bulkBusy}>
                      {t('bulk.setPriority')}
                      <ChevronDown className="opacity-60" />
                    </Button>
                  }
                  groups={[
                    (['high', 'normal', 'low'] as const).map((l) => ({
                      key: l,
                      label: t(`priority.${l}`),
                      onSelect: () => void applyBulk({ Priority: levelValue[l] }),
                    })),
                  ]}
                />
              </div>
            )}
          </div>

          {dq && shown === 0 ? (
            <EmptyState title={t('noMatches', { q: search.trim() })} />
          ) : (
            <div className={cn('grid items-start gap-6', boardCols[visible.length])}>
              {visible.map((s) => (
                <TaskGroup
                  key={s}
                  status={s}
                  tasks={groups.get(s)!}
                  hideWhenEmpty={filter === 'all'}
                  wide={visible.length === 1}
                  selection={selecting ? { selected, toggle: toggleSelected } : undefined}
                />
              ))}
            </div>
          )}

          {filter === 'all' && !dq && counts.Done > 0 && (
            <div className="mt-8 flex justify-center">
              <Button variant="secondary" className={pill} onClick={() => setShowDone((v) => !v)}>
                <ChevronDown className={cn('transition-transform', showDone && 'rotate-180')} />
                {showDone ? t('hideDone') : t('showDone', { count: counts.Done })}
              </Button>
            </div>
          )}
        </div>
      )}
    </AlbumPage>
  )
}

const boardCols: Record<number, string> = { 2: 'xl:grid-cols-2', 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4' }

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
        'inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] sm:h-10',
        active ? 'bg-primary text-primary-foreground [&_svg]:text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
      {label}
      <span className={cn('tabular-nums', active ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{count}</span>
    </button>
  )
}

interface Selection {
  selected: Set<string>
  toggle: (handle: string) => void
}

function TaskGroup({
  status,
  tasks,
  hideWhenEmpty,
  selection,
  wide,
}: {
  status: TaskStatus
  tasks: Task[]
  hideWhenEmpty: boolean
  selection?: Selection
  wide?: boolean
}) {
  const { t } = useTranslation('tasks')
  return (
    <section
      aria-labelledby={`group-${status}`}
      // on the board every column stays visible; stacked, empty groups are left out
      className={cn('min-w-0 rounded-3xl bg-card p-4 sm:p-5', hideWhenEmpty && tasks.length === 0 && 'max-xl:hidden')}
    >
      <div className="mb-4 flex items-center gap-2.5 px-1">
        <span className={cn('flex size-9 items-center justify-center rounded-full bg-secondary', status === 'Done' && 'bg-primary/15')}>
          <StatusIcon status={status} className="size-[18px]" />
        </span>
        <h2 id={`group-${status}`} className="font-serif text-2xl font-medium">
          {t(`status.${status}`)}
        </h2>
        <span className="text-sm tabular-nums text-muted-foreground">{tasks.length}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{t('groupEmpty')}</p>
      ) : (
        <ul className={cn('grid gap-2', wide && 'lg:grid-cols-2 2xl:grid-cols-3')}>
          {tasks.map((task) => (
            <TaskRow key={task.handle} task={task} selection={selection} />
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
    <Button variant="ghost" size="icon-sm" className="max-md:size-10" aria-label={`${t('changeStatus')}: ${t(`status.${status}`)}`} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <StatusIcon status={status} className="size-[18px]" />}
    </Button>
  )
  if (!can('EditObject'))
    return trigger ? null : (
      <span className="inline-flex size-7 items-center justify-center" title={t(`status.${status}`)}>
        <StatusIcon status={status} className="size-[18px]" />
      </span>
    )
  const setStatus = async (s: TaskStatus) => {
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
  }
  return (
    <ResponsiveMenu
      align="start"
      className="w-56"
      title={t('changeStatus')}
      label={t('changeStatus')}
      trigger={(trigger ? trigger(status, pending) : defaultTrigger) as React.ReactElement}
      groups={[
        STATUSES.map((s) => ({
          key: s,
          active: s === status,
          icon: <StatusIcon status={s} />,
          label: (
            <span className="block">
              <span className="block">{t(`status.${s}`)}</span>
              <span className="block text-xs text-muted-foreground max-md:text-sm">{t(`statusHint.${s}`)}</span>
            </span>
          ),
          onSelect: () => void setStatus(s),
        })),
      ]}
    />
  )
}

function TaskRow({ task, selection }: { task: Task; selection?: Selection }) {
  const desc = excerpt(descriptionOf(task), 140)
  const done = taskStatus(task) === 'Done'
  const high = priorityLevel(taskPriority(task)) === 'high' && !done
  return (
    <li
      className={cn(
        'relative flex items-start gap-2 overflow-hidden rounded-2xl bg-secondary/60 py-3 pr-4 pl-2 transition-colors duration-150 has-[a:hover]:bg-accent',
        high && 'pl-3 before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-brass',
      )}
    >
      {selection && (
        <Checkbox
          className="relative z-10 mt-3 ml-1"
          checked={selection.selected.has(task.handle)}
          onCheckedChange={() => selection.toggle(task.handle)}
          aria-label={task.title || task.gramps_id}
        />
      )}
      <div className="relative z-10 shrink-0">
        <StatusMenu task={task} />
      </div>
      <Link to={`/task/${task.gramps_id}`} className="group min-w-0 flex-1 py-1 outline-none after:absolute after:inset-0 focus-visible:underline">
        <span
          className={cn(
            'block text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]',
            done && 'font-normal text-muted-foreground line-through decoration-muted-foreground/50',
          )}
        >
          {task.title || task.gramps_id}
        </span>
        {desc && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{desc}</span>}
        <span className="mt-2 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={taskPriority(task)} quiet />
          <span className="text-xs tabular-nums text-muted-foreground">{task.gramps_id}</span>
          <TagList tags={extraTags(task)} />
        </span>
      </Link>
    </li>
  )
}
