import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EmptyState } from '@/components/states'
import { useCurrentUser } from '@/components/user-menu'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { Source } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import {
  ensureTag,
  invalidateSources,
  newHandle,
  txnObject,
  writableNote,
  writableSource,
  type TxnEntry,
} from '@/features/blog/tagged-source'
import { parseMarkdownish, toMarkdownish, type StyledTag } from '@/features/blog/styled-text'
import {
  STATUSES,
  StatusIcon,
  TODO_TAG,
  levelValue,
  priorityLevel,
  taskPriority,
  taskStatus,
  withAttrs,
  type PriorityLevel,
  type Task,
  type TaskStatus,
} from './task-model'

/**
 * Create (for /new_task) or edit a task: a Source tagged "ToDo" with Status/Priority
 * attributes and a "To Do" note as description. After creating it navigates to /task/<id>.
 */
export function TaskEditor({
  task,
  onCancel,
  onSaved,
}: {
  task?: Task
  onCancel?: () => void
  onSaved?: (grampsId: string) => void
}) {
  const { t } = useTranslation('tasks')
  const { can } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: me } = useCurrentUser()
  useTitle(task ? t('editor.editTitle') : t('editor.newTitle'))

  const note = useMemo(() => {
    const first = task?.note_list?.[0]
    return task?.extended?.notes?.find((n) => n.handle === first)
  }, [task])
  const initialBody = useMemo(
    () => (note ? toMarkdownish(note.text as { string: string; tags?: StyledTag[] }) : ''),
    [note],
  )

  const [title, setTitle] = useState(task?.title ?? '')
  const [body, setBody] = useState(initialBody)
  const [status, setStatus] = useState<TaskStatus>(task ? taskStatus(task) : 'Open')
  const [level, setLevel] = useState<PriorityLevel>(task ? priorityLevel(taskPriority(task)) : 'normal')
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)

  if (!can(task ? 'EditObject' : 'AddObject')) return <EmptyState title={t('editor.noPermission')} className="py-24" />

  const save = async () => {
    if (!title.trim()) {
      setTitleError(true)
      toast.error(t('editor.titleRequired'))
      return
    }
    setSaving(true)
    try {
      const text = parseMarkdownish(body.trim())
      const todo = await ensureTag(TODO_TAG, '#a9833a')
      // keep the exact priority number when the level did not change
      const priority =
        task && priorityLevel(taskPriority(task)) === level ? String(taskPriority(task)) : levelValue[level]
      let grampsId: string
      if (!task) {
        const n = newHandle()
        const s = newHandle()
        const objects: unknown[] = []
        if (body.trim())
          objects.push({
            _class: 'Note',
            handle: n,
            text: { _class: 'StyledText', ...text },
            type: 'To Do',
            private: false,
            tag_list: [],
          })
        objects.push({
          _class: 'Source',
          handle: s,
          title: title.trim(),
          author: me?.full_name || me?.name || '',
          pubinfo: '',
          abbrev: '',
          note_list: body.trim() ? [n] : [],
          tag_list: [todo],
          media_list: [],
          reporef_list: [],
          private: false,
          attribute_list: withAttrs({ attribute_list: [] }, { Status: status, Priority: priority }).map((a) => ({
            ...a,
            _class: 'SrcAttribute',
          })),
        })
        const txn = await api<TxnEntry[]>('/objects/', { method: 'POST', json: objects })
        grampsId = txnObject<Source>(txn, 'Source', s)!.gramps_id
      } else {
        const noteList = [...(task.note_list ?? [])]
        if (note) {
          if (body.trim() !== initialBody.trim())
            await api(`/notes/${note.handle}`, { method: 'PUT', json: writableNote(note, text) })
        } else if (body.trim()) {
          const n = newHandle()
          await api('/notes/', {
            method: 'POST',
            json: { _class: 'Note', handle: n, text: { _class: 'StyledText', ...text }, type: 'To Do' },
          })
          noteList.unshift(n)
        }
        await api(`/sources/${task.handle}`, {
          method: 'PUT',
          json: writableSource(task, {
            title: title.trim(),
            note_list: noteList,
            tag_list: task.tag_list.includes(todo) ? task.tag_list : [...task.tag_list, todo],
            attribute_list: withAttrs(task, { Status: status, Priority: priority }),
          }),
        })
        grampsId = task.gramps_id
      }
      invalidateSources(qc)
      toast.success(task ? t('editor.saved') : t('editor.created'))
      if (onSaved) onSaved(grampsId)
      else navigate(`/task/${grampsId}`)
    } catch (e) {
      toast.error(t('editor.failed', { message: (e as Error).message }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-10">
      <h1 className="mb-6 text-3xl font-medium tracking-tight">{task ? t('editor.editTitle') : t('editor.newTitle')}</h1>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="task-title">{t('editor.titleLabel')}</Label>
          <Input
            id="task-title"
            value={title}
            autoFocus={!task}
            aria-invalid={titleError || undefined}
            placeholder={t('editor.titlePlaceholder')}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleError(false)
            }}
            className="h-11 font-serif text-lg md:text-lg"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t('status.label')}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={status}
              onValueChange={(v) => v && setStatus(v as TaskStatus)}
              className="flex w-full flex-wrap justify-start"
            >
              {STATUSES.map((s) => (
                <ToggleGroupItem key={s} value={s} aria-label={t(`status.${s}`)} className="gap-1.5 px-2.5">
                  <StatusIcon status={s} />
                  {t(`status.${s}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label>{t('priority.label')}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={level}
              onValueChange={(v) => v && setLevel(v as PriorityLevel)}
              className="justify-start"
            >
              {(['high', 'normal', 'low'] as const).map((l) => (
                <ToggleGroupItem key={l} value={l} className="px-3">
                  {t(`priority.${l}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-body">{t('editor.descriptionLabel')}</Label>
          <Textarea
            id="task-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('editor.descriptionPlaceholder')}
            className="min-h-40"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                void save()
              }
            }}
          />
          <p className="text-xs text-muted-foreground">{t('editor.formattingHint')}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => (onCancel ? onCancel() : navigate(-1))}>
            {t('editor.cancel')}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? t('editor.saving') : task ? t('editor.save') : t('editor.create')}
          </Button>
        </div>
      </form>
    </div>
  )
}
