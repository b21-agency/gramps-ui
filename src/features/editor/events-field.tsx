import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ObjectSearchList } from '@/components/object-picker'
import { useObjectByHandle } from '@/lib/queries'
import { typeStr } from '@/lib/format'
import type { DateVal, ObjectKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useEditorSession } from './session'
import { useGrampsTypes } from './gramps-types'
import { emptyObject, type AnyObj } from './lib'
import { formatDate } from './date'
import { DateInput } from './date-input'
import { Field, FormSection, Grid, PlaceField, RefTitle, RowActions, TypeCombobox, move } from './fields'

/** Object from the session, fetched (and seeded) when not known yet. */
export function useSessionObject(kind: ObjectKind, handle: string | null | undefined) {
  const s = useEditorSession()
  const local = s.objOf(handle)
  const q = useObjectByHandle<AnyObj>(kind, local ? null : handle)
  useEffect(() => {
    if (q.data) s.seed([q.data])
  }, [q.data, s])
  return local ?? q.data
}

/** Type, date, place, description of one event (used by the event form and inline in lists). */
export function EventCoreFields({ value, onChange, autoFocus }: { value: AnyObj; onChange: (o: AnyObj) => void; autoFocus?: boolean }) {
  const { t, i18n } = useTranslation('editor')
  return (
    <>
      <Grid>
        <Field label={t('event.type')}>
          <TypeCombobox category="event_types" value={value.type} onChange={(v) => onChange({ ...value, type: v })} />
        </Field>
        <DateInput label={t('date')} value={value.date} onChange={(d) => onChange({ ...value, date: d })} lang={i18n.language} autoFocus={autoFocus} />
      </Grid>
      <PlaceField value={value.place ?? ''} onChange={(h) => onChange({ ...value, place: h })} />
      <Field label={t('event.description')}>
        <Input value={value.description ?? ''} onChange={(e) => onChange({ ...value, description: e.target.value })} placeholder={t('event.descriptionPlaceholder')} />
      </Field>
    </>
  )
}

function EventRow({
  eref,
  index,
  length,
  defaultRole,
  open,
  onToggle,
  onRefChange,
  onMove,
  onRemove,
  badge,
}: {
  eref: AnyObj
  index: number
  length: number
  defaultRole: string
  open: boolean
  onToggle: () => void
  onRefChange: (r: AnyObj) => void
  onMove: (d: number) => void
  onRemove: () => void
  badge?: string
}) {
  const { t, i18n } = useTranslation('editor')
  const s = useEditorSession()
  const { label } = useGrampsTypes()
  const ev = useSessionObject('event', eref.ref)
  const role = typeStr(eref.role)
  const date = ev ? formatDate(ev.date as DateVal, i18n.language) : ''
  return (
    <li className="py-1">
      <div className="flex items-center gap-1 pl-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-muted/60"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-medium">
              {ev ? label(typeStr(ev.type)) || t('event.untitled') : '…'}
              {badge && <span className="rounded-full bg-brass/15 px-1.5 py-0.5 text-[10px] font-normal text-brass">{badge}</span>}
              {s.isNew(eref.ref) && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-normal text-primary">{t('new')}</span>}
              {role && role !== defaultRole && <span className="text-xs font-normal text-muted-foreground">({label(role)})</span>}
            </span>
            <span className="flex min-w-0 gap-1.5 text-xs text-muted-foreground">
              <span className="shrink-0 tabular-nums">{date || t('event.noDate')}</span>
              {ev?.place && (
                <>
                  <span aria-hidden>·</span>
                  <RefTitle kind="place" handle={ev.place} />
                </>
              )}
            </span>
          </span>
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
        <RowActions index={index} length={length} onMove={onMove} onRemove={onRemove} />
      </div>
      {open && ev && (
        <div className="mx-1 mt-1 mb-2 flex flex-col gap-3 rounded-xl border bg-muted/20 p-3">
          <EventCoreFields value={ev} onChange={(o) => s.update('event', o)} autoFocus={s.isNew(eref.ref)} />
          <Field label={t('event.role')} className="sm:max-w-60">
            <TypeCombobox category="event_role_types" value={eref.role} onChange={(v) => onRefChange({ ...eref, role: v })} />
          </Field>
          {!s.isNew(eref.ref) && <p className="text-xs text-muted-foreground">{t('event.sharedHint')}</p>}
        </div>
      )}
    </li>
  )
}

/**
 * Event references of a person or family: add new / link existing, edit inline, reorder, remove.
 * `badges` maps ref handle -> label (e.g. "Birth" for the birth reference).
 */
export function EventsField({
  value,
  onChange,
  defaultRole,
  suggestType,
  badges,
}: {
  value: AnyObj[]
  onChange: (v: AnyObj[]) => void
  defaultRole: 'Primary' | 'Family'
  suggestType: () => string
  badges?: Record<string, string>
}) {
  const { t } = useTranslation('editor')
  const s = useEditorSession()
  const [open, setOpen] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const addNew = () => {
    const ev = emptyObject('event')
    ev.type = suggestType()
    s.create('event', ev)
    onChange([...value, { _class: 'EventRef', ref: ev.handle, role: defaultRole, private: false, citation_list: [], note_list: [], attribute_list: [] }])
    setOpen(ev.handle)
  }
  return (
    <FormSection title={t('events.title')} count={value.length}>
      {value.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-xl border">
          {value.map((r, i) => (
            <EventRow
              key={r.ref}
              eref={r}
              index={i}
              length={value.length}
              defaultRole={defaultRole}
              badge={badges?.[r.ref]}
              open={open === r.ref}
              onToggle={() => setOpen(open === r.ref ? null : r.ref)}
              onRefChange={(nr) => onChange(value.map((x, j) => (j === i ? nr : x)))}
              onMove={(d) => onChange(move(value, i, d))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('events.none')}</p>
      )}
      {picking ? (
        <div className="rounded-xl border">
          <ObjectSearchList
            kinds={['event']}
            autoFocus
            placeholder={t('events.search')}
            onPick={(o) => {
              s.seed([o.object])
              if (!value.some((r) => r.ref === o.handle))
                onChange([...value, { _class: 'EventRef', ref: o.handle, role: defaultRole, private: false, citation_list: [], note_list: [], attribute_list: [] }])
              setPicking(false)
            }}
          />
          <div className="border-t p-1 text-right">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addNew}>
            <Plus /> {t('events.add')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>
            {t('events.link')}
          </Button>
        </div>
      )}
    </FormSection>
  )
}
