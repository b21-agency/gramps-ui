// Turns the Gramps report option definitions (options_dict + options_help from
// GET /reports/?include_help=1) into form fields.
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { translationMap, usePostTranslationQuery } from '@/api/enhanced/metadata-slice-enhanced'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ObjectPicker } from '@/components/object-picker'

export interface ReportDef {
  id: string
  name: string
  description: string
  authors?: string[]
  version?: string
  category: number
  options_dict: Record<string, unknown>
  options_help: Record<string, [string, string, string[] | string]>
  report_modes?: number[]
}

export type FieldKind = 'bool' | 'select' | 'person' | 'family' | 'number' | 'text'

export interface OptionField {
  key: string
  kind: FieldKind
  help: string
  /** for select/person/family: value → label */
  choices: Array<{ value: string; label: string }>
  defaultValue: string
  group: 'main' | 'more' | 'layout'
  /** input hint from options_help for free-text options ("A number", "Size in cm", …) */
  hint?: string
}

const HIDDEN = new Set(['of', 'css', 'sections', 'gidlist'])
const MAIN = [
  'off',
  'pid',
  'family_id',
  'filter',
  'maxgen',
  'gen',
  'maxascend',
  'maxdescend',
  'tag',
  'year',
  'living_people',
  'incl_private',
  'trans',
]
const LAYOUT = new Set(['papers', 'papero', 'papermt', 'papermb', 'paperml', 'papermr', 'style'])

function parseChoice(raw: string) {
  const i = raw.indexOf('\t')
  if (i < 0) return { value: raw, label: raw }
  const value = raw.slice(0, i).replace(/:$/, '')
  const label = raw.slice(i).replace(/^\t+/, '').trim()
  return { value, label: label || value }
}

const str = (v: unknown) => (typeof v === 'boolean' ? (v ? 'True' : 'False') : v == null ? '' : String(v))

/** Build the visible form fields for a report, in a sensible order. */
export function reportFields(def: ReportDef, prefs: { lang: string; homePerson?: string | null }): OptionField[] {
  const out: OptionField[] = []
  for (const [key, help] of Object.entries(def.options_help)) {
    if (HIDDEN.has(key)) continue
    const dflt = def.options_dict[key]
    if (Array.isArray(dflt)) continue // list-valued display formats: keep the report's defaults
    const [, text, spec] = help
    let kind: FieldKind = 'text'
    let choices: OptionField['choices'] = []
    if (Array.isArray(spec)) {
      if (spec.length === 2 && spec[0] === 'False' && spec[1] === 'True') kind = 'bool'
      else {
        choices = spec.map(parseChoice)
        if (key === 'pid' || /^I\d+$/.test(choices[0]?.value ?? '')) kind = 'person'
        else if (key === 'family_id' || /^F\d+$/.test(choices[0]?.value ?? '')) kind = 'family'
        else kind = 'select'
      }
    } else if (/number|size in cm/i.test(spec) || typeof dflt === 'number') kind = 'number'
    if (key === 'style' && choices.length <= 1) continue

    let defaultValue = str(dflt)
    if (key === 'off' && !choices.some((c) => c.value === defaultValue))
      defaultValue = (choices.find((c) => c.value === 'pdf' || c.value === 'gvpdf') ?? choices[0])?.value ?? ''
    if (key === 'trans' && choices.some((c) => c.value === prefs.lang)) defaultValue = prefs.lang
    if (kind === 'person' && prefs.homePerson && choices.some((c) => c.value === prefs.homePerson))
      defaultValue = prefs.homePerson
    if (kind === 'select' && choices.length && !choices.some((c) => c.value === defaultValue))
      defaultValue = choices[0].value

    out.push({
      key,
      kind,
      help: text.trim(),
      choices,
      defaultValue,
      // "A number"/"Any text" only restate the input type; other hints (e.g. "Size in cm") help
      hint: typeof spec === 'string' && spec.trim() && !/^(a number|any text)$/i.test(spec.trim()) ? spec.trim() : undefined,
      group: MAIN.includes(key) ? 'main' : LAYOUT.has(key) || key.startsWith('paper') ? 'layout' : 'more',
    })
  }
  const rank = (f: OptionField) => (f.group === 'main' ? MAIN.indexOf(f.key) : 100)
  return out.sort((a, b) => rank(a) - rank(b))
}

