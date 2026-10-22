import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Hover/focus tooltip with a person's name (and optional detail line) for faces in avatar groups. */
export function NameTooltip({ name, detail, children }: { name: string; detail?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="text-center">
        <span className="block font-medium">{name}</span>
        {detail && <span className="block tabular-nums opacity-80">{detail}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
