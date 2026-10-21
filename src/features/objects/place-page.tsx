import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Map as MapIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/states'
import { ObjectTitle, ObjectToolbar } from '@/components/detail/object-header'
import { ObjectHistory } from '@/components/detail/object-history'
import { CitationsList, DetailSection, FactsTable, Gallery, NotesList, SectionNav } from '@/components/detail/sections'
import { typeStr } from '@/lib/format'
import type { EventProfile, Place } from '@/lib/types'
import { coords, PlaceMap } from './place-map'
import {
  Columns,
  countRefs,
  navItems,
  ObjectSkeleton,
  PageFrame,
  referenceItems,
  RichReferences,
  ShowMore,
  summaryNames,
  useLimited,
  useObjectPage,
  type AnyObj,
} from './shared'

type PlaceProfile = NonNullable<Place['profile']> & {
  direct_parent_places?: Array<{ date_str: string; place: { gramps_id: string; name: string; type: string } }>
  references?: Record<string, AnyObj[]>
}

export function PlacePage() {
  const { id } = useParams()
  const { t } = useTranslation(['objects', 'detail', 'common'])
  const { q, title } = useObjectPage<Place>('place', id, (p) => p.profile?.name || p.name?.value || p.title || p.gramps_id)
  const place = q.data

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!place || !place.profile) return <ObjectSkeleton />

  const profile = place.profile as PlaceProfile
  const ext = place.extended ?? {}
  const backlinks = (ext.backlinks ?? {}) as Record<string, AnyObj[]>
  const references = profile.references ?? {}
  const ll = place.lat && place.long ? coords(profile.lat ?? place.lat, profile.long ?? place.long) : null

  // parent chain: profile.parent_places goes from the direct parent up to the root
  const parents = [...(profile.parent_places ?? [])].reverse()
  // a place can be enclosed by several places, e.g. over different periods
  const directParents = profile.direct_parent_places ?? []
  const showDirect = directParents.length > 1 || directParents.some((d) => d.date_str)
  const altNames =
    profile.alternate_place_names?.filter((a) => a.value) ??
    place.alt_names.map((n) => ({ value: n.value, date_str: '' }))
  const enclosed = [...(backlinks.place ?? [])].sort((a, b) =>
    String(a.name?.value ?? a.title).localeCompare(String(b.name?.value ?? b.title), undefined, { numeric: true }),
  )

  const evRaw = backlinks.event ?? []
  const evProf = references.event ?? []
  const events = evRaw
    .map((raw, i) => ({ raw, profile: (evProf.length === evRaw.length ? evProf[i] : undefined) as EventProfile | undefined }))
    .sort((a, b) => (a.raw.date?.sortval || Infinity) - (b.raw.date?.sortval || Infinity))

  const refs = referenceItems(backlinks, references, ['place', 'event'])
  const media = place.media_list ?? []
  const notes = place.note_list ?? []
  const cites = place.citation_list ?? []

  const nav = navItems([
    events.length > 0 && { id: 'events', label: t('detail:sections.events'), count: events.length },
    enclosed.length > 0 && { id: 'enclosed', label: t('detail:sections.enclosed'), count: enclosed.length },
    !!ll && { id: 'map', label: t('detail:sections.map') },
    altNames.length > 0 && { id: 'names', label: t('detail:sections.altNames'), count: altNames.length },
    media.length > 0 && { id: 'gallery', label: t('detail:sections.gallery'), count: media.length },
    notes.length > 0 && { id: 'notes', label: t('detail:sections.notes'), count: notes.length },
    cites.length > 0 && { id: 'sources', label: t('detail:sections.sources'), count: cites.length },
    place.urls.length > 0 && { id: 'facts', label: t('detail:sections.facts') },
    refs.length > 0 && { id: 'references', label: t('detail:sections.references'), count: countRefs(refs) },
  ])

  return (
    <PageFrame>
      <ObjectToolbar kind="place" object={place} title={title} onSaved={() => q.refetch()} />

      {parents.length > 0 && (
        <nav aria-label={t('detail:sections.hierarchy')} className="-mt-1 mb-2">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-muted-foreground">
            {parents.map((p) => (
              <li key={p.gramps_id} className="inline-flex items-center gap-1">
                <Link to={`/place/${p.gramps_id}`} className="hover:text-foreground hover:underline" title={p.type}>
                  {p.name}
                </Link>
                <ChevronRight className="size-3.5 opacity-60" aria-hidden />
              </li>
            ))}
          </ol>
        </nav>
      )}
      {showDirect && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground" aria-label={t('detail:sections.hierarchy')}>
          {directParents.map((d, i) => (
            <li key={`${d.place.gramps_id}-${i}`}>
              <span>{t('detail:sections.hierarchy')} </span>
              <Link to={`/place/${d.place.gramps_id}`} className="text-foreground hover:underline" title={d.place.type}>
                {d.place.name}
              </Link>
              {d.date_str && <span className="tabular-nums"> · {d.date_str}</span>}
            </li>
          ))}
        </ul>
      )}

      <ObjectTitle
        title={title}
        tags={ext.tags}
        subtitle={
          <span className="flex flex-wrap gap-x-3">
            {(profile.type || typeStr(place.place_type)) && <span>{profile.type || typeStr(place.place_type)}</span>}
            {place.code && <span className="tabular-nums">{place.code}</span>}
            {place.title && place.title !== title && <span>{place.title}</span>}
          </span>
        }
        aside={
          ll ? (
            <Button asChild size="sm" variant="outline" className="self-start">
              <Link to={`/map?place=${place.gramps_id}`}>
                <MapIcon />
                {t('openInMap')}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <SectionNav items={nav} />

      <Columns
        main={
          <>
            {events.length > 0 && (
              <DetailSection id="events" title={t('detail:sections.events')} count={events.length}>
                <PlaceEvents events={events} />
              </DetailSection>
            )}

            {enclosed.length > 0 && (
              <DetailSection id="enclosed" title={t('detail:sections.enclosed')} count={enclosed.length}>
                <EnclosedPlaces places={enclosed} />
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
            {ll && (
              <DetailSection id="map" title={t('detail:sections.map')}>
                <PlaceMap lat={ll[0]} lng={ll[1]} label={title} zoom={zoomFor(profile.type || typeStr(place.place_type))} />
              </DetailSection>
            )}
            {altNames.length > 0 && (
              <DetailSection id="names" title={t('detail:sections.altNames')} count={altNames.length}>
                <ul className="space-y-1.5 text-sm">
                  {altNames.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-medium">{a.value}</span>
                      {a.date_str && <span className="tabular-nums text-muted-foreground">{a.date_str}</span>}
                      {place.alt_names[i]?.lang && <span className="text-muted-foreground">({place.alt_names[i].lang})</span>}
                    </li>
                  ))}
                </ul>
              </DetailSection>
            )}
            {media.length > 0 && (
              <DetailSection id="gallery" title={t('detail:sections.gallery')} count={media.length}>
                <Gallery refs={media} media={ext.media} />
              </DetailSection>
            )}
            {place.urls.length > 0 && (
              <DetailSection id="facts" title={t('detail:sections.facts')}>
                <FactsTable urls={place.urls} />
              </DetailSection>
            )}
            {refs.length > 0 && (
              <DetailSection id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
                <RichReferences groups={refs} />
              </DetailSection>
            )}
            <ObjectHistory objClass="Place" handle={place.handle} lastChange={place.change} />
          </>
        }
      />
    </PageFrame>
  )
}

