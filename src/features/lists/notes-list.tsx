import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Shapes, Tag } from 'lucide-react'
import { typeStr } from '@/lib/format'
import { DataListPage, type ListConfig } from './data-list'
import { useTagFilter, type FilterDef } from './filters'
import { rule } from './rules'
import { ChangedCell, Dash, IdCell } from './cells'
import { useTypeLabel, useTypeOptions } from './use-types'

export interface NoteRow {
  handle: string
  gramps_id: string
  change?: number
  type: string | { string: string }
  text: { string: string }
}

const preview = (n: NoteRow) => n.text?.string?.replace(/\s+/g, ' ').trim() ?? ''

export function NotesListPage() {
  const { t } = useTranslation(['lists', 'common'])
  const tagFilter = useTagFilter(t('filters.tag'), Tag)
  const types = useTypeOptions('note_types')
  const typeLabel = useTypeLabel('note_types')

  const config = useMemo<ListConfig<NoteRow>>(() => {
    const filters: FilterDef[] = [
      { id: 'type', type: 'select', label: t('notes.type'), icon: Shapes, options: types, toRule: (v) => rule('HasType', v) },
      ...(tagFilter ? [tagFilter] : []),
    ]
    return {
      kind: 'note',
      query: { keys: 'handle,gramps_id,change,type,text' },
      defaultSort: '-change',
      sorts: [
        { key: 'text', label: t('notes.sort.text') },
        { key: 'type', label: t('notes.sort.type') },
        { key: 'gramps_id', label: t('sort.id') },
        { key: 'change', label: t('sort.change') },
      ],
      textRule: (w) => rule('MatchesSubstringOf', w),
      filters,
      placeholder: t('notes.placeholder'),
      rowHeight: 72,
      compactRowHeight: 84,
      addPath: '/new_note',
      columns: [
        {
          id: 'text',
          header: t('notes.col.text'),
          sort: 'text',
          width: 'minmax(0,3fr)',
          cell: (n) => <p className="line-clamp-2 font-serif leading-snug">{preview(n) || <Dash />}</p>,
        },
        {
          id: 'type',
          header: t('notes.col.type'),
          sort: 'type',
          width: 'minmax(7rem,0.8fr)',
          minWidth: 520,
          cell: (n) => <span className="block truncate text-sm text-muted-foreground">{typeLabel(typeStr(n.type))}</span>,
        },
        { id: 'id', header: t('col.id'), sort: 'gramps_id', width: '4.5rem', minWidth: 760, cell: (n) => <IdCell id={n.gramps_id} /> },
        {
          id: 'change',
          header: t('col.change'),
          sort: 'change',
          width: '7.5rem',
          minWidth: 880,
          align: 'end',
          cell: (n) => <ChangedCell ts={n.change} />,
        },
      ],
      compact: (n) => (
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-serif leading-snug">{preview(n) || n.gramps_id}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{typeLabel(typeStr(n.type))}</p>
        </div>
      ),
    }
  }, [t, tagFilter, types, typeLabel])

  return <DataListPage title={t('common:nav.notes')} config={config} />
}
