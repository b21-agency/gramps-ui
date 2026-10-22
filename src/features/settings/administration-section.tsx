import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Pencil, Plus, SearchCheck, Stethoscope, Tag as TagIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { tagColor } from '@/components/tag-list'
import { useCreateObjectMutation, useDeleteObjectMutation, useUpdateObjectMutation } from '@/api/enhanced/objects'
import { useGetTreeQuery } from '@/api/trees-api-slice.gen'
import { useRenameTreeMutation, useRepairTreeMutation } from '@/api/enhanced/settings'
import { TASK_TAGS, useReindexSearchMutation } from '@/api/enhanced/tools'
import { useAuth } from '@/lib/auth'
import { useMetadata, useTags } from '@/lib/queries'
import type { Tag } from '@/lib/types'
import { isAbort, rtkErrorMessage, unwrapWith, useTask } from '@/features/tools/use-task'
import { TaskStatusLine, taskErrorText } from '@/features/tools/task-status'
import { Field, SettingsBlock } from './parts'
import { toHex6 } from './color'
import {
  CustomizationBlock,
  DangerZoneBlock,
  MediaStatusBlock,
  ResearcherBlock,
  SearchIndexStatus,
  UpgradeBlock,
  UsageBlock,
  VerifyBlock,
} from './admin-extra'

export function AdministrationSection() {
  const { can } = useAuth()
  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      {can('UpgradeSchema') && <UpgradeBlock />}
      {can('EditTree') && <TreeNameBlock />}
      <ResearcherBlock />
      <UsageBlock />
      <DataCounts />
      <MediaStatusBlock />
      {can('EditTree') && <CustomizationBlock />}
      {(can('EditObject') || can('AddObject')) && <TagsBlock />}
      {can('TriggerReindex') && <ReindexBlock />}
      {can('RepairTree') && <RepairBlock />}
      {can('RepairTree') && <VerifyBlock />}
      {can('BatchDeleteObjects') && <DangerZoneBlock />}
    </div>
  )
}

/* ---------------- tree name ---------------- */

function TreeNameBlock() {
  const { t } = useTranslation('settings')
  const q = useGetTreeQuery({ treeId: '-' })
  return (
    <SettingsBlock title={t('admin.tree')} description={t('admin.treeDescription')}>
      {q.isLoading ? (
        <Skeleton className="h-9 max-w-md" />
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-6" />
      ) : (
        <TreeNameForm key={q.data.name} current={q.data.name ?? ''} />
      )}
    </SettingsBlock>
  )
}

function TreeNameForm({ current }: { current: string }) {
  const { t } = useTranslation('settings')
  const [name, setName] = useState(current)
  const [renameTree, { isLoading: saving }] = useRenameTreeMutation()
  const dirty = name.trim() !== '' && name.trim() !== current

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty) return
    try {
      await renameTree(name.trim()).unwrap()
      toast.success(t('admin.treeRenamed'))
    } catch (err) {
      toast.error(t('admin.treeRenameFailed'), { description: rtkErrorMessage(err) })
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
      <Field id="tree-name" label={t('admin.treeName')} className="flex-1">
        <Input id="tree-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button type="submit" disabled={!dirty || saving}>
        {saving && <Loader2 className="animate-spin" />}
        {t('admin.rename')}
      </Button>
    </form>
  )
}

/* ---------------- data counts ---------------- */

