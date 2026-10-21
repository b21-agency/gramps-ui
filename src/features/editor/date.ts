// Client-side parser/formatter for Gramps dates (the API has no date-parser endpoint).
// Understands English and German input: "1855-06-21", "21.6.1855", "June 1855", "abt 1850",
// "vor 1900", "between 1850 and 1860", "zwischen 1850 und 1860", "von 1850 bis 1860",
// "ca. 1850", "est 1850", "geschätzt 1850", "1850–1860" ...
import type { DateVal } from '@/lib/types'
import { emptyDate } from './lib'

export const MOD = { REGULAR: 0, BEFORE: 1, AFTER: 2, ABOUT: 3, RANGE: 4, SPAN: 5, TEXT: 6, FROM: 7, TO: 8 } as const
export const QUAL = { REGULAR: 0, ESTIMATED: 1, CALCULATED: 2 } as const

type Dmy = [number, number, number]

const MONTHS: Record<string, number> = {}
;[
  ['january', 'jan', 'januar', 'jänner', 'jaenner', 'jän'],
  ['february', 'feb', 'februar', 'feber'],
  ['march', 'mar', 'märz', 'maerz', 'mär', 'mrz'],
  ['april', 'apr'],
  ['may', 'mai'],
  ['june', 'jun', 'juni'],
  ['july', 'jul', 'juli'],
  ['august', 'aug'],
  ['september', 'sep', 'sept'],
  ['october', 'oct', 'oktober', 'okt'],
  ['november', 'nov'],
  ['december', 'dec', 'dezember', 'dez'],
].forEach((names, i) => names.forEach((n) => (MONTHS[n] = i + 1)))

const MONTH_NAMES = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
}

function month(word: string): number | null {
  return MONTHS[word.replace(/\.$/, '')] ?? null
}

function valid([d, m, y]: Dmy): Dmy | null {
  if (y < 0 || y > 9999 || m < 0 || m > 12 || d < 0 || d > 31) return null
  if (d && !m) return null
  if (d && m && y) {
    const dim = new Date(Date.UTC(2000, m, 0)).getUTCDate() // days in month (leap-safe enough)
    if (d > dim) return null
  }
  if (!y && !m && !d) return null
  return [d, m, y]
}

/** Parse a single date ("21.6.1855", "1855-06", "June 21, 1855", "1855") to [day, month, year]. */
export function parseSimple(input: string): Dmy | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ').replace(/,/g, '')
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/))) return valid([+m[3], +m[2], +m[1]])
  if ((m = s.match(/^(\d{3,4})-(\d{1,2})$/))) return valid([0, +m[2], +m[1]])
  if ((m = s.match(/^(\d{1,4})$/))) return valid([0, 0, +m[1]])
  if ((m = s.match(/^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{1,4})$/))) return valid([+m[1], +m[2], +m[3]])
  if ((m = s.match(/^(\d{1,2})[./](\d{3,4})$/))) return valid([0, +m[1], +m[2]])
  if ((m = s.match(/^(\d{1,2})\.? ([\p{L}]+\.?) (\d{1,4})$/u))) {
    const mo = month(m[2])
    return mo ? valid([+m[1], mo, +m[3]]) : null
  }
  if ((m = s.match(/^([\p{L}]+\.?) (\d{1,2})(?:st|nd|rd|th)? (\d{3,4})$/u))) {
    const mo = month(m[1])
    return mo ? valid([+m[2], mo, +m[3]]) : null
  }
  if ((m = s.match(/^([\p{L}]+\.?) (\d{1,4})$/u))) {
    const mo = month(m[1])
    return mo ? valid([0, mo, +m[2]]) : null
  }
  return null
}

const QUALITY_WORDS: Record<string, number> = {
  est: QUAL.ESTIMATED,
  estimated: QUAL.ESTIMATED,
  geschätzt: QUAL.ESTIMATED,
  geschaetzt: QUAL.ESTIMATED,
  gesch: QUAL.ESTIMATED,
  calc: QUAL.CALCULATED,
  calculated: QUAL.CALCULATED,
  berechnet: QUAL.CALCULATED,
  errechnet: QUAL.CALCULATED,
  ber: QUAL.CALCULATED,
}

const MODIFIER_WORDS: Record<string, number> = {
  before: MOD.BEFORE,
  bef: MOD.BEFORE,
  vor: MOD.BEFORE,
  '<': MOD.BEFORE,
  after: MOD.AFTER,
  aft: MOD.AFTER,
  nach: MOD.AFTER,
  '>': MOD.AFTER,
  about: MOD.ABOUT,
  around: MOD.ABOUT,
  circa: MOD.ABOUT,
  ca: MOD.ABOUT,
  c: MOD.ABOUT,
  abt: MOD.ABOUT,
  approx: MOD.ABOUT,
  um: MOD.ABOUT,
  etwa: MOD.ABOUT,
  ungefähr: MOD.ABOUT,
  '~': MOD.ABOUT,
  from: MOD.FROM,
  von: MOD.FROM,
  vom: MOD.FROM,
  ab: MOD.FROM,
  since: MOD.FROM,
  seit: MOD.FROM,
  to: MOD.TO,
  until: MOD.TO,
  bis: MOD.TO,
}

const DUAL: Array<[RegExp, number]> = [
  [/^(?:between|bet|btw|zwischen|zw)\.?\s+(.+?)\s+(?:and|und|&)\s+(.+)$/, MOD.RANGE],
  [/^(?:from|von|vom)\s+(.+?)\s+(?:to|until|till|bis zum|bis zur|bis)\s+(.+)$/, MOD.SPAN],
  [/^(\d{3,4})\s*(?:–|—|-|bis|to)\s*(\d{3,4})$/, MOD.SPAN],
]

