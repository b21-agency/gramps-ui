// A tiny markdown-ish dialect for notes: **bold**, *italic*, [text](url).
// Converted to Gramps StyledText (plain string + tag ranges) so the server renders HTML,
// and back again for editing. Paragraphs are plain blank lines.

const tagValue: Record<string, number> = {
  bold: 0,
  italic: 1,
  underline: 2,
  fontface: 3,
  fontsize: 4,
  fontcolor: 5,
  highlight: 6,
  superscript: 7,
  link: 8,
}

export interface StyledTag {
  name: string | { _class?: string; value?: number; string?: string }
  value: string | null
  ranges: Array<[number, number]>
}

function tagName(n: StyledTag['name']): string {
  if (typeof n === 'string') return n.toLowerCase()
  const entry = Object.entries(tagValue).find(([, v]) => v === n.value)
  return entry?.[0] ?? n.string ?? ''
}

/** Serialize tags for the API (`_class` form the server accepts on write). */
export function writableTags(tags: StyledTag[]) {
  return tags.map((t) => {
    const name = tagName(t.name)
    return {
      _class: 'StyledTextTag',
      name: { _class: 'StyledTextTagType', value: tagValue[name] ?? 0, string: '' },
      value: t.value ?? null,
      ranges: t.ranges,
    }
  })
}

// inline images (as in Gramps Web): one U+FFFC covered by a link to gramps://Media/handle/<h>,
// written here as ![caption](gramps://Media/handle/<h>)
export const IMAGE_PLACEHOLDER = '\uFFFC'
const MEDIA_LINK = /^gramps:\/\/Media\/handle\/([^/#?\s)]+)/
export const mediaLinkHandle = (v?: string | null) => MEDIA_LINK.exec(v ?? '')?.[1] ?? null

const pattern =
  /!\[[^\]\n]*\]\((gramps:\/\/Media\/handle\/[^)\s]+)\)|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g

/** markdown-ish → StyledText */
export function parseMarkdownish(src: string): { string: string; tags: ReturnType<typeof writableTags> } {
  let out = ''
  let last = 0
  const bold: Array<[number, number]> = []
  const italic: Array<[number, number]> = []
  const links = new Map<string, Array<[number, number]>>()
  for (const m of src.matchAll(pattern)) {
    out += src.slice(last, m.index)
    const start = out.length
    if (m[1] != null) {
      out += IMAGE_PLACEHOLDER
      links.set(m[1], [...(links.get(m[1]) ?? []), [start, out.length]])
    } else if (m[2] != null) {
      out += m[2]
      bold.push([start, out.length])
    } else if (m[3] != null) {
      out += m[3]
      italic.push([start, out.length])
    } else {
      out += m[4]
      const href = m[5]
      links.set(href, [...(links.get(href) ?? []), [start, out.length]])
    }
    last = m.index + m[0].length
  }
  out += src.slice(last)
  const tags: StyledTag[] = []
  if (bold.length) tags.push({ name: 'bold', value: null, ranges: bold })
  if (italic.length) tags.push({ name: 'italic', value: null, ranges: italic })
  for (const [href, ranges] of links) tags.push({ name: 'link', value: href, ranges })
  return { string: out, tags: writableTags(tags) }
}

/** StyledText → markdown-ish (bold, italic and links survive; other styling is dropped). */
export function toMarkdownish(text: { string: string; tags?: StyledTag[] }): string {
  const s = text.string ?? ''
  const inserts: Array<{ at: number; str: string; order: number }> = []
  for (const t of text.tags ?? []) {
    const name = tagName(t.name)
    for (const [a, b] of t.ranges) {
      if (b <= a) continue
      if (name === 'bold') {
        inserts.push({ at: a, str: '**', order: 0 }, { at: b, str: '**', order: 10 })
      } else if (name === 'italic') {
        inserts.push({ at: a, str: '*', order: 1 }, { at: b, str: '*', order: 11 })
      } else if (name === 'link' && mediaLinkHandle(t.value) && b - a === 1 && s[a] === IMAGE_PLACEHOLDER) {
        // the placeholder itself is dropped below; the image token replaces it
        inserts.push({ at: a, str: `![image](${t.value}`, order: 2 }, { at: b, str: ')', order: 12 })
      } else if (name === 'link' && t.value) {
        inserts.push({ at: a, str: '[', order: 2 }, { at: b, str: `](${t.value})`, order: 12 })
      }
    }
  }
  // apply from the end so earlier offsets stay valid; at equal offsets the last insert ends up
  // leftmost, so closing markers (high order) are inserted after opening ones
  inserts.sort((x, y) => y.at - x.at || x.order - y.order)
  let out = s
  for (const ins of inserts) out = out.slice(0, ins.at) + ins.str + out.slice(ins.at)
  // `![image](gramps://…<U+FFFC>)` → `![image](gramps://…)`
  return out.replace(/(!\[image\]\(gramps:\/\/Media\/handle\/[^)\s\uFFFC]+)\uFFFC\)/g, '$1)')
}

/** Media handles of the inline images, in text order (repeats kept). */
export function inlineImageHandles(text?: { string?: string; tags?: StyledTag[] }) {
  const s = text?.string ?? ''
  const found: Array<[number, string]> = []
  for (const t of text?.tags ?? []) {
    if (tagName(t.name) !== 'link') continue
    const h = mediaLinkHandle(t.value)
    if (!h) continue
    for (const [a, b] of t.ranges) if (b - a === 1 && s[a] === IMAGE_PLACEHOLDER) found.push([a, h])
  }
  return found.sort((x, y) => x[0] - y[0]).map(([, h]) => h)
}

/** True when the note uses styling the markdown-ish editor cannot keep. */
export function hasUnsupportedStyling(tags?: StyledTag[]) {
  return (tags ?? []).some((t) => !['bold', 'italic', 'link'].includes(tagName(t.name)))
}
