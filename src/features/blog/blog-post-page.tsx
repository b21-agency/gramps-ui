import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, BookOpen, Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsiveMenu } from '@/components/responsive-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ErrorState } from '@/components/states'
import { NoteHtml } from '@/components/note-html'
import { refThumbUrl } from '@/components/portrait'
import { Gallery, useNotesHtml } from '@/components/detail/sections'
import { Panel } from '@/components/detail/panel'
import { albumFrame, pill } from '@/components/album-page'
import { cn } from '@/lib/utils'
import { useInvalidateOnUnmount } from '@/api/enhanced/editor'
import { useAuth, useAccessToken } from '@/lib/auth'
import { useObjectById } from '@/lib/queries'
import { useRecordVisit } from '@/lib/prefs'
import type { Note, Source } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { BlogPostEditor } from './blog-post-editor'
import { blogProse, postDate, withInlineImages } from './prose'
import { inlineImageHandles, type StyledTag } from './styled-text'
import { deleteTaggedSource } from './tagged-source'

type Post = Source & { extended?: Source['extended'] & { notes?: Note[] } }

export function BlogPostPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation('blog')
  const { can } = useAuth()
  useAccessToken()
  const navigate = useNavigate()
  const invalidateLater = useInvalidateOnUnmount()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const q = useObjectById<Post>('source', id, { extend: 'all' })
  const post = q.data
  const firstNote = post?.note_list?.[0]
  const notes = useNotesHtml(firstNote ? [firstNote] : undefined)
  const body = notes.data?.[0]

  useTitle(post?.title || id)
  useRecordVisit(post ? { kind: 'source', handle: post.handle, gramps_id: post.gramps_id, title: post.title } : null)

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!post) return <PostSkeleton />

  if (editing)
    return (
      <BlogPostEditor
        post={post}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          // the save invalidated the post and its note; both refetch on their own
          setEditing(false)
        }}
      />
    )

  const [cover, ...more] = post.media_list ?? []

  const remove = async () => {
    setDeleting(true)
    try {
      // the text note belongs to the post unless something else links to it
      const tx = await deleteTaggedSource(post.handle, firstNote)
      toast.success(t('delete.done'))
      // refreshed once this page is gone, so the deleted post isn't refetched
      invalidateLater(tx)
      navigate('/blog')
    } catch (e) {
      toast.error((e as Error).message)
      setDeleting(false)
    }
  }

  const words = body?.text.string.trim().split(/\s+/).filter(Boolean).length ?? 0
  const minutes = Math.max(1, Math.round(words / 200))

  return (
    <article className={albumFrame}>
      <div className="mb-8 flex items-center gap-2">
        <Button asChild variant="ghost" className="-ml-3 h-11 rounded-full px-3 text-muted-foreground hover:text-foreground sm:h-10">
          <Link to="/blog">
            <ArrowLeft />
            {t('backToBlog')}
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          {can('EditObject') && (
            <Button variant="secondary" className={pill} onClick={() => setEditing(true)}>
              <Pencil />
              {t('edit')}
            </Button>
          )}
          <ResponsiveMenu
            title={t('more')}
            trigger={
              <Button variant="ghost" size="icon" className="size-11 rounded-full sm:size-10" aria-label={t('more')}>
                <Ellipsis />
              </Button>
            }
            groups={[
              [{ key: 'source', icon: <BookOpen />, label: t('openSource'), onSelect: () => navigate(`/source/${post.gramps_id}`) }],
              can('DeleteObject')
                ? [{ key: 'delete', icon: <Trash2 />, label: t('delete.action'), destructive: true, onSelect: () => setConfirmDelete(true) }]
                : [],
            ]}
          />
        </div>
      </div>

      <header className="mx-auto max-w-4xl text-center">
        <p className="text-sm font-semibold text-brass tabular-nums">
          {[postDate(post.change, i18n.language), body && t('minutes', { count: minutes })].filter(Boolean).join(' · ')}
        </p>
        <h1 className="mt-4 font-serif text-[2.6rem] font-medium leading-[1.02] tracking-[-0.02em] text-balance [overflow-wrap:anywhere] sm:text-6xl lg:text-7xl">
          {post.title}
        </h1>
        {post.author && <p className="mt-5 font-serif text-xl italic text-muted-foreground">{t('by', { author: post.author })}</p>}
      </header>

      {cover && (
        <figure className="mt-10 overflow-hidden rounded-3xl bg-card">
          <img
            src={refThumbUrl(cover, 1600, false)}
            alt=""
            className="aspect-[4/3] max-h-[78vh] w-full object-cover 2xl:aspect-[21/9] object-[center_30%] [filter:sepia(0.12)_contrast(1.03)] sm:aspect-[16/9]"
          />
        </figure>
      )}

      <div className="mx-auto mt-12 max-w-[65ch] sm:mt-14">
        {notes.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5" style={{ width: `${95 - i * 8}%` }} />
            ))}
          </div>
        ) : body ? (
          <NoteHtml
            html={withInlineImages(body.formatted?.html, inlineImageHandles(body.text as { string: string; tags?: StyledTag[] }))}
            text={body.text.string.replace(/\uFFFC/g, '')}
            className={cn(blogProse, dropCap)}
          />
        ) : (
          <p className="font-serif text-lg italic text-muted-foreground">{t('noBody')}</p>
        )}
        <div aria-hidden className="mx-auto mt-12 flex w-24 items-center gap-2 text-brass/60">
          <span className="h-px flex-1 bg-current" />
          <span className="size-1.5 rounded-full bg-current" />
          <span className="h-px flex-1 bg-current" />
        </div>
      </div>

      {more.length > 0 && (
        <Panel title={t('photos')} count={more.length} className="mt-12">
          <Gallery refs={more} media={post.extended?.media} />
        </Panel>
      )}

      <div className="mt-10 flex justify-center">
        <Button asChild variant="secondary" className={pill}>
          <Link to="/blog">
            <ArrowLeft />
            {t('backToBlog')}
          </Link>
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete.body', { title: post.title })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault()
                void remove()
              }}
            >
              {t('delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}

/** Gold initial on the first paragraph, like a printed family chronicle. */
const dropCap =
  '[&_p:first-of-type]:first-letter:float-left [&_p:first-of-type]:first-letter:mr-2.5 [&_p:first-of-type]:first-letter:mt-1 [&_p:first-of-type]:first-letter:font-serif [&_p:first-of-type]:first-letter:text-[3.6em] [&_p:first-of-type]:first-letter:leading-[0.8] [&_p:first-of-type]:first-letter:text-brass'

function PostSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-14 sm:px-6 lg:px-10">
      <Skeleton className="mx-auto h-4 w-40" />
      <Skeleton className="mx-auto h-16 w-3/5" />
      <Skeleton className="mt-10 aspect-[16/9] w-full rounded-3xl" />
    </div>
  )
}
