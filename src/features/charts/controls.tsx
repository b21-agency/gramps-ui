import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDown,
  ArrowDownUp,
  ArrowRightLeft,
  ArrowUp,
  Download,
  House,
  Hourglass,
  LocateFixed,
  Maximize,
  Minus,
  Network,
  Palette,
  Plus,
  Rainbow,
  Search,
  Settings2,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ObjectPicker, type PickedObject } from '@/components/object-picker'
import { cn } from '@/lib/utils'
import { CHARTS, FAN_COLOURS, LIMITS, useNameOrder, type ChartKind, type ChartSettings, type FanColour, type NameOrder, type Orientation } from './graph'

export const chartIcon: Record<ChartKind, typeof Network> = {
  ancestor: Network,
  descendant: Network,
  hourglass: Hourglass,
  fan: Rainbow,
  relationship: Waypoints,
}

/** Floating pill that holds a group of controls over the canvas. */
export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-no-pan
      className={cn(
        'pointer-events-auto flex items-center gap-0.5 rounded-xl border bg-background/92 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function IconButton({
  label,
  onClick,
  children,
  disabled,
  side = 'bottom',
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" aria-label={label} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

export function ChartSwitcher({ value, onChange }: { value: ChartKind; onChange: (c: ChartKind) => void }) {
  const { t } = useTranslation('charts')
  return (
    <Pill>
      <div role="radiogroup" aria-label={t('title')} className="flex items-center gap-0.5">
        {CHARTS.map((c) => {
          const Icon = chartIcon[c]
          const active = c === value
          return (
            <Tooltip key={c}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={t(`charts.${c}`)}
                  onClick={() => onChange(c)}
                  className={cn(
                    'inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                    active && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                  )}
                >
                  <Icon className={cn('size-4', c === 'ancestor' && 'rotate-180')} aria-hidden />
                  <span className="hidden xl:inline">{t(`charts.${c}`)}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <span className="font-medium">{t(`charts.${c}`)}</span>
                <span className="block opacity-80">{t(`chartHelp.${c}`)}</span>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </Pill>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  text,
  icon,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  label: string
  text: string
  icon?: ReactNode
}) {
  const { t } = useTranslation('charts')
  return (
    <div className="flex items-center" role="group" aria-label={label}>
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label={`${t('fewer')}: ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </Button>
      <span className="flex min-w-8 items-center justify-center gap-1 px-0.5 text-sm tabular-nums" aria-live="polite" title={label}>
        {icon}
        <span className="sm:hidden">{value}</span>
        <span className="hidden sm:inline">{text}</span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label={`${t('more')}: ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  )
}

export function DepthControls({
  chart,
  settings,
  update,
}: {
  chart: ChartKind
  settings: ChartSettings
  update: <C extends ChartKind>(c: C, patch: Partial<ChartSettings[C]>) => void
}) {
  const { t } = useTranslation('charts')
  const orientationToggle = (o: Orientation, set: (o: Orientation) => void) => (
    <IconButton
      label={`${t('orientation.label')}: ${t(`orientation.${o === 'horizontal' ? 'vertical' : 'horizontal'}`)}`}
      onClick={() => set(o === 'horizontal' ? 'vertical' : 'horizontal')}
    >
      {o === 'horizontal' ? <ArrowDownUp /> : <ArrowRightLeft />}
    </IconButton>
  )
  const sep = <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
  switch (chart) {
    case 'ancestor':
    case 'descendant': {
      const s = settings[chart]
      const [min, max] = LIMITS[chart]
      return (
        <Pill>
          <Stepper
            value={s.gens}
            min={min}
            max={max}
            label={t('generationsLabel')}
            text={t('generations', { count: s.gens })}
            onChange={(gens) => update(chart, { gens })}
          />
          {sep}
          {orientationToggle(s.orientation, (orientation) => update(chart, { orientation }))}
        </Pill>
      )
    }
    case 'hourglass': {
      const s = settings.hourglass
      return (
        <Pill>
          <Stepper
            value={s.anc}
            min={LIMITS.hourglassAnc[0]}
            max={LIMITS.hourglassAnc[1]}
            label={t('ancestorsLabel')}
            text={String(s.anc)}
            icon={<ArrowUp className="size-3.5 text-muted-foreground" aria-hidden />}
            onChange={(anc) => update('hourglass', { anc })}
          />
          {sep}
          <Stepper
            value={s.desc}
            min={LIMITS.hourglassDesc[0]}
            max={LIMITS.hourglassDesc[1]}
            label={t('descendantsLabel')}
            text={String(s.desc)}
            icon={<ArrowDown className="size-3.5 text-muted-foreground" aria-hidden />}
            onChange={(desc) => update('hourglass', { desc })}
          />
          {sep}
          {orientationToggle(s.orientation, (orientation) => update('hourglass', { orientation }))}
        </Pill>
      )
    }
    case 'fan': {
      const s = settings.fan
      return (
        <Pill>
          <Stepper
            value={s.gens}
            min={LIMITS.fan[0]}
            max={LIMITS.fan[1]}
            label={t('generationsLabel')}
            text={t('generations', { count: s.gens })}
            onChange={(gens) => update('fan', { gens })}
          />
          {sep}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9" aria-label={t('colour.label')}>
                    <Palette />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t('colour.label')}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('colour.label')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={s.colour} onValueChange={(v) => update('fan', { colour: v as FanColour })}>
                {FAN_COLOURS.map((c, i) => (
                  <div key={c}>
                    {i === 2 && <DropdownMenuSeparator />}
                    <DropdownMenuRadioItem value={c}>{t(`colour.${c}`)}</DropdownMenuRadioItem>
                  </div>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Pill>
      )
    }
    case 'relationship': {
      const s = settings.relationship
      return (
        <Pill>
          <Stepper
            value={s.degrees}
            min={LIMITS.relationship[0]}
            max={LIMITS.relationship[1]}
            label={t('degreesLabel')}
            text={t('degrees', { count: s.degrees })}
            onChange={(degrees) => update('relationship', { degrees })}
          />
        </Pill>
      )
    }
  }
}

export function JumpTo({ onPick }: { onPick: (o: PickedObject) => void }) {
  const { t } = useTranslation('charts')
  return (
    <Pill>
      <ObjectPicker
        kinds={['person']}
        onChange={onPick}
        placeholder={t('jumpPlaceholder')}
        trigger={
          <Button variant="ghost" className="h-9 gap-2 px-2.5 text-muted-foreground" aria-label={t('jumpTo')}>
            <Search />
            <span className="hidden lg:inline">{t('jumpTo')}</span>
          </Button>
        }
      />
    </Pill>
  )
}

/** Chart-wide display options (name order), as in the classic chart preferences. */
export function DisplayMenu() {
  const { t } = useTranslation('charts')
  const [order, setOrder] = useNameOrder()
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9" aria-label={t('display')}>
              <Settings2 />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('display')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('nameOrder.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={order} onValueChange={(v) => setOrder(v as NameOrder)}>
          <DropdownMenuRadioItem value="given">{t('nameOrder.given')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="surname">{t('nameOrder.surname')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Back to the home person (shown when the chart is centred on someone else). */
export function HomeButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useTranslation('charts')
  return (
    <IconButton label={t('goHome')} onClick={onClick} disabled={disabled}>
      <House />
    </IconButton>
  )
}

export function ExportMenu({ onExport }: { onExport: (kind: 'svg' | 'png') => void }) {
  const { t } = useTranslation('charts')
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9" aria-label={t('export.label')}>
              <Download />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t('export.label')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onExport('png')}>{t('export.png')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('svg')}>{t('export.svg')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onRecentre,
  centreName,
}: {
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onRecentre: () => void
  centreName?: string
}) {
  const { t } = useTranslation('charts')
  return (
    <Pill className="flex-col">
      <IconButton label={t('zoomIn')} onClick={onZoomIn} side="left">
        <ZoomIn />
      </IconButton>
      <IconButton label={t('zoomOut')} onClick={onZoomOut} side="left">
        <ZoomOut />
      </IconButton>
      <span className="my-0.5 h-px w-5 bg-border" aria-hidden />
      <IconButton label={t('fit')} onClick={onFit} side="left">
        <Maximize />
      </IconButton>
      <IconButton label={centreName ? t('recentre', { name: centreName }) : t('recentreShort')} onClick={onRecentre} side="left">
        <LocateFixed />
      </IconButton>
    </Pill>
  )
}
