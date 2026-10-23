import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Baby, House, Loader2, Route, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Portrait } from '@/components/portrait'
import { EmptyState, ErrorState } from '@/components/states'
import { ObjectPicker, type PickedObject } from '@/components/object-picker'
import { useHomePerson, usePref } from '@/lib/prefs'
import { useTitle } from '@/hooks/use-title'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import {
  childrenOf,
  DEFAULT_SETTINGS,
  isChart,
  LIMITS,
  useChartData,
  usePrefetchChart,
  useNameOrder,
  withNameOrder,
  type ChartKind,
  type ChartSettings,
  type GPerson,
  type Graph,
} from './graph'
import { DIMS, layoutAncestors, layoutDescendants, layoutHourglass, layoutRelationship, type Bounds, type Layout } from './layout'
import { fanGeometry, FanChart, FanLegendView, type FanGeometry } from './fan'
import { reducedMotion, ZoomCanvas, type CanvasApi, type View } from './canvas'
import { BoxChart, datesText, yearsText, type CardHandlers } from './person-card'
import { ChartSwitcher, DepthControls, DisplayMenu, ExportMenu, HomeButton, JumpTo, Pill, ZoomControls } from './controls'
import { AddRelativeMenu } from '@/features/editor/relationship-actions'
import { useObjectById } from '@/lib/queries'
import type { Person } from '@/lib/types'
import { boxChartSvg, downloadPng, downloadSvg, fanChartSvg } from './export'
import { MobileChartActions, MobileChartSwitcher, MobileDepth, MobileZoom, PersonPanel } from './mobile-controls'

const GRAMPS_ID = /^[A-Za-z]*\d+$/

