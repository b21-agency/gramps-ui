import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Portrait } from '@/components/portrait'
import { lifespan, profileName } from '@/lib/format'
import type { EventProfile, MediaRef, PersonProfile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { NameTooltip } from '@/components/name-tooltip'

/** Album panel: a rounded card surface with a serif title and an optional action. */
export function Panel({
  title,
  count,
  action,
  children,
  className,
  id,
}: {
  title: ReactNode
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('flex min-w-0 scroll-mt-24 flex-col rounded-3xl bg-card p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="font-serif text-2xl font-medium">{title}</h2>
        {count != null && <span className="text-sm tabular-nums text-muted-foreground">{count}</span>}
        {action && <div className="ml-auto self-center">{action}</div>}
      </div>
      {children}
    </section>
  )
}

export function PanelGroup({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 text-sm text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

/** One person as a face: portrait, name, life span (and an optional note). */
export function FaceRow({
  person,
  portrait,
  note,
  lead,
  className,
}: {
  person: Partial<PersonProfile>
  portrait?: Pick<MediaRef, 'ref' | 'rect'> | null
  note?: ReactNode
  lead?: ReactNode
  className?: string
}) {
  const span = lifespan(person.birth as EventProfile, person.death as EventProfile)
  return (
    <Link
      to={`/person/${person.gramps_id}`}
      className={cn(
        '-mx-2 flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent',
        className,
      )}
    >
      {lead != null && <span className="w-5 shrink-0 text-right font-serif text-lg tabular-nums text-brass">{lead}</span>}
      <Portrait mediaRef={portrait} name={profileName(person)} sex={person.sex} size={44} />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">{profileName(person)}</span>
        {(span || note) && (
          <span className="block truncate text-xs tabular-nums text-muted-foreground">{[span, note].filter(Boolean).join(' · ')}</span>
        )}
      </span>
    </Link>
  )
}

/** Overlapping portraits with a gold "+N" when there are more. */
export function FaceStack({
  people,
  portraits,
  max = 7,
  moreHref,
  size = 44,
  ring = 'ring-card',
}: {
  people: Array<Partial<PersonProfile>>
  portraits: Map<string, MediaRef | undefined>
  max?: number
  moreHref?: string
  size?: number
  ring?: string
}) {
  const shown = people.slice(0, max)
  return (
    <div className="flex flex-wrap items-center">
      {shown.map((p, i) => (
        <NameTooltip key={`${p.handle}-${i}`} name={profileName(p)} detail={lifespan(p.birth as EventProfile, p.death as EventProfile)}>
          <Link
            to={`/person/${p.gramps_id}`}
            aria-label={profileName(p)}
            className={cn('rounded-full transition-transform duration-150 ease-out hover:z-10 hover:-translate-y-0.5 focus-visible:z-10', i > 0 && '-ml-2.5')}
          >
            <Portrait mediaRef={portraits.get(p.handle ?? '')} name={profileName(p)} sex={p.sex} size={size} className={cn('ring-[3px]', ring)} />
          </Link>
        </NameTooltip>
      ))}
      {people.length > shown.length && (
        <a
          href={moreHref}
          className={cn('-ml-2.5 flex items-center justify-center rounded-full bg-brass text-sm font-bold text-brass-foreground ring-[3px]', ring)}
          style={{ width: size, height: size }}
        >
          +{people.length - shown.length}
        </a>
      )}
    </div>
  )
}

/** Placeholder that fills an otherwise empty card (keeps rows of cards even). */
export function EmptyCard({ icon: Icon, text, children }: { icon: LucideIcon; text: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-4 py-8 text-center">
      <Icon className="size-7 text-muted-foreground/60" aria-hidden />
      <p className="text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
  )
}
