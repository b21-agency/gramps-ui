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
import { shallowEqual } from 'react-redux'
import { useWindowVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
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
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState, ErrorState } from '@/components/states'
import { searchQuery, useDebounced } from '@/components/command-search'
import { listsApi, useListPageQuery, type ListPageArg } from '@/api/enhanced/lists'
import type { ObjectListArg, Page as RowsPage } from '@/api/enhanced/objects'
import type { GetSearchApiArg } from '@/api/enhanced/search-slice-enhanced'
import { useAppDispatch, useAppSelector } from '@/store'
import { apiLocale } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { useMetadata } from '@/lib/queries'
import { usePref } from '@/lib/prefs'
import { Checkbox } from '@/components/ui/checkbox'
import { kindIcon, objectPath } from '@/lib/objects'
import { endpointOf, type ObjectKind } from '@/lib/types'
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
  /** base params of the kind's list endpoint (keys, profile, extend ...) */
  query: ObjectListArg
  /** profile for /search/ when the quick filter uses the full-text index */
  searchProfile?: string[]
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
  /** identifies the result set (args of every page without `page`) */
  key: unknown[]
  arg: Omit<ListPageArg, 'page'>
  pageSize: number
  /** 'search' = quick filter via the full-text index (relevance order) */
  mode: 'search' | 'rules'
  filtered: boolean
  effectiveSort: string | null
  /** phantom: the row type */
  _row?: T
}

/**
 * Picks the fastest way to answer the current list state:
 * - only a quick-filter text, default sort -> /search/?type= (full-text index, ~20 ms)
 * - otherwise -> /{endpoint}/ with server-side `rules`, `sort` and paging
 */
export function useListSource<T extends ListItem>(config: ListConfig<T>, state: ListState): ListSource<T> {
  const locale = apiLocale()
  const pageSize = config.pageSize ?? 100
  const filterRules = config.filters
    .map((f) => (state.filters[f.id] ? f.toRule(state.filters[f.id]!) : null))
    .filter((r): r is Rule => !!r)
  const adv = advancedRule(parseAdvanced(state.params.get('adv')))
  if (adv) filterRules.push(adv)
  const gql = state.params.get('gql')?.trim() || undefined
  const q = state.q.trim()
  const useSearch = !!searchQuery(q) && filterRules.length === 0 && !gql && !state.sort
  const effectiveSort = useSearch ? null : (state.sort ?? config.defaultSort)

  const text = q ? textFilter(q, config.textRule) : null
  const allRules = [...(text ? [text] : []), ...filterRules]
  const rules = allRules.length ? JSON.stringify(and(...allRules)) : undefined
  const list: ObjectListArg = {
    ...config.query,
    locale,
    sort: effectiveSort ? [effectiveSort] : undefined,
    rules,
    gql: gql || undefined,
    pagesize: pageSize,
  }
  const search: GetSearchApiArg | null = useSearch
    ? { query: searchQuery(q), type: [config.kind], locale, profile: config.searchProfile ?? ['self'], pagesize: pageSize }
    : null
  const arg: Omit<ListPageArg, 'page'> = { kind: config.kind, list, search }
  return {
    key: [arg],
    arg,
    pageSize,
    mode: useSearch ? 'search' : 'rules',
    filtered: !!q || filterRules.length > 0 || !!gql,
    effectiveSort,
  }
}

/** First page (also carries the total); keeps previous results while a new filter loads. */
export function useFirstPage<T>(source: ListSource<T>) {
  const r = useListPageQuery({ ...source.arg, page: 1 })
  // RTK keeps `data` from the previous args while new ones load; `currentData` is only for these args
  const isPlaceholderData = r.isFetching && r.currentData === undefined && r.data !== undefined
  return {
    ...r,
    data: (r.isError ? r.currentData : r.data) as RowsPage<T> | undefined,
    isPlaceholderData,
  }
}

/**
 * Further pages by index (0-based), fetched only while on screen: each visible page holds a
 * subscription to its own `listPage` cache entry (so it refreshes after writes and is dropped
 * after a while off screen). Returns a lookup for item i.
 */
