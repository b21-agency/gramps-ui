import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Portrait } from '@/components/portrait'
import { profileName, timeAgo } from '@/lib/format'
import type { PersonProfile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { usePersonPortrait } from './portrait-batch'

/** Two-line cell: main text + muted secondary line. */
export function Stack({ main, sub, serif, className }: { main: ReactNode; sub?: ReactNode; serif?: boolean; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('truncate', serif && 'font-serif text-lg leading-snug')}>{main || <Dash />}</div>
      {sub ? <div className="truncate text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  )
}

export function Dash() {
  return <span className="text-muted-foreground/60">–</span>
}

/** Date + place of an event profile. */
export function EventCell({ date, place }: { date?: string; place?: string }) {
  if (!date && !place) return <Dash />
  return (
    <div className="min-w-0">
      <div className="truncate text-[15px] tabular-nums">{date || <span className="text-muted-foreground">…</span>}</div>
      {place && <div className="truncate text-xs text-muted-foreground">{place}</div>}
    </div>
  )
}

export function IdCell({ id }: { id: string }) {
  return <span className="text-xs tabular-nums text-muted-foreground">{id}</span>
}

export function ChangedCell({ ts }: { ts?: number }) {
  const { i18n } = useTranslation()
  if (!ts) return <Dash />
  return (
    <time className="text-xs whitespace-nowrap text-muted-foreground" dateTime={new Date(ts * 1000).toISOString()}>
      {timeAgo(ts, i18n.language)}
    </time>
  )
}

/** Portrait for a person profile we only know by handle (batched lookup). */
export function HandlePortrait({ person, size = 32, className }: { person?: Partial<PersonProfile> | null; size?: number; className?: string }) {
  const ref = usePersonPortrait(person?.handle)
  const name = profileName(person)
  return <Portrait mediaRef={ref} name={name || '?'} sex={person?.sex} size={size} className={className} />
}

/** Leading icon tile (44px, like ObjectThumb) for records without a picture. */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground', className)}>
      <Icon className="size-[18px]" aria-hidden />
    </span>
  )
}

/** Leading visual + serif title + quiet second line: the standard list row lead. */
export function RowLead({ visual, title, sub, className }: { visual?: ReactNode; title: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4', className)}>
      {visual}
      <div className="min-w-0 flex-1">
        <div className="truncate font-serif text-lg leading-snug">{title}</div>
        {sub ? <div className="truncate text-[13px] leading-snug text-muted-foreground">{sub}</div> : null}
      </div>
    </div>
  )
}
