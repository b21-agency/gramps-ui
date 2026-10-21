import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PersonChip } from '@/components/person-chip'
import { refThumbUrl } from '@/components/portrait'
import { useAccessToken } from '@/lib/auth'
import { useObjectById } from '@/lib/queries'
import { useRecordVisit } from '@/lib/prefs'
import { describeObject, kindIcon, normalizeKind, objectPath } from '@/lib/objects'
import { displayName, isEmpty, lifespan, profileName } from '@/lib/format'
import type { EventProfile, FamilyProfile, MediaRef, ObjectKind, PersonProfile } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { cn } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyObj = Record<string, any>

export const fullQuery = { profile: 'all', extend: 'all', backlinks: true } as const

/** Fetch an object page by Gramps ID, set the tab title and record the visit. */
export function useObjectPage<T extends { handle: string; gramps_id: string }>(
  kind: ObjectKind,
  id: string | undefined,
  titleOf: (o: T) => string,
  extra: Record<string, string | number | boolean> = {},
) {
  const q = useObjectById<T>(kind, id, { ...fullQuery, ...extra })
  const title = q.data ? titleOf(q.data) : ''
  useTitle(title || id)
  useRecordVisit(q.data ? { kind, handle: q.data.handle, gramps_id: q.data.gramps_id, title } : null)
  return { q, title }
}

export function PageFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>
}

/** Main + aside columns, same proportions as the person page. */
export function Columns({ main, aside }: { main: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-10">{main}</div>
      <aside className="min-w-0 space-y-10">{aside}</aside>
    </div>
  )
}

export function ObjectSkeleton({ media = false }: { media?: boolean }) {
  return (
    <PageFrame>
      <Skeleton className="mb-6 h-5 w-40" />
      {media ? <Skeleton className="mb-6 h-[50vh] w-full" /> : null}
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="mt-3 h-5 w-1/3" />
      <Skeleton className="mt-10 h-56 w-full" />
    </PageFrame>
  )
}

export type NavItem = { id: string; label: string; count?: number }
/** Drop falsy entries so nav lists can be written with `cond && {...}`. */
export function navItems(list: Array<NavItem | false | null | undefined | 0 | ''>): NavItem[] {
  return list.filter(Boolean) as NavItem[]
}