function zoomFor(type: string) {
  const s = type.toLowerCase()
  if (/country|land|staat\b/.test(s)) return 4
  if (/state|province|bundesland|region|provinz/.test(s)) return 6
  if (/county|district|kreis|bezirk/.test(s)) return 8
  if (/street|building|address|farm|straße|gebäude|hof|kirche|church|cemetery|friedhof/.test(s)) return 15
  return 11
}

function PlaceEvents({ events }: { events: Array<{ raw: AnyObj; profile?: EventProfile }> }) {
  const { shown, hidden, all, setAll } = useLimited(events, 25)
  return (
    <>
      <ol className="divide-y">
        {shown.map(({ raw, profile }) => {
          const names = summaryNames(profile?.summary)
          return (
            <li key={raw.handle}>
              <Link to={`/event/${raw.gramps_id}`} className="-mx-2 flex items-baseline gap-4 rounded-md px-2 py-2.5 hover:bg-accent">
                <span className="w-28 shrink-0 text-sm tabular-nums text-muted-foreground sm:w-36">{profile?.date || '—'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {profile?.type || typeStr(raw.type)}
                    {names && <span className="font-normal"> · {names}</span>}
                  </span>
                  {raw.description && <span className="block truncate text-sm text-muted-foreground">{raw.description}</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
      <ShowMore hidden={hidden} all={all} onToggle={() => setAll(!all)} />
    </>
  )
}

function EnclosedPlaces({ places }: { places: AnyObj[] }) {
  const { shown, hidden, all, setAll } = useLimited(places, 40)
  return (
    <>
      <ul className="grid gap-x-6 sm:grid-cols-2">
        {shown.map((p) => (
          <li key={p.handle}>
            <Link to={`/place/${p.gramps_id}`} className="-mx-2 flex items-baseline gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
              <span className="min-w-0 truncate font-medium">{p.name?.value || p.title || p.gramps_id}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{typeStr(p.place_type)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <ShowMore hidden={hidden} all={all} onToggle={() => setAll(!all)} />
    </>
  )
}
