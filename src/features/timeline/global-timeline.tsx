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
import { Portrait } from '@/components/portrait'
import { usePortraits } from '@/hooks/use-portraits'
import type { MediaRef } from '@/lib/types'
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
  const faces = usePortraits(
    visibleHandles.map((h) => {
      const pp = detail(h)?.profile?.participants
      return pp?.people?.[0]?.person?.handle ?? pp?.families?.[0]?.family?.father?.handle ?? ''
    }),
  )

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
    if (!focusEvent || focused.current === focusEvent || !q.data) return
    const idx = rows.findIndex((r) => r.kind === 'event' && r.ev.gramps_id === focusEvent)
    if (idx < 0) {
      // hidden by a filter: clear the filters so the event shows (undated events never show)
      if (!q.data.some((e) => e.gramps_id === focusEvent)) return
      if (scopeKind || activeTypes.length || range) {
        setTypes([])
        setRange(null)
        if (scopeKind)
          setParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              ;['ofk', 'of', 'mode'].forEach((k) => next.delete(k))
              return next
            },
            { replace: true },
          )
      }
      return
    }
    focused.current = focusEvent
    v.scrollToIndex(idx, { align: 'center' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEvent, rows, v, q.data])

  const jumpTo = (decade: number) => {
    const idx = rows.findIndex((r) => r.kind === 'decade' && r.decade === decade)
    if (idx >= 0) v.scrollToIndex(idx, { align: 'start' })
  }

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />

  const maxCount = Math.max(1, earlierCount, ...decades.map((d) => d.count))
  const toggleType = (tp: string) =>
    setTypes(activeTypes.includes(tp) ? activeTypes.filter((x) => x !== tp) : [...activeTypes, tp])

  const currentDecade = current ? Math.floor(current.year / 10) * 10 : null

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[24rem_minmax(0,1fr)] 2xl:grid-cols-[26rem_minmax(0,1fr)]">
      {/* filters */}
      <aside className="min-w-0 space-y-5 rounded-3xl bg-card p-5 sm:p-6 xl:sticky xl:top-[calc(var(--header-h)+1.5rem)] xl:max-h-[calc(100dvh-var(--header-h)-3rem)] xl:overflow-y-auto">
        <ScopeFilter
          kind={scopeKind}
          id={scopeId}
          mode={scopeMode}
          modes={scopeModes}
          loading={!!scopeKind && scope.isLoading}
          onChange={setScope}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('eventTypes')}>
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
          {q.isLoading && <Skeleton className="h-10 w-64 rounded-full" />}
        </div>

        {decades.length > 1 && yr && extent && domain && (
          <div className="rounded-2xl bg-secondary/60 px-4 pt-4 pb-3">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">{t('yearRange')}</span>
              <span className="font-serif text-xl tabular-nums text-brass">
                {fromLabel(yr[0])} – {yr[1]}
              </span>
            </div>
            <div className="flex h-20 items-end gap-px" aria-hidden>
              {domain.hasEarlier && (
                <button
                  type="button"
                  tabIndex={-1}
                  title={`${t('earlier')}: ${earlierCount}`}
                  onClick={() => v.scrollToIndex(0, { align: 'start' })}
                  className="group mr-1.5 flex h-full w-3 shrink-0 items-end border-r border-dashed border-lineage pr-1.5"
                >
                  <span
                    className={cn(
                      'block w-full rounded-t-[3px] transition-colors duration-150',
                      yr[0] <= domain.min ? 'bg-chart-1/60 group-hover:bg-brass' : 'bg-muted-foreground/15',
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
                        'block w-full rounded-t-[3px] transition-colors duration-150',
                        !inRange ? 'bg-muted-foreground/15' : d.decade === currentDecade ? 'bg-brass' : 'bg-chart-1/60 group-hover:bg-brass/80',
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
            <div className="mt-2 flex items-center justify-between gap-2 font-serif text-sm tabular-nums text-muted-foreground">
              <span>{fromLabel(extent[0])}</span>
              <span>{extent[1]}</span>
            </div>
          </div>
        )}
      </aside>

      <div className="min-w-0">
      {/* sticky "where am I" bar */}
      {current && rows.length > 0 && (
        <div className="sticky top-[calc(var(--header-h)+0.5rem)] z-20 rounded-2xl bg-card/90 px-5 py-2.5 shadow-[0_12px_32px_-14px_rgb(0_0_0/0.55)] ring-1 ring-foreground/[0.06] backdrop-blur-xl max-xl:mt-0">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-2xl font-medium">{t('decade', { decade: Math.floor(current.year / 10) * 10 })}</span>
            <span className="font-serif text-lg tabular-nums text-brass">{current.year}</span>
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
        {rows.length > 0 && (
          <span aria-hidden className="absolute top-6 bottom-6 left-[4.81rem] w-0.5 rounded-full bg-lineage/70 sm:left-[6.56rem]" />
        )}
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
                <div className="flex items-baseline gap-3 pt-8 pb-3 pl-[6.25rem] sm:pl-[8.25rem]">
                  <h2 className="font-serif text-3xl font-medium tracking-[-0.01em] sm:text-4xl">{t('decade', { decade: r.decade })}</h2>
                  <span className="text-sm tabular-nums text-muted-foreground">{t('eventsCount', { count: r.count })}</span>
                </div>
              ) : (
                <EventRow
                  ev={r.ev}
                  firstOfYear={r.firstOfYear}
                  detail={detail(r.ev.handle)}
                  typeLabel={label(r.ev.type)}
                  highlight={r.ev.gramps_id === focusEvent}
                  faces={faces}
                />
              )}
            </div>
          )
        })}
      </div>
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
        'inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm transition-[color,background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] sm:h-9',
        active ? 'bg-primary font-medium text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground',
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
  const person = useObjectById<Person>('person', kind === 'person' ? (id ?? undefined) : undefined, { keys: ['handle', 'gramps_id', 'profile'], profile: ['self'] })
  const place = useObjectById<Place>('place', kind === 'place' ? (id ?? undefined) : undefined, { keys: ['handle', 'gramps_id', 'profile'], profile: ['self'] })
  const name = kind === 'person' ? profileName(person.data?.profile) : kind === 'place' ? place.data?.profile?.name : ''
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ObjectPicker
        kinds={['person', 'place']}
        placeholder={t('scope.pick')}
        onChange={(o) => onChange(o.kind === 'place' ? 'place' : 'person', o.gramps_id)}
        trigger={
          <Button variant="secondary" className={cn('h-11 max-w-full rounded-full px-4 sm:h-10', kind && 'ring-1 ring-primary/50')}>
            <Filter />
            <span className="truncate">{kind ? name || id : t('scope.pick')}</span>
          </Button>
        }
      />
      {kind && (
        <>
          <div className="inline-flex flex-wrap rounded-full bg-secondary p-1" role="radiogroup" aria-label={t('scope.mode')}>
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => onChange(kind, id, m)}
                className={cn(
                  'h-10 rounded-full px-3.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-8',
                  mode === m ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`scope.${m}`)}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="size-10 rounded-full" aria-label={t('scope.clear')} onClick={() => onChange(null, null)}>
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
  faces,
}: {
  faces: Map<string, MediaRef | undefined>
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

  const face = people[0]?.person ?? fams[0]?.family?.father ?? null
  return (
    <div className="flex gap-4 py-2.5 sm:gap-5">
      <span
        className={cn(
          'w-14 shrink-0 pt-0.5 text-right font-serif text-2xl leading-none tabular-nums text-brass sm:w-20',
          !firstOfYear && 'invisible',
        )}
      >
        {ev.year}
      </span>
      <span aria-hidden className={cn('relative z-10 mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-background', typeTone(ev.type))} />
      <div className={cn('flex min-w-0 flex-1 items-start gap-3', highlight && '-my-1 -ml-2 rounded-xl bg-brass/10 py-1 pl-2')}>
        {face && profileName(face) ? (
          <Portrait mediaRef={faces.get(face.handle ?? '')} name={profileName(face)} sex={face.sex} size={36} className="max-sm:hidden" />
        ) : (
          <span className="size-9 shrink-0 max-sm:hidden" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <Link to={`/event/${ev.gramps_id}`} className="text-[15px] font-semibold hover:underline">
              {p?.type || typeLabel}
            </Link>
            {p?.date && p.date !== String(ev.year) && <span className="truncate text-xs tabular-nums text-muted-foreground">{p.date}</span>}
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
    </div>
  )
}
