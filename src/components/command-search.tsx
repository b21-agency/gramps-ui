import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { Search } from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Kbd } from './kbd'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { useSearchQuery } from '@/api/enhanced/objects'
import { apiLocale } from '@/i18n'
import { describeObject, kindIcon, objectPath } from '@/lib/objects'
import type { ObjectKind } from '@/lib/types'
import { useRecent } from '@/lib/prefs'

export function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** Search query for the full-text index; adds a trailing wildcard so typing feels instant. */
export function searchQuery(q: string) {
  const s = q.trim()
  if (!s) return ''
  if (/[*?"]|\b(AND|OR|NOT)\b/.test(s)) return s
  return s
    .split(/\s+/)
    .map((w) => `${w}*`)
    .join(' ')
}

// open state is global so the mobile tab bar can open the search too
let searchOpen = false
const searchListeners = new Set<() => void>()
export function setSearchOpen(v: boolean | ((o: boolean) => boolean)) {
  searchOpen = typeof v === 'function' ? v(searchOpen) : v
  searchListeners.forEach((l) => l())
}
export function useSearchOpen() {
  return useSyncExternalStore(
    (cb) => {
      searchListeners.add(cb)
      return () => searchListeners.delete(cb)
    },
    () => searchOpen,
  )
}

export function CommandSearch() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = useSearchOpen()
  const isMobile = useIsMobile()
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 180)
  const [recent] = useRecent()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isTyping(e))) {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // `data` keeps the previous hits while the next query loads
  const { data: page, isFetching } = useSearchQuery(
    dq.trim().length > 1 ? { query: searchQuery(dq), locale: apiLocale(), profile: 'self', page: 1, pagesize: 12 } : skipToken,
  )
  const data = page?.items

  const go = (path: string) => {
    setSearchOpen(false)
    setQ('')
    navigate(path)
  }

  const itemCls = isMobile ? 'gap-3 py-3 text-base [&_svg]:size-5' : ''
  const body = (
    <Command shouldFilter={false} className={isMobile ? 'bg-transparent' : undefined}>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder={t('actions.searchPlaceholder')}
        enterKeyHint="search"
        autoFocus
      />
      <CommandList className={isMobile ? 'max-h-none flex-1 overscroll-contain' : 'max-h-[min(60vh,28rem)]'}>
        {dq.trim().length > 1 && !isFetching && data?.length === 0 && <CommandEmpty>{t('noResults')}</CommandEmpty>}
        {dq.trim().length > 1 && !!data?.length && (
          <CommandGroup>
            {data.filter((hit) => hit.object_type in kindIcon).map((hit) => {
              const kind = hit.object_type as ObjectKind
              const Icon = kindIcon[kind]
              const d = describeObject(kind, hit.object)
              return (
                <CommandItem
                  key={hit.handle}
                  value={hit.handle}
                  className={itemCls}
                  onSelect={() => go(objectPath(kind, hit.object.gramps_id))}
                >
                  <Icon className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{d.subtitle}</span>
                </CommandItem>
              )
            })}
            <CommandItem value="__all" className={itemCls} onSelect={() => go(`/search?q=${encodeURIComponent(q)}`)}>
              <Search className="text-muted-foreground" />
              <span>{t('search.allResults', { ns: 'search', q })}</span>
            </CommandItem>
          </CommandGroup>
        )}
        {dq.trim().length <= 1 && recent.length > 0 && (
          <CommandGroup heading={t('nav.history')}>
            {recent.slice(0, 8).map((r) => {
              const Icon = kindIcon[r.kind]
              return (
                <CommandItem key={r.handle} value={r.handle} className={itemCls} onSelect={() => go(objectPath(r.kind, r.gramps_id))}>
                  <Icon className="text-muted-foreground" />
                  <span className="truncate">{r.title || r.gramps_id}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="hidden h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
      >
        <Search className="size-4" />
        <span className="truncate">{t('actions.searchPlaceholder')}</span>
        <Kbd className="ml-auto">⌘K</Kbd>
      </button>
      {isMobile ? (
        <Drawer open={open} onOpenChange={setSearchOpen}>
          <DrawerContent className="h-[92dvh] max-h-[92dvh] pb-safe">
            <DrawerTitle className="sr-only">{t('actions.search')}</DrawerTitle>
            <DrawerDescription className="sr-only">{t('actions.searchPlaceholder')}</DrawerDescription>
            <div className="flex min-h-0 flex-1 flex-col px-2 pt-2">{body}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <CommandDialog open={open} onOpenChange={setSearchOpen} title={t('actions.search')} description={t('actions.searchPlaceholder')}>
          {body}
        </CommandDialog>
      )}
    </>
  )
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}
