import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { toast } from 'sonner'
import { CircleCheck, FileUp, FolderArchive, Loader2, Lock, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlbumPage } from '@/components/album-page'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/states'
import { api } from '@/lib/api'
import { TASK_TAGS, useGetImportersQuery } from '@/api/enhanced/tasks-slice-enhanced'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useTitle } from '@/hooks/use-title'
import { TaskStatusLine, taskErrorText } from './task-status'
import { formatBytes, isAbort, useTask } from './use-task'

type Counts = Record<string, number> & { messages?: string[] }

const COUNT_KEYS = ['people', 'families', 'events', 'places', 'sources', 'citations', 'repositories', 'notes', 'media', 'tags']

function extOf(name: string) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

// Binary upload bodies go through the raw client (a File must not end up in the Redux
// store as a mutation arg); the task hooks invalidate the cache once the import is done.
const upload = (ext: string, file: File, signal: AbortSignal, dryRun = false) =>
  api(`/importers/${ext}/file`, {
    method: 'POST',
    query: { dry_run: dryRun || undefined },
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    signal,
  })

export function ImportPage() {
  const { t, i18n } = useTranslation('tools')
  const { can } = useAuth()
  useTitle(t('import.title'))
  const q = useGetImportersQuery(can('ImportFile') ? undefined : skipToken)
  const [file, setFile] = useState<File | null>(null)
  const [ext, setExt] = useState('')
  const [dragging, setDragging] = useState(false)
  const check = useTask<Counts>()
  const run = useTask<Counts>({ invalidates: TASK_TAGS.import })
  const inputRef = useRef<HTMLInputElement>(null)

  if (!can('ImportFile'))
    return (
      <AlbumPage title={t('import.title')}>
        <div className="rounded-3xl bg-card">
          <EmptyState icon={Lock} title={t('import.noPermission')} className="py-24" />
        </div>
      </AlbumPage>
    )

  const importers = q.data ?? []
  const supported = importers.map((i) => `.${i.extension}`).join(', ')
  const known = importers.some((i) => i.extension === ext)

  const choose = (f: File | undefined | null) => {
    if (!f) return
    const e = extOf(f.name)
    setFile(f)
    run.reset()
    check.reset()
    if (!e || importers.some((i) => i.extension === e)) {
      setExt(e)
      if (e) void startCheck(f, e)
    } else {
      setExt(e)
    }
  }

  const startCheck = async (f: File, e: string) => {
    try {
      await check.start((signal) => upload(e, f, signal, true))
    } catch {
      /* shown inline */
    }
  }

  const startImport = async () => {
    if (!file || !ext) return
    try {
      await run.start((signal) => upload(ext, file, signal))
      toast.success(t('import.done'))
    } catch (e) {
      if (!isAbort(e)) toast.error(t('import.failed', { message: taskErrorText(t, e) }))
    }
  }

  const clear = () => {
    setFile(null)
    setExt('')
    check.reset()
    run.reset()
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    choose(e.dataTransfer.files?.[0])
  }

  return (
    <AlbumPage title={t('import.title')} description={t('import.description')}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton className="h-96 rounded-3xl" />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="min-w-0 space-y-6">
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={importers.map((i) => `.${i.extension}`).join(',')}
              onChange={(e) => {
                choose(e.target.files?.[0])
                e.target.value = ''
              }}
            />

            {!file ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  'rounded-3xl bg-card p-3 transition-colors duration-150 sm:p-4',
                  dragging && 'bg-accent',
                )}
              >
                <div
                  className={cn(
                    'flex min-h-[22rem] flex-col items-center justify-center gap-4 rounded-[1.25rem] border-2 border-dashed px-6 py-14 text-center transition-colors duration-150 sm:min-h-[28rem]',
                    dragging ? 'border-primary bg-primary/5' : 'border-brass/30',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-20 items-center justify-center rounded-full bg-secondary text-brass transition-transform duration-150',
                      dragging && 'scale-110 bg-brass text-brass-foreground',
                    )}
                  >
                    <FileUp className="size-9" strokeWidth={1.5} aria-hidden />
                  </span>
                  <p className="max-w-md font-serif text-3xl leading-tight font-medium text-balance sm:text-4xl">
                    {dragging ? t('import.dropActive') : t('import.drop')}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('import.or')}</p>
                  <Button className="h-11 rounded-full px-6 text-base sm:h-11" onClick={() => inputRef.current?.click()}>
                    {t('import.choose')}
                  </Button>
                  <p className="mt-2 max-w-md text-xs text-muted-foreground">{t('import.supported', { list: supported })}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl bg-card p-5 sm:p-8">
                <div className="flex items-center gap-4">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-brass">
                    <FileUp className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif text-2xl font-medium sm:text-3xl">{file.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatBytes(file.size, i18n.language)}
                      {ext && <span className="ml-2 font-semibold text-brass">.{ext}</span>}
                    </p>
                  </div>
                  {!run.running && (
                    <Button variant="ghost" size="icon" className="size-11 rounded-full" aria-label={t('import.removeFile')} onClick={clear}>
                      <X />
                    </Button>
                  )}
                </div>

                {ext && !known && (
                  <p className="mt-4 text-sm text-destructive">
                    {ext === 'gpkg' ? t('import.gpkg') : t('import.unsupported', { ext, list: supported })}
                  </p>
                )}
                {known && ext !== 'gramps' && !run.result && (
                  <p className="mt-4 text-sm text-muted-foreground">{t('import.syncHint')}</p>
                )}

                {!ext && (
                  <div className="mt-4 space-y-1.5 sm:max-w-xs">
                    <Label htmlFor="imp-format">{t('import.noExtension')}</Label>
                    <Select
                      onValueChange={(v) => {
                        setExt(v)
                        void startCheck(file, v)
                      }}
                    >
                      <SelectTrigger id="imp-format" className="h-11 w-full sm:h-10">
                        <SelectValue placeholder={t('import.format')} />
                      </SelectTrigger>
                      <SelectContent>
                        {importers.map((i) => (
                          <SelectItem key={i.extension} value={i.extension}>
                            {i.name} (.{i.extension})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {known && (
                  <div className="mt-5 space-y-4">
                    {run.result ? (
                      <ImportDone counts={run.result} onAnother={clear} />
                    ) : (
                      <>
                        <TaskStatusLine
                          phase={check.phase === 'success' ? 'idle' : check.phase}
                          progress={check.progress}
                          error={check.error}
                          runningLabel={t('import.checking')}
                        />
                        {check.result && <CountsList title={t('import.preview')} counts={check.result} />}
                        {check.result && <Messages title={t('import.previewMessages')} messages={check.result.messages} />}
                        {check.result && <p className="text-sm text-muted-foreground">{t('import.willAdd')}</p>}
                        <TaskStatusLine
                          phase={run.phase}
                          progress={run.progress}
                          error={run.error}
                          runningLabel={t('import.running')}
                        />
                        <Button className="h-11 rounded-full px-6 text-base" onClick={startImport} disabled={run.running || check.running}>
                          {run.running && <Loader2 className="animate-spin" />}
                          {t('import.start')}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="min-w-0">
            <MediaZipUpload />
          </aside>
        </div>
      )}
    </AlbumPage>
  )
}

function CountsList({ title, counts }: { title: string; counts: Counts }) {
  const { t } = useTranslation('tools')
  const rows = COUNT_KEYS.filter((k) => (counts[k] ?? 0) > 0)
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('import.previewEmpty')}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {rows.map((k) => (
            <div key={k} className="flex flex-col-reverse rounded-2xl bg-secondary/50 px-4 py-3">
              <dt className="mt-1 text-xs text-muted-foreground">{t(`import.counts.${k}`)}</dt>
              <dd className="font-serif text-3xl leading-none tabular-nums">{counts[k].toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function Messages({ title, messages }: { title: string; messages?: string[] }) {
  const list = (messages ?? []).filter(Boolean)
  if (!list.length) return null
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm whitespace-pre-line text-muted-foreground">
        {list.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </div>
  )
}

function ImportDone({ counts, onAnother }: { counts: Counts; onAnother: () => void }) {
  const { t } = useTranslation('tools')
  const messages = (counts.messages ?? []).filter(Boolean)
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-3 font-serif text-3xl font-medium">
        <CircleCheck className="size-7 text-chart-1" />
        {t('import.done')}
      </p>
      <p className="text-sm text-muted-foreground">{t('import.doneBody')}</p>
      <CountsList title={t('import.preview')} counts={counts} />
      {messages.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">{t('import.messages')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm whitespace-pre-line text-muted-foreground">
            {messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2 [&>*]:h-11 [&>*]:rounded-full [&>*]:px-5 sm:[&>*]:h-10">
        <Button asChild>
          <Link to="/people">
            <UsersRound />
            {t('import.viewPeople')}
          </Link>
        </Button>
        <Button variant="secondary" onClick={onAnother}>
          {t('import.another')}
        </Button>
      </div>
    </div>
  )
}

function MediaZipUpload() {
  const { t } = useTranslation('tools')
  const task = useTask<unknown>({ invalidates: TASK_TAGS.mediaArchiveUpload })
  const ref = useRef<HTMLInputElement>(null)
  const start = async (f: File | undefined) => {
    if (!f) return
    try {
      await task.start((signal) =>
        api('/media/archive/upload/zip', {
          method: 'POST',
          body: f,
          headers: { 'Content-Type': f.type || 'application/zip' },
          signal,
        }),
      )
      toast.success(t('import.media.done'))
    } catch (e) {
      if (!isAbort(e)) toast.error(t('import.failed', { message: taskErrorText(t, e) }))
    }
  }
  return (
    <section className="rounded-3xl bg-card p-5 sm:p-6">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-brass">
          <FolderArchive className="size-[18px]" />
        </span>
        <h2 className="font-serif text-2xl font-medium">{t('import.media.title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('import.media.description')}</p>
      <input
        ref={ref}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          void start(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className="mt-4 space-y-3">
        <TaskStatusLine
          phase={task.phase}
          progress={task.progress}
          error={task.error}
          runningLabel={t('import.media.running')}
          successLabel={t('import.media.done')}
        />
        <Button variant="secondary" className="h-11 w-full rounded-full sm:h-10" onClick={() => ref.current?.click()} disabled={task.running}>
          {task.running && <Loader2 className="animate-spin" />}
          {t('import.media.choose')}
        </Button>
      </div>
    </section>
  )
}
