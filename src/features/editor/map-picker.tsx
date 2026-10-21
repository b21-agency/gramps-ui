import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import type { Map as MlMap, Marker as MlMarker } from 'maplibre-gl'

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty'
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark'

/** Click (or drag the marker) to choose coordinates. maplibre-gl is loaded on demand. */
export function MapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null
  lng: number | null
  onPick: (lat: number, lng: number) => void
}) {
  const { t } = useTranslation('editor')
  const ref = useRef<HTMLDivElement>(null)
  const markerRef = useRef<MlMarker | null>(null)
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let map: MlMap | null = null
    void (async () => {
      try {
        const [ml] = await Promise.all([import('maplibre-gl'), import('@/features/map/maplibre')])
        if (cancelled || !ref.current) return
        const has = lat != null && lng != null
        map = new ml.Map({
          container: ref.current,
          style: document.documentElement.classList.contains('dark') ? STYLE_DARK : STYLE_LIGHT,
          center: has ? [lng!, lat!] : [13, 48],
          zoom: has ? 11 : 4,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
        })
        map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
        const el = document.createElement('div')
        el.style.cssText =
          'width:20px;height:20px;border-radius:9999px;background:var(--primary);border:3px solid var(--background);box-shadow:0 1px 4px rgb(0 0 0 / .35);cursor:grab'
        const marker = new ml.Marker({ element: el, draggable: true })
        if (has) marker.setLngLat([lng!, lat!]).addTo(map)
        marker.on('dragend', () => {
          const p = marker.getLngLat()
          pickRef.current(p.lat, p.lng)
        })
        map.on('click', (e) => {
          marker.setLngLat(e.lngLat).addTo(map!)
          pickRef.current(e.lngLat.lat, e.lngLat.lng)
        })
        map.on('error', () => {})
        markerRef.current = marker
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      map?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border bg-muted sm:h-80">
      <div ref={ref} className="absolute! inset-0" aria-label={t('place.mapHint')} />
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          <MapPin className="mr-2 size-4" />
          {t('place.mapUnavailable')}
        </div>
      )}
    </div>
  )
}
