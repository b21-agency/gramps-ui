import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Check, ChevronDown, ChevronRight, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { drawerCommand } from '@/components/adaptive-popover'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { tagColor } from '@/components/tag-list'
import { useTags } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { formatYearRange, hasTag, parseYearRange, type Rule } from './rules'

export interface FilterOption {
  value: string
  label: string
  color?: string
}

interface FilterBase {
  /** URL search param name */
  id: string
  label: string
  icon?: LucideIcon
  toRule: (value: string) => Rule | null
}

export type FilterDef =
  | (FilterBase & { type: 'select'; options: FilterOption[] })
  | (FilterBase & { type: 'toggle' })
  | (FilterBase & { type: 'years' })
  /** several options at once; value = comma-joined option values (all must match) */
  | (FilterBase & { type: 'multi'; options: FilterOption[] })
  /** free text (substring) */
  | (FilterBase & { type: 'text'; placeholder?: string })

export const multiValues = (v: string | null | undefined) => (v ? v.split(',').filter(Boolean) : [])

/** Human-readable value of an active filter (null for toggles). */
export function filterDisplay(f: FilterDef, value: string | null, t: TFunction<'lists'>): string | null {
  if (value == null || f.type === 'toggle') return null
  if (f.type === 'years') return formatYearRange(value)
  if (f.type === 'text') return `“${value}”`
  if (f.type === 'multi') {
    const vs = multiValues(value)
    return vs.length === 1 ? (f.options.find((o) => o.value === vs[0])?.label ?? vs[0]) : t('filters.nSelected', { count: vs.length })
  }
  return f.options.find((o) => o.value === value)?.label ?? value
}

/** Shared tag filter (HasTag); hidden when the tree has no tags. */
export function useTagFilter(label: string, icon?: LucideIcon): FilterDef | null {
  const { data: tags } = useTags()
  return useMemo(
    () =>
      tags?.length
        ? {
            id: 'tag',
            type: 'select' as const,
            label,
            icon,
            options: tags.map((t) => ({ value: t.name, label: t.name, color: tagColor(t.color) })),
            toRule: (v: string) => hasTag(v),
          }
        : null,
    [tags, label, icon],
  )
}

export const chip =
  'inline-flex h-10 max-w-full items-center gap-1.5 rounded-full px-4 text-sm transition-[background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] motion-reduce:active:scale-100'
export const chipIdle = 'bg-card text-foreground hover:bg-accent aria-expanded:bg-accent'
export const chipActive = 'bg-primary font-medium text-primary-foreground hover:bg-primary/85'

export function FilterChips({
  filters,
  values,
  onChange,
  onClear,
}: {
  filters: FilterDef[]
  values: Record<string, string | null>
  onChange: (id: string, value: string | null) => void
  onClear?: () => void
}) {
  const { t } = useTranslation('lists')
  if (!filters.length) return null
  const anyActive = filters.some((f) => values[f.id])
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('filters.label')}>
      {filters.map((f) =>
        f.type === 'toggle' ? (
          <ToggleChip key={f.id} filter={f} active={!!values[f.id]} onChange={(on) => onChange(f.id, on ? '1' : null)} />
        ) : (
          <PopoverChip key={f.id} filter={f} value={values[f.id] ?? null} onChange={(v) => onChange(f.id, v)} />
        ),
      )}
      {anyActive && onClear && (
        <Button variant="ghost" className="ml-auto h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-muted-foreground" onClick={onClear}>
          {t('filters.clear')}
        </Button>
      )}
    </div>
  )
}

function ToggleChip({ filter, active, onChange }: { filter: FilterDef; active: boolean; onChange: (on: boolean) => void }) {
  const Icon = filter.icon
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(chip, active ? chipActive : chipIdle)}
      onClick={() => onChange(!active)}
    >
      {active ? <Check className="size-3.5" /> : Icon && <Icon className="size-3.5 text-muted-foreground" />}
      {filter.label}
    </button>
  )
}

