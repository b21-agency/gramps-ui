import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { FormSection, RefPicker, RowActions, move } from './fields'
import type { AnyObj } from './lib'

/** Associations of a person (`person_ref_list`): another person + the kind of association (godfather, witness …). */
export function AssociationsField({ value, onChange }: { value: AnyObj[]; onChange: (v: AnyObj[]) => void }) {
  const { t } = useTranslation('editor')
  const set = (i: number, patch: AnyObj) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <FormSection title={t('associations.title')} count={value.length} collapsible defaultOpen={value.length > 0}>
      {value.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border p-2 sm:flex-row sm:items-center">
          <div className="min-w-0 sm:flex-1">
            <RefPicker
              kind="person"
              value={r.ref}
              clearable={false}
              ariaLabel={t('associations.person')}
              placeholder={t('associations.searchPerson')}
              onChange={(h) => h && set(i, { ref: h })}
            />
          </div>
          <Input
            className="sm:w-48"
            aria-label={t('associations.rel')}
            placeholder={t('associations.relPlaceholder')}
            value={r.rel ?? ''}
            onChange={(e) => set(i, { rel: e.target.value })}
          />
          <RowActions
            index={i}
            length={value.length}
            onMove={(d) => onChange(move(value, i, d))}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
            className="self-end sm:self-auto"
          />
        </div>
      ))}
      <div>
        <RefPicker
          kind="person"
          value=""
          clearable={false}
          placeholder={t('associations.add')}
          onChange={(h) =>
            h && onChange([...value, { _class: 'PersonRef', ref: h, rel: '', private: false, citation_list: [], note_list: [] }])
          }
        />
      </div>
    </FormSection>
  )
}
