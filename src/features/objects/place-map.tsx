import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, MapPin } from 'lucide-react'
import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl'
import { cn } from '@/lib/utils'

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty'
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark'

/** Tracks the `.dark` class on <html> (set by the theme provider). */
export function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setDark(el.classList.contains('dark')))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

/** Parse a coordinate pair; returns null for missing / zero / out-of-range values. */
export function coords(lat: unknown, lng: unknown): [number, number] | null {
  const a = typeof lat === 'number' ? lat : parseFloat(String(lat ?? ''))
  const b = typeof lng === 'number' ? lng : parseFloat(String(lng ?? ''))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a === 0 && b === 0) return null
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null
  return [a, b]
}

/**
 * Small map with one marker. maplibre-gl is loaded on demand so pages without
 * coordinates never pay for it. Interaction is limited to zoom buttons and
 * drag; scroll zoom stays off so the page scrolls normally.
 */
export function PlaceMap({
  lat,
  lng,
  label,
  zoom = 10,
  className,
}: {
  lat: number
  lng: number
  label?: string
  zoom?: number
  className?: string
}) {
  const { t } = useTranslation('objects')
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markerRef = useRef<MlMarker | null>(null)
  const dark = useIsDark()
  const [failed, setFailed] = useState(false)
  const styleUrl = dark ? STYLE_DARK : STYLE_LIGHT

  // create once
  useEffect(() => {
    let cancelled = false
    let map: MlMap | null = null
    void (async () => {
      try {
        const [ml] = await Promise.all([import('maplibre-gl'), import('@/features/map/maplibre')])
        if (cancelled || !ref.current) return
        map = new ml.Map({
          container: ref.current,
          style: styleUrl,
          center: [lng, lat],
          zoom,
          attributionControl: { compact: true },
          scrollZoom: false,
          // on touch screens a one-finger drag must keep scrolling the page
          dragPan: !window.matchMedia('(pointer: coarse)').matches,
          dragRotate: false,
          pitchWithRotate: false,
          touchZoomRotate: false,
          cooperativeGestures: false,
        })
        map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
        const el = document.createElement('div')
        el.className = 'place-map-marker'
        el.style.cssText =
          'width:18px;height:18px;border-radius:9999px;background:var(--primary);border:3px solid var(--background);box-shadow:0 1px 4px rgb(0 0 0 / .35)'
        markerRef.current = new ml.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)
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
  }, [])

  // follow coordinate changes (navigating between places reuses the component)
  useEffect(() => {
    mapRef.current?.jumpTo({ center: [lng, lat], zoom })
    markerRef.current?.setLngLat([lng, lat])
  }, [lat, lng, zoom])

  // follow theme
  useEffect(() => {
    mapRef.current?.setStyle(styleUrl)
  }, [styleUrl])

  const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${Math.max(zoom, 12)}/${lat}/${lng}`

  return (
    <figure className={cn('overflow-hidden rounded-xl border bg-muted', className)}>
      <div className="relative h-56 w-full">
        <div ref={ref} className="absolute! inset-0" aria-label={label ? t('mapOf', { name: label }) : t('map')} role="img" />
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            <MapPin className="mr-2 size-4" />
            {t('mapUnavailable')}
          </div>
        )}
      </div>
      <figcaption className="flex items-center gap-2 border-t bg-card px-3 py-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
        <a href={osm} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 hover:text-foreground">
          OpenStreetMap
          <ExternalLink className="size-3" />
        </a>
      </figcaption>
    </figure>
  )
}