/** Split "abt. 1850" / "~1850" / "ca.1850" into [keyword, rest]. */
function splitKeyword(s: string): [string, string] | null {
  const m = s.match(/^([<>~])\s*(.+)$/) ?? s.match(/^([\p{L}]+)\.?\s*(.+)$/u)
  if (!m) return null
  return [m[1], m[2]]
}

/** Parse free text into a Gramps Date. Unparseable text becomes a text-only date (modifier 6). */
export function parseDate(input: string): DateVal {
  const raw = input.trim()
  if (!raw) return emptyDate()
  let s = raw.toLowerCase().replace(/\s+/g, ' ')
  let quality: number = QUAL.REGULAR
  const q = splitKeyword(s)
  if (q && QUALITY_WORDS[q[0]] !== undefined) {
    quality = QUALITY_WORDS[q[0]]
    s = q[1]
  }
  const make = (modifier: number, a: Dmy, b?: Dmy): DateVal => ({
    ...emptyDate(),
    modifier,
    quality,
    dateval: b ? [a[0], a[1], a[2], false, b[0], b[1], b[2], false] : [a[0], a[1], a[2], false],
  })
  for (const [re, mod] of DUAL) {
    const m = s.match(re)
    if (m) {
      const a = parseSimple(m[1])
      const b = parseSimple(m[2])
      if (a && b) return make(mod, a, b)
    }
  }
  const plain = parseSimple(s)
  if (plain) return make(MOD.REGULAR, plain)
  const k = splitKeyword(s)
  if (k && MODIFIER_WORDS[k[0]] !== undefined) {
    const a = parseSimple(k[1])
    if (a) return make(MODIFIER_WORDS[k[0]], a)
  }
  return { ...emptyDate(), modifier: MOD.TEXT, text: raw }
}

export function isEmptyDate(d?: DateVal | null) {
  if (!d) return true
  if (d.modifier === MOD.TEXT) return !d.text
  return !d.dateval || d.dateval.slice(0, 3).every((x) => !x)
}

type Lang = 'en' | 'de'
const WORDS: Record<Lang, Record<string, string>> = {
  en: { 1: 'before', 2: 'after', 3: 'about', 4: 'between', '4b': 'and', 5: 'from', '5b': 'to', 7: 'from', 8: 'to', q1: 'est', q2: 'calc' },
  de: { 1: 'vor', 2: 'nach', 3: 'um', 4: 'zwischen', '4b': 'und', 5: 'von', '5b': 'bis', 7: 'ab', 8: 'bis', q1: 'geschätzt', q2: 'berechnet' },
}

function langOf(lang: string): Lang {
  return lang.startsWith('de') ? 'de' : 'en'
}

/** One [d,m,y] as editable text ("1855-06-21" / "21.6.1855", "June 1855" / "Juni 1855"). */
export function formatDmy([d, m, y]: Dmy, lang: string): string {
  const L = langOf(lang)
  if (y && m && d) return L === 'de' ? `${d}.${m}.${y}` : `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (y && m) return `${MONTH_NAMES[L][m - 1]} ${y}`
  if (y) return String(y)
  if (m && d) return L === 'de' ? `${d}. ${MONTH_NAMES.de[m - 1]}` : `${MONTH_NAMES.en[m - 1]} ${d}`
  return ''
}

/** Date object -> text the parser understands (used to prefill the date input). */
export function formatDate(date: DateVal | null | undefined, lang: string): string {
  if (!date || isEmptyDate(date)) return date?.text ?? ''
  if (date.modifier === MOD.TEXT) return date.text
  const W = WORDS[langOf(lang)]
  const dv = date.dateval
  const a = formatDmy([dv[0], dv[1], dv[2]], lang)
  let s: string
  switch (date.modifier) {
    case MOD.RANGE:
    case MOD.SPAN: {
      const b = formatDmy([dv[4] ?? 0, dv[5] ?? 0, dv[6] ?? 0] as Dmy, lang)
      s = `${W[date.modifier]} ${a} ${W[`${date.modifier}b`]} ${b}`
      break
    }
    case MOD.REGULAR:
      s = a
      break
    default:
      s = `${W[date.modifier] ?? ''} ${a}`.trim()
  }
  if (date.quality === QUAL.ESTIMATED) s = `${W.q1} ${s}`
  if (date.quality === QUAL.CALCULATED) s = `${W.q2} ${s}`
  return s
}

/** Long, human readable single date for the "interpreted as" hint. */
export function longDmy([d, m, y]: Dmy, lang: string): string {
  if (y && m && d) {
    const dt = new Date(Date.UTC(2000, m - 1, d))
    dt.setUTCFullYear(y)
    return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt)
  }
  return formatDmy([d, m, y], lang)
}

/** Same as [a,b] of a range/span. */
export function datePoints(date: DateVal): [Dmy, Dmy | null] {
  const dv = date.dateval
  const a: Dmy = [dv[0], dv[1], dv[2]]
  const b: Dmy | null = dv.length > 4 ? [dv[4] as number, dv[5] as number, dv[6] as number] : null
  return [a, b]
}

/** Two dates are equal for editing purposes. */
export function sameDate(a?: DateVal | null, b?: DateVal | null) {
  if (!a || !b) return isEmptyDate(a) && isEmptyDate(b)
  return (
    a.modifier === b.modifier &&
    a.quality === b.quality &&
    (a.text ?? '') === (b.text ?? '') &&
    JSON.stringify(a.dateval.slice(0, 3).concat(a.dateval.slice(4, 7))) ===
      JSON.stringify(b.dateval.slice(0, 3).concat(b.dateval.slice(4, 7)))
  )
}
