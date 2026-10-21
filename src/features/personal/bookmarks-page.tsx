import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQueries } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Bookmark, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Page } from '@/components/app-shell'
import { EmptyState } from '@/components/states'
import { useBookmarks, type ObjectRefLite } from '@/lib/prefs'
import { describeObject, kindIcon, objectPath } from '@/lib/objects'
import { endpointOf, type ObjectKind } from '@/lib/types'
import { api, ApiError } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'

const kindOrder: ObjectKind[] = ['person', 'family', 'event', 'place', 'media', 'source', 'citation', 'repository', 'note']

export function BookmarksPage() {
  const { t } = useTranslation('personal')
  const { list, setList } = useBookmarks()
  useTitle(t('bookmarks.title'))

  const remove = (item: ObjectRefLite) => {
    const index = list.findIndex((b) => b.handle === item.handle)
    setList((prev) => prev.filter((b) => b.handle !== item.handle))
    toast(t('bookmarks.removed', { title: item.title || item.gramps_id }), {
      action: {
        label: t('undo'),
        onClick: () =>
          setList((prev) => {
            if (prev.some((b) => b.handle === item.handle)) return prev
            const next = [...prev]
            next.splice(Math.min(index, next.length), 0, item)
            return next
          }),
      },
    })
  }

  // current title/subtitle of each bookmark (names change, objects get deleted)
  const fresh = useQueries({
    queries: list.map((b) => ({
      queryKey: [endpointOf[b.kind], 'handle', b.handle, { profile: 'self', locale: apiLocale() }],
      queryFn: () => api<Record<string, unknown>>(`/${endpointOf[b.kind]}/${b.handle}`, { query: { profile: 'self', locale: apiLocale() } }),
      staleTime: 60_000,
      retry: false,
    })),
  })
  const info = new Map(
    list.map((b, i) => {
      const q = fresh[i]
      const d = q?.data ? describeObject(b.kind, q.data) : null
      return [b.handle, { title: d?.title, subtitle: d?.subtitle, missing: q?.error instanceof ApiError && q.error.status === 404 }]
    }),
  )

  const groups = kindOrder
    .map((kind) => ({ kind, items: list.filter((b) => b.kind === kind) }))
    .filter((g) => g.items.length)

  return (
    <Page title={t('bookmarks.title')} description={list.length ? t('bookmarks.description') : undefined}>
      {!list.length ? (
        <EmptyState icon={Bookmark} title={t('bookmarks.empty.title')}>
          {t('bookmarks.empty.body')}
        </EmptyState>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          {groups.map(({ kind, items }) => {
            const Icon = kindIcon[kind]
            return (
              <section key={kind}>
                <div className="mb-2 flex items-baseline gap-2 border-b pb-2">
                  <h2 className="text-xl font-medium">{t(`common:objects.${kind}`)}</h2>
                  <span className="text-sm tabular-nums text-muted-foreground">{items.length}</span>
                </div>
                <ul className="-mx-2">
                  {items.map((b) => (
                    <li key={b.handle} className="group flex items-center gap-1 rounded-lg hover:bg-accent">
                      <Link to={objectPath(b.kind, b.gramps_id)} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate font-serif text-[1.05rem]', info.get(b.handle)?.missing && 'text-muted-foreground line-through')}>
                            {info.get(b.handle)?.title || b.title || b.gramps_id}
                          </span>
                          {(info.get(b.handle)?.missing || info.get(b.handle)?.subtitle) && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {info.get(b.handle)?.missing ? t('bookmarks.missing') : info.get(b.handle)?.subtitle}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{b.gramps_id}</span>
                      </Link>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="mr-1 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                            aria-label={t('bookmarks.remove')}
                            onClick={() => remove(b)}
                          >
                            <X />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('bookmarks.remove')}</TooltipContent>
                      </Tooltip>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Page>
  )
}
