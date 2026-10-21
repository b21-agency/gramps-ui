import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export interface LightboxItem {
  key: string
  src: string
  alt: string
  caption?: string
  /** in-app media page */
  href?: string
  hrefLabel?: string
  /** original file */
  original?: string
}

/**
 * Image viewer. Desktop: centred dialog with previous/next (arrow keys work).
 * Phones: full-screen, black, swipe sideways between images (CSS scroll snap).
 */
export function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: LightboxItem[]
  index: number | null
  onIndexChange: (i: number) => void
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const open = index != null && !!items[index]
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        {open &&
          (isMobile ? (
            <PhoneViewer items={items} index={index} onIndexChange={onIndexChange} />
          ) : (
            <DesktopViewer items={items} index={index} onIndexChange={onIndexChange} />
          ))}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Caption({ item, dark }: { item: LightboxItem; dark?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex items-center gap-3 text-sm', dark && 'text-white/90')}>
      <span className="min-w-0 flex-1 truncate">{item.caption}</span>
      {item.href && (
        <Link
          to={item.href}
          className={cn('shrink-0 hover:underline', dark ? 'inline-flex h-10 items-center rounded-full bg-white/12 px-3.5 active:bg-white/20' : 'text-primary')}
        >
          {item.hrefLabel ?? t('gallery.openMedia')}
        </Link>
      )}
      {item.original && (
        <a
          href={item.original}
          target="_blank"
          rel="noreferrer"
          aria-label={t('gallery.original')}
          className={cn('shrink-0', dark ? 'grid size-10 place-items-center rounded-full bg-white/12 active:bg-white/20' : 'text-muted-foreground hover:text-foreground')}
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  )
}

function DesktopViewer({ items, index, onIndexChange }: { items: LightboxItem[]; index: number; onIndexChange: (i: number) => void }) {
  const { t } = useTranslation()
  const item = items[index]
  const many = items.length > 1
  const go = (d: number) => onIndexChange((index + d + items.length) % items.length)
  const content = useRef<HTMLDivElement>(null)
  return (
    <>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <DialogPrimitive.Content
        ref={content}
        onOpenAutoFocus={(e) => {
          // focus the viewer itself so arrow keys work without a ring on the first button
          e.preventDefault()
          content.current?.focus()
        }}
        className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[min(64rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-xl bg-popover p-3 text-popover-foreground ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
        onKeyDown={(e) => {
          if (!many) return
          if (e.key === 'ArrowRight') go(1)
          else if (e.key === 'ArrowLeft') go(-1)
        }}
      >
        <DialogPrimitive.Title className="sr-only">{item.caption || item.alt || t('gallery.label')}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">{t('gallery.position', { i: index + 1, n: items.length })}</DialogPrimitive.Description>
        <div className="relative">
          <img key={item.key} src={item.src} alt={item.alt} className="max-h-[75vh] w-full rounded-md bg-muted object-contain" />
          {many && (
            <>
              <Button variant="secondary" size="icon" className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full shadow" aria-label={t('gallery.prev')} onClick={() => go(-1)}>
                <ChevronLeft />
              </Button>
              <Button variant="secondary" size="icon" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full shadow" aria-label={t('gallery.next')} onClick={() => go(1)}>
                <ChevronRight />
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 px-1">
          {many && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{t('gallery.position', { i: index + 1, n: items.length })}</span>}
          <div className="min-w-0 flex-1">
            <Caption item={item} />
          </div>
        </div>
        <DialogPrimitive.Close asChild>
          <Button variant="secondary" size="icon-sm" className="absolute top-5 right-5 rounded-full bg-background/80 shadow-sm" aria-label={t('actions.close')}>
            <X />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </>
  )
}

function PhoneViewer({ items, index, onIndexChange }: { items: LightboxItem[]; index: number; onIndexChange: (i: number) => void }) {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const [chrome, setChrome] = useState(true)
  const item = items[index]

  // jump (no animation) to the opened image
  useLayoutEffect(() => {
    const el = track.current
    if (el) el.scrollLeft = index * el.clientWidth
    // only when opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the index in sync with the swipe position
  useEffect(() => {
    const el = track.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / el.clientWidth)
        if (i !== index && i >= 0 && i < items.length) onIndexChange(i)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [index, items.length, onIndexChange])

  return (
    <>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none" />
      <DialogPrimitive.Content
        className="fixed inset-0 z-50 flex flex-col bg-black text-white outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] motion-reduce:animate-none"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogPrimitive.Title className="sr-only">{item.caption || item.alt || t('gallery.label')}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">{t('gallery.position', { i: index + 1, n: items.length })}</DialogPrimitive.Description>

        <div className={cn('absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-2 pt-safe pb-6 transition-opacity duration-200', !chrome && 'pointer-events-none opacity-0')}>
          <DialogPrimitive.Close asChild>
            <button type="button" className="grid size-11 place-items-center rounded-full active:bg-white/15" aria-label={t('actions.close')}>
              <X className="size-6" />
            </button>
          </DialogPrimitive.Close>
          {items.length > 1 && (
            <span className="flex-1 pr-13 text-center text-sm text-white/85 tabular-nums" aria-live="polite">
              {t('gallery.position', { i: index + 1, n: items.length })}
            </span>
          )}
        </div>

        <div
          ref={track}
          className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onClick={() => setChrome((c) => !c)}
        >
          {items.map((it, i) => (
            <div key={it.key} className="grid h-full w-full shrink-0 snap-center snap-always place-items-center">
              {Math.abs(i - index) <= 1 ? (
                <img src={it.src} alt={it.alt} draggable={false} className="max-h-full max-w-full object-contain select-none" />
              ) : (
                <span aria-hidden />
              )}
            </div>
          ))}
        </div>

        <div className={cn('absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] transition-opacity duration-200', !chrome && 'pointer-events-none opacity-0')}>
          <Caption item={item} dark />
          {items.length > 1 && items.length <= 12 && (
            <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
              {items.map((it, i) => (
                <span key={it.key} className={cn('size-1.5 rounded-full transition-colors', i === index ? 'bg-white' : 'bg-white/35')} />
              ))}
            </div>
          )}
        </div>
      </DialogPrimitive.Content>
    </>
  )
}
