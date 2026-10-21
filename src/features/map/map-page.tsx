import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, CalendarRange, List, Loader2, MapPinOff, Route, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { ObjectPicker } from '@/components/object-picker'
import { PersonChip } from '@/components/person-chip'
import { ErrorState } from '@/components/states'
import { api } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { useObjectById } from '@/lib/queries'
import { getPref, usePref } from '@/lib/prefs'
import { profileName } from '@/lib/format'
import type { Person, Place } from '@/lib/types'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import {
  hasYearIn,
  useIsDark,
  usePlaceCoordinates,
  usePlaceYears,
  validCoords,
  type PlacePoint,
  type TimelineItem,
} from './data'
import { MapView, type LifeStop, type MapApi, type Viewport } from './map-view'
import { PlaceDetails } from './place-panel'

export function MapPage() {
  const { t } = useTranslation(['map', 'common'])
  useTitle(t('common:nav.map'))
  const [params, setParams] = useSearchParams()
  const personId = params.get('person')
  const placeId = params.get('place')
  const isMobile = useIsMobile()
  const dark = useIsDark()
  const apiRef = useRef<MapApi | null>(null)

  const coords = usePlaceCoordinates()
  const byHandle = useMemo(() => new Map((coords.data ?? []).map((p) => [p.handle, p])), [coords.data])

  const [, setViewport] = usePref<Viewport | null>('map.viewport', null)
  const [initialView] = useState(() => getPref<Viewport | null>('map.viewport', null))
  const [selected, setSelected] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  /* ---------- time filter ---------- */
  const [timeOn, setTimeOn] = useState(false)
  const years = usePlaceYears(timeOn)
  const [range, setRange] = useState<[number, number] | null>(null)
  const activeRange = timeOn && years.data && range ? range : null
  useEffect(() => {
    if (timeOn && years.data && !range) setRange([years.data.min, years.data.max])
  }, [timeOn, years.data, range])

  const visiblePlaces = useMemo<PlacePoint[]>(() => {
    const all = coords.data ?? []
    if (!activeRange || !years.data) return all
    return all.filter((p) => hasYearIn(years.data.byPlace.get(p.handle), activeRange[0], activeRange[1]))
  }, [coords.data, activeRange, years.data])

  /* ---------- ?place= ---------- */
  const placeQ = useObjectById<Place>('place', placeId ?? undefined, { keys: 'handle,gramps_id,lat,long', profile: '' })
  const placeHandle = placeQ.data?.handle
  useEffect(() => {
    if (!placeHandle) return
    setSelected(placeHandle)
    setSheetOpen(true)
    const c = byHandle.get(placeHandle)
    if (c) apiRef.current?.flyTo(c.long, c.lat, 11)
  }, [placeHandle, byHandle])

  /* ---------- ?person= ---------- */
  const life = usePersonLife(personId, byHandle)
  useEffect(() => {
    if (!life.points.length) return
    apiRef.current?.fit(life.points.map((p) => [p.long, p.lat]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [life.key])

  /* ---------- first visit: show everything ---------- */
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || initialView || personId || placeId || !coords.data?.length) return
    fitted.current = true
    apiRef.current?.fit(coords.data.map((p) => [p.long, p.lat]), 6)
  }, [coords.data, initialView, personId, placeId])

  const select = (handle: string | null) => {
    setSelected(handle)
    if (handle) setSheetOpen(true)
  }

  const focusPlace = (handle: string) => {
    select(handle)
    const c = byHandle.get(handle)
    if (c) apiRef.current?.flyTo(c.long, c.lat, 11)
  }

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'person') next.delete('place')
    setParams(next, { replace: true })
  }

  const personMode = !!personId
  const panelBody: ReactNode = selected ? (
    <div>
      {personMode && (
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => setSelected(null)}>
          <ArrowLeft />
          {t('backToLife')}
        </Button>
      )}
      <PlaceDetails handle={selected} range={activeRange} />
    </div>
  ) : personMode ? (
    <LifePanel life={life} onFocus={focusPlace} onClose={() => setParam('person', null)} />
  ) : null

  return (
    <div className="relative h-[calc(100svh-3.5rem)] overflow-hidden bg-muted">
      <MapView
        places={personMode ? [] : visiblePlaces}
        showPlaces={!personMode}
        selected={selected}
        onSelect={select}
        lifeStops={personMode ? life.stops : null}
        lifeLine={personMode ? life.line : null}
        dark={dark}
        initialView={initialView}
        onViewChange={setViewport}
        apiRef={apiRef}
      />

      {/* toolbar */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex flex-wrap items-start gap-2 md:right-auto">
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border bg-card/95 p-1 shadow-sm backdrop-blur">
          <ObjectPicker
            kinds={['place']}
            placeholder={t('searchPlace')}
            onChange={(o) => {
              const c = validCoords(o.object?.lat, o.object?.long) ?? (() => {
                const p = byHandle.get(o.handle)
                return p ? ([p.lat, p.long] as [number, number]) : null
              })()
              if (personMode) setParam('person', null)
              setSelected(o.handle)
              setSheetOpen(true)
              if (c) apiRef.current?.flyTo(c[1], c[0], 11)
              else toast.info(t('noCoordinates', { name: o.title }))
            }}
            trigger={
              <Button variant="ghost" className="w-52 justify-start font-normal text-muted-foreground sm:w-64">
                <Search />
                <span className="truncate">{t('searchPlace')}</span>
              </Button>
            }
          />
          <ObjectPicker
            kinds={['person']}
            placeholder={t('pickPerson')}
            onChange={(o) => {
              setSelected(null)
              setParam('person', o.gramps_id)
              setSheetOpen(true)
            }}
            trigger={
              <Button variant={personMode ? 'secondary' : 'ghost'} size="icon" aria-label={t('lifePlaces')}>
                <Route />
              </Button>
            }
          />
          {!personMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={timeOn ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-pressed={timeOn}
                  aria-label={t('timeFilter')}
                  onClick={() => {
                    setTimeOn((v) => !v)
                    setRange(null)
                  }}
                >
                  <CalendarRange />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('timeFilter')}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {(coords.isLoading || life.loading) && (
          <div className="pointer-events-auto flex h-10 items-center gap-2 rounded-xl border bg-card/95 px-3 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="size-4 animate-spin" />
            {t('loading')}
          </div>
        )}
        {isMobile && personMode && !sheetOpen && (
          <Button className="pointer-events-auto h-10 shadow-sm" variant="outline" onClick={() => setSheetOpen(true)}>
            <List />
            {t('showList')}
          </Button>
        )}
      </div>

      {coords.isError && (
        <div className="absolute inset-x-3 top-20 z-10 mx-auto max-w-md rounded-xl border bg-card shadow-sm">
          <ErrorState error={coords.error} onRetry={() => coords.refetch()} />
        </div>
      )}

      {coords.data && coords.data.length === 0 && !personMode && (
        <div className="absolute inset-x-3 top-20 z-10 mx-auto max-w-sm rounded-xl border bg-card p-5 text-center shadow-sm">
          <MapPinOff className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 font-serif text-lg">{t('noPlaces')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('noPlacesHint')}</p>
        </div>
      )}

      {/* side panel (desktop) / bottom sheet (mobile) */}
      {panelBody &&
        (isMobile ? (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="max-h-[75svh] gap-0 overflow-y-auto rounded-t-2xl px-4 pb-6">
              <SheetHeader className="px-0">
                <SheetTitle className="sr-only">{selected ? t('placeDetails') : t('lifePlaces')}</SheetTitle>
                <SheetDescription className="sr-only">{t('panelDescription')}</SheetDescription>
              </SheetHeader>
              {panelBody}
            </SheetContent>
          </Sheet>
        ) : (
          <aside className="absolute bottom-3 left-3 top-[4.25rem] z-10 flex w-[22rem] flex-col overflow-hidden rounded-xl border bg-card/97 shadow-md backdrop-blur">
            {selected && !personMode && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-2 z-10"
                aria-label={t('common:actions.close')}
                onClick={() => setSelected(null)}
              >
                <X />
              </Button>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{panelBody}</div>
          </aside>
        ))}

      {/* time range */}
      {timeOn && !personMode && (
        <div
          className={cn(
            'absolute bottom-3 z-10 rounded-xl border bg-card/95 p-3 shadow-md backdrop-blur',
            isMobile ? 'inset-x-3 bottom-10' : selected ? 'left-[23.5rem] right-16' : 'left-1/2 w-[min(36rem,calc(100%-8rem))] -translate-x-1/2',
          )}
        >
          {years.isLoading || !range || !years.data ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('loadingEvents')}
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-baseline gap-2 text-sm">
                <span className="font-serif text-lg tabular-nums text-brass">
                  {range[0]} – {range[1]}
                </span>
                <span className="text-muted-foreground">{t('placesShown', { count: visiblePlaces.length })}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  className="ml-auto"
                  onClick={() => {
                    setTimeOn(false)
                    setRange(null)
                  }}
                >
                  {t('common:actions.clear')}
                </Button>
              </div>
              <Slider
                min={years.data.min}
                max={years.data.max}
                step={1}
                minStepsBetweenThumbs={0}
                value={range}
                onValueChange={(v) => setRange([v[0], v[1]] as [number, number])}
                aria-label={t('timeFilter')}
              />
              <div className="mt-1.5 flex justify-between text-xs tabular-nums text-muted-foreground">
                <span>{years.data.min}</span>
                <span>{years.data.max}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- a person's life on the map ---------------- */

interface LifeEntry {
  item: TimelineItem
  number: number | null
  placeHandle?: string
}

interface Life {
  key: string
  loading: boolean
  error: unknown
  refetch: () => void
  person: Person | undefined
  entries: LifeEntry[]
  stops: LifeStop[]
  line: Array<[number, number]>
  points: PlacePoint[]
}

function usePersonLife(personId: string | null, byHandle: Map<string, PlacePoint>): Life {
  const personQ = useObjectById<Person>('person', personId ?? undefined, {
    keys: 'handle,gramps_id,profile,media_list',
    profile: 'self',
  })
  const handle = personQ.data?.handle
  const tl = useQuery({
    queryKey: ['people', handle, 'timeline', 'self', apiLocale()],
    enabled: !!handle,
    queryFn: () =>
      api<TimelineItem[]>(`/people/${handle}/timeline`, {
        query: { locale: apiLocale(), discard_empty: false, precision: 1 },
      }),
  })

  return useMemo(() => {
    const own = (tl.data ?? []).filter((i) => i.person?.relationship === 'self')
    const dated = own.filter((i) => i.date)
    const undated = own.filter((i) => !i.date)
    const entries: LifeEntry[] = []
    const stopsMap = new Map<string, LifeStop>()
    const line: Array<[number, number]> = []
    const points: PlacePoint[] = []
    let n = 0
    for (const item of [...dated, ...undated]) {
      const ph = item.place?.handle
      const c = ph ? byHandle.get(ph) : undefined
      if (!c) {
        entries.push({ item, number: null, placeHandle: ph })
        continue
      }
      n += 1
      entries.push({ item, number: n, placeHandle: ph })
      const stop = stopsMap.get(c.handle)
      if (stop) stop.numbers.push(n)
      else stopsMap.set(c.handle, { handle: c.handle, lat: c.lat, long: c.long, numbers: [n] })
      if (item.date) {
        const last = line[line.length - 1]
        if (!last || last[0] !== c.long || last[1] !== c.lat) line.push([c.long, c.lat])
      }
      points.push(c)
    }
    return {
      key: `${handle ?? ''}:${points.length}`,
      loading: personQ.isLoading || tl.isLoading,
      error: personQ.error ?? tl.error,
      refetch: () => {
        personQ.refetch()
        tl.refetch()
      },
      person: personQ.data,
      entries,
      stops: [...stopsMap.values()],
      line,
      points,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl.data, tl.isLoading, tl.error, personQ.data, personQ.isLoading, personQ.error, byHandle, handle])
}

function LifePanel({ life, onFocus, onClose }: { life: Life; onFocus: (h: string) => void; onClose: () => void }) {
  const { t } = useTranslation(['map', 'common'])
  if (life.error) return <ErrorState error={life.error} onRetry={life.refetch} />
  const person = life.person
  return (
    <div>
      <div className="flex items-start gap-2">
        {person?.profile ? (
          <PersonChip person={person.profile} mediaRef={person.media_list?.[0]} size={44} className="-ml-2 min-w-0 flex-1" />
        ) : (
          <Skeleton className="h-12 flex-1" />
        )}
        <Button variant="ghost" size="icon-sm" aria-label={t('common:actions.close')} onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="mt-4 flex items-baseline gap-2 border-b pb-1.5">
        <h2 className="text-lg font-medium">{t('lifePlaces')}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{life.stops.length}</span>
      </div>
      {life.loading && (
        <div className="space-y-2 py-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      {!life.loading && life.entries.length === 0 && (
        <p className="py-4 text-sm text-muted-foreground">
          {t('noLifeEvents', { name: profileName(person?.profile) })}
        </p>
      )}
      <ol className="relative mt-1">
        {life.entries.map(({ item, number, placeHandle }) => {
          const placeName = item.place?.display_name || item.place?.name
          const body = (
            <>
              <span
                className={cn(
                  'mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums',
                  number ? 'bg-brass text-brass-foreground' : 'border border-dashed text-muted-foreground',
                )}
              >
                {number ?? '·'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-medium">{item.label || item.type}</span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{item.date || '—'}</span>
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {placeName || t('noPlace')}
                  {placeName && !number && <span className="ml-1 text-xs">({t('notOnMap')})</span>}
                </span>
              </span>
            </>
          )
          return (
            <li key={item.handle}>
              {placeHandle ? (
                <button
                  type="button"
                  onClick={() => onFocus(placeHandle)}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-3 px-2 py-2 opacity-70">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
