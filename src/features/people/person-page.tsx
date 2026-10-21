import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChartGantt, Home, Map as MapIcon, Network, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Portrait } from '@/components/portrait'
import { PersonChip } from '@/components/person-chip'
import { TagList } from '@/components/tag-list'
import { ErrorState } from '@/components/states'
import { ObjectToolbar } from '@/components/detail/object-header'
import {
  CitationsList,
  DetailSection,
  EventsTable,
  FactsTable,
  Gallery,
  NotesList,
  ReferencesList,
  SectionNav,
  type EventRow,
} from '@/components/detail/sections'
import { api } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { useObjectById } from '@/lib/queries'
import { useHomePerson, useRecordVisit } from '@/lib/prefs'
import { displayName, isEmpty, profileName, typeStr } from '@/lib/format'
import type { EventProfile, FamilyProfile, Person, PersonProfile } from '@/lib/types'
import { usePortraits } from '@/hooks/use-portraits'
import { useTitle } from '@/hooks/use-title'
import { Lifeline } from './lifeline'
import { AddRelativeMenu } from '@/features/editor/relationship-actions'

export function PersonPage() {
  const { id } = useParams()
  const { t } = useTranslation(['person', 'detail', 'common'])
  const q = useObjectById<Person>('person', id, { profile: 'all', extend: 'all', backlinks: true, precision: 1 })
  const person = q.data
  const profile = person?.profile
  const name = profile ? profileName(profile) : ''
  useTitle(name || id)
  useRecordVisit(person ? { kind: 'person', handle: person.handle, gramps_id: person.gramps_id, title: name } : null)

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!person || !profile) return <PersonSkeleton />

  const ext = person.extended ?? {}
  const eventsByHandle = new Map((ext.events ?? []).map((e) => [e.handle, e]))
  const eventRows: EventRow[] = person.event_ref_list.map((ref, i) => ({
    event: eventsByHandle.get(ref.ref),
    profile: profile.events?.[i] ?? ({ type: '', date: '', place: '', place_name: '', summary: '' } as EventProfile),
  }))
  const birth = profile.birth as EventProfile
  const death = profile.death as EventProfile
  const names = [person.primary_name, ...person.alternate_names]

  const nav = [
    { id: 'family', label: t('detail:sections.family') },
    { id: 'events', label: t('detail:sections.events'), count: eventRows.length },
    person.media_list.length > 0 && { id: 'gallery', label: t('detail:sections.gallery'), count: person.media_list.length },
    names.length > 1 && { id: 'names', label: t('detail:sections.names'), count: names.length },
    (person.note_list?.length ?? 0) > 0 && { id: 'notes', label: t('detail:sections.notes'), count: person.note_list!.length },
    (person.citation_list?.length ?? 0) > 0 && { id: 'sources', label: t('detail:sections.sources'), count: person.citation_list!.length },
    (person.attribute_list.length || person.urls.length || person.address_list.length) > 0 && { id: 'facts', label: t('detail:sections.facts') },
    person.person_ref_list.length > 0 && { id: 'associations', label: t('detail:sections.associations'), count: person.person_ref_list.length },
  ].filter(Boolean) as Array<{ id: string; label: string; count?: number }>

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <ObjectToolbar kind="person" object={person} title={name} onSaved={() => q.refetch()} />

      <PersonHero person={person} profile={profile} name={name} birth={birth} death={death} eventRows={eventRows} />

      <SectionNav items={nav} />

      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-10">
          <DetailSection id="family" title={t('detail:sections.family')} action={<AddRelativeMenu person={person} />}>
            <FamilyBlock profile={profile} self={person.handle} />
          </DetailSection>

          <DetailSection id="events" title={t('detail:sections.events')} count={eventRows.length}>
            {eventRows.length ? (
              <EventsTable rows={eventRows} showAge />
            ) : (
              <p className="text-sm text-muted-foreground">{t('noEvents')}</p>
            )}
          </DetailSection>

          {(person.note_list?.length ?? 0) > 0 && (
            <DetailSection id="notes" title={t('detail:sections.notes')} count={person.note_list!.length}>
              <NotesList handles={person.note_list!} />
            </DetailSection>
          )}

          {(person.citation_list?.length ?? 0) > 0 && (
            <DetailSection id="sources" title={t('detail:sections.sources')} count={person.citation_list!.length}>
              <CitationsList handles={person.citation_list!} />
            </DetailSection>
          )}
        </div>

        <aside className="min-w-0 space-y-10">
          {person.media_list.length > 0 && (
            <DetailSection id="gallery" title={t('detail:sections.gallery')} count={person.media_list.length}>
              <Gallery refs={person.media_list} media={ext.media} />
            </DetailSection>
          )}

          {names.length > 1 && (
            <DetailSection id="names" title={t('detail:sections.names')} count={names.length}>
              <ul className="space-y-3">
                {names.map((n, i) => (
                  <li key={i}>
                    <div className="font-medium">{displayName(n)}</div>
                    <div className="text-xs text-muted-foreground">
                      {[typeStr(n.type), n.nick && `${t('nickname')}: ${n.nick}`, n.call && `${t('callName')}: ${n.call}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </li>
                ))}
              </ul>
            </DetailSection>
          )}

          {(person.attribute_list.length || person.urls.length || person.address_list.length) > 0 && (
            <DetailSection id="facts" title={t('detail:sections.facts')}>
              <FactsTable attributes={person.attribute_list} urls={person.urls} addresses={person.address_list} />
            </DetailSection>
          )}

          {person.person_ref_list.length > 0 && (
            <DetailSection id="associations" title={t('detail:sections.associations')} count={person.person_ref_list.length}>
              <Associations person={person} />
            </DetailSection>
          )}

          {ext.backlinks && Object.keys(ext.backlinks).some((k) => !['family', 'event'].includes(k) && ext.backlinks![k]?.length) && (
            <DetailSection id="references" title={t('detail:sections.references')}>
              <ReferencesList
                backlinks={Object.fromEntries(Object.entries(ext.backlinks).filter(([k]) => !['family', 'event'].includes(k)))}
              />
            </DetailSection>
          )}
        </aside>
      </div>
    </div>
  )
}

function PersonHero({
  person,
  profile,
  name,
  birth,
  death,
  eventRows,
}: {
  person: Person
  profile: PersonProfile
  name: string
  birth: EventProfile
  death: EventProfile
  eventRows: EventRow[]
}) {
  const { t } = useTranslation(['person', 'common'])
  const [homeId, setHomeId] = useHomePerson()
  const isHome = homeId === person.gramps_id
  const tags = person.extended?.tags
  const vital = (e: EventProfile, sym: string) =>
    !isEmpty(e) && (
      <span className="whitespace-nowrap">
        <span className="mr-1 text-muted-foreground">{sym}</span>
        <span className="tabular-nums">{e.date || '?'}</span>
        {e.place_name && <span className="text-muted-foreground"> · {e.place_name}</span>}
      </span>
    )

  return (
    <header className="mb-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <Portrait mediaRef={person.media_list[0]} name={name} sex={profile.sex} size={128} className="ring-4" />
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-medium leading-[1.1] tracking-tight text-balance sm:text-5xl">{name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem]">
            {vital(birth, '*')}
            {vital(death, '†')}
            {!isEmpty(death) && death.age && death.age !== 'unknown' && (
              <span className="text-muted-foreground">({death.age})</span>
            )}
          </div>
          <RelationToHome person={person} />
          <TagList tags={tags} className="mt-3" />
        </div>
      </div>

      <Lifeline events={eventRows} birth={birth} death={death} related={relatedMoments(profile, t)} />

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link to={`/tree/ancestor/${person.gramps_id}`}>
            <Network />
            {t('actions.tree')}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={`/timeline?person=${person.gramps_id}`}>
            <ChartGantt />
            {t('actions.timeline')}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={`/map?person=${person.gramps_id}`}>
            <MapIcon />
            {t('actions.map')}
          </Link>
        </Button>
        {!isHome && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setHomeId(person.gramps_id)
              toast.success(t('isHome'))
            }}
          >
            <Home />
            {t('actions.setHome')}
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild size="sm" variant="ghost">
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(
                  `"${name}" ${[birth?.date, death?.date].filter(Boolean).join(' ')}`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                <Search />
                {t('actions.externalSearch')}
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Google</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}

function relatedMoments(profile: PersonProfile, t: (k: string, o?: Record<string, unknown>) => string) {
  const out: Array<{ label: string; date: string; to?: string }> = []
  for (const f of profile.families ?? []) {
    const m = f.marriage as EventProfile | undefined
    if (m && !isEmpty(m) && m.date) out.push({ label: m.type, date: m.date, to: `/family/${f.gramps_id}` })
    for (const c of f.children ?? []) {
      const b = c.birth as EventProfile | undefined
      if (b && !isEmpty(b) && b.date) out.push({ label: t('childBorn', { name: profileName(c) }), date: b.date, to: `/person/${c.gramps_id}` })
    }
  }
  return out
}

function RelationToHome({ person }: { person: Person }) {
  const { t } = useTranslation('person')
  const [homeId] = useHomePerson()
  const home = useObjectById<{ handle: string; profile: PersonProfile }>('person', homeId ?? undefined, {
    profile: 'self',
    keys: 'handle,profile',
  })
  const homeHandle = home.data?.handle
  const { data } = useQuery({
    queryKey: ['relations', homeHandle, person.handle, apiLocale()],
    enabled: !!homeHandle && homeHandle !== person.handle,
    staleTime: 10 * 60_000,
    queryFn: () =>
      api<{ relationship_string: string }>(`/relations/${homeHandle}/${person.handle}`, {
        query: { depth: 20, locale: apiLocale() },
      }),
  })
  if (homeId === person.gramps_id)
    return <p className="mt-2 text-sm text-brass">{t('isHome')}</p>
  if (!data?.relationship_string || !home.data) return null
  return (
    <p className="mt-2 text-sm text-brass">
      {t('relationTo', { relation: data.relationship_string, name: profileName(home.data.profile) })}
    </p>
  )
}

function FamilyBlock({ profile, self }: { profile: PersonProfile; self: string }) {
  const { t } = useTranslation('person')
  const ppf = profile.primary_parent_family as FamilyProfile | undefined
  const families = profile.families ?? []
  const others = profile.other_parent_families ?? []
  const handles: string[] = []
  const collect = (p?: Partial<PersonProfile>) => p?.handle && handles.push(p.handle)
  if (ppf && !isEmpty(ppf)) {
    collect(ppf.father as PersonProfile)
    collect(ppf.mother as PersonProfile)
    ppf.children?.forEach(collect)
  }
  families.forEach((f) => {
    collect(f.father as PersonProfile)
    collect(f.mother as PersonProfile)
    f.children?.forEach(collect)
  })
  const portraits = usePortraits(handles)
  const chip = (p: Partial<PersonProfile> | undefined, extra?: { current?: boolean; note?: string }) =>
    p && !isEmpty(p) ? <PersonChip key={p.handle} person={p} mediaRef={portraits.get(p.handle!)} {...extra} /> : null

  return (
    <div className="space-y-8">
      {ppf && !isEmpty(ppf) && (
        <div>
          <FamilyHeading label={t('parents')} family={ppf} />
          <div className="grid gap-1 sm:grid-cols-2">
            {chip(ppf.father as PersonProfile)}
            {chip(ppf.mother as PersonProfile)}
          </div>
          {(ppf.children?.length ?? 0) > 1 && (
            <>
              <h3 className="mb-1 mt-4 text-sm text-muted-foreground">{t('siblings')}</h3>
              <div className="grid gap-1 sm:grid-cols-2">
                {ppf.children!.map((c) => chip(c, { current: c.handle === self }))}
              </div>
            </>
          )}
        </div>
      )}

      {families.map((f) => {
        const partner = ((f.father as PersonProfile)?.handle === self ? f.mother : f.father) as PersonProfile | undefined
        const marriage = f.marriage as EventProfile | undefined
        return (
          <div key={f.handle}>
            <FamilyHeading
              label={partner && !isEmpty(partner) ? t('partnerWith', { name: profileName(partner) }) : t('unknownPartner')}
              family={f}
              meta={[f.relationship, marriage && !isEmpty(marriage) ? `⚭ ${marriage.date}${marriage.place_name ? `, ${marriage.place_name}` : ''}` : '']
                .filter(Boolean)
                .join(' · ')}
            />
            <div className="grid gap-1 sm:grid-cols-2">{chip(partner)}</div>
            {(f.children?.length ?? 0) > 0 ? (
              <>
                <h3 className="mb-1 mt-4 text-sm text-muted-foreground">{t('children')}</h3>
                <div className="grid gap-1 sm:grid-cols-2">{f.children!.map((c) => chip(c))}</div>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t('noChildren')}</p>
            )}
          </div>
        )
      })}

      {others.map((f) => (
        <div key={f.handle}>
          <FamilyHeading label={t('otherParents')} family={f} meta={f.relationship} />
          <div className="grid gap-1 sm:grid-cols-2">
            {chip(f.father as PersonProfile)}
            {chip(f.mother as PersonProfile)}
          </div>
        </div>
      ))}
    </div>
  )
}

function FamilyHeading({ label, family, meta }: { label: string; family: FamilyProfile; meta?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
      <h3 className="font-serif text-lg">{label}</h3>
      {meta && <span className="text-sm text-muted-foreground">{meta}</span>}
      <Link to={`/family/${family.gramps_id}`} className="ml-auto text-xs tabular-nums text-muted-foreground hover:text-foreground">
        {family.gramps_id}
      </Link>
    </div>
  )
}

function Associations({ person }: { person: Person }) {
  const people = new Map((person.extended?.people ?? []).map((p) => [p.handle, p]))
  return (
    <ul className="space-y-1">
      {person.person_ref_list.map((r, i) => {
        const p = people.get(r.ref)
        if (!p) return null
        return (
          <li key={i}>
            <PersonChip
              person={{ handle: p.handle, gramps_id: p.gramps_id, name_given: displayName(p.primary_name), sex: '' }}
              mediaRef={p.media_list?.[0]}
              note={r.rel}
            />
          </li>
        )
      })}
    </ul>
  )
}

function PersonSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Skeleton className="mb-6 h-5 w-40" />
      <div className="flex gap-6">
        <Skeleton className="size-32 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-8 h-6 w-full" />
      <Skeleton className="mt-10 h-72 w-full" />
    </div>
  )
}
