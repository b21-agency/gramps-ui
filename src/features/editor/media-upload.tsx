import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleAlert, CircleCheck, FileImage, Loader2, Upload, X } from 'lucide-react'
import { Page } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ObjectPicker } from '@/components/object-picker'
import { freshAccessToken, refreshAccessToken } from '@/lib/api'
import { objectPath } from '@/lib/objects'
import type { DateVal } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import { DateInput } from './date-input'
import { Field } from './fields'
import { errorMessage, invalidateAfterWrite, putObject, type AnyObj, type Transaction } from './lib'
import { addMediaRef } from './relations'

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  heic: 'image/heic',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  txt: 'text/plain',
}

function mimeOf(file: File) {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

function stripExt(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

interface Item {
  key: string
  file: File
  desc: string
  preview?: string
  status: 'ready' | 'uploading' | 'saving' | 'done' | 'error'
  progress: number
  error?: string
  grampsId?: string
}

/** Raw upload with progress (fetch has no upload progress). Retries once after a token refresh. */
function uploadRaw(file: File, onProgress: (p: number) => void): Promise<Transaction> {
  const once = (token: string | null) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/media/')
      xhr.setRequestHeader('Content-Type', mimeOf(file))
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText })
      xhr.onerror = () => reject(new TypeError('network'))
      xhr.send(file)
    })
  return (async () => {
    let res = await once(await freshAccessToken())
    if (res.status === 401 && (await refreshAccessToken())) res = await once(await freshAccessToken())
    if (res.status < 200 || res.status >= 300) {
      let msg = `HTTP ${res.status}`
      try {
        msg = JSON.parse(res.body)?.error?.message ?? msg
      } catch {
        /* not json */
      }
      throw new Error(msg)
    }
    return JSON.parse(res.body) as Transaction
  })()
}

export function MediaUpload() {
  const { t } = useTranslation(['editor', 'common'])
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [date, setDate] = useState<DateVal | null>(null)
  const [person, setPerson] = useState<{ handle: string; title: string } | null>(
    params.get('person') ? { handle: params.get('person')!, title: params.get('personName') ?? t('editor:media.thisPerson') } : null,
  )
  const [drag, setDrag] = useState(false)
  const [running, setRunning] = useState(false)
  useTitle(t('editor:media.uploadTitle'))

  const add = (files: FileList | File[]) => {
    const next: Item[] = [...files].map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      desc: stripExt(file.name),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      status: 'ready',
      progress: 0,
    }))
    setItems((list) => [...list, ...next])
  }
  const patch = (key: string, p: Partial<Item>) => setItems((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x)))

  const run = async () => {
    setRunning(true)
    let ok = 0
    let lastId: string | undefined
    for (const it of items) {
      if (it.status === 'done') continue
      patch(it.key, { status: 'uploading', progress: 0, error: undefined })
      try {
        const tx = await uploadRaw(it.file, (p) => patch(it.key, { progress: p }))
        const media: AnyObj | undefined = tx.find((e) => e._class === 'Media' && e.new)?.new ?? tx[0]?.new ?? undefined
        if (!media) throw new Error('no media in response')
        patch(it.key, { status: 'saving', progress: 1 })
        const meta: AnyObj = { ...media, desc: it.desc.trim() }
        if (date) meta.date = date
        if (meta.desc || date) await putObject('media', meta)
        if (person) await addMediaRef('person', person.handle, media.handle)
        patch(it.key, { status: 'done', grampsId: media.gramps_id })
        ok++
        lastId = media.gramps_id
      } catch (e) {
        patch(it.key, { status: 'error', error: errorMessage(e) })
      }
    }
    invalidateAfterWrite(qc, ['media', 'person'])
    setRunning(false)
    if (ok) toast.success(t('editor:media.uploaded', { count: ok }))
    const pending = items.filter((x) => x.status !== 'done').length
    if (ok === 1 && pending === 1 && lastId) navigate(objectPath('media', lastId))
  }

  const ready = items.filter((x) => x.status === 'ready' || x.status === 'error').length

  return (
    <Page title={t('editor:media.uploadTitle')} description={t('editor:media.uploadDescription')}>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            if (e.dataTransfer.files?.length) add(e.dataTransfer.files)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            drag ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
          )}
        >
          <Upload className="size-7 text-muted-foreground" />
          <p className="font-serif text-lg">{t('editor:media.drop')}</p>
          <p className="text-sm text-muted-foreground">{t('editor:media.dropHint')}</p>
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) add(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {items.length > 0 && (
          <ul className="flex flex-col divide-y rounded-xl border">
            {items.map((it) => (
              <li key={it.key} className="flex items-center gap-3 p-2.5">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {it.preview ? <img src={it.preview} alt="" className="size-full object-cover" /> : <FileImage className="size-5 text-muted-foreground" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Input
                    value={it.desc}
                    aria-label={t('editor:media.desc')}
                    disabled={it.status !== 'ready' && it.status !== 'error'}
                    onChange={(e) => patch(it.key, { desc: e.target.value })}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{it.file.name}</span>
                    <span className="shrink-0 tabular-nums">{(it.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  {(it.status === 'uploading' || it.status === 'saving') && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(it.progress * 100)}>
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(it.progress * 100)}%` }} />
                    </div>
                  )}
                  {it.status === 'error' && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <CircleAlert className="size-3.5" /> {it.error}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {it.status === 'done' && it.grampsId ? (
                    <Link to={objectPath('media', it.grampsId)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                      <CircleCheck className="size-4" /> {it.grampsId}
                    </Link>
                  ) : it.status === 'uploading' || it.status === 'saving' ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('editor:remove')}
                      disabled={running}
                      onClick={() => setItems((list) => list.filter((x) => x.key !== it.key))}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateInput label={t('editor:media.dateAll')} value={date} onChange={setDate} />
          <Field label={t('editor:media.linkPerson')} hint={t('editor:media.linkPersonHint')}>
            <div className="flex gap-1">
              <ObjectPicker
                kinds={['person']}
                value={person}
                placeholder={t('editor:media.choosePerson')}
                onChange={(o) => setPerson({ handle: o.handle, title: o.title })}
              />
              {person && (
                <Button type="button" variant="ghost" size="icon" aria-label={t('editor:clear')} onClick={() => setPerson(null)}>
                  <X />
                </Button>
              )}
            </div>
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={running}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="button" onClick={run} disabled={running || ready === 0}>
            {running ? <Loader2 className="animate-spin" /> : <Upload />}
            {t('editor:media.uploadCount', { count: ready })}
          </Button>
        </div>
      </div>
    </Page>
  )
}
