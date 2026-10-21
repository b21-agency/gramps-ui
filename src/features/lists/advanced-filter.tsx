// Advanced filter: any Gramps filter rule of the list's namespace (from /filters/{namespace}),
// combined with all / any / exactly one, each optionally negated; plus a Gramps QL query.
// Stored in the URL (`adv` = JSON, `gql` = text) so it survives reloads and can be shared.
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown, FlaskConical, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { AdaptivePopover } from '@/components/adaptive-popover'
import { ObjectPicker } from '@/components/object-picker'
import { api } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { useTags } from '@/lib/queries'
import { endpointOf, type ObjectKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { Rule } from './rules'

interface ParamType {
  type: string
  options?: Array<{ label: string; value: string }>
  namespace?: string
  default_types?: string
  custom_types?: string
  min?: number
  max?: number
}
interface RuleInfo {
  rule: string
  name: string
  description: string
  category: string
  labels: Array<string | string[]>
  types?: ParamType[]
}

export interface Condition {
  name: string
  values: string[]
  invert?: boolean
}
export interface AdvancedState {
  fn: 'and' | 'or' | 'one'
  conds: Condition[]
}

export function parseAdvanced(raw: string | null): AdvancedState | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as AdvancedState
    if (!v || !Array.isArray(v.conds) || !v.conds.length) return null
    return { fn: ['and', 'or', 'one'].includes(v.fn) ? v.fn : 'and', conds: v.conds.filter((c) => c && typeof c.name === 'string') }
  } catch {
    return null
  }
}

/** The advanced filter as one rule group for the list's `rules` JSON. */
export function advancedRule(adv: AdvancedState | null): Rule | null {
  if (!adv?.conds.length) return null
  const rules: Rule[] = adv.conds.map((c) => {
    const r = c.values.length ? { name: c.name, values: c.values } : { name: c.name }
    return c.invert ? { function: 'and', invert: true, rules: [r] } : r
  })
  return { function: adv.fn, rules }
}

const KNOWN = ['text', 'boolean', 'date', 'datetime', 'tag', 'id', 'integer', 'gramps_type', 'select', 'goql']
const REQUIRED = ['id', 'integer', 'select', 'tag']
const paramType = (info: RuleInfo | undefined, i: number): ParamType => {
  const tp = info?.types?.[i]
  return tp && KNOWN.includes(tp.type) ? tp : { type: 'text' }
}
const paramLabel = (l: string | string[]) => (Array.isArray(l) ? String(l[0] ?? '') : String(l ?? '')).replace(/:$/, '')
// rules that refer to saved custom filters are hidden (custom filters aren't tree-scoped)
const refersToFilter = (r: RuleInfo) =>
  /Filter(Match)?$/.test(r.rule) || (r.types ?? []).some((t) => t?.type === 'filter') || r.labels.some((l) => /filter name/i.test(paramLabel(l)))

function defaults(info: RuleInfo): string[] {
  return info.labels.map((_, i) => {
    const tp = paramType(info, i)
    return tp.type === 'boolean' ? '0' : tp.type === 'select' ? (tp.options?.[0]?.value ?? '') : ''
  })
}

function useCatalogue(kind: ObjectKind, enabled: boolean) {
  const locale = apiLocale()
  return useQuery({
    queryKey: ['filters', endpointOf[kind], locale],
    enabled,
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const d = await api<{ rules: RuleInfo[] }>(`/filters/${endpointOf[kind]}`, { query: { locale } })
      return d.rules.filter((r) => !refersToFilter(r))
    },
  })
}

function useTypeSets(enabled: boolean) {
  return useQuery({
    queryKey: ['types', 'all'],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: () => api<{ default: Record<string, string[]>; custom: Record<string, string[]> }>('/types/'),
  })
}

