import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Tag } from 'lucide-react'
import { DataListPage, type ListConfig } from './data-list'
import { useTagFilter, type FilterDef } from './filters'
import { useExtraFacets } from './facets'
import { or, rule } from './rules'
import { ObjectThumb } from '@/components/object-thumb'
import type { MediaRef } from '@/lib/types'
import { ChangedCell, Dash, IdCell, RowLead } from './cells'

export interface SourceRow {
  handle: string
  gramps_id: string
  change?: number
  title: string
  author: string
  pubinfo: string
  abbrev: string
  media_list?: MediaRef[]
}

export function SourcesListPage() {
  const { t } = useTranslation(['lists', 'common'])
  const tagFilter = useTagFilter(t('filters.tag'), Tag)
  const extraFacets = useExtraFacets('source')

  const config = useMemo<ListConfig<SourceRow>>(() => {
    const filters: FilterDef[] = [
      {
        id: 'repo',
        type: 'toggle',
        label: t('sources.inRepository'),
        icon: Archive,
        toRule: () => rule('HasRepository', '0', 'greater than'),
      },
      ...(tagFilter ? [tagFilter] : []),
      ...extraFacets,
    ]
    return {
      kind: 'source',
      query: { keys: ['handle', 'gramps_id', 'change', 'title', 'author', 'pubinfo', 'abbrev', 'media_list'] },
      defaultSort: 'title',
      sorts: [
        { key: 'title', label: t('sources.sort.title') },
        { key: 'author', label: t('sources.sort.author') },
        { key: 'pubinfo', label: t('sources.sort.pubinfo') },
        { key: 'abbrev', label: t('sources.sort.abbrev') },
        { key: 'gramps_id', label: t('sort.id') },
        { key: 'change', label: t('sort.change') },
      ],
      textRule: (w) => or(rule('HasSource', w, '', '', ''), rule('HasSource', '', w, '', ''), rule('HasSource', '', '', w, '')),
      filters,
      placeholder: t('sources.placeholder'),
      rowHeight: 64,
      compactRowHeight: 64,
      addPath: '/new_source',
      columns: [
        {
          id: 'title',
          header: t('sources.col.title'),
          sort: 'title',
          width: 'minmax(0,2fr)',
          cell: (s) => <RowLead visual={<ObjectThumb kind="source" mediaRef={s.media_list?.[0]} size={44} />} title={s.title || s.gramps_id} sub={s.abbrev} />,
        },
        {
          id: 'author',
          header: t('sources.col.author'),
          sort: 'author',
          width: 'minmax(0,1.2fr)',
          minWidth: 560,
          cell: (s) => <span className="block truncate text-[15px]">{s.author || <Dash />}</span>,
        },
        {
          id: 'pubinfo',
          header: t('sources.col.pubinfo'),
          sort: 'pubinfo',
          width: 'minmax(0,1.2fr)',
          minWidth: 800,
          cell: (s) => <span className="block truncate text-sm text-muted-foreground">{s.pubinfo || <Dash />}</span>,
        },
        { id: 'id', header: t('col.id'), sort: 'gramps_id', width: '4.5rem', minWidth: 940, cell: (s) => <IdCell id={s.gramps_id} /> },
        {
          id: 'change',
          header: t('col.change'),
          sort: 'change',
          width: '7.5rem',
          minWidth: 1060,
          align: 'end',
          cell: (s) => <ChangedCell ts={s.change} />,
        },
      ],
      compact: (s) => (
        <RowLead
          visual={<ObjectThumb kind="source" mediaRef={s.media_list?.[0]} size={44} />}
          title={s.title || s.gramps_id}
          sub={[s.author, s.pubinfo].filter(Boolean).join(' · ')}
        />
      ),
    }
  }, [t, tagFilter, extraFacets])

  return <DataListPage title={t('common:nav.sources')} config={config} />
}
