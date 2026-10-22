import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Cross, Baby, Tag, Users } from 'lucide-react'
import { Portrait } from '@/components/portrait'
import { lifespan, profileName } from '@/lib/format'
import type { EventProfile, MediaRef, PersonProfile } from '@/lib/types'
import { DataListPage, type ListConfig } from './data-list'
import { useTagFilter, type FilterDef } from './filters'
import { useExtraFacets } from './facets'
import { rule, yearRangeDate } from './rules'
import { ChangedCell, Dash, EventCell, IdCell, RowLead } from './cells'

export interface PersonRow {
  handle: string
  gramps_id: string
  change?: number
  media_list?: MediaRef[]
  profile: PersonProfile
}

const ev = (e: PersonProfile['birth']) => (e && 'date' in e ? (e as EventProfile) : undefined)

/** Age at death in years from the birth and death years (as the classic list computes it). */
function ageAtDeath(p: PersonProfile): number | null {
  const by = ev(p.birth)?.date?.match(/\b(\d{4})\b/)
  const dy = ev(p.death)?.date?.match(/\b(\d{4})\b/)
  if (!by || !dy) return null
  const age = Number(dy[1]) - Number(by[1])
  return age >= 0 ? age : null
}

function PersonName({ p, gid, media, place }: { p: PersonProfile; gid: string; media?: MediaRef[]; place?: string }) {
  const name = profileName(p)
  const span = lifespan(p.birth, p.death)
  return (
    <RowLead
      visual={<Portrait mediaRef={media?.[0]} name={name} sex={p.sex} size={44} />}
      title={name || gid}
      sub={
        span || place ? (
          <>
            {span && <span className="tabular-nums text-brass">{span}</span>}
            {place && <span>{span ? ' · ' : ''}{place}</span>}
          </>
        ) : null
      }
    />
  )
}

export function PeopleListPage() {
  const { t } = useTranslation(['lists', 'common'])
  const tagFilter = useTagFilter(t('filters.tag'), Tag)
  const extraFacets = useExtraFacets('person')

  const config = useMemo<ListConfig<PersonRow>>(() => {
    const filters: FilterDef[] = [
      {
        id: 'sex',
        type: 'select',
        label: t('people.gender'),
        icon: Users,
        options: [
          { value: 'F', label: t('common:sex.F') },
          { value: 'M', label: t('common:sex.M') },
          { value: 'U', label: t('common:sex.U') },
        ],
        toRule: (v) => rule(v === 'F' ? 'IsFemale' : v === 'M' ? 'IsMale' : 'HasUnknownGender'),
      },
      {
        id: 'born',
        type: 'years',
        label: t('people.born'),
        icon: Baby,
        toRule: (v) => {
          const d = yearRangeDate(v)
          return d ? rule('HasBirth', d, '', '') : null
        },
      },
      {
        id: 'died',
        type: 'years',
        label: t('people.died'),
        icon: Cross,
        toRule: (v) => {
          const d = yearRangeDate(v)
          return d ? rule('HasDeath', d, '', '') : null
        },
      },
      { id: 'photo', type: 'toggle', label: t('people.hasPhoto'), icon: Camera, toRule: () => rule('HavePhotos', '0', 'greater than') },
      ...(tagFilter ? [tagFilter] : []),
      ...extraFacets,
    ]
    return {
      kind: 'person',
      query: { profile: 'self', keys: 'handle,gramps_id,change,media_list,profile' },
      searchProfile: 'self',
      defaultSort: 'name',
      sorts: [
        { key: 'name', label: t('people.sort.name') },
        { key: 'birth', label: t('people.sort.birth') },
        { key: 'death', label: t('people.sort.death') },
        { key: 'gramps_id', label: t('sort.id') },
        { key: 'change', label: t('sort.change') },
      ],
      textRule: (w) => rule('SearchName', w),
      filters,
      group: {
        sorts: ['name', 'surname'],
        key: (p) => (p.profile.name_surname || '').toLocaleLowerCase(),
        label: (p) => p.profile.name_surname || <span className="text-muted-foreground">{t('people.noSurname')}</span>,
      },
      placeholder: t('people.placeholder'),
      rowHeight: 64,
      compactRowHeight: 64,
      addPath: '/new_person',
      columns: [
        {
          id: 'name',
          header: t('people.col.name'),
          sort: 'name',
          width: 'minmax(0,1.5fr)',
          cell: (p) => <PersonName p={p.profile} gid={p.gramps_id} media={p.media_list} />,
        },
        {
          id: 'birth',
          header: t('people.col.birth'),
          sort: 'birth',
          width: 'minmax(0,1fr)',
          minWidth: 560,
          cell: (p) => <EventCell date={ev(p.profile.birth)?.date} place={ev(p.profile.birth)?.place_name} />,
        },
        {
          id: 'death',
          header: t('people.col.death'),
          sort: 'death',
          width: 'minmax(0,1fr)',
          minWidth: 720,
          cell: (p) => <EventCell date={ev(p.profile.death)?.date} place={ev(p.profile.death)?.place_name} />,
        },
        {
          id: 'age',
          header: t('people.col.age'),
          width: '4.5rem',
          minWidth: 800,
          align: 'end',
          defaultHidden: true,
          cell: (p) => <span className="font-serif text-lg tabular-nums">{ageAtDeath(p.profile) ?? <Dash />}</span>,
        },
        { id: 'id', header: t('col.id'), sort: 'gramps_id', width: '4.5rem', minWidth: 880, cell: (p) => <IdCell id={p.gramps_id} /> },
        {
          id: 'change',
          header: t('col.change'),
          sort: 'change',
          width: '7.5rem',
          minWidth: 1000,
          align: 'end',
          cell: (p) => <ChangedCell ts={p.change} />,
        },
      ],
      compact: (p) => {
        const birth = ev(p.profile.birth)
        const death = ev(p.profile.death)
        return <PersonName p={p.profile} gid={p.gramps_id} media={p.media_list} place={birth?.place_name || death?.place_name} />
      },
    }
  }, [t, tagFilter, extraFacets])

  return <DataListPage title={t('common:nav.people')} config={config} />
}
