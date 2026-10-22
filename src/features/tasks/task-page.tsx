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
import { DetailSection, Gallery, NotesList } from '@/components/detail/sections'
import { useInvalidateOnUnmount } from '@/api/enhanced/editor'
import { useAuth } from '@/lib/auth'
import { useObjectById } from '@/lib/queries'
import { useRecordVisit } from '@/lib/prefs'
import { useTitle } from '@/hooks/use-title'
import { TagList } from '@/components/tag-list'
import type { Tag } from '@/lib/types'
import { deleteTaggedSource } from '@/features/blog/tagged-source'
import { PriorityBadge, StatusIcon, taskPriority, taskStatus, useUpdateTask, type Task } from './task-model'
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/tasks">
            <ArrowLeft />
            {t('backToTasks')}
          </Link>
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">{task.gramps_id}</span>
        <div className="ml-auto flex items-center gap-1">
          {can('EditObject') && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil />
              {t('edit')}
            </Button>
          )}
          <ResponsiveMenu
            title={t('more')}
            trigger={
              <Button variant="ghost" size="icon-sm" className="max-md:size-10" aria-label={t('more')}>
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

      <header className="mb-8">
        <h1
          className={
            done
              ? 'text-3xl font-medium tracking-tight text-muted-foreground line-through decoration-1 sm:text-4xl'
              : 'text-3xl font-medium tracking-tight text-balance sm:text-4xl'
          }
        >
          {task.title || task.gramps_id}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusMenu
            task={task}
            trigger={(s, pending) => (
              <Button variant="outline" size="sm" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <StatusIcon status={s} />}
                {t(`status.${s}`)}
                <ChevronDown className="opacity-60" />
              </Button>
            )}
          />
          {!can('EditObject') && (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm">
              <StatusIcon status={status} />
              {t(`status.${status}`)}
            </span>
          )}
          <PriorityBadge priority={taskPriority(task)} className="h-7 px-2.5 text-sm" />
          {task.author && <span className="text-sm text-muted-foreground">· {task.author}</span>}
          <TagList tags={((task.extended as { tags?: Tag[] } | undefined)?.tags ?? []).filter((x) => x.name !== 'ToDo')} />
          {can('EditObject') && (
            <Button variant={done ? 'ghost' : 'default'} size="sm" className="sm:ml-auto" onClick={toggleDone} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : done ? <RotateCcw /> : <CircleCheck />}
              {done ? t('reopen') : t('markDone')}
            </Button>
          )}
        </div>
      </header>

      <div className="space-y-10">
        <DetailSection title={t('descriptionTitle')}>
          {descNote ? (
            <NotesList handles={[descNote, ...otherNotes]} />
          ) : (
            <p className="text-sm text-muted-foreground">{t('noDescription')}</p>
          )}
        </DetailSection>

        {(task.media_list?.length ?? 0) > 0 && (
          <DetailSection title={t('attachments')} count={task.media_list!.length}>
            <Gallery refs={task.media_list!} media={task.extended?.media} />
          </DetailSection>
        )}
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
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-6 h-32 w-full" />
    </div>
  )
}
