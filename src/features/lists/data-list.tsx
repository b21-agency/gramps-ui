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
import { ArrowDown, ArrowDownUp, ArrowUp, Check, Columns3, FlaskConical, Loader2, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Page } from '@/components/app-shell'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { searchQuery, useDebounced } from '@/components/command-search'
import { ApiError, apiRaw, type Query } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { useMetadata } from '@/lib/queries'
import { usePref } from '@/lib/prefs'
import { Checkbox } from '@/components/ui/checkbox'
import { kindIcon, objectPath } from '@/lib/objects'
import { endpointOf, type ObjectKind, type SearchHit } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import { ActiveFilterPills, FilterChips, FilterSheetSections, activeFilterCount, type FilterDef } from './filters'
import { and, setRuleDateLang, textFilter, type Rule } from './rules'
import { SelectionBar, SelectToggle, useCanSelect, useSelection, type Selection } from './selection'
import { AdvancedChip, AdvancedFilterDialog, advancedRule, parseAdvanced } from './advanced-filter'

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
  /** hidden until switched on in the column menu */
  defaultHidden?: boolean
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
  /** offer "merge two" in selection mode (default true) */
  merge?: boolean
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
  /** several params in one history entry (separate setters would overwrite each other) */
  setMany: (values: Record<string, string | null>) => void
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
    setMany: useCallback(
      (vals: Record<string, string | null>) => update((p) => Object.entries(vals).forEach(([k, v]) => set(p, k, v))),
      [update],
    ),
    clearFilters: useCallback(
      () =>
        update((p) => {
          ids.split(',').forEach((id) => p.delete(id))
          p.delete('adv')
          p.delete('gql')
        }),
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
  const adv = advancedRule(parseAdvanced(state.params.get('adv')))
  if (adv) filterRules.push(adv)
  const gql = state.params.get('gql')?.trim() || undefined
  const q = state.q.trim()
  const useSearch = !!q && filterRules.length === 0 && !gql && !state.sort
  const effectiveSort = useSearch ? null : (state.sort ?? config.defaultSort)

  const text = q ? textFilter(q, config.textRule) : null
  const allRules = [...(text ? [text] : []), ...filterRules]
  const rules = allRules.length ? JSON.stringify(and(...allRules)) : undefined
  const listQuery: Query = { ...config.query, locale, sort: effectiveSort, rules, gql, pagesize: pageSize }

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
    filtered: !!q || filterRules.length > 0 || !!gql,
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
  selection: Selection<T>
  /** user's column choice: id -> visible */
  columnPrefs: Record<string, boolean>
  setColumnPrefs: (v: Record<string, boolean>) => void
}

export function useListController<T extends ListItem>(config: ListConfig<T>): ListController<T> {
  const { data: meta } = useMetadata()
  // year filters must be written in the tree's date language
  setRuleDateLang(meta?.locale?.language)
  const state = useListState(config.filters)
  const source = useListSource(config, state)
  const first = useFirstPage(source)
  const total = first.data?.total
  const countLabel = useCountLabel(config.kind, total, source.filtered)
  const selection = useSelection<T>(source.key)
  const [columnPrefs, setColumnPrefs] = usePref<Record<string, boolean>>(`listColumns.${config.kind}`, {})
  return { state, source, first, total, countLabel, selection, columnPrefs, setColumnPrefs }
}

/** Columns the user wants (column menu), before the width-based responsive hiding. */
function chosenColumns<T>(columns: Column<T>[], prefs: Record<string, boolean>) {
  return columns.filter((c, i) => i === 0 || (prefs[c.id] ?? !c.defaultHidden))
}

function ColumnsMenu<T extends ListItem>({ config, ctl }: { config: ListConfig<T>; ctl: ListController<T> }) {
  const { t } = useTranslation('lists')
  const { columnPrefs, setColumnPrefs } = ctl
  const named = config.columns.slice(1).filter((c) => typeof c.header === 'string')
  if (!named.length) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="size-9 bg-card" aria-label={t('columns.label')} title={t('columns.label')}>
          <Columns3 />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('columns.label')}</DropdownMenuLabel>
        {named.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.id}
            checked={columnPrefs[c.id] ?? !c.defaultHidden}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => setColumnPrefs({ ...columnPrefs, [c.id]: !!on })}
          >
            {c.header}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!Object.keys(columnPrefs).length} onSelect={() => setColumnPrefs({})}>
          {t('columns.reset')}
        </DropdownMenuItem>
        <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('columns.hint')}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** "Advanced filter" button + dialog + active chip, sharing one open state. */
