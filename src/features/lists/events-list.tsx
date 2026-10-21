import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarRange, Shapes, Tag } from 'lucide-react'
import { profileName } from '@/lib/format'
import type { EventProfile, FamilyProfile, PersonProfile } from '@/lib/types'
import { DataListPage, type ListConfig } from './data-list'
import { useTagFilter, type FilterDef } from './filters'
import { or, rule, yearRangeDate } from './rules'
import { ChangedCell, Dash, HandlePortrait, IdCell } from './cells'
import { useTypeOptions } from './use-types'

interface Participants {
  people?: Array<{ role: string; person: PersonProfile }>
  families?: Array<{ role: string; family: FamilyProfile }>
}

export interface EventRow {
  handle: string
  gramps_id: string
  change?: number
  description?: string
  profile: EventProfile & { participants?: Participants }
}

function participantNames(p?: Participants): Array<{ key: string; name: string; person?: PersonProfile }> {
  const out: Array<{ key: string; name: string; person?: PersonProfile }> = []
  for (const x of p?.people ?? []) out.push({ key: x.person.handle, name: profileName(x.person), person: x.person })
  for (const x of p?.families ?? []) {
    const f = x.family
    const names = [f.father, f.mother].map((m) => (m && 'handle' in m ? profileName(m as PersonProfile) : '')).filter(Boolean)
    out.push({ key: f.handle, name: names.join(' & '), person: (f.father && 'handle' in f.father ? f.father : f.mother) as PersonProfile })
  }
  return out
}

function ParticipantsCell({ p, size = 26 }: { p?: Participants; size?: number }) {
  const list = participantNames(p)
  if (!list.length) return <Dash />
  const [first, ...rest] = list
  return (
    <div className="flex min-w-0 items-center gap-2">
      <HandlePortrait person={first.person} size={size} />
      <span className="min-w-0 truncate">
        {first.name}
        {rest.length > 0 && <span className="text-muted-foreground"> +{rest.length}</span>}
      </span>
    </div>
  )
}

export function EventsListPage() {
  const { t } = useTranslation(['lists', 'common'])
  const tagFilter = useTagFilter(t('filters.tag'), Tag)
  const types = useTypeOptions('event_types')

  const config = useMemo<ListConfig<EventRow>>(() => {
    const filters: FilterDef[] = [
      { id: 'type', type: 'select', label: t('events.type'), icon: Shapes, options: types, toRule: (v) => rule('HasType', v) },
      {
        id: 'year',
        type: 'years',
        label: t('events.year'),
        icon: CalendarRange,
        toRule: (v) => {
          const d = yearRangeDate(v)
          return d ? rule('HasData', '', d, '', '') : null
        },
      },
      ...(tagFilter ? [tagFilter] : []),
    ]
    return {
      kind: 'event',
      query: { profile: 'participants', keys: 'handle,gramps_id,change,description,profile' },
      searchProfile: 'all',
      defaultSort: '-date',
      sorts: [
        { key: 'date', label: t('events.sort.date') },
        { key: 'type', label: t('events.sort.type') },
        { key: 'place', label: t('events.sort.place') },
        { key: 'description', label: t('events.sort.description') },
        { key: 'gramps_id', label: t('sort.id') },
        { key: 'change', label: t('sort.change') },
      ],
      // participant name or description
      textRule: (w) => or(rule('HasEvent', '', '', '', '', w), rule('HasData', '', '', '', w)),
      filters,
      placeholder: t('events.placeholder'),
      rowHeight: 56,
      compactRowHeight: 72,
      addPath: '/new_event',
      columns: [
        {
          id: 'type',
          header: t('events.col.type'),
          sort: 'type',
          width: 'minmax(0,1.1fr)',
          cell: (e) => (
            <div className="min-w-0">
              <div className="truncate font-medium">{e.profile.type || <Dash />}</div>
              {e.description && <div className="truncate text-xs text-muted-foreground">{e.description}</div>}
            </div>
          ),
        },
        {
          id: 'date',
          header: t('events.col.date'),
          sort: 'date',
          width: 'minmax(7rem,0.8fr)',
          cell: (e) => <span className="truncate tabular-nums">{e.profile.date || <Dash />}</span>,
        },
        {
          id: 'participants',
          header: t('events.col.participants'),
          width: 'minmax(0,1.4fr)',
          minWidth: 620,
          cell: (e) => <ParticipantsCell p={e.profile.participants} />,
        },
        {
          id: 'place',
          header: t('events.col.place'),
          sort: 'place',
          width: 'minmax(0,1.1fr)',
          minWidth: 800,
          cell: (e) => <span className="block truncate text-sm text-muted-foreground" title={e.profile.place}>{e.profile.place_name || e.profile.place || <Dash />}</span>,
        },
        { id: 'id', header: t('col.id'), sort: 'gramps_id', width: '4.5rem', minWidth: 980, cell: (e) => <IdCell id={e.gramps_id} /> },
        {
          id: 'change',
          header: t('col.change'),
          sort: 'change',
          width: '7.5rem',
          minWidth: 1080,
          align: 'end',
          cell: (e) => <ChangedCell ts={e.change} />,
        },
      ],
      compact: (e) => {
        const people = participantNames(e.profile.participants)
        return (
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-medium">{e.profile.type}</span>
              <span className="shrink-0 text-sm tabular-nums text-brass">{e.profile.date}</span>
            </div>
            <div className="truncate text-sm">{people.map((p) => p.name).join(', ') || e.description}</div>
            {(e.profile.place_name || e.profile.place) && (
              <div className="truncate text-xs text-muted-foreground">{e.profile.place_name || e.profile.place}</div>
            )}
          </div>
        )
      },
    }
  }, [t, tagFilter, types])

  return <DataListPage title={t('common:nav.events')} config={config} />
}
