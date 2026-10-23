import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useGetSearchQuery } from '@/api/enhanced/search-slice-enhanced'
import { apiLocale } from '@/i18n'
import { describeObject, kindIcon } from '@/lib/objects'
import type { ObjectKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import { searchQuery, useDebounced } from './command-search'
import { AdaptivePopover } from './adaptive-popover'

export interface PickedObject {
  kind: ObjectKind
  handle: string
  gramps_id: string
  title: string
  subtitle: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object: any
}

/** Search-as-you-type list of objects of the given kinds (uses /api/search/). */
export function ObjectSearchList({
  kinds,
  onPick,
  selected,
  placeholder,
  autoFocus,
  onQueryChange,
}: {
  kinds: ObjectKind[]
  onPick: (o: PickedObject) => void
  selected?: string | null
  placeholder?: string
  autoFocus?: boolean
  /** The typed search (e.g. to prefill "create new" with it). */
  onQueryChange?: (q: string) => void
}) {
  const { t } = useTranslation()
  const [q, setQState] = useState('')
  const setQ = (v: string) => {
    setQState(v)
    onQueryChange?.(v)
  }
  const dq = useDebounced(q, 180)
  // `data` keeps the previous hits while the next query loads
  const query = searchQuery(dq)
  const { data: page, isFetching } = useGetSearchQuery(
    query ? { query, type: kinds, locale: apiLocale(), profile: ['self'], page: 1, pagesize: 20 } : skipToken,
  )
  const data = page?.items
  // hits arrive after cmdk's own "select first item" ran: keep the first hit active so Enter picks it
  const [active, setActive] = useState('')
  const handles = (data ?? []).filter((hit) => hit.object_type in kindIcon).map((hit) => hit.handle)
  const activeValue = handles.includes(active) ? active : (handles[0] ?? '')
  return (
    <Command shouldFilter={false} value={activeValue} onValueChange={setActive}>
      <CommandInput value={q} onValueChange={setQ} placeholder={placeholder ?? t('actions.searchPlaceholder')} autoFocus={autoFocus} />
      <CommandList>
        {isFetching && !data && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {dq && !isFetching && data?.length === 0 && <CommandEmpty>{t('noResults')}</CommandEmpty>}
        {!!data?.length && dq && (
          <CommandGroup>
            {data.filter((hit) => hit.object_type in kindIcon).map((hit) => {
              const kind = hit.object_type as ObjectKind
              const Icon = kindIcon[kind]
              const d = describeObject(kind, hit.object)
              // places of the same name (three "Gainesville"s) only differ by what encloses them
              const parents = kind === 'place' ? ((hit.object.profile?.parent_places ?? []) as Array<{ name?: string }>).map((p) => p.name).filter(Boolean) : []
              const subtitle = parents.length ? [d.subtitle, parents.join(', ')].filter(Boolean).join(' · ') : d.subtitle
              return (
                <CommandItem
                  key={hit.handle}
                  value={hit.handle}
                  onSelect={() =>
                    onPick({ kind, handle: hit.handle, gramps_id: hit.object.gramps_id, object: hit.object, ...d })
                  }
                >
                  <Icon className="text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{d.title}</span>
                    {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{hit.object.gramps_id}</span>
                  {selected === hit.handle && <Check className="ml-1" />}
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}

/** Button + popover to pick one object; used by forms and "set home person". */
export function ObjectPicker({
  kinds,
  value,
  onChange,
  placeholder,
  className,
  trigger,
}: {
  kinds: ObjectKind[]
  value?: { handle: string; title: string } | null
  onChange: (o: PickedObject) => void
  placeholder?: string
  className?: string
  trigger?: ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <AdaptivePopover
      open={open}
      onOpenChange={setOpen}
      title={placeholder ?? t('actions.search')}
      size="tall"
      className="w-[min(26rem,calc(100vw-2rem))] p-0"
      trigger={
        trigger ?? (
          <Button variant="outline" role="combobox" className={cn('w-full justify-between font-normal', className)}>
            <span className={cn('truncate', !value && 'text-muted-foreground')}>{value?.title ?? placeholder}</span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        )
      }
    >
      <ObjectSearchList
        kinds={kinds}
        selected={value?.handle}
        placeholder={placeholder}
        autoFocus
        onPick={(o) => {
          onChange(o)
          setOpen(false)
        }}
      />
    </AdaptivePopover>
  )
}
