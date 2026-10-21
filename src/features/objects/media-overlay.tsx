import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Trash2 } from 'lucide-react'
import type { Map as MlMap } from 'maplibre-gl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { mediaThumbUrl } from '@/lib/api'
import { useAccessToken } from '@/lib/auth'
import { Field, FormSection } from '@/features/editor/fields'
import type { AnyObj } from '@/features/editor/lib'
import { useIsDark } from './place-map'

const MapPicker = lazy(async () => ({ default: (await import('@/features/editor/map-picker')).MapPicker }))

/** `[[south, west], [north, east]]`, as stored by Gramps Web in the `map:bounds` attribute. */
export type Bounds = [[number, number], [number, number]]
export const BOUNDS_ATTR = 'map:bounds'

const typeOf = (a: AnyObj) => (typeof a.type === 'string' ? a.type : (a.type?.string ?? ''))

export function parseBounds(attrs: AnyObj[] | undefined): Bounds | null {
  const a = (attrs ?? []).find((x) => typeOf(x) === BOUNDS_ATTR)
  if (!a) return null
  try {
    const b = JSON.parse(a.value)
    if (Array.isArray(b) && b.length === 2 && b.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(n)))) return b as Bounds
  } catch {
    /* not JSON */
  }
  return null
}

function withBounds(attrs: AnyObj[] | undefined, b: Bounds | null): AnyObj[] {
  const rest = (attrs ?? []).filter((x) => typeOf(x) !== BOUNDS_ATTR)
  if (!b) return rest
  const old = (attrs ?? []).find((x) => typeOf(x) === BOUNDS_ATTR)
  return [...rest, { _class: 'Attribute', private: false, citation_list: [], note_list: [], ...old, type: BOUNDS_ATTR, value: JSON.stringify(b) }]
}

/** Map showing a georeferenced image (historic map) on top of the base map. */
export function OverlayMap({ handle, bounds }: { handle: string; bounds: Bounds }) {
  const { t } = useTranslation('objects')
  useAccessToken()
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const dark = useIsDark()
  const [failed, setFailed] = useState(false)
  const [[s, w], [n, e]] = bounds
  const key = JSON.stringify(bounds)

  useEffect(() => {
    let cancelled = false
    let map: MlMap | null = null
    void (async () => {
      try {
        const [ml] = await Promise.all([import('maplibre-gl'), import('@/features/map/maplibre')])
        if (cancelled || !ref.current) return
        map = new ml.Map({
          container: ref.current,
          style: dark ? 'https://tiles.openfreemap.org/styles/dark' : 'https://tiles.openfreemap.org/styles/liberty',
          bounds: [
            [w, s],
            [e, n],
          ],
          fitBoundsOptions: { padding: 20 },
          attributionControl: { compact: true },
          scrollZoom: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchZoomRotate: false,
        })
        map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
        map.on('load', () => {
          map!.addSource('overlay', {
            type: 'image',
            url: mediaThumbUrl(handle, 2048),
            coordinates: [
              [w, n],
              [e, n],
              [e, s],
              [w, s],
            ],
          })
          map!.addLayer({ id: 'overlay', type: 'raster', source: 'overlay', paint: { 'raster-opacity': 0.8 } })
        })
        map.on('error', () => {
          /* tile errors are not fatal */
        })
        mapRef.current = map
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, key, dark])

  return (
    <figure className="overflow-hidden rounded-xl border bg-muted">
      <div className="relative h-64 w-full">
        <div ref={ref} className="absolute! inset-0" role="img" aria-label={t('overlay.title')} />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            <MapPin className="mr-2 size-4" />
            {t('mapUnavailable')}
          </div>
        )}
      </div>
    </figure>
  )
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6

/**
 * Editor section for images: place the picture on the map as a historic map overlay.
 * The top-left corner is chosen on the map; the edges can be fine-tuned numerically.
 */
export function MapOverlayField({ value, onChange }: { value: AnyObj; onChange: (o: AnyObj) => void }) {
  const { t } = useTranslation('objects')
  useAccessToken()
  const [picking, setPicking] = useState(false)
  const bounds = parseBounds(value.attribute_list)
  const set = (b: Bounds | null) => onChange({ ...value, attribute_list: withBounds(value.attribute_list, b) })

  const placeAt = (lat: number, lng: number) => {
    if (bounds) {
      const h = bounds[1][0] - bounds[0][0]
      const w = bounds[1][1] - bounds[0][1]
      set([
        [r6(lat - h), r6(lng)],
        [r6(lat), r6(lng + w)],
      ])
      return
    }
    // first placement: about 2 km wide, keeping the picture's aspect ratio
    const width = 0.03
    const img = new Image()
    img.onload = () => {
      const h = (img.naturalHeight / img.naturalWidth) * width * Math.cos((lat / 180) * Math.PI)
      set([
        [r6(lat - h), r6(lng)],
        [r6(lat), r6(lng + width)],
      ])
    }
    img.onerror = () =>
      set([
        [r6(lat - width), r6(lng)],
        [r6(lat), r6(lng + width)],
      ])
    img.src = mediaThumbUrl(value.handle, 400)
  }

  const edge = (label: string, i: 0 | 1, j: 0 | 1) => (
    <EdgeInput
      label={label}
      value={bounds ? bounds[i][j] : null}
      onCommit={(n) => {
        if (!bounds) return
        const b = bounds.map((p) => [...p]) as Bounds
        b[i][j] = n
        set(b)
      }}
    />
  )

  return (
    <FormSection title={t('overlay.title')} collapsible defaultOpen={!!bounds}>
      <p className="text-sm text-muted-foreground">{t('overlay.hint')}</p>
      <div className="grid grid-cols-2 gap-3">
        {edge(t('overlay.north'), 1, 0)}
        {edge(t('overlay.south'), 0, 0)}
        {edge(t('overlay.west'), 0, 1)}
        {edge(t('overlay.east'), 1, 1)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setPicking(!picking)} aria-expanded={picking}>
          <MapPin /> {t('overlay.pickCorner')}
        </Button>
        {bounds && (
          <Button type="button" variant="ghost" size="sm" onClick={() => set(null)}>
            <Trash2 /> {t('overlay.remove')}
          </Button>
        )}
      </div>
      {picking && (
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <MapPicker lat={bounds ? bounds[1][0] : null} lng={bounds ? bounds[0][1] : null} onPick={(a, b) => placeAt(a, b)} />
        </Suspense>
      )}
      {bounds && !picking && <OverlayMap handle={value.handle} bounds={bounds} />}
    </FormSection>
  )
}

/** Coordinate input that keeps the typed text and applies it when left (or on Enter). */
function EdgeInput({ label, value, onCommit }: { label: string; value: number | null; onCommit: (n: number) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    setText(value == null ? '' : String(value))
  }
  const commit = () => {
    const n = parseFloat(text.replace(',', '.'))
    if (Number.isFinite(n) && n !== value) onCommit(n)
    else setText(value == null ? '' : String(value))
  }
  return (
    <Field label={label}>
      <Input
        inputMode="decimal"
        value={text}
        disabled={value == null}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
      />
    </Field>
  )
}