function DataCounts() {
  const { t } = useTranslation('settings')
  const { data: meta } = useMetadata()
  if (!meta) return null
  const keys = ['people', 'families', 'events', 'places', 'sources', 'citations', 'repositories', 'notes', 'media', 'tags']
  const kindOf: Record<string, string> = {
    people: 'person',
    families: 'family',
    events: 'event',
    places: 'place',
    sources: 'source',
    citations: 'citation',
    repositories: 'repository',
    notes: 'note',
    media: 'media',
  }
  return (
    <SettingsBlock title={t('admin.data')} description={t('admin.dataDescription')}>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {keys.map((k) => (
          <div key={k} className="flex flex-col-reverse rounded-2xl bg-secondary/50 px-4 py-3">
            <dt className="mt-1 truncate text-xs text-muted-foreground">
              {kindOf[k] ? t(`common:objects.${kindOf[k]}`) : t('common:tags')}
            </dt>
            <dd className="font-serif text-2xl leading-none tabular-nums">{(meta.object_counts[k] ?? 0).toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </SettingsBlock>
  )
}

/* ---------------- tags ---------------- */

function TagsBlock() {
  const { t } = useTranslation('settings')
  const { can } = useAuth()
  const q = useTags()
  const [editing, setEditing] = useState<Tag | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)
  const tags = [...(q.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <SettingsBlock
      title={t('tags.title')}
      description={t('tags.description')}
      action={
        can('AddObject') && (
          <Button variant="outline" onClick={() => setEditing('new')}>
            <Plus />
            {t('tags.add')}
          </Button>
        )
      }
    >
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-6" />
      ) : q.isLoading ? (
        <RowsSkeleton rows={3} />
      ) : !tags.length ? (
        <EmptyState icon={TagIcon} title={t('tags.empty')} className="py-8" />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-secondary/40">
          {tags.map((tag) => (
            <li key={tag.handle} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className="size-3.5 shrink-0 rounded-full border"
                style={{ background: tagColor(tag.color) ?? 'var(--muted-foreground)' }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{tag.name}</span>
              {can('EditObject') && (
                <>
                  <Button variant="ghost" size="icon" aria-label={t('tags.edit', { name: tag.name })} onClick={() => setEditing(tag)}>
                    <Pencil />
                  </Button>
                  {can('DeleteObject') && (
                    <Button variant="ghost" size="icon" aria-label={t('tags.delete', { name: tag.name })} onClick={() => setDeleting(tag)}>
                      <Trash2 />
                    </Button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          {editing && (
            <TagForm tag={editing === 'new' ? undefined : editing} existing={tags} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
      <DeleteTagDialog tag={deleting} onClose={() => setDeleting(null)} />
    </SettingsBlock>
  )
}

const swatches = ['#4f7a5a', '#b58a3c', '#a24b3c', '#3f6b8f', '#7a5a8f', '#5f6b6d', '#c26d8c', '#2f8f86']

function TagForm({ tag, existing, onDone }: { tag?: Tag; existing: Tag[]; onDone: () => void }) {
  const { t } = useTranslation('settings')
  const [name, setName] = useState(tag?.name ?? '')
  const [color, setColor] = useState(toHex6(tag?.color ?? swatches[existing.length % swatches.length]))
  const [createTag, { isLoading: creating }] = useCreateObjectMutation()
  const [updateTag, { isLoading: updating }] = useUpdateObjectMutation()
  const saving = creating || updating
  const duplicate = existing.some((x) => x.handle !== tag?.handle && x.name.toLowerCase() === name.trim().toLowerCase())
  const valid = name.trim() !== '' && !duplicate

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    try {
      // the write's transaction invalidates the tag, the tag lists and everything tagged with it
      if (tag) {
        await updateTag({
          kind: 'tag',
          handle: tag.handle,
          body: { _class: 'Tag', handle: tag.handle, name: name.trim(), color, priority: tag.priority ?? 0 },
        }).unwrap()
      } else {
        await createTag({ kind: 'tag', body: { _class: 'Tag', name: name.trim(), color, priority: existing.length } }).unwrap()
      }
      toast.success(tag ? t('tags.saved', { name: name.trim() }) : t('tags.created', { name: name.trim() }))
      onDone()
    } catch (err) {
      toast.error(t('tags.saveFailed'), { description: rtkErrorMessage(err) })
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{tag ? t('tags.editTitle') : t('tags.addTitle')}</DialogTitle>
        <DialogDescription>{t('tags.formDescription')}</DialogDescription>
      </DialogHeader>
      <Field id="tag-name" label={t('tags.name')} hint={duplicate ? t('tags.duplicate') : undefined}>
        <Input id="tag-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={duplicate} autoFocus />
      </Field>
      <div className="grid gap-2">
        <span className="text-sm font-medium">{t('tags.color')}</span>
        <div className="flex flex-wrap items-center gap-2">
          {swatches.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setColor(s)}
              aria-label={s}
              aria-pressed={color === s}
              className="size-7 rounded-full border outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground"
              style={{ background: s }}
            />
          ))}
          <label className="relative inline-flex size-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border text-xs text-muted-foreground" title={t('tags.custom')}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={t('tags.custom')}
            />
            <span aria-hidden>+</span>
          </label>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full" style={{ background: color }} />
            {name.trim() || t('tags.preview')}
          </span>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" disabled={!valid || saving}>
          {saving && <Loader2 className="animate-spin" />}
          {tag ? t('common:actions.save') : t('tags.create')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function DeleteTagDialog({ tag, onClose }: { tag: Tag | null; onClose: () => void }) {
  const { t } = useTranslation('settings')
  const [deleteTag, { isLoading: busy }] = useDeleteObjectMutation()
  const remove = async () => {
    if (!tag) return
    try {
      await deleteTag({ kind: 'tag', handle: tag.handle }).unwrap()
      toast.success(t('tags.deleted', { name: tag.name }))
      onClose()
    } catch (err) {
      toast.error(t('tags.deleteFailed'), { description: rtkErrorMessage(err) })
    }
  }
  return (
    <AlertDialog open={!!tag} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('tags.deleteTitle', { name: tag?.name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('tags.deleteDescription')}
            {['Blog', 'ToDo'].includes(tag?.name ?? '') && ` ${t('tags.deleteSpecial', { name: tag?.name })}`}
          </AlertDialogDescription>
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
            {busy && <Loader2 className="animate-spin" />}
            {t('tags.deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ---------------- search index ---------------- */

function ReindexBlock() {
  const { t } = useTranslation('settings')
  const task = useTask({ invalidates: TASK_TAGS.reindex })
  const [reindex] = useReindexSearchMutation()
  const run = () =>
    task
      .start((signal) => unwrapWith(signal, reindex({ full: true })))
      .then(() => toast.success(t('admin.reindexDone')))
      .catch((e) => {
        if (!isAbort(e)) toast.error(taskErrorText(t, e))
      })
  return (
    <SettingsBlock title={t('admin.reindex')} description={t('admin.reindexDescription')}>
      <div className="max-w-md space-y-3">
        <SearchIndexStatus />
        <Button variant="outline" onClick={run} disabled={task.running}>
          {task.running ? <Loader2 className="animate-spin" /> : <SearchCheck />}
          {t('admin.reindexRun')}
        </Button>
        <TaskStatusLine
          phase={task.phase}
          progress={task.progress}
          error={task.error}
          runningLabel={t('admin.reindexRunning')}
          successLabel={t('admin.reindexDone')}
        />
      </div>
    </SettingsBlock>
  )
}

/* ---------------- check & repair ---------------- */

interface RepairResult {
  num_errors?: number
  message?: string
}

function RepairBlock() {
  const { t } = useTranslation('settings')
  const task = useTask<RepairResult>({ invalidates: TASK_TAGS.repair })
  const [repairTree] = useRepairTreeMutation()
  const [confirm, setConfirm] = useState(false)
  const run = () => {
    setConfirm(false)
    task
      .start((signal) => unwrapWith(signal, repairTree()))
      .catch((e) => {
        if (!isAbort(e)) toast.error(taskErrorText(t, e))
      })
  }
  const result = task.result
  return (
    <SettingsBlock title={t('admin.repair')} description={t('admin.repairDescription')}>
      <div className="max-w-xl space-y-3">
        <Button variant="outline" onClick={() => setConfirm(true)} disabled={task.running}>
          {task.running ? <Loader2 className="animate-spin" /> : <Stethoscope />}
          {t('admin.repairRun')}
        </Button>
        {task.phase !== 'success' && (
          <TaskStatusLine phase={task.phase} progress={task.progress} error={task.error} runningLabel={t('admin.repairRunning')} />
        )}
        {task.phase === 'success' && result && (
          <div className="rounded-2xl bg-secondary/50 p-4">
            <p className="font-serif text-lg">
              {result.num_errors ? t('admin.repairFixed', { count: result.num_errors }) : t('admin.repairClean')}
            </p>
            {result.message?.trim() && (
              <pre className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{result.message.trim()}</pre>
            )}
          </div>
        )}
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.repairConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('admin.repairConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={run}>{t('admin.repairRun')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsBlock>
  )
}
