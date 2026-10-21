import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CircleCheck, FileUp, FolderArchive, Loader2, Lock, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Page } from '@/components/app-shell'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useTitle } from '@/hooks/use-title'
import { TaskStatusLine, taskErrorText } from './task-status'
import { formatBytes, useTask } from './use-task'

interface Importer {
  extension: string
  name: string
  description: string
}

type Counts = Record<string, number> & { messages?: string[] }

const COUNT_KEYS = ['people', 'families', 'events', 'places', 'sources', 'citations', 'repositories', 'notes', 'media', 'tags']

function extOf(name: string) {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

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
  const qc = useQueryClient()
  useTitle(t('import.title'))
  const q = useQuery({
    queryKey: ['importers'],
    queryFn: () => api<Importer[]>('/importers/'),
    staleTime: 30 * 60_000,
    enabled: can('ImportFile'),
  })
  const [file, setFile] = useState<File | null>(null)
  const [ext, setExt] = useState('')
  const [dragging, setDragging] = useState(false)
  const check = useTask<Counts>()
  const run = useTask<Counts>()
  const inputRef = useRef<HTMLInputElement>(null)

  if (!can('ImportFile'))
    return (
      <Page title={t('import.title')}>
        <EmptyState icon={Lock} title={t('import.noPermission')} className="py-24" />
      </Page>
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
      void qc.invalidateQueries()
      toast.success(t('import.done'))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(t('import.failed', { message: taskErrorText(t, e) }))
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
    <Page title={t('import.title')} description={t('import.description')}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <RowsSkeleton rows={4} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
                  'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors',
                  dragging ? 'border-primary bg-primary/5' : 'border-border bg-card',
                )}
              >
                <FileUp className="size-8 text-muted-foreground" aria-hidden />
                <p className="font-serif text-xl">{dragging ? t('import.dropActive') : t('import.drop')}</p>
                <p className="text-sm text-muted-foreground">{t('import.or')}</p>
                <Button onClick={() => inputRef.current?.click()}>{t('import.choose')}</Button>
                <p className="mt-2 text-xs text-muted-foreground">{t('import.supported', { list: supported })}</p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                    <FileUp className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(file.size, i18n.language)}</p>
                  </div>
                  {!run.running && (
                    <Button variant="ghost" size="icon-sm" aria-label={t('import.removeFile')} onClick={clear}>
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
                      <SelectTrigger id="imp-format" className="w-full">
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
                        <Button size="lg" onClick={startImport} disabled={run.running || check.running}>
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
    </Page>
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
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {rows.map((k) => (
            <div key={k} className="flex items-baseline justify-between gap-2 border-b border-dashed py-1">
              <dt className="text-sm text-muted-foreground">{t(`import.counts.${k}`)}</dt>
              <dd className="font-serif text-lg tabular-nums">{counts[k].toLocaleString()}</dd>
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
      <p className="flex items-center gap-2 font-serif text-xl">
        <CircleCheck className="size-5 text-primary" />
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
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/people">
            <UsersRound />
            {t('import.viewPeople')}
          </Link>
        </Button>
        <Button variant="outline" onClick={onAnother}>
          {t('import.another')}
        </Button>
      </div>
    </div>
  )
}

function MediaZipUpload() {
  const { t } = useTranslation('tools')
  const qc = useQueryClient()
  const task = useTask<unknown>()
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
      void qc.invalidateQueries({ queryKey: ['media'] })
      toast.success(t('import.media.done'))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(t('import.failed', { message: taskErrorText(t, e) }))
    }
  }
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-2 flex items-center gap-2">
        <FolderArchive className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-medium">{t('import.media.title')}</h2>
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
        <Button variant="outline" onClick={() => ref.current?.click()} disabled={task.running}>
          {task.running && <Loader2 className="animate-spin" />}
          {t('import.media.choose')}
        </Button>
      </div>
    </section>
  )
}
