import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { Portrait, refThumbUrl } from '@/components/portrait'
import { TagList } from '@/components/tag-list'
import { Lightbox } from '@/components/detail/lightbox'
import { mediaFileUrl, mediaThumbUrl } from '@/lib/api'
import { useAccessToken } from '@/lib/auth'
import { isEmpty, profileName } from '@/lib/format'
import type { Media, MediaRef, PersonProfile, Tag } from '@/lib/types'
import { cn } from '@/lib/utils'
import { ShowMore, useLimited } from './shared'

/*
 * Building blocks for the "Album" object screens (visual direction A, see
 * docs/ui-conventions.md): a hero with a large visual next to a big serif title,
 * then panels in a narrow + wide two-column grid.
 */

export function AlbumFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
}

/** Narrow column (people, photos, details) + wide column (story, notes, sources). */
export function AlbumGrid({ aside, main }: { aside?: ReactNode; main: ReactNode }) {
  return (
    <div className="mt-10 grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:has-[>.album-aside:empty]:grid-cols-1">
      <div className="album-aside grid min-w-0 gap-6 empty:hidden [&>*]:min-w-0">{aside}</div>
      <div className="grid min-w-0 gap-6 [&>*]:min-w-0">{main}</div>
    </div>
  )
}

const visualSize = {
  /** like the person portrait */
  portrait:
    'h-[19rem] w-full sm:h-[26rem] sm:max-w-md lg:aspect-[4/5] lg:h-auto lg:w-[23rem] lg:max-w-none',
  /** maps and landscape photos */
  wide: 'h-[19rem] w-full sm:h-[24rem] lg:h-[27rem] lg:w-[36rem]',
  /** typographic covers (sources, citations, repositories) */
  cover: 'h-[13rem] w-[10rem] sm:h-[15rem] sm:w-[11.5rem] lg:h-[22rem] lg:w-[17rem]',
} as const

export type VisualSize = keyof typeof visualSize

/** Hero: large visual on the left (on top on phones), big serif title and meta on the right. */
export function ObjectHero({
  visual,
  size = 'portrait',
  visualClassName,
  eyebrow,
  title,
  titleClassName,
  subtitle,
  tags,
  children,
  actions,
}: {
  visual?: ReactNode
  size?: VisualSize
  visualClassName?: string
  eyebrow?: ReactNode
  title: ReactNode
  titleClassName?: string
  subtitle?: ReactNode
  tags?: Tag[]
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="flex flex-col gap-8 lg:flex-row lg:gap-12">
      {visual && (
        <div
          className={cn(
            'relative mx-auto shrink-0 overflow-hidden rounded-3xl bg-card max-lg:-mt-1 lg:mx-0',
            visualSize[size],
            visualClassName,
          )}
        >
          {visual}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pt-2">
        {eyebrow && <div className="max-lg:text-center">{eyebrow}</div>}
        <h1
          className={cn(
            'mt-3 font-serif text-[2.4rem] font-medium leading-[1.02] tracking-[-0.02em] text-balance [overflow-wrap:anywhere] max-lg:text-center sm:text-6xl lg:text-[4rem]',
            titleClassName,
          )}
        >
          {title}
        </h1>
        {subtitle && <div className="mt-3 font-serif text-xl italic text-muted-foreground max-lg:text-center">{subtitle}</div>}
        <TagList tags={tags} className="mt-3 max-lg:justify-center" />
        {children}
        {actions && <div className="mt-7">{actions}</div>}
      </div>
    </section>
  )
}

/** Action row under the hero; scrolls sideways on phones like the person page. */
export function HeroActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2 max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 max-sm:[scrollbar-width:none] max-sm:[&>*]:h-10 max-sm:[&>*]:shrink-0 max-sm:[&>*]:rounded-full max-sm:[&>*]:px-4">
      {children}
    </div>
  )
}

