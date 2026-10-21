// Card layouts for the box charts (ancestor, descendant, hourglass, relationship).
// Everything is computed in "depth" (generations) and "breadth" (siblings) space and mapped to
// x/y at the end, so both orientations share one implementation. The centre person's card is
// centred on (0, 0).
import {
  childrenOf,
  hasHiddenParents,
  hiddenChildCount,
  parentsOf,
  partnerFamilies,
  type Graph,
  type Orientation,
} from './graph'
import type { Handle } from '@/lib/types'

export interface Dims {
  w: number
  h: number
  gapDepth: number
  gapBreadth: number
  gapPartner: number
}

export const DIMS: Record<Orientation, Dims> = {
  horizontal: { w: 236, h: 78, gapDepth: 72, gapBreadth: 14, gapPartner: 10 },
  vertical: { w: 156, h: 156, gapDepth: 64, gapBreadth: 16, gapPartner: 10 },
}

export type Role = 'centre' | 'target' | 'person' | 'partner'
export type Side = 'up' | 'down' | 'left' | 'right'

export interface LNode {
  key: string
  handle: Handle
  /** Top-left corner in world coordinates. */
  x: number
  y: number
  w: number
  h: number
  role: Role
  /** Hint that more relatives exist beyond the edge of the chart. */
  stub?: { side: Side; kind: 'parents' | 'children'; count?: number }
}

export interface Bounds {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface Layout {
  nodes: LNode[]
  /** Parent-child connector paths. */
  links: string[]
  /** Partner connector paths (drawn lighter). */
  partnerLinks: string[]
  bounds: Bounds
  orientation: Orientation
}

/* ---------- geometry helpers ---------- */

type Pt = [number, number]

/** Polyline with rounded corners. */
export function roundedPath(points: Pt[], r = 10): string {
  const pts = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1])
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy] = pts[i]
    const [nx, ny] = pts[i + 1]
    const l1 = Math.hypot(cx - px, cy - py)
    const l2 = Math.hypot(nx - cx, ny - cy)
    const rr = Math.min(r, l1 / 2, l2 / 2)
    if (rr < 0.5) {
      d += `L${cx},${cy}`
      continue
    }
    const ax = cx - ((cx - px) / l1) * rr
    const ay = cy - ((cy - py) / l1) * rr
    const bx = cx + ((nx - cx) / l2) * rr
    const by = cy + ((ny - cy) / l2) * rr
    d += `L${ax},${ay}Q${cx},${cy} ${bx},${by}`
  }
  const last = pts[pts.length - 1]
  return d + `L${last[0]},${last[1]}`
}

class Space {
  readonly depthSize: number
  readonly breadthSize: number
  readonly o: Orientation
  readonly dims: Dims
  constructor(o: Orientation, dims: Dims) {
    this.o = o
    this.dims = dims
    this.depthSize = o === 'horizontal' ? dims.w : dims.h
    this.breadthSize = o === 'horizontal' ? dims.h : dims.w
  }
  /** Depth coordinate of a generation's card centres. */
  depth(level: number) {
    return level * (this.depthSize + this.dims.gapDepth)
  }
  pt(d: number, b: number): Pt {
    return this.o === 'horizontal' ? [d, b] : [b, d]
  }
  node(key: string, handle: Handle, level: number, b: number, role: Role): LNode {
    const [cx, cy] = this.pt(this.depth(level), b)
    return { key, handle, x: cx - this.dims.w / 2, y: cy - this.dims.h / 2, w: this.dims.w, h: this.dims.h, role }
  }
  /** Elbow connector between two cards on adjacent generations (dir = +1 / -1 from a to b). */
  elbow(levelA: number, bA: number, levelB: number, bB: number) {
    const dir = Math.sign(levelB - levelA) || 1
    const dA = this.depth(levelA) + (dir * this.depthSize) / 2
    const dB = this.depth(levelB) - (dir * this.depthSize) / 2
    const dm = dB - (dir * this.dims.gapDepth) / 2
    return roundedPath([this.pt(dA, bA), this.pt(dm, bA), this.pt(dm, bB), this.pt(dB, bB)], 12)
  }
  side(dir: number): Side {
    return this.o === 'horizontal' ? (dir > 0 ? 'right' : 'left') : dir > 0 ? 'down' : 'up'
  }
}

