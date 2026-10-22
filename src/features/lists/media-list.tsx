import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CalendarRange, FileText, Film, FileImage, LayoutGrid, List, Music, Tag } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { mediaThumbUrl } from '@/lib/api'
import { useAccessToken } from '@/lib/auth'
import { objectPath } from '@/lib/objects'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import { yearOf } from '@/lib/format'
import {
  AddButton,
  CountDescription,
  ListFrame,
  ListEmpty,
  ListToolbar,
  usePages,
  useListController,
  VirtualList,
  type ListConfig,
  type ListController,
} from './data-list'
import { useTagFilter, type FilterDef } from './filters'
import { useExtraFacets } from './facets'
import { rule, yearRangeDate } from './rules'
import { ChangedCell, Dash, IdCell, RowLead } from './cells'

export interface MediaRow {
  handle: string
  gramps_id: string
  change?: number
  desc: string
  mime: string
  path: string
  checksum?: string
  profile?: { date?: string }
}

function MimeIcon({ mime, className }: { mime: string; className?: string }) {
  if (mime.startsWith('image/')) return <FileImage className={className} />
  if (mime.startsWith('video/')) return <Film className={className} />
  if (mime.startsWith('audio/')) return <Music className={className} />
  return <FileText className={className} />
}

const title = (m: MediaRow) => m.desc || m.path?.split('/').pop() || m.gramps_id

function Thumb({ m, size = 48 }: { m: MediaRow; size?: number }) {
  useAccessToken()
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary text-muted-foreground" style={{ width: size, height: size }}>
      {failed ? (
        <MimeIcon mime={m.mime} className="size-5" />
      ) : (
        <img
          src={mediaThumbUrl(m.handle, Math.ceil((size * (window.devicePixelRatio || 1)) / 50) * 50, { square: true })}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      )}
    </span>
  )
}

