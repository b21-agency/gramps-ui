import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Loader2, ScanFace, SquareDashedMousePointer, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ObjectPicker } from '@/components/object-picker'
import { api, mediaThumbUrl } from '@/lib/api'
import { useMetadata } from '@/lib/queries'
import type { Media, ObjectKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import { errorMessage, invalidateAfterWrite, patchObject, type AnyObj } from '@/features/editor/lib'
import { refTitle, type RefItem } from './shared'

export type Rect = [number, number, number, number]

/** A linked region: one MediaRef with a rectangle on some object. */
export interface LinkedRegion {
  key: string
  item: RefItem
  /** rectangle as stored (used to find the MediaRef again) */
  stored: Rect
  rect: Rect
}

/** Object types whose media list can reference a region of an image. */
const REGION_KINDS: ObjectKind[] = ['person', 'family', 'event', 'place', 'source', 'citation']

const clamp = (n: number) => Math.min(100, Math.max(0, n))
function normalize(r: number[]): Rect | null {
  if (r.length !== 4 || r.some((n) => !Number.isFinite(n))) return null
  const [x1, y1, x2, y2] = r.map((n) => Math.round(clamp(n)))
  const rect: Rect = [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)]
  return rect[2] - rect[0] >= 1 && rect[3] - rect[1] >= 1 ? rect : null
}
const same = (a?: number[] | null, b?: number[] | null) => !!a && !!b && a.length === b.length && a.every((n, i) => n === b[i])
function overlap(a: Rect, b: Rect) {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0])
  const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1])
  if (w <= 0 || h <= 0) return 0
  const small = Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1]))
  return (w * h) / small
}

function withRegion(list: AnyObj[] | undefined, media: string, rect: Rect) {
  const l = list ?? []
  if (l.some((m) => m.ref === media && same(m.rect, rect))) return l
  return [...l, { _class: 'MediaRef', ref: media, rect, private: false, citation_list: [], note_list: [], attribute_list: [] }]
}
function withoutRegion(list: AnyObj[] | undefined, media: string, rect: Rect) {
  return (list ?? []).filter((m) => m.ref !== media || !same(m.rect, rect))
}
function movedRegion(list: AnyObj[] | undefined, media: string, from: Rect, to: Rect) {
  const l = list ?? []
  const i = l.findIndex((m) => m.ref === media && same(m.rect, from))
  return i === -1 ? l : l.map((m, j) => (j === i ? { ...m, rect: to } : m))
}

type Selection = { rect: Rect; region?: LinkedRegion }
type Drag = { mode: 'draw' | 'move' | 'resize'; corner?: number; start: [number, number]; orig: Rect }

/**
 * Region editing for an image (EditObject): shows linked regions and suggested faces,
 * lets the user draw, move and resize rectangles, link them to a person (or another
 * object) and remove links. Every change is saved on the linked object right away.
 */