/* ---------- tidy packing (leaves stacked, parents centred over their children) ---------- */

interface PackNode {
  size: number
  pos: number
  kids: PackNode[]
}

function shift(n: PackNode, by: number) {
  n.pos += by
  n.kids.forEach((k) => shift(k, by))
}

function extent(n: PackNode): [number, number] {
  let lo = n.pos - n.size / 2
  let hi = n.pos + n.size / 2
  for (const k of n.kids) {
    const [a, b] = extent(k)
    lo = Math.min(lo, a)
    hi = Math.max(hi, b)
  }
  return [lo, hi]
}

/** Places a subtree starting at breadth `start`; returns the end of its extent. */
function pack(n: PackNode, start: number, gap: number): number {
  if (!n.kids.length) {
    n.pos = start + n.size / 2
    return start + n.size
  }
  let cur = start
  n.kids.forEach((k, i) => {
    cur = pack(k, cur + (i ? gap : 0), gap)
  })
  n.pos = (n.kids[0].pos + n.kids[n.kids.length - 1].pos) / 2
  const [lo] = extent(n)
  if (lo < start) shift(n, start - lo)
  return extent(n)[1]
}

/* ---------- ancestors ---------- */

interface ANode extends PackNode {
  handle: Handle
  key: string
  level: number
  kids: ANode[]
}

function buildAncestors(g: Graph, handle: Handle, level: number, maxLevel: number, key: string, size: number): ANode {
  const kids: ANode[] = []
  if (level + 1 < maxLevel) {
    const { father, mother } = parentsOf(g, handle)
    if (father) kids.push(buildAncestors(g, father.handle, level + 1, maxLevel, key + 'f', size))
    if (mother) kids.push(buildAncestors(g, mother.handle, level + 1, maxLevel, key + 'm', size))
  }
  return { handle, key, level, kids, size, pos: 0 }
}

function emitAncestors(sp: Space, g: Graph, root: ANode, dir: number, out: Layout, includeRoot: boolean, maxLevel: number) {
  const walk = (n: ANode) => {
    if (n !== root || includeRoot) {
      const node = sp.node(n.key, n.handle, dir * n.level, n.pos, n.level === 0 ? 'centre' : 'person')
      if (!n.kids.length && (n.level + 1 >= maxLevel ? parentsOf(g, n.handle).family : hasHiddenParents(g, n.handle)))
        node.stub = { side: sp.side(dir), kind: 'parents' }
      out.nodes.push(node)
    }
    for (const k of n.kids) {
      out.links.push(sp.elbow(dir * n.level, n.pos, dir * k.level, k.pos))
      walk(k)
    }
  }
  walk(root)
}

/* ---------- descendants ---------- */

interface DUnit extends PackNode {
  handle: Handle
  key: string
  level: number
  /** Partner families in display order; partner null when unknown. */
  fams: Array<{ partner: Handle | null; children: DUnit[] }>
  kids: DUnit[]
}

function buildDescendants(g: Graph, sp: Space, handle: Handle, level: number, maxLevel: number, key: string, seen: Set<Handle>): DUnit {
  seen.add(handle)
  const fams = partnerFamilies(g, handle).map(({ family, partner }, fi) => ({
    partner: partner?.handle ?? null,
    children:
      level < maxLevel
        ? family.children
            .filter((c) => g.people.has(c) && !seen.has(c))
            .map((c, ci) => buildDescendants(g, sp, c, level + 1, maxLevel, `${key}.${fi}.${ci}`, seen))
        : [],
  }))
  const partners = fams.filter((f) => f.partner).length
  const B = sp.breadthSize
  return {
    handle,
    key,
    level,
    fams,
    kids: fams.flatMap((f) => f.children),
    size: (partners + 1) * B + partners * sp.dims.gapPartner,
    pos: 0,
  }
}

/** Breadth centre of the unit's own person card. */
function personPos(sp: Space, u: DUnit) {
  return u.pos - u.size / 2 + sp.breadthSize / 2
}

