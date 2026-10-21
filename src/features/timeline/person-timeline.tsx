import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarX2, Loader2, MapPin } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { api } from '@/lib/api'
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

export function PersonTimeline({ person }: { person: Person }) {
  const { t } = useTranslation(['timeline', 'common'])
  const [groups, setGroups] = usePref<Group[]>('timeline.relatives', ALL_GROUPS)
  const [generations, setGenerations] = usePref<number>('timeline.generations', 1)
  const active = ALL_GROUPS.filter((g) => groups.includes(g))
  const allOn = active.length === ALL_GROUPS.length
  const relatives = allOn || active.length === 0 ? undefined : active.flatMap((g) => GROUPS[g])

  const q = useQuery({
    queryKey: ['people', person.handle, 'timeline', apiLocale(), relatives?.join(','), generations],
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<PersonTimelineItem[]>(`/people/${person.handle}/timeline`, {
        query: {
          locale: apiLocale(),
          precision: 2,
          ancestors: generations,
          offspring: generations,
          relatives,
        },
      }),
  })

  const items = useMemo(() => {
    const list = q.data ?? []
    return active.length === 0 ? list.filter((i) => i.person?.relationship === 'self') : list
  }, [q.data, active.length])

  const toggle = (g: Group) => setGroups(active.includes(g) ? active.filter((x) => x !== g) : [...active, g])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('include')}>
          <span className="mr-1 text-sm text-muted-foreground">{t('include')}</span>
          {ALL_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={active.includes(g)}
              onClick={() => toggle(g)}
              className={cn(
                'inline-flex h-7 items-center rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                active.includes(g) ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-accent',
              )}
            >
              {t(`groups.${g}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('generations')}</span>
          <Select value={String(generations)} onValueChange={(v) => setGenerations(Number(v))}>
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {q.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="mt-6">
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.isLoading && <RowsSkeleton rows={8} />}
        {q.data && items.length === 0 && (
          <EmptyState icon={CalendarX2} title={t('noPersonEvents', { name: profileName(person.profile) })}>
            {t('noPersonEventsHint')}
          </EmptyState>
        )}
        {items.length > 0 && <Track items={items} anchor={person.profile?.name_given || profileName(person.profile)} />}
      </div>
    </div>
  )
}

function Track({ items, anchor }: { items: PersonTimelineItem[]; anchor: string }) {
  const { t } = useTranslation('timeline')
  const years = items.map((it) => yearOf(it.date))
  return (
    <ol className="relative">
      {items.map((it, i) => {
        const self = it.person?.relationship === 'self'
        const y = years[i]
        const showYear = y !== null && !years.slice(0, i).includes(y)
        const placeName = it.place?.display_name || it.place?.name
        const name = self ? '' : [it.person?.name_given, it.person?.name_surname, it.person?.name_suffix].filter(Boolean).join(' ') || it.person?.name_display || ''
        return (
          <li key={`${it.handle}-${it.person?.handle ?? ''}`} className="grid grid-cols-[3.25rem_1.5rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_1.75rem_minmax(0,1fr)]">
            <div className="pt-3 text-right font-serif text-lg leading-none tabular-nums text-brass">{showYear ? y : ''}</div>
            <div className="relative flex justify-center">
              <span className="absolute inset-y-0 w-px bg-border" />
              <span
                className={cn(
                  'relative rounded-full ring-4 ring-background',
                  self ? cn('mt-3 size-3', typeTone(it.type)) : 'mt-3.5 size-2 border border-lineage bg-background',
                )}
              />
            </div>
            <div className={cn('min-w-0 py-2 pl-1', !self && 'text-[0.94rem]')}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <Link to={`/event/${it.gramps_id}`} className={cn('hover:underline', self ? 'font-medium' : 'text-muted-foreground')}>
                  {self ? it.label : (it.label.split(' (')[0] || it.label)}
                </Link>
                {!self && it.person?.gramps_id && (
                  <span className="min-w-0">
                    <Link to={`/person/${it.person.gramps_id}`} className="font-medium hover:underline">
                      {name}
                    </Link>
                    {it.person.relationship && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{it.person.relationship}</span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                <span className="tabular-nums">{it.date}</span>
                {it.age && /\d/.test(it.age) && !(self && it.type === 'Birth') && (
                  <span>{self ? t('ageAt', { age: it.age }) : t('anchorAge', { name: anchor, age: it.age })}</span>
                )}
                {placeName && (
                  <span className="flex min-w-0 items-center gap-1">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{placeName}</span>
                  </span>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
