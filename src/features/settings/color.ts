/** Gramps colours may be #RRRRGGGGBBBB; <input type=color> needs #rrggbb. */
export function toHex6(c?: string) {
  if (!c) return '#7a8a6a'
  if (/^#[0-9a-f]{12}$/i.test(c)) return `#${c.slice(1, 3)}${c.slice(5, 7)}${c.slice(9, 11)}`.toLowerCase()
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase()
  return '#7a8a6a'
}
