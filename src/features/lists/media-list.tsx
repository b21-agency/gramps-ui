import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CalendarRange, FileText, Film, FileImage, LayoutGrid, List, Music, Tag } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Page } from '@/components/app-shell'
import { ErrorState } from '@/components/states'
import { mediaThumbUrl } from '@/lib/api'
import { useAccessToken } from '@/lib/auth'
import { objectPath } from '@/lib/objects'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import {
  AddButton,
  CountDescription,
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
import { ChangedCell, Dash, IdCell } from './cells'

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

function Thumb({ m, size = 40 }: { m: MediaRow; size?: number }) {
  useAccessToken()
  const [failed, setFailed] = useState(false)
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary text-secondary-foreground" style={{ width: size, height: size }}>
      {failed ? (
        <MimeIcon mime={m.mime} className="size-4" />
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
      rowHeight: 56,
      compactRowHeight: 60,
      addPath: '/new_media',
      columns: [
        {
          id: 'title',
          header: t('media.col.title'),
          sort: 'title',
          width: 'minmax(0,2fr)',
          cell: (m) => (
            <div className="flex min-w-0 items-center gap-3">
              <Thumb m={m} />
              <div className="min-w-0">
                <div className="truncate font-serif text-[1.05rem] leading-snug">{title(m)}</div>
                <div className="truncate text-xs text-muted-foreground">{m.path}</div>
              </div>
            </div>
          ),
        },
        {
          id: 'date',
          header: t('media.col.date'),
          sort: 'date',
          width: 'minmax(5rem,0.6fr)',
          minWidth: 560,
          cell: (m) => <span className="tabular-nums">{m.profile?.date || <Dash />}</span>,
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
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Thumb m={m} size={44} />
          <div className="min-w-0">
            <div className="truncate font-serif text-[1.05rem] leading-snug">{title(m)}</div>
            <div className="truncate text-xs text-muted-foreground">{[m.profile?.date, m.mime].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      ),
    }
  }, [t, tagFilter, extraFacets])

  const ctl = useListController(config)
  const view = ctl.state.params.get('view') === 'table' ? 'table' : 'grid'

  return (
    <Page
      title={t('common:nav.media')}
      description={<CountDescription label={ctl.countLabel} busy={ctl.first.isFetching} />}
      actions={<AddButton kind="media" path={config.addPath} />}
    >
      <ListToolbar
        config={config}
        ctl={ctl}
        noSelect={view !== 'table'}
        extra={
          <ToggleGroup
            type="single"
            variant="outline"
            value={view}
            onValueChange={(v) => v && ctl.state.setParam('view', v === 'table' ? 'table' : null)}
            aria-label={t('media.view')}
          >
            <ToggleGroupItem value="grid" aria-label={t('media.grid')} className="h-9 bg-card max-md:size-11">
              <LayoutGrid />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label={t('media.table')} className="h-9 bg-card max-md:size-11">
              <List />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      {view === 'table' ? <VirtualList config={config} ctl={ctl} /> : <MediaGrid ctl={ctl} />}
    </Page>
  )
}

/* ------------------------------------------------------------------ justified grid */

// Aspect ratios are learned from the loaded thumbnails and kept for the session.
const ratios = new Map<string, number>()

function MediaGrid({ ctl }: { ctl: ListController<MediaRow> }) {
  const { first, source, state } = ctl
  const sentinel = useRef<HTMLDivElement>(null)
  const keyStr = JSON.stringify(source.key)
  const [, bump] = useState(0)
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
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-36 grow basis-40 sm:h-44" />
        ))}
      </div>
    )
  if (total === 0)
    return (
      <ListEmpty
        kind="media"
        filtered={source.filtered}
        onClear={() => state.setMany({ q: null, adv: null, gql: null, ...Object.fromEntries(Object.keys(state.filters).map((id) => [id, null])) })}
      />
    )

  return (
    <div className={cn('transition-opacity', first.isPlaceholderData && 'opacity-60')}>
      <ul role="list" className="flex flex-wrap gap-2 [--row:8.5rem] sm:gap-3 sm:[--row:11rem]">
        {items.map((m) => (
          <GridTile key={m.handle} m={m} onRatio={() => bump((n) => n + 1)} />
        ))}
        <li aria-hidden className="grow-[1000]" />
      </ul>
      <div ref={sentinel} className="h-px" />
      {loading && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 grow basis-40 sm:h-44" />
          ))}
        </div>
      )}
    </div>
  )
}

function GridTile({ m, onRatio }: { m: MediaRow; onRatio: () => void }) {
  useAccessToken()
  const [failed, setFailed] = useState(false)
  const r = failed ? 0.8 : (ratios.get(m.handle) ?? 1.33)
  return (
    <li className="min-w-0" style={{ flexGrow: r, flexBasis: `calc(var(--row) * ${r})` }}>
      <Link
        to={objectPath('media', m.gramps_id)}
        className="group block rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        title={title(m)}
      >
        <span className="relative block overflow-hidden rounded-lg border bg-secondary" style={{ aspectRatio: r }}>
          {failed ? (
            <span className="flex size-full flex-col items-center justify-center gap-2 p-2 text-secondary-foreground">
              <MimeIcon mime={m.mime} className="size-6" />
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
              onError={() => setFailed(true)}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          )}
        </span>
        <span className="mt-1 block truncate px-0.5 text-xs text-muted-foreground group-hover:text-foreground">{title(m)}</span>
      </Link>
    </li>
  )
}