export function usePages<T>(source: ListSource<T>, first: { items: T[] } | undefined, pages: number[]) {
  const dispatch = useAppDispatch()
  const wanted = pages.filter((p) => p > 0)
  const wantedKey = wanted.join(',')
  const argKey = JSON.stringify(source.arg)
  useEffect(() => {
    const subs = wanted.map((p) => dispatch(listsApi.endpoints.listPage.initiate({ ...source.arg, page: p + 1 })))
    return () => subs.forEach((s) => s.unsubscribe())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, argKey, wantedKey])
  // flat [items, fetching, items, fetching, …] so shallowEqual keeps renders to real changes
  const flat = useAppSelector(
    (state) =>
      wanted.flatMap((p) => {
        const e = listsApi.endpoints.listPage.select({ ...source.arg, page: p + 1 })(state)
        return [e.data?.items, e.status === 'pending']
      }),
    shallowEqual,
  )
  const byPage = new Map<number, T[]>()
  if (first) byPage.set(0, first.items)
  wanted.forEach((p, i) => {
    const items = flat[i * 2] as T[] | undefined
    if (items) byPage.set(p, items)
  })
  const size = source.pageSize
  return {
    getItem: (i: number): T | undefined => byPage.get(Math.floor(i / size))?.[i % size],
    loading: wanted.some((_, i) => !!flat[i * 2 + 1]),
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

/** Measured row heights per history entry, so back/forward rebuilds the same layout. */
const rowSizes = new Map<string, Map<VirtualItem['key'], number>>()

/**
 * Restoring the scroll offset only lands on the same row when the rows above it have the same
 * heights as before (group headings make measured rows taller than the estimate): keep the
 * measured heights of the list per history entry and seed the virtualizer with them.
 */
function useRowSizeCache(id: string) {
  const { key } = useLocation()
  const cacheKey = `${key}:${id}`
  const initial = useMemo(
    () => [...(rowSizes.get(cacheKey) ?? [])].map(([k, size]) => ({ key: k, index: Number(k), size, start: 0, end: 0, lane: 0 })),
    [cacheKey],
  )
  const save = useCallback(
    (sizes: Map<VirtualItem['key'], number>) => {
      rowSizes.delete(cacheKey)
      rowSizes.set(cacheKey, new Map(sizes))
      // only the last few entries are worth keeping
      while (rowSizes.size > 20) rowSizes.delete(rowSizes.keys().next().value!)
    },
    [cacheKey],
  )
  return { initial, save }
}

/* ------------------------------------------------------------------ toolbar */

/** Select toggle while selecting: gold like the active chips. */
const selectOn =
  'data-[variant=default]:bg-primary data-[variant=default]:text-primary-foreground data-[variant=default]:hover:bg-primary/85 dark:data-[variant=default]:bg-primary dark:data-[variant=default]:hover:bg-primary/85'

/** Quiet round tool button on the page canvas (sort, columns, advanced filter, select). */
export const toolBtn =
  'h-10 rounded-full border-transparent bg-card text-foreground dark:border-transparent dark:bg-card transition-[background-color,transform] duration-150 ease-out hover:bg-accent active:scale-[0.97] aria-expanded:bg-accent dark:hover:bg-accent motion-reduce:active:scale-100'

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
    <InputGroup className="h-12 w-full rounded-2xl border-transparent bg-card shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-brass/60 sm:h-14 dark:bg-card">
      <InputGroupAddon className="pl-4">
        <Search className="size-5! text-brass" />
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
        className="font-serif text-lg placeholder:text-muted-foreground/80 md:text-lg [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <InputGroupAddon align="inline-end" className="pr-2">
          <InputGroupButton size="icon-sm" className="size-10 rounded-full" aria-label={t('common:actions.clear')} onClick={() => setText('')}>
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
        <Button variant="ghost" className={cn(toolBtn, 'px-4')} aria-label={t('sort.label')}>
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
    <Button asChild className="h-11 gap-2 rounded-full px-5 text-[15px] transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] max-lg:size-12 max-lg:px-0">
      <Link to={path} title={t(`add.${kind}`)}>
        <Plus className="size-5" />
        {/* icon only until the title has room next to it (long German labels) */}
        <span className="max-lg:sr-only">{t(`add.${kind}`)}</span>
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
  // while a new filter loads, `data` is still the previous result: don't label its total as the new count
  const total = first.isPlaceholderData ? undefined : first.data?.total
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
        <Button variant="ghost" size="icon" className={cn(toolBtn, 'size-10')} aria-label={t('columns.label')} title={t('columns.label')}>
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
      variant="ghost"
      size="icon"
      className={cn(toolBtn, 'size-10', active && 'text-primary ring-1 ring-primary/40')}
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
    <div className="mb-6 space-y-4 sm:mb-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
          <QuickFilter value={state.q} onChange={state.setQ} placeholder={config.placeholder} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <SortMenu
            sorts={config.sorts}
            current={source.effectiveSort}
            relevance={!!state.q}
            onChange={(s) => state.setSort(s)}
          />
          {extra}
          {advanced.button}
          {!noSelect && <ColumnsMenu config={config} ctl={ctl} />}
          {!noSelect && (
            <SelectToggle selection={ctl.selection as unknown as Selection<ListItem>} className={cn(toolBtn, 'px-4', selectOn)} />
          )}
        </div>
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
    <div className="mb-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <QuickFilter value={state.q} onChange={state.setQ} placeholder={config.placeholder} />
        </div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="ghost"
              className={cn(toolBtn, 'relative size-12 shrink-0', count > 0 && 'text-primary ring-1 ring-primary/40')}
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
        {!noSelect && (
          <SelectToggle
            selection={ctl.selection as unknown as Selection<ListItem>}
            className={cn(toolBtn, 'size-12 shrink-0', selectOn)}
          />
        )}
      </div>
      {advanced.chip && <div className="flex">{advanced.chip}</div>}
      <ActiveFilterPills filters={config.filters} values={state.filters} onChange={state.setFilter} />
      {advanced.dialog}
    </div>
  )
}

