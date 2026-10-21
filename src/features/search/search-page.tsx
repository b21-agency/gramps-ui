import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Loader2, Search, SearchX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Page } from '@/components/app-shell'
import { Portrait } from '@/components/portrait'
import { EmptyState, ErrorState } from '@/components/states'
import { searchQuery, useDebounced } from '@/components/command-search'
import { ApiError, apiRaw, mediaThumbUrl } from '@/lib/api'
import { useAccessToken } from '@/lib/auth'
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
  const results = useQuery({
    queryKey: ['search', 'page', query, type, sort, page, locale, semantic],
    enabled: !!query,
    placeholderData: keepPreviousData,
    queryFn: () =>
      apiRaw<SearchHit[]>('/search/', {
        query: {
          query,
          type: type ?? KINDS.join(','),
          sort,
          page,
          pagesize: PAGE_SIZE,
          locale,
          profile: 'self',
          semantic: semanticAvailable ? (semantic ? 1 : 0) : undefined,
        },
      }),
  })

  // counts per object type for the chips (cheap: one hit each)
  const counts = useQueries({
    queries: [null, ...KINDS].map((k) => ({
      queryKey: ['search', 'count', query, k, locale, semantic],
      enabled: !!query,
      staleTime: 60_000,
      placeholderData: keepPreviousData,
      queryFn: async () =>
        (
          await apiRaw<SearchHit[]>('/search/', {
            query: { query, type: k, page: 1, pagesize: 1, locale, semantic: semanticAvailable ? (semantic ? 1 : 0) : undefined },
          })
        ).total ?? 0,
    })),
  })
  const countOf = (i: number) => counts[i]?.data
  const total = results.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const unavailable = results.error instanceof ApiError && results.error.status === 503

  return (
    <Page
      title={t('title')}
      description={
        q && results.data ? (
          <span className="inline-flex items-center gap-2 tabular-nums" aria-live="polite">
            {t('resultCount', { count: total, n: total.toLocaleString(i18n.language) })}
            {results.isFetching && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          </span>
        ) : undefined
      }
    >
      <SearchBox value={q} onChange={setQ} />

      {q && (
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t('filterByType')}>
          <TypeChip active={!type} label={t('all')} count={countOf(0)} onClick={() => setType(null)} />
          {KINDS.map((k, i) => {
            const n = countOf(i + 1)
            if (n === 0 && !types.includes(k)) return null
            return <TypeChip key={k} kind={k} active={types.includes(k)} label={t(`common:objects.${k}`)} count={n} onClick={() => setType(k)} />
          })}
          <div className="ml-auto flex flex-wrap items-center gap-1 text-sm">
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

      <div className="mt-6">
        {!q ? (
          <SearchHelp />
        ) : unavailable ? (
          <EmptyState icon={SearchX} title={t('unavailable')}>
            <p>{t('unavailableHint')}</p>
          </EmptyState>
        ) : results.isError && !results.data ? (
          <ErrorState error={results.error} onRetry={() => results.refetch()} />
        ) : !results.data ? (
          <ResultsSkeleton />
        ) : total === 0 ? (
          <EmptyState icon={SearchX} title={t('noResults', { q })}>
            <p>{type ? t('noResultsTypeHint') : t('noResultsHint')}</p>
            {type && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setType(null)}>
                {t('searchEverything')}
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            <ul role="list" className={cn('-mx-2 transition-opacity', results.isPlaceholderData && 'opacity-60')}>
              {results.data.data.map((hit) => (
                <ResultRow key={hit.handle} hit={hit} />
              ))}
            </ul>
            {pages > 1 && <Pager page={page} pages={pages} params={params} />}
          </>
        )}
      </div>
    </Page>
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
      <InputGroup className="h-12 rounded-xl bg-card text-base">
        <InputGroupAddon className="pl-3">
          <Search className="size-5!" />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          autoFocus={!value}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="text-base md:text-base [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-sm" aria-label={t('common:actions.clear')} onClick={() => setText('')}>
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
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
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
        className="flex items-center gap-3 rounded-lg px-2 py-2.5 outline-none hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ResultVisual hit={hit} title={d.title} />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate', kind === 'note' ? 'text-[0.95rem]' : 'font-serif text-[1.05rem] leading-snug')}>
            {d.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
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

function ResultVisual({ hit, title }: { hit: SearchHit; title: string }) {
  useAccessToken()
  const [failed, setFailed] = useState(false)
  const kind = hit.object_type as ObjectKind
  const o = hit.object
  if (kind === 'person') return <Portrait mediaRef={o.media_list?.[0]} name={title} sex={o.profile?.sex} size={40} />
  if (kind === 'media' && !failed)
    return (
      <span className="size-10 shrink-0 overflow-hidden rounded-md bg-secondary">
        <img src={mediaThumbUrl(o.handle, 100, { square: true })} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      </span>
    )
  const Icon = kindIcon[kind]
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
      <Icon className="size-4" />
    </span>
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
    <nav aria-label={t('pagination')} className="mt-6 flex items-center justify-center gap-1">
      <Button asChild={page > 1} variant="ghost" size="sm" disabled={page <= 1}>
        {page > 1 ? (
          <Link to={href(page - 1)} aria-label={t('previous')}>
            <ChevronLeft />
            <span className="hidden sm:inline">{t('previous')}</span>
          </Link>
        ) : (
          <span>
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
          <span>
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
    <div className="space-y-1">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5" style={{ opacity: 1 - i / 10 }}>
          <Skeleton className="size-10 rounded-full" />
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
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-xl font-medium">{t('help.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('help.intro')}</p>
      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        {tips.map(([ex, text]) => (
          <div key={ex} className="contents">
            <dt>
              <code className="rounded bg-secondary px-1.5 py-0.5 text-sm">{ex}</code>
            </dt>
            <dd className="mb-2 text-sm text-muted-foreground sm:mb-0">{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
