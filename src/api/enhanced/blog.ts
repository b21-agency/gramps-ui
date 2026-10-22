import type { FetchBaseQueryMeta } from '@reduxjs/toolkit/query'
import { api } from '../index'
import type { Note, Source } from '@/lib/types'
import { BLOG_TAG } from '@/features/blog/prose'

// Blog posts are Sources tagged "Blog" whose first note is the text. The list is paged
// ("older posts") and newest-changed first; it refreshes when any source or one of the
// shown notes changes.

export type BlogPost = Source & { extended?: { notes?: Note[] } }

export interface BlogPage {
  items: BlogPost[]
  total: number
  page: number
}

export const BLOG_PAGE_SIZE = 12

const totalOf = (meta: FetchBaseQueryMeta | undefined, fallback: number) => {
  const h = meta?.response?.headers.get('X-Total-Count')
  return h ? Number(h) : fallback
}

export const blogApi = api.injectEndpoints({
  // fail loudly instead of silently keeping an endpoint of the same name
  overrideExisting: 'throw',
  endpoints: (build) => ({
    blogPosts: build.infiniteQuery<BlogPage, { locale: string }, number>({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam: (last) => (last.page * BLOG_PAGE_SIZE < last.total ? last.page + 1 : undefined),
      },
      query: ({ queryArg: { locale }, pageParam }) => ({
        url: '/api/sources/',
        params: {
          rules: JSON.stringify({ rules: [{ name: 'HasTag', values: [BLOG_TAG] }] }),
          sort: '-change',
          extend: 'note_list',
          page: pageParam,
          pagesize: BLOG_PAGE_SIZE,
          locale,
        },
      }),
      transformResponse: (data: BlogPost[], meta, arg) => ({
        items: data,
        total: totalOf(meta, data.length),
        page: (arg as unknown as { pageParam: number }).pageParam,
      }),
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
