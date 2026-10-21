// Pan/zoom surface. d3-zoom handles wheel, drag and pinch; the transform is written straight to
// one container's style so panning never re-renders React.
import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from 'react'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from 'd3-zoom'
import type { Bounds } from './layout'

export interface View {
  x: number
  y: number
  k: number
}

export interface CanvasApi {
  get: () => View
  set: (v: View, animate?: boolean) => void
  zoomBy: (factor: number) => void
  size: () => { w: number; h: number }
  /** World -> viewport coordinates. */
  toScreen: (x: number, y: number) => [number, number]
  /** Pans just enough to make the world rectangle visible. */
  reveal: (b: Bounds) => void
  /** View that fits the bounds, optionally capping the scale. */
  fitView: (b: Bounds, maxK?: number, pad?: number) => View
  element: () => HTMLDivElement | null
}

export const MIN_K = 0.12
export const MAX_K = 2.5

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function ZoomCanvas({
  children,
  api,
  className,
  onKeyDown,
  overlay,
}: {
  children: ReactNode
  api: Ref<CanvasApi>
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  overlay?: ReactNode
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const behaviour = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null)
  const view = useRef<View>({ x: 0, y: 0, k: 1 })
  const anim = useRef<number | null>(null)

  useEffect(() => {
    const el = viewport.current!
    let idle: number | undefined
    const z = d3zoom<HTMLDivElement, unknown>()
      .scaleExtent([MIN_K, MAX_K])
      .clickDistance(6)
      .tapDistance(12)
      .filter((event: Event) => {
        const e = event as MouseEvent & WheelEvent
        // Leave toolbar-like controls inside the canvas alone.
        if ((e.target as Element)?.closest?.('[data-no-pan]')) return false
        return (!e.ctrlKey || e.type === 'wheel') && !e.button
      })
      .wheelDelta((event: WheelEvent) => -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002) * (event.ctrlKey ? 5 : 1))
      .on('start', (e: D3ZoomEvent<HTMLDivElement, unknown>) => {
        if (e.sourceEvent && anim.current) {
          cancelAnimationFrame(anim.current)
          anim.current = null
        }
        layer.current?.style.setProperty('will-change', 'transform')
        if (e.sourceEvent?.type === 'mousedown') el.dataset.dragging = 'true'
      })
      .on('zoom', (e: D3ZoomEvent<HTMLDivElement, unknown>) => {
        const { x, y, k } = e.transform
        view.current = { x, y, k }
        if (layer.current) layer.current.style.transform = `translate3d(${x}px,${y}px,0) scale(${k})`
      })
      .on('end', () => {
        delete el.dataset.dragging
        window.clearTimeout(idle)
        // drop will-change after a gesture so text is re-rasterised crisply
        idle = window.setTimeout(() => layer.current?.style.removeProperty('will-change'), 150)
      })
    behaviour.current = z
    const sel = select(el)
    sel.call(z).on('dblclick.zoom', null)
    // Browsers scroll overflow:hidden boxes when a focused child is off-screen; undo that.
    const onScroll = () => {
      if (el.scrollLeft || el.scrollTop) {
        el.scrollLeft = 0
        el.scrollTop = 0
      }
    }
    el.addEventListener('scroll', onScroll)
    return () => {
      sel.on('.zoom', null)
      el.removeEventListener('scroll', onScroll)
      window.clearTimeout(idle)
      if (anim.current) cancelAnimationFrame(anim.current)
    }
  }, [])

  useImperativeHandle(api, () => {
    const apply = (v: View) => {
      const el = viewport.current
      if (el && behaviour.current) behaviour.current.transform(select(el), zoomIdentity.translate(v.x, v.y).scale(v.k))
    }
    const size = () => ({ w: viewport.current?.clientWidth ?? 800, h: viewport.current?.clientHeight ?? 600 })
    const set = (target: View, animate = true) => {
      if (anim.current) cancelAnimationFrame(anim.current)
      anim.current = null
      const k = Math.min(MAX_K, Math.max(MIN_K, target.k))
      const to = { ...target, k }
      if (!animate || reducedMotion()) return apply(to)
      const from = { ...view.current }
      // interpolate the world point at the viewport centre so zoom + pan feel like one motion
      const { w, h } = size()
      const fc = [(w / 2 - from.x) / from.k, (h / 2 - from.y) / from.k]
      const tc = [(w / 2 - to.x) / to.k, (h / 2 - to.y) / to.k]
      const dist = Math.hypot(fc[0] - tc[0], fc[1] - tc[1]) * Math.min(from.k, to.k)
      const duration = Math.min(650, 280 + dist * 0.25)
      const t0 = performance.now()
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / duration)
        const e = ease(t)
        const kk = from.k * Math.pow(to.k / from.k, e)
        const cx = fc[0] + (tc[0] - fc[0]) * e
        const cy = fc[1] + (tc[1] - fc[1]) * e
        apply({ k: kk, x: w / 2 - cx * kk, y: h / 2 - cy * kk })
        anim.current = t < 1 ? requestAnimationFrame(tick) : null
        if (t >= 1) layer.current?.style.removeProperty('will-change')
      }
      layer.current?.style.setProperty('will-change', 'transform')
      anim.current = requestAnimationFrame(tick)
    }
    return {
      get: () => ({ ...view.current }),
      set,
      size,
      element: () => viewport.current,
      toScreen: (x, y) => [x * view.current.k + view.current.x, y * view.current.k + view.current.y],
      zoomBy: (f) => {
        const v = view.current
        const { w, h } = size()
        const k = Math.min(MAX_K, Math.max(MIN_K, v.k * f))
        const cx = (w / 2 - v.x) / v.k
        const cy = (h / 2 - v.y) / v.k
        set({ k, x: w / 2 - cx * k, y: h / 2 - cy * k })
      },
      reveal: (b) => {
        const v = view.current
        const { w, h } = size()
        const m = 24
        let dx = 0
        let dy = 0
        const sx0 = b.x0 * v.k + v.x
        const sx1 = b.x1 * v.k + v.x
        const sy0 = b.y0 * v.k + v.y
        const sy1 = b.y1 * v.k + v.y
        if (sx0 < m) dx = m - sx0
        else if (sx1 > w - m) dx = w - m - sx1
        if (sy0 < m + 64) dy = m + 64 - sy0
        else if (sy1 > h - m) dy = h - m - sy1
        if (dx || dy) set({ ...v, x: v.x + dx, y: v.y + dy })
      },
      fitView: (b, maxK = 1.2, pad = 48) => {
        const { w, h } = size()
        const bw = Math.max(1, b.x1 - b.x0)
        const bh = Math.max(1, b.y1 - b.y0)
        const k = Math.max(MIN_K, Math.min(maxK, (w - pad * 2) / bw, (h - pad * 2 - 56) / bh))
        return { k, x: w / 2 - ((b.x0 + b.x1) / 2) * k, y: (h + 56) / 2 - ((b.y0 + b.y1) / 2) * k }
      },
    }
  }, [])

  return (
    <div
      ref={viewport}
      onKeyDown={onKeyDown}
      className={
        'relative size-full touch-none overflow-hidden select-none outline-none data-[dragging]:cursor-grabbing ' + (className ?? '')
      }
      style={{ cursor: 'grab' }}
    >
      <div ref={layer} className="absolute top-0 left-0 origin-top-left" style={{ width: 0, height: 0 }}>
        {children}
      </div>
      {overlay}
    </div>
  )
}
