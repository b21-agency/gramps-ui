import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, ChevronDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ObjectSearchList } from '@/components/object-picker'
import { surnameOf, typeStr } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useEditorSession } from '../session'
import { useGrampsTypes } from '../gramps-types'
import { emptyName, emptyObject, type AnyObj } from '../lib'
import { EventsField } from '../events-field'
import { MediaRefsField } from '../media-field'
import {
  AttributesField,
  CommonFields,
  Field,
  FormSection,
  Grid,
  InlineBox,
  RefPicker,
  RefTitle,
  RowActions,
  TextField,
  TypeCombobox,
  move,
} from '../fields'
import { GENDERS } from './person-form'

/** Minimal "new person" form (given name, surname, gender) that adds a Person to the session. */
export function NewPersonInline({
  title,
  initialSurname = '',
  initialGender = 2,
  onCreated,
  onCancel,
}: {
  title: string
  initialSurname?: string
  initialGender?: number
  onCreated: (handle: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation('editor')
  const s = useEditorSession()
  const [given, setGiven] = useState('')
  const [surname, setSurname] = useState(initialSurname)
  const [gender, setGender] = useState(initialGender)
  return (
    <InlineBox
      title={title}
      doneDisabled={!given.trim() && !surname.trim()}
      onCancel={onCancel}
      onDone={() => {
        const p = emptyObject('person')
        p.gender = gender
        p.primary_name = {
          ...emptyName(),
          first_name: given.trim(),
          surname_list: [{ _class: 'Surname', surname: surname.trim(), prefix: '', connector: '', primary: true, origintype: '' }],
        }
        s.create('person', p)
        onCreated(p.handle)
      }}
    >
      <Grid>
        <TextField label={t('person.given')} value={given} onChange={setGiven} autoFocus />
        <TextField label={t('person.surname')} value={surname} onChange={setSurname} />
      </Grid>
      <ToggleGroup type="single" variant="outline" value={String(gender)} onValueChange={(v) => v && setGender(Number(v))} className="flex-wrap justify-start">
        {GENDERS.map((g) => (
          <ToggleGroupItem
            key={g.value}
            value={String(g.value)}
            className="h-10 rounded-full! px-4 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-medium data-[state=on]:text-primary-foreground pointer-coarse:h-11"
          >
            {t(`person.genders.${g.key}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </InlineBox>
  )
}

function PartnerField({
  label,
  value,
  onChange,
  gender,
}: {
  label: string
  value: string
  onChange: (h: string) => void
  gender: number
}) {
  const { t } = useTranslation('editor')
  const [creating, setCreating] = useState(false)
  return (
    <Field label={label}>
      {creating ? (
        <NewPersonInline
          title={t('family.newPartner')}
          initialGender={gender}
          onCancel={() => setCreating(false)}
          onCreated={(h) => {
            onChange(h)
            setCreating(false)
          }}
        />
      ) : (
        <RefPicker
          kind="person"
          value={value}
          onChange={(h) => onChange(h)}
          placeholder={t('family.searchPerson')}
          onCreate={() => setCreating(true)}
          createLabel={t('family.createPerson')}
        />
      )}
    </Field>
  )
}

function ChildRow({
  cref,
  index,
  length,
  onChange,
  onMove,
  onRemove,
}: {
  cref: AnyObj
  index: number
  length: number
  onChange: (r: AnyObj) => void
  onMove: (d: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation('editor')
  const { label } = useGrampsTypes()
  const [open, setOpen] = useState(false)
  const frel = typeStr(cref.frel) || 'Birth'
  const mrel = typeStr(cref.mrel) || 'Birth'
  const special = frel !== 'Birth' || mrel !== 'Birth'
  return (
    <li className="py-1">
      <div className="flex items-center gap-1 pl-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/60"
        >
          <RefTitle kind="person" handle={cref.ref} className="flex-1" />
          {special && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {label(frel)} / {label(mrel)}
            </span>
          )}
          <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
        <RowActions index={index} length={length} onMove={onMove} onRemove={onRemove} />
      </div>
      {open && (
        <div className="mx-1 mt-1 mb-2 rounded-xl border bg-muted/20 p-3">
          <Grid>
            <Field label={t('family.frel')}>
              <TypeCombobox category="child_reference_types" value={frel} onChange={(v) => onChange({ ...cref, frel: v })} />
            </Field>
            <Field label={t('family.mrel')}>
              <TypeCombobox category="child_reference_types" value={mrel} onChange={(v) => onChange({ ...cref, mrel: v })} />
            </Field>
          </Grid>
        </div>
      )}
    </li>
  )
}

export function FamilyForm({ value, onChange }: { value: AnyObj; onChange: (o: AnyObj) => void }) {
  const { t } = useTranslation('editor')
  const s = useEditorSession()
  const [childMode, setChildMode] = useState<'idle' | 'new' | 'pick'>('idle')
  const children: AnyObj[] = value.child_ref_list ?? []
  const events: AnyObj[] = value.event_ref_list ?? []
  const father = s.objOf(value.father_handle)
  const mother = s.objOf(value.mother_handle)
  const familySurname = surnameOf(father?.primary_name) || surnameOf(mother?.primary_name)
  const addChild = (h: string) => {
    if (!h || children.some((c) => c.ref === h) || h === value.father_handle || h === value.mother_handle) return
    onChange({ ...value, child_ref_list: [...children, { _class: 'ChildRef', ref: h, frel: 'Birth', mrel: 'Birth', private: false, citation_list: [], note_list: [] }] })
  }
  const types = events.map((r) => typeStr(s.objOf(r.ref)?.type))

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <PartnerField label={t('family.father')} value={value.father_handle ?? ''} gender={1} onChange={(h) => onChange({ ...value, father_handle: h })} />
        <div className="-my-1 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...value, father_handle: value.mother_handle ?? '', mother_handle: value.father_handle ?? '' })}
          >
            <ArrowLeftRight className="rotate-90" /> {t('family.swap')}
          </Button>
        </div>
        <PartnerField label={t('family.mother')} value={value.mother_handle ?? ''} gender={0} onChange={(h) => onChange({ ...value, mother_handle: h })} />
        <Field label={t('family.relationship')} className="sm:max-w-72">
          <TypeCombobox category="family_relation_types" value={value.type} onChange={(v) => onChange({ ...value, type: v })} />
        </Field>
      </section>

      <FormSection title={t('family.children')} count={children.length}>
        {children.length > 0 ? (
          <ul className="flex flex-col divide-y rounded-xl border">
            {children.map((c, i) => (
              <ChildRow
                key={c.ref}
                cref={c}
                index={i}
                length={children.length}
                onChange={(r) => onChange({ ...value, child_ref_list: children.map((x, j) => (j === i ? r : x)) })}
                onMove={(d) => onChange({ ...value, child_ref_list: move(children, i, d) })}
                onRemove={() => onChange({ ...value, child_ref_list: children.filter((_, j) => j !== i) })}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('family.noChildren')}</p>
        )}
        {childMode === 'new' && (
          <NewPersonInline
            title={t('family.newChild')}
            initialSurname={familySurname}
            onCancel={() => setChildMode('idle')}
            onCreated={(h) => {
              addChild(h)
              setChildMode('idle')
            }}
          />
        )}
        {childMode === 'pick' && (
          <div className="rounded-xl border">
            <ObjectSearchList
              kinds={['person']}
              autoFocus
              placeholder={t('family.searchPerson')}
              onPick={(o) => {
                s.seed([o.object])
                addChild(o.handle)
                setChildMode('idle')
              }}
            />
            <div className="border-t p-1 text-right">
              <Button type="button" variant="ghost" size="sm" onClick={() => setChildMode('idle')}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}
        {childMode === 'idle' && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setChildMode('new')}>
              <Plus /> {t('family.addNewChild')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setChildMode('pick')}>
              {t('family.addExistingChild')}
            </Button>
          </div>
        )}
      </FormSection>

      <EventsField
        value={events}
        onChange={(list) => onChange({ ...value, event_ref_list: list })}
        defaultRole="Family"
        suggestType={() => (!types.includes('Marriage') ? 'Marriage' : 'Divorce')}
      />
      <MediaRefsField value={value.media_list ?? []} onChange={(v) => onChange({ ...value, media_list: v })} />
      <AttributesField value={value.attribute_list ?? []} onChange={(v) => onChange({ ...value, attribute_list: v })} />
      <CommonFields value={value} onChange={onChange} />
    </div>
  )
}
