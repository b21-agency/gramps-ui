import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Portrait } from '@/components/portrait'
import type { EventRow } from '@/components/detail/sections'
import { ageText, isEmpty, profileName, yearOf } from '@/lib/format'
import type { EventProfile, FamilyProfile, MediaRef, PersonProfile } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Entry {
  key: string
  year: number | null
  date: string
  title: string
  detail?: string
  to?: string
  own: boolean
  who?: Partial<PersonProfile>
}

/**
 * The person's life told by years: their own events, plus the family moments that shaped
 * it (marriages, children born, parents and partners dying), in one chronological line.
 */
export function LifeStory({
  rows,
  profile,
  portraits,
}: {
  rows: EventRow[]
  profile: PersonProfile
  portraits: Map<string, MediaRef | undefined>
}) {
  const { t } = useTranslation('person')
  const entries: Entry[] = []

  rows.forEach(({ event, profile: p }, i) => {
    entries.push({
      key: event?.handle ?? `own-${i}`,
      year: yearOf(p.date),
      date: p.date,
      title: p.type,
      detail: [p.place || p.place_name, event?.description && !/^\S+ (of|von) /.test(event.description) ? event.description : '', p.age && !/^0 /.test(p.age) ? t('age', { age: ageText(p.age) }) : '']
        .filter(Boolean)
        .join(' · '),
      to: event ? `/event/${event.gramps_id}` : undefined,
      own: true,
    })
  })

  const self = profile.handle
  for (const f of profile.families ?? []) {
    const partner = ((f.father as PersonProfile)?.handle === self ? f.mother : f.father) as PersonProfile | undefined
    const m = f.marriage as EventProfile | undefined
    if (m && !isEmpty(m) && m.date)
      entries.push({
        key: `m-${f.handle}`,
        year: yearOf(m.date),
        date: m.date,
        title: partner && !isEmpty(partner) ? t('story.married', { name: profileName(partner) }) : m.type,
        detail: m.place_name || m.place,
        to: `/family/${f.gramps_id}`,
        own: true,
        who: partner,
      })
    for (const c of f.children ?? []) {
      const b = c.birth as EventProfile | undefined
      if (b && !isEmpty(b) && b.date)
        entries.push({
          key: `c-${c.handle}`,
          year: yearOf(b.date),
          date: b.date,
          title: t('story.childBorn', { name: profileName(c) }),
          detail: b.place_name,
          to: `/person/${c.gramps_id}`,
          own: false,
          who: c,
        })
    }
    const pd = partner && !isEmpty(partner) ? (partner.death as EventProfile | undefined) : undefined
    if (pd && !isEmpty(pd) && pd.date)
      entries.push({
        key: `pd-${partner!.handle}`,
        year: yearOf(pd.date),
        date: pd.date,
        title: t('story.died', { name: profileName(partner) }),
        detail: pd.place_name,
        to: `/person/${partner!.gramps_id}`,
        own: false,
        who: partner,
      })
  }
  const ppf = profile.primary_parent_family as FamilyProfile | undefined
  for (const parent of [ppf?.father, ppf?.mother] as Array<PersonProfile | undefined>) {
    const d = parent && !isEmpty(parent) ? (parent.death as EventProfile | undefined) : undefined
    if (d && !isEmpty(d) && d.date)
      entries.push({
        key: `p-${parent!.handle}`,
        year: yearOf(d.date),
        date: d.date,
        title: t('story.died', { name: profileName(parent) }),
        detail: d.place_name,
        to: `/person/${parent!.gramps_id}`,
        own: false,
        who: parent,
      })
  }

  // keep only family moments within this person's lifetime (+1 year) so the story stays theirs
  const ownYears = entries.filter((e) => e.own && e.year != null).map((e) => e.year!)
  const first = ownYears.length ? Math.min(...ownYears) : -Infinity
  const last = ownYears.length ? Math.max(...ownYears) + 1 : Infinity
  const shown = entries
    .filter((e) => e.own || (e.year != null && e.year >= first && e.year <= last))
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))

  if (!shown.length) return <p className="text-sm text-muted-foreground">{t('noEvents')}</p>

  return (
    <ol className="relative">
      <span aria-hidden className="absolute bottom-3 left-[4.6rem] top-3 w-0.5 rounded-full bg-lineage/70 sm:left-[5.6rem]" />
      {shown.map((e, i) => {
        const showYear = e.year != null && shown[i - 1]?.year !== e.year
        const content = (
          <>
            <span
              className={cn(
                'w-16 shrink-0 pt-0.5 text-right font-serif tabular-nums sm:w-20',
                e.own ? 'text-2xl leading-none text-brass' : 'text-base text-muted-foreground',
                !showYear && 'invisible',
              )}
            >
              {e.year ?? '—'}
            </span>
            <span
              aria-hidden
              className={cn(
                'relative z-10 mt-1.5 shrink-0 rounded-full ring-4 ring-background',
                e.own ? 'size-3 bg-primary' : 'ml-0.5 size-2 bg-muted-foreground/50',
              )}
            />
            <span className="flex min-w-0 flex-1 items-start gap-3">
              {e.who && !isEmpty(e.who) && (
                <Portrait mediaRef={portraits.get(e.who.handle ?? '')} name={profileName(e.who)} sex={e.who.sex} size={e.own ? 36 : 28} />
              )}
              <span className="min-w-0">
                <span className={cn('block', e.own ? 'text-[15px] font-semibold' : 'text-sm')}>{e.title}</span>
                <span className="block text-sm text-muted-foreground">
                  {[e.date && e.date !== String(e.year) ? e.date : '', e.detail].filter(Boolean).join(' · ')}
                </span>
              </span>
            </span>
          </>
        )
        return (
          <li key={e.key}>
            {e.to ? (
              <Link
                to={e.to}
                className="-mx-2 flex gap-4 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-accent/70 sm:gap-5"
              >
                {content}
              </Link>
            ) : (
              <div className="flex gap-4 py-2.5 sm:gap-5">{content}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
