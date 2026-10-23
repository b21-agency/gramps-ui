import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { ArrowUpRight, FileText, MapPin, MapPinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { mediaCroppedUrl, mediaThumbUrl } from '@/lib/api'
import { useMapEventsByHandleQuery } from '@/api/enhanced/map'
import { apiLocale } from '@/i18n'
import { useObjectByHandle } from '@/lib/queries'
import { profileName } from '@/lib/format'
import type { GEvent, Media, Place } from '@/lib/types'
import { validCoords } from './data'
import { cn } from '@/lib/utils'

const PAGE = 40

/** Place summary + the events that happened there (from backlinks). */
export function PlaceDetails({ handle, range }: { handle: string; range?: [number, number] | null }) {
  const { t } = useTranslation(['map', 'common'])
  const q = useObjectByHandle<Place>('place', handle, { profile: ['self'], backlinks: true, extend: ['media_list'] })
  const place = q.data
  const eventHandles = place?.backlinks?.event ?? []
  const [limit, setLimit] = useState(PAGE)

  // all of them (raw dates are needed for sorting); the endpoint fetches in slices
  const eventsQ = useMapEventsByHandleQuery(eventHandles.length ? { handles: eventHandles, locale: apiLocale() } : skipToken)
  const sorted = useMemo(
    () => (eventsQ.data ? [...eventsQ.data].sort((a, b) => (a.date?.sortval || Infinity) - (b.date?.sortval || Infinity)) : undefined),
    [eventsQ.data],
  )
  const events = { ...eventsQ, data: sorted }

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!place) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  const p = place.profile
  const parents = (p?.parent_places ?? []).map((pp) => pp.name).filter(Boolean)
  const list = events.data ?? []
  const inRange = (e: GEvent) => {
    if (!range) return true
    const y = e.date?.year || e.date?.dateval?.[2]
    return !!y && y >= range[0] && y <= range[1]
  }

  const media = (place.media_list ?? []).map((ref, i) => ({ ref, m: (place.extended?.media as Media[] | undefined)?.[i] }))
  const heroPhoto = media.find(({ m }) => !m || m.mime?.startsWith('image'))
  const rest = media.filter((x) => x !== heroPhoto)
  const name = p?.name || place.title || place.gramps_id

  return (
    <div className="min-w-0">
      {heroPhoto && (
        <Link
          to={heroPhoto.m ? `/media/${heroPhoto.m.gramps_id}` : '#'}
          className="mb-5 block h-44 overflow-hidden rounded-2xl bg-secondary sm:h-48"
          title={heroPhoto.m?.desc}
        >
          <img
            src={
              heroPhoto.ref.rect
                ? mediaCroppedUrl(heroPhoto.ref.ref, heroPhoto.ref.rect, 700, { square: false })
                : mediaThumbUrl(heroPhoto.ref.ref, 700, { square: false })
            }
            alt=""
            onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = 'none')}
            className="size-full object-cover [filter:sepia(0.18)_contrast(1.04)] transition-transform duration-500 ease-out hover:scale-[1.02]"
          />
        </Link>
      )}
      <div className="pr-10">
        <MapPin className="mb-2 size-5 text-brass" aria-hidden />
        <h2 className="font-serif text-4xl leading-[1.02] font-medium tracking-[-0.02em] text-balance [overflow-wrap:anywhere]">{name}</h2>
        {(p?.type || parents.length > 0) && (
          <p className="mt-2 font-serif text-lg italic text-muted-foreground">{[p?.type, parents.join(', ')].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      {!validCoords(place.lat, place.long) && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPinOff className="size-4" />
          {t('noCoordsShort')}
        </p>
      )}
      {rest.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {rest.map(({ ref, m }, i) => (
            <Link key={`${ref.ref}-${i}`} to={m ? `/media/${m.gramps_id}` : '#'} className="shrink-0" title={m?.desc}>
              {m && !m.mime?.startsWith('image') ? (
                <span className="flex size-16 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <FileText className="size-6" />
                </span>
              ) : (
                <img
                  src={ref.rect ? mediaCroppedUrl(ref.ref, ref.rect, 120, { square: true }) : mediaThumbUrl(ref.ref, 120, { square: true })}
                  alt={m?.desc ?? ''}
                  className="size-16 rounded-xl object-cover"
                  loading="lazy"
                />
              )}
            </Link>
          ))}
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild className="h-11 rounded-full px-5">
          <Link to={`/place/${place.gramps_id}`}>
            {t('openPlace')}
            <ArrowUpRight />
          </Link>
        </Button>
      </div>

      <div className="mt-7 mb-3 flex items-baseline gap-2">
        <h3 className="font-serif text-2xl font-medium">{t('eventsHere')}</h3>
        <span className="text-sm tabular-nums text-muted-foreground">{eventHandles.length}</span>
      </div>
      {eventHandles.length === 0 && <p className="py-1 text-sm text-muted-foreground">{t('noEventsHere')}</p>}
      {events.isLoading && (
        <div className="space-y-2 py-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      )}
      <ol className="relative">
        {list.length > 0 && <span aria-hidden className="absolute top-3 bottom-3 left-[4.06rem] w-0.5 rounded-full bg-lineage/70" />}
        {list.slice(0, limit).map((e, i, arr) => {
          const prof = e.profile
          const people = prof?.participants?.people ?? []
          const fams = prof?.participants?.families ?? []
          const who = [
            ...people.slice(0, 2).map((x) => ({ id: x.person.gramps_id, kind: 'person', name: profileName(x.person) })),
            ...fams.slice(0, 1).map((x) => ({
              id: x.family.gramps_id,
              kind: 'family',
              name: [profileName(x.family.father), profileName(x.family.mother)].filter(Boolean).join(' & '),
            })),
          ].filter((x) => x.name)
          const year = yearOfEvent(e)
          const showYear = i === 0 || yearOfEvent(arr[i - 1]) !== year
          return (
            <li key={e.handle} className={cn('flex gap-3 py-2', !inRange(e) && 'opacity-45')}>
              <span
                className={cn(
                  'w-12 shrink-0 pt-0.5 text-right font-serif text-xl leading-none tabular-nums text-brass',
                  !showYear && 'invisible',
                )}
              >
                {year ?? '—'}
              </span>
              <span aria-hidden className="relative z-10 mt-1 size-3 shrink-0 rounded-full bg-primary ring-4 ring-card" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <Link to={`/event/${e.gramps_id}`} className="text-[15px] font-semibold hover:underline">
                    {prof?.type || String(e.type)}
                  </Link>
                  {prof?.date && prof.date !== String(year) && (
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{prof.date}</span>
                  )}
                </span>
                {who.length > 0 && (
                  <span className="mt-0.5 flex flex-wrap gap-x-2 text-sm">
                    {who.map((w) => (
                      <Link key={w.id} to={`/${w.kind}/${w.id}`} className="truncate text-muted-foreground hover:text-foreground hover:underline">
                        {w.name}
                      </Link>
                    ))}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
      {list.length > limit && (
        <Button variant="secondary" className="mt-2 h-11 w-full rounded-full" onClick={() => setLimit((l) => l + PAGE)}>
          {t('showMore', { count: list.length - limit })}
        </Button>
      )}
    </div>
  )
}

function yearOfEvent(e: GEvent): number | null {
  return e.date?.year || e.date?.dateval?.[2] || null
}
