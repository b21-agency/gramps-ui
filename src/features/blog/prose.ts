export const BLOG_TAG = 'Blog'

/** Long-form reading typography for blog posts (serif, ~65ch, generous leading). */
export const blogProse =
  'font-serif text-[1.15rem] leading-[1.75] sm:text-[1.2rem] [&_p]:mb-[1.1em] [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold'

/** First characters of a note as plain text, cut at a word boundary. */
export function excerpt(text: string | undefined, max = 220) {
  const s = (text ?? '').replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[,;:.\s]+$/, '')}…`
}

export function postDate(ts: number, lang: string) {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(ts * 1000)
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Client-side preview of the markdown-ish text (same rules the server applies to the saved note). */
export function markdownishToHtml(src: string) {
  return src
    .trim()
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((para) => {
      const html = escapeHtml(para)
        .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) =>
          /^(https?:|mailto:|\/)/i.test(href) ? `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>` : text,
        )
        .replace(/\n/g, '<br>')
      return `<p>${html}</p>`
    })
    .join('')
}
