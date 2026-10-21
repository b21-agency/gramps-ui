// Phone controls for the tree: one chart-type button, a compact stepper, an options drawer,
// and a bottom person panel that appears when a card is tapped.
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useHomePerson } from '@/lib/prefs'
import {
  ArrowDown,
  ArrowUp,
  Baby,
  ChevronDown,
  Download,
  House,
  Loader2,
  LocateFixed,
  Maximize,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ActionSheet } from '@/components/action-sheet'
import { ObjectPicker, type PickedObject } from '@/components/object-picker'
import { Portrait } from '@/components/portrait'
import { cn } from '@/lib/utils'
import { CHARTS, FAN_COLOURS, LIMITS, useNameOrder, type ChartKind, type ChartSettings, type GPerson, type NameOrder, type Orientation } from './graph'
import { chartIcon, Pill } from './controls'
import { yearsText } from './person-card'

type Update = <C extends ChartKind>(c: C, patch: Partial<ChartSettings[C]>) => void

const pillBtn = 'size-11 rounded-lg active:scale-95 motion-reduce:active:scale-100'

/** Chart type as one button that opens an action sheet. */
export function MobileChartSwitcher({
  value,
  onChange,
  loading,
  children,
}: {
  value: ChartKind
  onChange: (c: ChartKind) => void
  /** shows a spinner in place of the chart icon while the chart updates */
  loading?: boolean
  children?: ReactNode
}) {
  const { t } = useTranslation('charts')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pill className="min-w-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${t('chartType')}: ${t(`charts.${value}`)}`}
          className="inline-flex h-11 min-w-0 items-center gap-1 rounded-lg pr-1.5 pl-3 text-[15px] font-medium active:bg-muted"
        >
          <span className="min-w-0 truncate">{t(`charts.${value}`)}</span>
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-label={t('updating')} />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </button>
        {children && (
          <>
            <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />
            {children}
          </>
        )}
      </Pill>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title={t('chartType')}
        groups={[
          CHARTS.map((c) => {
            const I = chartIcon[c]
            return {
              key: c,
              active: c === value,
              icon: <I className={cn(c === 'ancestor' && 'rotate-180')} />,
              label: (
                <span className="block">
                  <span className="block">{t(`charts.${c}`)}</span>
                  <span className="block text-sm text-muted-foreground">{t(`chartHelp.${c}`)}</span>
                </span>
              ),
              onSelect: () => onChange(c),
            }
          }),
        ]}
      />
    </>
  )
}

/** The chart's main depth as "− 4 +" (hourglass has two, so it lives in the options drawer). */
export function MobileDepth({ chart, settings, update }: { chart: ChartKind; settings: ChartSettings; update: Update }) {
  const { t } = useTranslation('charts')
  let value: number
  let range: readonly [number, number]
  let set: (v: number) => void
  let label: string
  switch (chart) {
    case 'ancestor':
    case 'descendant':
    case 'fan':
      value = settings[chart].gens
      range = LIMITS[chart]
      set = (gens) => update(chart, { gens })
      label = t('generationsLabel')
      break
    case 'relationship':
      value = settings.relationship.degrees
      range = LIMITS.relationship
      set = (degrees) => update('relationship', { degrees })
      label = t('degreesLabel')
      break
    default:
      return null
  }
  return (
    <>
      <div className="flex shrink-0 items-center" role="group" aria-label={label}>
        <Button variant="ghost" size="icon" className={cn(pillBtn, 'w-9')} aria-label={`${t('fewer')}: ${label}`} disabled={value <= range[0]} onClick={() => set(value - 1)}>
          <Minus />
        </Button>
        <span className="min-w-5 text-center text-[15px] font-medium tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button variant="ghost" size="icon" className={cn(pillBtn, 'w-9')} aria-label={`${t('more')}: ${label}`} disabled={value >= range[1]} onClick={() => set(value + 1)}>
          <Plus />
        </Button>
      </div>
    </>
  )
}