function useChartSettings() {
  const [stored, setStored] = usePref<Partial<ChartSettings>>('chart.settings', DEFAULT_SETTINGS)
  const settings = useMemo(() => {
    const s = { ...DEFAULT_SETTINGS } as ChartSettings
    for (const k of Object.keys(DEFAULT_SETTINGS) as ChartKind[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(s as any)[k] = { ...DEFAULT_SETTINGS[k], ...(stored?.[k] ?? {}) }
    }
    return s
  }, [stored])
  const update = useCallback(
    <C extends ChartKind>(c: C, patch: Partial<ChartSettings[C]>) =>
      setStored((prev) => ({ ...prev, [c]: { ...DEFAULT_SETTINGS[c], ...(prev?.[c] ?? {}), ...patch } })),
    [setStored],
  )
  return [settings, update] as const
}

export function TreePage() {
  const params = useParams()
  const [lastChart, setLastChart] = usePref<ChartKind>('chart.last', 'ancestor')
  const [home] = useHomePerson()
  const chart: ChartKind = isChart(params.chart) ? params.chart : isChart(lastChart) ? lastChart : 'ancestor'
  let id = params.id
  if (!isChart(params.chart) && params.chart && !params.id && GRAMPS_ID.test(params.chart)) id = params.chart
  id ??= home ?? undefined

  useEffect(() => {
    if (isChart(params.chart) && params.chart !== lastChart) setLastChart(params.chart)
  }, [params.chart, lastChart, setLastChart])

  return (
    <div className="relative h-[calc(100dvh-3.5rem-var(--tabbar-h))] w-full overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-background [background-size:22px_22px]">
      {id ? <TreeView chart={chart} id={id} /> : <ChooseStart chart={chart} />}
    </div>
  )
}

/* ---------- empty state: pick the starting person ---------- */

function ChooseStart({ chart, notFound }: { chart: ChartKind; notFound?: boolean }) {
  const { t } = useTranslation('charts')
  const navigate = useNavigate()
  const [home, setHome] = useHomePerson()
  const [alsoHome, setAlsoHome] = useState(!home)
  useTitle(t('title'))
  const pick = (o: PickedObject) => {
    if (alsoHome) {
      setHome(o.gramps_id)
      toast.success(t('homeSet', { name: o.title }))
    }
    navigate(`/tree/${chart}/${o.gramps_id}`)
  }
  return (
    <div className="grid size-full place-items-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-card p-2 shadow-[0_12px_32px_-14px_rgb(0_0_0/0.55)]">
        <EmptyState icon={notFound ? undefined : UserRound} title={notFound ? t('notFound.title') : t('empty.title')} className="py-8">
          {notFound ? t('notFound.text') : t('empty.text')}
        </EmptyState>
        <div className="space-y-4 px-4 pb-5">
          <ObjectPicker kinds={['person']} onChange={pick} placeholder={t('empty.choose')} className="h-11 text-base" />
          <div className="flex items-center gap-2.5">
            <Checkbox id="also-home" checked={alsoHome} onCheckedChange={(v) => setAlsoHome(v === true)} />
            <Label htmlFor="also-home" className="text-sm font-normal text-muted-foreground">
              {t('empty.alsoHome')}
            </Label>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- the chart ---------- */

type Anchor = { handle: string; sx: number; sy: number }

function TreeView({ chart, id }: { chart: ChartKind; id: string }) {
  const { t } = useTranslation('charts')
  const navigate = useNavigate()
  const [settings, update] = useChartSettings()
  const [search] = useSearchParams()
  const withId = chart === 'relationship' ? search.get('with') || undefined : undefined
  const q = useChartData(chart, id, settings, withId)
  const prefetch = usePrefetchChart(chart, settings)
  const [nameOrder] = useNameOrder()
  const graph = useMemo(() => withNameOrder(q.data, nameOrder), [q.data, nameOrder])
  const centre = graph?.centre ? graph.people.get(graph.centre) ?? null : null
  const canvas = useRef<CanvasApi>(null)
  const anchor = useRef<Anchor | null>(null)
  const [home, setHome] = useHomePerson()
  const isMobile = useIsMobile()
  // phones: tapping a card selects it (bottom panel) instead of re-centring right away
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => setSelected(null), [graph?.centre, chart])

  useTitle(centre ? `${centre.name} · ${t(`charts.${chart}`)}` : t('title'))

  const orientation =
    chart === 'ancestor' || chart === 'descendant' || chart === 'hourglass'
      ? settings[chart].orientation
      : chart === 'relationship'
        ? 'vertical'
        : null

  const layout: Layout | null = useMemo(() => {
    if (!graph?.centre || chart === 'fan') return null
    switch (chart) {
      case 'ancestor':
        return layoutAncestors(graph, graph.centre, settings.ancestor.gens, settings.ancestor.orientation)
      case 'descendant':
        return layoutDescendants(graph, graph.centre, settings.descendant.gens, settings.descendant.orientation)
      case 'hourglass':
        return layoutHourglass(graph, graph.centre, settings.hourglass.anc, settings.hourglass.desc, settings.hourglass.orientation)
      case 'relationship':
        return layoutRelationship(graph, graph.centre, graph.target)
    }
  }, [graph, chart, settings])
  const target = graph?.target ? graph.people.get(graph.target) ?? null : null

  const fan: FanGeometry | null = useMemo(
    () =>
      graph?.centre && chart === 'fan'
        ? fanGeometry(graph, graph.centre, settings.fan.gens, settings.fan.colour, t, nameOrder === 'surname')
        : null,
    [graph, chart, settings.fan.gens, settings.fan.colour, t, nameOrder],
  )

  const bounds: Bounds | null = layout?.bounds ?? fan?.bounds ?? null

  /* ----- camera ----- */

  const homeView = useCallback((): View | null => {
    const api = canvas.current
    if (!api || !bounds) return null
    const { w, h } = api.size()
    const fit = api.fitView(bounds, 1)
    if (chart === 'fan') return fit.k >= 0.4 ? fit : { k: 0.4, x: w / 2, y: (h + 56) / 2 }
    // leave room for the selected-person bar along the bottom edge
    const boxFit = api.fitView({ ...bounds, y1: bounds.y1 + 110 }, 1)
    if (boxFit.k >= 0.62) return boxFit
    const k = w < 640 ? 0.62 : 0.8
    const m = 28
    const top = 72
    const midY = (h + top) / 2
    if (chart === 'ancestor' && orientation === 'horizontal') return { k, x: m - bounds.x0 * k, y: midY }
    if (chart === 'ancestor') return { k, x: w / 2, y: h - m - bounds.y1 * k }
    if (chart === 'descendant' && orientation === 'horizontal') return { k, x: m - bounds.x0 * k, y: midY }
    if (chart === 'descendant') return { k, x: w / 2, y: top - bounds.y0 * k }
    // a relationship path too long for the screen: keep the centre person in view at the end the path starts from
    const c = chart === 'relationship' && graph?.target ? layout?.nodes.find((n) => n.handle === graph.centre) : undefined
    if (c) {
      const cy = c.y + c.h / 2
      const down = bounds.y1 - cy > cy - bounds.y0
      return { k, x: w / 2 - (c.x + c.w / 2) * k, y: down ? top + m + (c.h / 2) * k - cy * k : h - 140 - (c.h / 2) * k - cy * k }
    }
    return { k, x: w / 2, y: midY }
  }, [bounds, chart, orientation, graph, layout])

  const signature = graph?.centre ? `${chart}|${graph.centre}|${orientation}|${graph.target ?? ''}` : ''
  const lastSignature = useRef('')

  useLayoutEffect(() => {
    const api = canvas.current
    if (!api || !signature || signature === lastSignature.current) return
    const first = !lastSignature.current
    lastSignature.current = signature
    const target = homeView()
    if (!target) return
    const a = anchor.current
    anchor.current = null
    if (first) return api.set(target, false)
    if (a && a.handle === graph?.centre && !reducedMotion()) {
      // start with the new centre exactly where the clicked card was, then glide home
      const k = api.get().k
      api.set({ k, x: a.sx, y: a.sy }, false)
      api.element()?.firstElementChild?.animate?.([{ opacity: 0.55 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' })
    }
    api.set(target, true)
  }, [signature, homeView, graph?.centre])

  /* ----- interactions ----- */

  const handleRef = useRef({ graph, chart, centreHandle: graph?.centre, isMobile, selected })
  useLayoutEffect(() => {
    handleRef.current = { graph, chart, centreHandle: graph?.centre, isMobile, selected }
  })

  const goTo = useCallback(
    (p: GPerson, el?: Element | null) => {
      const api = canvas.current
      const vp = api?.element()
      const ds = (el as HTMLElement | null)?.dataset
      if (api && vp && ds?.cx != null && ds.cy != null) {
        // world centre of the clicked card / fan segment -> where it sits on screen right now
        const [sx, sy] = api.toScreen(Number(ds.cx), Number(ds.cy))
        anchor.current = { handle: p.handle, sx, sy }
      } else anchor.current = null
      navigate(`/tree/${handleRef.current.chart}/${p.id}`)
    },
    [navigate],
  )

  const openProfile = useCallback((p: GPerson) => navigate(`/person/${p.id}`), [navigate])

  const handlers: CardHandlers = useMemo(
    () => ({
      onActivate: (handle, el) => {
        if (suppressClick.current) return
        const { graph: g, centreHandle, isMobile: mobile, selected: sel } = handleRef.current
        const p = g?.people.get(handle)
        if (!p) return
        if (mobile) {
          // second tap on the selected card moves it to the centre
          if (sel === handle && handle !== centreHandle) goTo(p, el)
          else setSelected(handle)
          return
        }
        if (handle === centreHandle) openProfile(p)
        else goTo(p, el)
      },
      onStub: (handle, kind) => {
        const { graph: g, chart: c } = handleRef.current
        const p = g?.people.get(handle)
        if (!p) return
        const grow = (cur: number, max: number, apply: (v: number) => void) => {
          if (cur < max) apply(cur + 1)
          else goTo(p)
        }
        if (c === 'ancestor' && kind === 'parents') grow(settings.ancestor.gens, LIMITS.ancestor[1], (gens) => update('ancestor', { gens }))
        else if (c === 'descendant' && kind === 'children')
          grow(settings.descendant.gens, LIMITS.descendant[1], (gens) => update('descendant', { gens }))
        else if (c === 'hourglass' && kind === 'parents')
          grow(settings.hourglass.anc, LIMITS.hourglassAnc[1], (anc) => update('hourglass', { anc }))
        else if (c === 'hourglass' && kind === 'children')
          grow(settings.hourglass.desc, LIMITS.hourglassDesc[1], (desc) => update('hourglass', { desc }))
        else goTo(p)
      },
    }),
    [goTo, openProfile, settings, update],
  )

  // long press opens the profile; hover prefetches the chart for that person
  const suppressClick = useRef(false)
  const press = useRef<{ timer: number; x: number; y: number } | null>(null)
  const hover = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      if (press.current) window.clearTimeout(press.current.timer)
      window.clearTimeout(hover.current)
    },
    [],
  )
  const personEl = (e: React.SyntheticEvent) => (e.target as Element | null)?.closest?.('[data-person]') as HTMLElement | null
  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer)
    press.current = null
  }
  const pointerHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      const el = personEl(e)
      suppressClick.current = false
      cancelPress()
      if (!el || e.button) return
      press.current = {
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          press.current = null
          const p = handleRef.current.graph?.people.get(el.dataset.handle ?? '')
          if (p) {
            suppressClick.current = true
            navigator.vibrate?.(10)
            openProfile(p)
          }
        }, 550),
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 8) cancelPress()
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onContextMenu: (e: React.MouseEvent) => {
      if (press.current || suppressClick.current) e.preventDefault()
    },
    onPointerOver: (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const el = personEl(e)
      window.clearTimeout(hover.current)
      const pid = el?.dataset.person
      if (pid && el?.getAttribute('aria-current') !== 'true') hover.current = window.setTimeout(() => prefetch(pid), 180)
    },
    onPointerOut: () => window.clearTimeout(hover.current),
    onClickCapture: (e: React.MouseEvent) => {
      if (suppressClick.current) {
        e.stopPropagation()
        e.preventDefault()
        suppressClick.current = false
      }
    },
  }

  const revealEl = (el: HTMLElement) => {
    const api = canvas.current
    if (!api) return
    const cx = Number(el.dataset.cx)
    const cy = Number(el.dataset.cy)
    const isFan = chart === 'fan'
    const hw = isFan ? 40 : (orientation ? DIMS[orientation].w : 200) / 2
    const hh = isFan ? 30 : (orientation ? DIMS[orientation].h : 80) / 2
    api.reveal({ x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const api = canvas.current
    if (!api) return
    const target = (e.target as Element).closest('[data-person]') as HTMLElement | null
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (target && dirs[e.key]) {
      e.preventDefault()
      const [dx, dy] = dirs[e.key]
      const x = Number(target.dataset.cx)
      const y = Number(target.dataset.cy)
      let best: HTMLElement | null = null
      let bestScore = Infinity
      api
        .element()
        ?.querySelectorAll<HTMLElement>('[data-person]')
        .forEach((el) => {
          if (el === target) return
          const ex = Number(el.dataset.cx) - x
          const ey = Number(el.dataset.cy) - y
          const along = ex * dx + ey * dy
          if (along <= 1) return
          const across = Math.abs(ex * dy - ey * dx)
          if (across > along * 2.2) return
          const score = along + across * 2.5
          if (score < bestScore) {
            bestScore = score
            best = el
          }
        })
      if (best) {
        ;(best as HTMLElement).focus({ preventScroll: true })
        revealEl(best)
      }
      return
    }
    if (target && (e.key === 'p' || e.key === 'P' || (e.key === 'Enter' && e.shiftKey))) {
      e.preventDefault()
      const p = graph?.people.get(target.dataset.handle ?? '')
      if (p) openProfile(p)
      return
    }
    if (e.key === '+' || e.key === '=') api.zoomBy(1.3)
    else if (e.key === '-' || e.key === '_') api.zoomBy(1 / 1.3)
    else if (e.key === '0' && bounds) api.set(api.fitView(bounds, 1.2))
    else if (e.key === 'Home' || e.key === 'c') {
      const v = homeView()
      if (v) api.set(v)
    } else return
    e.preventDefault()
  }

  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    const el = (e.target as Element).closest?.('[data-person]') as HTMLElement | null
    if (el && e.target.matches(':focus-visible')) revealEl(el)
  }

  /* ----- export ----- */

  const doExport = async (kind: 'svg' | 'png') => {
    if (!graph || !centre) return
    const id = toast.loading(t('export.working'))
    try {
      const out = fan ? await fanChartSvg(fan, t) : layout ? await boxChartSvg(layout, graph.people, t) : null
      if (!out) return
      const name = `${centre.name} – ${t(`charts.${chart}`)}`.replace(/[\\/:*?"<>|]+/g, '')
      if (kind === 'svg') await downloadSvg(out.svg, name)
      else await downloadPng(out.svg, out.w, out.h, name)
      toast.dismiss(id)
    } catch {
      toast.error(t('export.failed'), { id })
    }
  }

  /* ----- render ----- */

  const switchChart = (c: ChartKind) => {
    if (c === chart) return
    // the URL id, not the shown centre: while a recentre is loading, the old chart is still on screen
    navigate(`/tree/${c}/${id ?? centre?.id}`)
  }

  const failed = q.isError && !graph
  const notFound = !!graph && !graph.centre && !q.isPlaceholderData

  const loading = q.isFetching && (q.isPlaceholderData || !graph)
  const alone = (layout && layout.nodes.length === 1) || (fan && !fan.segments.some((s) => s.person))

  return (
    <>
      <ZoomCanvas
        api={canvas}
        onKeyDown={onKeyDown}
        className={cn(loading && graph && '[&>div:first-child]:opacity-80 [&>div:first-child]:transition-opacity')}
        overlay={null}
      >
        <div onFocus={onFocus} className="contents" {...pointerHandlers}>
          {layout && graph && <BoxChart layout={layout} people={graph.people} handlers={handlers} />}
          {fan && <FanChart geo={fan} handlers={handlers} />}
        </div>
      </ZoomCanvas>

      {(failed || notFound) && (
        <div className="absolute inset-0 z-10 bg-background">
          {failed ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} className="size-full justify-center" />
          ) : withId ? (
            <div className="grid size-full place-items-center p-4">
              <EmptyState icon={Route} title={t('path.none')}>
                <Button variant="outline" className="mt-3" onClick={() => navigate(`/tree/relationship/${id}`)}>
                  {t('path.clear')}
                </Button>
              </EmptyState>
            </div>
          ) : (
            <ChooseStart chart={chart} notFound />
          )}
        </div>
      )}

      {!graph && !failed && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('loading')}
          </div>
        </div>
      )}

      {selected && (
        <style>{`[data-handle="${CSS.escape(selected)}"]:is(button){outline:3px solid var(--primary);outline-offset:3px}path[data-handle="${CSS.escape(selected)}"]{stroke:var(--primary);stroke-width:3px}`}</style>
      )}

      {isMobile ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-2 [&>*:first-child]:max-w-[calc(100%-6.75rem)]">
          <MobileChartSwitcher value={chart} onChange={switchChart} loading={loading && !!graph}>
            {!withId && chart !== 'hourglass' && <MobileDepth chart={chart} settings={settings} update={update} />}
          </MobileChartSwitcher>
          <div className="ml-auto flex items-start gap-2">
            <MobileChartActions
              chart={chart}
              settings={settings}
              update={update}
              onPick={(o) => navigate(`/tree/${chart}/${o.gramps_id}`)}
              onExport={doExport}
            />
          </div>
          {withId && (
            <Pill className="w-full min-w-0 gap-1 pl-3">
              <Route className="size-4 shrink-0 text-brass" aria-hidden />
              <span className="ml-1 min-w-0 flex-1 truncate text-sm">
                {target && centre ? t('path.title', { a: centre.name, b: target.name }) : t('path.short')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label={t('path.clear')}
                onClick={() => navigate(`/tree/relationship/${centre?.id ?? id}`)}
              >
                <X />
              </Button>
            </Pill>
          )}
        </div>
      ) : (
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-2 sm:p-3">
        <ChartSwitcher value={chart} onChange={switchChart} />
        {withId ? (
          <Pill className="min-w-0 gap-1 pl-3">
            <Route className="size-4 shrink-0 text-brass" aria-hidden />
            <span className="ml-1 min-w-0 truncate text-sm">
              {target && centre ? t('path.title', { a: centre.name, b: target.name }) : t('path.short')}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={t('path.clear')}
              title={t('path.clear')}
              onClick={() => navigate(`/tree/relationship/${centre?.id ?? id}`)}
            >
              <X />
            </Button>
          </Pill>
        ) : (
          <DepthControls chart={chart} settings={settings} update={update} />
        )}
        <div className="ml-auto flex items-start gap-2">
          {loading && graph && (
            <Pill className="h-11 px-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span className="ml-1.5 hidden sm:inline">{t('updating')}</span>
            </Pill>
          )}
          <JumpTo onPick={(o) => navigate(`/tree/${chart}/${o.gramps_id}`)} />
          <Pill>
            {home && <HomeButton disabled={home === centre?.id} onClick={() => navigate(`/tree/${chart}/${home}`)} />}
            <DisplayMenu />
            <ExportMenu onExport={doExport} />
          </Pill>
        </div>
      </div>
      )}

      {fan?.legend && (
        <div
          data-no-pan
          className={cn(
            'pointer-events-auto absolute left-2 max-w-[11rem] rounded-2xl bg-card/95 p-3 shadow-[0_12px_32px_-14px_rgb(0_0_0/0.55)] ring-1 ring-foreground/[0.07] backdrop-blur-xl supports-[backdrop-filter]:bg-card/75 sm:left-3',
            isMobile ? 'top-[4.5rem]' : 'top-[4.25rem]',
          )}
          aria-label={t(`colour.${settings.fan.colour}`)}
        >
          <div className="mb-2 font-serif text-sm font-medium">{t(`colour.${settings.fan.colour}`)}</div>
          <FanLegendView legend={fan.legend} className="space-y-1" />
        </div>
      )}

      {isMobile && centre && graph && (
        <MobileBottom
          graph={graph}
          centre={centre}
          chart={chart}
          selected={selected}
          home={home}
          alone={!!alone}
          onClose={() => setSelected(null)}
          onSelect={setSelected}
          onGo={(p) => {
            const el = canvas.current?.element()?.querySelector(`[data-handle="${CSS.escape(p.handle)}"]`)
            goTo(p, el)
          }}
          onProfile={openProfile}
          onHome={(p) => {
            setHome(p.id)
            toast.success(t('homeSet', { name: p.name }))
          }}
          onFit={() => {
            const api = canvas.current
            if (api && bounds) api.set(api.fitView(bounds, 1.2))
          }}
          onRecentre={() => {
            const v = homeView()
            if (v) canvas.current?.set(v)
          }}
        />
      )}

      {/* bottom: centre person + zoom */}
      <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-2 p-2 sm:p-3', isMobile && 'hidden')}>
        {centre && graph && (
          <CentrePanel
            person={centre}
            graph={graph}
            chart={chart}
            isHome={home === centre.id}
            onHome={() => {
              setHome(centre.id)
              toast.success(t('homeSet', { name: centre.name }))
            }}
            onGo={(p) => goTo(p)}
            alone={!!alone}
          />
        )}
        <div className="ml-auto">
          <ZoomControls
            centreName={centre?.name}
            onZoomIn={() => canvas.current?.zoomBy(1.3)}
            onZoomOut={() => canvas.current?.zoomBy(1 / 1.3)}
            onFit={() => {
              const api = canvas.current
              if (api && bounds) api.set(api.fitView(bounds, 1.2))
            }}
            onRecentre={() => {
              const v = homeView()
              if (v) canvas.current?.set(v)
            }}
          />
        </div>
      </div>
    </>
  )
}

