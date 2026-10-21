import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { typeStr } from '@/lib/format'
import { useEditorSession, type EditorSession } from '../session'
import { emptyName, type AnyObj } from '../lib'
import { EventsField } from '../events-field'
import {
  AttributesField,
  CommonFields,
  Field,
  FormSection,
  Grid,
  RowActions,
  TextField,
  TypeCombobox,
  UrlsField,
} from '../fields'

export const GENDERS = [
  { value: 0, key: 'female' },
  { value: 1, key: 'male' },
  { value: 2, key: 'unknown' },
  { value: 3, key: 'other' },
] as const

/** Index of the birth/death reference: keep the current one if still valid, else first primary Birth/Death. */
export function personVitalIndexes(p: AnyObj, objOf: EditorSession['objOf'], prev?: { birth?: string; death?: string }) {
  const refs: AnyObj[] = p.event_ref_list ?? []
  const pick = (type: string, prevRef?: string) => {
    if (prevRef) {
      const i = refs.findIndex((r) => r.ref === prevRef)
      const ev = objOf(prevRef)
      if (i >= 0 && (!ev || typeStr(ev.type) === type)) return i
    }
    return refs.findIndex((r) => typeStr(r.role || 'Primary') === 'Primary' && typeStr(objOf(r.ref)?.type) === type)
  }
  return { birth_ref_index: pick('Birth', prev?.birth), death_ref_index: pick('Death', prev?.death) }
}

function NameFields({ name, onChange, compact }: { name: AnyObj; onChange: (n: AnyObj) => void; compact?: boolean }) {
  const { t } = useTranslation('editor')
  const surnames: AnyObj[] = name.surname_list?.length ? name.surname_list : emptyName().surname_list
  const setSurnames = (list: AnyObj[]) => {
    if (list.length && !list.some((s) => s.primary)) list = list.map((s, i) => ({ ...s, primary: i === 0 }))
    onChange({ ...name, surname_list: list })
  }
  return (
    <div className="flex flex-col gap-3">
      <TextField label={t('person.given')} value={name.first_name} onChange={(v) => onChange({ ...name, first_name: v })} autoFocus={!compact && !name.first_name} />
      <Field label={surnames.length > 1 ? t('person.surnames') : t('person.surname')}>
        <div className="flex flex-col gap-2">
          {surnames.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="w-20 shrink-0 sm:w-24"
                value={s.prefix ?? ''}
                placeholder={t('person.prefix')}
                aria-label={t('person.prefix')}
                onChange={(e) => setSurnames(surnames.map((x, j) => (j === i ? { ...x, prefix: e.target.value } : x)))}
              />
              <Input
                className="flex-1"
                value={s.surname ?? ''}
                aria-label={t('person.surname')}
                onChange={(e) => setSurnames(surnames.map((x, j) => (j === i ? { ...x, surname: e.target.value } : x)))}
              />
              {surnames.length > 1 && (
                <RowActions index={i} length={surnames.length} onRemove={() => setSurnames(surnames.filter((_, j) => j !== i))} />
              )}
            </div>
          ))}
          {!compact && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setSurnames([...surnames, { _class: 'Surname', surname: '', prefix: '', connector: '', primary: false, origintype: '' }])}
            >
              <Plus /> {t('person.addSurname')}
            </Button>
          )}
        </div>
      </Field>
    </div>
  )
}

