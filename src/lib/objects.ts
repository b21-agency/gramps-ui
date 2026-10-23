import {
  BookOpen,
  CalendarDays,
  Image,
  Landmark,
  MapPin,
  NotebookPen,
  Quote,
  UserRound,
  UsersRound,
} from 'lucide-react'
import type { ObjectKind } from './types'
import { lifespan, personName, profileName, typeStr } from './format'

export const kindIcon: Record<ObjectKind, typeof UserRound> = {
  person: UserRound,
  family: UsersRound,
  event: CalendarDays,
  place: MapPin,
  source: BookOpen,
  citation: Quote,
  repository: Landmark,
  note: NotebookPen,
  media: Image,
}

/** Route for an object, matching the classic Gramps Web URLs (/person/I0044 ...). */
export function objectPath(kind: ObjectKind | string, grampsId: string) {
  return `/${kind}/${grampsId}`
}

/** Map API class names / backlink keys ("person", "Person", "people") to ObjectKind. */
export function normalizeKind(s: string): ObjectKind | null {
  const k = s.toLowerCase()
  const map: Record<string, ObjectKind> = {
    person: 'person',
    people: 'person',
    family: 'family',
    families: 'family',
    event: 'event',
    events: 'event',
    place: 'place',
    places: 'place',
    source: 'source',
    sources: 'source',
    citation: 'citation',
    citations: 'citation',
    repository: 'repository',
    repositories: 'repository',
    note: 'note',
    notes: 'note',
    media: 'media',
  }
  return map[k] ?? null
}

/** Human title + subtitle for any object (used in search, backlinks, bookmarks). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function describeObject(kind: ObjectKind, o: any): { title: string; subtitle: string } {
  if (!o) return { title: '', subtitle: '' }
  const p = o.profile
  switch (kind) {
    case 'person': {
      const title = p ? profileName(p) : personName(o)
      return { title: title || o.gramps_id, subtitle: p ? lifespan(p.birth, p.death) : '' }
    }
    case 'family': {
      if (p) {
        const f = profileName(p.father) || '…'
        const m = profileName(p.mother) || '…'
        return { title: `${f} & ${m}`, subtitle: p.relationship ?? '' }
      }
      // with extend=all the partners come as raw people
      const names = [o.extended?.father, o.extended?.mother].map((x) => (x ? personName(x) : '')).filter(Boolean)
      return { title: names.join(' & ') || o.gramps_id, subtitle: typeStr(o.type) }
    }
    case 'event':
      return {
        title: p?.summary || typeStr(o.type) || o.gramps_id,
        subtitle: [p?.date, p?.place_name || p?.place].filter(Boolean).join(', '),
      }
    case 'place':
      return { title: p?.name || o.name?.value || o.title || o.gramps_id, subtitle: p?.type || typeStr(o.place_type) }
    case 'source':
      return { title: o.title || o.gramps_id, subtitle: o.author ?? '' }
    case 'citation':
      return {
        title: o.page || p?.source?.title || o.gramps_id,
        subtitle: p?.source?.title ?? '',
      }
    case 'repository':
      return { title: o.name || o.gramps_id, subtitle: typeStr(o.type) }
    case 'note': {
      const text: string = o.text?.string ?? ''
      return { title: text.slice(0, 90) || o.gramps_id, subtitle: typeStr(o.type) }
    }
    case 'media':
      return { title: o.desc || o.path || o.gramps_id, subtitle: o.mime ?? '' }
    default:
      return { title: o.name || o.title || o.gramps_id || '', subtitle: '' }
  }
}