function useAdvanced<T extends ListItem>(config: ListConfig<T>, ctl: ListController<T>) {
  const { t } = useTranslation('lists')
  const [open, setOpen] = useState(false)
  const { state } = ctl
  const adv = parseAdvanced(state.params.get('adv'))
  const gql = state.params.get('gql') ?? ''
  const active = !!adv || !!gql
  const dialog = (
    <AdvancedFilterDialog
      kind={config.kind}
      open={open}
      onOpenChange={setOpen}
      value={adv}
      gql={gql}
      onApply={(a, g) => state.setMany({ adv: a ? JSON.stringify(a) : null, gql: g || null })}
    />
  )
  const chip = active ? (
    <AdvancedChip
      count={adv?.conds.length ?? 0}
      gql={!!gql}
      onEdit={() => setOpen(true)}
      onClear={() => state.setMany({ adv: null, gql: null })}
    />
  ) : null
  const button = (
    <Button
      variant="outline"
      size="icon"
      className={cn('size-9 bg-card', active && 'border-primary/40 text-primary')}
      aria-label={t('adv.title')}
      title={t('adv.title')}
      onClick={() => setOpen(true)}
    >
      <FlaskConical />
    </Button>
  )
  return { open: () => setOpen(true), dialog, chip, button, active }
}

export function ListToolbar<T extends ListItem>({
  config,
  ctl,
  extra,
  noSelect,
}: {
  config: ListConfig<T>
  ctl: ListController<T>
  extra?: ReactNode
  /** hide the "Select" button (e.g. media grid view) */
  noSelect?: boolean
}) {
  const { state, source } = ctl
  const isMobile = useIsMobile()
  const advanced = useAdvanced(config, ctl)
  if (isMobile) return <MobileListToolbar config={config} ctl={ctl} extra={extra} noSelect={noSelect} advanced={advanced} />
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
        {advanced.button}
        {!noSelect && <ColumnsMenu config={config} ctl={ctl} />}
        {!noSelect && <SelectToggle selection={ctl.selection as unknown as Selection<ListItem>} className="h-9" />}
      </div>
      {(config.filters.length > 0 || advanced.chip) && (
        <div className="flex flex-wrap items-center gap-2">
          {advanced.chip}
          <FilterChips filters={config.filters} values={state.filters} onChange={state.setFilter} onClear={state.clearFilters} />
        </div>
      )}
      {advanced.dialog}
    </div>
  )
}

