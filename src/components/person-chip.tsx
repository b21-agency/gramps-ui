import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import type { MediaRef, PersonProfile } from '@/lib/types'
import { isEmpty, lifespan, profileName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Portrait } from './portrait'

type P = Partial<PersonProfile> | null | undefined

/** Compact, clickable person line: portrait, name, life dates. */
export function PersonChip({
  person,
  mediaRef,
  note,
  className,
  size = 40,
  current,
}: {
  person: P
  mediaRef?: Pick<MediaRef, 'ref' | 'rect'> | null
  note?: string
  className?: string
  size?: number
  current?: boolean
}) {
  const { t } = useTranslation()
  if (!person || isEmpty(person)) return null
  const name = profileName(person) || t('unknown')
  const span = lifespan(person.birth as { date?: string }, person.death as { date?: string })
  const body = (
    <>
      <Portrait mediaRef={mediaRef} name={name} sex={person.sex} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-medium leading-tight">{name}</span>
        <span className="block truncate text-xs text-muted-foreground tabular-nums">
          {[span, note].filter(Boolean).join(' · ')}
        </span>
      </span>
    </>
  )
  const cls = cn('group flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left', className)
  if (current || !person.gramps_id) return <div className={cn(cls, current && 'bg-accent/60')}>{body}</div>
  return (
    <Link
      to={`/person/${person.gramps_id}`}
      className={cn(cls, 'transition-colors outline-none hover:bg-accent focus-visible:bg-accent active:bg-accent max-md:py-2')}
    >
      {body}
      <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground/60 md:hidden" aria-hidden />
    </Link>
  )
}
