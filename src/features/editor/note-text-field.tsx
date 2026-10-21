import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bold, Italic, Link2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ObjectPicker } from '@/components/object-picker'
import { classOf, type AnyObj } from './lib'
import { Field } from './fields'
import { hasUnsupportedStyling, parseMarkdownish, toMarkdownish, type StyledTag } from '@/features/blog/styled-text'
import { cn } from '@/lib/utils'

const LINK_KINDS = ['person', 'family', 'event', 'place', 'source', 'citation', 'repository', 'media', 'note'] as const

/**
 * Note text with light formatting: bold, italic, web links and links to other records
 * (`gramps://Person/handle/…`), edited as **bold**, *italic*, [text](link). Notes with
 * styling this cannot express (underline, colours …) are edited as plain text, and their
 * styling is kept as long as the text is unchanged.
 */
export function NoteTextField({ value, onChange }: { value: AnyObj; onChange: (o: AnyObj) => void }) {
  const { t } = useTranslation('editor')
  const ref = useRef<HTMLTextAreaElement>(null)
  const tags = (value.text?.tags ?? []) as StyledTag[]
  // decided once: can the existing styling round-trip through the markdown-ish text?
  const [rich, setRich] = useState(() => tags.length > 0 && !hasUnsupportedStyling(tags))
  const [plainOnly] = useState(() => hasUnsupportedStyling(tags))
  const [original] = useState(value.text?.string ?? '')
  const [src, setSrc] = useState(() => (rich ? toMarkdownish({ string: value.text?.string ?? '', tags }) : (value.text?.string ?? '')))

  const emit = (next: string, asRich = rich) => {
    setSrc(next)
    if (asRich) {
      const parsed = parseMarkdownish(next)
      onChange({ ...value, text: { _class: 'StyledText', string: parsed.string, tags: parsed.tags } })
    } else {
      // formatting ranges no longer match edited text; keep them only while the text is unchanged
      onChange({ ...value, text: { _class: 'StyledText', string: next, tags: next === original ? (value.text?.tags ?? []) : [] } })
    }
  }

  const wrap = (before: string, after: string, placeholder: string) => {
    const el = ref.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    const sel = src.slice(a, b) || placeholder
    setRich(true)
    emit(src.slice(0, a) + before + sel + after + src.slice(b), true)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + before.length, a + before.length + sel.length)
    })
  }
  const addWebLink = () => {
    const url = window.prompt(t('note.linkPrompt'), 'https://')
    if (!url || url === 'https://') return
    wrap('[', `](${url.trim()})`, t('note.linkText'))
  }

  const tool = 'size-8'
  return (
    <Field label={t('note.text')} hint={plainOnly ? t('note.markupHint') : rich ? t('note.formatHint') : undefined}>
      <div className="flex flex-col gap-1.5">
        {!plainOnly && (
          <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label={t('note.formatting')}>
            <Button type="button" variant="ghost" size="icon" className={tool} aria-label={t('note.bold')} title={t('note.bold')} onClick={() => wrap('**', '**', t('note.bold'))}>
              <Bold />
            </Button>
            <Button type="button" variant="ghost" size="icon" className={tool} aria-label={t('note.italic')} title={t('note.italic')} onClick={() => wrap('*', '*', t('note.italic'))}>
              <Italic />
            </Button>
            <Button type="button" variant="ghost" size="icon" className={tool} aria-label={t('note.webLink')} title={t('note.webLink')} onClick={addWebLink}>
              <Link2 />
            </Button>
            <ObjectPicker
              kinds={[...LINK_KINDS]}
              placeholder={t('note.recordLink')}
              onChange={(o) => {
                const label = ref.current && ref.current.selectionEnd > ref.current.selectionStart ? '' : o.title
                wrap('[', `](gramps://${classOf[o.kind]}/handle/${o.handle})`, label || o.title)
              }}
              trigger={
                <Button type="button" variant="ghost" size="sm" className="h-8 text-muted-foreground" title={t('note.recordLink')}>
                  <UserRound />
                  {t('note.recordLink')}
                </Button>
              }
            />
          </div>
        )}
        <Textarea
          ref={ref}
          value={src}
          rows={14}
          autoFocus={!src}
          className={cn('min-h-64', value.format === 1 && 'font-mono text-sm')}
          onChange={(e) => emit(e.target.value)}
        />
      </div>
    </Field>
  )
}
