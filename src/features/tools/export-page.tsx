import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Archive, Download, FileArchive, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlbumPage } from '@/components/album-page'
import { Panel } from '@/components/detail/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { ObjectPicker } from '@/components/object-picker'
import {
  useGetExportersQuery,
  usePostExporterFileMutation,
  type Exporter,
  type PostExporterFileApiArg,
} from '@/api/enhanced/tasks-slice-enhanced'
import { usePostMediaArchiveMutation } from '@/api/enhanced/media-slice-enhanced'
import { apiLocale } from '@/i18n'
import { useAccessToken, useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useTitle } from '@/hooks/use-title'
import { TaskStatusLine, taskErrorText } from './task-status'
import { formatBytes, isAbort, unwrapWith, useTask, withJwt } from './use-task'

interface ExportResult {
  file_name: string
  file_type?: string
  url: string
  messages?: string[]
  file_size?: number
}

const ORDER = ['gramps', 'ged', 'ged7', 'csv', 'jsonl', 'gw', 'vcf', 'vcs', 'wft']
const RECOMMENDED = new Set(['gramps', 'ged'])
const LIVING = ['IncludeAll', 'FullNameOnly', 'LastNameOnly', 'ReplaceCompleteName', 'ExcludeAll'] as const
const PERSON_FILTERS = ['all', 'Descendants', 'DescendantFamilies', 'Ancestors', 'CommonAncestor'] as const