/** Chip shown in the filter row while an advanced filter is active. */
export function AdvancedChip({ count, gql, onEdit, onClear }: { count: number; gql: boolean; onEdit: () => void; onClear: () => void }) {
  const { t } = useTranslation('lists')
  return (
    <div className="inline-flex max-w-full items-center">
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-8 items-center gap-1.5 rounded-l-full border border-r-0 border-primary/35 bg-primary/10 pr-2 pl-3 text-sm hover:bg-primary/15"
      >
        <FlaskConical className="size-3.5 text-primary" />
        <span className="text-muted-foreground">{t('adv.chip')}</span>
        <span className="font-medium">{[count ? t('adv.conditions', { count }) : null, gql ? 'GQL' : null].filter(Boolean).join(' + ')}</span>
      </button>
      <button
        type="button"
        onClick={onClear}
        aria-label={t('filters.remove', { what: t('adv.chip') })}
        className="inline-flex h-8 items-center rounded-r-full border border-l-0 border-primary/35 bg-primary/10 px-2 text-muted-foreground hover:bg-primary/15 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function AdvancedFilterDialog({
  kind,
  open,
  onOpenChange,
  value,
  gql,
  onApply,
}: {
  kind: ObjectKind
  open: boolean
  onOpenChange: (o: boolean) => void
  value: AdvancedState | null
  gql: string
  onApply: (adv: AdvancedState | null, gql: string) => void
}) {
  const { t } = useTranslation('lists')
  const { data: catalogue, isLoading } = useCatalogue(kind, open)
  const [draft, setDraft] = useState<AdvancedState>(() => value ?? { fn: 'and', conds: [] })
  const [query, setQuery] = useState(gql)
  // reset the draft whenever the dialog opens
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDraft(value ?? { fn: 'and', conds: [] })
      setQuery(gql)
    }
  }
  const byRule = useMemo(() => new Map((catalogue ?? []).map((r) => [r.rule, r])), [catalogue])
  const complete = draft.conds.every((c) => {
    const info = byRule.get(c.name)
    return info?.labels.every((_, i) => !REQUIRED.includes(paramType(info, i).type) || (c.values[i] ?? '') !== '') ?? true
  })
  const setCond = (i: number, c: Condition | null) =>
    setDraft((d) => ({ ...d, conds: c ? d.conds.map((x, j) => (j === i ? c : x)) : d.conds.filter((_, j) => j !== i) }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('adv.title')}</DialogTitle>
          <DialogDescription>{t('adv.description')}</DialogDescription>
        </DialogHeader>
        <div className="-mx-6 min-h-0 flex-1 space-y-4 overflow-y-auto px-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{t('adv.match')}</span>
            <Select value={draft.fn} onValueChange={(v) => setDraft((d) => ({ ...d, fn: v as AdvancedState['fn'] }))}>
              <SelectTrigger className="h-8 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">{t('adv.fn.and')}</SelectItem>
                <SelectItem value="or">{t('adv.fn.or')}</SelectItem>
                <SelectItem value="one">{t('adv.fn.one')}</SelectItem>
              </SelectContent>
            </Select>
            <span>{t('adv.ofConditions')}</span>
          </div>
          <ol className="space-y-3">
            {draft.conds.map((c, i) => (
              <ConditionRow key={i} cond={c} catalogue={catalogue ?? []} info={byRule.get(c.name)} onChange={(n) => setCond(i, n)} />
            ))}
          </ol>
          <RulePicker
            catalogue={catalogue ?? []}
            loading={isLoading}
            onPick={(info) => setDraft((d) => ({ ...d, conds: [...d.conds, { name: info.rule, values: defaults(info) }] }))}
            trigger={
              <Button variant="outline" size="sm">
                <Plus />
                {t('adv.add')}
              </Button>
            }
          />
          <div className="space-y-1.5 border-t pt-4">
            <Label htmlFor="adv-gql">{t('adv.gql')}</Label>
            <Input
              id="adv-gql"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="media_list.length >= 1"
              className="font-mono text-sm"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            <p className="text-xs text-muted-foreground">{t('adv.gqlHint')}</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onApply(null, '')
              onOpenChange(false)
            }}
          >
            {t('filters.clear')}
          </Button>
          <Button
            disabled={!complete}
            onClick={() => {
              onApply(draft.conds.length ? draft : null, query.trim())
              onOpenChange(false)
            }}
          >
            {t('filters.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RulePicker({
  catalogue,
  loading,
  onPick,
  trigger,
}: {
  catalogue: RuleInfo[]
  loading?: boolean
  onPick: (r: RuleInfo) => void
  trigger: ReactNode
}) {
  const { t } = useTranslation('lists')
  const [open, setOpen] = useState(false)
  const groups = useMemo(() => {
    const m = new Map<string, RuleInfo[]>()
    for (const r of catalogue) m.set(r.category, [...(m.get(r.category) ?? []), r])
    return [...m]
  }, [catalogue])
  return (
    <AdaptivePopover open={open} onOpenChange={setOpen} title={t('adv.pick')} size="tall" className="w-[min(32rem,calc(100vw-2rem))] p-0" trigger={trigger}>
      <Command>
        <CommandInput placeholder={t('adv.pick')} autoFocus />
        <CommandList className="max-h-96">
          <CommandEmpty>{loading ? '…' : t('common:noResults')}</CommandEmpty>
          {groups.map(([cat, rules]) => (
            <CommandGroup key={cat} heading={cat}>
              {rules.map((r) => (
                <CommandItem
                  key={r.rule}
                  value={`${r.name} ${r.description} ${r.rule}`}
                  onSelect={() => {
                    onPick(r)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-0">
                    <span className="block">{r.name}</span>
                    <span className="block text-xs text-muted-foreground">{r.description}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </AdaptivePopover>
  )
}

function ConditionRow({
  cond,
  info,
  catalogue,
  onChange,
}: {
  cond: Condition
  info: RuleInfo | undefined
  catalogue: RuleInfo[]
  onChange: (c: Condition | null) => void
}) {
  const { t } = useTranslation('lists')
  const setValue = (i: number, v: string) => onChange({ ...cond, values: cond.values.map((x, j) => (j === i ? v : x)) })
  return (
    <li className="rounded-xl border bg-card p-3">
      <div className="flex items-start gap-2">
        <RulePicker
          catalogue={catalogue}
          onPick={(r) => onChange({ name: r.rule, values: defaults(r), invert: cond.invert })}
          trigger={
            <button type="button" className="flex min-w-0 flex-1 items-start gap-1 rounded-md text-left hover:text-primary">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{info?.name ?? cond.name}</span>
                {info?.description && <span className="block text-xs text-muted-foreground">{info.description}</span>}
              </span>
              <ChevronsUpDown className="mt-0.5 size-4 shrink-0 opacity-50" />
            </button>
          }
        />
        <Button variant="ghost" size="icon" aria-label={t('adv.remove')} onClick={() => onChange(null)}>
          <Trash2 />
        </Button>
      </div>
      {!!info?.labels.length && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {info.labels.map((l, i) => (
            <ParamInput key={i} label={paramLabel(l)} type={paramType(info, i)} value={cond.values[i] ?? ''} onChange={(v) => setValue(i, v)} />
          ))}
        </div>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Switch checked={!!cond.invert} onCheckedChange={(on) => onChange({ ...cond, invert: on })} />
        {t('adv.invert')}
      </label>
    </li>
  )
}

const kindOfNamespace: Record<string, ObjectKind> = {
  person: 'person',
  family: 'family',
  event: 'event',
  place: 'place',
  source: 'source',
  citation: 'citation',
  repository: 'repository',
  note: 'note',
  media: 'media',
}

function ParamInput({ label, type, value, onChange }: { label: string; type: ParamType; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('lists')
  const { data: tags } = useTags()
  const { data: types } = useTypeSets(type.type === 'gramps_type')
  const id = useMemo(() => `p-${Math.random().toString(36).slice(2)}`, [])
  const required = REQUIRED.includes(type.type)
  const field = (() => {
    switch (type.type) {
      case 'boolean':
        return <Switch id={id} checked={value === '1'} onCheckedChange={(on) => onChange(on ? '1' : '0')} />
      case 'select':
      case 'tag': {
        const opts = type.type === 'tag' ? (tags ?? []).map((x) => ({ value: x.name, label: x.name })) : (type.options ?? [])
        return (
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder={t('filters.any')} />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      case 'id': {
        const kind = kindOfNamespace[(type.namespace ?? '').toLowerCase()]
        if (!kind) break
        return (
          <ObjectPicker
            kinds={[kind]}
            value={value ? { handle: value, title: value } : null}
            placeholder={t('adv.pickObject')}
            onChange={(o) => onChange(o.gramps_id)}
          />
        )
      }
      case 'gramps_type': {
        const list = [...(types?.default[type.default_types ?? ''] ?? []), ...(types?.custom[type.custom_types ?? ''] ?? [])]
        return (
          <>
            <Input id={id} list={`${id}-l`} value={value} onChange={(e) => onChange(e.target.value)} />
            <datalist id={`${id}-l`}>
              {list.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </>
        )
      }
      case 'integer':
        return <Input id={id} type="number" inputMode="numeric" min={type.min} max={type.max} value={value} onChange={(e) => onChange(e.target.value)} />
    }
    return (
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(type.type === 'goql' && 'font-mono')}
        placeholder={type.type === 'date' ? t('adv.datePlaceholder') : type.type === 'datetime' ? 'yyyy-mm-dd hh:mm:ss' : undefined}
      />
    )
  })()
  return (
    <div className={cn('space-y-1.5', type.type === 'boolean' && 'flex items-center gap-2 space-y-0')}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label || t('adv.value')}
        {required && <span aria-hidden> *</span>}
      </Label>
      {field}
    </div>
  )
}