/**
 * Album page frame for object lists: big serif title with the count as a quiet meta line
 * (like search), the add action on the right.
 */
export function ListFrame({ title, count, actions, children }: { title: ReactNode; count?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
      <header className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
        <div className="min-w-0">
          <h1 className="truncate pb-1 font-serif text-[2.6rem] font-medium leading-[1.05] tracking-[-0.02em] sm:text-6xl">{title}</h1>
          <p className="mt-2 min-h-7 text-lg text-muted-foreground">{count}</p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 pb-2">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

/** Complete list page: header, quick filter, chips, virtualized rows. */
export function DataListPage<T extends ListItem>({ title, config }: { title: string; config: ListConfig<T> }) {
  useTitle(title)
  const ctl = useListController(config)
  return (
    <ListFrame
      title={title}
      count={<CountDescription label={ctl.countLabel} busy={ctl.first.isFetching} />}
      actions={<AddButton kind={config.kind} path={config.addPath} needsEdit={config.addNeedsEdit} />}
    >
      <ListToolbar config={config} ctl={ctl} />
      <VirtualList config={config} ctl={ctl} />
    </ListFrame>
  )
}

export function CountDescription({ label, busy }: { label: string | null; busy?: boolean }) {
  if (!label) return <span className="inline-block h-5 w-36 animate-pulse rounded-md bg-muted align-middle" aria-hidden />
  return (
    <span className="inline-flex items-center gap-2 tabular-nums" aria-live="polite">
      {label}
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
    </span>
  )
}

export function ListEmpty({ kind, filtered, onClear }: { kind: ObjectKind; filtered: boolean; onClear: () => void }) {
  const { t } = useTranslation('lists')
  return (
    <EmptyState icon={filtered ? undefined : kindIcon[kind]} title={filtered ? t('empty.filtered') : t('empty.none')} className="py-16">
      {filtered ? (
        <>
          <p>{t('empty.filteredHint')}</p>
          <Button className="mt-4 h-11 rounded-full px-5 sm:h-10" onClick={onClear}>
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
  const sizes = useRowSizeCache(`${JSON.stringify(source.key)}:${compact}`)

  const virtualizer = useWindowVirtualizer({
    count: total,
    estimateSize: () => (compact ? config.compactRowHeight : config.rowHeight),
    overscan: 12,
    scrollMargin,
    initialMeasurementsCache: sizes.initial,
  })
  const saveSizes = sizes.save
  useEffect(() => () => saveSizes(virtualizer.itemSizeCache), [saveSizes, virtualizer])
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

  // re-measure when the layout mode changes (not on mount: that would drop the restored heights)
  const layoutMode = `${compact}:${grouping}`
  const measuredMode = useRef(layoutMode)
  useEffect(() => {
    if (measuredMode.current === layoutMode) return
    measuredMode.current = layoutMode
    virtualizer.measure()
  }, [layoutMode, virtualizer])

  const groupKey = (i: number) => {
    const it = getItem(i)
    return it && config.group ? config.group.key(it) : undefined
  }

  if (first.isError && !first.data) {
    // a rejected advanced filter (bad GQL, rule values) is fixed by changing it, not by retrying
    const status = (first.error as { status?: unknown } | undefined)?.status
    const advanced = !!state.params.get('adv') || !!state.params.get('gql')
    if (advanced && (status === 400 || status === 422))
      return (
        <EmptyState icon={FlaskConical} title={t('adv.invalid')} className="rounded-3xl bg-card py-16">
          <p className="font-mono text-sm">{errorText(first.error)}</p>
          <Button className="mt-4 h-11 rounded-full px-5 sm:h-10" onClick={() => state.setMany({ adv: null, gql: null })}>
            {t('adv.clear')}
          </Button>
        </EmptyState>
      )
    return <ErrorState error={first.error} onRetry={() => first.refetch()} className="rounded-3xl bg-card" />
  }

  const rowClass = (on = false) =>
    cn(
      'group/row rounded-2xl px-3 outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-accent',
      on && 'bg-primary/10 hover:bg-primary/15',
      compact ? 'flex w-full items-center gap-3 py-2 text-left' : 'grid w-full items-center gap-x-5 py-2 text-left',
    )
  const rowStyle = compact ? { minHeight: config.compactRowHeight } : { gridTemplateColumns: grid, minHeight: config.rowHeight }
  const cells = (item: T) =>
    compact
      ? config.compact(item)
      : columns.map((c) => (
          <div key={c.id} className={cn('min-w-0', c.align === 'end' && 'text-right')}>
            {c.cell(item)}
          </div>
        ))

  return (
    <div ref={wrapRef} className="min-w-0 overflow-clip rounded-3xl bg-card">
      {!compact && width > 0 && total > 0 && (
        <div
          className="sticky top-[var(--header-h)] z-10 grid items-center gap-x-5 border-b border-border/60 bg-card/95 px-6 pt-4 pb-3 text-xs text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/85"
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
        <RowsLoading compact={compact} />
      ) : total === 0 ? (
        <ListEmpty
          kind={config.kind}
          filtered={source.filtered}
          onClear={() => state.setMany({ q: null, adv: null, gql: null, ...Object.fromEntries(config.filters.map((f) => [f.id, null])) })}
        />
      ) : (
        <div className="p-1.5 sm:p-3">
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
                  className="absolute inset-x-0 top-0"
                  style={{ transform: `translateY(${v.start - virtualizer.options.scrollMargin}px)` }}
                >
                  {showGroup && (
                    <div className={cn('px-3 pb-2 font-serif text-xl font-medium text-brass sm:text-2xl', v.index === 0 ? 'pt-2' : 'pt-7')}>
                      {config.group!.label(item)}
                    </div>
                  )}
                  {item && selecting ? (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selection.has(item.handle)}
                      onClick={() => selection.toggle(item)}
                      className={rowClass(selection.has(item.handle))}
                      style={rowStyle}
                    >
                      <CheckMark on={selection.has(item.handle)} />
                      {cells(item)}
                    </button>
                  ) : item ? (
                    <Link to={objectPath(config.kind, item.gramps_id)} className={rowClass()} style={rowStyle}>
                      {cells(item)}
                    </Link>
                  ) : (
                    <RowPlaceholder height={compact ? config.compactRowHeight : config.rowHeight} />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {selecting && <SelectionBar kind={config.kind} selection={selection} merge={config.merge !== false} />}
    </div>
  )
}

/** Server message of an RTK Query error ({ data: { error: { message } } }). */
function errorText(error: unknown) {
  const data = (error as { data?: { error?: { message?: string }; message?: string } } | undefined)?.data
  return data?.error?.message ?? data?.message ?? ''
}

/** A row that is scrolled into view before its page has loaded. */
function RowPlaceholder({ height }: { height: number }) {
  return (
    <div className="flex items-center gap-4 px-3" style={{ height }} aria-hidden>
      <Skeleton className="size-11 shrink-0 rounded-full opacity-60" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/5 opacity-60" />
        <Skeleton className="h-3 w-1/5 opacity-40" />
      </div>
    </div>
  )
}

function RowsLoading({ compact }: { compact: boolean }) {
  return (
    <div className="space-y-1 p-3 sm:p-4" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-1 py-2.5" style={{ opacity: 1 - i / 11 }}>
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          {!compact && <Skeleton className="hidden h-4 w-1/5 md:block" />}
        </div>
      ))}
    </div>
  )
}

/** Visual checkbox inside a row button (a real checkbox would nest buttons). */
function CheckMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md border border-input transition-colors duration-150',
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
