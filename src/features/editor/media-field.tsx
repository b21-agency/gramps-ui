import { useTranslation } from 'react-i18next'
import { refThumbUrl } from '@/components/portrait'
import { useAccessToken } from '@/lib/auth'
import { FormSection, RefPicker, RefTitle, RowActions, move } from './fields'
import type { AnyObj } from './lib'

export function mediaRef(handle: string): AnyObj {
  return { _class: 'MediaRef', ref: handle, rect: [], private: false, citation_list: [], note_list: [], attribute_list: [] }
}

/** Gallery of an object (`media_list`): add existing media, reorder (first = main picture), remove. */
export function MediaRefsField({ value, onChange }: { value: AnyObj[]; onChange: (v: AnyObj[]) => void }) {
  const { t } = useTranslation('editor')
  useAccessToken()
  return (
    <FormSection title={t('gallery.title')} count={value.length} collapsible defaultOpen={value.length > 0}>
      {value.map((m, i) => (
        <div key={`${m.ref}-${i}`} className="flex items-center gap-3">
          <img
            src={refThumbUrl({ ref: m.ref, rect: m.rect }, 96)}
            alt=""
            loading="lazy"
            className="size-10 shrink-0 rounded-md bg-muted object-cover"
          />
          <RefTitle kind="media" handle={m.ref} className="flex-1 text-sm" />
          <RowActions
            index={i}
            length={value.length}
            onMove={(d) => onChange(move(value, i, d))}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <RefPicker kind="media" value="" placeholder={t('gallery.add')} onChange={(h) => h && onChange([...value, mediaRef(h)])} />
    </FormSection>
  )
}
