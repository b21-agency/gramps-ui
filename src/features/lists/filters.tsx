import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const chip =
  'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
const chipIdle = 'border-border bg-card text-foreground hover:bg-accent'
const chipActive = 'border-primary/35 bg-primary/10 text-foreground hover:bg-primary/15'

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
        <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={onClear}>
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
      {active ? <Check className="size-3.5 text-primary" /> : Icon && <Icon className="size-3.5 text-muted-foreground" />}
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
  const display =
    value == null
      ? null
      : filter.type === 'years'
        ? formatYearRange(value)
        : (filter.options.find((o) => o.value === value)?.label ?? value)

  return (
    <div className={cn('inline-flex max-w-full items-center', value && 'rounded-full')}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(chip, value ? cn(chipActive, 'rounded-r-none border-r-0 pr-2') : chipIdle)}
            aria-label={display ? `${filter.label}: ${display}` : filter.label}
          >
            {Icon && <Icon className={cn('size-3.5', value ? 'text-primary' : 'text-muted-foreground')} />}
            <span className={cn(value && 'text-muted-foreground')}>{filter.label}</span>
            {display && <span className="truncate font-medium">{display}</span>}
            {!value && <ChevronDown className="size-3.5 text-muted-foreground" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className={cn('p-0', filter.type === 'years' ? 'w-64' : 'w-[min(18rem,calc(100vw-2rem))]')}>
          {filter.type === 'years' ? (
            <YearRangeForm
              value={value}
              onApply={(v) => {
                onChange(v)
                setOpen(false)
              }}
            />
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
          className={cn(chip, chipActive, 'rounded-l-none border-l-0 px-2 text-muted-foreground hover:text-foreground')}
          aria-label={t('filters.remove', { what: filter.label })}
          onClick={() => onChange(null)}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
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