function MobileBottom({
  graph,
  centre,
  chart,
  selected,
  home,
  alone,
  onClose,
  onSelect,
  onGo,
  onProfile,
  onHome,
  onFit,
  onRecentre,
}: {
  graph: Graph
  centre: GPerson
  chart: ChartKind
  selected: string | null
  home: string | null | undefined
  alone: boolean
  onClose: () => void
  onSelect: (handle: string) => void
  onGo: (p: GPerson) => void
  onProfile: (p: GPerson) => void
  onHome: (p: GPerson) => void
  onFit: () => void
  onRecentre: () => void
}) {
  const { t } = useTranslation('charts')
  const [hintDismissed, setHintDismissed] = usePref('chart.hintDismissed', false)
  const person = (selected && graph.people.get(selected)) || centre
  const expanded = !!selected && person === graph.people.get(selected)
  const isCentre = person.handle === centre.handle
  const kids = (chart === 'ancestor' || chart === 'fan' ? childrenOf(graph, centre.handle) : [])
    .map((h) => graph.people.get(h))
    .filter((p): p is GPerson => !!p)
  const hint = !hintDismissed ? (
    <Pill className="items-start gap-2 py-2 pr-1 pl-3 text-xs text-muted-foreground">
      <span className="flex-1 pt-1">{alone ? t('alone', { name: centre.given || centre.name }) : t('hints.touchSelect')}</span>
      <Button variant="ghost" size="icon" className="size-11" aria-label={t('common:actions.close')} onClick={() => setHintDismissed(true)}>
        <X />
      </Button>
    </Pill>
  ) : null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-2 p-2">
      <div className="flex justify-end">
        <MobileZoom centreName={centre.name} onFit={onFit} onRecentre={onRecentre} />
      </div>
      <PersonPanel
        key={expanded ? person.handle : 'centre'}
        person={person}
        isCentre={isCentre}
        isHome={home === person.id}
        expanded={expanded}
        hint={hint}
        relatives={kids}
        onClose={onClose}
        onCentre={() => (expanded ? onGo(person) : onSelect(person.handle))}
        onProfile={() => onProfile(person)}
        onHome={() => onHome(person)}
        onGo={onGo}
      />
    </div>
  )
}

