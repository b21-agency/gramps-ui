import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { Skeleton } from '@/components/ui/skeleton'
import { NoteHtml } from '@/components/note-html'
import { Lightbox } from './lightbox'
import { refThumbUrl } from '@/components/portrait'
import { mediaFileUrl, mediaThumbUrl } from '@/lib/api'
import { useGetObjectsByHandlesQuery } from '@/api/enhanced/objects'
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
    <section id={id} className={cn('scroll-mt-32', className)}>
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
              className="group overflow-hidden rounded-lg border bg-muted text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-reduce:active:scale-100"
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
      <Lightbox
        items={refs.map((r, i) => {
          const m = byHandle.get(r.ref)
          return {
            key: `${r.ref}-${i}`,
            src: mediaThumbUrl(r.ref, 1600),
            alt: m?.desc ?? '',
            caption: m?.desc,
            href: m ? `/media/${m.gramps_id}` : undefined,
            hrefLabel: m?.gramps_id,
            original: mediaFileUrl(r.ref),
          }
        })}
        index={open}
        onIndexChange={setOpen}
        onClose={() => setOpen(null)}
      />
    </>
  )
}

/* ---------------- notes ---------------- */

const noteFormatOptions = JSON.stringify({ link_format: '/{obj_class}/{gramps_id}' })

export function useNotesHtml(handles: string[] | undefined) {
  const r = useGetObjectsByHandlesQuery(
    handles?.length
      ? { kind: 'note', handles, query: { formats: 'html', format_options: noteFormatOptions, locale: apiLocale() } }
      : skipToken,
  )
  return { ...r, data: r.data as Note[] | undefined }
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
        <article key={n.handle} className="min-w-0 overflow-x-auto rounded-lg border bg-card p-4 [overflow-wrap:anywhere]">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{typeStr(n.type)}</span>
            <Link to={`/note/${n.gramps_id}`} className="-my-2 ml-auto inline-flex min-h-11 items-center px-2 tabular-nums hover:text-foreground">
              {n.gramps_id}
            </Link>
          </div>
          <CollapsibleNote long={n.text.string.length > 700 || n.text.string.split('\n').length > 14}>
            <NoteHtml
              html={n.formatted?.html}
              text={n.text.string}
              className={cn('font-serif text-[1.02rem] leading-relaxed', n.format === 1 && 'whitespace-pre-wrap font-mono text-sm')}
            />
          </CollapsibleNote>
        </article>
      ))}
    </div>
  )
}

/** Long notes start collapsed (fade + "Show more") so one note can't stretch a whole row of cards. */
function CollapsibleNote({ long, children }: { long: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!long) return <>{children}</>
  return (
    <div>
      <div className={cn('relative', !open && 'max-h-64 overflow-hidden')}>
        {children}
        {!open && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />}
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 min-h-11 text-sm font-medium text-primary hover:underline">
        {open ? t('actions.showLess') : t('actions.showAll')}
      </button>
    </div>
  )
}

/* ---------------- citations ---------------- */

const confidenceKeys = ['veryLow', 'low', 'normal', 'high', 'veryHigh'] as const

export function CitationsList({ handles }: { handles: string[] }) {
  const { t } = useTranslation('detail')
  const r = useGetObjectsByHandlesQuery(
    handles.length ? { kind: 'citation', handles, query: { profile: 'self', locale: apiLocale() } } : skipToken,
  )
  const { isLoading } = r
  const data = r.data as Citation[] | undefined
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
  addressDates,
}: {
  attributes?: Attribute[]
  urls?: Url[]
  addresses?: Address[]
  /** formatted dates of the addresses (same order), e.g. from profile.addresses[].date_str */
  addressDates?: string[]
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
  addresses?.forEach((a, i) =>
    rows.push([
      t('address'),
      [a.street, a.locality, [a.postal, a.city].filter(Boolean).join(' '), a.county, a.state, a.country, a.phone]
        .filter(Boolean)
        .join(', ') + (addressDates?.[i] ? ` (${addressDates[i]})` : ''),
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
  const active = useActiveSection(items.map((i) => i.id))
  const nav = useRef<HTMLElement>(null)
  // keep the highlighted tab visible in the sideways-scrolling bar
  useEffect(() => {
    const el = nav.current?.querySelector<HTMLElement>(`[data-id="${active}"]`)
    const box = nav.current
    if (!el || !box) return
    const l = el.offsetLeft - 16
    const r = el.offsetLeft + el.offsetWidth + 16
    if (l < box.scrollLeft || r > box.scrollLeft + box.clientWidth) box.scrollTo({ left: Math.max(0, l), behavior: reducedMotion() ? 'auto' : 'smooth' })
  }, [active])
  if (items.length < 2) return null
  return (
    <nav
      ref={nav}
      className="sticky top-[var(--header-h)] z-20 -mx-4 mb-8 overflow-x-auto border-b bg-background/90 px-4 backdrop-blur [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex gap-1 py-1.5">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              data-id={i.id}
              aria-current={active === i.id ? 'location' : undefined}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(i.id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
                history.replaceState(null, '', `#${i.id}`)
              }}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent max-md:min-h-10 max-md:rounded-full max-md:px-3.5',
                active === i.id && 'bg-accent text-foreground',
              )}
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

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Id of the section whose top most recently passed under the sticky bars. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(',')
  useEffect(() => {
    const list = key.split(',').filter(Boolean)
    if (list.length < 2) return
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const line = 140
        // the section whose top is closest above the line (DOM order differs from nav order on phones)
        let current: string | null = null
        let best = -Infinity
        let lowest: string | null = null
        let lowestTop = -Infinity
        for (const id of list) {
          const top = document.getElementById(id)?.getBoundingClientRect().top
          if (top == null) continue
          if (top <= line && top > best) {
            best = top
            current = id
          }
          if (top > lowestTop) {
            lowestTop = top
            lowest = id
          }
        }
        // at the very bottom the last section on screen wins even if it is short
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = lowest
        setActive(current)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [key])
  return active
}
