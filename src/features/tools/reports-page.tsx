import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, Download, ExternalLink, FileText, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Page } from '@/components/app-shell'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { api } from '@/lib/api'
import { useAccessToken } from '@/lib/auth'
import { useHomePerson } from '@/lib/prefs'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTitle } from '@/hooks/use-title'
import { OptionInput, reportFields, reportStrings, useGrampsText, type OptionField, type ReportDef } from './report-options'
import { TaskStatusLine, taskErrorText } from './task-status'
import { useTask, withJwt } from './use-task'

interface ReportResult {
  file_name: string
  file_type: string
  url: string
}

const CATEGORY_ORDER = [1, 6, 0, 4, 5, 3, 2]
const VIEWABLE = new Set(['.pdf', '.svg', '.png', '.jpg', '.gif', '.html', '.txt'])

function useReports() {
  return useQuery({
    queryKey: ['reports', 'help'],
    queryFn: () => api<ReportDef[]>('/reports/', { query: { include_help: 1 } }),
    staleTime: 30 * 60_000,
  })
}

function useReportText(strings: string[] = []) {
  const { t, i18n } = useTranslation('tools')
  const tr = useGrampsText(strings)
  return (r: ReportDef) => {
    const key = `tools:reports.names.${r.id}`
    return i18n.exists(key)
      ? { name: t(`reports.names.${r.id}.name`), description: t(`reports.names.${r.id}.description`) }
      : { name: tr(r.name), description: tr(r.description) }
  }
}

