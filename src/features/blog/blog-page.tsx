import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Feather, Loader2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Page } from '@/components/app-shell'
import { EmptyState, ErrorState } from '@/components/states'
import { refThumbUrl } from '@/components/portrait'
import { apiRaw } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { useAuth, useAccessToken } from '@/lib/auth'
import type { Note, Source } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { BLOG_TAG, excerpt, postDate } from './prose'

type Post = Source & { extended?: { notes?: Note[] } }
const PAGE_SIZE = 12

function useBlogPosts() {
  return useInfiniteQuery({
    queryKey: ['sources', 'blog', 'posts', apiLocale()],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const r = await apiRaw<Post[]>('/sources/', {
        query: {
          rules: JSON.stringify({ rules: [{ name: 'HasTag', values: [BLOG_TAG] }] }),
          sort: '-change',
          extend: 'note_list',
          page: pageParam,
          pagesize: PAGE_SIZE,
          locale: apiLocale(),
        },
      })
      return { items: r.data, total: r.total ?? r.data.length, page: pageParam }
    },
    getNextPageParam: (last) => (last.page * PAGE_SIZE < last.total ? last.page + 1 : undefined),
  })
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
    <Button asChild>
      <Link to="/new_blog_post">
        <PenLine />
        {t('write')}
      </Link>
    </Button>
  )

  return (
    <Page title={t('title')} description={t('description')} actions={posts.length > 0 && writeButton}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <BlogSkeleton />
      ) : !lead ? (
        <EmptyState icon={Feather} title={t('empty.title')} className="py-24">
          <p>{can('AddObject') ? t('empty.body') : t('empty.bodyReadOnly')}</p>
          {writeButton && <div className="mt-5">{writeButton}</div>}
        </EmptyState>
      ) : (
        <div className="mx-auto max-w-4xl">
          <LeadPost post={lead} lang={i18n.language} />

          {rest.length > 0 && (
            <section className="mt-14">
              <h2 className="mb-2 border-b pb-2 text-xl font-medium">{t('olderPosts')}</h2>
              <ul className="divide-y">
                {rest.map((p) => (
                  <PostRow key={p.handle} post={p} lang={i18n.language} />
                ))}
              </ul>
            </section>
          )}

          {q.hasNextPage && (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage && <Loader2 className="animate-spin" />}
                {t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Page>
  )
}

function Byline({ post, lang }: { post: Post; lang: string }) {
  const { t } = useTranslation('blog')
  return (
    <p className="text-sm text-muted-foreground">
      {[post.author && t('by', { author: post.author }), postDate(post.change, lang)].filter(Boolean).join(' · ')}
    </p>
  )
}

function LeadPost({ post, lang }: { post: Post; lang: string }) {
  const { t } = useTranslation('blog')
  const cover = post.media_list?.[0]
  const text = excerpt(bodyOf(post), 360)
  return (
    <article>
      <Link to={`/blog/${post.gramps_id}`} className="group block">
        {cover && (
          <div className="mb-6 overflow-hidden rounded-xl border bg-muted">
            <img
              src={refThumbUrl(cover, 1200, false)}
              alt=""
              className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.015] motion-reduce:transition-none"
            />
          </div>
        )}
        <h2 className="text-3xl leading-tight font-medium tracking-tight text-balance group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-4xl">
          {post.title}
        </h2>
      </Link>
      <div className="mt-2">
        <Byline post={post} lang={lang} />
      </div>
      {text && <p className="mt-4 max-w-[65ch] font-serif text-lg leading-relaxed text-foreground/85">{text}</p>}
      <Button asChild variant="link" className="mt-2 px-0">
        <Link to={`/blog/${post.gramps_id}`}>{t('readMore')}</Link>
      </Button>
    </article>
  )
}

function PostRow({ post, lang }: { post: Post; lang: string }) {
  const cover = post.media_list?.[0]
  const text = excerpt(bodyOf(post), 180)
  return (
    <li>
      <Link to={`/blog/${post.gramps_id}`} className="group flex gap-4 py-5 sm:gap-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl leading-snug font-medium text-balance group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-2xl">
            {post.title}
          </h3>
          <div className="mt-1">
            <Byline post={post} lang={lang} />
          </div>
          {text && <p className="mt-2 line-clamp-2 font-serif text-base leading-relaxed text-foreground/80">{text}</p>}
        </div>
        {cover && (
          <img
            src={refThumbUrl(cover, 300)}
            alt=""
            loading="lazy"
            className="size-20 shrink-0 rounded-lg border bg-muted object-cover sm:size-28"
          />
        )}
      </Link>
    </li>
  )
}

function BlogSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Skeleton className="aspect-[16/9] w-full rounded-xl" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}