export function MediaListPage() {
  const { t } = useTranslation(['lists', 'common'])
  const tagFilter = useTagFilter(t('filters.tag'), Tag)
  const extraFacets = useExtraFacets('media')
  useTitle(t('common:nav.media'))

  const config = useMemo<ListConfig<MediaRow>>(() => {
    const filters: FilterDef[] = [
      {
        id: 'mime',
        type: 'select',
        label: t('media.kind'),
        icon: FileImage,
        options: [
          { value: 'image/', label: t('media.kinds.image') },
          { value: 'application/pdf', label: t('media.kinds.pdf') },
          { value: 'video/', label: t('media.kinds.video') },
          { value: 'audio/', label: t('media.kinds.audio') },
          { value: 'text/', label: t('media.kinds.text') },
        ],
        toRule: (v) => rule('HasMedia', '', v, '', ''),
      },
      {
        id: 'year',
        type: 'years',
        label: t('media.year'),
        icon: CalendarRange,
        toRule: (v) => {
          const d = yearRangeDate(v)
          return d ? rule('HasMedia', '', '', '', d) : null
        },
      },
      ...(tagFilter ? [tagFilter] : []),
      ...extraFacets,
    ]
    return {
      kind: 'media',
      query: { profile: 'self', keys: 'handle,gramps_id,change,desc,mime,path,checksum,profile' },
      searchProfile: 'self',
      defaultSort: '-change',
      sorts: [
        { key: 'title', label: t('media.sort.title') },
        { key: 'date', label: t('media.sort.date') },
        { key: 'mime', label: t('media.sort.mime') },
        { key: 'path', label: t('media.sort.path') },
        { key: 'gramps_id', label: t('sort.id') },
        { key: 'change', label: t('sort.change') },
      ],
      textRule: (w) => rule('HasMedia', w, '', '', ''),
      filters,
      placeholder: t('media.placeholder'),
      pageSize: 60,
      rowHeight: 68,
      compactRowHeight: 68,
      addPath: '/new_media',
      columns: [
        {
          id: 'title',
          header: t('media.col.title'),
          sort: 'title',
          width: 'minmax(0,2fr)',
          cell: (m) => <RowLead visual={<Thumb m={m} />} title={title(m)} sub={m.path} />,
        },
        {
          id: 'date',
          header: t('media.col.date'),
          sort: 'date',
          width: 'minmax(5rem,0.6fr)',
          minWidth: 560,
          cell: (m) => <span className="block truncate text-[15px] tabular-nums">{m.profile?.date || <Dash />}</span>,
        },
        {
          id: 'mime',
          header: t('media.col.mime'),
          sort: 'mime',
          width: 'minmax(6rem,0.7fr)',
          minWidth: 680,
          cell: (m) => <span className="block truncate text-sm text-muted-foreground">{m.mime}</span>,
        },
        { id: 'id', header: t('col.id'), sort: 'gramps_id', width: '4.5rem', minWidth: 860, cell: (m) => <IdCell id={m.gramps_id} /> },
        {
          id: 'change',
          header: t('col.change'),
          sort: 'change',
          width: '7.5rem',
          minWidth: 980,
          align: 'end',
          cell: (m) => <ChangedCell ts={m.change} />,
        },
      ],
      compact: (m) => (
        <RowLead visual={<Thumb m={m} />} title={title(m)} sub={[m.profile?.date, m.mime].filter(Boolean).join(' · ')} />
      ),
    }
  }, [t, tagFilter, extraFacets])

  const ctl = useListController(config)
  const view = ctl.state.params.get('view') === 'table' ? 'table' : 'grid'

  return (
    <ListFrame
      title={t('common:nav.media')}
      count={<CountDescription label={ctl.countLabel} busy={ctl.first.isFetching} />}
      actions={<AddButton kind="media" path={config.addPath} />}
    >
      <ListToolbar
        config={config}
        ctl={ctl}
        noSelect={view !== 'table'}
        extra={
          <>
          {/* phones: one button that flips the view, so the search field keeps its width */}
          <button
            type="button"
            onClick={() => ctl.state.setParam('view', view === 'table' ? null : 'table')}
            aria-label={view === 'table' ? t('media.grid') : t('media.table')}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground active:scale-[0.97] sm:hidden"
          >
            {view === 'table' ? <LayoutGrid className="size-5" /> : <List className="size-5" />}
          </button>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && ctl.state.setParam('view', v === 'table' ? 'table' : null)}
            aria-label={t('media.view')}
            className="shrink-0 gap-0.5 rounded-full bg-card p-1 max-sm:hidden"
          >
            {(
              [
                ['grid', LayoutGrid, t('media.grid')],
                ['table', List, t('media.table')],
              ] as const
            ).map(([v, Icon, label]) => (
              <ToggleGroupItem
                key={v}
                value={v}
                aria-label={label}
                title={label}
                className="size-8 rounded-full! text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground max-sm:size-10"
              >
                <Icon />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          </>
        }
      />
      {view === 'table' ? <VirtualList config={config} ctl={ctl} /> : <MediaGrid ctl={ctl} />}
    </ListFrame>
  )
}

/* ------------------------------------------------------------------ justified grid */

// Aspect ratios are learned from the loaded thumbnails and kept for the session.
const ratios = new Map<string, number>()

function MediaGrid({ ctl }: { ctl: ListController<MediaRow> }) {
  const { first, source, state } = ctl
  const sentinel = useRef<HTMLDivElement>(null)
  const keyStr = JSON.stringify(source.key)
  const [ratioVersion, bump] = useState(0)
  // callback ref: the grid mounts only after the first page has loaded
  const [gridEl, gridRef] = useState<HTMLUListElement | null>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!gridEl) return
    setWidth(gridEl.clientWidth)
    const ro = new ResizeObserver(() => setWidth(gridEl.clientWidth))
    ro.observe(gridEl)
    return () => ro.disconnect()
  }, [gridEl])
  // pages loaded so far; a new filter/sort starts over
  const [loaded, setLoaded] = useState({ key: keyStr, count: 1 })
  const pageCount = loaded.key === keyStr ? loaded.count : 1
  const setPageCount = (fn: (n: number) => number) => setLoaded((l) => ({ key: keyStr, count: fn(l.key === keyStr ? l.count : 1) }))

  const pageIdx = useMemo(() => Array.from({ length: pageCount }, (_, i) => i), [pageCount])
  const { getItem, loading } = usePages(source, first.data, pageIdx)
  const total = first.data?.total ?? 0
  const loadedTarget = Math.min(total, pageCount * source.pageSize)
  const items: MediaRow[] = []
  for (let i = 0; i < loadedTarget; i++) {
    const it = getItem(i)
    if (!it) break
    items.push(it)
  }

  const layout = useMemo(
    () => justify(items.map((m) => ratioOf(m.handle)), width),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.length, items[0]?.handle, width, ratioVersion],
  )

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && pageCount * source.pageSize < total) setPageCount((n) => n + 1)
      },
      { rootMargin: '800px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pageCount, source.pageSize, total, keyStr])

  if (first.isError && !first.data) return <ErrorState error={first.error} onRetry={() => first.refetch()} />
  if (!first.data)
    return (
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-36 grow basis-40 rounded-2xl sm:h-56 sm:basis-64" style={{ opacity: 1 - i / 14 }} />
        ))}
      </div>
    )
  if (total === 0)
    return (
      <div className="rounded-3xl bg-card">
      <ListEmpty
        kind="media"
        filtered={source.filtered}
        onClear={() => state.setMany({ q: null, adv: null, gql: null, ...Object.fromEntries(Object.keys(state.filters).map((id) => [id, null])) })}
      />
      </div>
    )

  return (
    <div className={cn('transition-opacity', first.isPlaceholderData && 'opacity-60')}>
      <ul ref={gridRef} role="list" className="flex flex-wrap gap-x-2 gap-y-4 sm:gap-x-3 sm:gap-y-5">
        {width > 0 &&
          items.map((m, i) => (
            <GridTile key={m.handle} m={m} box={layout[i]} onRatio={() => bump((n) => n + 1)} />
          ))}
      </ul>
      <div ref={sentinel} className="h-px" />
      {loading && (
        <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 grow basis-40 rounded-2xl sm:h-52 sm:basis-64" />
          ))}
        </div>
      )}
    </div>
  )
}

