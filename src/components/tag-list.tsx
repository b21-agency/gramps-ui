import type { Tag } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Gramps tag colours are #RRRRGGGGBBBB; reduce to #RRGGBB. */
export function tagColor(c?: string) {
  if (!c) return undefined
  if (/^#[0-9a-f]{12}$/i.test(c)) return `#${c.slice(1, 3)}${c.slice(5, 7)}${c.slice(9, 11)}`
  return c
}

export function TagList({ tags, className }: { tags?: Tag[]; className?: string }) {
  if (!tags?.length) return null
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {tags.map((t) => (
        <span
          key={t.handle}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground"
        >
          <span className="size-2 rounded-full" style={{ background: tagColor(t.color) ?? 'var(--muted-foreground)' }} />
          {t.name}
        </span>
      ))}
    </div>
  )
}