function PopoverChip({
  filter,
  value,
  onChange,
}: {
  filter: Exclude<FilterDef, { type: 'toggle' }>
  value: string | null
  onChange: (v: string | null) => void
}) {
  const { t } = useTranslation('lists')
  const [open, setOpen] = useState(false)
  const Icon = filter.icon
  const display = filterDisplay(filter, value, t)

  return (
    <div className={cn('inline-flex max-w-full items-center', value && 'rounded-full')}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(chip, value ? cn(chipActive, 'rounded-r-none pr-2') : chipIdle)}
            aria-label={display ? `${filter.label}: ${display}` : filter.label}
          >
            {Icon && <Icon className={cn('size-3.5', !value && 'text-muted-foreground')} />}
            <span className={cn(value && 'font-normal text-primary-foreground/80')}>{filter.label}</span>
            {display && <span className="truncate">{display}</span>}
            {!value && <ChevronDown className="size-3.5 text-muted-foreground" />}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn('p-0', filter.type === 'years' ? 'w-64' : filter.type === 'multi' ? 'w-[min(22rem,calc(100vw-2rem))]' : 'w-[min(18rem,calc(100vw-2rem))]')}
        >
          {filter.type === 'years' ? (
            <YearRangeForm
              value={value}
              onApply={(v) => {
                onChange(v)
                setOpen(false)
              }}
            />
          ) : filter.type === 'text' ? (
            <TextFilterForm
              value={value}
              placeholder={filter.placeholder}
              onApply={(v) => {
                onChange(v)
                setOpen(false)
              }}
            />
          ) : filter.type === 'multi' ? (
            <Command>
              {filter.options.length > 8 && <CommandInput placeholder={t('filters.find', { what: filter.label })} />}
              <CommandList className="max-h-80">
                <CommandEmpty>{t('common:noResults')}</CommandEmpty>
                <CommandGroup>
                  {filter.options.map((o) => {
                    const vs = multiValues(value)
                    const on = vs.includes(o.value)
                    return (
                      <CommandItem
                        key={o.value}
                        value={`${o.label} ${o.value}`}
                        onSelect={() => {
                          const next = on ? vs.filter((x) => x !== o.value) : [...vs, o.value]
                          onChange(next.length ? next.join(',') : null)
                        }}
                      >
                        <Checkbox checked={on} tabIndex={-1} className="pointer-events-none" />
                        <span className="flex-1">{o.label}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : (
            <Command>
              {filter.options.length > 8 && <CommandInput placeholder={t('filters.find', { what: filter.label })} />}
              <CommandList>
                <CommandEmpty>{t('common:noResults')}</CommandEmpty>
                <CommandGroup>
                  {filter.options.map((o) => (
                    <CommandItem
                      key={o.value}
                      value={`${o.label} ${o.value}`}
                      onSelect={() => {
                        onChange(o.value === value ? null : o.value)
                        setOpen(false)
                      }}
                    >
                      {o.color && <span className="size-2.5 rounded-full" style={{ background: o.color }} />}
                      <span className="flex-1 truncate">{o.label}</span>
                      {o.value === value && <Check className="text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          className={cn(chip, chipActive, 'rounded-l-none pr-3 pl-2 text-primary-foreground/80 hover:text-primary-foreground')}
          aria-label={t('filters.remove', { what: filter.label })}
          onClick={() => onChange(null)}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

function TextFilterForm({ value, placeholder, onApply }: { value: string | null; placeholder?: string; onApply: (v: string | null) => void }) {
  const { t } = useTranslation('lists')
  const [text, setText] = useState(value ?? '')
  return (
    <form
      className="space-y-3 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onApply(text.trim() || null)
      }}
    >
      <Input autoFocus value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
      <div className="flex justify-end gap-2">
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onApply(null)}>
            {t('common:actions.clear')}
          </Button>
        )}
        <Button type="submit" size="sm">
          {t('filters.apply')}
        </Button>
      </div>
    </form>
  )
}

function YearRangeForm({ value, onApply }: { value: string | null; onApply: (v: string | null) => void }) {
  const { t } = useTranslation('lists')
  const init = parseYearRange(value)
  const [from, setFrom] = useState(init.from?.toString() ?? '')
  const [to, setTo] = useState(init.to?.toString() ?? '')
  const valid = (s: string) => s === '' || /^\d{1,4}$/.test(s)
  const ok = valid(from) && valid(to) && (from !== '' || to !== '') && !(from && to && Number(from) > Number(to))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ok) return
    onApply(from && to && from === to ? from : `${from}-${to}`)
  }
  return (
    <form onSubmit={submit} className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="yr-from" className="text-xs text-muted-foreground">
            {t('filters.from')}
          </Label>
          <Input
            id="yr-from"
            inputMode="numeric"
            autoFocus
            placeholder="1800"
            value={from}
            onChange={(e) => setFrom(e.target.value.trim())}
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="yr-to" className="text-xs text-muted-foreground">
            {t('filters.to')}
          </Label>
          <Input
            id="yr-to"
            inputMode="numeric"
            placeholder="1900"
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            className="tabular-nums"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('filters.yearsHint')}</p>
      <div className="flex justify-end gap-2">
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onApply(null)}>
            {t('common:actions.clear')}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={!ok}>
          {t('filters.apply')}
        </Button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ phones */

/** Number of active filters (for the "Filters" button badge). */
export function activeFilterCount(filters: FilterDef[], values: Record<string, string | null>) {
  return filters.filter((f) => values[f.id]).length
}

const pill =
  'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[15px] transition-[background-color,transform] active:scale-[0.97] motion-reduce:active:scale-100'

/** Active filters as removable pills under the phone toolbar (scrolls sideways). */
export function ActiveFilterPills({
  filters,
  values,
  onChange,
}: {
  filters: FilterDef[]
  values: Record<string, string | null>
  onChange: (id: string, value: string | null) => void
}) {
  const { t } = useTranslation('lists')
  const active = filters.filter((f) => values[f.id])
  if (!active.length) return null
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]" role="group" aria-label={t('filters.label')}>
      {active.map((f) => {
        const v = values[f.id]!
        const display = filterDisplay(f, v, t)
        return (
          <button
            key={f.id}
            type="button"
            className={cn(pill, 'min-h-11 shrink-0 border-transparent bg-primary pr-3 text-sm text-primary-foreground')}
            aria-label={t('filters.remove', { what: f.label })}
            onClick={() => onChange(f.id, null)}
          >
            {display ? (
              <>
                <span className="text-primary-foreground/80">{f.label}</span>
                <span className="max-w-40 truncate font-medium">{display}</span>
              </>
            ) : (
              <span className="font-medium">{f.label}</span>
            )}
            <X className="size-4 text-primary-foreground/80" />
          </button>
        )
      })}
    </div>
  )
}

/** Body of the phone "Filters" drawer: one section per filter, big targets, applied immediately. */
export function FilterSheetSections({
  filters,
  values,
  onChange,
}: {
  filters: FilterDef[]
  values: Record<string, string | null>
  onChange: (id: string, value: string | null) => void
}) {
  return (
    <>
      {filters.map((f) => (
        <section key={f.id} className="border-t py-4 first:border-t-0">
          {f.type === 'toggle' ? (
            <label className="flex min-h-10 items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2.5">
                {f.icon && <f.icon className="size-5 text-muted-foreground" />}
                {f.label}
              </span>
              <Switch checked={!!values[f.id]} onCheckedChange={(on) => onChange(f.id, on ? '1' : null)} />
            </label>
          ) : (
            <>
              <h3 className="mb-3 flex items-center gap-2 font-sans text-sm font-medium text-muted-foreground">
                {f.icon && <f.icon className="size-4" />}
                {f.label}
              </h3>
              {f.type === 'years' ? (
                <YearInputs value={values[f.id] ?? null} onApply={(v) => onChange(f.id, v)} />
              ) : f.type === 'text' ? (
                <TextInputSheet value={values[f.id] ?? null} placeholder={f.placeholder} onApply={(v) => onChange(f.id, v)} />
              ) : f.type === 'multi' ? (
                <div className="flex flex-wrap gap-2">
                  {f.options.map((o) => {
                    const vs = multiValues(values[f.id])
                    const on = vs.includes(o.value)
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        className={cn(pill, on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
                        onClick={() => {
                          const next = on ? vs.filter((x) => x !== o.value) : [...vs, o.value]
                          onChange(f.id, next.length ? next.join(',') : null)
                        }}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              ) : f.options.length <= 10 ? (
                <div className="flex flex-wrap gap-2">
                  {f.options.map((o) => {
                    const on = values[f.id] === o.value
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        className={cn(pill, on ? 'border-primary bg-primary text-primary-foreground' : 'bg-card')}
                        onClick={() => onChange(f.id, on ? null : o.value)}
                      >
                        {o.color && <span className="size-2.5 rounded-full ring-1 ring-background/60" style={{ background: o.color }} />}
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <OptionPicker filter={f} value={values[f.id] ?? null} onChange={(v) => onChange(f.id, v)} />
              )}
            </>
          )}
        </section>
      ))}
    </>
  )
}

/** Many options (e.g. event types): a row that opens a searchable list in a second drawer. */
function OptionPicker({
  filter,
  value,
  onChange,
}: {
  filter: Extract<FilterDef, { type: 'select' }>
  value: string | null
  onChange: (v: string | null) => void
}) {
  const { t } = useTranslation('lists')
  const [open, setOpen] = useState(false)
  const current = filter.options.find((o) => o.value === value)
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <div className="flex items-center gap-2">
        <DrawerTrigger asChild>
          <button
            type="button"
            className="flex min-h-12 flex-1 items-center gap-2 rounded-xl border bg-card px-4 text-left text-base active:bg-accent"
          >
            <span className={cn('flex-1 truncate', !current && 'text-muted-foreground')}>
              {current?.label ?? t('filters.any')}
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>
        </DrawerTrigger>
        {value && (
          <Button variant="ghost" size="icon" className="size-12" aria-label={t('filters.remove', { what: filter.label })} onClick={() => onChange(null)}>
            <X className="size-5" />
          </Button>
        )}
      </div>
      <DrawerContent className="h-[85dvh] max-h-[85dvh] pb-safe">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="font-serif text-xl font-medium">{filter.label}</DrawerTitle>
          <DrawerDescription className="sr-only">{t('filters.find', { what: filter.label })}</DrawerDescription>
        </DrawerHeader>
        <div className={cn('flex min-h-0 flex-1 flex-col px-2 pb-3', drawerCommand)}>
          <Command>
            <CommandInput placeholder={t('filters.find', { what: filter.label })} />
            <CommandList>
              <CommandEmpty>{t('common:noResults')}</CommandEmpty>
              <CommandGroup>
                {filter.options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.value}`}
                    onSelect={() => {
                      onChange(o.value === value ? null : o.value)
                      setOpen(false)
                    }}
                  >
                    {o.color && <span className="size-2.5 rounded-full" style={{ background: o.color }} />}
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.value === value && <Check className="text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/** Text input that applies when left (or Enter is pressed). */
function TextInputSheet({ value, placeholder, onApply }: { value: string | null; placeholder?: string; onApply: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? '')
  const commit = () => {
    const v = text.trim() || null
    if (v !== value) onApply(v)
  }
  return (
    <Input
      value={text}
      placeholder={placeholder}
      enterKeyHint="done"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), commit())}
      className="h-11 bg-card"
    />
  )
}

/** From/to year inputs that apply when a field is left (or Enter is pressed). */
function YearInputs({ value, onApply }: { value: string | null; onApply: (v: string | null) => void }) {
  const { t } = useTranslation('lists')
  const init = parseYearRange(value)
  const [from, setFrom] = useState(init.from?.toString() ?? '')
  const [to, setTo] = useState(init.to?.toString() ?? '')
  const valid = (s: string) => s === '' || /^\d{1,4}$/.test(s)
  const commit = () => {
    if (!valid(from) || !valid(to)) return
    if (from === '' && to === '') return value && onApply(null)
    if (from && to && Number(from) > Number(to)) return
    const next = from && to && from === to ? from : `${from}-${to}`
    if (next !== value) onApply(next)
  }
  const field = (id: string, label: string, v: string, set: (s: string) => void, ph: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        enterKeyHint="done"
        placeholder={ph}
        value={v}
        onChange={(e) => set(e.target.value.trim())}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur(), commit())}
        className="h-11 bg-card tabular-nums"
      />
    </div>
  )
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {field('yr-from-m', t('filters.from'), from, setFrom, '1800')}
        {field('yr-to-m', t('filters.to'), to, setTo, '1900')}
      </div>
      <p className="text-xs text-muted-foreground">{t('filters.yearsHint')}</p>
    </div>
  )
}
