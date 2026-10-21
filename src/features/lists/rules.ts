// Gramps filter rules (`rules=` JSON on list endpoints). See reference 5.3.

export interface SimpleRule {
  name: string
  values?: string[]
  regex?: boolean
}
export interface RuleGroup {
  function?: 'and' | 'or' | 'one'
  invert?: boolean
  rules: Rule[]
}
export type Rule = SimpleRule | RuleGroup

export const rule = (name: string, ...values: string[]): SimpleRule => ({ name, values })
export const or = (...rules: Rule[]): RuleGroup => ({ function: 'or', rules })
export const and = (...rules: Rule[]): RuleGroup => ({ function: 'and', rules })
export const not = (...rules: Rule[]): RuleGroup => ({ function: 'and', invert: true, rules })

/** Tag filter: same rule name in every namespace. */
export const hasTag = (name: string) => rule('HasTag', name)

/** Text filter: every word must match (rule per word), IDs like "I0044" also match by ID. */
export function textFilter(q: string, perWord: (word: string) => Rule): Rule | null {
  const words = q.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return null
  const text = and(...words.map(perWord))
  if (words.length === 1 && /^[a-z]{0,3}\d{2,}$/i.test(words[0])) {
    return or(text, { name: 'RegExpIdOf', values: [escapeRegex(words[0])], regex: true })
  }
  return text
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// The server parses rule dates with its own locale's date parser, so the range must be
// written in the tree's language (same table as the classic UI).
const BETWEEN: Record<string, string> = {
  ar: 'بين 1111 و 2222', bg: 'между 1111 и 2222', ca: 'entre 1111 i 2222', cs: 'mezi 1111 a 2222',
  da: 'mellem 1111 og 2222', de: 'zwischen 1111 und 2222', el: 'μεταξύ 1111 και 2222', en: 'between 1111 and 2222',
  es: 'entre 1111 y 2222', fi: '1111 ja 2222 välillä', fr: 'entre 1111 et 2222', hr: 'između 1111 i 2222',
  hu: '1111 és 2222 között', is: 'milli 1111 og 2222', it: 'tra 1111 e 2222', ja: '1111と2222の間',
  lt: 'tarp 1111 ir 2222', nb: 'mellom 1111 og 2222', nl: 'tussen 1111 en 2222', nn: 'mellom 1111 og 2222',
  pl: 'między 1111 a 2222', pt: 'entre 1111 e 2222', ru: 'между 1111 и 2222', sk: 'medzi 1111 a 2222',
  sl: 'med 1111 in 2222', sr: 'између 1111 и 2222', sv: 'mellan 1111 och 2222', uk: 'між 1111 та 2222',
  zh: ' 介于 1111 与 2222 之间',
}
let serverLang = 'en'
/** Language of the tree's date parser (`metadata.locale.language`). */
export function setRuleDateLang(lang: string | null | undefined) {
  if (lang) serverLang = lang
}

/** "1800-1850", "1800-", "-1850" -> Gramps date string usable by HasBirth/HasDeath/HasData. */
export function yearRangeDate(value: string): string | null {
  const { from, to } = parseYearRange(value)
  if (from == null && to == null) return null
  const tpl = BETWEEN[serverLang] ?? BETWEEN[serverLang.split(/[_-]/)[0]] ?? BETWEEN.en
  // Gramps' "after/before" only reach 50 years; use explicit bounds instead
  return tpl.replace('1111', String(from ?? 1)).replace('2222', String(to ?? 9999))
}

export function parseYearRange(value: string | null | undefined): { from: number | null; to: number | null } {
  if (!value) return { from: null, to: null }
  const [a, b] = value.split('-')
  const n = (s?: string) => (s && /^\d{1,4}$/.test(s) ? Number(s) : null)
  return { from: n(a), to: b === undefined ? n(a) : n(b) }
}

export function formatYearRange(value: string): string {
  const { from, to } = parseYearRange(value)
  if (from != null && to != null) return from === to ? String(from) : `${from}–${to}`
  if (from != null) return `${from}–`
  if (to != null) return `–${to}`
  return ''
}