/** Definition list for a handful of labelled facts; empty values are skipped. */
export function MetaList({ rows, className }: { rows: Array<[ReactNode, ReactNode]>; className?: string }) {
  const visible = rows.filter(([, v]) => v !== '' && v != null && v !== false)
  if (!visible.length) return null
  return (
    <dl className={cn('grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-6 gap-y-2 text-sm', className)}>
      {visible.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Shows the first `limit` children, then a "Show all" toggle. */
export function useLimited<T>(items: T[], limit: number) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, limit)
  return { shown, hidden: items.length - shown.length, all, setAll }
}

export function ShowMore({ hidden, all, onToggle }: { hidden: number; all: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  if (!hidden && !all) return null
  return (
    <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={onToggle}>
      {all ? t('actions.showLess') : `${t('actions.showAll')} (+${hidden})`}
    </Button>
  )
}

/* ---------------- titles ---------------- */

const primaryRole = /^(primary|primär|family|familie)$/i

export function familyTitle(p: Partial<FamilyProfile> | undefined, unknown: string) {
  if (!p) return ''
  const f = profileName(p.father as PersonProfile)
  const m = profileName(p.mother as PersonProfile)
  if (!f && !m) return unknown
  return [f || unknown, m || unknown].join(' & ')
}

/** "Birth of Anna Muster": event type + its main participants. */
export function eventTitle(
  t: (k: string, o?: AnyObj) => string,
  profile: AnyObj | undefined,
  fallback: string,
): string {
  if (!profile) return fallback
  const people: Array<{ role: string; person: PersonProfile }> = profile.participants?.people ?? []
  const families: Array<{ role: string; family: FamilyProfile }> = profile.participants?.families ?? []
  const main = people.filter((p) => primaryRole.test(p.role))
  const names = [
    ...(main.length ? main : people.slice(0, 2)).map((p) => profileName(p.person)),
    ...families.filter((f) => primaryRole.test(f.role)).map((f) => familyTitle(f.family, '…')),
  ].filter(Boolean)
  const type = profile.type || fallback
  if (names.length) return t('objects:eventOf', { type, names: names.join(t('objects:and')) })
  // summary is "Type - Names"; use it when no participants were resolved
  if (profile.summary && profile.summary.includes(' - ')) {
    const rest = profile.summary.split(' - ').slice(1).join(' - ')
    return t('objects:eventOf', { type, names: rest })
  }
  return type
}

/** Names part of an event summary ("Death - Garner, Lewis" -> "Garner, Lewis"). */
export function summaryNames(summary?: string) {
  if (!summary || !summary.includes(' - ')) return ''
  return summary.split(' - ').slice(1).join(' - ')
}

/* ---------------- rich references (backlinks) ---------------- */

export interface RefItem {
  kind: ObjectKind
  raw: AnyObj
  profile?: AnyObj
}

/**
 * Pair `extended.backlinks` (raw objects with gramps_id) with `profile.references`
 * (localized profiles). The API builds both from the same backlink iteration, so the
 * order matches; when the lengths differ the profile is dropped.
 */
export function referenceItems(
  backlinks: Record<string, AnyObj[]> | undefined,
  references: Record<string, AnyObj[]> | undefined,
  exclude: string[] = [],
): Array<[ObjectKind, RefItem[]]> {
  const out: Array<[ObjectKind, RefItem[]]> = []
  const order: ObjectKind[] = ['person', 'family', 'event', 'place', 'source', 'citation', 'repository', 'media', 'note']
  const groups = new Map<ObjectKind, RefItem[]>()
  for (const [cls, list] of Object.entries(backlinks ?? {})) {
    const kind = normalizeKind(cls)
    if (!kind || exclude.includes(kind) || !list?.length) continue
    const profs = references?.[cls]
    const aligned = profs && profs.length === list.length
    groups.set(
      kind,
      list.map((raw, i) => ({ kind, raw, profile: aligned ? profs[i] : raw.profile })),
    )
  }
  for (const k of order) if (groups.has(k)) out.push([k, groups.get(k)!])
  return out
}

export function refTitle(item: RefItem, t: (k: string, o?: AnyObj) => string): { title: string; subtitle: string } {
  const { kind, raw, profile } = item
  switch (kind) {
    case 'person': {
      const name = profile ? profileName(profile) : displayName(raw.primary_name)
      return { title: name || raw.gramps_id, subtitle: profile ? lifespan(profile.birth, profile.death) : '' }
    }
    case 'family': {
      if (profile) {
        const m = profile.marriage as EventProfile | undefined
        return {
          title: familyTitle(profile, t('unknown')),
          subtitle: [profile.relationship, m && !isEmpty(m) && m.date ? `⚭ ${m.date}` : ''].filter(Boolean).join(' · '),
        }
      }
      return describeObject('family', raw)
    }
    case 'event': {
      if (profile) {
        const names = summaryNames(profile.summary)
        return {
          title: [profile.type, names].filter(Boolean).join(' · ') || raw.gramps_id,
          subtitle: [profile.date, profile.place_name || profile.place].filter(Boolean).join(' · '),
        }
      }
      return describeObject('event', raw)
    }
    case 'place':
      return {
        title: profile?.name || raw.name?.value || raw.title || raw.gramps_id,
        subtitle: profile?.type || (typeof raw.place_type === 'string' ? raw.place_type : raw.place_type?.string) || '',
      }
    case 'citation':
      return {
        title: raw.page || profile?.source?.title || raw.gramps_id,
        subtitle: [profile?.source?.title, profile?.date].filter(Boolean).join(' · '),
      }
    default:
      return describeObject(kind, { ...raw, profile })
  }
}

/** One linked row for any referencing object. Persons get a portrait chip. */
export function RefRow({
  item,
  note,
  thumb,
  active,
  onHover,
}: {
  item: RefItem
  note?: string
  thumb?: Pick<MediaRef, 'ref' | 'rect'> | null
  active?: boolean
  onHover?: (on: boolean) => void
}) {
  const { t } = useTranslation()
  useAccessToken()
  const hover = onHover
    ? { onMouseEnter: () => onHover(true), onMouseLeave: () => onHover(false), onFocus: () => onHover(true), onBlur: () => onHover(false) }
    : {}
  if (item.kind === 'person' && !thumb) {
    const p = item.profile ?? {
      handle: item.raw.handle,
      gramps_id: item.raw.gramps_id,
      name_given: displayName(item.raw.primary_name),
      sex: '',
    }
    return (
      <div {...hover}>
        <PersonChip person={p} mediaRef={item.raw.media_list?.[0]} note={note} className={cn('-mx-2', active && 'bg-accent')} />
      </div>
    )
  }
  const { title, subtitle } = refTitle(item, t)
  const Icon = kindIcon[item.kind]
  return (
    <Link
      to={objectPath(item.kind, item.raw.gramps_id)}
      {...hover}
      className={cn(
        '-mx-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-accent focus-visible:bg-accent',
        active && 'bg-accent',
      )}
    >
      {thumb ? (
        <img src={refThumbUrl(thumb, 96)} alt="" loading="lazy" className="size-10 shrink-0 rounded-md bg-muted object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
          <Icon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-tight">{title}</span>
        {(subtitle || note) && (
          <span className="block truncate text-xs tabular-nums text-muted-foreground">
            {[subtitle, note].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">{item.raw.gramps_id}</span>
    </Link>
  )
}

function RefGroup({ kind, items, limit, showHeading }: { kind: ObjectKind; items: RefItem[]; limit: number; showHeading: boolean }) {
  const { t } = useTranslation()
  const { shown, hidden, all, setAll } = useLimited(items, limit)
  return (
    <div>
      {showHeading && (
        <h3 className="mb-1 text-sm text-muted-foreground">
          {t(`objects.${kind}`)} <span className="tabular-nums opacity-70">{items.length}</span>
        </h3>
      )}
      <ul>
        {shown.map((it) => (
          <li key={it.raw.handle}>
            <RefRow item={it} />
          </li>
        ))}
      </ul>
      <ShowMore hidden={hidden} all={all} onToggle={() => setAll(!all)} />
    </div>
  )
}

/** Grouped "Referenced by" list with names, dates and portraits. */
export function RichReferences({
  groups,
  limit = 8,
}: {
  groups: Array<[ObjectKind, RefItem[]]>
  limit?: number
}) {
  if (!groups.length) return null
  return (
    <div className="space-y-5">
      {groups.map(([kind, items]) => (
        <RefGroup key={kind} kind={kind} items={items} limit={limit} showHeading={groups.length > 1 || kind !== 'person'} />
      ))}
    </div>
  )
}

export function countRefs(groups: Array<[ObjectKind, RefItem[]]>) {
  return groups.reduce((n, [, l]) => n + l.length, 0)
}

/* ---------------- confidence ---------------- */

const confidenceKeys = ['veryLow', 'low', 'normal', 'high', 'veryHigh'] as const

/** Five-step meter for Gramps citation confidence (0 very low … 4 very high). */
export function ConfidenceMeter({ value, className, compact }: { value: number; className?: string; compact?: boolean }) {
  const { t } = useTranslation('detail')
  const v = Math.max(0, Math.min(4, value ?? 2))
  const label = t(`confidence.${confidenceKeys[v]}`)
  return (
    <span className={cn('inline-flex items-center gap-2', className)} title={label}>
      <span className="flex items-end gap-0.5" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={v} aria-label={label}>
        {confidenceKeys.map((_, i) => (
          <span
            key={i}
            className={cn('w-1.5 rounded-sm', i <= v ? 'bg-primary' : 'bg-border')}
            style={{ height: compact ? 6 + i * 2 : 8 + i * 3 }}
          />
        ))}
      </span>
      <span className={cn(compact ? 'text-xs text-muted-foreground' : 'text-sm')}>{label}</span>
    </span>
  )
}

/* ---------------- media refs on objects ---------------- */

/** Every MediaRef inside `obj.media_list` that points to `mediaHandle`. */
export function refsTo(obj: AnyObj, mediaHandle: string): MediaRef[] {
  return ((obj.media_list ?? []) as MediaRef[]).filter((m) => m.ref === mediaHandle)
}

export function validRect(rect: MediaRef['rect'] | undefined): rect is [number, number, number, number] {
  if (!rect || rect.length !== 4) return false
  const [x1, y1, x2, y2] = rect
  return x2 > x1 && y2 > y1 && !(x1 === 0 && y1 === 0 && x2 === 100 && y2 === 100) && rect.every((n) => n >= 0 && n <= 100)
}
