import { useMemo, type MouseEvent } from 'react'
import { useNavigate } from 'react-router'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'

/** Renders a note's server-formatted HTML; internal links (/person/I0001) use the router. */
export function NoteHtml({ html, text, className }: { html?: string; text?: string; className?: string }) {
  const navigate = useNavigate()
  const clean = useMemo(() => (html ? DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) : ''), [html])
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a')
    const href = a?.getAttribute('href')
    if (a && href && href.startsWith('/') && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      navigate(href)
    }
  }
  if (!clean) return <div className={cn('prose-note whitespace-pre-wrap [overflow-wrap:anywhere]', className)}>{text}</div>
  return <div className={cn('prose-note [overflow-wrap:anywhere]', className)} onClick={onClick} dangerouslySetInnerHTML={{ __html: clean }} />
}
