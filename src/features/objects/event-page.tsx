import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChartGantt, MapPin, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PersonChip } from '@/components/person-chip'
import { Portrait } from '@/components/portrait'
import { ErrorState } from '@/components/states'
import { ObjectHistory } from '@/components/detail/object-history'
import { ObjectTitle, ObjectToolbar } from '@/components/detail/object-header'
import { CitationsList, DetailSection, FactsTable, Gallery, NotesList, SectionNav } from '@/components/detail/sections'
import { isEmpty, profileName, typeStr } from '@/lib/format'
import type { EventProfile, FamilyProfile, GEvent, MediaRef, PersonProfile, Place } from '@/lib/types'
import { usePortraits } from '@/hooks/use-portraits'
import { coords, PlaceMap } from './place-map'
import {
  Columns,
  countRefs,
  eventTitle,
  familyTitle,
  navItems,
  ObjectSkeleton,
  PageFrame,
  referenceItems,
  RichReferences,
  useObjectPage,
} from './shared'

type Participants = {
  people?: Array<{ role: string; person: PersonProfile }>
  families?: Array<{ role: string; family: FamilyProfile }>
}

export function EventPage() {
  const { id } = useParams()
  const { t } = useTranslation(['objects', 'detail', 'common'])
  const { q, title } = useObjectPage<GEvent>('event', id, (e) => eventTitle(t, e.profile, typeStr(e.type) || e.gramps_id))
  const event = q.data
  const profile = event?.profile
  const parts: Participants = profile?.participants ?? {}
  const people = parts.people ?? []
  const families = parts.families ?? []
  const portraits = usePortraits([
    ...people.map((p) => p.person.handle),
    ...families.flatMap((f) => [(f.family.father as PersonProfile)?.handle, (f.family.mother as PersonProfile)?.handle]),
  ])

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!event || !profile) return <ObjectSkeleton />

  const ext = event.extended ?? {}
  const place = ext.place && !isEmpty(ext.place) ? (ext.place as Place) : undefined
  const ll = place ? coords(place.lat, place.long) : null
  const media = event.media_list ?? []
  const notes = event.note_list ?? []
  const cites = event.citation_list ?? []
  // people and families are shown with their roles as participants
  const refs = referenceItems(ext.backlinks as never, (profile as { references?: never }).references, ['person', 'family'])
  const participantCount = people.length + families.length

  const nav = navItems([
    participantCount > 0 && { id: 'participants', label: t('detail:sections.participants'), count: participantCount },
    !!ll && { id: 'map', label: t('detail:sections.map') },
    media.length > 0 && { id: 'gallery', label: t('detail:sections.gallery'), count: media.length },
    notes.length > 0 && { id: 'notes', label: t('detail:sections.notes'), count: notes.length },
    cites.length > 0 && { id: 'sources', label: t('detail:sections.sources'), count: cites.length },
    event.attribute_list.length > 0 && { id: 'facts', label: t('detail:sections.facts') },
    refs.length > 0 && { id: 'references', label: t('detail:sections.references'), count: countRefs(refs) },
  ])

  return (
    <PageFrame>
      <ObjectToolbar
        kind="event"
        object={event}
        title={title}
        onSaved={() => q.refetch()}
        extra={
          event.date?.sortval ? (
            <Button asChild variant="ghost" size="icon" className="max-md:size-11" aria-label={t('showOnTimeline')} title={t('showOnTimeline')}>
              <Link to={`/timeline?event=${event.gramps_id}`}>
                <ChartGantt />
              </Link>
            </Button>
          ) : undefined
        }
      />

      <ObjectTitle
        title={title}
        tags={ext.tags}
        subtitle={
          <div className="space-y-2">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem] text-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span className="tabular-nums">{profile.date || t('noDate')}</span>
              </span>
              {place && (
                <Link to={`/place/${place.gramps_id}`} className="inline-flex items-center gap-1.5 hover:underline">
                  <MapPin className="size-4 text-muted-foreground" />
                  {profile.place || profile.place_name || place.title}
                </Link>
              )}
            </div>
            {event.description && <p className="max-w-prose text-muted-foreground">{event.description}</p>}
          </div>
        }
      />

      <SectionNav items={nav} />

      <Columns
        main={
          <>
            {participantCount > 0 && (
              <DetailSection id="participants" title={t('detail:sections.participants')} count={participantCount}>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {people.map((p) => (
                    <li key={p.person.handle}>
                      <PersonChip person={p.person} mediaRef={portraits.get(p.person.handle)} note={p.role} size={44} />
                    </li>
                  ))}
                  {families.map((f) => (
                    <li key={f.family.handle}>
                      <FamilyChip family={f.family} role={f.role} portraits={portraits} />
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}

            {notes.length > 0 && (
              <DetailSection id="notes" title={t('detail:sections.notes')} count={notes.length}>
                <NotesList handles={notes} />
              </DetailSection>
            )}

            {cites.length > 0 && (
              <DetailSection id="sources" title={t('detail:sections.sources')} count={cites.length}>
                <CitationsList handles={cites} />
              </DetailSection>
            )}
          </>
        }
        aside={
          <>
            {ll && place && (
              <DetailSection id="map" title={t('detail:sections.map')}>
                <PlaceMap lat={ll[0]} lng={ll[1]} label={profile.place_name || place.title} zoom={9} />
              </DetailSection>
            )}
            {media.length > 0 && (
              <DetailSection id="gallery" title={t('detail:sections.gallery')} count={media.length}>
                <Gallery refs={media} media={ext.media} />
              </DetailSection>
            )}
            {event.attribute_list.length > 0 && (
              <DetailSection id="facts" title={t('detail:sections.facts')}>
                <FactsTable attributes={event.attribute_list} />
              </DetailSection>
            )}
            {refs.length > 0 && (
              <DetailSection id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
                <RichReferences groups={refs} />
              </DetailSection>
            )}
            <ObjectHistory objClass="Event" handle={event.handle} lastChange={event.change} />
          </>
        }
      />
    </PageFrame>
  )
}

/** Family participant: both partners' portraits overlapping, names, role. */
function FamilyChip({
  family,
  role,
  portraits,
}: {
  family: FamilyProfile
  role: string
  portraits: Map<string, MediaRef | undefined>
}) {
  const { t } = useTranslation('common')
  const partners = [family.father, family.mother].filter((p): p is PersonProfile => !!p && !isEmpty(p))
  const marriage = family.marriage as EventProfile | undefined
  return (
    <Link
      to={`/family/${family.gramps_id}`}
      className="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
    >
      <span className="flex shrink-0 -space-x-3">
        {partners.length ? (
          partners.map((p) => (
            <Portrait key={p.handle} mediaRef={portraits.get(p.handle)} name={profileName(p)} sex={p.sex} size={40} />
          ))
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
            <UsersRound className="size-4 text-muted-foreground" />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium leading-tight">{familyTitle(family, t('unknown'))}</span>
        <span className="block truncate text-xs tabular-nums text-muted-foreground">
          {[role, family.relationship, marriage && !isEmpty(marriage) && marriage.date ? `⚭ ${marriage.date}` : '']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </Link>
  )
}