function CentrePanel({
  person,
  graph,
  chart,
  isHome,
  onHome,
  onGo,
  alone,
}: {
  person: GPerson
  graph: Graph
  chart: ChartKind
  isHome: boolean
  onHome: () => void
  onGo: (p: GPerson) => void
  alone: boolean
}) {
  const { t } = useTranslation('charts')
  const years = datesText(person) || yearsText(person, t)
  // full person (families, gender) for the "add relative" menu, as in the classic chart edit mode
  const full = useObjectById<Person>('person', person.id, { profile: ['self', 'families'], keys: ['handle', 'gramps_id', 'gender', 'family_list', 'profile'] })
  const children = (chart === 'ancestor' || chart === 'fan' ? childrenOf(graph, person.handle) : [])
    .map((h) => graph.people.get(h))
    .filter((p): p is GPerson => !!p)
  const [hintDismissed, setHintDismissed] = usePref('chart.hintDismissed', false)
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  return (
    <div className="pointer-events-none flex min-w-0 flex-col items-start gap-2">
      {!hintDismissed && (
        <Pill className="max-w-[min(26rem,calc(100vw-5.5rem))] items-start gap-2 py-2 pr-1 pl-3.5 text-xs text-muted-foreground">
          <span className="pt-0.5">{coarse ? t('hints.touch') : t('hints.keyboard')}</span>
          <Button variant="ghost" size="icon-xs" aria-label={t('common:actions.close')} onClick={() => setHintDismissed(true)}>
            <X />
          </Button>
        </Pill>
      )}
      <Pill className="max-w-[calc(100vw-5.5rem)] min-w-0 gap-1.5 rounded-3xl py-2 pr-2 pl-2.5">
        <Portrait mediaRef={person.media} name={person.name} sex={person.sex} size={52} className="hidden ring-brass/80 sm:inline-flex" />
        <div className="mr-2 min-w-0 sm:ml-1.5">
          <div className="truncate font-serif text-xl leading-tight font-medium tracking-[-0.01em]">{person.name}</div>
          <div className={cn('mt-0.5 truncate text-sm tabular-nums', alone ? 'text-muted-foreground' : 'font-serif text-brass')}>
            {alone ? t('alone', { name: person.given || person.name }) : years || ' '}
          </div>
        </div>
        {children.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-10" aria-label={t('children')} title={t('children')}>
                <Baby />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-64">
              <DropdownMenuLabel>{t('children')}</DropdownMenuLabel>
              {children.map((c) => (
                <DropdownMenuItem key={c.handle} onSelect={() => onGo(c)} className="gap-2.5">
                  <Portrait mediaRef={c.media} name={c.name} sex={c.sex} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate font-serif">{c.name}</span>
                    <span className="block font-serif text-xs text-brass tabular-nums">{yearsText(c, t)}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {full.data && <AddRelativeMenu person={full.data} className="h-10 rounded-full border-0 bg-secondary px-3.5 shadow-none hover:bg-accent" />}
        {!isHome && (
          <Button variant="ghost" size="icon" className="size-10" aria-label={t('setHome')} title={t('setHome')} onClick={onHome}>
            <House />
          </Button>
        )}
        <Button asChild className="h-10 gap-1.5 rounded-full px-4 max-sm:w-10 max-sm:px-0">
          <Link to={`/person/${person.id}`}>
            <UserRound />
            <span className="hidden sm:inline">{t('openProfile')}</span>
          </Link>
        </Button>
      </Pill>
    </div>
  )
}
