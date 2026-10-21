import { Fragment, useEffect, useRef, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import { Kbd } from './kbd'
import { setSearchOpen } from './command-search'

// open state is global so the help page can open the dialog too
let open = false
const listeners = new Set<() => void>()
export function setShortcutsOpen(v: boolean) {
  open = v
  listeners.forEach((l) => l())
}
const useShortcutsOpen = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => open,
  )

/** "g" + key: go to a page */
const goKeys: Array<[string, string, string]> = [
  ['h', '/', 'nav.home'],
  ['b', '/blog', 'nav.blog'],
  ['c', '/tree', 'nav.tree'],
  ['t', '/timeline', 'nav.timeline'],
  ['m', '/map', 'nav.map'],
  ['d', '/dna-matches', 'nav.dna'],
  ['l', '/people', 'nav.people'],
  ['i', '/medialist', 'nav.media'],
  ['r', '/recent', 'nav.history'],
  ['f', '/bookmarks', 'nav.bookmarks'],
  ['j', '/tasks', 'nav.tasks'],
  ['e', '/export', 'nav.export'],
  ['s', '/settings', 'nav.settings'],
]

/** "n" + key: create something */
const newKeys: Array<[string, string, string]> = [
  ['p', '/new_person', 'object.person'],
  ['f', '/new_family', 'object.family'],
  ['e', '/new_event', 'object.event'],
  ['l', '/new_place', 'object.place'],
  ['s', '/new_source', 'object.source'],
  ['c', '/new_citation', 'object.citation'],
  ['r', '/new_repository', 'object.repository'],
  ['n', '/new_note', 'object.note'],
  ['m', '/new_media', 'object.media'],
  ['t', '/new_task', 'shortcuts.task'],
]

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || !!el.closest('[role=dialog],[role=menu],[role=listbox]')
}

/** Global keyboard shortcuts (same keys as the classic Gramps Web UI) and the "?" overview. */
export function KeyboardShortcuts() {
  const { t } = useTranslation(['help', 'common'])
  const navigate = useNavigate()
  const { can } = useAuth()
  const isOpen = useShortcutsOpen()
  const prefix = useRef<'' | 'g' | 'n'>('')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return
      const p = prefix.current
      prefix.current = ''
      window.clearTimeout(timer.current)
      let handled = true
      if (p === 'g') {
        const hit = goKeys.find(([k]) => k === e.key)
        if (hit) navigate(hit[1])
      } else if (p === 'n') {
        const hit = newKeys.find(([k]) => k === e.key)
        if (hit && can('AddObject')) navigate(hit[1])
      } else if (e.key === 'g' || e.key === 'n') {
        prefix.current = e.key
        timer.current = window.setTimeout(() => (prefix.current = ''), 1500)
      } else if (e.key === 's') {
        setSearchOpen(true)
      } else if (e.key === 'e') {
        const btn = document.querySelector<HTMLButtonElement>('main [data-shortcut="edit"]')
        if (btn) btn.click()
        else handled = false
      } else if (e.key === '?') {
        setShortcutsOpen(true)
      } else handled = false
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, can])

  const row = (keys: string[], label: string) => (
    <Fragment key={keys.join('+') + label}>
      <dt className="flex items-center gap-1">
        {keys.map((k, i) => (
          <Kbd key={i}>{k}</Kbd>
        ))}
      </dt>
      <dd className="text-sm">{label}</dd>
    </Fragment>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('help:shortcuts.title')}</DialogTitle>
          <DialogDescription>{t('help:shortcuts.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-3">
          <section>
            <h3 className="mb-2 font-sans text-sm font-medium text-muted-foreground">{t('help:shortcuts.global')}</h3>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
              {row(['?'], t('help:shortcuts.show'))}
              {row(['s'], t('common:actions.search'))}
              {row(['/'], t('common:actions.search'))}
              {row(['⌘', 'K'], t('common:actions.search'))}
              {row(['e'], t('common:actions.edit'))}
            </dl>
          </section>
          <section>
            <h3 className="mb-2 font-sans text-sm font-medium text-muted-foreground">{t('help:shortcuts.navigation')}</h3>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
              {goKeys.map(([k, , label]) => row(['g', k], t(`common:${label}`)))}
            </dl>
          </section>
          {can('AddObject') && (
            <section>
              <h3 className="mb-2 font-sans text-sm font-medium text-muted-foreground">{t('help:shortcuts.new')}</h3>
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                {newKeys.map(([k, , label]) => row(['n', k], label.startsWith('shortcuts.') ? t(`help:${label}`) : t(`common:${label}`)))}
              </dl>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
