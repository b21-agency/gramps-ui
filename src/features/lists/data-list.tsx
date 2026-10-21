import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowDownUp, ArrowUp, Loader2, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Page } from '@/components/app-shell'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { searchQuery, useDebounced } from '@/components/command-search'
import { ApiError, apiRaw, type Query } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { useMetadata } from '@/lib/queries'
import { kindIcon, objectPath } from '@/lib/objects'
import { endpointOf, type ObjectKind, type SearchHit } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import { FilterChips, type FilterDef } from './filters'
import { and, textFilter, type Rule } from './rules'

/* ------------------------------------------------------------------ types */

export interface ListItem {
  handle: string
  gramps_id: string
  change?: number
}

export interface Column<T> {
  id: string
  header: ReactNode
  /** server sort key; makes the header clickable */
  sort?: string
  /** CSS grid track, e.g. 'minmax(0,2fr)' or '7rem' */
  width: string
  /** only shown when the list is at least this wide (px) */
  minWidth?: number
  align?: 'end'
  cell: (item: T) => ReactNode
}

export interface SortOption {
  key: string
  label: string
}

export interface ListConfig<T extends ListItem> {
  kind: ObjectKind
  /** base query for GET /{endpoint}/ (keys, profile, extend ...) */
  query: Query
  /** profile for /search/ when the quick filter uses the full-text index */
  searchProfile?: string
  sorts: SortOption[]
  /** e.g. 'surname' or '-change' */
  defaultSort: string
  /** filter rule matching one word of the quick filter */
  textRule: (word: string) => Rule
  filters: FilterDef[]
  columns: Column<T>[]
  /** stacked row content for narrow screens */
  compact: (item: T) => ReactNode
  rowHeight: number
  compactRowHeight: number
  /** optional group headings, e.g. surname when sorted by surname */
  group?: { sorts: string[]; key: (item: T) => string; label: (item: T) => ReactNode }
  placeholder: string
  pageSize?: number
  /** path to the "new object" page (shown with AddObject permission) */
  addPath?: string
  addNeedsEdit?: boolean
}

/* ------------------------------------------------------------------ URL state */

export interface ListState {
  q: string
  sort: string | null
  filters: Record<string, string | null>
  params: URLSearchParams
  setQ: (q: string) => void
  setSort: (sort: string | null) => void
  setFilter: (id: string, value: string | null) => void
  setParam: (id: string, value: string | null) => void
  clearFilters: () => void
}

export function useListState(filters: FilterDef[]): ListState {
  const [params, setParams] = useSearchParams()
  const update = useCallback(
    (fn: (p: URLSearchParams) => void, replace = false) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          fn(next)
          return next
        },
        { replace, preventScrollReset: true },
      ),
    [setParams],
  )
  const set = (p: URLSearchParams, k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k))
  const filterValues: Record<string, string | null> = {}
  for (const f of filters) filterValues[f.id] = params.get(f.id)
  const ids = filters.map((f) => f.id).join(',')
  return {
    q: params.get('q') ?? '',
    sort: params.get('sort'),
    filters: filterValues,
    params,
    setQ: useCallback((q: string) => update((p) => set(p, 'q', q.trim() || null), true), [update]),
    setSort: useCallback((s: string | null) => update((p) => set(p, 'sort', s)), [update]),
    setFilter: useCallback((id: string, v: string | null) => update((p) => set(p, id, v)), [update]),
    setParam: useCallback((id: string, v: string | null) => update((p) => set(p, id, v), true), [update]),
    clearFilters: useCallback(
      () => update((p) => ids.split(',').forEach((id) => p.delete(id))),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [update, ids],
    ),
  }
}

/* ------------------------------------------------------------------ data source */

export interface ListSource<T> {
  key: unknown[]
  pageSize: number
  /** 'search' = quick filter via the full-text index (relevance order) */
  mode: 'search' | 'rules'
  filtered: boolean
  effectiveSort: string | null
  fetchPage: (page: number) => Promise<{ items: T[]; total: number }>
}

/**
 * Picks the fastest way to answer the current list state:
 * - only a quick-filter text, default sort -> /search/?type= (full-text index, ~20 ms)
 * - otherwise -> /{endpoint}/ with server-side `rules`, `sort` and paging
 */