/** Phones: search field + one "Filters" button (sort and every filter in a bottom drawer). */
function MobileListToolbar<T extends ListItem>({
  config,
  ctl,
  extra,
  noSelect,
  advanced,
}: {
  config: ListConfig<T>
  ctl: ListController<T>
  extra?: ReactNode
  noSelect?: boolean
  advanced: ReturnType<typeof useAdvanced>
}) {
  const { t } = useTranslation('lists')
  const { state, source, countLabel } = ctl
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(config.filters, state.filters) + (advanced.active ? 1 : 0)
  const current = source.effectiveSort
  const field = current?.replace(/^-/, '') ?? 'relevance'
  const desc = !!current?.startsWith('-')
  const relevance = !!state.q
  const sortOptions = [...(relevance ? [{ key: 'relevance', label: t('sort.relevance') }] : []), ...config.sorts]
  const pill = (on: boolean) =>
    cn(
      'inline-flex min-h-10 items-center rounded-full border px-3.5 text-[15px] transition-transform active:scale-[0.97] motion-reduce:active:scale-100',
      on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
    )
  return (
    <div className="mb-3 space-y-2.5">
      <div className="flex items-center gap-2 [&_[data-slot=input-group]]:h-11">
        <div className="min-w-0 flex-1">
          <QuickFilter value={state.q} onChange={state.setQ} placeholder={config.placeholder} />
        </div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              className={cn('relative size-11 shrink-0 bg-card', count > 0 && 'border-primary/40 text-primary')}
              aria-label={count ? `${t('filters.title')} (${count})` : t('filters.title')}
            >
              <SlidersHorizontal className="size-5" />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
                  {count}
                </span>
              )}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[90dvh]">
            <DrawerHeader className="flex-row items-center justify-between pb-1 text-left">
              <DrawerTitle className="font-serif text-2xl font-medium">{t('filters.title')}</DrawerTitle>
              <DrawerDescription className="sr-only">{config.placeholder}</DrawerDescription>
              {count > 0 && (
                <Button variant="ghost" className="-mr-2 h-10 text-muted-foreground" onClick={state.clearFilters}>
                  {t('filters.clear')}
                </Button>
              )}
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
              <section className="py-4">
                <h3 className="mb-3 flex items-center gap-2 font-sans text-sm font-medium text-muted-foreground">
                  <ArrowDownUp className="size-4" />
                  {t('sort.label')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      aria-pressed={field === o.key}
                      className={pill(field === o.key)}
                      onClick={() => state.setSort(o.key === 'relevance' ? null : desc ? `-${o.key}` : o.key)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {current && (
                  <div className="mt-3 grid grid-cols-2 rounded-xl border bg-muted p-1" role="radiogroup" aria-label={t('sort.label')}>
                    {(['asc', 'desc'] as const).map((dir) => {
                      const on = (dir === 'desc') === desc
                      const Icon = dir === 'desc' ? ArrowDown : ArrowUp
                      return (
                        <button
                          key={dir}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          className={cn(
                            'flex h-10 items-center justify-center gap-2 rounded-lg text-[15px] transition-colors',
                            on ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground',
                          )}
                          onClick={() => state.setSort(dir === 'desc' ? `-${field}` : field)}
                        >
                          <Icon className="size-4" />
                          {t(`sort.${dir}`)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
              {config.filters.length > 0 && (
                <div className="border-t">
                  <FilterSheetSections filters={config.filters} values={state.filters} onChange={state.setFilter} />
                </div>
              )}
              <div className="border-t py-4">
                <Button
                  variant="outline"
                  className={cn('h-11 w-full justify-start bg-card text-base', advanced.active && 'border-primary/40 text-primary')}
                  onClick={() => {
                    setOpen(false)
                    advanced.open()
                  }}
                >
                  <FlaskConical />
                  {t('adv.title')}
                </Button>
              </div>
            </div>
            <div className="border-t bg-popover px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              <Button className="h-12 w-full text-base" onClick={() => setOpen(false)}>
                {ctl.first.isFetching ? <Loader2 className="animate-spin" /> : null}
                {countLabel ? t('filters.show', { label: countLabel }) : t('filters.done')}
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
        {extra}
        {!noSelect && <SelectToggle selection={ctl.selection as unknown as Selection<ListItem>} className="size-11 shrink-0" />}
      </div>
      {advanced.chip && <div className="flex">{advanced.chip}</div>}
      <ActiveFilterPills filters={config.filters} values={state.filters} onChange={state.setFilter} />
      {advanced.dialog}
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
  const { first, source, state, selection } = ctl
  const canSelect = useCanSelect()
  const selecting = selection.active && canSelect
  const wrapRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const width = useElementWidth(wrapRef)
  const compact = width > 0 && width < COMPACT_BELOW
  const columns = chosenColumns(config.columns, ctl.columnPrefs).filter((c) => !c.minWidth || width >= c.minWidth)
  const grid = (selecting ? '1.25rem ' : '') + columns.map((c) => c.width).join(' ')
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
  // "select all" covers the rows loaded so far
  const loadedItems = () => {
    const out: T[] = []
    for (let i = 0; i < total; i++) {
      const it = getItem(i)
      if (it) out.push(it)
      else if (i % source.pageSize === 0) i += source.pageSize - 1
    }
    return out
  }

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
          className="sticky top-[var(--header-h)] z-10 grid items-center gap-x-4 border-b bg-background/95 px-3 py-2 text-xs text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80"
          style={{ gridTemplateColumns: grid }}
        >
          {selecting && (
            <Checkbox
              aria-label={t('select.all')}
              checked={selection.items.size > 0 && loadedItems().every((it) => selection.has(it.handle))}
              onCheckedChange={(on) => selection.setMany(loadedItems(), !!on)}
            />
          )}
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
          onClear={() => state.setMany({ q: null, adv: null, gql: null, ...Object.fromEntries(config.filters.map((f) => [f.id, null])) })}
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
                {item && selecting ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selection.has(item.handle)}
                    onClick={() => selection.toggle(item)}
                    className={cn(
                      'w-full rounded-md px-3 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50',
                      selection.has(item.handle) && 'bg-primary/8 hover:bg-primary/12',
                      compact ? 'flex items-center gap-3 py-2.5' : 'grid items-center gap-x-4 py-2',
                    )}
                    style={compact ? { minHeight: config.compactRowHeight } : { gridTemplateColumns: grid, minHeight: config.rowHeight }}
                  >
                    <CheckMark on={selection.has(item.handle)} />
                    {compact
                      ? config.compact(item)
                      : columns.map((c) => (
                          <div key={c.id} className={cn('min-w-0', c.align === 'end' && 'text-right')}>
                            {c.cell(item)}
                          </div>
                        ))}
                  </button>
                ) : item ? (
                  <Link
                    to={objectPath(config.kind, item.gramps_id)}
                    className={cn(
                      'rounded-md px-3 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 active:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50',
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
      {selecting && <SelectionBar kind={config.kind} selection={selection} merge={config.merge !== false} />}
    </div>
  )
}

/** Visual checkbox inside a row button (a real checkbox would nest buttons). */
function CheckMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input',
        on && 'border-primary bg-primary text-primary-foreground',
      )}
    >
      {on && <Check className="size-3.5" />}
    </span>
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