export function PersonForm({ value, onChange }: { value: AnyObj; onChange: (o: AnyObj) => void }) {
  const { t } = useTranslation('editor')
  const s = useEditorSession()
  const name: AnyObj = value.primary_name ?? emptyName()
  const setName = (n: AnyObj) => onChange({ ...value, primary_name: n })
  const refs: AnyObj[] = value.event_ref_list ?? []
  const idx = personVitalIndexes(value, s.objOf, {
    birth: refs[value.birth_ref_index]?.ref,
    death: refs[value.death_ref_index]?.ref,
  })
  const badges: Record<string, string> = {}
  if (idx.birth_ref_index >= 0) badges[refs[idx.birth_ref_index].ref] = t('person.birthBadge')
  if (idx.death_ref_index >= 0) badges[refs[idx.death_ref_index].ref] = t('person.deathBadge')
  const types = refs.map((r) => typeStr(s.objOf(r.ref)?.type))
  const alt: AnyObj[] = value.alternate_names ?? []

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <NameFields name={name} onChange={setName} />
        <Field label={t('person.gender')}>
          <ToggleGroup
            type="single"
            variant="outline"
            value={String(value.gender ?? 2)}
            onValueChange={(v) => v && onChange({ ...value, gender: Number(v) })}
            className="flex-wrap justify-start"
          >
            {GENDERS.map((g) => (
              <ToggleGroupItem key={g.value} value={String(g.value)} className="px-3">
                {t(`person.genders.${g.key}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      </section>

      <FormSection title={t('person.moreName')} collapsible defaultOpen={!!(name.title || name.suffix || name.call || name.nick)}>
        <Grid>
          <TextField label={t('person.callName')} value={name.call} onChange={(v) => setName({ ...name, call: v })} hint={t('person.callNameHint')} />
          <TextField label={t('person.nickname')} value={name.nick} onChange={(v) => setName({ ...name, nick: v })} />
          <TextField label={t('person.title')} value={name.title} onChange={(v) => setName({ ...name, title: v })} placeholder={t('person.titlePlaceholder')} />
          <TextField label={t('person.suffix')} value={name.suffix} onChange={(v) => setName({ ...name, suffix: v })} placeholder={t('person.suffixPlaceholder')} />
          <Field label={t('person.nameType')}>
            <TypeCombobox category="name_types" value={name.type} onChange={(v) => setName({ ...name, type: v })} />
          </Field>
        </Grid>
      </FormSection>

      <EventsField
        value={refs}
        onChange={(list) => {
          const next = { ...value, event_ref_list: list }
          onChange({ ...next, ...personVitalIndexes(next, s.objOf, { birth: refs[value.birth_ref_index]?.ref, death: refs[value.death_ref_index]?.ref }) })
        }}
        defaultRole="Primary"
        badges={badges}
        suggestType={() => (!types.includes('Birth') ? 'Birth' : !types.includes('Death') ? 'Death' : 'Residence')}
      />

      <FormSection title={t('person.altNames')} count={alt.length} collapsible defaultOpen={false}>
        {alt.map((n, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 sm:max-w-60">
                <TypeCombobox
                  category="name_types"
                  value={n.type}
                  ariaLabel={t('person.nameType')}
                  onChange={(v) => onChange({ ...value, alternate_names: alt.map((x, j) => (j === i ? { ...x, type: v } : x)) })}
                />
              </div>
              <RowActions
                className="ml-auto"
                index={i}
                length={alt.length}
                onRemove={() => onChange({ ...value, alternate_names: alt.filter((_, j) => j !== i) })}
              />
            </div>
            <NameFields compact name={n} onChange={(nn) => onChange({ ...value, alternate_names: alt.map((x, j) => (j === i ? nn : x)) })} />
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                alternate_names: [
                  ...alt,
                  { ...emptyName(), type: 'Married Name', surname_list: [{ _class: 'Surname', surname: '', prefix: '', connector: '', primary: true, origintype: '' }] },
                ],
              })
            }
          >
            <Plus /> {t('person.addAltName')}
          </Button>
        </div>
      </FormSection>

      <AttributesField value={value.attribute_list ?? []} onChange={(v) => onChange({ ...value, attribute_list: v })} />
      <UrlsField value={value.urls ?? []} onChange={(v) => onChange({ ...value, urls: v })} />
      <CommonFields value={value} onChange={onChange} />
    </div>
  )
}