export function useListSource<T extends ListItem>(config: ListConfig<T>, state: ListState): ListSource<T> {
  const locale = apiLocale()
  const endpoint = endpointOf[config.kind]
  const pageSize = config.pageSize ?? 100
  const filterRules = config.filters
    .map((f) => (state.filters[f.id] ? f.toRule(state.filters[f.id]!) : null))
    .filter((r): r is Rule => !!r)
  const q = state.q.trim()
  const useSearch = !!q && filterRules.length === 0 && !state.sort
  const effectiveSort = useSearch ? null : (state.sort ?? config.defaultSort)

  const text = q ? textFilter(q, config.textRule) : null
  const allRules = [...(text ? [text] : []), ...filterRules]
  const rules = allRules.length ? JSON.stringify(and(...allRules)) : undefined
  const listQuery: Query = { ...config.query, locale, sort: effectiveSort, rules, pagesize: pageSize }

  const fetchRules = async (page: number) => {
    const r = await apiRaw<T[]>(`/${endpoint}/`, { query: { ...listQuery, page } })
    return { items: r.data, total: r.total ?? r.data.length }
  }
  const fetchSearch = async (page: number) => {
    try {
      const r = await apiRaw<SearchHit[]>('/search/', {
        query: {
          query: searchQuery(q),
          type: config.kind,
          locale,
          profile: config.searchProfile ?? 'self',
          page,
          pagesize: pageSize,
        },
      })
      return { items: r.data.map((h) => h.object as unknown as T), total: r.total ?? r.data.length }
    } catch (e) {
      // no search index for this tree -> fall back to filter rules
      if (e instanceof ApiError && e.status >= 500) return fetchRules(page)
      throw e
    }
  }

  return {
    key: useSearch
      ? ['list', endpoint, 'search', q, config.kind, config.searchProfile ?? 'self', locale, pageSize]
      : ['list', endpoint, 'rules', listQuery],
    pageSize,
    mode: useSearch ? 'search' : 'rules',
    filtered: !!q || filterRules.length > 0,
    effectiveSort,
    fetchPage: useSearch ? fetchSearch : fetchRules,
  }
}

