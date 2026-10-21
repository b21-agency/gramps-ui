import { Fragment, useState, type ReactElement, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-mobile'
import { ActionSheet, type SheetAction } from './action-sheet'

/**
 * One list of actions, shown as a dropdown on desktop and as a bottom action sheet on phones.
 * `trigger` must be a single element that accepts onClick (a Button).
 */
export function ResponsiveMenu({
  trigger,
  title,
  label,
  groups,
  align = 'end',
  className,
}: {
  trigger: ReactElement
  /** sheet heading on phones */
  title: string
  /** optional small label above the desktop menu */
  label?: ReactNode
  groups: SheetAction[][]
  align?: 'start' | 'end'
  className?: string
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const visible = groups.filter((g) => g.length)
  if (isMobile)
    return (
      <>
        <span className="contents" onClick={() => setOpen(true)}>
          {trigger}
        </span>
        <ActionSheet open={open} onOpenChange={setOpen} title={title} groups={visible} />
      </>
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={className}>
        {label && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{label}</DropdownMenuLabel>}
        {visible.map((g, gi) => (
          <Fragment key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {g.map((a) => (
              <DropdownMenuItem key={a.key} variant={a.destructive ? 'destructive' : 'default'} onSelect={a.onSelect}>
                {a.icon}
                <span className="min-w-0 flex-1">{a.label}</span>
                {a.active && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
