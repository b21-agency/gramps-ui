import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
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
import { api } from '@/lib/api'
import { apiLocale } from '@/i18n'
import { describeObject, kindIcon, objectPath } from '@/lib/objects'
import type { ObjectKind, SearchHit } from '@/lib/types'
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

export function CommandSearch() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 180)
  const [recent] = useRecent()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !isTyping(e))) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ['search', 'palette', dq, apiLocale()],
    enabled: dq.trim().length > 1,
    placeholderData: keepPreviousData,
    queryFn: () =>
      api<SearchHit[]>('/search/', {
        query: { query: searchQuery(dq), locale: apiLocale(), profile: 'self', page: 1, pagesize: 12 },
      }),
  })

  const go = (path: string) => {
    setOpen(false)
    setQ('')
    navigate(path)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-4" />
        <span className="truncate">{t('actions.searchPlaceholder')}</span>
        <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t('actions.search')}
        description={t('actions.searchPlaceholder')}
      >
        <Command shouldFilter={false}>
        <CommandInput value={q} onValueChange={setQ} placeholder={t('actions.searchPlaceholder')} />
        <CommandList className="max-h-[min(60vh,28rem)]">
          {dq.trim().length > 1 && !isFetching && data?.length === 0 && <CommandEmpty>{t('noResults')}</CommandEmpty>}
          {dq.trim().length > 1 && !!data?.length && (
            <CommandGroup>
              {data.map((hit) => {
                const kind = hit.object_type as ObjectKind
                const Icon = kindIcon[kind]
                const d = describeObject(kind, hit.object)
                return (
                  <CommandItem
                    key={hit.handle}
                    value={hit.handle}
                    onSelect={() => go(objectPath(kind, hit.object.gramps_id))}
                  >
                    <Icon className="text-muted-foreground" />
                    <span className="truncate">{d.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{d.subtitle}</span>
                  </CommandItem>
                )
              })}
              <CommandItem value="__all" onSelect={() => go(`/search?q=${encodeURIComponent(q)}`)}>
                <Search className="text-muted-foreground" />
                <span>{t('search.allResults', { ns: 'search', q })}</span>
              </CommandItem>
            </CommandGroup>
          )}
          {dq.trim().length <= 1 && recent.length > 0 && (
            <CommandGroup heading={t('nav.history')}>
              {recent.slice(0, 6).map((r) => {
                const Icon = kindIcon[r.kind]
                return (
                  <CommandItem key={r.handle} value={r.handle} onSelect={() => go(objectPath(r.kind, r.gramps_id))}>
                    <Icon className="text-muted-foreground" />
                    <span className="truncate">{r.title || r.gramps_id}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}
