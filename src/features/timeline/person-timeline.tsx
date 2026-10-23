import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useGetPersonTimelineQuery } from '@/api/enhanced/people-slice-enhanced'
import { CalendarX2, Loader2, MapPin } from 'lucide-react'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { Portrait } from '@/components/portrait'
import { usePortraits } from '@/hooks/use-portraits'
import { apiLocale } from '@/i18n'
import { usePref } from '@/lib/prefs'
import { profileName, yearOf } from '@/lib/format'
import type { Person } from '@/lib/types'
import { cn } from '@/lib/utils'
import { typeTone, type PersonTimelineItem } from './data'

const GROUPS = {
  parents: ['father', 'mother'],
  siblings: ['brother', 'sister'],
  partners: ['wife', 'husband'],
  children: ['son', 'daughter'],
} as const
type Group = keyof typeof GROUPS
const ALL_GROUPS = Object.keys(GROUPS) as Group[]

export function PersonTimeline({ person, hero }: { person: Person; hero?: ReactNode }) {
  const { t } = useTranslation(['timeline', 'common'])
  const [groups, setGroups] = usePref<Group[]>('timeline.relatives', ALL_GROUPS)
  const [generations, setGenerations] = usePref<number>('timeline.generations', 1)
  const active = ALL_GROUPS.filter((g) => groups.includes(g))
  const allOn = active.length === ALL_GROUPS.length
  const relatives = allOn || active.length === 0 ? undefined : active.flatMap((g) => GROUPS[g])

  // `data` keeps the previous timeline while a new relatives/generations choice loads
  const tq = useGetPersonTimelineQuery({
    handle: person.handle,
    locale: apiLocale(),
    precision: 2,
    ancestors: generations,
    offspring: generations,
    relatives,
  })
  const q = { ...tq, data: tq.data as unknown as PersonTimelineItem[] | undefined, isPlaceholderData: tq.isFetching && !tq.currentData }

  const items = useMemo(() => {
    const list = q.data ?? []
    return active.length === 0 ? list.filter((i) => i.person?.relationship === 'self') : list
  }, [q.data, active.length])

  const toggle = (g: Group) => setGroups(active.includes(g) ? active.filter((x) => x !== g) : [...active, g])

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="grid min-w-0 gap-6 xl:sticky xl:top-[calc(var(--header-h)+1.5rem)]">
        {hero}
        <section className="rounded-3xl bg-card p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-serif text-2xl font-medium">{t('include')}</h2>
            {q.isFetching && <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('include')}>
            {ALL_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={active.includes(g)}
                onClick={() => toggle(g)}
                className={cn(
                  'inline-flex h-11 items-center rounded-full px-4 text-[15px] transition-[color,background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] sm:h-10',
                  active.includes(g) ? 'bg-primary font-medium text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {t(`groups.${g}`)}
              </button>
            ))}
          </div>
          <div className="mt-5 mb-2 text-sm text-muted-foreground">{t('generations')}</div>
          <div className="grid grid-cols-3 rounded-full bg-secondary p-1" role="radiogroup" aria-label={t('generations')}>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={generations === n}
                onClick={() => setGenerations(n)}
                className={cn(
                  'h-10 rounded-full font-serif text-lg tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  generations === n ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="min-w-0 rounded-3xl bg-card p-4 sm:p-6 lg:p-8">
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.isLoading && <RowsSkeleton rows={8} />}
        {q.data && items.length === 0 && (
          <EmptyState icon={CalendarX2} title={t('noPersonEvents', { name: profileName(person.profile) })}>
            {t('noPersonEventsHint')}
          </EmptyState>
        )}
        {items.length > 0 && <Track items={items} anchor={person.profile?.name_given || profileName(person.profile)} />}
      </section>
    </div>
  )
}

function Track({ items, anchor }: { items: PersonTimelineItem[]; anchor: string }) {
  const { t } = useTranslation('timeline')
  const years = items.map((it) => yearOf(it.date))
  const portraits = usePortraits(items.map((it) => (it.person?.relationship === 'self' ? '' : (it.person?.handle ?? ''))))
  return (
    <ol className="relative">
      <span aria-hidden className="absolute top-4 bottom-4 left-[5.31rem] w-0.5 rounded-full bg-lineage/70 sm:left-[6.56rem]" />
      {items.map((it, i) => {
        const self = it.person?.relationship === 'self'
        const y = years[i]
        const showYear = y !== null && years[i - 1] !== y
        const placeName = it.place?.display_name || it.place?.name
        const name = self ? '' : [it.person?.name_given, it.person?.name_surname, it.person?.name_suffix].filter(Boolean).join(' ') || it.person?.name_display || ''
        return (
          <li key={`${it.handle}-${it.person?.handle ?? ''}`} className="flex gap-4 py-2.5 sm:gap-5">
            <span
              className={cn(
                'w-16 shrink-0 pt-0.5 text-right font-serif leading-none tabular-nums sm:w-20',
                self ? 'text-2xl text-brass' : 'text-lg text-brass/70',
                !showYear && 'invisible',
              )}
            >
              {y ?? '—'}
            </span>
            <span
              aria-hidden
              className={cn(
                'relative z-10 mt-1.5 shrink-0 rounded-full ring-4 ring-card',
                self ? cn('size-3', typeTone(it.type)) : 'ml-0.5 size-2 bg-muted-foreground/50',
              )}
            />
            <span className="flex min-w-0 flex-1 items-start gap-3">
              {!self && it.person?.gramps_id && (
                <Link to={`/person/${it.person.gramps_id}`} className="shrink-0 rounded-full" tabIndex={-1} aria-hidden>
                  <Portrait mediaRef={portraits.get(it.person.handle ?? '')} name={name} sex={it.person.sex} size={36} />
                </Link>
              )}
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    to={`/event/${it.gramps_id}`}
                    className={cn('hover:underline', self ? 'text-[15px] font-semibold' : 'text-sm text-muted-foreground')}
                  >
                    {self ? it.label : (it.label.split(' (')[0] || it.label)}
                  </Link>
                  {!self && it.person?.gramps_id && (
                    <span className="min-w-0">
                      <Link to={`/person/${it.person.gramps_id}`} className="text-[15px] font-medium hover:underline">
                        {name}
                      </Link>
                      {it.person.relationship && <span className="ml-1.5 text-xs text-muted-foreground">{it.person.relationship}</span>}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                  {it.date && it.date !== String(y) && <span className="tabular-nums">{it.date}</span>}
                  {it.age && /\d/.test(it.age) && !(self && it.type === 'Birth') && (
                    <span>{self ? t('ageAt', { age: it.age }) : t('anchorAge', { name: anchor, age: it.age })}</span>
                  )}
                  {placeName && (
                    <span className="flex min-w-0 items-center gap-1">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{placeName}</span>
                    </span>
                  )}
                </span>
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