function emitDescendants(sp: Space, g: Graph, root: DUnit, out: Layout, maxLevel: number) {
  const B = sp.breadthSize
  const step = B + sp.dims.gapPartner
  const walk = (u: DUnit) => {
    const pb = personPos(sp, u)
    const node = sp.node(u.key, u.handle, u.level, pb, u.level === 0 ? 'centre' : 'person')
    if (u.level >= maxLevel) {
      const hidden = childrenOf(g, u.handle).length
      if (hidden) node.stub = { side: sp.side(1), kind: 'children', count: hidden }
    } else {
      const hidden = hiddenChildCount(g, u.handle)
      if (hidden && !u.kids.length) node.stub = { side: sp.side(1), kind: 'children', count: hidden }
    }
    out.nodes.push(node)
    let slot = 0
    for (const f of u.fams) {
      let originB = pb
      if (f.partner) {
        slot++
        originB = pb + slot * step
        out.nodes.push(sp.node(`${u.key}~${slot}`, f.partner, u.level, originB, 'partner'))
        // bracket on the inner side joining person and partner
        const dIn = sp.depth(u.level) - sp.depthSize / 2
        const off = B * 0.3
        out.partnerLinks.push(
          roundedPath([sp.pt(dIn, pb + off), sp.pt(dIn - 14, pb + off), sp.pt(dIn - 14, originB), sp.pt(dIn, originB)], 6),
        )
      }
      for (const c of f.children) {
        out.links.push(sp.elbow(u.level, originB, c.level, personPos(sp, c)))
        walk(c)
      }
    }
  }
  walk(root)
}

/* ---------- public layouts ---------- */

function finish(out: Layout): Layout {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const n of out.nodes) {
    x0 = Math.min(x0, n.x)
    y0 = Math.min(y0, n.y)
    x1 = Math.max(x1, n.x + n.w)
    y1 = Math.max(y1, n.y + n.h)
  }
  if (!out.nodes.length) x0 = y0 = x1 = y1 = 0
  out.bounds = { x0, y0, x1, y1 }
  return out
}

const empty = (o: Orientation): Layout => ({
  nodes: [],
  links: [],
  partnerLinks: [],
  bounds: { x0: 0, y0: 0, x1: 0, y1: 0 },
  orientation: o,
})

export function layoutAncestors(g: Graph, centre: Handle, gens: number, o: Orientation): Layout {
  const sp = new Space(o, DIMS[o])
  const out = empty(o)
  const root = buildAncestors(g, centre, 0, gens, 'a', sp.breadthSize)
  pack(root, 0, sp.dims.gapBreadth)
  shift(root, -root.pos)
  emitAncestors(sp, g, root, o === 'horizontal' ? 1 : -1, out, true, gens)
  return finish(out)
}

export function layoutDescendants(g: Graph, centre: Handle, gens: number, o: Orientation): Layout {
  const sp = new Space(o, DIMS[o])
  const out = empty(o)
  const root = buildDescendants(g, sp, centre, 0, gens, 'd', new Set())
  pack(root, 0, sp.dims.gapBreadth)
  shift(root, -personPos(sp, root))
  emitDescendants(sp, g, root, out, gens)
  // the centre's parents, so there is always a way up
  const { father, mother } = parentsOf(g, centre)
  const parents = [father, mother].filter((p) => !!p)
  const dir = -1
  parents.forEach((p, i) => {
    const b = (i - (parents.length - 1) / 2) * (sp.breadthSize + sp.dims.gapBreadth)
    const node = sp.node(`dp${i}`, p.handle, dir, b, 'person')
    if (hasHiddenParents(g, p.handle) || parentsOf(g, p.handle).family) node.stub = { side: sp.side(dir), kind: 'parents' }
    out.nodes.push(node)
    out.links.push(sp.elbow(0, 0, dir, b))
  })
  return finish(out)
}

