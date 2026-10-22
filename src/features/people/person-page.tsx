import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { toast } from 'sonner'
import { ChartGantt, Dna, Home, Map as MapIcon, Network, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PersonChip } from '@/components/person-chip'
import { ErrorState } from '@/components/states'
import { ObjectToolbar } from '@/components/detail/object-header'
import { ObjectHistory } from '@/components/detail/object-history'
import {
  CitationsList,
  FactsTable,
  Gallery,
  NotesList,
  ReferencesList,
  type EventRow,
} from '@/components/detail/sections'
import { qs } from '@/lib/api'
import { useGetRelationQuery } from '@/api/people-api-slice.gen'
import { useAuth } from '@/lib/auth'
import { apiLocale } from '@/i18n'
import { useObjectById } from '@/lib/queries'
import { useHomePerson, useRecordVisit } from '@/lib/prefs'
import { displayName, isEmpty, profileName, typeStr } from '@/lib/format'
import type { ChildRef, EventProfile, Family, FamilyProfile, MediaRef, Person, PersonProfile } from '@/lib/types'
import { usePortraits } from '@/hooks/use-portraits'
import { useTitle } from '@/hooks/use-title'
import { Panel } from '@/components/detail/panel'
import { AlbumHero, FamilyPanel } from './album-hero'
import { LifeStory } from './life-story'
import { ExternalSearch } from './external-search'
import { AddRelativeMenu } from '@/features/editor/relationship-actions'

