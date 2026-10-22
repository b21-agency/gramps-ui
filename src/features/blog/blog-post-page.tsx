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

  return (
    <article className="px-4 py-6 sm:px-6 lg:py-10">
      <div className="mx-auto mb-8 flex max-w-4xl items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/blog">
            <ArrowLeft />
            {t('backToBlog')}
          </Link>
        </Button>
        <div className="ml-auto flex items-center gap-1">
          {can('EditObject') && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil />
              {t('edit')}
            </Button>
          )}
          <ResponsiveMenu
            title={t('more')}
            trigger={
              <Button variant="ghost" size="icon-sm" className="max-md:size-10" aria-label={t('more')}>
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

      <header className="mx-auto max-w-[65ch]">
        <h1 className="text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl">{post.title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {[post.author && t('by', { author: post.author }), postDate(post.change, i18n.language)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      {cover && (
        <figure className="mx-auto mt-8 max-w-4xl">
          <img
            src={refThumbUrl(cover, 1600, false)}
            alt=""
            className="max-h-[70vh] w-full rounded-xl border bg-muted object-contain"
          />
        </figure>
      )}

      <div className="mx-auto mt-10 max-w-[65ch]">
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
            className={blogProse}
          />
        ) : (
          <p className="text-muted-foreground">{t('noBody')}</p>
        )}
      </div>

      {more.length > 0 && (
        <section className="mx-auto mt-14 max-w-4xl">
          <h2 className="mb-3 border-b pb-2 text-xl font-medium">{t('photos')}</h2>
          <Gallery refs={more} media={post.extended?.media} />
        </section>
      )}

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

function PostSkeleton() {
  return (
    <div className="mx-auto max-w-[65ch] space-y-4 px-4 py-14">
      <Skeleton className="h-12 w-4/5" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-8 h-64 w-full" />
    </div>
  )
}
