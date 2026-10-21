import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ImagePlus, Images, Loader2, X } from 'lucide-react'
import { ObjectPicker } from '@/components/object-picker'
import { refThumbUrl } from '@/components/portrait'
import { useTags } from '@/lib/queries'
import { PrivateSwitch, TagsField } from '@/features/editor/fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EmptyState } from '@/components/states'
import { useCurrentUser } from '@/components/user-menu'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { MediaRef, Source } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import {
  ensureTag,
  invalidateSources,
  newHandle,
  txnObject,
  uploadMedia,
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
  const [extraTags, setExtraTags] = useState<string[]>(task?.tag_list ?? [])
  const [isPrivate, setIsPrivate] = useState(!!task?.private)
  const [attachments, setAttachments] = useState<MediaRef[]>(task?.media_list ?? [])
  const [uploading, setUploading] = useState(false)
  const todoHandle = useTags().data?.find((x) => x.name === TODO_TAG)?.handle
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)

  if (!can(task ? 'EditObject' : 'AddObject')) return <EmptyState title={t('editor.noPermission')} className="py-24" />

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const f of Array.from(files)) {
        const m = await uploadMedia(f)
        setAttachments((a) => [...a, { ref: m.handle, rect: null } as MediaRef])
      }
    } catch (e) {
      toast.error(t('editor.failed', { message: (e as Error).message }))
    } finally {
      setUploading(false)
    }
  }
  const mediaList = () =>
    attachments.map((m) => ({
      private: false,
      citation_list: [],
      note_list: [],
      attribute_list: [],
      ...m,
      rect: m.rect ?? null,
      _class: 'MediaRef',
    }))

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
      const tagList = [todo, ...extraTags.filter((h) => h !== todo)]
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
            private: isPrivate,
            tag_list: tagList,
          })
        objects.push({
          _class: 'Source',
          handle: s,
          title: title.trim(),
          author: me?.full_name || me?.name || '',
          pubinfo: '',
          abbrev: '',
          note_list: body.trim() ? [n] : [],
          tag_list: tagList,
          media_list: mediaList(),
          reporef_list: [],
          private: isPrivate,
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
          const bodyChanged = body.trim() !== initialBody.trim()
          if (bodyChanged || !!note.private !== isPrivate)
            await api(`/notes/${note.handle}`, {
              method: 'PUT',
              json: { ...writableNote(note, bodyChanged ? text : (note.text as typeof text)), private: isPrivate },
            })
        } else if (body.trim()) {
          const n = newHandle()
          await api('/notes/', {
            method: 'POST',
            json: { _class: 'Note', handle: n, text: { _class: 'StyledText', ...text }, type: 'To Do', private: isPrivate, tag_list: tagList },
          })
          noteList.unshift(n)
        }
        await api(`/sources/${task.handle}`, {
          method: 'PUT',
          json: writableSource(task, {
            title: title.trim(),
            note_list: noteList,
            tag_list: tagList,
            private: isPrivate,
            media_list: mediaList() as unknown as MediaRef[],
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

        <div className="space-y-2">
          <Label>{t('attachments')}</Label>
          {attachments.length > 0 && (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
              {attachments.map((m, i) => (
                <li key={`${m.ref}-${i}`} className="relative overflow-hidden rounded-lg border bg-muted">
                  <img src={refThumbUrl(m, 200)} alt="" className="aspect-square w-full object-cover" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-1 right-1 size-7 bg-background/90"
                    aria-label={t('editor.removeAttachment')}
                    onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
              <label className="cursor-pointer">
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                {t('editor.uploadAttachment')}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void upload(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            </Button>
            <ObjectPicker
              kinds={['media']}
              placeholder={t('editor.pickMediaPlaceholder')}
              onChange={(o) =>
                setAttachments((a) => (a.some((m) => m.ref === o.handle) ? a : [...a, { ref: o.handle, rect: null } as MediaRef]))
              }
              trigger={
                <Button type="button" variant="ghost" size="sm">
                  <Images />
                  {t('editor.pickMedia')}
                </Button>
              }
            />
          </div>
        </div>

        <TagsField value={extraTags.filter((h) => h !== todoHandle)} onChange={setExtraTags} />
        <PrivateSwitch value={isPrivate} onChange={setIsPrivate} />

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4 max-md:flex-nowrap max-md:[&>button]:h-11 max-md:[&>button]:flex-1 max-md:[&>button]:text-base">
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
