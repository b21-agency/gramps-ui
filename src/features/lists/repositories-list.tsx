import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Landmark, Shapes, Tag } from 'lucide-react'
import type { Address, Url } from '@/lib/types'
import { typeStr } from '@/lib/format'
import { DataListPage, type ListConfig } from './data-list'
import { useTagFilter, type FilterDef } from './filters'
import { useExtraFacets } from './facets'
import { rule } from './rules'
import { ChangedCell, Dash, IconTile, IdCell } from './cells'
import { useTypeLabel, useTypeOptions } from './use-types'

export interface RepositoryRow {
  handle: string
  gramps_id: string
  change?: number
  name: string
  type: string | { string: string }
  address_list?: Address[]
  urls?: Url[]
}

const where = (r: RepositoryRow) => {
  const a = r.address_list?.[0]
  return a ? [a.city || a.locality, a.country].filter(Boolean).join(', ') : ''
}

export function RepositoriesListPage() {
  const { t } = useTranslation(['lists', 'common'])
  const tagFilter = useTagFilter(t('filters.tag'), Tag)
  const extraFacets = useExtraFacets('repository')
  const types = useTypeOptions('repository_types')
  const typeLabel = useTypeLabel('repository_types')

  const config = useMemo<ListConfig<RepositoryRow>>(() => {
    const filters: FilterDef[] = [
      { id: 'type', type: 'select', label: t('repositories.type'), icon: Shapes, options: types, toRule: (v) => rule('HasRepo', '', v, '', '') },
      ...(tagFilter ? [tagFilter] : []),
      ...extraFacets,
    ]
    return {
      kind: 'repository',
      query: { keys: 'handle,gramps_id,change,name,type,address_list,urls' },
      defaultSort: 'name',
      sorts: [
        { key: 'name', label: t('repositories.sort.name') },
        { key: 'type', label: t('repositories.sort.type') },
        { key: 'gramps_id', label: t('sort.id') },
        { key: 'change', label: t('sort.change') },
      ],
      textRule: (w) => rule('MatchesNameSubstringOf', w),
      filters,
      placeholder: t('repositories.placeholder'),
      rowHeight: 56,
      compactRowHeight: 60,
      addPath: '/new_repository',
      columns: [
        {
          id: 'name',
          header: t('repositories.col.name'),
          sort: 'name',
          width: 'minmax(0,2fr)',
          cell: (r) => (
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={Landmark} />
              <div className="min-w-0">
                <div className="truncate font-serif text-[1.05rem] leading-snug">{r.name || r.gramps_id}</div>
                {r.urls?.[0]?.path && <div className="truncate text-xs text-muted-foreground">{r.urls[0].path}</div>}
              </div>
            </div>
          ),
        },
        {
          id: 'type',
          header: t('repositories.col.type'),
          sort: 'type',
          width: 'minmax(0,0.8fr)',
          minWidth: 520,
          cell: (r) => <span className="block truncate text-sm">{typeLabel(typeStr(r.type)) || <Dash />}</span>,
        },
        {
          id: 'where',
          header: t('repositories.col.address'),
          width: 'minmax(0,1fr)',
          minWidth: 680,
          cell: (r) => <span className="block truncate text-sm text-muted-foreground">{where(r) || <Dash />}</span>,
        },
        { id: 'id', header: t('col.id'), sort: 'gramps_id', width: '4.5rem', minWidth: 860, cell: (r) => <IdCell id={r.gramps_id} /> },
        {
          id: 'change',
          header: t('col.change'),
          sort: 'change',
          width: '7.5rem',
          minWidth: 980,
          align: 'end',
          cell: (r) => <ChangedCell ts={r.change} />,
        },
      ],
      compact: (r) => (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <IconTile icon={Landmark} />
          <div className="min-w-0">
            <div className="truncate font-serif text-[1.05rem] leading-snug">{r.name || r.gramps_id}</div>
            <div className="truncate text-xs text-muted-foreground">{[typeLabel(typeStr(r.type)), where(r)].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      ),
    }
  }, [t, tagFilter, types, typeLabel, extraFacets])

  return <DataListPage title={t('common:nav.repositories')} config={config} />
}
