import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowUpRight, Building2, Check, Globe, Layers, Loader2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { AdaptivePopover } from '@/components/adaptive-popover'
import { useDebounced } from '@/components/command-search'
import { mediaThumbUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { emptyObject, errorMessage, toWritable, txGrampsId, type Transaction } from '@/features/editor/lib'
import { useCreateObjectsMutation } from '@/api/enhanced/objects'
import { toApiError } from '@/api/enhanced/editor'
import { cn } from '@/lib/utils'
import { useTypeLabels } from '@/features/timeline/data'
import {
  FARM_TYPES,
  WIKIDATA_MIN_ZOOM,
  queryWikidataBuildings,
  queryWikidataTypes,
  searchNominatim,
  type BaseLayer,
  type Bounds,
  type ExternalHit,
  type MapOverlay,
  type VectorFile,
  type WikidataBuilding,
} from './layers'

export interface LayerPrefs {
  base: BaseLayer
  /** handles of overlays (historic maps, place files) switched off */
  hidden: string[]
  /** Wikidata buildings layer (off by default) */
  buildings?: boolean
}

/** Base map (today / historic) and overlays (historic maps, files of the selected place). */
export function LayersMenu({
  prefs,
  onChange,
  overlays,
  vectors,
  buildingsStatus,
}: {
  prefs: LayerPrefs
  onChange: (p: LayerPrefs) => void
  overlays: MapOverlay[]
  vectors: VectorFile[]
  /** hint next to the buildings layer, e.g. "zoom in" */
  buildingsStatus?: string
}) {
  const { t } = useTranslation('map')
  const [open, setOpen] = useState(false)
  const toggle = (handle: string, on: boolean) =>
    onChange({ ...prefs, hidden: on ? prefs.hidden.filter((h) => h !== handle) : [...prefs.hidden, handle] })
  const row = (handle: string, label: string, thumb?: boolean, status?: string) => (
    <label key={handle} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
      <Checkbox checked={!prefs.hidden.includes(handle)} onCheckedChange={(v) => toggle(handle, !!v)} />
      {thumb && <img src={mediaThumbUrl(handle, 64, { square: true })} alt="" className="size-8 rounded object-cover" />}
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
    </label>
  )
  return (
    <AdaptivePopover
      open={open}
      onOpenChange={setOpen}
      title={t('layers.title')}
      align="start"
      className="w-80 p-2"
      trigger={
        <Button variant={prefs.base === 'ohm' ? 'secondary' : 'ghost'} size="icon" aria-label={t('layers.title')}>
          <Layers />
        </Button>
      }
    >
      <div className="space-y-3 pb-2">
        <div>
          <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{t('layers.base')}</div>
          {(['base', 'ohm'] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={prefs.base === b}
              onClick={() => onChange({ ...prefs, base: b })}
              className="flex min-h-10 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="min-w-0 flex-1">
                <span className="block">{t(`layers.${b === 'base' ? 'today' : 'ohm'}`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`layers.${b === 'base' ? 'today' : 'ohm'}Hint`)}</span>
              </span>
              {prefs.base === b && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>
        {overlays.length > 0 && (
          <div>
            <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{t('layers.historicMaps')}</div>
            {overlays.map((o) => row(o.handle, o.desc || o.gramps_id, true))}
          </div>
        )}
        <div>
          <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{t('layers.external')}</div>
          <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
            <Checkbox checked={!!prefs.buildings} onCheckedChange={(v) => onChange({ ...prefs, buildings: !!v })} />
            <Building2 className="size-4 text-lineage" />
            <span className="min-w-0 flex-1 truncate text-sm">{t('layers.buildings')}</span>
            {prefs.buildings && buildingsStatus && <span className="text-xs text-muted-foreground">{buildingsStatus}</span>}
          </label>
        </div>
        {vectors.length > 0 && (
          <div>
            <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">{t('layers.placeFiles')}</div>
            {vectors.map((v) => row(v.handle, v.desc || v.gramps_id, false, v.data ? undefined : t('layers.unreadable')))}
          </div>
        )}
      </div>
    </AdaptivePopover>
  )
}

/** Search any place in the world (OpenStreetMap Nominatim) and move the map there. */
export function ExternalSearch({ onPick }: { onPick: (hit: ExternalHit) => void }) {
  const { t, i18n } = useTranslation('map')
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 450)
  const [state, setState] = useState<{ loading: boolean; hits: ExternalHit[]; error: string | null }>({
    loading: false,
    hits: [],
    error: null,
  })
  useEffect(() => {
    if (dq.length < 2) {
      setState({ loading: false, hits: [], error: null })
      return
    }
    const ctl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    searchNominatim(dq, i18n.language, ctl.signal)
      .then((hits) => setState({ loading: false, hits, error: null }))
      .catch((e: { name?: string; status?: number }) => {
        if (e?.name === 'AbortError') return
        setState({ loading: false, hits: [], error: e?.status === 429 ? t('external.tooMany') : t('external.failed') })
      })
    return () => ctl.abort()
  }, [dq, i18n.language, t])
  return (
    <AdaptivePopover
      open={open}
      onOpenChange={setOpen}
      title={t('external.title')}
      align="start"
      size="tall"
      className="w-[min(24rem,calc(100vw-2rem))] p-0"
      trigger={
        <Button variant="ghost" size="icon" aria-label={t('external.title')}>
          <Globe />
        </Button>
      }
    >
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('external.placeholder')}
            className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          {state.loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {state.error && <p className="px-3 py-4 text-sm text-destructive">{state.error}</p>}
          {!state.error && dq.length >= 2 && !state.loading && state.hits.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground">{t('common:noResults')}</p>
          )}
          {state.hits.map((h, i) => (
            <button
              key={`${h.lat},${h.long},${i}`}
              type="button"
              className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent"
              onClick={() => {
                onPick(h)
                setOpen(false)
              }}
            >
              <span className="text-sm font-medium">{h.name || h.display_name}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{h.display_name}</span>
            </button>
          ))}
        </div>
        <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">{t('external.attribution')}</p>
      </div>
    </AdaptivePopover>
  )
}

/** Event type chips with counts (multi-select). */
export function EventTypeChips({
  counts,
  value,
  onChange,
}: {
  counts: Array<[string, number]>
  value: string[]
  onChange: (types: string[]) => void
}) {
  const { t } = useTranslation('map')
  const [all, setAll] = useState(false)
  const label = useTypeLabels(counts.map(([k]) => k))
  const shown = all ? counts : counts.slice(0, 6)
  const chip = (on: boolean) =>
    cn(
      'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 max-md:h-9',
      on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
    )
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('eventTypes')}>
      {shown.map(([type, n]) => {
        const on = value.includes(type)
        return (
          <button
            key={type}
            type="button"
            aria-pressed={on}
            className={chip(on)}
            onClick={() => onChange(on ? value.filter((x) => x !== type) : [...value, type])}
          >
            {label(type)}
            <span className="tabular-nums opacity-70">{n}</span>
          </button>
        )
      })}
      {counts.length > 6 && (
        <button type="button" className={cn(chip(false), 'text-muted-foreground')} onClick={() => setAll((v) => !v)}>
          {all ? t('fewerTypes') : t('moreTypes', { count: counts.length - 6 })}
        </button>
      )}
    </div>
  )
}

