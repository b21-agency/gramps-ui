import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { toast } from 'sonner'
import { Bookmark } from 'lucide-react'
import { Panel } from '@/components/detail/panel'
import { ObjectRow, ObjectThumb } from '@/components/object-thumb'
import { Portrait } from '@/components/portrait'
import { usePortraits } from '@/hooks/use-portraits'
import { profileName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/states'
import { useBookmarks, type ObjectRefLite } from '@/lib/prefs'
import { describeObject, objectPath } from '@/lib/objects'
import type { MediaRef, ObjectKind } from '@/lib/types'
import { useGetObjectsMixedQuery } from '@/api/enhanced/shared'
import { apiLocale } from '@/i18n'
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

  // current title/subtitle of each bookmark (names change, objects get deleted)
  // one request per kind; an object the server no longer returns was deleted
  const fresh = useGetObjectsMixedQuery(
    list.length
      ? { refs: list.map((b) => ({ kind: b.kind, handle: b.handle })), query: { profile: 'self', locale: apiLocale() } }
      : skipToken,
  )
  // `data` may be the previous list's answer while a changed list loads; only call
  // something missing from the answer for the current list
  const current = fresh.currentData
  const info = new Map(
    list.map((b) => {
      const o = fresh.data?.[b.handle]
      const d = o ? describeObject(b.kind, o) : null
      return [b.handle, { title: d?.title, subtitle: d?.subtitle, missing: !!current && !current[b.handle] }]
    }),
  )

  // families show the couple's faces
  type Couple = { father?: { handle?: string; sex?: string } & Record<string, unknown>; mother?: { handle?: string; sex?: string } & Record<string, unknown> }
  const coupleOf = (handle: string) => {
    const p = (fresh.data?.[handle] as { profile?: Couple } | undefined)?.profile
    return [p?.father, p?.mother].filter((x): x is NonNullable<Couple['father']> => !!x?.handle)
  }
  const portraits = usePortraits(list.filter((b) => b.kind === 'family').flatMap((b) => coupleOf(b.handle).map((x) => x.handle!)))

  const groups = kindOrder
    .map((kind) => ({ kind, items: list.filter((b) => b.kind === kind) }))
    .filter((g) => g.items.length)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
      <header className="mb-8">
        <h1 className="font-serif text-[2.6rem] font-medium leading-[1] tracking-[-0.02em] sm:text-6xl">{t('bookmarks.title')}</h1>
        {list.length > 0 && <p className="mt-3 text-lg text-muted-foreground">{t('bookmarks.description')}</p>}
      </header>
      {!list.length ? (
        <EmptyState icon={Bookmark} title={t('bookmarks.empty.title')} className="rounded-3xl bg-card py-20">
          {t('bookmarks.empty.body')}
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          {groups.map(({ kind, items }) => (
            <Panel key={kind} title={t(`common:objects.${kind}`)} count={items.length}>
              <ul className="-mx-2 grid gap-x-4 gap-y-0.5 md:grid-cols-2 xl:grid-cols-3">
                {items.map((b) => {
                  const i = info.get(b.handle)
                  const o = fresh.data?.[b.handle] as { media_list?: MediaRef[]; profile?: { sex?: string } } | undefined
                  const title = i?.title || b.title || b.gramps_id
                  return (
                    <li key={b.handle} className="min-w-0">
                      <ObjectRow
                        to={objectPath(b.kind, b.gramps_id)}
                        thumb={
                          b.kind === 'family' && coupleOf(b.handle).length ? (
                            <span className="flex w-14 shrink-0">
                              {coupleOf(b.handle).map((x, n) => (
                                <Portrait
                                  key={x.handle}
                                  mediaRef={portraits.get(x.handle!)}
                                  name={profileName(x)}
                                  sex={x.sex}
                                  size={40}
                                  className={cn('ring-[3px] ring-card', n > 0 && '-ml-6 mt-4')}
                                />
                              ))}
                            </span>
                          ) : (
                            <ObjectThumb kind={b.kind} handle={b.handle} mediaRef={o?.media_list?.[0]} name={title} sex={o?.profile?.sex} size={56} />
                          )
                        }
                        title={title}
                        struck={i?.missing}
                        subtitle={i?.missing ? t('bookmarks.missing') : [i?.subtitle, b.gramps_id].filter(Boolean).join(' · ')}
                        onRemove={() => remove(b)}
                        removeLabel={t('bookmarks.remove')}
                      />
                    </li>
                  )
                })}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
