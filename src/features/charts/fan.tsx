// Radial ancestor fan. Geometry is computed once as plain data so the same numbers drive the
// on-screen SVG and the downloadable export.
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { refThumbUrl } from '@/components/portrait'
import { useAccessToken } from '@/lib/auth'
import { initials } from '@/lib/format'
import { parentsOf, type FanColour, type GPerson, type Graph } from './graph'
import type { Bounds } from './layout'
import { yearsText, type CardHandlers } from './person-card'

export const FAN_R0 = 78
const SPAN = 240
const TANGENTIAL_RING = 72
const RADIAL_RING = 122

export interface FanText {
  text: string
  size: number
  weight: number
  dy: number
  muted?: boolean
}

export interface FanSegment {
  key: string
  gen: number
  /** null = unknown ancestor placeholder */
  person: GPerson | null
  d: string
  /** CSS colour of the segment (tokens + color-mix, resolved for the export) */
  fill: string
  cx: number
  cy: number
  transform: string
  lines: FanText[]
}

/** Key of a data colour mode: a colour scale (numbers) or a list of swatches. */
export type FanLegend =
  | { kind: 'scale'; min: number; max: number; lo: string; hi: string }
  | { kind: 'items'; items: Array<{ label: string; fill: string }> }

export interface FanGeometry {
  segments: FanSegment[]
  centre: GPerson
  radius: number
  bounds: Bounds
  legend: FanLegend | null
}

const rad = (a: number) => (a * Math.PI) / 180
const polar = (r: number, a: number): [number, number] => [r * Math.sin(rad(a)), -r * Math.cos(rad(a))]
const f = (n: number) => Math.round(n * 100) / 100

function sector(r0: number, r1: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0
  const [x0, y0] = polar(r1, a0)
  const [x1, y1] = polar(r1, a1)
  const [x2, y2] = polar(r0, a1)
  const [x3, y3] = polar(r0, a0)
  return `M${f(x0)},${f(y0)}A${r1},${r1} 0 ${large} 1 ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${r0},${r0} 0 ${large} 0 ${f(x3)},${f(y3)}Z`
}

export function ringRadii(gens: number) {
  const radii = [0, FAN_R0]
  for (let g = 1; g < gens; g++) radii.push(radii[g] + (g <= 3 ? TANGENTIAL_RING : RADIAL_RING))
  return radii
}

function clip(s: string, maxChars: number) {
  if (s.length <= maxChars) return s
  return s.slice(0, Math.max(1, maxChars - 1)).trimEnd() + '…'
}

const charW = (size: number) => size * 0.52

// family line colours (Album palette: moss for the father's side, gold for the mother's):
// father's father, father's mother, mother's father, mother's mother
const LINE = [
  'var(--chart-1)',
  'color-mix(in oklab, var(--chart-1) 45%, var(--chart-3))',
  'var(--chart-2)',
  'color-mix(in oklab, var(--chart-2) 65%, var(--destructive))',
]
const GEN = [
  'var(--chart-2)',
  'var(--chart-1)',
  'color-mix(in oklab, var(--chart-2) 50%, var(--chart-1))',
  'var(--chart-5)',
  'color-mix(in oklab, var(--chart-2) 65%, var(--destructive))',
]

const tint = (c: string, mix: number) => `color-mix(in oklab, ${c} ${mix}%, var(--card))`
const NO_VALUE = 'var(--muted)'
/** moss -> gold scale for a share 0..1 */
const scale = (v: number) => tint(`color-mix(in oklab, var(--chart-2) ${Math.round(v * 100)}%, var(--chart-1))`, Math.round(22 + v * 55))
const CATEGORY = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--destructive)',
  'var(--chart-5)',
  'color-mix(in oklab, var(--chart-1) 50%, var(--chart-3))',
  'color-mix(in oklab, var(--chart-2) 50%, var(--destructive))',
  'color-mix(in oklab, var(--chart-4) 50%, var(--chart-3))',
].map((c) => tint(c, 40))
const OTHER = tint('var(--muted-foreground)', 30)
/** counts 1..8+ (0 = no value) */
const count = (n: number) => (n ? scale(Math.min(n, 8) / 8) : NO_VALUE)

