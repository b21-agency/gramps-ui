import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarCheck2, CircleHelp } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DateVal } from '@/lib/types'
import { cn } from '@/lib/utils'
import { datePoints, formatDate, isEmptyDate, longDmy, MOD, parseDate, QUAL, sameDate } from './date'

/** Human description of a parsed date ("About 1850 · estimated"). */
export function useDescribeDate() {
  const { t, i18n } = useTranslation('editor')
  return (d: DateVal | null | undefined) => {
    if (!d || isEmptyDate(d)) return ''
    if (d.modifier === MOD.TEXT) return t('dateInput.interp.text', { text: d.text })
    const [a, b] = datePoints(d)
    const A = longDmy(a, i18n.language)
    const B = b ? longDmy(b, i18n.language) : ''
    let s = t(`dateInput.interp.m${d.modifier}`, { a: A, b: B })
    if (d.quality === QUAL.ESTIMATED) s += ` · ${t('dateInput.estimated')}`
    if (d.quality === QUAL.CALCULATED) s += ` · ${t('dateInput.calculated')}`
    if (d.calendar) s += ` · ${t('dateInput.otherCalendar')}`
    return s
  }
}

/**
 * Free-text Gramps date input ("21.6.1855", "abt 1850", "zwischen 1850 und 1860" ...),
 * shows how the text was understood and lets the user set the quality.
 */
export function DateInput({
  value,
  onChange,
  label,
  lang,
  className,
  autoFocus,
}: {
  value: DateVal | null | undefined
  onChange: (d: DateVal) => void
  label?: string
  lang?: string
  className?: string
  autoFocus?: boolean
}) {
  const { t, i18n } = useTranslation('editor')
  const language = lang ?? i18n.language
  const id = useId()
  const describe = useDescribeDate()
  const original = useRef(value)
  const emitted = useRef<DateVal | null | undefined>(value)
  const [text, setText] = useState(() => formatDate(value, language))

  // external value changes (e.g. form reset) re-sync the text
  useEffect(() => {
    if (value !== emitted.current) {
      original.current = value
      emitted.current = value
      setText(formatDate(value, language))
    }
  }, [value, language])

  const emit = (d: DateVal) => {
    emitted.current = d
    onChange(d)
  }

  const onText = (s: string) => {
    setText(s)
    const parsed = parseDate(s)
    // keep the stored object (calendar, newyear ...) when the meaning did not change
    if (original.current && sameDate(parsed, original.current)) emit(original.current)
    else emit(parsed)
  }

  const current = value && !isEmptyDate(value) ? value : null
  const hint = describe(current)
  const isText = current?.modifier === MOD.TEXT

  const setQuality = (q: number) => {
    if (!current || isText) return
    const d = { ...current, quality: q }
    setText(formatDate(d, language))
    emit(d)
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={id} className="text-[13px] font-medium text-muted-foreground">
          {label}
        </Label>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={text}
          autoFocus={autoFocus}
          placeholder={t('dateInput.placeholder')}
          onChange={(e) => onText(e.target.value)}
          onBlur={() => current && !isText && setText(formatDate(current, language))}
          aria-describedby={`${id}-hint`}
          className="flex-1"
        />
        <Select value={String(current?.quality ?? 0)} onValueChange={(v) => setQuality(Number(v))} disabled={!current || isText}>
          <SelectTrigger className="w-auto min-w-28" aria-label={t('dateInput.quality')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="0">{t('dateInput.regular')}</SelectItem>
            <SelectItem value="1">{t('dateInput.estimated')}</SelectItem>
            <SelectItem value="2">{t('dateInput.calculated')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p id={`${id}-hint`} className={cn('flex items-start gap-1.5 text-xs', isText ? 'text-brass' : 'text-muted-foreground')} aria-live="polite">
        {current ? (
          <>
            {isText ? <CircleHelp className="mt-px size-3.5 shrink-0" /> : <CalendarCheck2 className="mt-px size-3.5 shrink-0" />}
            <span>{hint}</span>
          </>
        ) : (
          <span>{t('dateInput.examples')}</span>
        )}
      </p>
    </div>
  )
}