const ratioOf = (handle: string) => ratios.get(handle) ?? 1.33

interface Box {
  width: number
  height: number
  /** last tile of a row: absorbs sub-pixel rounding */
  last: boolean
}

/**
 * Justified rows (like a photo album): tiles keep their aspect ratio, every full row spans the
 * width exactly, the last row keeps the target height. O(n), runs only when tiles or width change.
 */
function justify(rs: number[], width: number): Box[] {
  if (!width) return []
  const gap = width < 640 ? 8 : 12
  const target = width < 640 ? 150 : width > 1500 ? 250 : 215
  const out: Box[] = []
  let row: number[] = []
  let sum = 0
  const close = (n: number, h: number, full: boolean) => {
    for (let k = 0; k < n; k++) out.push({ width: row[k] * h, height: h, last: full && k === n - 1 })
    row = row.slice(n)
    sum = row.reduce((a, b) => a + b, 0)
  }
  for (const r of rs) {
    row.push(r)
    sum += r
    const h = (width - gap * (row.length - 1)) / sum
    if (h <= target) {
      // compare with the row without this tile; keep whichever height is closer to the target
      const prevSum = sum - r
      const hPrev = row.length > 1 ? (width - gap * (row.length - 2)) / prevSum : Infinity
      if (row.length > 1 && Math.abs(hPrev - target) < Math.abs(h - target) && hPrev < target * 1.5) close(row.length - 1, hPrev, true)
      else close(row.length, h, true)
    }
  }
  if (row.length) close(row.length, Math.min(target, (width - gap * (row.length - 1)) / sum), false)
  return out
}

function GridTile({ m, box, onRatio }: { m: MediaRow; box?: Box; onRatio: () => void }) {
  useAccessToken()
  const [failed, setFailed] = useState(false)
  if (!box) return null
  return (
    <li className="min-w-0" style={{ width: Math.floor(box.width * 100) / 100 - 0.05, flexGrow: box.last ? 1 : 0 }}>
      <Link
        to={objectPath('media', m.gramps_id)}
        className="group block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        title={title(m)}
      >
        <span className="relative block overflow-hidden rounded-2xl bg-secondary transition-transform duration-150 ease-out group-active:scale-[0.98] motion-reduce:transition-none" style={{ height: box.height }}>
          {failed ? (
            <span className="flex size-full flex-col items-center justify-center gap-2 p-2 text-muted-foreground">
              <MimeIcon mime={m.mime} className="size-7" />
              <span className="text-xs text-muted-foreground">{m.mime}</span>
            </span>
          ) : (
            <img
              src={mediaThumbUrl(m.handle, 500)}
              alt={m.desc}
              loading="lazy"
              decoding="async"
              onLoad={(e) => {
                const img = e.currentTarget
                if (!img.naturalWidth || !img.naturalHeight) return
                const nr = Math.min(3, Math.max(0.4, img.naturalWidth / img.naturalHeight))
                if (Math.abs((ratios.get(m.handle) ?? 0) - nr) > 0.01) {
                  ratios.set(m.handle, nr)
                  onRatio()
                }
              }}
              onError={() => {
                setFailed(true)
                ratios.set(m.handle, 0.8)
                onRatio()
              }}
              className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          )}
        </span>
        <span className="mt-2 flex items-baseline gap-2 px-1">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground transition-colors duration-150 group-hover:text-foreground">{title(m)}</span>
          {yearOf(m.profile?.date) ? <span className="shrink-0 font-serif text-[15px] tabular-nums text-brass">{yearOf(m.profile?.date)}</span> : null}
        </span>
      </Link>
    </li>
  )
}
