import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowRight, BookOpen, ChartPie, ChevronDown, Code, Download, ExternalLink, FileText, Globe, Loader2, Network, Search, Share2, type LucideIcon } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AlbumPage } from '@/components/album-page'
import { EmptyState, ErrorState } from '@/components/states'
import { useGetReportsQuery, usePostReportFileMutation } from '@/api/enhanced/tasks-slice-enhanced'
import { useAccessToken } from '@/lib/auth'
import { useHomePerson } from '@/lib/prefs'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTitle } from '@/hooks/use-title'
import { OptionInput, reportFields, reportStrings, useGrampsText, type OptionField, type ReportDef } from './report-options'
import { TaskStatusLine, taskErrorText } from './task-status'
import { isAbort, unwrapWith, useTask, withJwt } from './use-task'

interface ReportResult {
  file_name: string
  file_type: string
  url: string
}

const CATEGORY_ORDER = [1, 6, 0, 4, 5, 3, 2]
/** Gramps report categories (0 text, 1 draw, 2 code, 3 web, 4 book, 5 graphviz, 6 tree). */
const categoryIcon: Record<number, LucideIcon> = { 0: FileText, 1: ChartPie, 2: Code, 3: Globe, 4: BookOpen, 5: Share2, 6: Network }
const VIEWABLE = new Set(['.pdf', '.svg', '.png', '.jpg', '.gif', '.html', '.txt'])

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
  const q = useGetReportsQuery({ includeHelp: true })
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
    <AlbumPage
      title={t('reports.title')}
      description={t('reports.description')}
      actions={
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('reports.searchPlaceholder')}
            aria-label={t('reports.searchPlaceholder')}
            className="h-11 rounded-full bg-card pl-10 sm:h-10 dark:bg-card"
          />
        </div>
      }
    >
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl bg-card">
          <EmptyState title={t('reports.noMatches', { q: search.trim() })} />
        </div>
      ) : (
        <div className="space-y-12">
          {groups.map(([cat, items]) => {
            const Icon = categoryIcon[cat] ?? FileText
            return (
              <section key={cat} aria-labelledby={`cat-${cat}`}>
                <div className="mb-5 flex items-baseline gap-3">
                  <h2 id={`cat-${cat}`} className="font-serif text-3xl font-medium">
                    {t(`reports.category.${cat}`, { defaultValue: t('reports.category.other') })}
                  </h2>
                  <span className="text-sm tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {items.map(({ r, name, description }) => (
                    <li key={r.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setOpen(r)}
                        className="group flex h-full w-full flex-col rounded-3xl bg-card p-5 text-left outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] sm:p-6"
                      >
                        <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-brass transition-colors duration-150 group-hover:bg-brass group-hover:text-brass-foreground">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="mt-4 block font-serif text-xl leading-snug font-medium text-balance">{name}</span>
                        <span className="mt-1.5 line-clamp-3 block flex-1 text-sm text-muted-foreground">{description}</span>
                        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brass">
                          {t('reports.create')}
                          <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

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
    </AlbumPage>
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
  const [runReport] = usePostReportFileMutation()
  const set = (k: string) => (v: string) => setValues((s) => ({ ...s, [k]: v }))

  const run = async () => {
    const missing = fields.find((f) => f.required && !values[f.key].trim())
    if (missing) {
      toast.error(t('reports.required', { label: t(`reports.options.${missing.key}`, { defaultValue: missing.key }) }))
      return
    }
    const options: Record<string, string> = {}
    for (const f of fields) if (values[f.key] !== '' || f.kind === 'text') options[f.key] = values[f.key]
    try {
      await task.start((signal) => unwrapWith(signal, runReport({ reportId: report.id, options: JSON.stringify(options) })))
    } catch (e) {
      if (!isAbort(e)) toast.error(t('reports.failed', { message: taskErrorText(t, e) }))
    }
  }

  const byGroup = (g: OptionField['group']) => fields.filter((f) => f.group === g)
  const result = task.result

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="font-serif text-3xl leading-tight font-medium">{text.name}</SheetTitle>
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
          <div className="rounded-3xl bg-secondary/60 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brass text-brass-foreground">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-serif text-2xl">{t('reports.ready')}</p>
                <p className="truncate text-xs text-muted-foreground uppercase">{result.file_type.replace('.', '')}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 [&>*]:h-11 [&>*]:rounded-full [&>*]:px-5 sm:[&>*]:h-10">
              <Button asChild>
                <a href={withJwt(result.url)} download={`${text.name}${result.file_type}`}>
                  <Download />
                  {t('file.download')}
                </a>
              </Button>
              {VIEWABLE.has(result.file_type) && (
                <Button asChild variant="secondary">
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
          <Button onClick={run} disabled={task.running} className="h-11 rounded-full text-base sm:h-10 sm:text-sm">
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
