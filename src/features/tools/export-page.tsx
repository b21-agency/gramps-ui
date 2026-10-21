import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Archive, Download, FileArchive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Page } from '@/components/app-shell'
import { ErrorState, RowsSkeleton } from '@/components/states'
import { ObjectPicker } from '@/components/object-picker'
import { api } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { useAccessToken } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { useTitle } from '@/hooks/use-title'
import { TaskStatusLine, taskErrorText } from './task-status'
import { formatBytes, useTask, withJwt } from './use-task'

interface Exporter {
  extension: string
  name: string
  description: string
  module: string
}

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
  const q = useQuery({
    queryKey: ['exporters'],
    queryFn: () => api<Exporter[]>('/exporters/'),
    staleTime: 30 * 60_000,
  })

  const [ext, setExt] = useState('gramps')
  const [privateOff, setPrivateOff] = useState(false)
  const [living, setLiving] = useState<(typeof LIVING)[number]>('IncludeAll')
  const [yearsAfterDeath, setYearsAfterDeath] = useState('0')
  const [personFilter, setPersonFilter] = useState<(typeof PERSON_FILTERS)[number]>('all')
  const [person, setPerson] = useState<{ handle: string; title: string; gramps_id: string } | null>(null)
  const [csv, setCsv] = useState({ include_individuals: true, include_marriages: true, include_children: true, include_places: true, translate_headers: true })
  const [ged, setGed] = useState({ include_media: true, include_witnesses: true })
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
    const query: Record<string, string | number | boolean> = {
      private: privateOff,
      living,
      years_after_death: Number(yearsAfterDeath) || 0,
      locale: apiLocale(),
    }
    if (personFilter !== 'all' && person) {
      query.person = personFilter
      query.gramps_id = person.gramps_id
    }
    if (isCsv) Object.assign(query, csv)
    if (isGed) Object.assign(query, ged)
    if (ext === 'gramps') query.compress = compress
    try {
      await task.start((signal) => api(`/exporters/${ext}/file`, { method: 'POST', query, signal }))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(t('export.failed', { message: taskErrorText(t, e) }))
    }
  }

  return (
    <Page title={t('export.title')} description={t('export.description')}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <RowsSkeleton rows={6} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-10">
            <section>
              <h2 className="mb-3 border-b pb-2 text-xl font-medium">{t('export.format')}</h2>
              <RadioGroup
                value={ext}
                onValueChange={(v) => {
                  setExt(v)
                  task.reset()
                }}
                className="gap-2"
              >
                {exporters.map((e) => {
                  const l = label(e)
                  return (
                    <Label
                      key={e.extension}
                      htmlFor={`fmt-${e.extension}`}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 font-normal transition-colors hover:bg-accent/60',
                        ext === e.extension && 'border-primary/50 bg-primary/5',
                      )}
                    >
                      <RadioGroupItem id={`fmt-${e.extension}`} value={e.extension} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 font-medium">
                          {l.name}
                          <span className="text-xs font-normal text-muted-foreground">.{e.extension}</span>
                          {RECOMMENDED.has(e.extension) && (
                            <span className="rounded-full border border-brass/50 bg-brass/10 px-2 py-0.5 text-[11px] font-normal">
                              {t('export.recommended')}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{l.description}</span>
                      </span>
                    </Label>
                  )
                })}
              </RadioGroup>
            </section>

            <section className="space-y-5">
              <h2 className="border-b pb-2 text-xl font-medium">{t('export.options')}</h2>

              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="exp-private">{t('export.private')}</Label>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t('export.privateHint')}</p>
                </div>
                <Switch id="exp-private" checked={privateOff} onCheckedChange={setPrivateOff} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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

              <div className="grid gap-4 sm:grid-cols-2">
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

              {isCsv && (
                <div className="space-y-3 rounded-lg border bg-card p-4">
                  {(
                    [
                      ['include_individuals', 'individuals'],
                      ['include_marriages', 'marriages'],
                      ['include_children', 'children'],
                      ['include_places', 'places'],
                      ['translate_headers', 'translateHeaders'],
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
                <div className="space-y-3 rounded-lg border bg-card p-4">
                  <SwitchRow id="ged-media" label={t('export.gedcom.media')} checked={ged.include_media} onChange={(c) => setGed((s) => ({ ...s, include_media: c }))} />
                  <SwitchRow
                    id="ged-wit"
                    label={t('export.gedcom.witnesses')}
                    checked={ged.include_witnesses}
                    onChange={(c) => setGed((s) => ({ ...s, include_witnesses: c }))}
                  />
                </div>
              )}
              {ext === 'gramps' && <SwitchRow id="gramps-compress" label={t('export.compress')} checked={compress} onChange={setCompress} />}
            </section>

            <section className="space-y-4 rounded-xl border bg-card p-5">
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
                  <Button size="lg" onClick={run} disabled={task.running || !selected}>
                    {task.running ? <Loader2 className="animate-spin" /> : <Download />}
                    {t('export.start', { format: selected ? label(selected).name : '' })}
                  </Button>
                </>
              )}
            </section>
          </div>

          <aside className="min-w-0">
            <MediaArchive lang={i18n.language} />
          </aside>
        </div>
      )}
    </Page>
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
        <span className="flex size-10 items-center justify-center rounded-lg bg-secondary">
          <FileArchive className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-serif text-lg">{title}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <Button asChild size="lg">
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
  const run = async () => {
    try {
      await task.start((signal) => api('/media/archive/', { method: 'POST', signal }))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(taskErrorText(t, e))
    }
  }
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-2 flex items-center gap-2">
        <Archive className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-medium">{t('export.media.title')}</h2>
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
            <Button variant="outline" onClick={run} disabled={task.running}>
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
