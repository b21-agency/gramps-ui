import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Crosshair, LocateFixed, Shapes, Tag } from 'lucide-react'
import type { MediaRef, Place } from '@/lib/types'
import { DataListPage, type ListConfig } from './data-list'
import { useTagFilter, type FilterDef } from './filters'
import { useExtraFacets } from './facets'
import { not, rule } from './rules'
import { ObjectThumb } from '@/components/object-thumb'
import { ChangedCell, Dash, IdCell, RowLead } from './cells'
import { useTypeOptions } from './use-types'

export interface PlaceRow {
  handle: string
  gramps_id: string
  change?: number
  lat?: string
  long?: string
  media_list?: MediaRef[]
  profile: NonNullable<Place['profile']>
}

const hasCoords = (p: PlaceRow) => !!(p.lat && p.long)
const enclosing = (p: PlaceRow) => (p.profile.parent_places ?? []).map((x) => x.name).filter(Boolean).join(', ')

function PlaceThumb({ p }: { p: PlaceRow }) {
  return <ObjectThumb kind="place" mediaRef={p.media_list?.[0]} size={44} />
}

function CoordsMark({ p }: { p: PlaceRow }) {
  const { t } = useTranslation('lists')
  if (!hasCoords(p)) return <span className="sr-only">{t('places.noCoords')}</span>
  return (
    <span className="inline-flex items-center text-brass" title={`${p.lat}, ${p.long}`}>
      <LocateFixed className="size-4" aria-hidden />
      <span className="sr-only">{t('places.hasCoords')}</span>
    </span>
  )
}

export function PlacesListPage() {
  const { t } = useTranslation(['lists', 'common'])
  const tagFilter = useTagFilter(t('filters.tag'), Tag)
  const extraFacets = useExtraFacets('place')
  const types = useTypeOptions('place_types')

  const config = useMemo<ListConfig<PlaceRow>>(() => {
    const filters: FilterDef[] = [
      { id: 'type', type: 'select', label: t('places.type'), icon: Shapes, options: types, toRule: (v) => rule('HasData', '', v, '') },
      {
        id: 'coords',
        type: 'select',
        label: t('places.coords'),
        icon: Crosshair,
        options: [
          { value: 'yes', label: t('places.withCoords') },
          { value: 'no', label: t('places.withoutCoords') },
        ],
        toRule: (v) => (v === 'no' ? rule('HasNoLatOrLon') : not(rule('HasNoLatOrLon'))),
      },
      ...(tagFilter ? [tagFilter] : []),
      ...extraFacets,
    ]
    return {
      kind: 'place',
      query: { profile: ['self'], keys: ['handle', 'gramps_id', 'change', 'lat', 'long', 'media_list', 'profile'] },
      searchProfile: ['self'],
      defaultSort: 'title',
      sorts: [
        { key: 'title', label: t('places.sort.title') },
        { key: 'type', label: t('places.sort.type') },
        { key: 'latitude', label: t('places.sort.latitude') },
        { key: 'longitude', label: t('places.sort.longitude') },
        { key: 'gramps_id', label: t('sort.id') },
        { key: 'change', label: t('sort.change') },
      ],
      textRule: (w) => rule('HasData', w, '', ''),
      filters,
      placeholder: t('places.placeholder'),
      rowHeight: 64,
      compactRowHeight: 64,
      addPath: '/new_place',
      columns: [
        {
          id: 'name',
          header: t('places.col.name'),
          sort: 'title',
          width: 'minmax(0,1.4fr)',
          cell: (p) => <RowLead visual={<PlaceThumb p={p} />} title={p.profile.name || p.gramps_id} sub={p.profile.type} />,
        },
        {
          id: 'within',
          header: t('places.col.within'),
          width: 'minmax(0,1.4fr)',
          minWidth: 560,
          cell: (p) => <span className="block truncate text-sm text-muted-foreground">{enclosing(p) || <Dash />}</span>,
        },
        { id: 'coords', header: <span className="sr-only">{t('places.coords')}</span>, width: '2rem', minWidth: 480, cell: (p) => <CoordsMark p={p} /> },
        { id: 'id', header: t('col.id'), sort: 'gramps_id', width: '4.5rem', minWidth: 820, cell: (p) => <IdCell id={p.gramps_id} /> },
        {
          id: 'change',
          header: t('col.change'),
          sort: 'change',
          width: '7.5rem',
          minWidth: 960,
          align: 'end',
          cell: (p) => <ChangedCell ts={p.change} />,
        },
      ],
      compact: (p) => (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <RowLead visual={<PlaceThumb p={p} />} title={p.profile.name || p.gramps_id} sub={[p.profile.type, enclosing(p)].filter(Boolean).join(' · ')} />
          <CoordsMark p={p} />
        </div>
      ),
    }
  }, [t, tagFilter, types, extraFacets])

  return <DataListPage title={t('common:nav.places')} config={config} />
}
