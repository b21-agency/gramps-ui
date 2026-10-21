import { useState } from 'react'
import { cn } from '@/lib/utils'
import { mediaCroppedUrl, mediaThumbUrl } from '@/lib/api'
import { useAccessToken } from '@/lib/auth'
import { initials } from '@/lib/format'
import type { MediaRef } from '@/lib/types'

function validRect(rect: MediaRef['rect']): rect is [number, number, number, number] {
  if (!rect || rect.length !== 4) return false
  const [x1, y1, x2, y2] = rect
  return x2 > x1 && y2 > y1 && !(x1 === 0 && y1 === 0 && x2 === 100 && y2 === 100) && rect.every((n) => n >= 0 && n <= 100)
}

/** Thumbnail URL for a media reference, cropped to its region when one is set. */
export function refThumbUrl(ref: Pick<MediaRef, 'ref' | 'rect'>, size: number, square = true) {
  return validRect(ref.rect)
    ? mediaCroppedUrl(ref.ref, ref.rect.map(Math.round) as [number, number, number, number], size, { square })
    : mediaThumbUrl(ref.ref, size, { square })
}

const sexRing: Record<string, string> = {
  M: 'ring-[color-mix(in_oklab,var(--chart-3)_55%,transparent)]',
  F: 'ring-[color-mix(in_oklab,var(--chart-4)_55%,transparent)]',
}

/**
 * Person portrait: first media reference (cropped) or initials.
 * The ring hints at sex without the pink/blue cliché; it is subtle on purpose.
 */
export function Portrait({
  mediaRef,
  name,
  sex,
  size = 40,
  className,
  rounded = 'full',
}: {
  mediaRef?: Pick<MediaRef, 'ref' | 'rect'> | null
  name: string
  sex?: string
  size?: number
  className?: string
  rounded?: 'full' | 'lg'
}) {
  useAccessToken()
  const [failed, setFailed] = useState(false)
  const px = Math.min(1000, Math.ceil((size * (window.devicePixelRatio || 1)) / 50) * 50)
  const shape = rounded === 'full' ? 'rounded-full' : 'rounded-lg'
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden bg-secondary text-secondary-foreground ring-2 ring-offset-0',
        shape,
        sexRing[sex ?? ''] ?? 'ring-border',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {mediaRef && !failed ? (
        <img
          src={refThumbUrl(mediaRef, px)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span className="font-serif font-medium" style={{ fontSize: Math.max(10, size * 0.36) }}>
          {initials(name)}
        </span>
      )}
    </span>
  )
}
