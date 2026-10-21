// Download the current chart as a standalone SVG or PNG. The file is drawn from the same layout
// data as the screen (not by serialising the DOM), with theme colours resolved and portraits
// embedded, so it opens anywhere.
import type { TFunction } from 'i18next'
import { refThumbUrl } from '@/components/portrait'
import type { GPerson } from './graph'
import type { Layout } from './layout'
import type { FanGeometry } from './fan'
import { FAN_R0 } from './fan'
import { yearsText } from './person-card'

const SERIF = "Newsreader, Georgia, 'Times New Roman', serif"
const SANS = "'Instrument Sans', system-ui, sans-serif"

let ctx: CanvasRenderingContext2D | null = null
function canvas2d() {
  ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  return ctx!
}

/** Any CSS colour (including var() and color-mix()) -> rgb() string. */
function resolveColour(css: string): string {
  const probe = document.createElement('span')
  probe.style.color = css
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  const c = canvas2d()
  c.clearRect(0, 0, 1, 1)
  c.fillStyle = '#000'
  c.fillStyle = computed
  c.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data
  return a < 255 ? `rgba(${r},${g},${b},${(a / 255).toFixed(3)})` : `rgb(${r},${g},${b})`
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function wrap(text: string, font: string, max: number, lines: number): string[] {
  const c = canvas2d()
  c.font = font
  const words = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i]
    if (c.measureText(next).width <= max || !cur) cur = next
    else {
      out.push(cur)
      cur = words[i]
      if (out.length === lines - 1) {
        cur = words.slice(i).join(' ')
        break
      }
    }
  }
  if (cur) out.push(cur)
  return out.slice(0, lines).map((l) => {
    if (c.measureText(l).width <= max) return l
    let s = l
    while (s.length > 1 && c.measureText(s + '…').width > max) s = s.slice(0, -1)
    return s.trimEnd() + '…'
  })
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => resolve(null)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

async function portraits(people: GPerson[]) {
  const map = new Map<string, string>()
  const list = people.filter((p) => p.media)
  for (let i = 0; i < list.length; i += 12) {
    await Promise.all(
      list.slice(i, i + 12).map(async (p) => {
        const d = await toDataUrl(refThumbUrl(p.media!, 150))
        if (d) map.set(p.handle, d)
      }),
    )
  }
  return map
}

function palette() {
  const keys = ['background', 'card', 'foreground', 'muted-foreground', 'border', 'brass', 'lineage', 'secondary', 'secondary-foreground']
  return Object.fromEntries(keys.map((k) => [k, resolveColour(`var(--${k})`)])) as Record<string, string>
}

function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

