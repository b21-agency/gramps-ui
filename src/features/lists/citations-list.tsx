import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarRange, Quote, Tag } from 'lucide-react'
import { DataListPage, type ListConfig } from './data-list'
import { useTagFilter, type FilterDef } from './filters'
import { useExtraFacets } from './facets'
import { or, rule, yearRangeDate } from './rules'
import { ChangedCell, Dash, IconTile, IdCell } from './cells'

export interface CitationRow {
  handle: string
  gramps_id: string
  change?: number
  page: string
  confidence: number
  profile?: { date?: string; page?: string; source?: { title?: string; author?: string; gramps_id?: string } }
}

/** Five dots for Gramps' confidence levels 0..4. */
export function ConfidenceDots({ level }: { level: number }) {
  const { t } = useTranslation('lists')
  return (
    <span className="inline-flex items-center gap-1" title={t(`citations.confidence.${level}`)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={i <= level ? 'size-1.5 rounded-full bg-brass' : 'size-1.5 rounded-full bg-border'} aria-hidden />
      ))}
      <span className="sr-only">{t(`citations.confidence.${level}`)}</span>
    </span>
  )
}

export function CitationsListPage() {
  const { t } = useTranslation(['lists', 'common'])
  const tagFilter = useTagFilter(t('filters.tag'), Tag)
  const extraFacets = useExtraFacets('citation')

  const config = useMemo<ListConfig<CitationRow>>(() => {
    const filters: FilterDef[] = [
      {
        id: 'year',
        type: 'years',
        label: t('citations.year'),
        icon: CalendarRange,
        toRule: (v) => {
          const d = yearRangeDate(v)
          return d ? rule('HasCitation', '', d, '') : null
        },
      },
      ...(tagFilter ? [tagFilter] : []),
      ...extraFacets,
    ]
    const title = (c: CitationRow) => c.profile?.source?.title
    return {
      kind: 'citation',
      query: { profile: 'self', keys: 'handle,gramps_id,change,page,confidence,profile' },
      searchProfile: 'self',
      defaultSort: '-change',
      sorts: [
        { key: 'date', label: t('citations.sort.date') },
        { key: 'confidence', label: t('citations.sort.confidence') },
        { key: 'gramps_id', label: t('sort.id') },
        { key: 'change', label: t('sort.change') },
      ],
      textRule: (w) => or(rule('MatchesPageSubstringOf', w), rule('HasSource', w, '', '', '')),
      filters,
      placeholder: t('citations.placeholder'),
      rowHeight: 56,
      compactRowHeight: 60,
      addPath: '/new_citation',
      columns: [
        {
          id: 'source',
          header: t('citations.col.source'),
          width: 'minmax(0,2fr)',
          cell: (c) => (
            <div className="flex min-w-0 items-center gap-3">
              <IconTile icon={Quote} />
              <div className="min-w-0">
                <div className="truncate font-serif text-[1.05rem] leading-snug">{title(c) || <Dash />}</div>
                {c.page && <div className="truncate text-xs text-muted-foreground">{c.page}</div>}
              </div>
            </div>
          ),
        },
        {
          id: 'date',
          header: t('citations.col.date'),
          sort: 'date',
          width: 'minmax(6rem,0.7fr)',
          minWidth: 560,
          cell: (c) => <span className="truncate tabular-nums">{c.profile?.date || <Dash />}</span>,
        },
        {
          id: 'confidence',
          header: t('citations.col.confidence'),
          sort: 'confidence',
          width: '6.5rem',
          minWidth: 680,
          cell: (c) => <ConfidenceDots level={c.confidence} />,
        },
        { id: 'id', header: t('col.id'), sort: 'gramps_id', width: '4.5rem', minWidth: 860, cell: (c) => <IdCell id={c.gramps_id} /> },
        {
          id: 'change',
          header: t('col.change'),
          sort: 'change',
          width: '7.5rem',
          minWidth: 980,
          align: 'end',
          cell: (c) => <ChangedCell ts={c.change} />,
        },
      ],
      compact: (c) => (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <IconTile icon={Quote} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-[1.05rem] leading-snug">{title(c) || c.gramps_id}</div>
            <div className="truncate text-xs text-muted-foreground">{[c.page, c.profile?.date].filter(Boolean).join(' · ')}</div>
          </div>
          <ConfidenceDots level={c.confidence} />
        </div>
      ),
    }
  }, [t, tagFilter, extraFacets])

  return <DataListPage title={t('common:nav.citations')} config={config} />
}
