import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Map as MapIcon, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/states'
import { ObjectToolbar } from '@/components/detail/object-header'
import { ObjectHistory } from '@/components/detail/object-history'
import { Panel } from '@/components/detail/panel'
import { CitationsList, FactsTable, Gallery, NotesList } from '@/components/detail/sections'
import { typeStr, yearOf } from '@/lib/format'
import { useTypeLabel } from '@/features/lists/use-types'
import type { EventProfile, Place } from '@/lib/types'
import { coords, PlaceMap } from './place-map'
import { AlbumFrame, AlbumGrid, CoverVisual, glyphOf, HeroActions, ObjectHero, PhotoVisual, YearTimeline, type TimelineEntry } from './album'
import {
  countRefs,
  NewLinkedButton,
  ObjectSkeleton,
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
  const type = profile.type || typeStr(place.place_type)

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
  const entries: TimelineEntry[] = events.map(({ raw, profile: p }) => {
    const names = summaryNames(p?.summary)
    return {
      key: raw.handle,
      year: yearOf(p?.date),
      date: p?.date ?? '',
      title: (
        <>
          {p?.type || typeStr(raw.type)}
          {names && <span className="font-normal"> · {names}</span>}
        </>
      ),
      detail: raw.description && !/^\S+ (of|von) /.test(raw.description) ? raw.description : undefined,
      to: `/event/${raw.gramps_id}`,
    }
  })

  const refs = referenceItems(backlinks, references, ['place', 'event'])
  const media = place.media_list ?? []
  const notes = place.note_list ?? []
  const cites = place.citation_list ?? []

  const visual = ll ? (
    <PlaceMap hero lat={ll[0]} lng={ll[1]} label={title} zoom={zoomFor(type)} />
  ) : media.length ? (
    <PhotoVisual refs={media} media={ext.media} label={t('album.openPhotos')} />
  ) : (
    <CoverVisual icon={MapPin} glyph={glyphOf(title)} label={type || t('common:object.place')} sub={place.gramps_id} />
  )

  const years = entries.map((e) => e.year).filter((y): y is number => y != null)
  const meta = [
    type,
    place.code,
    place.title && place.title !== title ? place.title : '',
    events.length ? t('album.eventsHere', { count: events.length }) + (years.length > 1 ? ` · ${Math.min(...years)}–${Math.max(...years)}` : '') : '',
    enclosed.length ? t('album.placesWithin', { count: enclosed.length }) : '',
  ].filter(Boolean)

  return (
    <AlbumFrame>
      <ObjectToolbar
        kind="place"
        object={place}
        title={title}
        onSaved={() => q.refetch()}
        extra={<NewLinkedButton to={`/new_place?parent=${place.handle}`} label={t('addEnclosed')} />}
      />

      <ObjectHero
        size={ll ? 'wide' : media.length ? 'portrait' : 'cover'}
        visual={visual}
        eyebrow={
          (parents.length > 0 || showDirect) && (
            <>
              {parents.length > 0 && (
                <nav aria-label={t('detail:sections.hierarchy')}>
                  <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm font-semibold text-brass max-lg:justify-center">
                    {parents.map((p, i) => (
                      <li key={p.gramps_id} className="inline-flex items-center gap-1">
                        {i > 0 && <ChevronRight className="size-3.5 opacity-60" aria-hidden />}
                        <Link to={`/place/${p.gramps_id}`} className="hover:underline" title={p.type}>
                          {p.name}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              {showDirect && (
                <ul
                  className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-muted-foreground max-lg:justify-center"
                  aria-label={t('detail:sections.hierarchy')}
                >
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
            </>
          )
        }
        title={title}
        tags={ext.tags}
        actions={
          ll ? (
            <HeroActions>
              <Button asChild size="sm">
                <Link to={`/map?place=${place.gramps_id}`}>
                  <MapIcon />
                  {t('openInMap')}
                </Link>
              </Button>
            </HeroActions>
          ) : undefined
        }
      >
        {meta.length > 0 && (
          <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground tabular-nums max-lg:justify-center max-lg:text-center">
            {meta.map((m, i) => (
              <span key={i}>
                {i > 0 && <span className="mr-3 opacity-50">·</span>}
                {m}
              </span>
            ))}
          </p>
        )}
      </ObjectHero>

      <AlbumGrid
        aside={
          <>
            {enclosed.length > 0 && (
              <Panel id="enclosed" title={t('detail:sections.enclosed')} count={enclosed.length}>
                <EnclosedPlaces places={enclosed} />
              </Panel>
            )}
            {altNames.length > 0 && (
              <Panel id="names" title={t('detail:sections.altNames')} count={altNames.length}>
                <ul className="space-y-2 text-sm">
                  {altNames.map((a, i) => (
                    <li key={i} className="flex flex-wrap gap-x-2">
                      <span className="font-serif text-lg leading-tight">{a.value}</span>
                      {a.date_str && <span className="self-end tabular-nums text-muted-foreground">{a.date_str}</span>}
                      {place.alt_names[i]?.lang && <span className="self-end text-muted-foreground">({place.alt_names[i].lang})</span>}
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
            {place.urls.length > 0 && (
              <Panel id="facts" title={t('detail:sections.facts')}>
                <FactsTable urls={place.urls} />
              </Panel>
            )}
            {refs.length > 0 && (
              <Panel id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
                <RichReferences groups={refs} />
              </Panel>
            )}
          </>
        }
        main={
          <>
            {events.length > 0 && (
              <Panel id="events" title={t('album.happenedHere')} count={events.length}>
                <YearTimeline entries={entries} limit={25} />
              </Panel>
            )}
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
            <ObjectHistory objClass="Place" handle={place.handle} lastChange={place.change} />
          </>
        }
      />
    </AlbumFrame>
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

function EnclosedPlaces({ places }: { places: AnyObj[] }) {
  const { shown, hidden, all, setAll } = useLimited(places, 40)
  const placeType = useTypeLabel('place_types')
  return (
    <>
      <ul className="grid gap-0.5">
        {shown.map((p) => (
          <li key={p.handle} className="min-w-0">
            <Link
              to={`/place/${p.gramps_id}`}
              className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors duration-150 hover:bg-accent"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <MapPin className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{p.name?.value || p.title || p.gramps_id}</span>
                <span className="block truncate text-xs text-muted-foreground">{placeType(typeStr(p.place_type))}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ShowMore hidden={hidden} all={all} onToggle={() => setAll(!all)} />
    </>
  )
}