export function layoutHourglass(g: Graph, centre: Handle, anc: number, desc: number, o: Orientation): Layout {
  const sp = new Space(o, DIMS[o])
  const out = empty(o)
  const droot = buildDescendants(g, sp, centre, 0, desc, 'd', new Set())
  pack(droot, 0, sp.dims.gapBreadth)
  shift(droot, -personPos(sp, droot))
  emitDescendants(sp, g, droot, out, desc)
  const aroot = buildAncestors(g, centre, 0, anc, 'a', sp.breadthSize)
  pack(aroot, 0, sp.dims.gapBreadth)
  shift(aroot, -aroot.pos)
  emitAncestors(sp, g, aroot, -1, out, false, anc)
  return finish(out)
}

/* ---------- relationship graph ---------- */

/**
 * Everyone within N degrees, arranged in generation rows around the centre person.
 * Rows are ordered with a few barycentre sweeps; couples stay side by side.
 */
export function layoutRelationship(g: Graph, centre: Handle, target?: Handle | null): Layout {
  const o: Orientation = 'vertical'
  const sp = new Space(o, DIMS[o])
  const out = empty(o)
  const W = sp.breadthSize
  const gap = sp.dims.gapBreadth
  const coupleGap = sp.dims.gapPartner + 8

  // 1. generation by breadth-first search
  const gen = new Map<Handle, number>([[centre, 0]])
  const order: Handle[] = [centre]
  for (let i = 0; i < order.length; i++) {
    const h = order[i]
    const p = g.people.get(h)!
    const lv = gen.get(h)!
    const visit = (o2: Handle | null | undefined, l: number) => {
      if (o2 && g.people.has(o2) && !gen.has(o2)) {
        gen.set(o2, l)
        order.push(o2)
      }
    }
    for (const fh of [p.parentFamily, ...p.parentFamilies]) {
      const f = fh ? g.families.get(fh) : null
      if (!f) continue
      visit(f.father, lv - 1)
      visit(f.mother, lv - 1)
    }
    for (const { family, partnerHandle } of partnerFamilies(g, h)) {
      visit(partnerHandle, lv)
      family.children.forEach((c) => visit(c, lv + 1))
    }
    // siblings via parent families are reached through the parents
  }

  // 2. clusters of partners inside a row (union-find)
  const parent = new Map<Handle, Handle>()
  const find = (h: Handle): Handle => {
    const p = parent.get(h) ?? h
    if (p === h) return h
    const r = find(p)
    parent.set(h, r)
    return r
  }
  const families = [...g.families.values()]
  for (const f of families) {
    if (f.father && f.mother && gen.has(f.father) && gen.has(f.mother) && gen.get(f.father) === gen.get(f.mother)) {
      parent.set(find(f.father), find(f.mother))
    }
  }
  const clusters = new Map<Handle, Handle[]>()
  for (const h of order) {
    const r = find(h)
    if (!clusters.has(r)) clusters.set(r, [])
    clusters.get(r)!.push(h)
  }
  interface Cluster {
    members: Handle[]
    level: number
    x: number
    width: number
  }
  const rows = new Map<number, Cluster[]>()
  for (const members of clusters.values()) {
    // husband before wife for simple couples, chains keep discovery order
    if (members.length === 2 && g.people.get(members[0])?.sex === 'F' && g.people.get(members[1])?.sex === 'M') members.reverse()
    const level = gen.get(members[0])!
    const c: Cluster = { members, level, x: 0, width: members.length * W + (members.length - 1) * coupleGap }
    if (!rows.has(level)) rows.set(level, [])
    rows.get(level)!.push(c)
  }
  const levels = [...rows.keys()].sort((a, b) => a - b)

  const posOf = new Map<Handle, number>()
  const place = (row: Cluster[]) => {
    for (const c of row) c.members.forEach((m, i) => posOf.set(m, c.x - c.width / 2 + W / 2 + i * (W + coupleGap)))
  }
  const resolve = (row: Cluster[], desired: Map<Cluster, number>) => {
    row.sort((a, b) => (desired.get(a) ?? a.x) - (desired.get(b) ?? b.x))
    let prevEnd = -Infinity
    let moved = 0
    for (const c of row) {
      const want = desired.get(c) ?? c.x
      c.x = Math.max(want, prevEnd + gap * 2 + c.width / 2)
      prevEnd = c.x + c.width / 2
      moved += c.x - want
    }
    const avg = moved / row.length
    row.forEach((c) => (c.x -= avg))
    place(row)
  }
  // initial positions: discovery order
  for (const l of levels) {
    let x = 0
    for (const c of rows.get(l)!) {
      c.x = x + c.width / 2
      x += c.width + gap * 2
    }
    place(rows.get(l)!)
  }
  const neighbours = (h: Handle, dir: -1 | 1): Handle[] => {
    const p = g.people.get(h)!
    if (dir < 0) {
      return [p.parentFamily, ...p.parentFamilies]
        .map((fh) => (fh ? g.families.get(fh) : null))
        .flatMap((f) => (f ? [f.father, f.mother] : []))
        .filter((x): x is Handle => !!x && posOf.has(x) && gen.get(x) === (gen.get(h) ?? 0) - 1)
    }
    return childrenOf(g, h).filter((c) => posOf.has(c) && gen.get(c) === (gen.get(h) ?? 0) + 1)
  }
  const sweep = (ls: number[], dir: -1 | 1) => {
    for (const l of ls) {
      const row = rows.get(l)!
      const desired = new Map<Cluster, number>()
      for (const c of row) {
        const ns = c.members.flatMap((m) => neighbours(m, dir))
        if (ns.length) desired.set(c, ns.reduce((s, n) => s + posOf.get(n)!, 0) / ns.length)
      }
      resolve(row, desired)
    }
  }
  for (let i = 0; i < 4; i++) {
    sweep(levels, -1)
    sweep([...levels].reverse(), 1)
  }
  sweep(levels, -1)

  // 3. emit
  const cx = posOf.get(centre) ?? 0
  for (const h of order) {
    const l = gen.get(h)!
    const node = sp.node(`r${h}`, h, l, posOf.get(h)! - cx, h === centre ? 'centre' : h === target ? 'target' : 'person')
    out.nodes.push(node)
  }
  const half = sp.depthSize / 2
  let fi = 0
  for (const f of families) {
    const ps = [f.father, f.mother].filter((p): p is Handle => !!p && posOf.has(p))
    const kids = f.children.filter((c) => posOf.has(c))
    if (ps.length === 2) {
      const [a, b] = ps.map((p) => posOf.get(p)! - cx).sort((m, n) => m - n)
      const la = gen.get(ps[0])!
      const lb = gen.get(ps[1])!
      if (la === lb) {
        const d = sp.depth(la)
        const adjacent = b - a <= W + coupleGap + 1
        out.partnerLinks.push(
          adjacent
            ? roundedPath([sp.pt(d, a + W / 2), sp.pt(d, b - W / 2)])
            : `M${a},${d - half}C${a},${d - half - 40} ${b},${d - half - 40} ${b},${d - half}`,
        )
      }
    }
    if (!kids.length || !ps.length) continue
    const pl = Math.max(...ps.map((p) => gen.get(p)!))
    const kidsBelow = kids.filter((k) => gen.get(k)! === pl + 1)
    if (!kidsBelow.length) continue
    const pxs = ps.filter((p) => gen.get(p) === pl).map((p) => posOf.get(p)! - cx)
    const bothAdj = pxs.length === 2 && Math.abs(pxs[0] - pxs[1]) <= W + coupleGap + 1
    const ox = bothAdj ? (pxs[0] + pxs[1]) / 2 : pxs[0]
    const od = bothAdj ? sp.depth(pl) : sp.depth(pl) + half
    const busD = sp.depth(pl) + half + sp.dims.gapDepth / 2 + ((fi++ % 3) - 1) * 6
    for (const k of kidsBelow) {
      const kx = posOf.get(k)! - cx
      out.links.push(roundedPath([sp.pt(od, ox), sp.pt(busD, ox), sp.pt(busD, kx), sp.pt(sp.depth(pl + 1) - half, kx)], 10))
    }
  }
  // people with more relatives outside the loaded set get a subtle stub
  for (const n of out.nodes) {
    if (hasHiddenParents(g, n.handle)) n.stub = { side: 'up', kind: 'parents' }
    else {
      const hidden = hiddenChildCount(g, n.handle)
      if (hidden) n.stub = { side: 'down', kind: 'children', count: hidden }
    }
  }
  return finish(out)
}
