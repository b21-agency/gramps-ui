import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { History, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { Page } from '@/components/app-shell'
import { EmptyState } from '@/components/states'
import { useRecent } from '@/lib/prefs'
import { kindIcon, objectPath } from '@/lib/objects'
import { useTitle } from '@/hooks/use-title'

function dayKey(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function RecentPage() {
  const { t, i18n } = useTranslation('personal')
  const [list, setList] = useRecent()
  const [confirm, setConfirm] = useState(false)
  useTitle(t('recent.title'))

  const [now] = useState(() => Date.now())
  const today = dayKey(now)
  const yesterday = dayKey(now - 864e5)
  const dayFmt = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeFmt = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' })

  const groups: Array<{ key: string; label: string; items: typeof list }> = []
  for (const item of [...list].sort((a, b) => b.at - a.at)) {
    const key = dayKey(item.at)
    let g = groups.at(-1)
    if (!g || g.key !== key) {
      g = {
        key,
        label: key === today ? t('recent.today') : key === yesterday ? t('recent.yesterday') : dayFmt.format(item.at),
        items: [],
      }
      groups.push(g)
    }
    g.items.push(item)
  }

  const clear = () => {
    const prev = list
    setList([])
    toast(t('recent.cleared'), { action: { label: t('undo'), onClick: () => setList(prev) } })
  }

  return (
    <Page
      title={t('recent.title')}
      description={list.length ? t('recent.description') : undefined}
      actions={
        list.length > 0 && (
          <Button variant="outline" onClick={() => setConfirm(true)}>
            <Trash2 />
            {t('recent.clear')}
          </Button>
        )
      }
    >
      {!list.length ? (
        <EmptyState icon={History} title={t('recent.empty.title')}>
          {t('recent.empty.body')}
        </EmptyState>
      ) : (
        <div className="max-w-3xl space-y-8">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-2 border-b pb-2 text-xl font-medium">{g.label}</h2>
              <ul className="-mx-2">
                {g.items.map((r) => {
                  const Icon = kindIcon[r.kind] ?? History
                  return (
                    <li key={r.handle} className="group flex items-center gap-1 rounded-lg hover:bg-accent">
                      <Link to={objectPath(r.kind, r.gramps_id)} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{r.title || r.gramps_id}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {t(`common:object.${r.kind}`)} · <span className="tabular-nums">{r.gramps_id}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeFmt.format(r.at)}</span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="mr-1 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        aria-label={t('recent.removeOne')}
                        title={t('recent.removeOne')}
                        onClick={() => setList((prev) => prev.filter((x) => x.handle !== r.handle))}
                      >
                        <X />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('recent.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('recent.confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={clear}>
              {t('recent.clear')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
