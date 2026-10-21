import type { ReactNode } from 'react'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

export interface SheetAction {
  key: string
  label: ReactNode
  icon?: ReactNode
  hint?: ReactNode
  active?: boolean
  destructive?: boolean
  onSelect: () => void
}

/** Phone replacement for dropdown menus: a bottom sheet with large, thumb-sized rows. */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  header,
  groups,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  header?: ReactNode
  groups: SheetAction[][]
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh] pb-safe">
        <DrawerHeader className="text-left">
          <DrawerTitle className={cn(header ? 'sr-only' : 'font-serif text-xl font-medium')}>{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{title}</DrawerDescription>
          {header}
        </DrawerHeader>
        <div className="space-y-3 overflow-y-auto overscroll-contain px-3 pb-5">
          {groups
            .filter((g) => g.length)
            .map((g, gi) => (
              <ul key={gi} className="overflow-hidden rounded-2xl border bg-card">
                {g.map((a) => (
                  <li key={a.key} className="border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        // let the sheet start closing before navigating
                        setTimeout(a.onSelect, 0)
                      }}
                      className={cn(
                        'flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left text-base active:bg-accent [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
                        a.destructive && 'text-destructive [&_svg]:text-destructive',
                        a.active && 'text-primary [&_svg]:text-primary',
                      )}
                    >
                      {a.icon}
                      <span className="min-w-0 flex-1">{a.label}</span>
                      {a.hint && <span className="text-sm text-muted-foreground">{a.hint}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
