import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { NoteHtml } from '@/components/note-html'
import { TagList } from '@/components/tag-list'
import { ErrorState } from '@/components/states'
import { ObjectToolbar } from '@/components/detail/object-header'
import { Panel } from '@/components/detail/panel'
import { ObjectHistory } from '@/components/detail/object-history'
import { typeStr } from '@/lib/format'
import type { Note } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AlbumFrame, AlbumGrid } from './album'
import { countRefs, ObjectSkeleton, referenceItems, RichReferences, useObjectPage, type AnyObj } from './shared'

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

  const len = (note.text?.string ?? '').length
  const size = len > 1200 ? 'text-[1.15rem] leading-[1.75] sm:text-[1.3rem]' : len > 400 ? 'text-[1.3rem] leading-[1.65] sm:text-[1.6rem]' : 'text-[1.6rem] leading-[1.45] sm:text-[2.2rem] lg:text-[2.6rem]'

  return (
    <AlbumFrame>
      <ObjectToolbar kind="note" object={note} title={title} onSaved={() => q.refetch()} />

      <section className="mx-auto max-w-4xl lg:mx-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 max-lg:justify-center">
          <p className="text-sm font-semibold text-brass">{typeStr(note.type) || t('common:object.note')}</p>
          {refs.length > 0 && (
            <a href="#references" className="text-sm text-muted-foreground hover:text-foreground">
              {t('album.referencedBy', { count: countRefs(refs) })}
            </a>
          )}
          <TagList tags={ext.tags} />
        </div>
        <h1 className="sr-only">{title}</h1>
        {pre ? (
          <div className="mt-5 overflow-x-auto rounded-3xl bg-card p-5 sm:p-8">
            <NoteHtml html={note.formatted?.html} text={note.text?.string} className="whitespace-pre font-mono text-sm" />
          </div>
        ) : (
          <div className="relative mt-8 sm:mt-10">
            <span aria-hidden className="pointer-events-none absolute -left-1 -top-10 select-none font-serif text-[5rem] leading-none text-brass/35 sm:-left-12 sm:-top-4 sm:text-[7rem]">
              “
            </span>
            <NoteHtml
              html={note.formatted?.html}
              text={note.text?.string}
              className={cn('relative max-w-[60ch] font-serif italic text-pretty [overflow-wrap:anywhere]', size)}
            />
          </div>
        )}
      </section>

      <AlbumGrid
        aside={
          <Panel id="references" title={t('detail:sections.references')} count={refs.length ? countRefs(refs) : undefined}>
            {refs.length > 0 ? <RichReferences groups={refs} /> : <p className="text-sm text-muted-foreground">{t('unreferenced')}</p>}
          </Panel>
        }
        main={<ObjectHistory objClass="Note" handle={note.handle} lastChange={note.change} />}
      />
    </AlbumFrame>
  )
}
