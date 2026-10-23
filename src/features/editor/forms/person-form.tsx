import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { typeStr } from '@/lib/format'
import { useEditorSession, type EditorSession } from '../session'
import { emptyName, type AnyObj } from '../lib'
import { EventsField } from '../events-field'
import { AddressesField } from '../address-field'
import { AssociationsField } from '../associations-field'
import { MediaRefsField } from '../media-field'
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
  move,
  RefTitle,
  focusNewRow,
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
            // each surname keeps its connector and origin right below it
            <div key={i} className="flex flex-col gap-2 [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-3">
              <div className="flex items-center gap-2">
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
                  <RowActions index={i} length={surnames.length} onMove={(d) => setSurnames(move(surnames, i, d))} onRemove={() => setSurnames(surnames.filter((_, j) => j !== i))} />
                )}
              </div>
              {(surnames.length > 1 || s.connector || typeStr(s.origintype)) && (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={s.connector ?? ''}
                    placeholder={t('person.connector')}
                    aria-label={`${t('person.connector')} ${i + 1}`}
                    onChange={(e) => setSurnames(surnames.map((x, j) => (j === i ? { ...x, connector: e.target.value } : x)))}
                  />
                  <TypeCombobox
                    category="name_origin_types"
                    value={s.origintype}
                    ariaLabel={`${t('person.origin')} ${i + 1}${s.surname ? ` (${s.surname})` : ''}`}
                    onChange={(v) => setSurnames(surnames.map((x, j) => (j === i ? { ...x, origintype: v } : x)))}
                  />
                </div>
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
              <ToggleGroupItem
                key={g.value}
                value={String(g.value)}
                className="h-10 rounded-full! px-4 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:font-medium data-[state=on]:text-primary-foreground pointer-coarse:h-11"
              >
                {t(`person.genders.${g.key}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
      </section>

      <FormSection title={t('person.moreName')} collapsible defaultOpen={!!(name.title || name.suffix || name.call || name.nick || name.famnick)}>
        <Grid>
          <TextField label={t('person.callName')} value={name.call} onChange={(v) => setName({ ...name, call: v })} hint={t('person.callNameHint')} />
          <TextField label={t('person.nickname')} value={name.nick} onChange={(v) => setName({ ...name, nick: v })} />
          <TextField label={t('person.famnick')} value={name.famnick} onChange={(v) => setName({ ...name, famnick: v })} />
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
          <div key={i} data-row className="flex flex-col gap-3 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 sm:max-w-60">
                <TypeCombobox
                  category="name_types"
                  value={n.type}
                  ariaLabel={t('person.nameType')}
                  onChange={(v) => onChange({ ...value, alternate_names: alt.map((x, j) => (j === i ? { ...x, type: v } : x)) })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => onChange({ ...value, primary_name: n, alternate_names: alt.map((x, j) => (j === i ? name : x)) })}
              >
                {t('person.makePrimary')}
              </Button>
              <RowActions
                index={i}
                length={alt.length}
                onMove={(d) => onChange({ ...value, alternate_names: move(alt, i, d) })}
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
            onClick={(e) => {
              focusNewRow(e.currentTarget)
              onChange({
                ...value,
                alternate_names: [
                  ...alt,
                  { ...emptyName(), type: 'Married Name', surname_list: [{ _class: 'Surname', surname: '', prefix: '', connector: '', primary: true, origintype: '' }] },
                ],
              })
            }}
          >
            <Plus /> {t('person.addAltName')}
          </Button>
        </div>
      </FormSection>

      <FamilyOrder value={value} onChange={onChange} />
      <MediaRefsField value={value.media_list ?? []} onChange={(v) => onChange({ ...value, media_list: v })} />
      <AttributesField value={value.attribute_list ?? []} onChange={(v) => onChange({ ...value, attribute_list: v })} />
      <AddressesField value={value.address_list ?? []} onChange={(v) => onChange({ ...value, address_list: v })} />
      <AssociationsField value={value.person_ref_list ?? []} onChange={(v) => onChange({ ...value, person_ref_list: v })} />
      <UrlsField value={value.urls ?? []} onChange={(v) => onChange({ ...value, urls: v })} />
      <CommonFields value={value} onChange={onChange} />
    </div>
  )
}

/** Order of the person's parent families (the first is the main one) and own families. Linking/unlinking happens on the family. */
function FamilyOrder({ value, onChange }: { value: AnyObj; onChange: (o: AnyObj) => void }) {
  const { t } = useTranslation('editor')
  const lists = (['parent_family_list', 'family_list'] as const).filter((k) => (value[k]?.length ?? 0) > 1)
  if (!lists.length) return null
  return (
    <FormSection title={t('person.familyOrder')} collapsible defaultOpen={false}>
      <p className="-mt-2 text-xs text-muted-foreground">{t('person.familyOrderHint')}</p>
      {lists.map((k) => {
        const list: string[] = value[k]
        return (
          <div key={k} className="flex flex-col gap-1">
            <span className="text-[13px] font-medium text-muted-foreground">{t(k === 'family_list' ? 'person.ownFamilies' : 'person.parentFamilies')}</span>
            <ul className="flex flex-col divide-y rounded-xl border">
              {list.map((h, i) => (
                <li key={h} className="flex items-center gap-2 py-1 pl-3 pr-1 text-sm">
                  <RefTitle kind="family" handle={h} className="flex-1" />
                  <RowActions index={i} length={list.length} onMove={(d) => onChange({ ...value, [k]: move(list, i, d) })} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </FormSection>
  )
}
