import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CHROMOSOMES, normChromosome, sideColor, type DnaSegment } from './data'

export interface Lane {
  key: string
  label: string
  /** Tailwind background class; when omitted the segment side decides the colour */
  color?: string
  segments: DnaSegment[]
}


const MAX_LEN = CHROMOSOMES[0].length

function mb(n: number) {
  return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

/**
 * 22 autosomes + X drawn to scale as horizontal bars; shared segments are painted on top.
 * With several lanes, each chromosome gets one thin track per lane.
 */
export function ChromosomeBrowser({ lanes }: { lanes: Lane[] }) {
  const { t } = useTranslation('dna')
  const laneH = lanes.length > 1 ? Math.max(4, Math.min(10, Math.floor(28 / lanes.length))) : 14

  const byChr = lanes.map((lane) => {
    const m = new Map<string, DnaSegment[]>()
    lane.segments.forEach((s) => {
      const c = normChromosome(s.chromosome)
      m.set(c, [...(m.get(c) ?? []), s])
    })
    return m
  })

  return (
    <div className="space-y-1.5" role="figure" aria-label={t('browserLabel')}>
      {CHROMOSOMES.map((chr) => (
        <div key={chr.name} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{chr.name}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-px" style={{ width: `${(chr.length / MAX_LEN) * 100}%` }}>
              {lanes.map((lane, li) => (
                <div
                  key={lane.key}
                  className="relative overflow-hidden rounded-full bg-muted ring-1 ring-border/60 ring-inset"
                  style={{ height: laneH }}
                >
                  {(byChr[li].get(chr.name) ?? []).map((s, i) => {
                    const left = Math.max(0, Math.min(1, s.start / chr.length))
                    const right = Math.max(left, Math.min(1, s.stop / chr.length))
                    return (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <span
                            tabIndex={0}
                            className={cn(
                              'absolute inset-y-0 min-w-[3px] rounded-[2px] opacity-90 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
                              lane.color ?? sideColor[s.side] ?? sideColor.U,
                            )}
                            style={{ left: `${left * 100}%`, width: `${(right - left) * 100}%` }}
                            aria-label={`${t('chromosome')} ${chr.name}: ${mb(s.start)}–${mb(s.stop)} Mb, ${s.cM} cM`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-0.5">
                            {lanes.length > 1 && <div className="font-medium">{lane.label}</div>}
                            <div>
                              {t('chromosome')} {chr.name} · {mb(s.start)}–{mb(s.stop)} Mb
                            </div>
                            <div className="tabular-nums">
                              {Number(s.cM).toLocaleString(undefined, { maximumFractionDigits: 1 })} cM
                              {s.SNPs ? ` · ${s.SNPs.toLocaleString()} SNPs` : ''}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
