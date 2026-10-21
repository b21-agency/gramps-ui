import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, FileText, MapPin, MapPinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { api, mediaCroppedUrl, mediaThumbUrl } from '@/lib/api'
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
  const q = useObjectByHandle<Place>('place', handle, { profile: 'self', backlinks: true, extend: 'media_list' })
  const place = q.data
  const eventHandles = place?.backlinks?.event ?? []
  const [limit, setLimit] = useState(PAGE)

  const events = useQuery({
    queryKey: ['events', 'at-place', handle, eventHandles.length, apiLocale()],
    enabled: eventHandles.length > 0,
    queryFn: async () => {
      // fetch all (raw dates are needed for sorting), but in slices to keep URLs short
      const out: GEvent[] = []
      for (let i = 0; i < eventHandles.length; i += 80) {
        const part = await api<GEvent[]>('/events/', {
          query: {
            handles: eventHandles.slice(i, i + 80).join(','),
            keys: 'handle,gramps_id,date,type,profile',
            profile: 'participants',
            locale: apiLocale(),
          },
        })
        out.push(...part)
      }
      return out.sort((a, b) => (a.date?.sortval || Infinity) - (b.date?.sortval || Infinity))
    },
  })

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

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPin className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-medium leading-tight">{p?.name || place.title || place.gramps_id}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[p?.type, parents.join(', ')].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      {!validCoords(place.lat, place.long) && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPinOff className="size-4" />
          {t('noCoordsShort')}
        </p>
      )}
      {(place.media_list?.length ?? 0) > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(place.media_list ?? []).map((ref, i) => {
            const m = (place.extended?.media as Media[] | undefined)?.[i]
            return (
              <Link key={`${ref.ref}-${i}`} to={m ? `/media/${m.gramps_id}` : '#'} className="shrink-0" title={m?.desc}>
                {m && !m.mime?.startsWith('image') ? (
                  <span className="flex size-16 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <FileText className="size-6" />
                  </span>
                ) : (
                  <img
                    src={ref.rect ? mediaCroppedUrl(ref.ref, ref.rect, 120, { square: true }) : mediaThumbUrl(ref.ref, 120, { square: true })}
                    alt={m?.desc ?? ''}
                    className="size-16 rounded-md border object-cover"
                    loading="lazy"
                  />
                )}
              </Link>
            )
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to={`/place/${place.gramps_id}`}>
            {t('openPlace')}
            <ArrowUpRight />
          </Link>
        </Button>
      </div>

      <div className="mt-5 flex items-baseline gap-2 border-b pb-1.5">
        <h3 className="text-base font-medium">{t('eventsHere')}</h3>
        <span className="text-sm tabular-nums text-muted-foreground">{eventHandles.length}</span>
      </div>
      {eventHandles.length === 0 && <p className="py-3 text-sm text-muted-foreground">{t('noEventsHere')}</p>}
      {events.isLoading && (
        <div className="space-y-2 py-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}
      <ol className="divide-y">
        {list.slice(0, limit).map((e) => {
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
          return (
            <li key={e.handle} className={cn('py-2.5', !inRange(e) && 'opacity-45')}>
              <div className="flex items-baseline gap-2 text-sm">
                <Link to={`/event/${e.gramps_id}`} className="font-medium hover:underline">
                  {prof?.type || String(e.type)}
                </Link>
                <span className="ml-auto shrink-0 tabular-nums text-xs text-muted-foreground">{prof?.date || '—'}</span>
              </div>
              {who.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-sm">
                  {who.map((w) => (
                    <Link key={w.id} to={`/${w.kind}/${w.id}`} className="truncate text-muted-foreground hover:text-foreground hover:underline">
                      {w.name}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {list.length > limit && (
        <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setLimit((l) => l + PAGE)}>
          {t('showMore', { count: list.length - limit })}
        </Button>
      )}
    </div>
  )
}
