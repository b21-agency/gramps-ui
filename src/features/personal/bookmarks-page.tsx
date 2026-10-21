import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Bookmark, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Page } from '@/components/app-shell'
import { EmptyState } from '@/components/states'
import { useBookmarks, type ObjectRefLite } from '@/lib/prefs'
import { kindIcon, objectPath } from '@/lib/objects'
import type { ObjectKind } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'

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
                        <span className="min-w-0 flex-1 truncate font-serif text-[1.05rem]">{b.title || b.gramps_id}</span>
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
