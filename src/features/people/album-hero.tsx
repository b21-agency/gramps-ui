import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Portrait, refThumbUrl } from '@/components/portrait'
import { TagList } from '@/components/tag-list'
import { Lightbox } from '@/components/detail/lightbox'
import { useAccessToken } from '@/lib/auth'
import { mediaFileUrl, mediaThumbUrl } from '@/lib/api'
import { initials, isEmpty, lifespan, profileName, yearOf } from '@/lib/format'
import type { EventProfile, FamilyProfile, Media, MediaRef, Person, PersonProfile } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Lifeline } from './lifeline'
import type { EventRow } from '@/components/detail/sections'

/**
 * Person page hero ("Album"): the portrait large on the left, the name as the headline,
 * born/died as two quiet blocks, the lifeline and the main actions.
 */
export function AlbumHero({
  person,
  profile,
  name,
  relation,
  actions,
  eventRows,
}: {
  person: Person
  profile: PersonProfile
  name: string
  relation?: ReactNode
  actions?: ReactNode
  eventRows: EventRow[]
}) {
  const { t } = useTranslation('person')
  useAccessToken()
  const [open, setOpen] = useState<number | null>(null)
  const birth = profile.birth as EventProfile
  const death = profile.death as EventProfile
  const nick = person.primary_name.nick || person.alternate_names.find((n) => n.nick)?.nick
  const extras = [nick && `“${nick}”`, person.primary_name.title, person.primary_name.suffix].filter(Boolean).join(' · ')
  const refs = person.media_list
  const families = profile.families ?? []
  const childCount = families.reduce((n, f) => n + (f.children?.length ?? 0), 0)
  const firstMarriage = families.map((f) => f.marriage as EventProfile | undefined).find((m) => m && !isEmpty(m) && m.date)
  const related: Array<{ label: string; date: string; to?: string }> = []
  for (const f of families) {
    const m = f.marriage as EventProfile | undefined
    if (m && !isEmpty(m) && m.date) related.push({ label: m.type, date: m.date, to: `/family/${f.gramps_id}` })
    for (const c of f.children ?? []) {
      const b = c.birth as EventProfile | undefined
      if (b && !isEmpty(b) && b.date) related.push({ label: t('childBorn', { name: profileName(c) }), date: b.date, to: `/person/${c.gramps_id}` })
    }
  }
  const middle = [
    firstMarriage && t('hero.married', { year: yearOf(firstMarriage.date) }),
    childCount > 0 && t('hero.children', { count: childCount }),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="flex flex-col gap-8 lg:flex-row lg:gap-12">
      <div className="relative mx-auto h-[19rem] w-full shrink-0 overflow-hidden rounded-3xl bg-card max-lg:-mt-1 sm:h-[26rem] sm:max-w-md lg:mx-0 lg:aspect-[4/5] lg:h-auto lg:w-[23rem] lg:max-w-none">
        {refs.length ? (
          <button
            type="button"
            onClick={() => setOpen(0)}
            className="block size-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('hero.openPhotos')}
          >
            <img
              src={refThumbUrl(refs[0], 900, false)}
              alt=""
              className="size-full object-cover [filter:sepia(0.18)_contrast(1.04)] transition-transform duration-500 ease-out hover:scale-[1.02]"
            />
          </button>
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-b from-secondary to-card">
            <span className="font-serif text-7xl text-muted-foreground/70">{initials(name)}</span>
          </div>
        )}
        {refs.length > 1 && (
          <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur">
            {t('hero.photos', { count: refs.length })}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col lg:pt-2">
        {relation && <div className="max-lg:text-center">{relation}</div>}
        <h1 className="mt-4 font-serif text-[2.6rem] font-medium leading-[1] tracking-[-0.02em] text-balance max-lg:text-center sm:text-6xl lg:text-[4.25rem]">
          {name}
        </h1>
        {extras && <p className="mt-3 font-serif text-xl italic text-muted-foreground max-lg:text-center">{extras}</p>}
        <TagList tags={person.extended?.tags} className="mt-3 max-lg:justify-center" />

        <dl className="mt-7 grid grid-cols-2 gap-6 sm:flex sm:gap-12">
          <VitalBlock label={t('born')} event={birth} />
          <VitalBlock label={t('died')} event={death} age={death?.age} />
        </dl>

        <div className="mt-6">
          <Lifeline events={eventRows} birth={birth} death={death} middle={middle} related={related} />
        </div>

        {actions && <div className="mt-7">{actions}</div>}
      </div>

      {open != null && (
        <Lightbox
          items={refs.map((r, i) => {
            const m = person.extended?.media?.find((x: Media) => x.handle === r.ref)
            return {
              key: `${r.ref}-${i}`,
              src: mediaThumbUrl(r.ref, 1600),
              alt: m?.desc ?? '',
              caption: m?.desc,
              href: m ? `/media/${m.gramps_id}` : undefined,
              original: mediaFileUrl(r.ref),
            }
          })}
          index={open}
          onIndexChange={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

function VitalBlock({ label, event, age }: { label: string; event?: EventProfile; age?: string }) {
  if (!event || isEmpty(event)) return null
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span className="block font-serif text-2xl leading-tight tabular-nums">{event.date || '?'}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {[event.place_name, age && age !== 'unknown' && !/^0 /.test(age) ? age : ''].filter(Boolean).join(' · ')}
        </span>
      </dd>
    </div>
  )
}

/** "Family" panel: parents, partners and children as faces. */
export function FamilyPanel({
  profile,
  portraits,
  action,
}: {
  profile: PersonProfile
  portraits: Map<string, MediaRef | undefined>
  action?: ReactNode
}) {
  const { t } = useTranslation('person')
  const self = profile.handle
  const ppf = profile.primary_parent_family as FamilyProfile | undefined
  const parents = ppf && !isEmpty(ppf) ? ([ppf.father, ppf.mother].filter((p) => p && !isEmpty(p)) as PersonProfile[]) : []
  const families = profile.families ?? []
  const children = families.flatMap((f) => f.children ?? [])
  const siblings = (ppf?.children ?? []).filter((c) => c.handle !== self)

  return (
    <Panel title={t('detailSections.family')} action={action}>
      {parents.length > 0 && (
        <PanelGroup label={t('parents')}>
          <div className="grid gap-1">
            {parents.map((p) => (
              <FaceRow key={p.handle} person={p} portrait={portraits.get(p.handle)} />
            ))}
          </div>
        </PanelGroup>
      )}
      {families.map((f) => {
        const partner = ((f.father as PersonProfile)?.handle === self ? f.mother : f.father) as PersonProfile | undefined
        const m = f.marriage as EventProfile | undefined
        if (!partner || isEmpty(partner)) return null
        return (
          <PanelGroup
            key={f.handle}
            label={m && !isEmpty(m) && m.date ? t('hero.marriedTo', { year: yearOf(m.date) }) : f.relationship || t('partner')}
          >
            <FaceRow person={partner} portrait={portraits.get(partner.handle)} />
          </PanelGroup>
        )
      })}
      {children.length > 0 && (
        <PanelGroup label={t('hero.children', { count: children.length })}>
          <FaceStack people={children} portraits={portraits} />
        </PanelGroup>
      )}
      {siblings.length > 0 && (
        <PanelGroup label={t('siblingsCount', { count: siblings.length })}>
          <FaceStack people={siblings} portraits={portraits} />
        </PanelGroup>
      )}
      {!parents.length && !families.length && <p className="text-sm text-muted-foreground">{t('hero.noFamily')}</p>}
    </Panel>
  )
}

export function Panel({
  title,
  action,
  children,
  className,
  id,
}: {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section id={id} className={cn('scroll-mt-24 rounded-3xl bg-card p-5 sm:p-6', className)}>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-serif text-2xl font-medium">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function PanelGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-2 text-sm text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}

function FaceRow({ person, portrait }: { person: Partial<PersonProfile>; portrait?: MediaRef }) {
  return (
    <Link
      to={`/person/${person.gramps_id}`}
      className="-mx-2 flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors duration-150 hover:bg-accent"
    >
      <Portrait mediaRef={portrait} name={profileName(person)} sex={person.sex} size={44} />
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold">{profileName(person)}</span>
        <span className="block text-xs tabular-nums text-muted-foreground">
          {lifespan(person.birth as EventProfile, person.death as EventProfile)}
        </span>
      </span>
    </Link>
  )
}

function FaceStack({ people, portraits }: { people: Array<Partial<PersonProfile>>; portraits: Map<string, MediaRef | undefined> }) {
  const shown = people.slice(0, 7)
  return (
    <div className="flex flex-wrap items-center">
      {shown.map((p, i) => (
        <Link
          key={p.handle}
          to={`/person/${p.gramps_id}`}
          title={`${profileName(p)} ${lifespan(p.birth as EventProfile, p.death as EventProfile)}`}
          className={cn('rounded-full transition-transform duration-150 ease-out hover:z-10 hover:-translate-y-0.5', i > 0 && '-ml-2.5')}
        >
          <Portrait mediaRef={portraits.get(p.handle ?? '')} name={profileName(p)} sex={p.sex} size={44} className="ring-[3px] ring-card" />
        </Link>
      ))}
      {people.length > shown.length && (
        <a
          href="#family"
          className="-ml-2.5 flex size-11 items-center justify-center rounded-full bg-brass text-sm font-bold text-brass-foreground ring-[3px] ring-card"
        >
          +{people.length - shown.length}
        </a>
      )}
    </div>
  )
}