/** Wikidata buildings in (a padded copy of) the viewport, from zoom 14; debounced while panning. */
export function useWikidataBuildings(enabled: boolean, bounds: Bounds | null, zoom: number, lang: string) {
  const [state, setState] = useState<{ buildings: WikidataBuilding[]; loading: boolean; error: boolean }>({
    buildings: [],
    loading: false,
    error: false,
  })
  const fetched = useRef<{ b: Bounds; lang: string } | null>(null)
  useEffect(() => {
    if (!enabled || !bounds || zoom < WIKIDATA_MIN_ZOOM) return
    const f = fetched.current
    if (f && f.lang === lang && f.b.west <= bounds.west && f.b.south <= bounds.south && f.b.east >= bounds.east && f.b.north >= bounds.north)
      return
    const dx = (bounds.east - bounds.west) * 0.25
    const dy = (bounds.north - bounds.south) * 0.25
    const padded = { west: bounds.west - dx, south: bounds.south - dy, east: bounds.east + dx, north: bounds.north + dy }
    const ctl = new AbortController()
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: false }))
      queryWikidataBuildings(padded, lang, ctl.signal)
        .then((r) => {
          fetched.current = r.truncated ? null : { b: padded, lang }
          setState({ buildings: r.buildings, loading: false, error: false })
        })
        .catch((e: { name?: string }) => {
          if (e?.name !== 'AbortError') setState((s) => ({ ...s, loading: false, error: true }))
        })
    }, 400)
    return () => {
      clearTimeout(timer)
      ctl.abort()
    }
  }, [enabled, bounds, zoom, lang])
  return state
}

/** A Wikidata building: dates, links, the matching Gramps place or "add as place". */
export function BuildingPanel({
  building,
  placeHandle,
  onOpenPlace,
}: {
  building: WikidataBuilding
  placeHandle: string | null
  onOpenPlace: (handle: string) => void
}) {
  const { t } = useTranslation(['map', 'common'])
  const { can } = useAuth()
  const [postObjects] = useCreateObjectsMutation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const years = [
    building.inceptionYear !== null ? t('building.built', { year: building.inceptionYear }) : null,
    building.demolishedYear !== null ? t('building.demolished', { year: building.demolishedYear }) : null,
  ].filter(Boolean)
  const addPlace = async () => {
    setBusy(true)
    try {
      const types = await queryWikidataTypes(building.qid).catch(() => [] as string[])
      const place: Record<string, unknown> & { handle: string } = {
        ...(emptyObject('place') as { handle: string }),
        name: { _class: 'PlaceName', value: building.label === building.qid ? '' : building.label, lang: '' },
        place_type: types.some((q) => FARM_TYPES.includes(q)) ? 'Farm' : 'Building',
        lat: String(building.lat),
        long: String(building.long),
        urls: [{ _class: 'Url', path: `https://www.wikidata.org/wiki/${building.qid}`, desc: 'Wikidata', type: 'Web Home', private: false }],
      }
      // the map's places refresh through the transaction's cache tags
      const tx = await postObjects([toWritable('place', place)]).unwrap()
      const id = txGrampsId(tx as Transaction, place.handle)
      toast.success(t('building.added'))
      if (id) navigate(`/place/${id}`)
    } catch (e) {
      toast.error(errorMessage(toApiError(e)))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-lineage/15 text-lineage">
          <Building2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1 pr-8">
          <h2 className="text-2xl font-medium leading-tight">{building.label}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{years.length ? years.join(' · ') : t('building.noDates')}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {placeHandle && (
          <Button size="sm" onClick={() => onOpenPlace(placeHandle)}>
            {t('building.showPlace')}
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <a href={`https://www.wikidata.org/wiki/${building.qid}`} target="_blank" rel="noreferrer">
            Wikidata
            <ArrowUpRight />
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`https://domus.genealogy.net/map/?id=${building.qid}`} target="_blank" rel="noreferrer">
            Domus
            <ArrowUpRight />
          </a>
        </Button>
        {!placeHandle && can('AddObject') && (
          <Button size="sm" onClick={addPlace} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />}
            {t('building.addPlace')}
          </Button>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t('building.source')}</p>
    </div>
  )
}
