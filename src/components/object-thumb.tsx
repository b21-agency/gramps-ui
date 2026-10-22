import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Portrait, refThumbUrl } from '@/components/portrait'
import { mediaThumbUrl } from '@/lib/api'
import { useAccessToken } from '@/lib/auth'
import { kindIcon } from '@/lib/objects'
import type { MediaRef, ObjectKind } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * The picture that stands for a record in a list ("faces as navigation"):
 * a portrait for people, the image itself for media, the first attached photo for
 * places/events/sources, otherwise a quiet tile with the kind's icon.
 */
export function ObjectThumb({
  kind,
  handle,
  mediaRef,
  name = '',
  sex,
  size = 44,
  className,
}: {
  kind: ObjectKind
  handle?: string
  mediaRef?: Pick<MediaRef, 'ref' | 'rect'> | null
  name?: string
  sex?: string
  size?: number
  className?: string
}) {
  useAccessToken()
  const [failed, setFailed] = useState(false)
  if (kind === 'person') return <Portrait mediaRef={mediaRef} name={name} sex={sex} size={size} className={className} />
  const px = Math.min(1000, Math.ceil((size * (window.devicePixelRatio || 1)) / 50) * 50)
  const src =
    kind === 'media' && handle ? mediaThumbUrl(handle, px, { square: true }) : mediaRef ? refThumbUrl(mediaRef, px) : null
  const Icon = kindIcon[kind]
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary text-muted-foreground', className)}
      style={{ width: size, height: size }}
    >
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        Icon && <Icon style={{ width: Math.max(14, size * 0.4), height: Math.max(14, size * 0.4) }} aria-hidden />
      )}
    </span>
  )
}

/** A record as a generous row: picture, title, a quiet second line, optional meta and remove button. */
export function ObjectRow({
  to,
  thumb,
  title,
  subtitle,
  meta,
  struck,
  onRemove,
  removeLabel,
}: {
  to: string
  thumb: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  struck?: boolean
  onRemove?: () => void
  removeLabel?: string
}) {
  return (
    <div className="group flex min-w-0 items-center rounded-2xl transition-colors duration-150 hover:bg-accent has-[a:focus-visible]:bg-accent">
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 outline-none sm:gap-4">
        {thumb}
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[15px] font-semibold', struck && 'font-normal text-muted-foreground line-through')}>{title}</span>
          {subtitle && <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>}
        </span>
        {meta && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{meta}</span>}
      </Link>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="mr-1 size-11 shrink-0 rounded-full text-muted-foreground sm:size-9 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          aria-label={removeLabel}
          title={removeLabel}
          onClick={onRemove}
        >
          <X />
        </Button>
      )}
    </div>
  )
}