/** Labelled facts as quiet blocks (like Born / Died on the person page). */
export function HeroFacts({ items, className }: { items: Array<{ label: ReactNode; value: ReactNode; detail?: ReactNode } | false | null | undefined | ''>; className?: string }) {
  const shown = items.filter(Boolean) as Array<{ label: ReactNode; value: ReactNode; detail?: ReactNode }>
  if (!shown.length) return null
  return (
    <dl className={cn('mt-7 grid grid-cols-2 gap-6 sm:flex sm:flex-wrap sm:gap-x-12', className)}>
      {shown.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-sm text-muted-foreground">{it.label}</dt>
          <dd className="mt-1">
            <span className="block font-serif text-2xl leading-tight tabular-nums [overflow-wrap:anywhere]">{it.value}</span>
            {it.detail && <span className="block text-sm text-muted-foreground">{it.detail}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** First photo of an object as the hero visual; opens all photos in the lightbox. */
export function PhotoVisual({ refs, media, label }: { refs: MediaRef[]; media?: Media[]; label: string }) {
  const { t } = useTranslation('objects')
  useAccessToken()
  const [open, setOpen] = useState<number | null>(null)
  const byHandle = new Map((media ?? []).map((m) => [m.handle, m]))
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(0)}
        className="block size-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={label}
      >
        <img
          src={refThumbUrl(refs[0], 900, false)}
          alt=""
          className="size-full object-cover [filter:sepia(0.18)_contrast(1.04)] transition-transform duration-500 ease-out hover:scale-[1.02]"
        />
      </button>
      {refs.length > 1 && (
        <span className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur">
          {t('album.photos', { count: refs.length })}
        </span>
      )}
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

/** Typographic "cover" for objects without a picture: a framed plate with a big serif glyph. */
export function CoverVisual({ icon: Icon, glyph, label, sub }: { icon: LucideIcon; glyph?: string; label: string; sub?: string }) {
  return (
    <div className="flex size-full flex-col bg-gradient-to-b from-secondary to-card p-3">
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl px-4 text-center ring-1 ring-inset ring-brass/30">
        <Icon className="size-6 text-brass lg:size-7" aria-hidden />
        {glyph && <span className="font-serif text-6xl leading-none text-foreground/85 lg:text-8xl">{glyph}</span>}
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        {sub && <span className="text-xs tabular-nums text-muted-foreground/80">{sub}</span>}
      </div>
    </div>
  )
}

/** First letter worth showing on a cover (skips quotes and digits). */
export function glyphOf(s: string | undefined) {
  const m = s?.match(/\p{L}/u)
  return m ? m[0].toUpperCase() : undefined
}

/* ---------------- year timeline ---------------- */

export interface TimelineEntry {
  key: string
  year: number | null
  date: string
  title: ReactNode
  detail?: ReactNode
  to?: string
  /** main entries get the gold year and dot; secondary ones are quieter */
  own?: boolean
  who?: Partial<PersonProfile>
}

/** Chronological line with gold serif years (shared look with the person's life story). */
export function YearTimeline({
  entries,
  portraits,
  limit,
  empty,
}: {
  entries: TimelineEntry[]
  portraits?: Map<string, MediaRef | undefined>
  limit?: number
  empty?: ReactNode
}) {
  const { shown, hidden, all, setAll } = useLimited(entries, limit ?? entries.length)
  if (!entries.length) return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null
  return (
    <>
      <ol className="relative">
        <span aria-hidden className="absolute bottom-3 left-[4.6rem] top-3 w-0.5 rounded-full bg-lineage/70 sm:left-[5.6rem]" />
        {shown.map((e, i) => {
          const own = e.own ?? true
          const showYear = e.year != null ? shown[i - 1]?.year !== e.year : shown[i - 1] == null || shown[i - 1].year != null
          const content = (
            <>
              <span
                className={cn(
                  'w-16 shrink-0 pt-0.5 text-right font-serif tabular-nums sm:w-20',
                  own ? 'text-2xl leading-none text-brass' : 'text-base text-muted-foreground',
                  !showYear && 'invisible',
                )}
              >
                {e.year ?? '—'}
              </span>
              <span
                aria-hidden
                className={cn(
                  'relative z-10 mt-1.5 shrink-0 rounded-full ring-4 ring-card',
                  own ? 'size-3 bg-primary' : 'ml-0.5 size-2 bg-muted-foreground/50',
                )}
              />
              <span className="flex min-w-0 flex-1 items-start gap-3">
                {e.who && !isEmpty(e.who) && (
                  <Portrait mediaRef={portraits?.get(e.who.handle ?? '')} name={profileName(e.who)} sex={e.who.sex} size={own ? 36 : 28} />
                )}
                <span className="min-w-0">
                  <span className={cn('block [overflow-wrap:anywhere]', own ? 'text-[15px] font-semibold' : 'text-sm')}>{e.title}</span>
                  {(e.date || e.detail) && (
                    <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {[e.date && e.date !== String(e.year) ? e.date : '', e.detail].filter(Boolean).map((x, j) => (
                        <span key={j}>
                          {j > 0 && ' · '}
                          {x}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </span>
            </>
          )
          return (
            <li key={e.key}>
              {e.to ? (
                <Link to={e.to} className="-mx-2 flex gap-4 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-accent/70 sm:gap-5">
                  {content}
                </Link>
              ) : (
                <div className="flex gap-4 py-2.5 sm:gap-5">{content}</div>
              )}
            </li>
          )
        })}
      </ol>
      <ShowMore hidden={hidden} all={all} onToggle={() => setAll(!all)} />
    </>
  )
}