export function RegionEditor({ media, regions, onChanged, onClose }: { media: Media; regions: LinkedRegion[]; onChanged: () => void; onClose: () => void }) {
  const { t } = useTranslation(['objects', 'common'])
  const qc = useQueryClient()
  const { data: meta } = useMetadata()
  const faceDetection = !!meta?.server?.face_detection
  const faces = useQuery({
    queryKey: ['media', 'faces', media.handle, media.checksum],
    enabled: faceDetection,
    staleTime: Infinity,
    retry: false,
    queryFn: () => api<number[][]>(`/media/${media.handle}/face_detection`),
  })
  const box = useRef<HTMLDivElement>(null)
  const [sel, setSel] = useState<Selection | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [drawMode, setDrawMode] = useState(false)
  const [dismissed, setDismissed] = useState<Rect[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const suggestions = (faces.data ?? [])
    .map(normalize)
    .filter((r): r is Rect => !!r)
    .filter((r) => !regions.some((g) => overlap(g.rect, r) > 0.4) && !dismissed.some((d) => overlap(d, r) > 0.6))
    .filter((r) => !sel || overlap(sel.rect, r) < 0.6)

  const pct = (e: { clientX: number; clientY: number }): [number, number] => {
    const b = box.current!.getBoundingClientRect()
    return [clamp(((e.clientX - b.left) / b.width) * 100), clamp(((e.clientY - b.top) / b.height) * 100)]
  }

  const save = async (fn: () => Promise<unknown>, kinds: ObjectKind[]) => {
    setBusy(true)
    try {
      await fn()
      invalidateAfterWrite(qc, [...kinds, 'media'])
      onChanged()
      return true
    } catch (e) {
      toast.error(t('regions.saveFailed'), { description: errorMessage(e) })
      onChanged()
      return false
    } finally {
      setBusy(false)
    }
  }

  const link = async (kind: ObjectKind, handle: string) => {
    if (!sel) return
    const old = sel.region
    if (old && old.item.kind === kind && old.item.raw.handle === handle) return
    const rect = sel.rect
    const ok = await save(async () => {
      await patchObject(kind, handle, (o) => (o.media_list = withRegion(o.media_list, media.handle, rect)))
      if (old) await patchObject(old.item.kind, old.item.raw.handle, (o) => (o.media_list = withoutRegion(o.media_list, media.handle, old.stored)))
    }, old ? [kind, old.item.kind] : [kind])
    if (ok) {
      toast.success(t('regions.linked'))
      setSel(null)
    }
  }

  const remove = async () => {
    setConfirm(false)
    const old = sel?.region
    if (!old) {
      if (sel) setDismissed((d) => [...d, sel.rect])
      setSel(null)
      return
    }
    const ok = await save(
      () => patchObject(old.item.kind, old.item.raw.handle, (o) => (o.media_list = withoutRegion(o.media_list, media.handle, old.stored))),
      [old.item.kind],
    )
    if (ok) setSel(null)
  }

  const commitMove = async (s: Selection) => {
    const r = s.region
    if (!r || same(r.stored, s.rect)) return
    const to = s.rect
    await save(() => patchObject(r.item.kind, r.item.raw.handle, (o) => (o.media_list = movedRegion(o.media_list, media.handle, r.stored, to))), [r.item.kind])
    setSel({ rect: to, region: { ...r, stored: to, rect: to } })
  }

  /* ------------ pointer handling (percent coordinates) ------------ */

  const onDown = (e: ReactPointerEvent, mode: Drag['mode'], corner?: number) => {
    if (busy || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    box.current?.setPointerCapture(e.pointerId)
    const p = pct(e)
    if (mode === 'draw') {
      setSel({ rect: [p[0], p[1], p[0], p[1]] as Rect })
      setDrag({ mode, start: p, orig: [p[0], p[1], p[0], p[1]] })
    } else if (sel) setDrag({ mode, corner, start: p, orig: sel.rect })
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!drag || !sel) return
    const p = pct(e)
    const dx = p[0] - drag.start[0]
    const dy = p[1] - drag.start[1]
    const o = drag.orig
    let r: number[]
    if (drag.mode === 'draw') r = [drag.start[0], drag.start[1], p[0], p[1]]
    else if (drag.mode === 'move') {
      const w = o[2] - o[0]
      const h = o[3] - o[1]
      const x = Math.min(100 - w, Math.max(0, o[0] + dx))
      const y = Math.min(100 - h, Math.max(0, o[1] + dy))
      r = [x, y, x + w, y + h]
    } else {
      // corners: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left
      const c = drag.corner ?? 2
      r = [...o]
      if (c === 0 || c === 3) r[0] = o[0] + dx
      else r[2] = o[2] + dx
      if (c === 0 || c === 1) r[1] = o[1] + dy
      else r[3] = o[3] + dy
    }
    const [x1, y1, x2, y2] = r.map(clamp)
    setSel({ ...sel, rect: [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)] })
  }
  const onUp = () => {
    if (!drag || !sel) return setDrag(null)
    const mode = drag.mode
    setDrag(null)
    const rect = normalize(sel.rect)
    if (!rect) {
      setSel(mode === 'draw' ? null : { ...sel, rect: drag.orig })
      return
    }
    const next = { ...sel, rect }
    setSel(next)
    if (mode === 'draw') setDrawMode(false)
    else void commitMove(next)
  }

  const label = (r: LinkedRegion) => refTitle(r.item, t).title
  const style = (r: number[]) => ({ left: `${r[0]}%`, top: `${r[1]}%`, width: `${r[2] - r[0]}%`, height: `${r[3] - r[1]}%` })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={drawMode ? 'secondary' : 'outline'} aria-pressed={drawMode} onClick={() => (setDrawMode(!drawMode), setSel(null))}>
          <SquareDashedMousePointer />
          {t('regions.draw')}
        </Button>
        {faceDetection && (
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            {faces.isFetching ? <Loader2 className="size-4 animate-spin" /> : <ScanFace className="size-4" />}
            {faces.isFetching ? t('regions.detecting') : t('regions.faces', { count: suggestions.length })}
          </span>
        )}
        <Button size="sm" className="ml-auto" onClick={onClose}>
          <Check />
          {t('regions.done')}
        </Button>
      </div>

      <figure className="flex justify-center rounded-xl border bg-muted/60 p-2 sm:p-4">
        <div
          ref={box}
          className={cn('relative inline-block max-w-full touch-none select-none overflow-hidden rounded-md', drawMode && 'cursor-crosshair')}
          onPointerDown={(e) => (drawMode ? onDown(e, 'draw') : setSel(null))}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <img
            src={mediaThumbUrl(media.handle, 1600)}
            alt={media.desc || ''}
            draggable={false}
            onLoad={() => setLoaded(true)}
            className={cn('block max-h-[72vh] w-auto max-w-full bg-muted', !loaded && 'min-h-64 min-w-64')}
          />
          {loaded && (
            <>
              {suggestions.map((r, i) => (
                <button
                  key={`f-${i}`}
                  type="button"
                  aria-label={t('regions.suggested')}
                  title={t('regions.suggested')}
                  className="absolute rounded-sm border-2 border-dashed border-white/80 bg-white/5 shadow-[0_0_0_1px_rgb(0_0_0/0.4)] hover:bg-white/15"
                  style={style(r)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => (setDrawMode(false), setSel({ rect: r }))}
                />
              ))}
              {regions
                .filter((g) => g.key !== sel?.region?.key)
                .map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    aria-label={label(g)}
                    className="group/r absolute rounded-sm border-2 border-brass/90 shadow-[0_0_0_1px_rgb(0_0_0/0.35)] hover:bg-brass/10"
                    style={style(g.rect)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => (setDrawMode(false), setSel({ rect: g.rect, region: g }))}
                  >
                    <span className="pointer-events-none absolute left-0 top-full mt-0.5 max-w-48 truncate rounded bg-background/95 px-1.5 py-0.5 text-left text-[11px] text-foreground shadow">
                      {label(g)}
                    </span>
                  </button>
                ))}
              {sel && (
                <div
                  className="absolute cursor-move rounded-sm border-2 border-primary bg-primary/10 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]"
                  style={style(sel.rect)}
                  onPointerDown={(e) => onDown(e, 'move')}
                >
                  {[0, 1, 2, 3].map((c) => (
                    <span
                      key={c}
                      aria-hidden
                      onPointerDown={(e) => onDown(e, 'resize', c)}
                      className={cn(
                        'absolute size-3.5 rounded-full border-2 border-primary bg-background pointer-coarse:size-5',
                        c === 0 && '-left-2 -top-2 cursor-nwse-resize',
                        c === 1 && '-right-2 -top-2 cursor-nesw-resize',
                        c === 2 && '-bottom-2 -right-2 cursor-nwse-resize',
                        c === 3 && '-bottom-2 -left-2 cursor-nesw-resize',
                      )}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </figure>

      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl border bg-card p-2" aria-live="polite">
        {!sel ? (
          <p className="px-1 text-sm text-muted-foreground">{t('regions.hint')}</p>
        ) : (
          <>
            <span className="px-1 text-sm">
              {sel.region ? (
                <>
                  <span className="text-muted-foreground">{t('regions.linkedTo')} </span>
                  <span className="font-medium">{label(sel.region)}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{t('regions.unlinked')}</span>
              )}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <div className="w-56">
                <ObjectPicker
                  kinds={REGION_KINDS}
                  placeholder={sel.region ? t('regions.relink') : t('regions.link')}
                  onChange={(o) => void link(o.kind, o.handle)}
                />
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => (sel.region ? setConfirm(true) : void remove())}
                aria-label={t('regions.remove')}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
                <span className="hidden sm:inline">{t('regions.remove')}</span>
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={t('regions.deselect')} onClick={() => setSel(null)}>
                <X />
              </Button>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('regions.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{sel?.region ? t('regions.removeBody', { name: label(sel.region) }) : ''}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>{t('regions.remove')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
