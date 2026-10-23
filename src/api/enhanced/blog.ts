import { api } from '../index'
import type { Note, Source } from '@/lib/types'
import { BLOG_TAG } from '@/features/blog/prose'
import { run } from './compose'
import type { Page } from './page'
import { sourcesApi } from './sources-slice-enhanced'

// Blog posts are Sources tagged "Blog" whose first note is the text. The list is paged
// ("older posts", an infinite query codegen can't produce) on top of the generated
// `getSources`, newest-changed first; it refreshes when any source or a shown note changes.

export type BlogPost = Source & { extended?: { notes?: Note[] } }

export interface BlogPage extends Page<BlogPost> {
  page: number
}

export const BLOG_PAGE_SIZE = 12

export const blogApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    blogPosts: build.infiniteQuery<BlogPage, { locale: string }, number>({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (last) => (last.page * BLOG_PAGE_SIZE < last.total ? last.page + 1 : undefined),
      },
      async queryFn({ queryArg: { locale }, pageParam }, queryApi) {
        const r = await run<Page<BlogPost>>(
          queryApi,
          sourcesApi.endpoints.getSources.initiate(
            {
              rules: JSON.stringify({ rules: [{ name: 'HasTag', values: [BLOG_TAG] }] }),
              sort: ['-change'],
              extend: ['note_list'],
              page: pageParam,
              pagesize: BLOG_PAGE_SIZE,
              locale,
            },
            { subscribe: false, forceRefetch: true },
          ),
        )
        return 'error' in r ? r : { data: { ...r.data, page: pageParam } }
      },
      providesTags: (res) => [
        { type: 'Sources', id: 'LIST' },
        ...(res?.pages ?? []).flatMap((p) => [
          ...p.items.map((s) => ({ type: 'Sources' as const, id: s.handle })),
          ...p.items.flatMap((s) => s.extended?.notes ?? []).map((n) => ({ type: 'Notes' as const, id: n.handle })),
        ]),
      ],
    }),
  }),
})

export const { useBlogPostsInfiniteQuery } = blogApi