type Value = number | string | null
function valueOf(mode: FanColour, p: GPerson): Value {
  switch (mode) {
    case 'nEvents':
      return p.nEvents
    case 'nNotes':
      return p.nNotes
    case 'birthYear':
      return p.birth
    case 'deathYear':
      return p.death
    case 'age':
      return p.age
    case 'surname':
      return p.surname || null
    case 'religion':
      return p.religion
    default:
      return null
  }
}

/** Fill of every person segment for a data colour mode, and its legend. */
function dataColours(
  mode: FanColour,
  segs: Array<{ seg: FanSegment; angle: number }>,
  t: TFunction,
): FanLegend | null {
  const people = segs.filter((s) => s.seg.person)
  if (mode === 'nEvents' || mode === 'nNotes' || mode === 'nPaths') {
    const paths = new Map<string, number>()
    for (const { seg } of people) paths.set(seg.person!.handle, (paths.get(seg.person!.handle) ?? 0) + 1)
    for (const { seg } of people) {
      const n = mode === 'nPaths' ? paths.get(seg.person!.handle)! : (valueOf(mode, seg.person!) as number)
      seg.fill = count(n)
    }
    return {
      kind: 'items',
      items: [
        { label: '0', fill: NO_VALUE },
        ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ label: String(n), fill: count(n) })),
        { label: '≥ 8', fill: count(8) },
      ].slice(mode === 'nPaths' ? 1 : 0),
    }
  }
  if (mode === 'birthYear' || mode === 'deathYear' || mode === 'age') {
    const vals = people.map(({ seg }) => valueOf(mode, seg.person!) as number | null).filter((v): v is number => v != null)
    if (!vals.length) {
      people.forEach(({ seg }) => (seg.fill = NO_VALUE))
      return { kind: 'items', items: [{ label: t('colour.noValue'), fill: NO_VALUE }] }
    }
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    for (const { seg } of people) {
      const v = valueOf(mode, seg.person!) as number | null
      seg.fill = v == null ? NO_VALUE : scale(max === min ? 0.5 : (v - min) / (max - min))
    }
    return { kind: 'scale', min: Math.round(min), max: Math.round(max), lo: scale(0), hi: scale(1) }
  }
  // categories, largest share of the fan first
  const share = new Map<string, number>()
  for (const { seg, angle } of people) {
    const v = valueOf(mode, seg.person!) as string | null
    if (v) share.set(v, (share.get(v) ?? 0) + angle)
  }
  const cats = [...share.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  for (const { seg } of people) {
    const v = valueOf(mode, seg.person!) as string | null
    const i = v ? cats.indexOf(v) : -1
    seg.fill = !v ? NO_VALUE : i < CATEGORY.length ? CATEGORY[i] : OTHER
  }
  const items = cats.slice(0, CATEGORY.length).map((c, i) => ({ label: c, fill: CATEGORY[i] }))
  if (cats.length > CATEGORY.length) items.push({ label: t('colour.other'), fill: OTHER })
  if (!items.length) items.push({ label: t('colour.noValue'), fill: NO_VALUE })
  return { kind: 'items', items }
}

