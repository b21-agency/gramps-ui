import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Feather, Loader2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlbumPage, pill } from '@/components/album-page'
import { EmptyState, ErrorState } from '@/components/states'
import { refThumbUrl } from '@/components/portrait'
import { useBlogPostsInfiniteQuery, type BlogPost } from '@/api/enhanced/blog'
import { apiLocale } from '@/i18n'
import { useAuth, useAccessToken } from '@/lib/auth'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'
import { excerpt, postDate } from './prose'

type Post = BlogPost

function useBlogPosts() {
  return useBlogPostsInfiniteQuery({ locale: apiLocale() })
}

function bodyOf(post: Post) {
  const first = post.note_list?.[0]
  return post.extended?.notes?.find((n) => n.handle === first)?.text.string
}

export function BlogPage() {
  const { t, i18n } = useTranslation('blog')
  const { can } = useAuth()
  useAccessToken()
  useTitle(t('title'))
  const q = useBlogPosts()
  const posts = q.data?.pages.flatMap((p) => p.items) ?? []
  const [lead, ...rest] = posts

  const writeButton = can('AddObject') && (
    <Button asChild className={pill}>
      <Link to="/new_blog_post">
        <PenLine />
        {t('write')}
      </Link>
    </Button>
  )

  return (
    <AlbumPage title={t('title')} description={t('description')} actions={posts.length > 0 && writeButton}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <BlogSkeleton />
      ) : !lead ? (
        <div className="rounded-3xl bg-card">
          <EmptyState icon={Feather} title={t('empty.title')} className="py-24">
            <p>{can('AddObject') ? t('empty.body') : t('empty.bodyReadOnly')}</p>
            {writeButton && <div className="mt-5">{writeButton}</div>}
          </EmptyState>
        </div>
      ) : (
        <>
          <LeadPost post={lead} lang={i18n.language} />

          {rest.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-5 font-serif text-3xl font-medium">{t('olderPosts')}</h2>
              <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {rest.map((p) => (
                  <PostCard key={p.handle} post={p} lang={i18n.language} />
                ))}
              </ul>
            </section>
          )}

          {q.hasNextPage && (
            <div className="mt-10 flex justify-center">
              <Button variant="secondary" className={pill} onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage && <Loader2 className="animate-spin" />}
                {t('loadMore')}
              </Button>
            </div>
          )}
        </>
      )}
    </AlbumPage>
  )
}

function Byline({ post, lang, className }: { post: Post; lang: string; className?: string }) {
  const { t } = useTranslation('blog')
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      <span className="font-semibold text-brass tabular-nums">{postDate(post.change, lang)}</span>
      {post.author && <span> · {t('by', { author: post.author })}</span>}
    </p>
  )
}

/** Typographic stand-in when a post has no photo: the first letter of its title on a framed plate. */
function PaperCover({ title, className }: { title: string; className?: string }) {
  const glyph = title.match(/\p{L}/u)?.[0]?.toUpperCase()
  return (
    <div className={cn('flex size-full bg-gradient-to-b from-secondary to-card p-3', className)}>
      <div className="flex flex-1 items-center justify-center rounded-2xl ring-1 ring-inset ring-brass/30">
        {glyph ? (
          <span className="font-serif text-7xl leading-none text-foreground/80 lg:text-8xl">{glyph}</span>
        ) : (
          <Feather className="size-8 text-brass" aria-hidden />
        )}
      </div>
    </div>
  )
}

function LeadPost({ post, lang }: { post: Post; lang: string }) {
  const { t } = useTranslation('blog')
  const cover = post.media_list?.[0]
  const text = excerpt(bodyOf(post), 360)
  return (
    <article className="grid overflow-hidden rounded-3xl bg-card lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Link
        to={`/blog/${post.gramps_id}`}
        aria-label={post.title}
        tabIndex={-1}
        className="group relative block h-[19rem] overflow-hidden bg-secondary sm:h-[26rem] lg:h-auto lg:min-h-[32rem]"
      >
        {cover ? (
          <img
            src={refThumbUrl(cover, 1200, false)}
            alt=""
            className="absolute inset-0 size-full object-cover [filter:sepia(0.12)_contrast(1.03)] transition-transform duration-500 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
          />
        ) : (
          <PaperCover title={post.title} className="absolute inset-0" />
        )}
      </Link>
      <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8 lg:p-10">
        <p className="text-sm font-semibold text-brass">{t('latest')}</p>
        <h2 className="mt-3 font-serif text-[2.2rem] font-medium leading-[1.04] tracking-[-0.02em] text-balance [overflow-wrap:anywhere] sm:text-5xl lg:text-[3.4rem]">
          <Link to={`/blog/${post.gramps_id}`} className="outline-none hover:text-brass focus-visible:text-brass">
            {post.title}
          </Link>
        </h2>
        <Byline post={post} lang={lang} className="mt-4" />
        {text && <p className="mt-5 max-w-[60ch] font-serif text-lg leading-relaxed text-foreground/85">{text}</p>}
        <div className="mt-7">
          <Button asChild className={pill}>
            <Link to={`/blog/${post.gramps_id}`}>
              {t('readMore')}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

function PostCard({ post, lang }: { post: Post; lang: string }) {
  const cover = post.media_list?.[0]
  const text = excerpt(bodyOf(post), 180)
  return (
    <li className="min-w-0">
      <Link
        to={`/blog/${post.gramps_id}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl bg-card outline-none transition-transform duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {cover ? (
            <img
              src={refThumbUrl(cover, 600, false)}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover [filter:sepia(0.12)_contrast(1.03)] transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          ) : (
            <PaperCover title={post.title} className="absolute inset-0" />
          )}
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <Byline post={post} lang={lang} />
          <h3 className="mt-2 font-serif text-2xl font-medium leading-tight text-balance [overflow-wrap:anywhere] group-hover:text-brass">
            {post.title}
          </h3>
          {text && <p className="mt-3 line-clamp-3 font-serif text-base leading-relaxed text-foreground/75">{text}</p>}
        </div>
      </Link>
    </li>
  )
}

function BlogSkeleton() {
  return (
    <div className="space-y-12">
      <div className="grid overflow-hidden rounded-3xl bg-card lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-[19rem] rounded-none sm:h-[26rem] lg:h-[32rem]" />
        <div className="space-y-4 p-6 sm:p-8 lg:p-10">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-14 w-4/5" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-80 rounded-3xl" />
        ))}
      </div>
    </div>
  )
}
