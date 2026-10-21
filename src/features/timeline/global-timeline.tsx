import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { CalendarX2, Filter, Loader2, MapPin, X } from 'lucide-react'
import { ObjectPicker } from '@/components/object-picker'
import { useObjectById } from '@/lib/queries'
import type { Person, Place } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { profileName } from '@/lib/format'
import { usePref } from '@/lib/prefs'
import { cn } from '@/lib/utils'
import {
  typeTone,
  useAllEvents,
  useEventDetails,
  useTimelineScope,
  useTypeLabels,
  type DatedEvent,
  type EventDetail,
  type ScopeMode,
} from './data'

type Row =
  | { kind: 'decade'; decade: number; count: number }
  | { kind: 'event'; ev: DatedEvent; firstOfYear: boolean }

const MAX_CHIPS = 8

export function GlobalTimeline() {
  const { t } = useTranslation(['timeline', 'common'])
  const q = useAllEvents()
  const [params, setParams] = useSearchParams()
  const scopeKind = (['person', 'place'] as const).find((k) => k === params.get('ofk')) ?? null
  const scopeId = scopeKind ? params.get('of') : null
  const scopeModes: ScopeMode[] = scopeKind === 'place' ? ['exact', 'enclosed'] : ['self', 'ancestors', 'descendants']
  const scopeMode = scopeModes.find((m) => m === params.get('mode')) ?? scopeModes[0]
  const scope = useTimelineScope(scopeKind, scopeId, scopeMode)
  const setScope = (kind: 'person' | 'place' | null, id: string | null, mode?: ScopeMode) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('event')
        if (kind && id) {
          next.set('ofk', kind)
          next.set('of', id)
          if (mode) next.set('mode', mode)
          else next.delete('mode')
        } else ['ofk', 'of', 'mode'].forEach((k) => next.delete(k))
        return next
      },
      { replace: true },
    )
  const all = useMemo(() => {
    const list = q.data ?? []
    if (!scopeKind) return list
    const s = scope.data
    if (!s) return []
    if (s.events) return list.filter((e) => s.events!.has(e.handle))
    return list.filter((e) => !!e.place && s.places!.has(e.place))
  }, [q.data, scopeKind, scope.data])
  const [types, setTypes] = usePref<string[]>('timeline.types', [])
  const [range, setRange] = useState<[number, number] | null>(null)
  // a new person/place scope has its own year extent
  useEffect(() => setRange(null), [scopeKind, scopeId, scopeMode])

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>()
    all.forEach((e) => m.set(e.type, (m.get(e.type) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [all])
  const label = useTypeLabels(typeCounts.map(([k]) => k))
  const chipTypes = typeCounts.slice(0, MAX_CHIPS)
  const activeTypes = types.filter((tp) => typeCounts.some(([k]) => k === tp))

  const byType = useMemo(
    () => (activeTypes.length ? all.filter((e) => activeTypes.includes(e.type)) : all),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, activeTypes.join('|')],
  )
  // Domain of the chart/slider: the dense part of the data. A few stray early years (typos,
  // year-only placeholders) would otherwise squash everything to the right, so events before the
  // 3rd percentile go into an "earlier" bucket, which is the slider's leftmost step.
  const domain = useMemo(() => {
    if (!all.length) return null
    const years = all.map((e) => e.year).sort((a, b) => a - b)
    const max = years[years.length - 1]
    const p1 = years[Math.floor(years.length * 0.03)]
    let lo = Math.floor(p1 / 10) * 10
    if (lo - years[0] < 30) lo = Math.floor(years[0] / 10) * 10
    const hasEarlier = years[0] < lo
    // with an "earlier" bucket, lo - 1 is the sentinel step that means "and everything before"
    return { lo, max, hasEarlier, min: hasEarlier ? lo - 1 : lo }
  }, [all])
  const extent: [number, number] | null = domain ? [domain.min, domain.max] : null
  const yr = range ?? extent
  const filtered = useMemo(() => {
    if (!yr || !domain) return byType
    const from = domain.hasEarlier && yr[0] <= domain.min ? -Infinity : yr[0]
    return byType.filter((e) => e.year >= from && e.year <= yr[1])
  }, [byType, yr, domain])
  const earlierCount = useMemo(
    () => (domain?.hasEarlier ? byType.filter((e) => e.year < domain.lo).length : 0),
    [byType, domain],
  )
  const fromLabel = (y: number) => (domain?.hasEarlier && y <= domain.min ? t('earlier') : String(y))

  const decades = useMemo(() => {
    if (!domain) return [] as Array<{ decade: number; count: number }>
    const counts = new Map<number, number>()
    byType.forEach((e) => {
      const d = Math.floor(e.year / 10) * 10
      counts.set(d, (counts.get(d) ?? 0) + 1)
    })
    const out = []
    for (let d = domain.lo; d <= domain.max; d += 10) out.push({ decade: d, count: counts.get(d) ?? 0 })
    return out
  }, [byType, domain])

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = []
    let decade = -Infinity
    let year = -Infinity
    const decadeCounts = new Map<number, number>()
    filtered.forEach((e) => {
      const d = Math.floor(e.year / 10) * 10
      decadeCounts.set(d, (decadeCounts.get(d) ?? 0) + 1)
    })
    for (const ev of filtered) {
      const d = Math.floor(ev.year / 10) * 10
      if (d !== decade) {
        out.push({ kind: 'decade', decade: d, count: decadeCounts.get(d) ?? 0 })
        decade = d
      }
      out.push({ kind: 'event', ev, firstOfYear: ev.year !== year })
      year = ev.year
    }
    return out
  }, [filtered])

  /* ---------- virtual list over the window scroll ---------- */
  const listRef = useRef<HTMLDivElement>(null)
  const [margin, setMargin] = useState(0)
  // re-measured after every render; guarded so it only updates when the offset really changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    if (Math.abs(top - margin) > 1) setMargin(top)
  })
  const v = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i]?.kind === 'decade' ? 64 : 76),
    overscan: 8,
    scrollMargin: margin,
    scrollPaddingStart: 120,
  })
  const items = v.getVirtualItems()
  const visibleHandles = items.flatMap((it) => {
    const r = rows[it.index]
    return r?.kind === 'event' ? [r.ev.handle] : []
  })
  const detail = useEventDetails(visibleHandles)

  // the decade/year at the top edge of the viewport, for the sticky header
  const topY = (v.scrollOffset ?? 0) - margin + 56 + 48
  const topItem = items.find((it) => it.end > topY) ?? items[0]
  let current: DatedEvent | null = null
  if (topItem) {
    for (let i = topItem.index; i < rows.length; i++) {
      const r = rows[i]
      if (r.kind === 'event') {
        current = r.ev
        break
      }
    }
  }

  // ?event=E0001 ("show on timeline" from an event): scroll there once the rows exist
  const focusEvent = params.get('event')
  const focused = useRef<string | null>(null)
  useEffect(() => {
    if (!focusEvent || focused.current === focusEvent || !rows.length) return
    const idx = rows.findIndex((r) => r.kind === 'event' && r.ev.gramps_id === focusEvent)
    if (idx < 0) return
    focused.current = focusEvent
    v.scrollToIndex(idx, { align: 'center' })
  }, [focusEvent, rows, v])

  const jumpTo = (decade: number) => {
    const idx = rows.findIndex((r) => r.kind === 'decade' && r.decade === decade)
    if (idx >= 0) v.scrollToIndex(idx, { align: 'start' })
  }

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  const maxCount = Math.max(1, earlierCount, ...decades.map((d) => d.count))
  const toggleType = (tp: string) =>
    setTypes(activeTypes.includes(tp) ? activeTypes.filter((x) => x !== tp) : [...activeTypes, tp])

  return (
    <div>
      {/* filters */}
      <div className="space-y-4">
        <ScopeFilter
          kind={scopeKind}
          id={scopeId}
          mode={scopeMode}
          modes={scopeModes}
          loading={!!scopeKind && scope.isLoading}
          onChange={setScope}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('eventTypes')}>
          <Chip active={activeTypes.length === 0} onClick={() => setTypes([])}>
            {t('allTypes')}
            <span className="tabular-nums opacity-70">{all.length}</span>
          </Chip>
          {chipTypes.map(([tp, n]) => (
            <Chip key={tp} active={activeTypes.includes(tp)} onClick={() => toggleType(tp)}>
              <span className={cn('size-2 rounded-full', typeTone(tp))} />
              {label(tp)}
              <span className="tabular-nums opacity-70">{n}</span>
            </Chip>
          ))}
          {q.isLoading && <Skeleton className="h-7 w-64 rounded-full" />}
        </div>

        {decades.length > 1 && yr && extent && domain && (
          <div className="rounded-xl border bg-card px-4 pb-3 pt-4">
            <div className="flex h-16 items-end gap-px" aria-hidden>
              {domain.hasEarlier && (
                <button
                  type="button"
                  tabIndex={-1}
                  title={`${t('earlier')}: ${earlierCount}`}
                  onClick={() => v.scrollToIndex(0, { align: 'start' })}
                  className="group mr-1.5 flex h-full w-3 shrink-0 items-end border-r border-dashed pr-1.5"
                >
                  <span
                    className={cn(
                      'block w-full rounded-t-sm transition-colors',
                      yr[0] <= domain.min ? 'bg-brass/70 group-hover:bg-brass' : 'bg-muted-foreground/20',
                    )}
                    style={{ height: `${earlierCount ? Math.max(6, (earlierCount / maxCount) * 100) : 2}%` }}
                  />
                </button>
              )}
              {decades.map((d) => {
                const inRange = d.decade + 9 >= yr[0] && d.decade <= yr[1]
                return (
                  <button
                    key={d.decade}
                    type="button"
                    tabIndex={-1}
                    title={`${t('decade', { decade: d.decade })}: ${d.count}`}
                    onClick={() => jumpTo(d.decade)}
                    className="group flex h-full min-w-0 flex-1 items-end"
                  >
                    <span
                      className={cn(
                        'block w-full rounded-t-sm transition-colors',
                        inRange ? 'bg-primary/70 group-hover:bg-primary' : 'bg-muted-foreground/20',
                      )}
                      style={{ height: `${d.count ? Math.max(6, (d.count / maxCount) * 100) : 2}%` }}
                    />
                  </button>
                )
              })}
            </div>
            <Slider
              className="mt-3"
              min={extent[0]}
              max={extent[1]}
              step={1}
              value={yr}
              onValueChange={(val) => setRange([val[0], val[1]] as [number, number])}
              aria-label={t('yearRange')}
            />
            <div className="mt-2 flex items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
              <span>{fromLabel(extent[0])}</span>
              <span className="font-serif text-base text-brass">
                {fromLabel(yr[0])} – {yr[1]}
              </span>
              <span>{extent[1]}</span>
            </div>
          </div>
        )}
      </div>

      {/* sticky "where am I" bar */}
      {current && rows.length > 0 && (
        <div className="sticky top-[var(--header-h)] z-20 -mx-4 mt-4 border-b bg-background/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-xl">{t('decade', { decade: Math.floor(current.year / 10) * 10 })}</span>
            <span className="text-sm tabular-nums text-brass">{current.year}</span>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {t('eventsCount', { count: filtered.length })}
            </span>
          </div>
        </div>
      )}

      {q.isLoading && (
        <div className="mt-6">
          <RowsSkeleton rows={8} />
        </div>
      )}
      {q.data && all.length === 0 && (
        <EmptyState icon={CalendarX2} title={t('noEvents')}>
          {t('noEventsHint')}
        </EmptyState>
      )}
      {q.data && all.length > 0 && filtered.length === 0 && (
        <EmptyState icon={CalendarX2} title={t('noMatches')}>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              setTypes([])
              setRange(null)
            }}
          >
            {t('resetFilters')}
          </Button>
        </EmptyState>
      )}

      <div ref={listRef} className="relative" style={{ height: v.getTotalSize() }}>
        {items.map((it) => {
          const r = rows[it.index]
          return (
            <div
              key={it.key}
              data-index={it.index}
              ref={v.measureElement}
              className="absolute inset-x-0"
              style={{ transform: `translateY(${it.start - margin}px)` }}
            >
              {r.kind === 'decade' ? (
                <div className="flex items-baseline gap-2 pb-2 pt-6">
                  <h2 className="text-2xl font-medium">{t('decade', { decade: r.decade })}</h2>
                  <span className="text-sm tabular-nums text-muted-foreground">{t('eventsCount', { count: r.count })}</span>
                </div>
              ) : (
                <EventRow
                  ev={r.ev}
                  firstOfYear={r.firstOfYear}
                  detail={detail(r.ev.handle)}
                  typeLabel={label(r.ev.type)}
                  highlight={r.ev.gramps_id === focusEvent}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-md:h-9 max-md:px-3.5',
        active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}

/** "Only events of …": a person (self/ancestors/descendants) or a place (exact/enclosed). */
function ScopeFilter({
  kind,
  id,
  mode,
  modes,
  loading,
  onChange,
}: {
  kind: 'person' | 'place' | null
  id: string | null
  mode: ScopeMode
  modes: ScopeMode[]
  loading: boolean
  onChange: (kind: 'person' | 'place' | null, id: string | null, mode?: ScopeMode) => void
}) {
  const { t } = useTranslation(['timeline', 'common'])
  const person = useObjectById<Person>('person', kind === 'person' ? (id ?? undefined) : undefined, { keys: 'handle,gramps_id,profile', profile: 'self' })
  const place = useObjectById<Place>('place', kind === 'place' ? (id ?? undefined) : undefined, { keys: 'handle,gramps_id,profile', profile: 'self' })
  const name = kind === 'person' ? profileName(person.data?.profile) : kind === 'place' ? place.data?.profile?.name : ''
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ObjectPicker
        kinds={['person', 'place']}
        placeholder={t('scope.pick')}
        onChange={(o) => onChange(o.kind === 'place' ? 'place' : 'person', o.gramps_id)}
        trigger={
          <Button variant="outline" size="sm" className={cn('max-w-72 bg-card', kind && 'border-primary/40')}>
            <Filter />
            <span className="truncate">{kind ? name || id : t('scope.pick')}</span>
          </Button>
        }
      />
      {kind && (
        <>
          <div className="inline-flex rounded-lg border bg-muted p-0.5" role="radiogroup" aria-label={t('scope.mode')}>
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => onChange(kind, id, m)}
                className={cn(
                  'h-7 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-md:h-8',
                  mode === m ? 'bg-card font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`scope.${m}`)}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={t('scope.clear')} onClick={() => onChange(null, null)}>
            <X />
          </Button>
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </>
      )}
    </div>
  )
}

function EventRow({
  ev,
  firstOfYear,
  detail,
  typeLabel,
  highlight,
}: {
  ev: DatedEvent
  firstOfYear: boolean
  detail?: EventDetail
  typeLabel: string
  highlight?: boolean
}) {
  const p = detail?.profile
  const people = p?.participants?.people ?? []
  const fams = p?.participants?.families ?? []
  const who = [
    ...people.slice(0, 2).map((x) => ({
      to: `/person/${x.person.gramps_id}`,
      name: profileName(x.person),
    })),
    ...fams.slice(0, 1).map((x) => ({
      to: `/family/${x.family.gramps_id}`,
      name: [profileName(x.family.father), profileName(x.family.mother)].filter(Boolean).join(' & '),
    })),
  ].filter((x) => x.name)

  return (
    <div className="grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_1.5rem_minmax(0,1fr)]">
      <div className="pt-2.5 text-right font-serif text-lg leading-none tabular-nums text-brass">
        {firstOfYear ? ev.year : ''}
      </div>
      <div className="relative flex justify-center">
        <span className="absolute inset-y-0 w-px bg-border" />
        <span className={cn('relative mt-3 size-2.5 rounded-full ring-4 ring-background', typeTone(ev.type))} />
      </div>
      <div className={cn('min-w-0 py-2 pl-1', highlight && '-ml-1 rounded-lg bg-brass/10 pl-2')}>
        <div className="flex items-baseline gap-2">
          <Link to={`/event/${ev.gramps_id}`} className="font-medium hover:underline">
            {p?.type || typeLabel}
          </Link>
          <span className="truncate text-xs tabular-nums text-muted-foreground">{p?.date}</span>
        </div>
        {detail ? (
          <>
            {who.length > 0 && (
              <div className="flex flex-wrap gap-x-3 text-sm">
                {who.map((w) => (
                  <Link key={w.to} to={w.to} className="truncate hover:underline">
                    {w.name}
                  </Link>
                ))}
              </div>
            )}
            {p?.place_name && (
              <div className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{p.place || p.place_name}</span>
              </div>
            )}
          </>
        ) : (
          <div className="mt-1 space-y-1.5">
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        )}
      </div>
    </div>
  )
}