export function ReportsPage() {
  const { t } = useTranslation('tools')
  useTitle(t('reports.title'))
  const q = useReports()
  const text = useReportText((q.data ?? []).flatMap((r) => [r.name, r.description]))
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<ReportDef | null>(null)
  const isMobile = useIsMobile()

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const list = (q.data ?? [])
      .map((r) => ({ r, ...text(r) }))
      .filter((x) => !needle || `${x.name} ${x.description} ${x.r.name}`.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
    const map = new Map<number, typeof list>()
    for (const x of list) map.set(x.r.category, [...(map.get(x.r.category) ?? []), x])
    return [...map.entries()].sort(
      ([a], [b]) => (CATEGORY_ORDER.indexOf(a) + 100) % 100 - ((CATEGORY_ORDER.indexOf(b) + 100) % 100),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, search, t, text])

  return (
    <Page title={t('reports.title')} description={t('reports.description')}>
      <div className="mx-auto max-w-4xl">
        <div className="relative mb-8 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('reports.searchPlaceholder')}
            aria-label={t('reports.searchPlaceholder')}
            className="pl-8"
          />
        </div>

        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <RowsSkeleton rows={8} />
        ) : groups.length === 0 ? (
          <EmptyState title={t('reports.noMatches', { q: search.trim() })} />
        ) : (
          <div className="space-y-10">
            {groups.map(([cat, items]) => (
              <section key={cat}>
                <div className="mb-1 flex items-baseline gap-2 border-b pb-2">
                  <h2 className="text-xl font-medium">
                    {t(`reports.category.${cat}`, { defaultValue: t('reports.category.other') })}
                  </h2>
                  <span className="text-sm tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                <ul className="divide-y">
                  {items.map(({ r, name, description }) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setOpen(r)}
                        className="group flex w-full items-center gap-4 rounded-md px-2 py-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{name}</span>
                          <span className="block text-sm text-muted-foreground">{description}</span>
                        </span>
                        <span className="shrink-0 text-sm text-primary opacity-80 group-hover:opacity-100">
                          {t('reports.create')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={cn(
            'w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg',
            'data-[side=bottom]:h-[calc(100dvh-env(safe-area-inset-top,0px)-0.75rem)] data-[side=bottom]:overflow-hidden data-[side=bottom]:rounded-t-2xl data-[side=bottom]:data-open:slide-in-from-bottom data-[side=bottom]:data-closed:slide-out-to-bottom',
            'max-md:[&>[data-slot=sheet-close]]:top-2.5 max-md:[&>[data-slot=sheet-close]]:right-2.5 max-md:[&>[data-slot=sheet-close]]:size-10',
          )}
        >
          {open && <ReportForm key={open.id} report={open} />}
        </SheetContent>
      </Sheet>
    </Page>
  )
}

function ReportForm({ report }: { report: ReportDef }) {
  const { t, i18n } = useTranslation('tools')
  const [homePerson] = useHomePerson()
  useAccessToken()
  const fields = useMemo(
    () => reportFields(report, { lang: i18n.language.slice(0, 2), homePerson }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report],
  )
  const strings = useMemo(() => reportStrings(report, fields), [report, fields])
  const tr = useGrampsText(strings)
  const text = useReportText(strings)(report)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.defaultValue])),
  )
  const task = useTask<ReportResult>()
  const set = (k: string) => (v: string) => setValues((s) => ({ ...s, [k]: v }))

  const run = async () => {
    const options: Record<string, string> = {}
    for (const f of fields) if (values[f.key] !== '' || f.kind === 'text') options[f.key] = values[f.key]
    try {
      await task.start((signal) =>
        api(`/reports/${report.id}/file`, { method: 'POST', query: { options: JSON.stringify(options) }, signal }),
      )
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error(t('reports.failed', { message: taskErrorText(t, e) }))
    }
  }

  const byGroup = (g: OptionField['group']) => fields.filter((f) => f.group === g)
  const result = task.result

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="font-serif text-2xl font-medium">{text.name}</SheetTitle>
        <SheetDescription>{text.description}</SheetDescription>
        {(!!report.authors?.length || report.version) && (
          <p className="text-xs text-muted-foreground">
            {[report.authors?.length && t('reports.authors', { list: report.authors.join(', ') }), report.version && t('reports.version', { version: report.version })]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
        {result ? (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-serif text-lg">{t('reports.ready')}</p>
                <p className="truncate text-xs text-muted-foreground uppercase">{result.file_type.replace('.', '')}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild>
                <a href={withJwt(result.url)} download={`${text.name}${result.file_type}`}>
                  <Download />
                  {t('file.download')}
                </a>
              </Button>
              {VIEWABLE.has(result.file_type) && (
                <Button asChild variant="outline">
                  <a href={withJwt(result.url)} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    {t('file.open')}
                  </a>
                </Button>
              )}
              <Button variant="ghost" onClick={task.reset}>
                {t('reports.again')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t('reports.defaultHint')}</p>
            <div className="space-y-4">
              {byGroup('main').map((f) => (
                <OptionInput key={f.key} field={f} value={values[f.key]} onChange={set(f.key)} tr={tr} />
              ))}
            </div>
            <MoreGroup title={t('reports.moreOptions')} fields={byGroup('more')} values={values} set={set} tr={tr} />
            <MoreGroup title={t('reports.layout')} fields={byGroup('layout')} values={values} set={set} tr={tr} />
          </>
        )}
      </div>

      {!result && (
        <SheetFooter className="border-t max-md:pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <TaskStatusLine
            phase={task.phase === 'failure' ? 'failure' : task.running ? 'running' : 'idle'}
            progress={task.progress}
            error={task.error}
            runningLabel={t('reports.creating')}
          />
          <Button onClick={run} disabled={task.running} className="max-md:h-11 max-md:text-base">
            {task.running && <Loader2 className="animate-spin" />}
            {task.running ? t('reports.creating') : t('reports.createReport')}
          </Button>
        </SheetFooter>
      )}
    </>
  )
}

function MoreGroup({
  title,
  fields,
  values,
  set,
  tr,
}: {
  title: string
  fields: OptionField[]
  values: Record<string, string>
  set: (k: string) => (v: string) => void
  tr: (s: string) => string
}) {
  const [open, setOpen] = useState(false)
  if (!fields.length) return null
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="-mx-2.5 w-[calc(100%+1.25rem)] justify-between">
          {title}
          <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3">
        {fields.map((f) => (
          <OptionInput key={f.key} field={f} value={values[f.key]} onChange={set(f.key)} tr={tr} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
