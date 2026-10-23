import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from './date-input'
import { FormSection, PrivateSwitch, RowActions, focusNewRow, move } from './fields'
import { emptyDate, type AnyObj } from './lib'

const PARTS = ['street', 'locality', 'city', 'postal', 'county', 'state', 'country', 'phone'] as const

export function emptyAddress(): AnyObj {
  return {
    _class: 'Address',
    street: '',
    locality: '',
    city: '',
    county: '',
    state: '',
    country: '',
    postal: '',
    phone: '',
    date: emptyDate(),
    private: false,
    citation_list: [],
    note_list: [],
  }
}

/** Postal addresses (repositories, people): street … phone, a date range and privacy per address. */
export function AddressesField({ value, onChange }: { value: AnyObj[]; onChange: (v: AnyObj[]) => void }) {
  const { t, i18n } = useTranslation('editor')
  const set = (i: number, patch: AnyObj) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <FormSection title={t('address.title')} count={value.length} collapsible defaultOpen={value.length > 0}>
      {value.map((a, i) => (
        <div key={i} data-row className="flex flex-col gap-2 rounded-xl border p-3">
          <div className="flex items-start gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
              {PARTS.map((k) => (
                <Input
                  key={k}
                  className={k === 'street' ? 'sm:col-span-2' : undefined}
                  placeholder={t(`address.${k}`)}
                  aria-label={t(`address.${k}`)}
                  inputMode={k === 'phone' ? 'tel' : undefined}
                  value={a[k] ?? ''}
                  onChange={(e) => set(i, { [k]: e.target.value })}
                />
              ))}
            </div>
            <RowActions
              index={i}
              length={value.length}
              onMove={(d) => onChange(move(value, i, d))}
              onRemove={() => onChange(value.filter((_, j) => j !== i))}
            />
          </div>
          <DateInput label={t('address.date')} value={a.date} lang={i18n.language} onChange={(d) => set(i, { date: d })} />
          <PrivateSwitch value={!!a.private} onChange={(v) => set(i, { private: v })} />
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={(e) => {
            focusNewRow(e.currentTarget)
            onChange([...value, emptyAddress()])
          }}>
          <Plus /> {t('address.add')}
        </Button>
      </div>
    </FormSection>
  )
}
