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
      <div className={cn('truncate', serif && 'font-serif text-[1.05rem] leading-snug')}>{main || <Dash />}</div>
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
      <div className="truncate tabular-nums">{date || <span className="text-muted-foreground">…</span>}</div>
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

/** Small leading icon tile used by lists without portraits. */
export function IconTile({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground', className)}>
      <Icon className="size-4" />
    </span>
  )
}
