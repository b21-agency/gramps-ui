import type { DateVal, Name, Person, PersonProfile, TypedValue } from './types'

export function typeStr(t: TypedValue | string | undefined | null): string {
  if (!t) return ''
  return typeof t === 'string' ? t : t.string
}

export function surnameOf(name?: Name): string {
  if (!name) return ''
  const primary = name.surname_list?.find((s) => s.primary) ?? name.surname_list?.[0]
  if (!primary) return ''
  return [primary.prefix, primary.surname].filter(Boolean).join(' ')
}

export function fullSurname(name?: Name): string {
  if (!name) return ''
  return (name.surname_list ?? [])
    .map((s) => [s.prefix, s.surname, s.connector].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' ')
}

/** "Given Surname Suffix" in natural reading order. */
export function displayName(name?: Name): string {
  if (!name) return ''
  return [name.title, name.first_name, fullSurname(name), name.suffix].filter(Boolean).join(' ').trim()
}

export function personName(p?: Pick<Person, 'primary_name'> | null): string {
  return p ? displayName(p.primary_name) : ''
}

export function profileName(p?: Partial<PersonProfile> | null): string {
  if (!p) return ''
  const s = [p.name_given, p.name_surname, p.name_suffix].filter(Boolean).join(' ').trim()
  return s || p.name_display || ''
}

export function dateText(d?: DateVal | null): string {
  if (!d) return ''
  if (d.text) return d.text
  return ''
}

/** Extract a 4-digit year from a Gramps display date ("1855-06-21", "abt 1850", "1826/7-04-24 (Julian)"). */
export function yearOf(date?: string | null): number | null {
  if (!date) return null
  const m = date.match(/(\d{3,4})/)
  return m ? Number(m[1]) : null
}

export function lifespan(birth?: { date?: string } | null, death?: { date?: string } | null) {
  const b = yearOf(birth?.date)
  const d = yearOf(death?.date)
  if (!b && !d) return ''
  return `${b ?? '?'} – ${d ?? ''}`.trim()
}

export type Sex = 'M' | 'F' | 'U'
export function sexOfGender(g?: number): Sex {
  return g === 1 ? 'M' : g === 0 ? 'F' : 'U'
}

export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\s-]/gu, '').split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function timeAgo(ts: number, lang: string) {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const diff = ts * 1000 - Date.now()
  const abs = Math.abs(diff)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 864e5],
    ['month', 30 * 864e5],
    ['day', 864e5],
    ['hour', 36e5],
    ['minute', 6e4],
  ]
  for (const [unit, ms] of units) if (abs >= ms) return rtf.format(Math.round(diff / ms), unit)
  return rtf.format(0, 'minute')
}

export function formatTimestamp(ts: number, lang: string) {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(ts * 1000)
}

export function isEmpty(o: object | undefined | null) {
  return !o || Object.keys(o).length === 0
}

// Gramps' age spans always use the plural ("1 years, 1 months"); singular for exactly one
const SINGULAR: Record<string, string> = { years: 'year', months: 'month', days: 'day', Jahre: 'Jahr', Monate: 'Monat', Tage: 'Tag' }

/** An age span from the API ("1 years, 2 months") with proper singulars ("1 year, 2 months"). */
export function ageText(age: string): string {
  return age.replace(/\b1 (years|months|days|Jahre|Monate|Tage)\b/g, (_, unit: string) => `1 ${SINGULAR[unit]}`)
}
