import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { yearOf } from '@/lib/format'
import type { EventProfile, GEvent } from '@/lib/types'
import { cn } from '@/lib/utils'

const vital = /^(birth|geburt|baptism|taufe|christening|death|tod|burial|beerdigung|bestattung|cremation|einäscherung)$/i

/**
 * The signature element of the person page: a single line from birth to death
 * with each dated event as a mark. Births and deaths anchor the ends; life events
 * sit along the line so a long, eventful life reads differently from a short one.
 */
export function Lifeline({
  events,
  birth,
  death,
  related = [],
  middle,
}: {
  /** short text between the start and end years, e.g. "married 1875 · 8 children" */
  middle?: string
  events: Array<{ event?: GEvent; profile: EventProfile }>
  birth?: EventProfile
  death?: EventProfile
  /** family moments (marriages, children's births) drawn as smaller marks below the line */
  related?: Array<{ label: string; date: string; to?: string }>
}) {
  const { t } = useTranslation('person')
  const start = yearOf(birth?.date) ?? Math.min(...events.map((e) => yearOf(e.profile.date) ?? Infinity))
  const thisYear = new Date().getFullYear()
  let end = yearOf(death?.date)
  const living = !end && start && thisYear - start < 100
  if (!end) end = living ? thisYear : Math.max(...events.map((e) => yearOf(e.profile.date) ?? -Infinity))
  if (!isFinite(start) || !end || !isFinite(end) || end < start) return null
  const span = Math.max(1, end - start)

  const marks = events
    .map((e) => ({ ...e, y: yearOf(e.profile.date) }))
    .filter((e): e is typeof e & { y: number } => e.y != null && e.y >= start && e.y <= end!)
  // decades as quiet ticks
  const ticks: number[] = []
  for (let d = Math.ceil(start / 10) * 10; d < end; d += 10) ticks.push(d)

  return (
    <div aria-label={`${start} – ${living ? t('living') : end}`}>
      <div className="relative h-10">
        {/* line */}
        <div
          className={cn(
            'absolute left-0 top-4 h-[3px] rounded-full bg-primary',
            living && 'bg-gradient-to-r from-primary from-80% to-transparent',
          )}
          style={{ width: '100%' }}
        />
        {ticks.map((d) => (
          <span
            key={d}
            className="absolute top-[13px] h-[9px] w-px bg-[color-mix(in_oklab,var(--primary)_45%,transparent)]"
            style={{ left: `${((d - start) / span) * 100}%` }}
          />
        ))}
        {related.map((r, i) => {
          const y = yearOf(r.date)
          if (y == null || y < start || y > end!) return null
          const dot = (
            <span
              className="absolute top-[26px] block size-2 -translate-x-1/2 rounded-full bg-[color-mix(in_oklab,var(--brass)_70%,transparent)] transition-transform hover:scale-150"
              style={{ left: `${((y - start) / span) * 100}%` }}
            />
          )
          return (
            <Tooltip key={`r${i}`}>
              <TooltipTrigger asChild>{r.to ? <Link to={r.to} aria-label={`${r.label} ${r.date}`}>{dot}</Link> : dot}</TooltipTrigger>
              <TooltipContent>
                <span className="font-medium">{r.label}</span> · {r.date}
              </TooltipContent>
            </Tooltip>
          )
        })}
        {marks.map((m, i) => {
          const left = ((m.y - start) / span) * 100
          const isVital = vital.test(m.event ? String((m.event.type as { string?: string })?.string ?? m.event.type) : '') || vital.test(m.profile.type)
          const dot = (
            <span
              className={cn(
                'absolute top-[17px] block -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background transition-transform hover:scale-125',
                isVital ? 'size-3.5 bg-primary' : 'size-3 bg-brass',
              )}
              style={{ left: `${left}%` }}
            />
          )
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                {m.event ? (
                  <Link to={`/event/${m.event.gramps_id}`} aria-label={`${m.profile.type} ${m.profile.date}`}>
                    {dot}
                  </Link>
                ) : (
                  dot
                )}
              </TooltipTrigger>
              <TooltipContent>
                <span className="font-medium">{m.profile.type}</span> · {m.profile.date}
                {m.profile.place_name ? ` · ${m.profile.place_name}` : ''}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <div className="flex justify-between font-serif text-sm tabular-nums text-muted-foreground">
        <span>{start}</span>
        {middle && <span className="hidden text-center sm:block">{middle}</span>}
        <span>{living ? t('living') : end}</span>
      </div>
    </div>
  )
}