/**
 * Gramps report texts (names, option labels, choices) are English; like the classic UI, translate
 * them with the backend's Gramps translations (POST /translations/{lang}).
 */
export function useGrampsText(strings: string[]) {
  const { i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage ?? i18n.language ?? 'en').slice(0, 2)
  const unique = [...new Set(strings.filter(Boolean))].sort()
  const q = usePostTranslationQuery(
    lang !== 'en' && unique.length > 0 ? { language: lang, translationPostArgs: { strings: unique } } : skipToken,
  )
  const map = translationMap(q.data)
  return (s: string) => map[s] || s
}

/** All Gramps strings a report form shows, for useGrampsText. */
export function reportStrings(def: ReportDef, fields: OptionField[]) {
  return [
    def.name,
    def.description,
    ...fields.flatMap((f) => [
      f.help.split('\n')[0].replace(/\.$/, ''),
      f.hint ?? '',
      ...(f.kind === 'select' ? f.choices.map((c) => c.label) : []),
    ]),
  ]
}

function humanize(key: string) {
  const s = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function OptionInput({
  field,
  value,
  onChange,
  tr = (s) => s,
}: {
  field: OptionField
  value: string
  onChange: (v: string) => void
  /** translates Gramps strings (see useGrampsText) */
  tr?: (s: string) => string
}) {
  const { t, i18n } = useTranslation('tools')
  const id = `opt-${field.key}`
  const helpLine = field.help.split('\n')[0].replace(/\.$/, '')
  const label = i18n.exists(`tools:reports.options.${field.key}`)
    ? t(`reports.options.${field.key}`)
    : (helpLine && tr(helpLine)) || humanize(field.key)

  if (field.kind === 'bool')
    return (
      <div className="flex items-start justify-between gap-4 py-1">
        <Label htmlFor={id} className="leading-snug font-normal">
          {label}
        </Label>
        <Switch id={id} checked={value === 'True'} onCheckedChange={(c) => onChange(c ? 'True' : 'False')} />
      </div>
    )

  let control: React.ReactNode
  if (field.kind === 'person' || field.kind === 'family') {
    const current = field.choices.find((c) => c.value === value)
    control = (
      <ObjectPicker
        kinds={[field.kind]}
        value={current ? { handle: current.value, title: `${current.label.replace(/^,\s*/, '')} · ${current.value}` } : null}
        placeholder={field.kind === 'person' ? t('reports.choosePerson') : t('reports.chooseFamily')}
        onChange={(o) => onChange(o.gramps_id)}
      />
    )
  } else if (field.kind === 'select') {
    const label = (c: { value: string; label: string }) =>
      field.key === 'off' ? t(`reports.formats.${c.value}`, { defaultValue: c.label }) : tr(c.label)
    control = (
      <Select value={value || '_empty'} onValueChange={(v) => onChange(v === '_empty' ? '' : v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {field.choices.map((c) => (
            <SelectItem key={c.value || '_empty'} value={c.value || '_empty'}>
              {label(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  } else {
    control = (
      <Input
        id={id}
        type={field.kind === 'number' ? 'number' : 'text'}
        step="any"
        inputMode={field.kind === 'number' ? 'decimal' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={field.hint ? `${id}-hint` : undefined}
      />
    )
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="leading-snug">
        {label}
      </Label>
      {control}
      {field.hint && (field.kind === 'text' || field.kind === 'number') && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {tr(field.hint)}
        </p>
      )}
    </div>
  )
}
