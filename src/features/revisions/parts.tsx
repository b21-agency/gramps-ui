import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { History, Tag as TagIcon } from 'lucide-react'
import { useObjectByHandle, useTags } from '@/lib/queries'
import { describeObject, kindIcon, objectPath } from '@/lib/objects'
import { tagColor } from '@/components/tag-list'
import type { ObjectKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { Leaf, RefKind } from './history'

const classIcons: Record<string, typeof TagIcon> = Object.fromEntries(
  Object.entries(kindIcon).map(([k, v]) => [k.charAt(0).toUpperCase() + k.slice(1), v]),
)

export function ClassIcon({ cls, className }: { cls?: string; className?: string }) {
  const Icon = (cls && classIcons[cls]) || (cls === undefined ? History : TagIcon)
  return <Icon className={className} />
}

/** A linked object by handle, showing its current title (or that it no longer exists). */
function RefLink({ kind, handle }: { kind: ObjectKind; handle: string }) {
  const { t } = useTranslation('revisions')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = useObjectByHandle<any>(kind, handle, { profile: 'self' }, { retry: false, staleTime: 5 * 60_000 })
  const Icon = kindIcon[kind]
  if (q.isLoading) return <span className="text-muted-foreground">…</span>
  if (!q.data)
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Icon className="size-3.5" />
        {t('removedRecord')}
      </span>
    )
  const d = describeObject(kind, q.data)
  return (
    <Link to={objectPath(kind, q.data.gramps_id)} className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{d.title || q.data.gramps_id}</span>
    </Link>
  )
}

function TagRefs({ handles }: { handles: string[] }) {
  const { data: tags } = useTags()
  const { t } = useTranslation('revisions')
  return (
    <span className="flex flex-wrap gap-1.5">
      {handles.map((h) => {
        const tag = tags?.find((x) => x.handle === h)
        return (
          <span key={h} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5 text-xs">
            <span className="size-2 rounded-full" style={{ background: tagColor(tag?.color) ?? 'var(--muted-foreground)' }} />
            {tag?.name ?? t('removedRecord')}
          </span>
        )
      })}
    </span>
  )
}

export function LeafValue({ leaf, className }: { leaf?: Leaf; className?: string }) {
  if (!leaf || (leaf.type === 'text' && !leaf.text) || (leaf.type === 'refs' && !leaf.handles.length))
    return <span className={cn('text-muted-foreground', className)}>–</span>
  if (leaf.type === 'text')
    return (
      <span className={cn('break-words', leaf.long && 'whitespace-pre-wrap', className)}>
        {leaf.long && leaf.text.length > 600 ? `${leaf.text.slice(0, 600)}…` : leaf.text}
      </span>
    )
  return <RefsValue kind={leaf.kind} handles={leaf.handles} className={className} />
}

function RefsValue({ kind, handles, className }: { kind: RefKind; handles: string[]; className?: string }) {
  if (kind === 'tag') return <TagRefs handles={handles} />
  return (
    <span className={cn('flex flex-col gap-0.5', className)}>
      {handles.slice(0, 12).map((h, i) => (
        <RefLink key={`${h}-${i}`} kind={kind} handle={h} />
      ))}
      {handles.length > 12 && <span className="text-muted-foreground">+{handles.length - 12}</span>}
    </span>
  )
}