export function PersonPage() {
  const { id } = useParams()
  const { t } = useTranslation(['person', 'detail', 'common'])
  const { can } = useAuth()
  const q = useObjectById<Person>('person', id, { profile: 'all', extend: 'all', backlinks: true, precision: 1 })
  const person = q.data
  const profile = person?.profile
  const name = profile ? profileName(profile) : ''
  useTitle(name || id)
  useRecordVisit(person ? { kind: 'person', handle: person.handle, gramps_id: person.gramps_id, title: name } : null)

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!person || !profile) return <PersonSkeleton />
  const canUpload = can('AddObject') && can('EditObject')

  const ext = person.extended ?? {}
  const eventsByHandle = new Map((ext.events ?? []).map((e) => [e.handle, e]))
  const eventRows: EventRow[] = person.event_ref_list.map((ref, i) => ({
    event: eventsByHandle.get(ref.ref),
    profile: profile.events?.[i] ?? ({ type: '', date: '', place: '', place_name: '', summary: '' } as EventProfile),
  }))
  const names = [person.primary_name, ...person.alternate_names]

  const handles: string[] = []
  const add = (x?: Partial<PersonProfile>) => x?.handle && handles.push(x.handle)
  const ppf = profile.primary_parent_family as FamilyProfile | undefined
  if (ppf && !isEmpty(ppf)) {
    add(ppf.father as PersonProfile)
    add(ppf.mother as PersonProfile)
    ppf.children?.forEach(add)
  }
  for (const f of profile.families ?? []) {
    add(f.father as PersonProfile)
    add(f.mother as PersonProfile)
    f.children?.forEach(add)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <ObjectToolbar kind="person" object={person} title={name} onSaved={() => q.refetch()} />

      <AlbumHero
        person={person}
        profile={profile}
        name={name}
        eventRows={eventRows}
        relation={<RelationToHome person={person} />}
        actions={<PersonActions person={person} profile={profile} />}
      />

      <PortraitsScope handles={handles}>
        {(portraits) => (
          <div className="mt-10 grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
              <FamilyPanel profile={profile} portraits={portraits} action={<AddRelativeMenu person={person} />} />

              {(person.media_list.length > 0 || canUpload) && (
                <Panel
                  id="gallery"
                  title={t('photosAndDocs')}
                  action={
                    canUpload && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/new_media${qs({ person: person.handle, personName: name })}`}>
                          <Upload />
                          {t('uploadMedia')}
                        </Link>
                      </Button>
                    )
                  }
                >
                  {person.media_list.length > 0 ? (
                    <Gallery refs={person.media_list} media={ext.media} />
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('noMedia')}</p>
                  )}
                </Panel>
              )}

              {(names.length > 1 || person.attribute_list.length > 0 || person.urls.length > 0 || person.address_list.length > 0) && (
                <Panel id="facts" title={t('detail:sections.facts')}>
                  {names.length > 1 && (
                    <ul className="mb-5 space-y-3">
                      {names.map((n, i) => (
                        <li key={i}>
                          <div className="font-medium">{displayName(n)}</div>
                          <div className="text-xs text-muted-foreground">
                            {[
                              typeStr(n.type),
                              n.nick && `${t('nickname')}: ${n.nick}`,
                              n.call && `${t('callName')}: ${n.call}`,
                              n.famnick && `${t('familyNick')}: ${n.famnick}`,
                              ...(n.surname_list ?? [])
                                .filter((sn) => sn.surname && typeStr(sn.origintype))
                                .map((sn) => `${sn.surname} (${typeStr(sn.origintype)})`),
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <FactsTable attributes={person.attribute_list} urls={person.urls} addresses={person.address_list} addressDates={(profile as { addresses?: Array<{ date_str?: string }> }).addresses?.map((a) => a.date_str ?? '')} />
                </Panel>
              )}

              {person.person_ref_list.length > 0 && (
                <Panel id="associations" title={t('detail:sections.associations')}>
                  <Associations person={person} />
                </Panel>
              )}
            </div>

            <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
              <Panel id="life" title={t('lifeStory')}>
                <LifeStory rows={eventRows} profile={profile} portraits={portraits} />
              </Panel>

              {(person.note_list?.length ?? 0) > 0 && (
                <Panel id="notes" title={t('stories')}>
                  <NotesList handles={person.note_list!} />
                </Panel>
              )}

              <Panel id="family" title={t('familyDetails')}>
                <FamilyBlock profile={profile} self={person.handle} childRefs={childRefsOf(person)} />
              </Panel>

              {(person.citation_list?.length ?? 0) > 0 && (
                <Panel id="sources" title={t('detail:sections.sources')}>
                  <CitationsList handles={person.citation_list!} />
                </Panel>
              )}

              {ext.backlinks && Object.keys(ext.backlinks).some((k) => !['family', 'event'].includes(k) && ext.backlinks![k]?.length) && (
                <Panel id="references" title={t('detail:sections.references')}>
                  <ReferencesList
                    backlinks={Object.fromEntries(Object.entries(ext.backlinks).filter(([k]) => !['family', 'event'].includes(k)))}
                  />
                </Panel>
              )}

              <ObjectHistory objClass="Person" handle={person.handle} lastChange={person.change} />
            </div>
          </div>
        )}
      </PortraitsScope>
    </div>
  )
}

function PortraitsScope({ handles, children }: { handles: string[]; children: (p: Map<string, MediaRef | undefined>) => ReactNode }) {
  return <>{children(usePortraits(handles))}</>
}

function PersonActions({ person, profile }: { person: Person; profile: PersonProfile }) {
  const { t } = useTranslation(['person', 'common'])
  const [homeId, setHomeId] = useHomePerson()
  const isHome = homeId === person.gramps_id
  return (
    <div className="flex flex-wrap gap-2 max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 max-sm:[scrollbar-width:none] max-sm:[&>*]:h-10 max-sm:[&>*]:shrink-0 max-sm:[&>*]:rounded-full max-sm:[&>*]:px-4">
      <Button asChild size="sm">
        <Link to={`/tree/ancestor/${person.gramps_id}`}>
          <Network />
          {t('actions.tree')}
        </Link>
      </Button>
      <Button asChild size="sm" variant="secondary">
        <Link to={`/timeline?person=${person.gramps_id}`}>
          <ChartGantt />
          {t('actions.timeline')}
        </Link>
      </Button>
      <Button asChild size="sm" variant="secondary">
        <Link to={`/map?person=${person.gramps_id}`}>
          <MapIcon />
          {t('actions.map')}
        </Link>
      </Button>
      {!isHome && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setHomeId(person.gramps_id)
            toast.success(t('isHome'))
          }}
        >
          <Home />
          {t('actions.setHome')}
        </Button>
      )}
      {person.person_ref_list.some((r) => r.rel === 'DNA') && (
        <Button asChild size="sm" variant="ghost">
          <Link to={`/dna-matches/${person.gramps_id}`}>
            <Dna />
            {t('dnaMatches')}
          </Link>
        </Button>
      )}
      <ExternalSearch profile={profile} />
    </div>
  )
}

function RelationToHome({ person }: { person: Person }) {
  const { t } = useTranslation('person')
  const [homeId] = useHomePerson()
  const home = useObjectById<{ handle: string; profile: PersonProfile }>('person', homeId ?? undefined, {
    profile: 'self',
    keys: 'handle,profile',
  })
  const homeHandle = home.data?.handle
  const { data } = useGetRelationQuery(
    homeHandle && homeHandle !== person.handle
      ? { handle1: homeHandle, handle2: person.handle, depth: 20, locale: apiLocale() }
      : skipToken,
  )
  if (homeId === person.gramps_id)
    return <p className="text-sm font-semibold text-brass">{t('isHome')}</p>
  if (!data?.relationship_string || !home.data) return null
  return (
    <p className="text-sm font-semibold text-brass">
      {t('relationTo', { relation: data.relationship_string, name: profileName(home.data.profile) })}
    </p>
  )
}

/** family handle -> child handle -> child reference (for non-birth relations). */
function childRefsOf(person: Person) {
  const ext = person.extended as { families?: Family[]; parent_families?: Family[] } | undefined
  const out = new Map<string, Map<string, ChildRef>>()
  for (const f of [...(ext?.families ?? []), ...(ext?.parent_families ?? [])])
    out.set(f.handle, new Map((f.child_ref_list ?? []).map((c) => [c.ref, c])))
  return out
}

function FamilyBlock({ profile, self, childRefs }: { profile: PersonProfile; self: string; childRefs: Map<string, Map<string, ChildRef>> }) {
  const { t } = useTranslation(['person', 'objects'])
  const relNote = (family: string, child: string) => {
    const r = childRefs.get(family)?.get(child)
    if (!r) return undefined
    const f = typeStr(r.frel) || 'Birth'
    const m = typeStr(r.mrel) || 'Birth'
    if (f === 'Birth' && m === 'Birth') return undefined
    const lbl = (x: string) => t(`objects:childRel.${x}`, { defaultValue: x })
    if (f === m) return lbl(f)
    return [f !== 'Birth' && `${t('objects:father')}: ${lbl(f)}`, m !== 'Birth' && `${t('objects:mother')}: ${lbl(m)}`].filter(Boolean).join(', ')
  }
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
                {ppf.children!.map((c) => chip(c, { current: c.handle === self, note: relNote(ppf.handle, c.handle) }))}
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
                <div className="grid gap-1 sm:grid-cols-2">{f.children!.map((c) => chip(c, { note: relNote(f.handle, c.handle) }))}</div>
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
