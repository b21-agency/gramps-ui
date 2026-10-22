// Shared form widgets for the object editors.
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { AdaptivePopover } from '@/components/adaptive-popover'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ObjectSearchList } from '@/components/object-picker'
import { tagColor } from '@/components/tag-list'
import { useCreateObjectMutation } from '@/api/enhanced/objects'
import { unwrapApi } from '@/api/enhanced/editor'
import { useObjectByHandle, useTags } from '@/lib/queries'
import { describeObject, kindIcon } from '@/lib/objects'
import { personName, typeStr } from '@/lib/format'
import type { ObjectKind, TypedValue } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useEditorSession } from './session'
import { useGrampsTypes, type TypeCategory } from './gramps-types'
import { emptyObject, type AnyObj } from './lib'
import { formatDate } from './date'
import { DateInput } from './date-input'

/* ---------------- layout ---------------- */

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor} className="text-[13px] font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Heading + hairline section inside a form; optionally collapsible. */
export function FormSection({
  title,
  count,
  children,
  collapsible,
  defaultOpen = true,
  action,
}: {
  title: ReactNode
  count?: number
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  action?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const head = (
    <span className="flex items-baseline gap-2">
      <span className="font-serif text-lg">{title}</span>
      {!!count && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </span>
  )
  if (!collapsible)
    return (
      <section className="border-t pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          {head}
          {action}
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </section>
    )
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger className="-mx-1 flex flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/60">
          {head}
          <ChevronDown className={cn('ml-auto size-4 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className="flex flex-col gap-4 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>{children}</div>
}

/* ---------------- list helpers ---------------- */

export function move<T>(list: T[], i: number, delta: number): T[] {
  const j = i + delta
  if (j < 0 || j >= list.length) return list
  const copy = [...list]
  ;[copy[i], copy[j]] = [copy[j], copy[i]]
  return copy
}

export function RowActions({
  index,
  length,
  onMove,
  onRemove,
  className,
}: {
  index: number
  length: number
  onMove?: (delta: number) => void
  onRemove?: () => void
  className?: string
}) {
  const { t } = useTranslation('editor')
  return (
    <div className={cn('flex shrink-0 items-center', className)}>
      {onMove && length > 1 && (
        <>
          <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-9" aria-label={t('moveUp')} disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-9"
            aria-label={t('moveDown')}
            disabled={index === length - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown />
          </Button>
        </>
      )}
      {onRemove && (
        <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-9" aria-label={t('remove')} onClick={onRemove}>
          <X />
        </Button>
      )}
    </div>
  )
}

/* ---------------- simple inputs ---------------- */

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  hint,
  inputMode,
}: {
  label: ReactNode
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  hint?: ReactNode
  inputMode?: 'decimal' | 'text' | 'url'
}) {
  return (
    <Field label={label} className={className} hint={hint}>
      <Input
        value={value ?? ''}
        placeholder={placeholder}
        autoFocus={autoFocus}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

export function PrivateSwitch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  const { t } = useTranslation('editor')
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
      <Switch checked={!!value} onCheckedChange={onChange} className="mt-0.5" />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Lock className="size-3.5" /> {label ?? t('private.label')}
        </span>
        <span className="block text-xs text-muted-foreground">{t('private.hint')}</span>
      </span>
    </label>
  )
}

/** Combobox for Gramps types: translated defaults, custom values, free text allowed. */
export function TypeCombobox({
  category,
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
}: {
  category: TypeCategory
  value: TypedValue | string | undefined
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  const { t } = useTranslation('editor')
  const { label, options } = useGrampsTypes()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const current = typeStr(value)
  const { defaults, custom } = options(category)
  const ql = q.trim().toLowerCase()
  const match = (s: string) => !ql || label(s).toLowerCase().includes(ql) || s.toLowerCase().includes(ql)
  const exact = [...defaults, ...custom].some((s) => s.toLowerCase() === ql || label(s).toLowerCase() === ql)
  const pick = (s: string) => {
    onChange(s)
    setOpen(false)
    setQ('')
  }
  return (
    <AdaptivePopover
      open={open}
      onOpenChange={setOpen}
      title={ariaLabel ?? placeholder ?? t('choose')}
      size="tall"
      className="w-[min(20rem,calc(100vw-2rem))] p-0"
      trigger={
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={ariaLabel}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className={cn('truncate', !current && 'text-muted-foreground')}>{current ? label(current) : placeholder ?? t('choose')}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      }
    >
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder={t('typeSearch')} autoFocus />
          <CommandList>
            <CommandEmpty>{t('noMatch')}</CommandEmpty>
            {ql && !exact && (
              <CommandGroup>
                <CommandItem value={`__custom_${q}`} onSelect={() => pick(q.trim())}>
                  <Plus />
                  {t('useCustom', { value: q.trim() })}
                </CommandItem>
              </CommandGroup>
            )}
            {custom.filter(match).length > 0 && (
              <CommandGroup heading={t('customTypes')}>
                {custom.filter(match).map((s) => (
                  <CommandItem key={s} value={`c_${s}`} onSelect={() => pick(s)}>
                    {s}
                    {s === current && <Check className="ml-auto" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {custom.length > 0 && <CommandSeparator />}
            <CommandGroup>
              {defaults.filter(match).map((s) => (
                <CommandItem key={s} value={`d_${s}`} onSelect={() => pick(s)}>
                  {label(s)}
                  {s === current && <Check className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
    </AdaptivePopover>
  )
}

/* ---------------- tags ---------------- */

const TAG_COLORS = ['#7a8f3f', '#b08a3e', '#a8553a', '#4f7a8a', '#7a5a8a', '#5a5a5a']

export function TagsField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useTranslation('editor')
  const tags = useTags()
  const [createObject] = useCreateObjectMutation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const all = tags.data ?? []
  const selected = value.map((h) => all.find((x) => x.handle === h)).filter(Boolean) as typeof all
  const toggle = (h: string) => onChange(value.includes(h) ? value.filter((x) => x !== h) : [...value, h])
  const ql = q.trim().toLowerCase()
  const exists = all.some((x) => x.name.toLowerCase() === ql)
  const createTag = async () => {
    const name = q.trim()
    if (!name) return
    setCreating(true)
    try {
      const color = TAG_COLORS[all.length % TAG_COLORS.length]
      // invalidates the tag list itself (Tags LIST from the transaction)
      const tx = await unwrapApi(createObject({ kind: 'tag', body: { _class: 'Tag', name, color, priority: all.length } }))
      await tags.refetch() // show the new tag as selected right away
      const h = tx[0]?.handle
      if (h) onChange([...value, h])
      setQ('')
    } catch (e) {
      toast.error(t('tagCreateFailed'), { description: (e as Error).message })
    } finally {
      setCreating(false)
    }
  }
  return (
    <Field label={t('tags')}>
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((tag) => (
          <span key={tag.handle} className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-1 pl-2 text-xs">
            <span className="size-2 rounded-full" style={{ background: tagColor(tag.color) }} />
            {tag.name}
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('removeTag', { name: tag.name })}
              onClick={() => toggle(tag.handle)}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <AdaptivePopover
          open={open}
          onOpenChange={setOpen}
          title={t('addTag')}
          className="w-64 p-0"
          trigger={
            <Button type="button" variant="outline" size="sm">
              <Plus /> {t('addTag')}
            </Button>
          }
        >
            <Command shouldFilter={false}>
              <CommandInput value={q} onValueChange={setQ} placeholder={t('tagSearch')} autoFocus />
              <CommandList>
                <CommandGroup>
                  {all
                    .filter((x) => !ql || x.name.toLowerCase().includes(ql))
                    .map((tag) => (
                      <CommandItem key={tag.handle} value={tag.handle} onSelect={() => toggle(tag.handle)}>
                        <span className="size-2.5 rounded-full" style={{ background: tagColor(tag.color) }} />
                        {tag.name}
                        {value.includes(tag.handle) && <Check className="ml-auto" />}
                      </CommandItem>
                    ))}
                </CommandGroup>
                {ql && !exists && (
                  <CommandGroup>
                    <CommandItem value="__create" disabled={creating} onSelect={createTag}>
                      <Plus />
                      {t('createTag', { name: q.trim() })}
                    </CommandItem>
                  </CommandGroup>
                )}
                {!all.length && !ql && <div className="p-3 text-sm text-muted-foreground">{t('noTags')}</div>}
              </CommandList>
            </Command>
        </AdaptivePopover>
      </div>
    </Field>
  )
}

/* ---------------- referenced objects ---------------- */

/** Title of a local (unsaved or seeded) object, without profile. */
export function describeLocal(kind: ObjectKind, o: AnyObj | undefined, lang: string, label: (s: string) => string) {
  if (!o) return ''
  switch (kind) {
    case 'person':
      return personName(o as never) || o.gramps_id || ''
    case 'event': {
      const d = formatDate(o.date, lang)
      return [label(typeStr(o.type)), d].filter(Boolean).join(', ')
    }
    case 'place':
      return o.name?.value || o.title || o.gramps_id || ''
    case 'note':
      return (o.text?.string ?? '').slice(0, 90) || o.gramps_id || ''
    case 'citation':
      return o.page || o.gramps_id || ''
    default:
      return describeObject(kind, o).title
  }
}

/** Title for a referenced object: unsaved objects from the session, others fetched (profile=self). */
export function useRefTitle(kind: ObjectKind, handle: string | null | undefined) {
  const { i18n } = useTranslation()
  const s = useEditorSession()
  const { label } = useGrampsTypes()
  const local = s.objOf(handle)
  const preferLocal = !!local && (s.isNew(handle!) || ['person', 'event', 'place', 'note', 'source', 'repository', 'media'].includes(kind))
  const q = useObjectByHandle<AnyObj>(kind, preferLocal ? null : handle, { profile: 'self' })
  if (!handle) return { title: '', subtitle: '', loading: false }
  if (preferLocal) return { title: describeLocal(kind, local, i18n.language, label), subtitle: local?.gramps_id ?? '', loading: false }
  if (q.data) {
    const d = describeObject(kind, q.data)
    return { title: d.title, subtitle: d.subtitle || q.data.gramps_id, loading: false }
  }
  return { title: q.isError ? handle : '', subtitle: '', loading: q.isLoading }
}

export function RefTitle({ kind, handle, className }: { kind: ObjectKind; handle: string; className?: string }) {
  const { title, loading } = useRefTitle(kind, handle)
  const s = useEditorSession()
  const { t } = useTranslation('editor')
  return (
    <span className={cn('min-w-0 truncate', className)}>
      {loading ? <span className="text-muted-foreground">…</span> : title}
      {s.isNew(handle) && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t('new')}</span>}
    </span>
  )
}

/** Pick one object (search) with optional "create new" footer. */
export function RefPicker({
  kind,
  value,
  onChange,
  placeholder,
  onCreate,
  createLabel,
  clearable = true,
  ariaLabel,
}: {
  kind: ObjectKind
  value: string | null | undefined
  onChange: (handle: string, object?: AnyObj) => void
  placeholder?: string
  onCreate?: () => void
  createLabel?: string
  clearable?: boolean
  ariaLabel?: string
}) {
  const { t } = useTranslation('editor')
  const s = useEditorSession()
  const [open, setOpen] = useState(false)
  const Icon = kindIcon[kind]
  return (
    <div className="flex min-w-0 items-center gap-1">
      <AdaptivePopover
        open={open}
        onOpenChange={setOpen}
        title={ariaLabel ?? placeholder ?? t('choose')}
        size="tall"
        className="w-[min(26rem,calc(100vw-2rem))] p-0"
        trigger={
          <Button type="button" variant="outline" role="combobox" aria-label={ariaLabel} className="min-w-0 flex-1 justify-between font-normal">
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="text-muted-foreground" />
              {value ? <RefTitle kind={kind} handle={value} /> : <span className="truncate text-muted-foreground">{placeholder ?? t('choose')}</span>}
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        }
      >
          <ObjectSearchList
            kinds={[kind]}
            selected={value}
            autoFocus
            placeholder={placeholder}
            onPick={(o) => {
              s.seed([o.object])
              onChange(o.handle, o.object)
              setOpen(false)
            }}
          />
          {onCreate && (
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  setOpen(false)
                  onCreate()
                }}
              >
                <Plus /> {createLabel ?? t('createNew')}
              </Button>
            </div>
          )}
      </AdaptivePopover>
      {clearable && value && (
        <Button type="button" variant="ghost" size="icon" aria-label={t('clear')} onClick={() => onChange('')}>
          <X />
        </Button>
      )}
    </div>
  )
}

/** Small bordered box used for inline "create new …" mini forms. */
export function InlineBox({
  title,
  children,
  onCancel,
  onDone,
  doneLabel,
  doneDisabled,
}: {
  title: ReactNode
  children: ReactNode
  onCancel: () => void
  onDone: () => void
  doneLabel?: ReactNode
  doneDisabled?: boolean
}) {
  const { t } = useTranslation(['editor', 'common'])
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3">
      <p className="text-sm font-medium">{title}</p>
      {children}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="button" size="sm" onClick={onDone} disabled={doneDisabled}>
          {doneLabel ?? t('editor:add')}
        </Button>
      </div>
    </div>
  )
}

/** Inline mini form for a new place (name, type, enclosed by). Returns the handle via onCreated. */
export function NewPlaceInline({ onCreated, onCancel, initialName = '' }: { onCreated: (h: string) => void; onCancel: () => void; initialName?: string }) {
  const { t } = useTranslation('editor')
  const s = useEditorSession()
  const [name, setName] = useState(initialName)
  const [type, setType] = useState('City')
  const [parent, setParent] = useState('')
  return (
    <InlineBox
      title={t('place.newTitle')}
      doneDisabled={!name.trim()}
      onCancel={onCancel}
      onDone={() => {
        const p = emptyObject('place')
        p.name = { _class: 'PlaceName', value: name.trim(), lang: '' }
        p.place_type = type
        if (parent) p.placeref_list = [{ _class: 'PlaceRef', ref: parent }]
        s.create('place', p)
        onCreated(p.handle)
      }}
    >
      <Grid>
        <TextField label={t('place.name')} value={name} onChange={setName} autoFocus />
        <Field label={t('place.type')}>
          <TypeCombobox category="place_types" value={type} onChange={setType} />
        </Field>
      </Grid>
      <Field label={t('place.enclosedBy')}>
        <RefPicker kind="place" value={parent} onChange={setParent} placeholder={t('place.enclosedByPlaceholder')} />
      </Field>
    </InlineBox>
  )
}

/** Place picker with inline creation. */
export function PlaceField({ value, onChange, label }: { value: string; onChange: (h: string) => void; label?: ReactNode }) {
  const { t } = useTranslation('editor')
  const [creating, setCreating] = useState(false)
  return (
    <Field label={label ?? t('event.place')}>
      {creating ? (
        <NewPlaceInline
          onCancel={() => setCreating(false)}
          onCreated={(h) => {
            onChange(h)
            setCreating(false)
          }}
        />
      ) : (
        <RefPicker
          kind="place"
          value={value}
          onChange={(h) => onChange(h)}
          placeholder={t('place.search')}
          onCreate={() => setCreating(true)}
          createLabel={t('place.createNew')}
        />
      )}
    </Field>
  )
}

/* ---------------- notes & citations ---------------- */

export function NotesField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useTranslation('editor')
  const s = useEditorSession()
  const [mode, setMode] = useState<'idle' | 'new' | 'pick'>('idle')
  const [text, setText] = useState('')
  const [type, setType] = useState('General')
  return (
    <FormSection title={t('notes.title')} count={value.length} collapsible defaultOpen={value.length > 0}>
      {value.length > 0 && (
        <ul className="flex flex-col divide-y rounded-xl border">
          {value.map((h, i) => (
            <li key={h} className="flex items-center gap-2 py-1.5 pr-1 pl-3 text-sm">
              <NoteSnippet handle={h} />
              <RowActions
                index={i}
                length={value.length}
                onMove={(d) => onChange(move(value, i, d))}
                onRemove={() => onChange(value.filter((x) => x !== h))}
              />
            </li>
          ))}
        </ul>
      )}
      {mode === 'new' && (
        <InlineBox
          title={t('notes.newTitle')}
          doneDisabled={!text.trim()}
          onCancel={() => setMode('idle')}
          onDone={() => {
            const n = emptyObject('note')
            n.text = { _class: 'StyledText', string: text, tags: [] }
            n.type = type
            s.create('note', n)
            onChange([...value, n.handle])
            setText('')
            setMode('idle')
          }}
        >
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} autoFocus placeholder={t('notes.placeholder')} />
          <Field label={t('notes.type')} className="sm:max-w-60">
            <TypeCombobox category="note_types" value={type} onChange={setType} />
          </Field>
        </InlineBox>
      )}
      {mode === 'pick' && (
        <div className="rounded-xl border">
          <ObjectSearchList
            kinds={['note']}
            autoFocus
            placeholder={t('notes.search')}
            onPick={(o) => {
              s.seed([o.object])
              if (!value.includes(o.handle)) onChange([...value, o.handle])
              setMode('idle')
            }}
          />
          <div className="border-t p-1 text-right">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode('idle')}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setMode('new')}>
            <Plus /> {t('notes.add')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode('pick')}>
            {t('notes.attach')}
          </Button>
        </div>
      )}
    </FormSection>
  )
}

function NoteSnippet({ handle }: { handle: string }) {
  const { title, loading } = useRefTitle('note', handle)
  const s = useEditorSession()
  const { t } = useTranslation('editor')
  return (
    <span className="line-clamp-2 min-w-0 flex-1">
      {loading ? '…' : title || <span className="text-muted-foreground">{t('notes.empty')}</span>}
      {s.isNew(handle) && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t('new')}</span>}
    </span>
  )
}

export const CONFIDENCE = [0, 1, 2, 3, 4] as const

export function ConfidenceSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation('editor')
  return (
    <Select value={String(value ?? 2)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONFIDENCE.map((c) => (
          <SelectItem key={c} value={String(c)}>
            {t(`citation.confidence${c}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CitationsField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t, i18n } = useTranslation('editor')
  const s = useEditorSession()
  const [mode, setMode] = useState<'idle' | 'new' | 'pick'>('idle')
  const [source, setSource] = useState('')
  const [newSource, setNewSource] = useState<string | null>(null)
  const [page, setPage] = useState('')
  const [date, setDate] = useState<AnyObj | null>(null)
  const [confidence, setConfidence] = useState(2)
  const reset = () => {
    setSource('')
    setNewSource(null)
    setPage('')
    setDate(null)
    setConfidence(2)
    setMode('idle')
  }
  return (
    <FormSection title={t('citations.title')} count={value.length} collapsible defaultOpen={value.length > 0}>
      {value.length > 0 && (
        <ul className="flex flex-col divide-y rounded-xl border">
          {value.map((h, i) => (
            <li key={h} className="flex items-center gap-2 py-1.5 pr-1 pl-3 text-sm">
              <CitationLine handle={h} />
              <RowActions
                index={i}
                length={value.length}
                onMove={(d) => onChange(move(value, i, d))}
                onRemove={() => onChange(value.filter((x) => x !== h))}
              />
            </li>
          ))}
        </ul>
      )}
      {mode === 'new' && (
        <InlineBox
          title={t('citations.newTitle')}
          doneDisabled={!(source || newSource?.trim())}
          onCancel={reset}
          onDone={() => {
            let sh = source
            if (newSource !== null) {
              const src = emptyObject('source')
              src.title = newSource.trim()
              s.create('source', src)
              sh = src.handle
            }
            const c = emptyObject('citation')
            c.source_handle = sh
            c.page = page
            c.confidence = confidence
            if (date) c.date = date
            s.create('citation', c)
            onChange([...value, c.handle])
            reset()
          }}
        >
          <Field label={t('citation.source')}>
            {newSource !== null ? (
              <div className="flex gap-1">
                <Input value={newSource} autoFocus placeholder={t('source.titlePlaceholder')} onChange={(e) => setNewSource(e.target.value)} />
                <Button type="button" variant="ghost" size="icon" aria-label={t('cancel')} onClick={() => setNewSource(null)}>
                  <X />
                </Button>
              </div>
            ) : (
              <RefPicker
                kind="source"
                value={source}
                onChange={setSource}
                placeholder={t('citation.sourceSearch')}
                onCreate={() => setNewSource('')}
                createLabel={t('source.createNew')}
              />
            )}
          </Field>
          <Grid>
            <TextField label={t('citation.page')} value={page} onChange={setPage} hint={t('citation.pageHint')} />
            <Field label={t('citation.confidence')}>
              <ConfidenceSelect value={confidence} onChange={setConfidence} />
            </Field>
          </Grid>
          <DateInput label={t('date')} value={date as never} onChange={(d) => setDate(d)} lang={i18n.language} />
        </InlineBox>
      )}
      {mode === 'pick' && (
        <div className="rounded-xl border">
          <ObjectSearchList
            kinds={['citation']}
            autoFocus
            placeholder={t('citations.search')}
            onPick={(o) => {
              s.seed([o.object])
              if (!value.includes(o.handle)) onChange([...value, o.handle])
              setMode('idle')
            }}
          />
          <div className="border-t p-1 text-right">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode('idle')}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setMode('new')}>
            <Plus /> {t('citations.add')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode('pick')}>
            {t('citations.attach')}
          </Button>
        </div>
      )}
    </FormSection>
  )
}

function CitationLine({ handle }: { handle: string }) {
  const s = useEditorSession()
  const local = s.isNew(handle) ? s.objOf(handle) : undefined
  const { title, subtitle, loading } = useRefTitle('citation', handle)
  const src = useRefTitle('source', local?.source_handle)
  const { t } = useTranslation('editor')
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate">
        {loading ? '…' : local ? src.title || t('citation.untitled') : title}
        {s.isNew(handle) && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t('new')}</span>}
      </span>
      <span className="block truncate text-xs text-muted-foreground">{local ? local.page : subtitle}</span>
    </span>
  )
}

/* ---------------- attributes & urls ---------------- */

export function AttributesField({
  value,
  onChange,
  category = 'attribute_types',
}: {
  value: AnyObj[]
  onChange: (v: AnyObj[]) => void
  category?: TypeCategory
}) {
  const { t } = useTranslation('editor')
  const cls = category === 'source_attribute_types' ? 'SrcAttribute' : 'Attribute'
  return (
    <FormSection title={t('attributes.title')} count={value.length} collapsible defaultOpen={false}>
      {value.map((a, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border p-2 sm:flex-row sm:items-center">
          <div className="sm:w-48">
            <TypeCombobox
              category={category}
              value={a.type}
              ariaLabel={t('attributes.type')}
              onChange={(v) => onChange(value.map((x, j) => (j === i ? { ...x, type: v } : x)))}
            />
          </div>
          <Input
            className="flex-1"
            aria-label={t('attributes.value')}
            placeholder={t('attributes.value')}
            value={a.value ?? ''}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
          />
          <RowActions index={i} length={value.length} onRemove={() => onChange(value.filter((_, j) => j !== i))} className="self-end sm:self-auto" />
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { _class: cls, type: category === 'source_attribute_types' ? 'Unknown' : 'Description', value: '', private: false, citation_list: [], note_list: [] }])}
        >
          <Plus /> {t('attributes.add')}
        </Button>
      </div>
    </FormSection>
  )
}

export function UrlsField({ value, onChange }: { value: AnyObj[]; onChange: (v: AnyObj[]) => void }) {
  const { t } = useTranslation('editor')
  return (
    <FormSection title={t('urls.title')} count={value.length} collapsible defaultOpen={false}>
      {value.map((u, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border p-2">
          <div className="flex items-center gap-2">
            <Input
              className="flex-1"
              inputMode="url"
              placeholder="https://…"
              aria-label={t('urls.path')}
              value={u.path ?? ''}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, path: e.target.value } : x)))}
            />
            <RowActions index={i} length={value.length} onRemove={() => onChange(value.filter((_, j) => j !== i))} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              className="flex-1"
              placeholder={t('urls.desc')}
              aria-label={t('urls.desc')}
              value={u.desc ?? ''}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))}
            />
            <div className="sm:w-44">
              <TypeCombobox
                category="url_types"
                value={u.type}
                ariaLabel={t('urls.type')}
                onChange={(v) => onChange(value.map((x, j) => (j === i ? { ...x, type: v } : x)))}
              />
            </div>
          </div>
        </div>
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { _class: 'Url', path: '', desc: '', type: 'Web Home', private: false }])}
        >
          <Plus /> {t('urls.add')}
        </Button>
      </div>
    </FormSection>
  )
}

/** Tags + private + notes + citations block shared by all forms. */
export function CommonFields({
  value,
  onChange,
  notes = true,
  citations = true,
}: {
  value: AnyObj
  onChange: (o: AnyObj) => void
  notes?: boolean
  citations?: boolean
}) {
  const { t } = useTranslation('editor')
  return (
    <>
      {citations && <CitationsField value={value.citation_list ?? []} onChange={(v) => onChange({ ...value, citation_list: v })} />}
      {notes && <NotesField value={value.note_list ?? []} onChange={(v) => onChange({ ...value, note_list: v })} />}
      <FormSection title={t('organize')}>
        <TagsField value={value.tag_list ?? []} onChange={(v) => onChange({ ...value, tag_list: v })} />
        <PrivateSwitch value={!!value.private} onChange={(v) => onChange({ ...value, private: v })} />
      </FormSection>
    </>
  )
}

/** Delete-confirm icon button used inside lists. */
export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" className="pointer-coarse:size-9" aria-label={label} onClick={onClick}>
      <Trash2 />
    </Button>
  )
}
