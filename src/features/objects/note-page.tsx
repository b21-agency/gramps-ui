import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { NoteHtml } from '@/components/note-html'
import { TagList } from '@/components/tag-list'
import { ErrorState } from '@/components/states'
import { ObjectToolbar } from '@/components/detail/object-header'
import { DetailSection } from '@/components/detail/sections'
import { typeStr } from '@/lib/format'
import type { Note } from '@/lib/types'
import { cn } from '@/lib/utils'
import { countRefs, ObjectSkeleton, PageFrame, referenceItems, RichReferences, useObjectPage, type AnyObj } from './shared'

const formatOptions = JSON.stringify({ link_format: '/{obj_class}/{gramps_id}' })

function snippet(text: string) {
  const first = text.trim().split(/\n/)[0] ?? ''
  return first.length > 60 ? `${first.slice(0, 57)}…` : first
}

export function NotePage() {
  const { id } = useParams()
  const { t } = useTranslation(['objects', 'detail', 'common'])
  const { q, title } = useObjectPage<Note>('note', id, (n) => snippet(n.text?.string ?? '') || typeStr(n.type) || n.gramps_id, {
    formats: 'html',
    format_options: formatOptions,
  })
  const note = q.data

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!note) return <ObjectSkeleton />

  const ext = note.extended ?? {}
  const refs = referenceItems(ext.backlinks as never, (note as AnyObj).profile?.references)
  const pre = note.format === 1

  return (
    <PageFrame>
      <ObjectToolbar kind="note" object={note} title={title} onSaved={() => q.refetch()} />

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="min-w-0">
          <header className="mb-6 flex flex-wrap items-center gap-3">
            <h1 className="text-sm font-normal text-muted-foreground font-sans">{typeStr(note.type) || t('common:object.note')}</h1>
            <TagList tags={ext.tags} />
          </header>
          <div className="rounded-xl border bg-card px-5 py-6 sm:px-10 sm:py-10">
            <NoteHtml
              html={note.formatted?.html}
              text={note.text?.string}
              className={cn(
                'mx-auto max-w-[65ch] text-pretty',
                pre ? 'overflow-x-auto whitespace-pre font-mono text-sm' : 'font-serif text-[1.2rem] leading-[1.75] sm:text-[1.3rem]',
              )}
            />
          </div>
        </article>

        <aside className="min-w-0">
          {refs.length > 0 ? (
            <DetailSection id="references" title={t('detail:sections.references')} count={countRefs(refs)}>
              <RichReferences groups={refs} />
            </DetailSection>
          ) : (
            <p className="text-sm text-muted-foreground lg:mt-12">{t('unreferenced')}</p>
          )}
        </aside>
      </div>
    </PageFrame>
  )
}
