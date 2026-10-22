import { memo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, UserRound } from 'lucide-react'
import { Portrait } from '@/components/portrait'
import { cn } from '@/lib/utils'
import type { GPerson } from './graph'
import type { Layout, LNode, Side } from './layout'

export function yearsText(p: GPerson, t: TFunction) {
  if (p.birth && p.death) return `${p.birth} – ${p.death}`
  if (p.birth) return t('charts:born', { year: p.birth })
  if (p.death) return t('charts:died', { year: p.death })
  return p.dead ? t('charts:deceased') : ''
}

/** Full dates as recorded ("* 1855-06-21 · † 1911-06-28"), like the classic chart cards. */
export function datesText(p: GPerson) {
  return [p.birthDate && `* ${p.birthDate}`, p.deathDate && `† ${p.deathDate}`].filter(Boolean).join(' · ')
}

const stubIcon: Record<Side, typeof ChevronRight> = {
  right: ChevronRight,
  left: ChevronLeft,
  up: ChevronUp,
  down: ChevronDown,
}

const stubPos: Record<Side, string> = {
  right: 'top-1/2 -right-3.5 -translate-y-1/2',
  left: 'top-1/2 -left-3.5 -translate-y-1/2',
  up: 'left-1/2 -top-3.5 -translate-x-1/2',
  down: 'left-1/2 -bottom-3.5 -translate-x-1/2',
}

export interface CardHandlers {
  onActivate: (handle: string, el: HTMLElement) => void
  onStub: (handle: string, kind: 'parents' | 'children', el: HTMLElement) => void
}

export const PersonCard = memo(function PersonCard({
  node,
  person,
  vertical,
  handlers,
}: {
  node: LNode
  person: GPerson
  vertical: boolean
  handlers: CardHandlers
}) {
  const { t } = useTranslation('charts')
  const centre = node.role === 'centre'
  const years = yearsText(person, t)
  const StubIcon = node.stub ? stubIcon[node.stub.side] : null
  return (
    <div
      className="group/card absolute animate-in fade-in-0 duration-300 motion-reduce:animate-none"
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
    >
      <button
        type="button"
        data-person={person.id}
        data-handle={person.handle}
        data-cx={node.x + node.w / 2}
        data-cy={node.y + node.h / 2}
        aria-current={centre ? 'true' : undefined}
        title={[person.name, datesText(person)].filter(Boolean).join('\n')}
        aria-label={centre ? `${person.name}${years ? `, ${years}` : ''}` : t('showInCentre', { name: person.name })}
        onClick={(e) => handlers.onActivate(person.handle, e.currentTarget)}
        className={cn(
          'flex size-full rounded-2xl bg-card text-left shadow-[0_6px_20px_-12px_rgb(0_0_0/0.5)] ring-1 ring-foreground/[0.05] outline-none transition-[box-shadow,background-color] duration-150 ease-out',
          'hover:bg-secondary hover:ring-primary/40 focus-visible:ring-4 focus-visible:ring-ring/50',
          vertical ? 'flex-col items-center justify-center gap-2 px-2.5 pt-1 text-center' : 'items-center gap-3 pr-3 pl-2.5',
          node.role === 'partner' && 'bg-card/70 shadow-none outline-1 -outline-offset-1 outline-dashed outline-lineage ring-0',
          node.role === 'target' && 'ring-2 ring-brass',
          centre &&
            'bg-[color-mix(in_oklab,var(--brass)_10%,var(--card))] shadow-[0_0_0_6px_color-mix(in_oklab,var(--brass)_14%,transparent),0_0_44px_-6px_color-mix(in_oklab,var(--brass)_50%,transparent)] ring-2 ring-brass hover:bg-[color-mix(in_oklab,var(--brass)_14%,var(--card))] hover:ring-brass',
        )}
      >
        <Portrait
          mediaRef={person.media}
          name={person.name}
          sex={person.sex}
          size={vertical ? 64 : 56}
          className={centre ? 'ring-brass/80' : undefined}
        />
        <span className={cn('min-w-0', vertical ? 'w-full' : 'flex-1 pr-4')}>
          <span
            className={cn(
              'line-clamp-2 font-serif leading-[1.12] tracking-[-0.01em] text-pretty text-foreground',
              centre ? 'text-[17px] font-semibold' : 'text-[16px] font-medium',
            )}
          >
            {person.name}
          </span>
          {years && (
            <span
              className={cn(
                'mt-1 block truncate font-serif text-[14px] leading-none tabular-nums',
                centre ? 'text-brass' : 'text-brass/80',
              )}
            >
              {years}
            </span>
          )}
        </span>
      </button>
      <Link
        to={`/person/${person.id}`}
        tabIndex={-1}
        aria-label={t('openProfile')}
        title={t('openProfile')}
        data-no-pan
        className={cn(
          'absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
          'opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 pointer-coarse:opacity-70',
          centre && 'opacity-100',
        )}
      >
        <UserRound className="size-4" />
      </Link>
      {node.stub && StubIcon && (
        <button
          type="button"
          tabIndex={-1}
          data-no-pan
          onClick={(e) => handlers.onStub(person.handle, node.stub!.kind, e.currentTarget)}
          aria-label={
            node.stub.kind === 'parents'
              ? t('moreParents', { name: person.name })
              : t('moreChildren', { count: node.stub.count ?? 0, name: person.name })
          }
          title={
            node.stub.kind === 'parents'
              ? t('moreParents', { name: person.name })
              : t('moreChildren', { count: node.stub.count ?? 0, name: person.name })
          }
          className={cn(
            'absolute z-10 flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full bg-secondary px-1 text-xs text-muted-foreground shadow-sm ring-1 ring-lineage transition-colors hover:text-brass hover:ring-brass/60 pointer-coarse:after:absolute pointer-coarse:after:-inset-2',
            stubPos[node.stub.side],
          )}
        >
          {node.stub.kind === 'children' && node.stub.count ? <span className="tabular-nums">{node.stub.count}</span> : null}
          <StubIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
})

/** Connector lines + cards of a box layout. */
export const BoxChart = memo(function BoxChart({
  layout,
  people,
  handlers,
}: {
  layout: Layout
  people: Map<string, GPerson>
  handlers: CardHandlers
}) {
  const vertical = layout.orientation === 'vertical'
  return (
    <>
      <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1} aria-hidden>
        <g fill="none" stroke="var(--lineage)" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
          {layout.links.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        <g fill="none" stroke="var(--lineage)" strokeWidth={1.5} strokeDasharray="4 4" strokeLinecap="round">
          {layout.partnerLinks.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      </svg>
      {layout.nodes.map((n) => {
        const p = people.get(n.handle)
        return p ? <PersonCard key={`${n.key}:${n.handle}`} node={n} person={p} vertical={vertical} handlers={handlers} /> : null
      })}
    </>
  )
})
