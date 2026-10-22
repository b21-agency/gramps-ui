import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Search, SearchX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Panel } from '@/components/detail/panel'
import { ObjectThumb } from '@/components/object-thumb'
import { EmptyState, ErrorState } from '@/components/states'
import { searchQuery, useDebounced } from '@/components/command-search'
import { useSearchQuery } from '@/api/enhanced/objects'
import { useSearchCountsQuery } from '@/api/enhanced/shared'
import { apiLocale } from '@/i18n'
import { describeObject, kindIcon, objectPath } from '@/lib/objects'
import { timeAgo } from '@/lib/format'
import type { ObjectKind, SearchHit } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { useMetadata } from '@/lib/queries'
import { cn } from '@/lib/utils'

const KINDS: ObjectKind[] = ['person', 'family', 'event', 'place', 'media', 'source', 'citation', 'repository', 'note']
const PAGE_SIZE = 20

export function SearchPage() {
  const { t, i18n } = useTranslation(['search', 'common'])
  const [params, setParams] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  // one or more object types (comma separated), none = everything
  const types = (params.get('type') ?? '').split(',').filter((k): k is ObjectKind => KINDS.includes(k as ObjectKind))
  const type = types.length ? types.join(',') : null
  const { data: meta } = useMetadata()
  const sifts = (meta as { search?: { sifts?: { count_semantic?: number; semantic_index_stale?: boolean } } } | undefined)?.search?.sifts
  const semanticAvailable = !!meta?.server?.semantic_search && !!sifts?.count_semantic && sifts?.semantic_index_stale !== true
  const semantic = semanticAvailable && params.get('mode') === 'meaning'
  const sort = params.get('sort') === 'change' ? '-change' : null
  const page = Math.max(1, Number(params.get('page')) || 1)
  useTitle(q ? t('titleWithQuery', { q }) : t('title'))

  const update = (fn: (p: URLSearchParams) => void, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        fn(next)
        return next
      },
      { replace },
    )
  const setQ = (v: string) =>
    update((p) => {
      if (v.trim()) p.set('q', v.trim())
      else p.delete('q')
      p.delete('page')
    }, true)
  const setType = (k: ObjectKind | null) =>
    update((p) => {
      const next = k ? (types.includes(k) ? types.filter((x) => x !== k) : [...types, k]) : []
      if (next.length) p.set('type', next.join(','))
      else p.delete('type')
      p.delete('page')
    })
  const setMode = (m: 'meaning' | null) =>
    update((p) => {
      if (m) p.set('mode', m)
      else p.delete('mode')
      p.delete('page')
    })
  const setSort = (s: 'change' | null) =>
    update((p) => {
      if (s) p.set('sort', s)
      else p.delete('sort')
      p.delete('page')
    })

  const locale = apiLocale()
  const query = semantic ? q : searchQuery(q)
  // `data` keeps the previous page while the next one loads (shown dimmed)
  const results = useSearchQuery(
    query
      ? {
          query,
          type: type ?? KINDS.join(','),
          sort,
          page,
          pagesize: PAGE_SIZE,
          locale,
          profile: 'self',
          semantic: semanticAvailable ? (semantic ? 1 : 0) : undefined,
        }
      : skipToken,
  )
  const isPlaceholderData = results.isFetching && !results.currentData

  // counts per object type for the chips (cheap: one hit each)
  const counts = useSearchCountsQuery(
    query
      ? { query, types: [null, ...KINDS], params: { locale, semantic: semanticAvailable ? (semantic ? 1 : 0) : undefined } }
      : skipToken,
  )
  const countOf = (i: number) => counts.data?.[i]
  const total = results.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const unavailable = (results.error as { status?: unknown } | undefined)?.status === 503

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-[2.6rem] font-medium leading-[1] tracking-[-0.02em] sm:text-6xl">{t('title')}</h1>
        <p className="mt-3 min-h-7 text-lg text-muted-foreground" aria-live="polite">
          {q && results.data ? (
            <span className="inline-flex items-center gap-2 tabular-nums">
              {t('resultCount', { count: total, n: total.toLocaleString(i18n.language) })}
              {results.isFetching && <Loader2 className="size-4 animate-spin" aria-hidden />}
            </span>
          ) : (
            t('help.intro')
          )}
        </p>
      </header>

      <SearchBox value={q} onChange={setQ} />

      {q && (
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-start">
        <div
          className="-mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          role="group"
          aria-label={t('filterByType')}
        >
          <TypeChip active={!type} label={t('all')} count={countOf(0)} onClick={() => setType(null)} />
          {KINDS.map((k, i) => {
            const n = countOf(i + 1)
            if (n === 0 && !types.includes(k)) return null
            return <TypeChip key={k} kind={k} active={types.includes(k)} label={t(`common:objects.${k}`)} count={n} onClick={() => setType(k)} />
          })}
        </div>
          <div className="flex flex-wrap items-center gap-1 text-sm [&_button]:h-9 [&_button]:rounded-full [&_button]:px-3.5 max-sm:[&_button]:h-10">
            {semanticAvailable && (
              <>
                <span className="sr-only">{t('modeLabel')}</span>
                <Button variant={semantic ? 'ghost' : 'secondary'} size="sm" aria-pressed={!semantic} onClick={() => setMode(null)}>
                  {t('modeText')}
                </Button>
                <Button variant={semantic ? 'secondary' : 'ghost'} size="sm" aria-pressed={semantic} onClick={() => setMode('meaning')}>
                  {t('modeMeaning')}
                </Button>
                <span className="mx-1 h-4 w-px bg-border" aria-hidden />
              </>
            )}
            <span className="sr-only">{t('sortLabel')}</span>
            <Button variant={sort ? 'ghost' : 'secondary'} size="sm" aria-pressed={!sort} onClick={() => setSort(null)}>
              {t('sortRelevance')}
            </Button>
            <Button variant={sort ? 'secondary' : 'ghost'} size="sm" aria-pressed={!!sort} onClick={() => setSort('change')}>
              {t('sortChanged')}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 sm:mt-8">
        {!q ? (
          <SearchHelp />
        ) : unavailable ? (
          <EmptyState icon={SearchX} title={t('unavailable')} className="rounded-3xl bg-card">
            <p>{t('unavailableHint')}</p>
          </EmptyState>
        ) : results.isError && !results.currentData ? (
          <ErrorState error={results.error} onRetry={() => results.refetch()} />
        ) : !results.data ? (
          <ResultsSkeleton />
        ) : total === 0 ? (
          <div className="grid gap-6">
            <EmptyState icon={SearchX} title={t('noResults', { q })} className="rounded-3xl bg-card">
              <p>{type ? t('noResultsTypeHint') : t('noResultsHint')}</p>
              {type && (
                <Button className="mt-4 h-11 rounded-full px-5 sm:h-10" onClick={() => setType(null)}>
                  {t('searchEverything')}
                </Button>
              )}
            </EmptyState>
            {!type && <SearchHelp />}
          </div>
        ) : (
          <>
            <ul role="list" className={cn('grid gap-x-4 rounded-3xl bg-card p-2 transition-opacity sm:p-3 xl:grid-cols-2 2xl:grid-cols-3', isPlaceholderData && 'opacity-60')}>
              {results.data.items.map((hit) => (
                <ResultRow key={hit.handle} hit={hit} />
              ))}
            </ul>
            {pages > 1 && <Pager page={page} pages={pages} params={params} />}
          </>
        )}
      </div>
    </div>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('search')
  const [text, setText] = useState(value)
  const debounced = useDebounced(text, 300)
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(value)
    }
  }, [value])
  useEffect(() => {
    if (debounced.trim() !== last.current) {
      last.current = debounced.trim()
      onChange(debounced)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    last.current = text.trim()
    onChange(text)
  }
  return (
    <form role="search" onSubmit={submit}>
      <InputGroup className="h-14 rounded-2xl border-transparent bg-card text-base shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-brass/60 sm:h-16 dark:bg-card">
        <InputGroupAddon className="pl-4 sm:pl-5">
          <Search className="size-5! text-brass sm:size-6!" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          autoFocus={!value}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="font-serif text-lg md:text-xl placeholder:text-muted-foreground/80 [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <InputGroupAddon align="inline-end" className="pr-3">
            <InputGroupButton size="icon-sm" className="size-10 rounded-full" aria-label={t('common:actions.clear')} onClick={() => setText('')}>
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
    </form>
  )
}

function TypeChip({
  kind,
  label,
  count,
  active,
  onClick,
}: {
  kind?: ObjectKind
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  const Icon = kind ? kindIcon[kind] : null
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition-[background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] max-sm:h-11',
        active ? 'bg-primary font-medium text-primary-foreground' : 'bg-card hover:bg-accent',
      )}
    >
      {Icon && <Icon className={cn('size-3.5', !active && 'text-muted-foreground')} />}
      {label}
      <span className={cn('tabular-nums', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
        {count == null ? '·' : count.toLocaleString()}
      </span>
    </button>
  )
}

function ResultRow({ hit }: { hit: SearchHit }) {
  const { t, i18n } = useTranslation('search')
  const kind = hit.object_type as ObjectKind
  const o = hit.object
  const d = describeObject(kind, o)
  return (
    <li>
      <Link
        to={objectPath(kind, o.gramps_id)}
        className="flex items-center gap-3 rounded-2xl px-2 py-2 outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-4 sm:px-3"
      >
        <ObjectThumb kind={kind} handle={o.handle} mediaRef={o.media_list?.[0]} name={d.title} sex={o.profile?.sex} size={48} />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate', kind === 'note' ? 'text-[15px]' : 'text-[15px] font-semibold')}>{d.title}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {[t(`common:object.${kind}`), d.subtitle].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="hidden shrink-0 flex-col items-end text-xs text-muted-foreground sm:flex">
          <span className="tabular-nums">{o.gramps_id}</span>
          {o.change ? <span>{timeAgo(o.change, i18n.language)}</span> : null}
        </span>
      </Link>
    </li>
  )
}

function Pager({ page, pages, params }: { page: number; pages: number; params: URLSearchParams }) {
  const { t } = useTranslation('search')
  const href = (n: number) => {
    const p = new URLSearchParams(params)
    if (n > 1) p.set('page', String(n))
    else p.delete('page')
    return `?${p.toString()}`
  }
  // 1 … p-1 p p+1 … last
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b)
  return (
    <nav aria-label={t('pagination')} className="mt-6 flex items-center justify-center gap-1 [&_[data-slot=button]]:h-10 [&_[data-slot=button]]:min-w-10 [&_[data-slot=button]]:rounded-full">
      <Button asChild={page > 1} variant="ghost" size="sm" disabled={page <= 1}>
        {page > 1 ? (
          <Link to={href(page - 1)} aria-label={t('previous')}>
            <ChevronLeft />
            <span className="hidden sm:inline">{t('previous')}</span>
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1">
            <ChevronLeft />
            <span className="hidden sm:inline">{t('previous')}</span>
          </span>
        )}
      </Button>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <Button asChild variant={n === page ? 'outline' : 'ghost'} size="icon-sm">
            <Link to={href(n)} aria-current={n === page ? 'page' : undefined} className="tabular-nums">
              {n}
            </Link>
          </Button>
        </span>
      ))}
      <Button asChild={page < pages} variant="ghost" size="sm" disabled={page >= pages}>
        {page < pages ? (
          <Link to={href(page + 1)} aria-label={t('next')}>
            <span className="hidden sm:inline">{t('next')}</span>
            <ChevronRight />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="hidden sm:inline">{t('next')}</span>
            <ChevronRight />
          </span>
        )}
      </Button>
    </nav>
  )
}

function ResultsSkeleton() {
  return (
    <div className="space-y-1 rounded-3xl bg-card p-3 sm:p-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-1 py-2" style={{ opacity: 1 - i / 10 }}>
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SearchHelp() {
  const { t } = useTranslation('search')
  const tips: Array<[string, string]> = [
    ['Garner', t('help.word')],
    ['Gar*', t('help.wildcard')],
    ['"Lewis Anderson"', t('help.phrase')],
    ['Garner OR Zieliński', t('help.or')],
    ['I0044', t('help.id')],
  ]
  return (
    <Panel title={t('help.title')}>
      <p className="-mt-2 mb-5 text-muted-foreground">{t('help.tryOne')}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {tips.map(([ex, text]) => (
          <li key={ex} className="min-w-0">
            <Link
              to={`/search?${new URLSearchParams({ q: ex })}`}
              className="flex min-h-14 items-center gap-3 rounded-2xl bg-secondary/60 px-4 py-2.5 outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-lg text-brass">{ex}</span>
                <span className="block text-sm text-muted-foreground">{text}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
