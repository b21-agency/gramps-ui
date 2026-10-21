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
  colour: string
  mix: number
  cx: number
  cy: number
  transform: string
  lines: FanText[]
}

export interface FanGeometry {
  segments: FanSegment[]
  centre: GPerson
  radius: number
  bounds: Bounds
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

// family line colours: father's father, father's mother, mother's father, mother's mother
const LINE = ['--chart-3', '--chart-1', '--chart-2', '--chart-4']
const GEN = ['--chart-1', '--chart-3', '--chart-2', '--chart-4', '--chart-5']

export function fanGeometry(g: Graph, centre: string, gens: number, colour: FanColour, t: TFunction): FanGeometry | null {
  const cp = g.people.get(centre)
  if (!cp) return null
  const radii = ringRadii(gens)
  const segments: FanSegment[] = []
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
        colour: colour === 'line' ? LINE[line] : GEN[(gen - 1) % GEN.length],
        mix: Math.max(14, 34 - (gen - 1) * 3),
        cx: f(cx),
        cy: f(cy),
        transform: '',
        lines: [],
      }
      if (p) {
        const years = yearsText(p, t)
        const given = p.given || p.name
        const surname = p.given ? p.surname : ''
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
    })
    prev = cur
  }
  const R = radii[gens]
  return {
    segments,
    centre: cp,
    radius: R,
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
                style={{ fill: `color-mix(in oklab, var(${s.colour}) ${s.mix}%, var(--card))` }}
                className="stroke-background stroke-[1.5] transition-[filter] group-hover/seg:brightness-95 group-focus-visible/seg:stroke-ring group-focus-visible/seg:stroke-[3] dark:group-hover/seg:brightness-125"
              />
              <g transform={s.transform} className="pointer-events-none" textAnchor="middle">
                {s.lines.map((l, i) => (
                  <text
                    key={i}
                    y={l.dy}
                    fontSize={l.size}
                    fontWeight={l.weight}
                    className={l.muted ? 'fill-muted-foreground font-sans tabular-nums' : 'fill-foreground font-serif'}
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
          style={{ fill: 'color-mix(in oklab, var(--brass) 12%, var(--card))' }}
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
            {clip(c.given || c.name, 16)}
          </tspan>
          {c.given && c.surname && (
            <tspan x={0} y={36} fontSize={13.5} fontWeight={600} className="fill-foreground font-serif">
              {clip(c.surname, 16)}
            </tspan>
          )}
          {years && (
            <tspan x={0} y={c.given && c.surname ? 52 : 36} fontSize={11.5} className="fill-brass font-sans tabular-nums">
              {years}
            </tspan>
          )}
        </text>
      </g>
    </svg>
  )
})
