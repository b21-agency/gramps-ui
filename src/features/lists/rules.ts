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

/** "1800-1850", "1800-", "-1850" -> Gramps date string usable by HasBirth/HasDeath/HasData. */
export function yearRangeDate(value: string): string | null {
  const { from, to } = parseYearRange(value)
  if (from == null && to == null) return null
  if (from != null && to != null && from === to) return `between ${from} and ${to}`
  // Gramps' "after/before" only reach 50 years; use explicit bounds instead
  return `between ${from ?? 1} and ${to ?? 9999}`
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