/** Search + options buttons (top right). */
export function MobileChartActions({
  chart,
  settings,
  update,
  onPick,
  onExport,
}: {
  chart: ChartKind
  settings: ChartSettings
  update: Update
  onPick: (o: PickedObject) => void
  onExport: (kind: 'svg' | 'png') => void
}) {
  const { t } = useTranslation('charts')
  const [open, setOpen] = useState(false)
  const [home] = useHomePerson()
  const navigate = useNavigate()
  return (
    <Pill>
      {home && (
        <Button variant="ghost" size="icon" className={pillBtn} aria-label={t('goHome')} onClick={() => navigate(`/tree/${chart}/${home}`)}>
          <House className="size-5" />
        </Button>
      )}
      <ObjectPicker
        kinds={['person']}
        onChange={onPick}
        placeholder={t('jumpPlaceholder')}
        trigger={
          <Button variant="ghost" size="icon" className={pillBtn} aria-label={t('jumpTo')}>
            <Search className="size-5" />
          </Button>
        }
      />
      <Button variant="ghost" size="icon" className={pillBtn} aria-label={t('settings')} onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-5" />
      </Button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[88dvh] pb-safe">
          <DrawerHeader className="pb-1 text-left">
            <DrawerTitle className="font-serif text-2xl font-medium">{t('settings')}</DrawerTitle>
            <DrawerDescription>{t(`charts.${chart}`)}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-1 overflow-y-auto overscroll-contain px-4 pb-6">
            <ChartOptions chart={chart} settings={settings} update={update} />
            <NameOrderRow />
            <OptionRow label={t('export.label')}>
              <div className="grid grid-cols-2 gap-2">
                {(['png', 'svg'] as const).map((k) => (
                  <Button
                    key={k}
                    variant="outline"
                    className="h-11 bg-card text-[15px]"
                    onClick={() => {
                      setOpen(false)
                      onExport(k)
                    }}
                  >
                    <Download />
                    {k.toUpperCase()}
                  </Button>
                ))}
              </div>
            </OptionRow>
          </div>
        </DrawerContent>
      </Drawer>
    </Pill>
  )
}

function NameOrderRow() {
  const { t } = useTranslation('charts')
  const [order, setOrder] = useNameOrder()
  return (
    <OptionRow label={t('nameOrder.label')}>
      <Segmented<NameOrder>
        label={t('nameOrder.label')}
        value={order}
        onChange={setOrder}
        options={[
          { value: 'given', label: t('nameOrder.given') },
          { value: 'surname', label: t('nameOrder.surname') },
        ]}
      />
    </OptionRow>
  )
}

function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-b py-4 last:border-b-0">
      <h3 className="mb-3 font-sans text-sm font-medium text-muted-foreground">{label}</h3>
      {children}
    </section>
  )
}

function BigStepper({
  value,
  range,
  onChange,
  text,
  label,
  icon,
}: {
  value: number
  range: readonly [number, number]
  onChange: (v: number) => void
  text: string
  label: string
  icon?: ReactNode
}) {
  const { t } = useTranslation('charts')
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-1.5" role="group" aria-label={label}>
      <Button variant="ghost" size="icon" className="size-11" aria-label={`${t('fewer')}: ${label}`} disabled={value <= range[0]} onClick={() => onChange(value - 1)}>
        <Minus />
      </Button>
      <span className="flex items-center gap-1.5 text-base tabular-nums" aria-live="polite">
        {icon}
        {text}
      </span>
      <Button variant="ghost" size="icon" className="size-11" aria-label={`${t('more')}: ${label}`} disabled={value >= range[1]} onClick={() => onChange(value + 1)}>
        <Plus />
      </Button>
    </div>
  )
}

