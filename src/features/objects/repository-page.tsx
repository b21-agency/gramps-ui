import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import { ErrorState } from '@/components/states'
import { ObjectTitle, ObjectToolbar } from '@/components/detail/object-header'
import { DetailSection, FactsTable, NotesList, SectionNav } from '@/components/detail/sections'
import { typeStr } from '@/lib/format'
import type { Repository } from '@/lib/types'
import {
  Columns,
  countRefs,
  navItems,
  ObjectSkeleton,
  PageFrame,
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

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!repo) return <ObjectSkeleton />

  const ext = repo.extended ?? {}
  const backlinks = (ext.backlinks ?? {}) as Record<string, AnyObj[]>
  const sources = [...(backlinks.source ?? [])].sort((a, b) => String(a.title).localeCompare(String(b.title)))
  const refs = referenceItems(backlinks, (repo as AnyObj).profile?.references, ['source'])
  const notes = repo.note_list ?? []
  const hasFacts = repo.address_list.length > 0 || repo.urls.length > 0

  const nav = navItems([
    sources.length > 0 && { id: 'sources', label: t('sourcesHeld'), count: sources.length },
    hasFacts && { id: 'facts', label: t('contact') },
    notes.length > 0 && { id: 'notes', label: t('detail:sections.notes'), count: notes.length },
    refs.length > 0 && { id: 'references', label: t('detail:sections.references'), count: countRefs(refs) },
  ])

  return (
    <PageFrame>
      <ObjectToolbar kind="repository" object={repo} title={title} onSaved={() => q.refetch()} />
      <ObjectTitle title={title} subtitle={typeStr(repo.type)} tags={ext.tags} />
      <SectionNav items={nav} />

      <Columns
        main={
          <>
            {sources.length > 0 ? (
              <DetailSection id="sources" title={t('sourcesHeld')} count={sources.length}>
                <HeldSources sources={sources} repoHandle={repo.handle} />
              </DetailSection>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noSourcesHeld')}</p>
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
            {hasFacts && (
              <DetailSection id="facts" title={t('contact')}>
                <FactsTable addresses={repo.address_list} urls={repo.urls} />
              </DetailSection>
            )}
            {refs.length > 0 && (
              <DetailSection id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
                <RichReferences groups={refs} />
              </DetailSection>
            )}
          </>
        }
      />
    </PageFrame>
  )
}

function HeldSources({ sources, repoHandle }: { sources: AnyObj[]; repoHandle: string }) {
  const { t } = useTranslation('detail')
  const { shown, hidden, all, setAll } = useLimited(sources, 30)
  return (
    <>
      <ul className="divide-y">
        {shown.map((s) => {
          const reporefs = ((s.reporef_list ?? []) as AnyObj[]).filter((r) => r.ref === repoHandle)
          return (
            <li key={s.handle}>
              <Link to={`/source/${s.gramps_id}`} className="-mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-accent">
                <BookOpen className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{s.title || s.gramps_id}</span>
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
                      {typeStr(r.media_type) && <span className="ml-2">{typeStr(r.media_type)}</span>}
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
