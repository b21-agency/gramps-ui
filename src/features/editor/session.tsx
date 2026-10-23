// Editor session: keeps secondary objects that a form creates or changes (new events, inline
// notes, citations, children ...) until the main object is saved, then writes everything.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ObjectKind } from '@/lib/types'
import { createObjects, putObject, type AnyObj, type Transaction } from './lib'

interface Pending {
  kind: ObjectKind
  obj: AnyObj
}

export interface EditorSession {
  /** Latest known version of an object (pending change > created > fetched). */
  objOf: (handle: string | null | undefined) => AnyObj | undefined
  isNew: (handle: string) => boolean
  /** Remember fetched objects (no write). */
  seed: (objs: Array<AnyObj | null | undefined>) => void
  create: (kind: ObjectKind, obj: AnyObj) => void
  /** Change an existing (or newly created) secondary object. */
  update: (kind: ObjectKind, obj: AnyObj) => void
  dirty: boolean
  /** Write main object + pending secondary objects. */
  save: (kind: ObjectKind, main: AnyObj, mode: 'create' | 'edit') => Promise<Transaction>
  version: number
  /** Inline mini forms (new citation, note, place ...) register while open; returns the unregister. */
  registerBox: (el: HTMLElement) => () => void
  /** The first inline mini form still open (its content would be lost on save). */
  openBox: () => HTMLElement | undefined
  openBoxes: number
}

const Ctx = createContext<EditorSession | null>(null)

/** The session if there is one (shared fields are also used outside an editor). */
export function useOptionalEditorSession() {
  return useContext(Ctx)
}

export function useEditorSession() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useEditorSession outside EditorSessionProvider')
  return s
}

/** Only keep created objects that are actually referenced by something that will be written. */
function referencedCreates(roots: AnyObj[], creates: Record<string, Pending>) {
  const included = new Map<string, Pending>()
  let text = JSON.stringify(roots)
  let changed = true
  while (changed) {
    changed = false
    for (const [h, p] of Object.entries(creates)) {
      if (included.has(h)) continue
      if (text.includes(`"${h}"`)) {
        included.set(h, p)
        text += JSON.stringify(p.obj)
        changed = true
      }
    }
  }
  return [...included.values()]
}

export function EditorSessionProvider({ children, seeds }: { children: ReactNode; seeds?: AnyObj[] }) {
  const known = useRef<Record<string, AnyObj> | null>(null)
  known.current ??= Object.fromEntries((seeds ?? []).filter((o) => o?.handle).map((o) => [o.handle, o]))
  const [creates, setCreates] = useState<Record<string, Pending>>({})
  const [updates, setUpdates] = useState<Record<string, Pending>>({})
  const [version, setVersion] = useState(0)
  const boxes = useRef(new Set<HTMLElement>())
  const [openBoxes, setOpenBoxes] = useState(0)
  const registerBox = useCallback((el: HTMLElement) => {
    boxes.current.add(el)
    setOpenBoxes(boxes.current.size)
    return () => {
      boxes.current.delete(el)
      setOpenBoxes(boxes.current.size)
    }
  }, [])

  const seed = useCallback((objs: Array<AnyObj | null | undefined>) => {
    let added = false
    for (const o of objs) {
      if (o?.handle && !known.current![o.handle]) {
        known.current![o.handle] = o
        added = true
      }
    }
    if (added) setVersion((v) => v + 1)
  }, [])

  const create = useCallback((kind: ObjectKind, obj: AnyObj) => {
    setCreates((c) => ({ ...c, [obj.handle]: { kind, obj } }))
  }, [])

  const update = useCallback(
    (kind: ObjectKind, obj: AnyObj) => {
      if (creates[obj.handle]) setCreates((c) => ({ ...c, [obj.handle]: { kind, obj } }))
      else setUpdates((u) => ({ ...u, [obj.handle]: { kind, obj } }))
    },
    [creates],
  )

  const value = useMemo<EditorSession>(
    () => ({
      objOf: (h) => (h ? (updates[h]?.obj ?? creates[h]?.obj ?? known.current![h]) : undefined),
      isNew: (h) => !!creates[h],
      seed,
      create,
      update,
      dirty: Object.keys(updates).length > 0 || Object.keys(creates).length > 0,
      version,
      registerBox,
      openBox: () => [...boxes.current].find((el) => el.isConnected),
      openBoxes,
      save: async (kind, main, mode) => {
        const tx: Transaction = []
        const changed = Object.values(updates)
        const newOnes = referencedCreates([main, ...changed.map((p) => p.obj)], creates)
        if (mode === 'create') {
          tx.push(...(await createObjects([...newOnes.map((p) => p.obj), main])))
        } else if (newOnes.length) {
          tx.push(...(await createObjects(newOnes.map((p) => p.obj))))
        }
        for (const p of changed) tx.push(...(await putObject(p.kind, p.obj)))
        if (mode === 'edit') tx.push(...(await putObject(kind, main)))
        return tx
      },
    }),
    [creates, updates, seed, create, update, version, registerBox, openBoxes],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
