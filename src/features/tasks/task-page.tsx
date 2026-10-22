import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, BookOpen, ChevronDown, CircleCheck, Ellipsis, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsiveMenu } from '@/components/responsive-menu'
import { Skeleton } from '@/components/ui/skeleton'
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
import { ErrorState } from '@/components/states'
import { Gallery, NotesList } from '@/components/detail/sections'
import { Panel } from '@/components/detail/panel'
import { albumFrame, pill } from '@/components/album-page'
import { cn } from '@/lib/utils'
import { useInvalidateOnUnmount } from '@/api/enhanced/editor'
import { useAuth } from '@/lib/auth'
import { useObjectById } from '@/lib/queries'
import { useRecordVisit } from '@/lib/prefs'
import { useTitle } from '@/hooks/use-title'
import { TagList } from '@/components/tag-list'
import type { Tag } from '@/lib/types'
import { deleteTaggedSource } from '@/features/blog/tagged-source'
import { PriorityBadge, StatusIcon, priorityLevel, taskPriority, taskStatus, useUpdateTask, type Task } from './task-model'
import { StatusMenu } from './tasks-page'
import { TaskEditor } from './task-editor'

export function TaskPage() {
  const { id } = useParams()
  const { t } = useTranslation('tasks')
  const { can } = useAuth()
  const navigate = useNavigate()
  const invalidateLater = useInvalidateOnUnmount()
  const update = useUpdateTask()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const q = useObjectById<Task>('source', id, { extend: 'all' })
  const task = q.data
  useTitle(task?.title || id)
  useRecordVisit(task ? { kind: 'source', handle: task.handle, gramps_id: task.gramps_id, title: task.title } : null)

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!task) return <TaskSkeleton />

  if (editing)
    return (
      <TaskEditor
        task={task}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false) // the save invalidated the task; it refetches on its own
        }}
      />
    )

  const status = taskStatus(task)
  const done = status === 'Done'
  const [descNote, ...otherNotes] = task.note_list ?? []

  const toggleDone = async () => {
    setBusy(true)
    try {
      await update(task, { Status: done ? 'Open' : 'Done' })
    } catch {
      /* toast shown */
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      const tx = await deleteTaggedSource(task.handle, descNote)
      toast.success(t('delete.done'))
      // refreshed once this page is gone, so the deleted task isn't refetched
      invalidateLater(tx)
      navigate('/tasks')
    } catch (e) {
      toast.error((e as Error).message)
      setBusy(false)
    }
  }

  const tags = ((task.extended as { tags?: Tag[] } | undefined)?.tags ?? []).filter((x) => x.name !== 'ToDo')
  const level = priorityLevel(taskPriority(task))

  return (
    <div className={albumFrame}>
      <div className="mb-6 flex items-center gap-2">
        <Button asChild variant="ghost" className="-ml-3 h-11 rounded-full px-3 text-muted-foreground hover:text-foreground sm:h-10">
          <Link to="/tasks">
            <ArrowLeft />
            {t('backToTasks')}
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          {can('EditObject') && (
            <Button variant="secondary" className={pill} onClick={() => setEditing(true)}>
              <Pencil />
              {t('edit')}
            </Button>
          )}
          <ResponsiveMenu
            title={t('more')}
            trigger={
              <Button variant="ghost" size="icon" className="size-11 rounded-full sm:size-10" aria-label={t('more')}>
                <Ellipsis />
              </Button>
            }
            groups={[
              [{ key: 'source', icon: <BookOpen />, label: t('openSource'), onSelect: () => navigate(`/source/${task.gramps_id}`) }],
              can('DeleteObject')
                ? [{ key: 'delete', icon: <Trash2 />, label: t('delete.action'), destructive: true, onSelect: () => setConfirmDelete(true) }]
                : [],
            ]}
          />
        </div>
      </div>

      <header className="max-w-5xl">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-brass">
          <span className="tabular-nums">{task.gramps_id}</span>
          {level === 'high' && !done && (
            <>
              <span aria-hidden>·</span>
              <span>{t('priority.high')}</span>
            </>
          )}
        </p>
        <h1
          className={cn(
            'mt-3 font-serif text-[2.4rem] font-medium leading-[1.02] tracking-[-0.02em] text-balance [overflow-wrap:anywhere] sm:text-6xl lg:text-[4rem]',
            done && 'text-muted-foreground line-through decoration-2 decoration-muted-foreground/50',
          )}
        >
          {task.title || task.gramps_id}
        </h1>
        <TagList tags={tags} className="mt-3" />
        <div className="mt-7 flex flex-wrap items-center gap-2">
          {can('EditObject') && (
            <Button variant={done ? 'secondary' : 'default'} className={pill} onClick={toggleDone} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : done ? <RotateCcw /> : <CircleCheck />}
              {done ? t('reopen') : t('markDone')}
            </Button>
          )}
          <StatusMenu
            task={task}
            trigger={(s, pending) => (
              <Button variant="secondary" className={pill} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <StatusIcon status={s} />}
                {t(`status.${s}`)}
                <ChevronDown className="opacity-60" />
              </Button>
            )}
          />
          {!can('EditObject') && (
            <span className="inline-flex h-10 items-center gap-2 rounded-full bg-secondary px-4 text-sm">
              <StatusIcon status={status} />
              {t(`status.${status}`)}
            </span>
          )}
        </div>
      </header>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="grid min-w-0 gap-6">
          <Panel title={t('descriptionTitle')}>
            <div className="max-w-[70ch]">
              {descNote ? (
                <NotesList handles={[descNote, ...otherNotes]} />
              ) : (
                <p className="font-serif text-lg italic text-muted-foreground">{t('noDescription')}</p>
              )}
            </div>
          </Panel>
          {(task.media_list?.length ?? 0) > 0 && (
            <Panel title={t('attachments')} count={task.media_list!.length}>
              <Gallery refs={task.media_list!} media={task.extended?.media} />
            </Panel>
          )}
        </div>
        <Panel title={t('details')}>
          <dl className="grid gap-5">
            <div>
              <dt className="text-sm text-muted-foreground">{t('status.label')}</dt>
              <dd className="mt-1 flex items-center gap-2 font-serif text-2xl leading-tight">
                <StatusIcon status={status} className="size-5" />
                {t(`status.${status}`)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{t('priority.label')}</dt>
              <dd className="mt-1.5">
                <PriorityBadge priority={taskPriority(task)} className="h-8 px-3 text-sm" />
              </dd>
            </div>
            {task.author && (
              <div>
                <dt className="text-sm text-muted-foreground">{t('createdBy')}</dt>
                <dd className="mt-1 font-serif text-2xl leading-tight">{task.author}</dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete.body', { title: task.title })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void remove()
              }}
            >
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TaskSkeleton() {
  return (
    <div className={cn(albumFrame, 'space-y-4')}>
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-6 h-32 w-full" />
    </div>
  )
}
