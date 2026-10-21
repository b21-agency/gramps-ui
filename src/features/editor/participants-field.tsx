import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ObjectSearchList } from '@/components/object-picker'
import { useEditorSession } from './session'
import { Field, FormSection, RefTitle, RowActions, TypeCombobox } from './fields'

export interface Participant {
  kind: 'person' | 'family'
  handle: string
  role: string
}

/** People / families a new event will be linked to (each gets an event reference with the role). */
export function ParticipantsField({ value, onChange }: { value: Participant[]; onChange: (v: Participant[]) => void }) {
  const { t } = useTranslation('editor')
  const s = useEditorSession()
  const [picking, setPicking] = useState(false)
  return (
    <FormSection title={t('participants.title')} count={value.length}>
      <p className="-mt-2 text-xs text-muted-foreground">{t('participants.hint')}</p>
      {value.map((p, i) => (
        <div key={`${p.handle}-${i}`} className="flex flex-col gap-2 rounded-xl border p-2 sm:flex-row sm:items-center">
          <RefTitle kind={p.kind} handle={p.handle} className="flex-1 px-1 text-sm font-medium" />
          <Field label={t('event.role')} className="sm:w-48 [&>label]:sr-only">
            <TypeCombobox
              category="event_role_types"
              value={p.role}
              ariaLabel={t('event.role')}
              onChange={(v) => onChange(value.map((x, j) => (j === i ? { ...x, role: v } : x)))}
            />
          </Field>
          <RowActions index={i} length={value.length} onRemove={() => onChange(value.filter((_, j) => j !== i))} className="self-end sm:self-auto" />
        </div>
      ))}
      {picking ? (
        <div className="rounded-xl border">
          <ObjectSearchList
            kinds={['person', 'family']}
            autoFocus
            placeholder={t('participants.searchHint')}
            onPick={(o) => {
              s.seed([o.object])
              const kind = o.kind === 'family' ? 'family' : 'person'
              if (!value.some((x) => x.handle === o.handle)) onChange([...value, { kind, handle: o.handle, role: kind === 'family' ? 'Family' : 'Primary' }])
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
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
            <Plus /> {t('participants.add')}
          </Button>
        </div>
      )}
    </FormSection>
  )
}
