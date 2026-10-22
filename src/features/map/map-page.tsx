import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { useGetPersonTimelineQuery } from '@/api/people-api-slice.gen'
import { toast } from 'sonner'
import { ArrowLeft, CalendarRange, List, Loader2, MapPinOff, Route, Search, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { ObjectPicker } from '@/components/object-picker'
import { Portrait } from '@/components/portrait'
import { ErrorState } from '@/components/states'
import { apiLocale } from '@/i18n'
import { useObjectById } from '@/lib/queries'
import { getPref, usePref } from '@/lib/prefs'
import { lifespan, profileName, yearOf } from '@/lib/format'
import type { EventProfile, Person, Place } from '@/lib/types'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import {
  filterPlacesByEvents,
  useIsDark,
  usePlaceCoordinates,
  usePlaceYears,
  validCoords,
  type PlacePoint,
  type TimelineItem,
} from './data'
import { MapView, type LifeStop, type MapApi, type MapRasterOverlay, type MapVectorOverlay, type Viewport } from './map-view'
import { PlaceDetails } from './place-panel'
import { BuildingPanel, EventTypeChips, ExternalSearch, LayersMenu, useWikidataBuildings, type LayerPrefs } from './controls'
import {
  WIKIDATA_MIN_ZOOM,
  existedIn,
  findPlaceAt,
  overlayTileUrl,
  useMapOverlays,
  usePlaceVectors,
  vectorBounds,
  type Bounds,
} from './layers'

const SNAPS = [0.45, 1]

export function MapPage() {
  const { t, i18n } = useTranslation(['map', 'common'])
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
  const [snap, setSnap] = useState<number | string | null>(SNAPS[0])
  // every newly opened sheet starts at the peek height
  useEffect(() => {
    if (sheetOpen) setSnap(SNAPS[0])
  }, [sheetOpen, selected])

  /* ---------- filters: time range + event types ---------- */
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [timeOn, setTimeOn] = useState(false)
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const years = usePlaceYears(filtersOpen || timeOn || eventTypes.length > 0)
  const [range, setRange] = useState<[number, number] | null>(null)
  const activeRange = timeOn && years.data && range ? range : null
  useEffect(() => {
    if (timeOn && years.data && !range) setRange([years.data.min, years.data.max])
  }, [timeOn, years.data, range])

  const visiblePlaces = useMemo<PlacePoint[]>(
    () => filterPlacesByEvents(coords.data ?? [], years.data, activeRange, eventTypes),
    [coords.data, activeRange, years.data, eventTypes],
  )
  const filtering = !!activeRange || eventTypes.length > 0

  /* ---------- layers: base map, historic maps, files of the selected place ---------- */
  const [layerPrefs, setLayerPrefs] = usePref<LayerPrefs>('map.layers', { base: 'base', hidden: [] })
  const [ohmYear, setOhmYear] = useState(() => new Date().getFullYear() - 100)
  const overlaysQ = useMapOverlays()
  const rasterOverlays = useMemo<MapRasterOverlay[]>(
    () =>
      (overlaysQ.data ?? [])
        .filter((o) => !layerPrefs.hidden.includes(o.handle))
        .map((o) => ({ handle: o.handle, tiles: overlayTileUrl(o), bounds: o.bounds })),
    [overlaysQ.data, layerPrefs.hidden],
  )
  const vectorsQ = usePlaceVectors(selected)
  const vectorOverlays = useMemo<MapVectorOverlay[]>(
    () =>
      (vectorsQ.data ?? [])
        .filter((v) => v.data && !layerPrefs.hidden.includes(v.handle))
        .map((v) => ({ handle: v.handle, data: v.data! })),
    [vectorsQ.data, layerPrefs.hidden],
  )
  /* ---------- Wikidata buildings ---------- */
  const [view, setView] = useState<{ b: Bounds; zoom: number } | null>(null)
  const [building, setBuilding] = useState<string | null>(null)
  const wd = useWikidataBuildings(!!layerPrefs.buildings, view?.b ?? null, view?.zoom ?? 0, i18n.language)
  const shownBuildings = useMemo(
    () => (!layerPrefs.buildings ? [] : activeRange ? wd.buildings.filter((b) => existedIn(b, activeRange[0], activeRange[1])) : wd.buildings),
    [layerPrefs.buildings, wd.buildings, activeRange],
  )
  const buildingObj = building ? wd.buildings.find((b) => b.qid === building) : undefined
  const buildingsStatus = !view
    ? undefined
    : view.zoom < WIKIDATA_MIN_ZOOM
      ? t('layers.zoomIn')
      : wd.loading
        ? t('layers.loadingShort')
        : wd.error
          ? t('layers.buildingsFailed')
          : shownBuildings.some((b) => b.long >= view.b.west && b.long <= view.b.east && b.lat >= view.b.south && b.lat <= view.b.north)
            ? undefined
            : t('layers.noBuildings')

  // a place without coordinates: show its files instead
  useEffect(() => {
    if (!selected || byHandle.has(selected) || !vectorOverlays.length) return
    const b = vectorBounds(vectorOverlays.map((v) => v.data))
    if (b) apiRef.current?.fit([b[0], b[1]])
  }, [selected, byHandle, vectorOverlays])

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
    setBuilding(null)
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
  const panelBody: ReactNode = buildingObj ? (
    <BuildingPanel
      building={buildingObj}
      placeHandle={findPlaceAt(coords.data ?? [], buildingObj.lat, buildingObj.long)}
      onOpenPlace={(h) => select(h)}
    />
  ) : selected ? (
    <div>
      {personMode && (
        <Button variant="ghost" size="sm" className="-ml-2 mb-3 h-10 rounded-full" onClick={() => setSelected(null)}>
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
    <div
      className={cn(
        'relative h-[calc(100dvh-3.5rem-var(--tabbar-h))] overflow-hidden bg-muted',
        // MapLibre's own controls as Album glass panels
        '[&_.maplibregl-ctrl-group]:overflow-hidden [&_.maplibregl-ctrl-group]:rounded-2xl! [&_.maplibregl-ctrl-group]:bg-card/90! [&_.maplibregl-ctrl-group]:shadow-[0_12px_32px_-14px_rgb(0_0_0/0.55)]! [&_.maplibregl-ctrl-group]:ring-1 [&_.maplibregl-ctrl-group]:ring-foreground/[0.07] [&_.maplibregl-ctrl-group]:backdrop-blur-xl',
        '[&_.maplibregl-ctrl-group_button]:size-11! [&_.maplibregl-ctrl-group_button+button]:border-foreground/10! [&_.maplibregl-ctrl-group_button:hover]:bg-accent!',
        'dark:[&_.maplibregl-ctrl-icon]:invert dark:[&_.maplibregl-ctrl-icon]:hue-rotate-180 [&_.maplibregl-ctrl-attrib]:rounded-full! [&_.maplibregl-ctrl-attrib]:bg-card/80! [&_.maplibregl-ctrl-attrib]:text-muted-foreground',
      )}
    >
      <MapView
        places={personMode ? [] : visiblePlaces}
        base={layerPrefs.base}
        year={ohmYear}
        lang={i18n.language}
        overlays={rasterOverlays}
        vectors={vectorOverlays}
        buildings={shownBuildings}
        selectedBuilding={building}
        onBuildingClick={(qid) => {
          setSelected(null)
          setBuilding(qid)
          setSheetOpen(true)
        }}
        onBoundsChange={(b, zoom) => setView({ b, zoom })}
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
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl bg-card/95 shadow-[0_12px_32px_-14px_rgb(0_0_0/0.55)] ring-1 ring-foreground/[0.07] backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 p-1 [&_[data-slot=button]]:rounded-xl max-md:[&_[data-slot=button]]:h-11 max-md:[&_[data-slot=button][data-size=icon]]:w-11">
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
                  variant={filtersOpen || filtering ? 'secondary' : 'ghost'}
                  size="icon"
                  aria-pressed={filtersOpen}
                  aria-label={t('filterPlaces')}
                  onClick={() => setFiltersOpen((v) => !v)}
                >
                  <CalendarRange />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('filterPlaces')}</TooltipContent>
            </Tooltip>
          )}
          <LayersMenu
            prefs={layerPrefs}
            onChange={setLayerPrefs}
            overlays={overlaysQ.data ?? []}
            vectors={vectorsQ.data ?? []}
            buildingsStatus={buildingsStatus}
          />
          <ExternalSearch onPick={(h) => apiRef.current?.flyTo(h.long, h.lat, 11)} />
        </div>
        {(coords.isLoading || life.loading) && (
          <div className="pointer-events-auto flex h-11 items-center gap-2 rounded-2xl bg-card/95 shadow-[0_12px_32px_-14px_rgb(0_0_0/0.55)] ring-1 ring-foreground/[0.07] backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 px-3.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('loading')}
          </div>
        )}
        {isMobile && personMode && !sheetOpen && (
          <Button className="pointer-events-auto h-11 rounded-full px-4 shadow-md" onClick={() => setSheetOpen(true)}>
            <List />
            {t('showList')}
          </Button>
        )}
      </div>

      {coords.isError && (
        <div className="absolute inset-x-3 top-20 z-10 mx-auto max-w-md rounded-3xl bg-card shadow-lg">
          <ErrorState error={coords.error} onRetry={() => coords.refetch()} />
        </div>
      )}

      {coords.data && coords.data.length === 0 && !personMode && (
        <div className="absolute inset-x-3 top-20 z-10 mx-auto max-w-sm rounded-3xl bg-card p-6 text-center shadow-lg">
          <MapPinOff className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 font-serif text-2xl">{t('noPlaces')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('noPlacesHint')}</p>
        </div>
      )}

      {/* side panel (desktop) / bottom sheet (mobile) */}
      {panelBody &&
        (isMobile ? (
          // phones: a non-modal sheet with two stops (peek / full) so the map stays usable
          <Drawer
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            modal={false}
            snapPoints={SNAPS}
            activeSnapPoint={snap}
            setActiveSnapPoint={setSnap}
          >
            <DrawerContent
              className="h-[calc(100dvh-var(--header-h)-0.5rem)] max-h-none! rounded-t-3xl border-0 bg-card shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.45)]"
              onInteractOutside={(e) => e.preventDefault()}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <DrawerTitle className="sr-only">{selected ? t('placeDetails') : t('lifePlaces')}</DrawerTitle>
              <DrawerDescription className="sr-only">{t('panelDescription')}</DrawerDescription>
              {(selected || buildingObj) && !personMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 z-10 size-10"
                  aria-label={t('common:actions.close')}
                  onClick={() => setSheetOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              )}
              <div
                className={cn(
                  'min-h-0 flex-1 overscroll-contain px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]',
                  snap === 1 ? 'overflow-y-auto' : 'overflow-hidden',
                )}
              >
                {panelBody}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <aside className="absolute bottom-3 left-3 top-[4.5rem] z-10 flex w-[24rem] flex-col overflow-hidden rounded-3xl bg-card/95 shadow-[0_12px_32px_-14px_rgb(0_0_0/0.55)] ring-1 ring-foreground/[0.07] backdrop-blur-xl supports-[backdrop-filter]:bg-card/80">
            {(selected || buildingObj) && !personMode && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3 z-10 rounded-full bg-card/80 backdrop-blur"
                aria-label={t('common:actions.close')}
                onClick={() => {
                  setSelected(null)
                  setBuilding(null)
                }}
              >
                <X />
              </Button>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{panelBody}</div>
          </aside>
        ))}

      {/* filters (time range, event types) and the year of the historic map */}
      {((filtersOpen && !personMode) || layerPrefs.base === 'ohm') && (
        <div
          className={cn(
            'absolute bottom-3 z-10 max-h-[45dvh] space-y-3 overflow-y-auto rounded-2xl bg-card/95 shadow-[0_12px_32px_-14px_rgb(0_0_0/0.55)] ring-1 ring-foreground/[0.07] backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 p-4',
            isMobile ? 'inset-x-3 bottom-10' : selected || personMode ? 'left-[25.5rem] right-16' : 'left-1/2 w-[min(36rem,calc(100%-8rem))] -translate-x-1/2',
          )}
        >
          {layerPrefs.base === 'ohm' && (
            <div>
              <div className="mb-2 flex items-baseline gap-2 text-sm">
                <span className="text-muted-foreground">{t('layers.mapYear')}</span>
                <span className="font-serif text-lg tabular-nums text-brass">{ohmYear}</span>
                <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setLayerPrefs({ ...layerPrefs, base: 'base' })}>
                  {t('layers.backToToday')}
                </Button>
              </div>
              <Slider
                min={Math.min(years.data?.min ?? 1500, 1500)}
                max={new Date().getFullYear()}
                step={1}
                value={[ohmYear]}
                onValueChange={(v) => setOhmYear(v[0])}
                aria-label={t('layers.mapYear')}
              />
            </div>
          )}
          {filtersOpen && !personMode && (
            <>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-medium">{t('filterPlaces')}</span>
                <span className="text-muted-foreground">
                  {filtering ? t('placesShown', { count: visiblePlaces.length }) : t('allPlaces', { count: coords.data?.length ?? 0 })}
                </span>
                {filtering && (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="ml-auto"
                    onClick={() => {
                      setTimeOn(false)
                      setRange(null)
                      setEventTypes([])
                    }}
                  >
                    {t('common:actions.clear')}
                  </Button>
                )}
              </div>
              {years.isLoading || !years.data ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('loadingEvents')}
                </div>
              ) : (
                <>
                  <div>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={timeOn}
                        onCheckedChange={(on) => {
                          setTimeOn(on)
                          setRange(null)
                        }}
                      />
                      {t('timeFilter')}
                      {timeOn && range && (
                        <span className="ml-auto font-serif text-lg tabular-nums text-brass">
                          {range[0]} – {range[1]}
                        </span>
                      )}
                    </label>
                    {timeOn && range && (
                      <>
                        <Slider
                          className="mt-3"
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
                  {years.data.typeCounts.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-sm text-muted-foreground">{t('eventTypes')}</div>
                      <EventTypeChips counts={years.data.typeCounts} value={eventTypes} onChange={setEventTypes} />
                    </div>
                  )}
                </>
              )}
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
  const tlQ = useGetPersonTimelineQuery(handle ? { handle, locale: apiLocale(), discardEmpty: false, precision: 1 } : skipToken)
  const tl = { ...tlQ, data: tlQ.data as unknown as TimelineItem[] | undefined }

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
        // refetch() throws on a skipped query
        if (personId) personQ.refetch()
        if (handle) tl.refetch()
      },
      person: personQ.data,
      entries,
      stops: [...stopsMap.values()],
      line,
      points,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tl.data, tl.isLoading, tl.error, personQ.data, personQ.isLoading, personQ.error, byHandle, handle, personId])
}

function LifePanel({ life, onFocus, onClose }: { life: Life; onFocus: (h: string) => void; onClose: () => void }) {
  const { t } = useTranslation(['map', 'common'])
  if (life.error) return <ErrorState error={life.error} onRetry={life.refetch} />
  const person = life.person
  return (
    <div>
      <div className="flex items-start gap-4">
        {person?.profile ? (
          <Link to={`/person/${person.gramps_id}`} className="group flex min-w-0 flex-1 items-center gap-4 rounded-2xl outline-none">
            <Portrait mediaRef={person.media_list?.[0]} name={profileName(person.profile)} sex={person.profile.sex} size={72} className="ring-brass/70" />
            <span className="min-w-0">
              <span className="line-clamp-2 font-serif text-[1.75rem] leading-[1.05] font-medium tracking-[-0.01em] group-hover:underline">
                {profileName(person.profile)}
              </span>
              <span className="mt-1 block font-serif text-lg tabular-nums text-brass">
                {lifespan(person.profile.birth as EventProfile, person.profile.death as EventProfile)}
              </span>
            </span>
          </Link>
        ) : (
          <Skeleton className="h-[72px] flex-1 rounded-2xl" />
        )}
        <Button variant="ghost" size="icon" className="-mt-1 -mr-2 shrink-0 rounded-full" aria-label={t('common:actions.close')} onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="mt-7 mb-3 flex items-baseline gap-2">
        <h2 className="font-serif text-2xl font-medium">{t('lifePlaces')}</h2>
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
      <ol className="relative">
        {life.entries.length > 0 && <span aria-hidden className="absolute top-4 bottom-4 left-[4.44rem] w-0.5 rounded-full bg-lineage/70" />}
        {life.entries.map(({ item, number, placeHandle }, i) => {
          const placeName = item.place?.display_name || item.place?.name
          const year = yearOf(item.date)
          const showYear = i === 0 || yearOf(life.entries[i - 1].item.date) !== year
          const body = (
            <>
              <span className={cn('w-12 shrink-0 pt-1 text-right font-serif text-xl leading-none tabular-nums text-brass', !showYear && 'invisible')}>
                {year ?? '—'}
              </span>
              <span
                className={cn(
                  'relative z-10 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums ring-4 ring-card',
                  number ? 'bg-brass text-brass-foreground' : 'bg-secondary text-muted-foreground',
                )}
              >
                {number ?? '·'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[15px] font-semibold">{item.label || item.type}</span>
                  {item.date && item.date !== String(year) && (
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{item.date}</span>
                  )}
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
                  className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-xl px-2 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-accent/70 focus-visible:bg-accent"
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-3 py-2.5 opacity-70">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
