import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, HeartHandshake, Tag } from 'lucide-react'
import { profileName } from '@/lib/format'
import type { EventProfile, FamilyProfile, PersonProfile } from '@/lib/types'
import { DataListPage, type ListConfig } from './data-list'
import { useTagFilter, type FilterDef } from './filters'
import { or, rule, yearRangeDate } from './rules'
import { ChangedCell, Dash, EventCell, HandlePortrait, IdCell } from './cells'
import { useTypeOptions } from './use-types'

export interface FamilyRow {
  handle: string
  gramps_id: string
  change?: number
  profile: FamilyProfile
}

const person = (p: FamilyProfile['father']) => (p && 'handle' in p ? (p as PersonProfile) : undefined)
const ev = (e: FamilyProfile['marriage']) => (e && 'date' in e ? (e as EventProfile) : undefined)

function Partners({ f, size = 32 }: { f: FamilyProfile; size?: number }) {
  const { t } = useTranslation('lists')
  const father = person(f.father)
  const mother = person(f.mother)
  const names = [father, mother].map((p) => (p ? profileName(p) : null))
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex shrink-0 -space-x-2.5">
        <HandlePortrait person={father} size={size} className="ring-offset-2 ring-offset-background" />
        <HandlePortrait person={mother} size={size} className="ring-offset-2 ring-offset-background" />
      </span>
      <div className="min-w-0 truncate font-serif text-[1.05rem] leading-snug">
        {names[0] || <span className="text-muted-foreground">{t('families.unknown')}</span>}
        <span className="px-1.5 text-muted-foreground">&amp;</span>
        {names[1] || <span className="text-muted-foreground">{t('families.unknown')}</span>}
      </div>
    </div>
  )
}

export function FamiliesListPage() {
  const { t } = useTranslation(['lists', 'common'])
  const tagFilter = useTagFilter(t('filters.tag'), Tag)
  const relTypes = useTypeOptions('family_relation_types')

  const config = useMemo<ListConfig<FamilyRow>>(() => {
    const filters: FilterDef[] = [
      {
        id: 'type',
        type: 'select',
        label: t('families.relationship'),
        icon: HeartHandshake,
        options: relTypes,
        toRule: (v) => rule('HasRelType', v),
      },
      {
        id: 'married',
        type: 'years',
        label: t('families.married'),
        icon: Heart,
        toRule: (v) => {
          const d = yearRangeDate(v)
          return d ? rule('HasEvent', 'Marriage', d, '', '', '') : null
        },
      },
      ...(tagFilter ? [tagFilter] : []),
    ]
    const children = (f: FamilyRow) => f.profile.children?.length ?? 0
    return {
      kind: 'family',
      query: { profile: 'self', keys: 'handle,gramps_id,change,profile' },
      searchProfile: 'self',
      defaultSort: 'surname',
      sorts: [
        { key: 'surname', label: t('families.sort.surname') },
        { key: 'type', label: t('families.sort.type') },
        { key: 'gramps_id', label: t('sort.id') },
        { key: 'change', label: t('sort.change') },
      ],
      textRule: (w) => or(rule('SearchFatherName', w), rule('SearchMotherName', w)),
      filters,
      placeholder: t('families.placeholder'),
      rowHeight: 56,
      compactRowHeight: 64,
      addPath: '/new_family',
      addNeedsEdit: true,
      columns: [
        { id: 'partners', header: t('families.col.partners'), sort: 'surname', width: 'minmax(0,2fr)', cell: (f) => <Partners f={f.profile} /> },
        {
          id: 'marriage',
          header: t('families.col.marriage'),
          width: 'minmax(0,1fr)',
          minWidth: 600,
          cell: (f) => <EventCell date={ev(f.profile.marriage)?.date} place={ev(f.profile.marriage)?.place_name} />,
        },
        {
          id: 'type',
          header: t('families.col.type'),
          sort: 'type',
          width: '7rem',
          minWidth: 900,
          cell: (f) => <span className="truncate text-sm text-muted-foreground">{f.profile.relationship || <Dash />}</span>,
        },
        {
          id: 'children',
          header: t('families.col.children'),
          width: '5.5rem',
          minWidth: 720,
          align: 'end',
          cell: (f) => <span className="font-serif tabular-nums">{children(f) || <Dash />}</span>,
        },
        { id: 'id', header: t('col.id'), sort: 'gramps_id', width: '4.5rem', minWidth: 980, cell: (f) => <IdCell id={f.gramps_id} /> },
        {
          id: 'change',
          header: t('col.change'),
          sort: 'change',
          width: '7.5rem',
          minWidth: 1080,
          align: 'end',
          cell: (f) => <ChangedCell ts={f.change} />,
        },
      ],
      compact: (f) => {
        const m = ev(f.profile.marriage)
        const n = children(f)
        return (
          <div className="min-w-0 flex-1 space-y-1">
            <Partners f={f.profile} size={30} />
            <div className="truncate pl-[3.25rem] text-xs text-muted-foreground">
              {[m?.date && t('families.marriedOn', { date: m.date }), n > 0 && t('families.childCount', { count: n })]
                .filter(Boolean)
                .join(' · ') || f.profile.relationship}
            </div>
          </div>
        )
      },
    }
  }, [t, tagFilter, relTypes])

  return <DataListPage title={t('common:nav.families')} config={config} />
}