export function fanGeometry(
  g: Graph,
  centre: string,
  gens: number,
  colour: FanColour,
  t: TFunction,
  surnameFirst = false,
): FanGeometry | null {
  const cp = g.people.get(centre)
  if (!cp) return null
  const radii = ringRadii(gens)
  const segments: FanSegment[] = []
  const angles: Array<{ seg: FanSegment; angle: number }> = []
  let prev: Array<GPerson | null> = [cp]
  for (let gen = 1; gen < gens; gen++) {
    const cur: Array<GPerson | null> = []
    for (const child of prev) {
      if (!child) {
        cur.push(null, null)
        continue
      }
      const { father, mother } = parentsOf(g, child.handle)
      cur.push(father, mother)
    }
    const n = cur.length
    const step = SPAN / n
    const r0 = radii[gen]
    const r1 = radii[gen + 1]
    const rm = (r0 + r1) / 2
    cur.forEach((p, i) => {
      const child = prev[i >> 1]
      if (!p && !child) return
      const a0 = -SPAN / 2 + i * step
      const a1 = a0 + step
      const m = (a0 + a1) / 2
      const [cx, cy] = polar(rm, m)
      const line = gen === 1 ? (i === 0 ? 0 : 2) : i >> (gen - 2)
      const seg: FanSegment = {
        key: `${gen}.${i}`,
        gen,
        person: p,
        d: sector(r0 + 1, r1 - 1, a0 + 0.15, a1 - 0.15),
        fill: tint(colour === 'generation' ? GEN[(gen - 1) % GEN.length] : LINE[line], Math.max(16, 38 - (gen - 1) * 4)),
        cx: f(cx),
        cy: f(cy),
        transform: '',
        lines: [],
      }
      if (p) {
        const years = yearsText(p, t)
        const given = surnameFirst && p.given && p.surname ? p.surname : p.given || p.name
        const surname = p.given ? (surnameFirst && p.surname ? p.given : p.surname) : ''
        if (gen <= 3) {
          // text along the ring
          const flip = Math.abs(m) > 90
          seg.transform = flip ? `rotate(${f(m + 180)}) translate(0 ${f(rm)})` : `rotate(${f(m)}) translate(0 ${f(-rm)})`
          const room = rad(step) * rm * 0.9 - 10
          const size = gen === 1 ? 15 : gen === 2 ? 14 : 13
          const chars = Math.floor(room / charW(size))
          const lines: FanText[] = [{ text: clip(given, chars), size, weight: 500, dy: 0 }]
          if (surname) lines.push({ text: clip(surname, chars), size, weight: 600, dy: 0 })
          if (years) lines.push({ text: clip(years, Math.floor(room / charW(12))), size: 12, weight: 400, dy: 0, muted: true })
          seg.lines = stack(lines)
        } else {
          // text along the radius
          const flip = m < 0
          seg.transform = flip ? `rotate(${f(m + 90)}) translate(${f(-rm)} 0)` : `rotate(${f(m - 90)}) translate(${f(rm)} 0)`
          const room = r1 - r0 - 16
          const across = rad(step) * rm - 4
          const lines: FanText[] = []
          if (across >= 46) {
            const size = 12.5
            const chars = Math.floor(room / charW(size))
            lines.push({ text: clip(given, chars), size, weight: 500, dy: 0 })
            if (surname) lines.push({ text: clip(surname, chars), size, weight: 600, dy: 0 })
            if (years && across >= 56) lines.push({ text: years, size: 11, weight: 400, dy: 0, muted: true })
          } else if (across >= 28) {
            const size = 11.5
            lines.push({ text: clip(p.name, Math.floor(room / charW(size))), size, weight: 500, dy: 0 })
            if (years) lines.push({ text: years, size: 10, weight: 400, dy: 0, muted: true })
          } else {
            const size = Math.max(8, Math.min(11, across * 0.62))
            lines.push({ text: clip(p.name, Math.floor(room / charW(size))), size, weight: 500, dy: 0 })
          }
          seg.lines = stack(lines)
        }
      }
      segments.push(seg)
      angles.push({ seg, angle: step })
    })
    prev = cur
  }
  const R = radii[gens]
  const legend = colour === 'line' || colour === 'generation' ? null : dataColours(colour, angles, t)
  return {
    segments,
    centre: cp,
    radius: R,
    legend,
    bounds: { x0: -R, y0: -R, x1: R, y1: Math.max(R * 0.5, FAN_R0) + 8 },
  }
}

/** Vertically centres a block of lines around the text origin. */
function stack(lines: FanText[]): FanText[] {
  const heights = lines.map((l) => l.size * 1.2)
  const total = heights.reduce((a, b) => a + b, 0)
  let y = -total / 2
  return lines.map((l, i) => {
    const dy = y + heights[i] * 0.78
    y += heights[i]
    return { ...l, dy: f(dy) }
  })
}

/** Key of the data colours, shown over the canvas. */
export function FanLegendView({ legend, className }: { legend: FanLegend; className?: string }) {
  return legend.kind === 'scale' ? (
    <div className={className}>
      <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
        <span>{legend.min}</span>
        <span className="h-2.5 w-28 rounded-full" style={{ background: `linear-gradient(to right, ${legend.lo}, ${legend.hi})` }} aria-hidden />
        <span>{legend.max}</span>
      </div>
    </div>
  ) : (
    <ul className={className}>
      {legend.items.map((i) => (
        <li key={i.label} className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-3 shrink-0 rounded-sm border border-border/60" style={{ background: i.fill }} aria-hidden />
          <span className="truncate">{i.label}</span>
        </li>
      ))}
    </ul>
  )
}