function Segmented<V extends string>({ value, options, onChange, label }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col rounded-xl border bg-muted p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-10 rounded-lg px-2 text-[15px] transition-colors',
            o.value === value ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ChartOptions({ chart, settings, update }: { chart: ChartKind; settings: ChartSettings; update: Update }) {
  const { t } = useTranslation('charts')
  const orientation = (o: Orientation, set: (o: Orientation) => void) => (
    <OptionRow label={t('orientation.label')}>
      <Segmented
        label={t('orientation.label')}
        value={o}
        onChange={set}
        options={[
          { value: 'vertical', label: t('orientation.vertical') },
          { value: 'horizontal', label: t('orientation.horizontal') },
        ]}
      />
    </OptionRow>
  )
  switch (chart) {
    case 'ancestor':
    case 'descendant': {
      const s = settings[chart]
      return (
        <>
          <OptionRow label={t('generationsLabel')}>
            <BigStepper value={s.gens} range={LIMITS[chart]} label={t('generationsLabel')} text={t('generations', { count: s.gens })} onChange={(gens) => update(chart, { gens })} />
          </OptionRow>
          {orientation(s.orientation, (o) => update(chart, { orientation: o }))}
        </>
      )
    }
    case 'hourglass': {
      const s = settings.hourglass
      return (
        <>
          <OptionRow label={t('ancestorsLabel')}>
            <BigStepper
              value={s.anc}
              range={LIMITS.hourglassAnc}
              label={t('ancestorsLabel')}
              icon={<ArrowUp className="size-4 text-muted-foreground" />}
              text={t('generations', { count: s.anc })}
              onChange={(anc) => update('hourglass', { anc })}
            />
          </OptionRow>
          <OptionRow label={t('descendantsLabel')}>
            <BigStepper
              value={s.desc}
              range={LIMITS.hourglassDesc}
              label={t('descendantsLabel')}
              icon={<ArrowDown className="size-4 text-muted-foreground" />}
              text={t('generations', { count: s.desc })}
              onChange={(desc) => update('hourglass', { desc })}
            />
          </OptionRow>
          {orientation(s.orientation, (o) => update('hourglass', { orientation: o }))}
        </>
      )
    }
    case 'fan': {
      const s = settings.fan
      return (
        <>
          <OptionRow label={t('generationsLabel')}>
            <BigStepper value={s.gens} range={LIMITS.fan} label={t('generationsLabel')} text={t('generations', { count: s.gens })} onChange={(gens) => update('fan', { gens })} />
          </OptionRow>
          <OptionRow label={t('colour.label')}>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('colour.label')}>
              {FAN_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={s.colour === c}
                  onClick={() => update('fan', { colour: c })}
                  className={cn(
                    'min-h-10 rounded-full border px-3.5 text-[15px] transition-colors',
                    s.colour === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                  )}
                >
                  {t(`colour.${c}`)}
                </button>
              ))}
            </div>
          </OptionRow>
        </>
      )
    }
    case 'relationship': {
      const s = settings.relationship
      return (
        <OptionRow label={t('degreesLabel')}>
          <BigStepper value={s.degrees} range={LIMITS.relationship} label={t('degreesLabel')} text={t('degrees', { count: s.degrees })} onChange={(degrees) => update('relationship', { degrees })} />
        </OptionRow>
      )
    }
  }
}

/** Fit + recentre (pinch does the zooming on phones). */
export function MobileZoom({ onFit, onRecentre, centreName }: { onFit: () => void; onRecentre: () => void; centreName?: string }) {
  const { t } = useTranslation('charts')
  return (
    <Pill className="flex-col">
      <Button variant="ghost" size="icon" className={pillBtn} aria-label={t('fit')} onClick={onFit}>
        <Maximize className="size-5" />
      </Button>
      <Button variant="ghost" size="icon" className={pillBtn} aria-label={centreName ? t('recentre', { name: centreName }) : t('recentreShort')} onClick={onRecentre}>
        <LocateFixed className="size-5" />
      </Button>
    </Pill>
  )
}

/**
 * Bottom panel for the tapped person (or the centre person when nothing is tapped).
 * Swipe down or tap × to dismiss.
 */
