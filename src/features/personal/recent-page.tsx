import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { History, Trash2 } from 'lucide-react'
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
import { Panel } from '@/components/detail/panel'
import { ObjectRow, ObjectThumb } from '@/components/object-thumb'
import { usePortraits } from '@/hooks/use-portraits'
import { EmptyState } from '@/components/states'
import { useRecent } from '@/lib/prefs'
import { objectPath } from '@/lib/objects'
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

  // faces for the people in the history (one request)
  const portraits = usePortraits(list.filter((r) => r.kind === 'person').map((r) => r.handle))

  const clear = () => {
    const prev = list
    setList([])
    toast(t('recent.cleared'), { action: { label: t('undo'), onClick: () => setList(prev) } })
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-serif text-[2.6rem] font-medium leading-[1] tracking-[-0.02em] sm:text-6xl">{t('recent.title')}</h1>
          {list.length > 0 && <p className="mt-3 text-lg text-muted-foreground">{t('recent.description')}</p>}
        </div>
        {list.length > 0 && (
          <Button variant="secondary" className="h-11 rounded-full px-5 sm:h-10" onClick={() => setConfirm(true)}>
            <Trash2 />
            {t('recent.clear')}
          </Button>
        )}
      </header>
      {!list.length ? (
        <EmptyState icon={History} title={t('recent.empty.title')} className="rounded-3xl bg-card py-20">
          {t('recent.empty.body')}
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => (
            <Panel key={g.key} title={g.label} count={g.items.length}>
              <ul className="-mx-2 grid gap-x-4 gap-y-0.5 md:grid-cols-2 2xl:grid-cols-3">
                {g.items.map((r) => (
                  <li key={r.handle} className="min-w-0">
                    <ObjectRow
                      to={objectPath(r.kind, r.gramps_id)}
                      thumb={<ObjectThumb kind={r.kind} handle={r.handle} mediaRef={portraits.get(r.handle)} name={r.title || r.gramps_id} size={48} />}
                      title={r.title || r.gramps_id}
                      subtitle={`${t(`common:object.${r.kind}`)} · ${r.gramps_id}`}
                      meta={timeFmt.format(r.at)}
                      onRemove={() => setList((prev) => prev.filter((x) => x.handle !== r.handle))}
                      removeLabel={t('recent.removeOne')}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
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
    </div>
  )
}