export async function boxChartSvg(layout: Layout, people: Map<string, GPerson>, t: TFunction): Promise<{ svg: string; w: number; h: number }> {
  const c = palette()
  const centreFill = resolveColour('color-mix(in oklab, var(--brass) 9%, var(--card))')
  const pad = 32
  const { x0, y0, x1, y1 } = layout.bounds
  const w = Math.ceil(x1 - x0 + pad * 2)
  const h = Math.ceil(y1 - y0 + pad * 2)
  const vertical = layout.orientation === 'vertical'
  const imgs = await portraits(layout.nodes.map((n) => people.get(n.handle)).filter((p): p is GPerson => !!p))
  const parts: string[] = []
  parts.push(`<g fill="none" stroke="${c.lineage}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`)
  layout.links.forEach((d) => parts.push(`<path d="${d}"/>`))
  parts.push('</g>')
  parts.push(`<g fill="none" stroke="${c.lineage}" stroke-width="1.5" stroke-dasharray="4 4">`)
  layout.partnerLinks.forEach((d) => parts.push(`<path d="${d}"/>`))
  parts.push('</g>')
  layout.nodes.forEach((n, i) => {
    const p = people.get(n.handle)
    if (!p) return
    const centre = n.role === 'centre' || n.role === 'target'
    parts.push(
      `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="${centre ? centreFill : c.card}" stroke="${centre ? c.brass : c.border}" stroke-width="${centre ? 2 : 1}"${n.role === 'partner' ? ' stroke-dasharray="5 4"' : ''}/>`,
    )
    const ps = vertical ? 60 : 52
    const px = vertical ? n.x + n.w / 2 - ps / 2 : n.x + 12
    const py = vertical ? n.y + 16 : n.y + n.h / 2 - ps / 2
    const img = imgs.get(p.handle)
    parts.push(`<clipPath id="c${i}"><circle cx="${px + ps / 2}" cy="${py + ps / 2}" r="${ps / 2}"/></clipPath>`)
    if (img)
      parts.push(`<image href="${img}" x="${px}" y="${py}" width="${ps}" height="${ps}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c${i})"/>`)
    else
      parts.push(
        `<circle cx="${px + ps / 2}" cy="${py + ps / 2}" r="${ps / 2}" fill="${c.secondary}"/><text x="${px + ps / 2}" y="${py + ps / 2 + ps * 0.13}" text-anchor="middle" font-family="${esc(SERIF)}" font-size="${ps * 0.36}" fill="${c['secondary-foreground']}">${esc(initialsOf(p.name))}</text>`,
      )
    const nameFont = `${centre ? 600 : 500} 15px ${SERIF}`
    const tx = vertical ? n.x + n.w / 2 : px + ps + 12
    const maxW = vertical ? n.w - 20 : n.x + n.w - tx - 12
    const lines = wrap(p.name, nameFont, maxW, 2)
    const years = yearsText(p, t)
    const anchor = vertical ? 'middle' : 'start'
    const blockH = lines.length * 17 + (years ? 17 : 0)
    let ty = vertical ? py + ps + 22 : n.y + n.h / 2 - blockH / 2 + 13
    lines.forEach((l) => {
      parts.push(
        `<text x="${tx}" y="${ty}" text-anchor="${anchor}" font-family="${esc(SERIF)}" font-size="15" font-weight="${centre ? 600 : 500}" fill="${c.foreground}">${esc(l)}</text>`,
      )
      ty += 17
    })
    if (years)
      parts.push(
        `<text x="${tx}" y="${ty + 1}" text-anchor="${anchor}" font-family="${esc(SANS)}" font-size="13" fill="${centre ? c.brass : c['muted-foreground']}">${esc(years)}</text>`,
      )
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0 - pad} ${y0 - pad} ${w} ${h}"><rect x="${x0 - pad}" y="${y0 - pad}" width="${w}" height="${h}" fill="${c.background}"/>${parts.join('')}</svg>`
  return { svg, w, h }
}

export async function fanChartSvg(geo: FanGeometry, t: TFunction): Promise<{ svg: string; w: number; h: number }> {
  const c = palette()
  const pad = 32
  const { x0, y0, x1, y1 } = geo.bounds
  const w = Math.ceil(x1 - x0 + pad * 2)
  const h = Math.ceil(y1 - y0 + pad * 2)
  const fills = new Map<string, string>()
  const fillOf = (colour: string, mix: number) => {
    const k = `${colour}/${mix}`
    if (!fills.has(k)) fills.set(k, resolveColour(`color-mix(in oklab, var(${colour}) ${mix}%, var(--card))`))
    return fills.get(k)!
  }
  const parts: string[] = []
  for (const s of geo.segments) {
    if (!s.person) {
      parts.push(`<path d="${s.d}" fill="none" stroke="${c.border}" stroke-dasharray="4 5"/>`)
      continue
    }
    parts.push(`<path d="${s.d}" fill="${fillOf(s.colour, s.mix)}" stroke="${c.background}" stroke-width="1.5"/>`)
    parts.push(`<g transform="${s.transform}" text-anchor="middle">`)
    for (const l of s.lines)
      parts.push(
        `<text y="${l.dy}" font-size="${l.size}" font-weight="${l.weight}" font-family="${esc(l.muted ? SANS : SERIF)}" fill="${l.muted ? c['muted-foreground'] : c.foreground}">${esc(l.text)}</text>`,
      )
    parts.push('</g>')
  }
  const cp = geo.centre
  const img = cp.media ? await toDataUrl(refThumbUrl(cp.media, 150)) : null
  parts.push(
    `<circle r="${FAN_R0 - 2}" fill="${resolveColour('color-mix(in oklab, var(--brass) 12%, var(--card))')}" stroke="${c.brass}" stroke-width="2"/>`,
  )
  parts.push(`<clipPath id="cc"><circle cy="-24" r="27"/></clipPath>`)
  if (img) parts.push(`<image href="${img}" x="-27" y="-51" width="54" height="54" preserveAspectRatio="xMidYMid slice" clip-path="url(#cc)"/>`)
  else
    parts.push(
      `<circle cy="-24" r="27" fill="${c.secondary}"/><text y="-17" text-anchor="middle" font-size="19" font-family="${esc(SERIF)}" fill="${c['secondary-foreground']}">${esc(initialsOf(cp.name))}</text>`,
    )
  const lines = wrap(cp.name, `600 13.5px ${SERIF}`, 120, 2)
  lines.forEach((l, i) =>
    parts.push(
      `<text y="${20 + i * 16}" text-anchor="middle" font-size="13.5" font-weight="600" font-family="${esc(SERIF)}" fill="${c.foreground}">${esc(l)}</text>`,
    ),
  )
  const years = yearsText(cp, t)
  if (years)
    parts.push(
      `<text y="${20 + lines.length * 16}" text-anchor="middle" font-size="11.5" font-family="${esc(SANS)}" fill="${c.brass}">${esc(years)}</text>`,
    )
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0 - pad} ${y0 - pad} ${w} ${h}"><rect x="${x0 - pad}" y="${y0 - pad}" width="${w}" height="${h}" fill="${c.background}"/>${parts.join('')}</svg>`
  return { svg, w, h }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function downloadSvg(svg: string, filename: string) {
  download(new Blob([svg], { type: 'image/svg+xml' }), `${filename}.svg`)
}

export async function downloadPng(svg: string, w: number, h: number, filename: string) {
  const scale = Math.max(0.25, Math.min(2, 16000 / w, 16000 / h, Math.sqrt(120e6 / (w * h))))
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('svg render failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const c = canvas.getContext('2d')!
    c.scale(scale, scale)
    c.drawImage(img, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('png encode failed')
    download(blob, `${filename}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}