export const FanChart = memo(function FanChart({ geo, handlers }: { geo: FanGeometry; handlers: CardHandlers }) {
  const { t } = useTranslation('charts')
  useAccessToken()
  const c = geo.centre
  const years = yearsText(c, t)
  return (
    <svg className="absolute top-0 left-0 overflow-visible" width={1} height={1}>
      <g className="animate-in fade-in-0 duration-300 motion-reduce:animate-none">
        {geo.segments.map((s) =>
          s.person ? (
            <g
              key={`${s.key}:${s.person.handle}`}
              role="button"
              tabIndex={0}
              data-person={s.person.id}
              data-handle={s.person.handle}
              data-cx={s.cx}
              data-cy={s.cy}
              aria-label={t('showInCentre', { name: s.person.name })}
              className="group/seg cursor-pointer outline-none"
              onClick={(e) => handlers.onActivate(s.person!.handle, e.currentTarget as unknown as HTMLElement)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handlers.onActivate(s.person!.handle, e.currentTarget as unknown as HTMLElement)
                }
              }}
            >
              <title>{`${s.person.name}${yearsText(s.person, t) ? ` (${yearsText(s.person, t)})` : ''}`}</title>
              <path
                d={s.d}
                style={{ fill: s.fill }}
                className="stroke-background stroke-[1.5] transition-[filter] group-hover/seg:brightness-95 group-focus-visible/seg:stroke-ring group-focus-visible/seg:stroke-[3] dark:group-hover/seg:brightness-125"
              />
              <g transform={s.transform} className="pointer-events-none" textAnchor="middle">
                {s.lines.map((l, i) => (
                  <text
                    key={i}
                    y={l.dy}
                    fontSize={l.size}
                    fontWeight={l.weight}
                    className={l.muted ? 'fill-brass/90 font-serif tabular-nums' : 'fill-foreground font-serif'}
                  >
                    {l.text}
                  </text>
                ))}
              </g>
            </g>
          ) : (
            <path key={s.key} d={s.d} className="fill-none stroke-border" strokeDasharray="4 5" />
          ),
        )}
      </g>
      <g
        role="button"
        tabIndex={0}
        data-person={c.id}
        data-handle={c.handle}
        data-cx={0}
        data-cy={0}
        aria-current="true"
        aria-label={`${c.name}${years ? `, ${years}` : ''}`}
        className="group/seg cursor-pointer outline-none"
        onClick={(e) => handlers.onActivate(c.handle, e.currentTarget as unknown as HTMLElement)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handlers.onActivate(c.handle, e.currentTarget as unknown as HTMLElement)
          }
        }}
      >
        <circle
          r={FAN_R0 - 2}
          style={{
            fill: 'color-mix(in oklab, var(--brass) 12%, var(--card))',
            filter: 'drop-shadow(0 0 18px color-mix(in oklab, var(--brass) 40%, transparent))',
          }}
          className="stroke-brass stroke-2 group-focus-visible/seg:stroke-ring group-focus-visible/seg:stroke-[4]"
        />
        <defs>
          <clipPath id="fan-centre-clip">
            <circle cy={-24} r={27} />
          </clipPath>
        </defs>
        {c.media ? (
          <image
            href={refThumbUrl(c.media, 150)}
            x={-27}
            y={-51}
            width={54}
            height={54}
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#fan-centre-clip)"
          />
        ) : (
          <>
            <circle cy={-24} r={27} className="fill-secondary" />
            <text y={-17} textAnchor="middle" fontSize={19} className="fill-secondary-foreground font-serif">
              {initials(c.name)}
            </text>
          </>
        )}
        <text textAnchor="middle" className="pointer-events-none">
          <tspan x={0} y={20} fontSize={13.5} fontWeight={600} className="fill-foreground font-serif">
            {clip(c.given ? (c.surname && c.name.startsWith(`${c.surname}, `) ? c.surname : c.given) : c.name, 16)}
          </tspan>
          {c.given && c.surname && (
            <tspan x={0} y={36} fontSize={13.5} fontWeight={600} className="fill-foreground font-serif">
              {clip(c.name.startsWith(`${c.surname}, `) ? c.given : c.surname, 16)}
            </tspan>
          )}
          {years && (
            <tspan x={0} y={c.given && c.surname ? 53 : 37} fontSize={13} className="fill-brass font-serif tabular-nums">
              {years}
            </tspan>
          )}
        </text>
      </g>
    </svg>
  )
})
