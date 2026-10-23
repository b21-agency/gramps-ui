import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BookOpen, Landmark } from 'lucide-react'
import { ErrorState } from '@/components/states'
import { ObjectToolbar } from '@/components/detail/object-header'
import { Panel } from '@/components/detail/panel'
import { ObjectHistory } from '@/components/detail/object-history'
import { FactsTable, NotesList } from '@/components/detail/sections'
import { typeStr } from '@/lib/format'
import { useTypeLabel } from '@/features/lists/use-types'
import type { Repository } from '@/lib/types'
import { AlbumFrame, AlbumGrid, CoverVisual, glyphOf, ObjectHero } from './album'
import {
  countRefs,
  ObjectSkeleton,
  referenceItems,
  RichReferences,
  ShowMore,
  useLimited,
  useObjectPage,
  type AnyObj,
} from './shared'

export function RepositoryPage() {
  const { id } = useParams()
  const { t } = useTranslation(['objects', 'detail', 'common'])
  const { q, title } = useObjectPage<Repository>('repository', id, (r) => r.name || r.gramps_id)
  const repo = q.data
  const repoType = useTypeLabel('repository_types')

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!repo) return <ObjectSkeleton />

  const ext = repo.extended ?? {}
  const backlinks = (ext.backlinks ?? {}) as Record<string, AnyObj[]>
  const sources = [...(backlinks.source ?? [])].sort((a, b) => String(a.title).localeCompare(String(b.title)))
  const refs = referenceItems(backlinks, (repo as AnyObj).profile?.references, ['source'])
  const notes = repo.note_list ?? []
  const hasFacts = repo.address_list.length > 0 || repo.urls.length > 0

  return (
    <AlbumFrame>
      <ObjectToolbar kind="repository" object={repo} title={title} onSaved={() => q.refetch()} />

      <ObjectHero
        size="cover"
        visual={<CoverVisual icon={Landmark} glyph={glyphOf(title)} label={repoType(typeStr(repo.type)) || t('common:object.repository')} sub={repo.gramps_id} />}
        eyebrow={
          sources.length > 0 && <p className="text-sm font-semibold text-brass">{t('album.sourcesHeld', { count: sources.length })}</p>
        }
        title={title}
        subtitle={repoType(typeStr(repo.type)) || undefined}
        tags={ext.tags}
      />

      <AlbumGrid
        aside={
          <>
            {hasFacts && (
              <Panel id="facts" title={t('contact')}>
                <FactsTable addresses={repo.address_list} urls={repo.urls} />
              </Panel>
            )}
            {notes.length > 0 && (
              <Panel id="notes" title={t('album.stories')} count={notes.length}>
                <NotesList handles={notes} />
              </Panel>
            )}
            {refs.length > 0 && (
              <Panel id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
                <RichReferences groups={refs} />
              </Panel>
            )}
          </>
        }
        main={
          <>
            <Panel id="sources" title={t('sourcesHeld')} count={sources.length || undefined}>
              {sources.length > 0 ? (
                <HeldSources sources={sources} repoHandle={repo.handle} />
              ) : (
                <p className="text-sm text-muted-foreground">{t('noSourcesHeld')}</p>
              )}
            </Panel>
            <ObjectHistory objClass="Repository" handle={repo.handle} lastChange={repo.change} />
          </>
        }
      />
    </AlbumFrame>
  )
}

function HeldSources({ sources, repoHandle }: { sources: AnyObj[]; repoHandle: string }) {
  const { t } = useTranslation('detail')
  const { shown, hidden, all, setAll } = useLimited(sources, 30)
  const mediaType = useTypeLabel('source_media_types')
  return (
    <>
      <ul className="divide-y divide-border/60">
        {shown.map((s) => {
          const reporefs = ((s.reporef_list ?? []) as AnyObj[]).filter((r) => r.ref === repoHandle)
          return (
            <li key={s.handle}>
              <Link to={`/source/${s.gramps_id}`} className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-accent">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-brass">
                  <BookOpen className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg leading-snug">{s.title || s.gramps_id}</span>
                  {s.author && <span className="block truncate text-sm text-muted-foreground">{s.author}</span>}
                </span>
                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  {reporefs.map((r, i) => (
                    <span key={i} className="block">
                      {r.call_number && (
                        <span title={t('callNumber')} className="font-mono text-foreground">
                          {r.call_number}
                        </span>
                      )}
                      {typeStr(r.media_type) && <span className="ml-2">{mediaType(typeStr(r.media_type))}</span>}
                    </span>
                  ))}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <ShowMore hidden={hidden} all={all} onToggle={() => setAll(!all)} />
    </>
  )
}
