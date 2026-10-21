import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import { ErrorState } from '@/components/states'
import { ObjectTitle, ObjectToolbar } from '@/components/detail/object-header'
import { ObjectHistory } from '@/components/detail/object-history'
import { DetailSection, FactsTable, Gallery, NotesList, SectionNav } from '@/components/detail/sections'
import type { Citation, Source } from '@/lib/types'
import {
  Columns,
  ConfidenceMeter,
  countRefs,
  MetaList,
  navItems,
  ObjectSkeleton,
  PageFrame,
  referenceItems,
  RichReferences,
  useObjectPage,
  type AnyObj,
} from './shared'

export function CitationPage() {
  const { id } = useParams()
  const { t } = useTranslation(['objects', 'detail', 'common'])
  const { q, title } = useObjectPage<Citation>('citation', id, (c) =>
    [c.profile?.source?.title, c.page].filter(Boolean).join(', ') || c.gramps_id,
  )
  const citation = q.data

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!citation) return <ObjectSkeleton />

  const ext = citation.extended ?? {}
  const profile = (citation.profile ?? {}) as AnyObj
  const source = ext.source as Source | undefined
  const refs = referenceItems(ext.backlinks as never, profile.references)
  const media = citation.media_list ?? []
  const notes = citation.note_list ?? []

  const nav = navItems([
    refs.length > 0 && { id: 'references', label: t('citedBy'), count: countRefs(refs) },
    notes.length > 0 && { id: 'notes', label: t('detail:sections.notes'), count: notes.length },
    media.length > 0 && { id: 'gallery', label: t('detail:sections.gallery'), count: media.length },
    citation.attribute_list.length > 0 && { id: 'facts', label: t('detail:sections.facts') },
  ])

  return (
    <PageFrame>
      <ObjectToolbar kind="citation" object={citation} title={title} onSaved={() => q.refetch()} />

      {source && (
        <Link
          to={`/source/${source.gramps_id}`}
          className="group mb-3 inline-flex max-w-full items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <BookOpen className="size-4 shrink-0" />
          <span className="truncate font-serif text-lg group-hover:underline">{source.title || source.gramps_id}</span>
          {source.author && <span className="hidden truncate text-sm sm:inline">· {source.author}</span>}
        </Link>
      )}

      <ObjectTitle
        title={citation.page || t('noPage')}
        tags={ext.tags}
        subtitle={
          <MetaList
            className="mt-3"
            rows={[
              [t('date'), profile.date ? <span className="tabular-nums text-foreground">{profile.date}</span> : ''],
              [t('confidence'), <ConfidenceMeter value={citation.confidence} className="text-foreground" />],
            ]}
          />
        }
      />

      <SectionNav items={nav} />

      <Columns
        main={
          <>
            {refs.length > 0 ? (
              <DetailSection id="references" title={t('citedBy')} count={countRefs(refs)}>
                <RichReferences groups={refs} limit={15} />
              </DetailSection>
            ) : (
              <p className="text-sm text-muted-foreground">{t('notCited')}</p>
            )}
            {notes.length > 0 && (
              <DetailSection id="notes" title={t('detail:sections.notes')} count={notes.length}>
                <NotesList handles={notes} />
              </DetailSection>
            )}
          </>
        }
        aside={
          <>
            {media.length > 0 && (
              <DetailSection id="gallery" title={t('detail:sections.gallery')} count={media.length}>
                <Gallery refs={media} media={ext.media} />
              </DetailSection>
            )}
            {citation.attribute_list.length > 0 && (
              <DetailSection id="facts" title={t('detail:sections.facts')}>
                <FactsTable attributes={citation.attribute_list} />
              </DetailSection>
            )}
            <ObjectHistory objClass="Citation" handle={citation.handle} lastChange={citation.change} />
          </>
        }
      />
    </PageFrame>
  )
}
