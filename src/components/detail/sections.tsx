import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { NoteHtml } from '@/components/note-html'
import { refThumbUrl } from '@/components/portrait'
import { api, mediaFileUrl, mediaThumbUrl } from '@/lib/api'
import { useAccessToken } from '@/lib/auth'
import { apiLocale } from '@/i18n'
import { describeObject, kindIcon, normalizeKind, objectPath } from '@/lib/objects'
import { typeStr } from '@/lib/format'
import type { Address, Attribute, Citation, EventProfile, GEvent, Media, MediaRef, Note, Url } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A titled block on an object page. `id` doubles as the in-page anchor. */
export function DetailSection({
  id,
  title,
  count,
  action,
  children,
  className,
}: {
  id?: string
  title: ReactNode
  count?: number
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('scroll-mt-20', className)}>
      <div className="mb-3 flex items-baseline gap-2 border-b pb-2">
        <h2 className="text-xl font-medium">{title}</h2>
        {count != null && <span className="text-sm tabular-nums text-muted-foreground">{count}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/* ---------------- events ---------------- */

export interface EventRow {
  event?: GEvent
  profile: EventProfile
}

/** Event table: date, what, where. Rows link to the event page. */
export function EventsTable({ rows, showRole = true, showAge = false }: { rows: EventRow[]; showRole?: boolean; showAge?: boolean }) {
  return (
    <ol className="divide-y">
      {rows.map(({ event, profile }, i) => {
        const inner = (
          <>
            <span className="w-28 shrink-0 text-sm tabular-nums text-muted-foreground sm:w-36">{profile.date || '—'}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {profile.type}
                {showRole && profile.role && !/^(primary|primär|family|familie)$/i.test(profile.role) && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({profile.role})</span>
                )}
              </span>
              {(profile.place || event?.description) && (
                <span className="block truncate text-sm text-muted-foreground">
                  {[profile.place, event?.description].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            {showAge && profile.age && !/^0 /.test(profile.age) && (
              <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">{profile.age}</span>
            )}
          </>
        )
        return (
          <li key={event?.handle ?? i}>
            {event ? (
              <Link to={`/event/${event.gramps_id}`} className="-mx-2 flex items-baseline gap-4 rounded-md px-2 py-2.5 hover:bg-accent">
                {inner}
              </Link>
            ) : (
              <div className="flex items-baseline gap-4 py-2.5">{inner}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------- gallery ---------------- */

export function Gallery({ refs, media }: { refs: MediaRef[]; media?: Media[] }) {
  useAccessToken()
  const [open, setOpen] = useState<number | null>(null)
  const byHandle = new Map((media ?? []).map((m) => [m.handle, m]))
  const current = open != null ? refs[open] : null
  const currentMedia = current ? byHandle.get(current.ref) : undefined
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
        {refs.map((r, i) => {
          const m = byHandle.get(r.ref)
          return (
            <button
              key={`${r.ref}-${i}`}
              type="button"
              onClick={() => setOpen(i)}
              className="group overflow-hidden rounded-lg border bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={refThumbUrl(r, 400)}
                alt={m?.desc ?? ''}
                loading="lazy"
                className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              {m?.desc && <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">{m.desc}</span>}
            </button>
          )
        })}
      </div>
      <Dialog open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-[min(64rem,calc(100vw-2rem))] gap-3 p-3 sm:max-w-[min(64rem,calc(100vw-2rem))]">
          <DialogTitle className="sr-only">{currentMedia?.desc ?? 'Media'}</DialogTitle>
          {current && (
            <>
              <img
                src={mediaThumbUrl(current.ref, 1600)}
                alt={currentMedia?.desc ?? ''}
                className="max-h-[75vh] w-full rounded-md bg-muted object-contain"
              />
              <div className="flex items-center gap-3 px-1 text-sm">
                <span className="min-w-0 flex-1 truncate">{currentMedia?.desc}</span>
                {currentMedia && (
                  <Link to={`/media/${currentMedia.gramps_id}`} className="text-primary hover:underline">
                    {currentMedia.gramps_id}
                  </Link>
                )}
                <a href={mediaFileUrl(current.ref)} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-4" />
                </a>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ---------------- notes ---------------- */

const noteFormatOptions = JSON.stringify({ link_format: '/{obj_class}/{gramps_id}' })

export function useNotesHtml(handles: string[] | undefined) {
  return useQuery({
    queryKey: ['notes', 'html', handles],
    enabled: !!handles?.length,
    queryFn: () =>
      api<Note[]>('/notes/', {
        query: { handles: handles!.join(','), formats: 'html', format_options: noteFormatOptions, locale: apiLocale() },
      }),
  })
}

export function NotesList({ handles }: { handles: string[] }) {
  const { data, isLoading } = useNotesHtml(handles)
  if (isLoading) return <Skeleton className="h-24" />
  // keep the object's note order
  const order = new Map(handles.map((h, i) => [h, i]))
  const notes = [...(data ?? [])].sort((a, b) => (order.get(a.handle) ?? 0) - (order.get(b.handle) ?? 0))
  return (
    <div className="space-y-4">
      {notes.map((n) => (
        <article key={n.handle} className="rounded-lg border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{typeStr(n.type)}</span>
            <Link to={`/note/${n.gramps_id}`} className="ml-auto tabular-nums hover:text-foreground">
              {n.gramps_id}
            </Link>
          </div>
          <NoteHtml
            html={n.formatted?.html}
            text={n.text.string}
            className={cn('font-serif text-[1.02rem] leading-relaxed', n.format === 1 && 'whitespace-pre font-mono text-sm')}
          />
        </article>
      ))}
    </div>
  )
}

/* ---------------- citations ---------------- */

const confidenceKeys = ['veryLow', 'low', 'normal', 'high', 'veryHigh'] as const

export function CitationsList({ handles }: { handles: string[] }) {
  const { t } = useTranslation('detail')
  const { data, isLoading } = useQuery({
    queryKey: ['citations', 'handles', handles, apiLocale()],
    enabled: handles.length > 0,
    queryFn: () => api<Citation[]>('/citations/', { query: { handles: handles.join(','), profile: 'self', locale: apiLocale() } }),
  })
  if (isLoading) return <Skeleton className="h-16" />
  return (
    <ul className="divide-y">
      {(data ?? []).map((c) => (
        <li key={c.handle}>
          <Link to={`/citation/${c.gramps_id}`} className="-mx-2 flex items-baseline gap-3 rounded-md px-2 py-2.5 hover:bg-accent">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{c.profile?.source?.title ?? c.gramps_id}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {[c.page, c.profile?.date].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{t(`confidence.${confidenceKeys[c.confidence] ?? 'normal'}`)}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/* ---------------- attributes / urls / addresses ---------------- */

/** Only http(s)/mailto links are rendered as anchors (no javascript: etc.). */
export function safeHref(p: string) {
  try {
    const u = new URL(p, window.location.origin)
    return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : null
  } catch {
    return null
  }
}

export function FactsTable({
  attributes,
  urls,
  addresses,
}: {
  attributes?: Attribute[]
  urls?: Url[]
  addresses?: Address[]
}) {
  const { t } = useTranslation('detail')
  const rows: Array<[string, ReactNode]> = []
  attributes?.forEach((a) => rows.push([typeStr(a.type), a.value]))
  urls?.forEach((u) => {
    const href = safeHref(u.path)
    rows.push([
      u.desc || typeStr(u.type) || t('link'),
      href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
          {u.path}
        </a>
      ) : (
        <span className="break-all">{u.path}</span>
      ),
    ])
  })
  addresses?.forEach((a) =>
    rows.push([
      t('address'),
      [a.street, a.locality, [a.postal, a.city].filter(Boolean).join(' '), a.county, a.state, a.country, a.phone]
        .filter(Boolean)
        .join(', '),
    ]),
  )
  if (!rows.length) return null
  return (
    <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-2 text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ---------------- references (backlinks) ---------------- */

/** Objects that point to this one, from `extended.backlinks` (needs extend=all&backlinks=true). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ReferencesList({ backlinks }: { backlinks?: Record<string, any[]> }) {
  const { t } = useTranslation()
  const groups = Object.entries(backlinks ?? {}).filter(([, list]) => list?.length)
  if (!groups.length) return null
  return (
    <div className="space-y-4">
      {groups.map(([cls, list]) => {
        const kind = normalizeKind(cls)
        if (!kind) return null
        const Icon = kindIcon[kind]
        return (
          <div key={cls}>
            <h3 className="mb-1 text-sm text-muted-foreground">{t(`objects.${kind}`)}</h3>
            <ul>
              {list.map((o) => {
                const d = describeObject(kind, o)
                return (
                  <li key={o.handle}>
                    <Link to={objectPath(kind, o.gramps_id)} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{o.gramps_id}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- in-page section nav ---------------- */

export function SectionNav({ items }: { items: Array<{ id: string; label: string; count?: number }> }) {
  if (items.length < 2) return null
  return (
    <nav className="sticky top-14 z-20 -mx-4 mb-8 overflow-x-auto border-b bg-background/90 px-4 backdrop-blur sm:-mx-6 sm:px-6">
      <ul className="flex gap-1 py-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(i.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                history.replaceState(null, '', `#${i.id}`)
              }}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {i.label}
              {i.count != null && <span className="text-xs tabular-nums opacity-70">{i.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
