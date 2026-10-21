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
        aria-label={centre ? `${person.name}${years ? `, ${years}` : ''}` : t('showInCentre', { name: person.name })}
        onClick={(e) => handlers.onActivate(person.handle, e.currentTarget)}
        className={cn(
          'flex size-full rounded-xl border bg-card text-left shadow-xs outline-none transition-[border-color,box-shadow,background-color] duration-150',
          'hover:border-primary/50 hover:shadow-sm focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/40',
          vertical ? 'flex-col items-center justify-center gap-2 px-2.5 pt-1 text-center' : 'items-center gap-3 px-3',
          node.role === 'partner' && 'border-dashed bg-card/70',
          node.role === 'target' && 'border-2 border-brass',
          centre &&
            'border-2 border-brass bg-[color-mix(in_oklab,var(--brass)_9%,var(--card))] shadow-md ring-4 ring-[color-mix(in_oklab,var(--brass)_18%,transparent)] hover:border-brass',
        )}
      >
        <Portrait mediaRef={person.media} name={person.name} sex={person.sex} size={vertical ? 60 : 52} />
        <span className={cn('min-w-0', vertical ? 'w-full' : 'flex-1 pr-4')}>
          <span
            className={cn(
              'line-clamp-2 font-serif leading-[1.15] text-pretty text-foreground',
              centre ? 'text-[16px] font-semibold' : 'text-[15px] font-medium',
            )}
          >
            {person.name}
          </span>
          {years && (
            <span className={cn('mt-0.5 block truncate text-[13px] tabular-nums', centre ? 'text-brass' : 'text-muted-foreground')}>
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
          'absolute top-1 right-1 grid size-7 place-items-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
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
            'absolute z-10 flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full border bg-background px-1 text-xs text-muted-foreground shadow-xs transition-colors hover:border-primary/50 hover:text-foreground',
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
        <g fill="none" stroke="var(--lineage)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