export function PersonPanel({
  person,
  isCentre,
  isHome,
  expanded,
  hint,
  relatives,
  onClose,
  onCentre,
  onProfile,
  onHome,
  onGo,
}: {
  person: GPerson
  isCentre: boolean
  isHome: boolean
  /** a tapped person: big actions; otherwise a compact bar for the centre */
  expanded: boolean
  hint?: ReactNode
  /** children of the centre person (ancestor/fan charts) */
  relatives: GPerson[]
  onClose: () => void
  onCentre: () => void
  onProfile: () => void
  onHome: () => void
  onGo: (p: GPerson) => void
}) {
  const { t } = useTranslation('charts')
  const years = yearsText(person, t)
  const [kidsOpen, setKidsOpen] = useState(false)
  const drag = useRef<{ y: number; dy: number; el: HTMLElement } | null>(null)

  const swipe = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!expanded || (e.target as Element).closest('button,a')) return
      drag.current = { y: e.clientY, dy: 0, el: e.currentTarget }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d) return
      d.dy = Math.max(0, e.clientY - d.y)
      d.el.style.transform = `translateY(${d.dy}px)`
      d.el.style.transition = 'none'
    },
    onPointerUp: () => {
      const d = drag.current
      drag.current = null
      if (!d) return
      d.el.style.transition = 'transform 200ms cubic-bezier(0.32,0.72,0,1)'
      d.el.style.transform = ''
      if (d.dy > 56) onClose()
    },
  }

  const kids = relatives.length > 0 && (
    <>
      <ActionSheet
        open={kidsOpen}
        onOpenChange={setKidsOpen}
        title={t('children')}
        groups={[
          relatives.map((c) => ({
            key: c.handle,
            icon: <Portrait mediaRef={c.media} name={c.name} sex={c.sex} size={32} />,
            label: (
              <span className="block min-w-0">
                <span className="block truncate font-serif">{c.name}</span>
                <span className="block text-sm text-muted-foreground tabular-nums">{yearsText(c, t)}</span>
              </span>
            ),
            onSelect: () => onGo(c),
          })),
        ]}
      />
    </>
  )

  if (!expanded)
    return (
      <div className="pointer-events-none flex w-full min-w-0 flex-col gap-2">
        {hint}
        <Pill className="w-full min-w-0 gap-1 py-1.5 pr-1 pl-1.5">
          <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-0.5 text-left active:bg-muted" onClick={onCentre}>
            <Portrait mediaRef={person.media} name={person.name} sex={person.sex} size={40} />
            <span className="min-w-0">
              <span className="block truncate font-serif text-[15px] leading-tight font-medium">{person.name}</span>
              <span className="block truncate text-xs text-muted-foreground tabular-nums">{years || ' '}</span>
            </span>
          </button>
          {relatives.length > 0 && (
            <Button variant="ghost" size="icon" className="size-11" aria-label={t('children')} onClick={() => setKidsOpen(true)}>
              <Baby className="size-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-11" aria-label={t('openProfile')} onClick={onProfile}>
            <UserRound className="size-5" />
          </Button>
        </Pill>
        {kids}
      </div>
    )

  const action = 'flex h-auto min-h-16 flex-col gap-1 rounded-xl px-1 py-2.5 text-[13px] leading-tight font-medium whitespace-normal [&_svg]:size-5'
  return (
    <div
      data-no-pan
      {...swipe}
      className="pointer-events-auto w-full touch-none rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur animate-in fade-in-0 slide-in-from-bottom-6 duration-200 supports-[backdrop-filter]:bg-background/85 motion-reduce:animate-none"
      role="dialog"
      aria-label={person.name}
    >
      <div className="mx-auto -mt-1 mb-2 h-1 w-10 rounded-full bg-muted-foreground/25" aria-hidden />
      <div className="flex items-center gap-3">
        <Portrait mediaRef={person.media} name={person.name} sex={person.sex} size={56} />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 font-serif text-lg leading-tight font-medium">{person.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
            {years}
            {isHome && (
              <span className="inline-flex items-center gap-1 text-brass">
                <House className="size-3.5" />
                {t('isHome')}
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="-mt-6 -mr-1 size-10 self-start" aria-label={t('common:actions.close')} onClick={onClose}>
          <X className="size-5" />
        </Button>
      </div>
      <div className={cn('mt-3 grid gap-2', isCentre ? 'grid-cols-2' : 'grid-cols-3')}>
        {!isCentre && (
          <Button className={action} onClick={onCentre}>
            <LocateFixed />
            {t('centreHere')}
          </Button>
        )}
        <Button variant="secondary" className={action} onClick={onProfile}>
          <UserRound />
          {t('openProfile')}
        </Button>
        <Button variant="secondary" className={action} disabled={isHome} onClick={onHome}>
          <House />
          {isHome ? t('isHome') : t('setHomeShort')}
        </Button>
      </div>
    </div>
  )
}
