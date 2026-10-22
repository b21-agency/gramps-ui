import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BookOpen, Quote } from 'lucide-react'
import { ErrorState } from '@/components/states'
import { ObjectToolbar } from '@/components/detail/object-header'
import { ObjectHistory } from '@/components/detail/object-history'
import { Panel } from '@/components/detail/panel'
import { FactsTable, Gallery, NotesList } from '@/components/detail/sections'
import type { Citation, Source } from '@/lib/types'
import { AlbumFrame, AlbumGrid, CoverVisual, glyphOf, HeroFacts, ObjectHero, PhotoVisual } from './album'
import { ConfidenceMeter, countRefs, ObjectSkeleton, referenceItems, RichReferences, useObjectPage, type AnyObj } from './shared'

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

  const visual = media.length ? (
    <PhotoVisual refs={media} media={ext.media} label={t('album.openPhotos')} />
  ) : (
    <CoverVisual icon={Quote} glyph={glyphOf(source?.abbrev || source?.title)} label={t('common:object.citation')} sub={citation.gramps_id} />
  )

  return (
    <AlbumFrame>
      <ObjectToolbar kind="citation" object={citation} title={title} onSaved={() => q.refetch()} />

      <ObjectHero
        size={media.length ? 'portrait' : 'cover'}
        visual={visual}
        eyebrow={
          source && (
            <Link
              to={`/source/${source.gramps_id}`}
              className="group inline-flex max-w-full items-center gap-2 text-sm font-semibold text-brass"
            >
              <BookOpen className="size-4 shrink-0" />
              <span className="truncate group-hover:underline">{source.title || source.gramps_id}</span>
              {source.author && <span className="hidden truncate font-normal text-muted-foreground sm:inline">· {source.author}</span>}
            </Link>
          )
        }
        title={citation.page || t('noPage')}
        tags={ext.tags}
      >
        <HeroFacts
          className="max-lg:justify-items-center max-lg:text-center sm:max-lg:justify-center"
          items={[
            profile.date && { label: t('date'), value: profile.date },
            {
              label: t('confidence'),
              value: <ConfidenceMeter value={citation.confidence} className="font-sans text-base" />,
            },
          ]}
        />
      </ObjectHero>

      <AlbumGrid
        aside={
          <>
            {media.length > 0 && (
              <Panel id="gallery" title={t('album.photosAndDocs')} count={media.length}>
                <Gallery refs={media} media={ext.media} />
              </Panel>
            )}
            {citation.attribute_list.length > 0 && (
              <Panel id="facts" title={t('detail:sections.facts')}>
                <FactsTable attributes={citation.attribute_list} />
              </Panel>
            )}
            {notes.length > 0 && (
              <Panel id="notes" title={t('album.stories')} count={notes.length}>
                <NotesList handles={notes} />
              </Panel>
            )}
          </>
        }
        main={
          <>
            <Panel id="references" title={t('citedBy')} count={refs.length ? countRefs(refs) : undefined}>
              {refs.length > 0 ? (
                <RichReferences groups={refs} limit={15} />
              ) : (
                <p className="text-sm text-muted-foreground">{t('notCited')}</p>
              )}
            </Panel>
            <ObjectHistory objClass="Citation" handle={citation.handle} lastChange={citation.change} />
          </>
        }
      />
    </AlbumFrame>
  )
}
