import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChartGantt, Map as MapIcon, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Portrait } from '@/components/portrait'
import { ErrorState } from '@/components/states'
import { ObjectHistory } from '@/components/detail/object-history'
import { ObjectToolbar } from '@/components/detail/object-header'
import { FaceRow, FaceStack, Panel } from '@/components/detail/panel'
import { CitationsList, FactsTable, Gallery, NotesList } from '@/components/detail/sections'
import { isEmpty, profileName, typeStr, yearOf } from '@/lib/format'
import type { EventProfile, FamilyProfile, GEvent, MediaRef, PersonProfile, Place } from '@/lib/types'
import { usePortraits } from '@/hooks/use-portraits'
import { coords, PlaceMap } from './place-map'
import { AlbumFrame, AlbumGrid, CoverVisual, HeroActions, HeroFacts, ObjectHero, PhotoVisual } from './album'
import { countRefs, eventTitle, familyTitle, ObjectSkeleton, referenceItems, RichReferences, useObjectPage } from './shared'

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
  const placeName = profile.place || profile.place_name || place?.title
  // everyone involved as faces in the hero: people, then the partners of families
  const faces = [
    ...people.map((p) => p.person),
    ...families.flatMap((f) => [f.family.father, f.family.mother] as Array<PersonProfile | undefined>),
  ].filter((p): p is PersonProfile => !!p && !isEmpty(p))
  const year = yearOf(profile.date)

  const visual = ll ? (
    <PlaceMap hero lat={ll[0]} lng={ll[1]} label={profile.place_name || place?.title} zoom={9} />
  ) : media.length ? (
    <PhotoVisual refs={media} media={ext.media} label={t('album.openPhotos')} />
  ) : (
    <CoverVisual icon={CalendarDays} glyph={year ? String(year) : undefined} label={profile.type || t('common:object.event')} sub={event.gramps_id} />
  )

  return (
    <AlbumFrame>
      <ObjectToolbar kind="event" object={event} title={title} onSaved={() => q.refetch()} />

      <ObjectHero
        size={ll ? 'wide' : media.length ? 'portrait' : 'cover'}
        visual={visual}
        eyebrow={<p className="text-sm font-semibold text-brass">{profile.type || typeStr(event.type)}</p>}
        title={title}
        subtitle={event.description && !/^\S+ (of|von) /.test(event.description) ? event.description : undefined}
        tags={ext.tags}
        actions={
          (event.date?.sortval || place) && (
            <HeroActions>
              {event.date?.sortval ? (
                <Button asChild size="sm">
                  <Link to={`/timeline?event=${event.gramps_id}`}>
                    <ChartGantt />
                    {t('showOnTimeline')}
                  </Link>
                </Button>
              ) : null}
              {place && (
                <Button asChild size="sm" variant="secondary">
                  <Link to={`/place/${place.gramps_id}`}>
                    <MapIcon />
                    {profile.place_name || place.title || place.gramps_id}
                  </Link>
                </Button>
              )}
            </HeroActions>
          )
        }
      >
        <HeroFacts
          className="max-lg:justify-items-center max-lg:text-center sm:max-lg:justify-center"
          items={[
            { label: t('album.when'), value: profile.date || t('noDate') },
            placeName && {
              label: t('album.where'),
              value: place ? (
                <Link to={`/place/${place.gramps_id}`} className="hover:underline">
                  {profile.place_name || place.title}
                </Link>
              ) : (
                placeName
              ),
              detail: profile.place && profile.place !== profile.place_name ? profile.place : undefined,
            },
          ]}
        />
        {faces.length > 0 && (
          <div className="mt-6 flex items-center gap-3 max-lg:justify-center">
            <FaceStack people={faces} portraits={portraits} ring="ring-background" moreHref="#participants" />
            <span className="text-sm text-muted-foreground">{t('album.participants', { count: participantCount })}</span>
          </div>
        )}
      </ObjectHero>

      <AlbumGrid
        aside={
          <>
            {participantCount > 0 && (
              <Panel id="participants" title={t('detail:sections.participants')} count={participantCount}>
                <ul className="grid gap-0.5">
                  {people.map((p) => (
                    <li key={p.person.handle} className="min-w-0">
                      <FaceRow person={p.person} portrait={portraits.get(p.person.handle)} note={p.role} />
                    </li>
                  ))}
                  {families.map((f) => (
                    <li key={f.family.handle} className="min-w-0">
                      <FamilyChip family={f.family} role={f.role} portraits={portraits} />
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {media.length > 0 && (
              <Panel id="gallery" title={t('album.photosAndDocs')} count={media.length}>
                <Gallery refs={media} media={ext.media} />
              </Panel>
            )}
            {event.attribute_list.length > 0 && (
              <Panel id="facts" title={t('detail:sections.facts')}>
                <FactsTable attributes={event.attribute_list} />
              </Panel>
            )}
          </>
        }
        main={
          <>
            {notes.length > 0 && (
              <Panel id="notes" title={t('album.stories')} count={notes.length}>
                <NotesList handles={notes} />
              </Panel>
            )}
            {cites.length > 0 && (
              <Panel id="sources" title={t('detail:sections.sources')} count={cites.length}>
                <CitationsList handles={cites} />
              </Panel>
            )}
            {refs.length > 0 && (
              <Panel id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
                <RichReferences groups={refs} />
              </Panel>
            )}
            <ObjectHistory objClass="Event" handle={event.handle} lastChange={event.change} />
          </>
        }
      />
    </AlbumFrame>
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
      className="-mx-2 flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1.5 outline-none transition-colors duration-150 hover:bg-accent focus-visible:bg-accent"
    >
      <span className="flex shrink-0 -space-x-3">
        {partners.length ? (
          partners.map((p) => (
            <Portrait key={p.handle} mediaRef={portraits.get(p.handle)} name={profileName(p)} sex={p.sex} size={40} className="ring-[3px] ring-card" />
          ))
        ) : (
          <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
            <UsersRound className="size-4 text-muted-foreground" />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold leading-tight">{familyTitle(family, t('unknown'))}</span>
        <span className="block truncate text-xs tabular-nums text-muted-foreground">
          {[role, family.relationship, marriage && !isEmpty(marriage) && marriage.date ? `⚭ ${marriage.date}` : '']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </Link>
  )
}