/** First page (also carries the total); keeps previous results while a new filter loads. */
export function useFirstPage<T>(source: ListSource<T>) {
  return useQuery({
    queryKey: [...source.key, 0],
    queryFn: () => source.fetchPage(1),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

/** Further pages by index (0-based); returns a lookup for item i. */
export function usePages<T>(source: ListSource<T>, first: { items: T[] } | undefined, pages: number[]) {
  const results = useQueries({
    queries: pages
      .filter((p) => p > 0)
      .map((p) => ({
        queryKey: [...source.key, p],
        queryFn: () => source.fetchPage(p + 1),
        staleTime: 30_000,
      })),
  })
  const byPage = new Map<number, T[]>()
  if (first) byPage.set(0, first.items)
  pages
    .filter((p) => p > 0)
    .forEach((p, i) => {
      const d = results[i]?.data
      if (d) byPage.set(p, d.items)
    })
  const size = source.pageSize
  return {
    getItem: (i: number): T | undefined => byPage.get(Math.floor(i / size))?.[i % size],
    loading: results.some((r) => r.isFetching),
  }
}

/* ------------------------------------------------------------------ layout helpers */

export function useElementWidth(ref: RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/** Document offset of an element (for the window virtualizer's scrollMargin). */
function useDocumentTop(ref: RefObject<HTMLElement | null>) {
  const [top, setTop] = useState(0)
  // cheap; runs after every render so chips wrapping or a description appearing is picked up
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = ref.current
    if (el) setTop(Math.round(el.getBoundingClientRect().top + window.scrollY))
  })
  return top
}

/** Scroll back to the list top when the result set changes (new filter/sort). */
function useResetScroll(key: unknown, anchor: RefObject<HTMLElement | null>) {
  const k = JSON.stringify(key)
  const prev = useRef(k)
  useEffect(() => {
    if (prev.current === k) return
    prev.current = k
    const el = anchor.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 72
    if (window.scrollY > top) window.scrollTo({ top })
  }, [k, anchor])
}

/**
 * Back/forward into a list returns to the same row: remember the window scroll per history
 * entry and restore it once the (cached) rows are rendered.
 */
function useScrollRestore(ready: boolean) {
  const { key } = useLocation()
  const storageKey = `gw.list-scroll.${key}`
  const y = useRef(0)
  const restored = useRef(false)
  useEffect(() => {
    const onScroll = () => (y.current = window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      try {
        sessionStorage.setItem(storageKey, String(Math.round(y.current)))
      } catch {
        /* storage unavailable */
      }
    }
  }, [storageKey])
  useEffect(() => {
    if (!ready || restored.current) return
    restored.current = true
    let saved: string | null = null
    try {
      saved = sessionStorage.getItem(storageKey)
    } catch {
      /* storage unavailable */
    }
    if (saved && Number(saved) > 0) requestAnimationFrame(() => window.scrollTo({ top: Number(saved) }))
  }, [ready, storageKey])
}

/* ------------------------------------------------------------------ toolbar */

export function QuickFilter({ value, onChange, placeholder }: { value: string; onChange: (q: string) => void; placeholder: string }) {
  const { t } = useTranslation('lists')
  const [text, setText] = useState(value)
  const debounced = useDebounced(text, 250)
  const last = useRef(value)
  // URL -> input (back/forward)
  useEffect(() => {
    if (value !== last.current) {
      last.current = value
      setText(value)
    }
  }, [value])
  // input -> URL
  useEffect(() => {
    if (debounced.trim() !== last.current) {
      last.current = debounced.trim()
      onChange(debounced)
    }
  }, [debounced, onChange])
  return (
    <InputGroup className="h-9 w-full bg-card sm:max-w-sm">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && text) {
            e.preventDefault()
            setText('')
          }
        }}
        className="[&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label={t('common:actions.clear')} onClick={() => setText('')}>
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

export function SortMenu({
  sorts,
  current,
  relevance,
  onChange,
}: {
  sorts: SortOption[]
  current: string | null
  relevance: boolean
  onChange: (s: string | null) => void
}) {
  const { t } = useTranslation('lists')
  const field = current?.replace(/^-/, '') ?? 'relevance'
  const desc = !!current?.startsWith('-')
  const label = relevance && !current ? t('sort.relevance') : (sorts.find((s) => s.key === field)?.label ?? field)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 bg-card" aria-label={t('sort.label')}>
          <ArrowDownUp className="text-muted-foreground" />
          <span className="max-w-32 truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('sort.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={field}
          onValueChange={(v) => onChange(v === 'relevance' ? null : desc ? `-${v}` : v)}
        >
          {relevance && <DropdownMenuRadioItem value="relevance">{t('sort.relevance')}</DropdownMenuRadioItem>}
          {sorts.map((s) => (
            <DropdownMenuRadioItem key={s.key} value={s.key}>
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {current && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={desc ? 'desc' : 'asc'} onValueChange={(v) => onChange(v === 'desc' ? `-${field}` : field)}>
              <DropdownMenuRadioItem value="asc">
                <ArrowUp className="text-muted-foreground" />
                {t('sort.asc')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc">
                <ArrowDown className="text-muted-foreground" />
                {t('sort.desc')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Header "Add" button, respecting AddObject (+ EditObject for families). */
export function AddButton({ kind, path, needsEdit }: { kind: ObjectKind; path?: string; needsEdit?: boolean }) {
  const { t } = useTranslation('lists')
  const { can } = useAuth()
  if (!path || !can('AddObject') || (needsEdit && !can('EditObject'))) return null
  return (
    <Button asChild>
      <Link to={path}>
        <Plus />
        {t(`add.${kind}`)}
      </Link>
    </Button>
  )
}

/** "2,157 people" / "71 of 2,157 people" */
export function useCountLabel(kind: ObjectKind, total: number | undefined, filtered: boolean) {
  const { t, i18n } = useTranslation('lists')
  const { data: meta } = useMetadata()
  const all = meta?.object_counts?.[endpointOf[kind]]
  const fmt = (n: number) => n.toLocaleString(i18n.language)
  if (total == null) return all != null ? t(`count.${kind}`, { count: all, n: fmt(all) }) : null
  if (!filtered || all == null) return t(`count.${kind}`, { count: total, n: fmt(total) })
  return t('countOf', { n: fmt(total), all: t(`count.${kind}`, { count: all, n: fmt(all) }) })
}

/* ------------------------------------------------------------------ page */

export interface ListController<T extends ListItem> {
  state: ListState
  source: ListSource<T>
  first: ReturnType<typeof useFirstPage<T>>
  total: number | undefined
  countLabel: string | null
}

export function useListController<T extends ListItem>(config: ListConfig<T>): ListController<T> {
  const state = useListState(config.filters)
  const source = useListSource(config, state)
  const first = useFirstPage(source)
  const total = first.data?.total
  const countLabel = useCountLabel(config.kind, total, source.filtered)
  return { state, source, first, total, countLabel }
}

export function ListToolbar<T extends ListItem>({
  config,
  ctl,
  extra,
}: {
  config: ListConfig<T>
  ctl: ListController<T>
  extra?: ReactNode
}) {
  const { state, source } = ctl
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-60">
          <QuickFilter value={state.q} onChange={state.setQ} placeholder={config.placeholder} />
        </div>
        <SortMenu
          sorts={config.sorts}
          current={source.effectiveSort}
          relevance={!!state.q}
          onChange={(s) => state.setSort(s)}
        />
        {extra}
      </div>
      <FilterChips filters={config.filters} values={state.filters} onChange={state.setFilter} onClear={state.clearFilters} />
    </div>
  )
}

/** Complete list page: header, quick filter, chips, virtualized rows. */
export function DataListPage<T extends ListItem>({ title, config }: { title: string; config: ListConfig<T> }) {
  useTitle(title)
  const ctl = useListController(config)
  return (
    <Page
      title={title}
      description={<CountDescription label={ctl.countLabel} busy={ctl.first.isFetching} />}
      actions={<AddButton kind={config.kind} path={config.addPath} needsEdit={config.addNeedsEdit} />}
    >
      <ListToolbar config={config} ctl={ctl} />
      <VirtualList config={config} ctl={ctl} />
    </Page>
  )
}

export function CountDescription({ label, busy }: { label: string | null; busy?: boolean }) {
  if (!label) return <span className="inline-block h-4 w-28 animate-pulse rounded-md bg-muted align-middle" aria-hidden />
  return (
    <span className="inline-flex items-center gap-2 tabular-nums" aria-live="polite">
      {label}
      {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
    </span>
  )
}

export function ListEmpty({ kind, filtered, onClear }: { kind: ObjectKind; filtered: boolean; onClear: () => void }) {
  const { t } = useTranslation('lists')
  return (
    <EmptyState icon={filtered ? undefined : kindIcon[kind]} title={filtered ? t('empty.filtered') : t('empty.none')}>
      {filtered ? (
        <>
          <p>{t('empty.filteredHint')}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={onClear}>
            {t('filters.clearAll')}
          </Button>
        </>
      ) : (
        <p>{t('empty.noneHint')}</p>
      )}
    </EmptyState>
  )
}

/* ------------------------------------------------------------------ virtualized rows */

const COMPACT_BELOW = 640

export function VirtualList<T extends ListItem>({ config, ctl }: { config: ListConfig<T>; ctl: ListController<T> }) {
  const { t } = useTranslation('lists')
  const { first, source, state } = ctl
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const width = useElementWidth(wrapRef)
  const compact = width > 0 && width < COMPACT_BELOW
  const columns = config.columns.filter((c) => !c.minWidth || width >= c.minWidth)
  const grid = columns.map((c) => c.width).join(' ')
  const total = first.data?.total ?? 0
  const scrollMargin = useDocumentTop(listRef)
  const sortField = source.effectiveSort?.replace(/^-/, '') ?? ''
  const grouping = !!config.group && config.group.sorts.includes(sortField)

  useResetScroll(source.key, wrapRef)
  useScrollRestore(!!first.data && width > 0)

  const virtualizer = useWindowVirtualizer({
    count: total,
    estimateSize: () => (compact ? config.compactRowHeight : config.rowHeight),
    overscan: 12,
    scrollMargin,
  })
  const items = virtualizer.getVirtualItems()
  const pageIdx = useMemo(() => {
    const s = new Set<number>()
    for (const it of items) s.add(Math.floor(it.index / source.pageSize))
    return [...s].sort((a, b) => a - b)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length ? items[0].index : -1, items.length ? items[items.length - 1].index : -1, source.pageSize])
  // while a new filter loads we still show the old first page; don't fetch deeper pages yet
  const { getItem } = usePages(source, first.data, first.isPlaceholderData ? [] : pageIdx)

  // re-measure when the layout mode changes
  useEffect(() => {
    virtualizer.measure()
  }, [compact, grouping, virtualizer])

  const groupKey = (i: number) => {
    const it = getItem(i)
    return it && config.group ? config.group.key(it) : undefined
  }

  if (first.isError && !first.data) return <ErrorState error={first.error} onRetry={() => first.refetch()} />

  return (
    <div ref={wrapRef} className="min-w-0">
      {!compact && width > 0 && (
        <div
          className="sticky top-14 z-10 grid items-center gap-x-4 border-b bg-background/95 px-3 py-2 text-xs text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80"
          style={{ gridTemplateColumns: grid }}
        >
          {columns.map((c) => (
            <HeaderCell key={c.id} column={c} current={source.effectiveSort} onSort={state.setSort} />
          ))}
        </div>
      )}
      {!first.data ? (
        <div className="pt-2">
          <RowsSkeleton rows={10} />
        </div>
      ) : total === 0 ? (
        <ListEmpty
          kind={config.kind}
          filtered={source.filtered}
          onClear={() => {
            state.clearFilters()
            state.setQ('')
          }}
        />
      ) : (
        <ul
          ref={listRef}
          role="list"
          aria-label={t('listLabel')}
          aria-busy={first.isPlaceholderData}
          className={cn('relative transition-opacity', first.isPlaceholderData && 'opacity-60')}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {items.map((v) => {
            const item = getItem(v.index)
            const showGroup = grouping && item && (v.index === 0 || groupKey(v.index - 1) !== config.group!.key(item))
            return (
              <li
                key={v.key}
                data-index={v.index}
                ref={virtualizer.measureElement}
                className="absolute inset-x-0 top-0 border-b border-border/50"
                style={{ transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)` }}
              >
                {showGroup && (
                  <div className="px-3 pt-5 pb-1.5 font-serif text-lg font-medium text-foreground" aria-hidden={false}>
                    {config.group!.label(item)}
                  </div>
                )}
                {item ? (
                  <Link
                    to={objectPath(config.kind, item.gramps_id)}
                    className={cn(
                      'rounded-md px-3 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50',
                      compact ? 'flex items-center gap-3 py-2.5' : 'grid items-center gap-x-4 py-2',
                    )}
                    style={compact ? { minHeight: config.compactRowHeight } : { gridTemplateColumns: grid, minHeight: config.rowHeight }}
                  >
                    {compact
                      ? config.compact(item)
                      : columns.map((c) => (
                          <div key={c.id} className={cn('min-w-0', c.align === 'end' && 'text-right')}>
                            {c.cell(item)}
                          </div>
                        ))}
                  </Link>
                ) : (
                  <div className="flex items-center px-3" style={{ height: compact ? config.compactRowHeight : config.rowHeight }}>
                    <Skeleton className="h-5 w-full" style={{ opacity: 0.6 }} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function HeaderCell<T>({ column, current, onSort }: { column: Column<T>; current: string | null; onSort: (s: string | null) => void }) {
  const { t } = useTranslation('lists')
  if (!column.sort) return <div className={cn('min-w-0 truncate', column.align === 'end' && 'text-right')}>{column.header}</div>
  const active = current?.replace(/^-/, '') === column.sort
  const desc = !!current?.startsWith('-')
  const Icon = active ? (desc ? ArrowDown : ArrowUp) : null
  return (
    <div className={cn('min-w-0', column.align === 'end' && 'text-right')}>
      <button
        type="button"
        className={cn(
          '-mx-1 inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
          active && 'text-foreground',
        )}
        onClick={() => onSort(active && !desc ? `-${column.sort}` : column.sort!)}
        aria-label={t('sort.by', { what: typeof column.header === 'string' ? column.header : column.sort })}
      >
        <span className="truncate">{column.header}</span>
        {Icon && <Icon className="size-3 shrink-0" />}
      </button>
    </div>
  )
}
