import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Bookmark, BookmarkCheck, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TagList } from '@/components/tag-list'
import { EditButton } from '@/features/editor/edit-button'
import { useBookmarks } from '@/lib/prefs'
import { kindIcon } from '@/lib/objects'
import type { ObjectKind, Tag } from '@/lib/types'
import { cn } from '@/lib/utils'

const listPath: Record<ObjectKind, string> = {
  person: '/people',
  family: '/families',
  event: '/events',
  place: '/places',
  source: '/sources',
  citation: '/citations',
  repository: '/repositories',
  note: '/notes',
  media: '/medialist',
}

/** Breadcrumb + action row shown above every object page. */
export function ObjectToolbar({
  kind,
  object,
  title,
  extra,
  onSaved,
}: {
  kind: ObjectKind
  object: { handle: string; gramps_id: string; private?: boolean }
  title: string
  extra?: ReactNode
  onSaved?: () => void
}) {
  const { t } = useTranslation()
  const { isBookmarked, toggle } = useBookmarks()
  const marked = isBookmarked(object.handle)
  const Icon = kindIcon[kind]
  return (
    <div className="mb-5 flex items-center gap-2">
      <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link to={listPath[kind]} className="inline-flex items-center gap-1.5 hover:text-foreground">
          <Icon className="size-4" />
          {t(`objects.${kind}`)}
        </Link>
        <span aria-hidden>/</span>
        <span className="tabular-nums">{object.gramps_id}</span>
        {object.private && (
          <span className="ml-1 rounded-full border px-2 py-0.5 text-[11px]">{t('private')}</span>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        {extra}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-pressed={marked}
              aria-label={marked ? t('actions.unbookmark') : t('actions.bookmark')}
              onClick={() => toggle({ kind, handle: object.handle, gramps_id: object.gramps_id, title })}
            >
              {marked ? <BookmarkCheck className="text-brass" /> : <Bookmark />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{marked ? t('actions.unbookmark') : t('actions.bookmark')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('actions.copyLink')}
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.href)
                toast.success(t('actions.linkCopied'))
              }}
            >
              <Link2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('actions.copyLink')}</TooltipContent>
        </Tooltip>
        <EditButton kind={kind} object={object} onSaved={onSaved} />
      </div>
    </div>
  )
}

/** Title block for non-person objects. */
export function ObjectTitle({
  title,
  subtitle,
  tags,
  aside,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  tags?: Tag[]
  aside?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-start', className)}>
      <div className="min-w-0 flex-1">
        <h1 className="text-3xl font-medium leading-tight tracking-tight text-balance sm:text-4xl">{title}</h1>
        {subtitle && <div className="mt-2 text-muted-foreground">{subtitle}</div>}
        <TagList tags={tags} className="mt-3" />
      </div>
      {aside}
    </header>
  )
}