export function ExportPage() {
  const { t, i18n } = useTranslation('tools')
  useTitle(t('export.title'))
  useAccessToken()
  const { can } = useAuth()
  const q = useGetExportersQuery()
  const [runExport] = usePostExporterFileMutation()

  const [ext, setExt] = useState('gramps')
  const [privateOff, setPrivateOff] = useState(false)
  const [living, setLiving] = useState<(typeof LIVING)[number]>('IncludeAll')
  const [yearsAfterDeath, setYearsAfterDeath] = useState('0')
  const [personFilter, setPersonFilter] = useState<(typeof PERSON_FILTERS)[number]>('all')
  const [person, setPerson] = useState<{ handle: string; title: string; gramps_id: string } | null>(null)
  const [csv, setCsv] = useState({ includeIndividuals: true, includeMarriages: true, includeChildren: true, includePlaces: true, translateHeaders: true })
  const [ged, setGed] = useState({ includeMedia: true, includeWitnesses: true })
  const [compress, setCompress] = useState(true)
  const task = useTask<ExportResult>()

  const exporters = [...(q.data ?? [])].sort(
    (a, b) => (ORDER.indexOf(a.extension) + 100) % 100 - ((ORDER.indexOf(b.extension) + 100) % 100),
  )
  const label = (e: Exporter) =>
    i18n.exists(`tools:export.formats.${e.extension}`)
      ? { name: t(`export.formats.${e.extension}.name`), description: t(`export.formats.${e.extension}.description`) }
      : { name: e.name.replace(/_/g, ''), description: e.description }
  const selected = exporters.find((e) => e.extension === ext)
  const isCsv = ext === 'csv'
  const isGed = ext === 'ged' || ext === 'ged7'

  const run = async () => {
    if (personFilter !== 'all' && !person) {
      toast.error(t('export.personRequired'))
      return
    }
    const query: PostExporterFileApiArg = {
      extension: ext,
      private: privateOff,
      living: living as PostExporterFileApiArg['living'],
      yearsAfterDeath: Number(yearsAfterDeath) || 0,
      locale: apiLocale(),
    }
    if (personFilter !== 'all' && person) {
      query.person = personFilter
      query.grampsId = person.gramps_id
    }
    if (isCsv) Object.assign(query, csv)
    if (isGed) Object.assign(query, ged)
    if (ext === 'gramps') query.compress = compress
    try {
      await task.start((signal) => unwrapWith(signal, runExport(query)))
    } catch (e) {
      if (!isAbort(e)) toast.error(t('export.failed', { message: taskErrorText(t, e) }))
    }
  }

  return (
    <AlbumPage title={t('export.title')} description={t('export.description')}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
            {!can('ViewPrivate') && (
              <p className="flex items-start gap-2.5 rounded-3xl bg-brass/10 px-5 py-4 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brass" />
                {t('export.incomplete')}
              </p>
            )}
            <section aria-labelledby="exp-format">
              <h2 id="exp-format" className="mb-5 font-serif text-3xl font-medium">{t('export.format')}</h2>
              <RadioGroup
                value={ext}
                onValueChange={(v) => {
                  setExt(v)
                  task.reset()
                }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              >
                {exporters.map((e) => {
                  const l = label(e)
                  return (
                    <Label
                      key={e.extension}
                      htmlFor={`fmt-${e.extension}`}
                      className={cn(
                        'flex h-full cursor-pointer flex-col items-stretch gap-0 rounded-3xl bg-card p-5 font-normal ring-2 ring-transparent transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-accent active:scale-[0.98] sm:p-6',
                        ext === e.extension && 'bg-accent ring-primary',
                      )}
                    >
                      <span className="flex items-start gap-3">
                        <span className="min-w-0 flex-1 font-serif text-3xl leading-none text-brass [overflow-wrap:anywhere]">.{e.extension}</span>
                        <RadioGroupItem id={`fmt-${e.extension}`} value={e.extension} className="mt-1 size-5" />
                      </span>
                      <span className="mt-4 block text-[15px] font-semibold">{l.name}</span>
                      <span className="mt-1 block flex-1 text-sm leading-snug text-muted-foreground">{l.description}</span>
                      {RECOMMENDED.has(e.extension) && (
                        <span className="mt-4 self-start rounded-full bg-brass/15 px-2.5 py-0.5 text-xs font-semibold text-brass">
                          {t('export.recommended')}
                        </span>
                      )}
                    </Label>
                  )
                })}
              </RadioGroup>
            </section>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
            <Panel title={t('export.options')}>
              <div className="space-y-6">

              <div className="flex items-start justify-between gap-4 rounded-2xl bg-secondary/50 p-4">
                <div>
                  <Label htmlFor="exp-private">{t('export.private')}</Label>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t('export.privateHint')}</p>
                </div>
                <Switch id="exp-private" checked={privateOff} onCheckedChange={setPrivateOff} />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="exp-living">{t('export.living')}</Label>
                  <Select value={living} onValueChange={(v) => setLiving(v as typeof living)}>
                    <SelectTrigger id="exp-living" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIVING.map((l) => (
                        <SelectItem key={l} value={l}>
                          {t(`export.livingOptions.${l}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {living !== 'IncludeAll' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="exp-years">{t('export.yearsAfterDeath')}</Label>
                    <Input
                      id="exp-years"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={yearsAfterDeath}
                      onChange={(e) => setYearsAfterDeath(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="exp-people">{t('export.personFilter')}</Label>
                  <Select value={personFilter} onValueChange={(v) => setPersonFilter(v as typeof personFilter)}>
                    <SelectTrigger id="exp-people" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSON_FILTERS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {t(`export.personFilters.${f}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {personFilter !== 'all' && (
                  <div className="space-y-1.5">
                    <Label>{t('export.choosePerson')}</Label>
                    <ObjectPicker
                      kinds={['person']}
                      value={person}
                      placeholder={t('export.choosePerson')}
                      onChange={(o) => setPerson({ handle: o.handle, title: o.title, gramps_id: o.gramps_id })}
                    />
                  </div>
                )}
              </div>

              </div>

              {isCsv && (
                <div className="grid gap-3 rounded-2xl bg-secondary/50 p-4 sm:grid-cols-2">
                  {(
                    [
                      ['includeIndividuals', 'individuals'],
                      ['includeMarriages', 'marriages'],
                      ['includeChildren', 'children'],
                      ['includePlaces', 'places'],
                      ['translateHeaders', 'translateHeaders'],
                    ] as const
                  ).map(([k, l]) => (
                    <SwitchRow
                      key={k}
                      id={`csv-${k}`}
                      label={t(`export.csv.${l}`)}
                      checked={csv[k]}
                      onChange={(c) => setCsv((s) => ({ ...s, [k]: c }))}
                    />
                  ))}
                </div>
              )}
              {isGed && (
                <div className="grid gap-3 rounded-2xl bg-secondary/50 p-4 sm:grid-cols-2">
                  <SwitchRow id="ged-media" label={t('export.gedcom.media')} checked={ged.includeMedia} onChange={(c) => setGed((s) => ({ ...s, includeMedia: c }))} />
                  <SwitchRow
                    id="ged-wit"
                    label={t('export.gedcom.witnesses')}
                    checked={ged.includeWitnesses}
                    onChange={(c) => setGed((s) => ({ ...s, includeWitnesses: c }))}
                  />
                </div>
              )}
              {ext === 'gramps' && (
                <div className="rounded-2xl bg-secondary/50 p-4">
                  <SwitchRow id="gramps-compress" label={t('export.compress')} checked={compress} onChange={setCompress} />
                </div>
              )}
              </div>
            </Panel>

            <div className="grid min-w-0 gap-6 lg:sticky lg:top-20">
            <section className="space-y-4 rounded-3xl bg-card p-5 sm:p-6">
              <div className="flex items-baseline gap-2">
                <h2 className="font-serif text-2xl font-medium">{selected ? label(selected).name : t('export.format')}</h2>
                <span className="font-serif text-lg text-brass">.{ext}</span>
              </div>
              {task.result ? (
                <ResultBlock
                  title={t('export.ready')}
                  url={task.result.url}
                  fileName={`${selected ? label(selected).name : 'export'}${task.result.file_type ?? `.${ext}`}`}
                  messages={task.result.messages}
                  messagesTitle={t('export.messages')}
                />
              ) : (
                <>
                  <TaskStatusLine phase={task.phase} progress={task.progress} error={task.error} runningLabel={t('export.running')} />
                  <Button className="h-11 w-full rounded-full text-base sm:h-11" onClick={run} disabled={task.running || !selected}>
                    {task.running ? <Loader2 className="animate-spin" /> : <Download />}
                    {t('export.start', { format: selected ? label(selected).name : '' })}
                  </Button>
                </>
              )}
            </section>
            <MediaArchive lang={i18n.language} />
            </div>
          </div>
        </div>
      )}
    </AlbumPage>
  )
}

function SwitchRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (c: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

export function ResultBlock({
  title,
  url,
  fileName,
  messages,
  messagesTitle,
  detail,
}: {
  title: string
  url: string
  fileName?: string
  messages?: string[]
  messagesTitle?: string
  detail?: string
}) {
  const { t } = useTranslation('tools')
  useAccessToken()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brass text-brass-foreground">
          <FileArchive className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-2xl leading-tight">{title}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <Button asChild className="h-11 w-full rounded-full text-base">
        <a href={withJwt(url)} download={fileName ?? ''}>
          <Download />
          {t('file.download')}
        </a>
      </Button>
      {!!messages?.length && (
        <div>
          <p className="mb-1 text-sm font-medium">{messagesTitle}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MediaArchive({ lang }: { lang: string }) {
  const { t } = useTranslation('tools')
  const task = useTask<ExportResult>()
  const [createArchive] = usePostMediaArchiveMutation()
  const run = async () => {
    try {
      await task.start((signal) => unwrapWith(signal, createArchive()))
    } catch (e) {
      if (!isAbort(e)) toast.error(taskErrorText(t, e))
    }
  }
  return (
    <section className="rounded-3xl bg-card p-5 sm:p-6">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-brass">
          <Archive className="size-[18px]" />
        </span>
        <h2 className="font-serif text-2xl font-medium">{t('export.media.title')}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t('export.media.description')}</p>
      <div className="mt-4 space-y-3">
        {task.result ? (
          <ResultBlock
            title={t('export.media.ready', { size: formatBytes(task.result.file_size, lang) })}
            url={task.result.url}
            fileName={task.result.file_name}
          />
        ) : (
          <>
            <TaskStatusLine phase={task.phase} progress={task.progress} error={task.error} runningLabel={t('export.media.running')} />
            <Button variant="secondary" className="h-11 w-full rounded-full sm:h-10" onClick={run} disabled={task.running}>
              {task.running && <Loader2 className="animate-spin" />}
              {t('export.media.start')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('export.media.limit')}</p>
          </>
        )}
      </div>
    </section>
  )
}
