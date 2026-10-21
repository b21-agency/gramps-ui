import type { ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

/**
 * A popover on desktop, a bottom drawer on phones. Children are rendered in both;
 * `cmdk` lists inside get thumb-sized rows and fill the drawer on phones.
 *
 * `size="tall"` gives the drawer a fixed height (search-as-you-type pickers, so the sheet does
 * not jump while results load); `"auto"` fits the content.
 */
export function AdaptivePopover({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
  align = 'start',
  size = 'auto',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: ReactNode
  /** drawer heading on phones (also the accessible name) */
  title: string
  description?: string
  children: ReactNode
  /** classes for the desktop popover content */
  className?: string
  align?: 'start' | 'center' | 'end'
  size?: 'auto' | 'tall'
}) {
  const isMobile = useIsMobile()
  if (!isMobile)
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align={align} className={className}>
          {children}
        </PopoverContent>
      </Popover>
    )
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className={cn('pb-safe', size === 'tall' ? 'h-[88dvh] max-h-[88dvh]' : 'max-h-[88dvh]')}>
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="font-serif text-xl font-medium">{title}</DrawerTitle>
          <DrawerDescription className={cn(!description && 'sr-only')}>{description ?? title}</DrawerDescription>
        </DrawerHeader>
        <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 pb-4', drawerCommand)}>{children}</div>
      </DrawerContent>
    </Drawer>
  )
}

/** Restyles shadcn `Command` for touch inside a drawer body. */
export const drawerCommand = cn(
  '[&_[data-slot=command]]:min-h-0 [&_[data-slot=command]]:flex-1 [&_[data-slot=command]]:bg-transparent',
  '[&_[data-slot=command-list]]:max-h-none [&_[data-slot=command-list]]:flex-1 [&_[data-slot=command-list]]:overscroll-contain',
  '[&_[data-slot=command-item]]:min-h-12 [&_[data-slot=command-item]]:gap-3 [&_[data-slot=command-item]]:rounded-lg [&_[data-slot=command-item]]:px-3 [&_[data-slot=command-item]]:text-base',
  '[&_[data-slot=command-input-wrapper]_[data-slot=input-group]]:h-11!',
)
