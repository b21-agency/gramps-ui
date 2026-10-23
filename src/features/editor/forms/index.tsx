import type { ObjectKind } from '@/lib/types'
import type { EditorSession } from '../session'
import type { AnyObj } from '../lib'
import { PersonForm, personVitalIndexes } from './person-form'
import { FamilyForm } from './family-form'
import { CitationForm, EventForm, MediaForm, NoteForm, PlaceForm, RepositoryForm, SourceForm } from './simple-forms'

export function ObjectForm({ kind, value, onChange }: { kind: ObjectKind; value: AnyObj; onChange: (o: AnyObj) => void }) {
  switch (kind) {
    case 'person':
      return <PersonForm value={value} onChange={onChange} />
    case 'family':
      return <FamilyForm value={value} onChange={onChange} />
    case 'event':
      return <EventForm value={value} onChange={onChange} />
    case 'place':
      return <PlaceForm value={value} onChange={onChange} />
    case 'source':
      return <SourceForm value={value} onChange={onChange} />
    case 'citation':
      return <CitationForm value={value} onChange={onChange} />
    case 'repository':
      return <RepositoryForm value={value} onChange={onChange} />
    case 'note':
      return <NoteForm value={value} onChange={onChange} />
    case 'media':
      return <MediaForm value={value} onChange={onChange} />
  }
}

/** Returns an `editor:` translation key describing what is missing, or null. */
export function validateObject(kind: ObjectKind, o: AnyObj): string | null {
  switch (kind) {
    case 'person': {
      const n = o.primary_name ?? {}
      const hasName = !!n.first_name?.trim() || (n.surname_list ?? []).some((s: AnyObj) => s.surname?.trim())
      return hasName ? null : 'validation.personName'
    }
    case 'family':
      if (o.father_handle && o.father_handle === o.mother_handle) return 'validation.samePartner'
      return o.father_handle || o.mother_handle || o.child_ref_list?.length ? null : 'validation.familyEmpty'
    case 'place': {
      if (!o.name?.value?.trim()) return 'validation.placeName'
      // both coordinates or none; decimal ones in range (other Gramps notations, e.g. 50°52'21"N, pass)
      const coord = (v: unknown, max: number) => {
        const s = String(v ?? '').trim().replace(',', '.')
        if (!s) return null
        const n = Number(s)
        if (!Number.isFinite(n)) return 0
        return Math.abs(n) > max ? NaN : n
      }
      const lat = coord(o.lat, 90)
      const lng = coord(o.long, 180)
      return Number.isNaN(lat) || Number.isNaN(lng) || (lat === null) !== (lng === null) ? 'validation.placeCoord' : null
    }
    case 'source':
      return o.title?.trim() ? null : 'validation.sourceTitle'
    case 'citation':
      return o.source_handle ? null : 'validation.citationSource'
    case 'repository':
      return o.name?.trim() ? null : 'validation.repositoryName'
    case 'note':
      return o.text?.string?.trim() ? null : 'validation.noteText'
    case 'event':
      return o.type ? null : 'validation.eventType'
    default:
      return null
  }
}

/** Last fixes before writing (birth/death index, coordinates ...). */
export function finalizeObject(kind: ObjectKind, o: AnyObj, session: EditorSession): AnyObj {
  const obj = { ...o }
  if (kind === 'person') {
    const refs = obj.event_ref_list ?? []
    Object.assign(
      obj,
      personVitalIndexes(obj, session.objOf, { birth: refs[obj.birth_ref_index]?.ref, death: refs[obj.death_ref_index]?.ref }),
    )
    const trimName = (n: AnyObj) => ({
      ...n,
      first_name: (n.first_name ?? '').trim(),
      surname_list: (n.surname_list ?? []).map((s: AnyObj) => ({ ...s, surname: (s.surname ?? '').trim(), prefix: (s.prefix ?? '').trim() })),
    })
    obj.primary_name = trimName(obj.primary_name)
    obj.alternate_names = (obj.alternate_names ?? []).map(trimName)
  }
  if (kind === 'place') {
    obj.lat = String(obj.lat ?? '').trim().replace(',', '.')
    obj.long = String(obj.long ?? '').trim().replace(',', '.')
  }
  if (kind === 'family') {
    obj.father_handle = obj.father_handle || ''
    obj.mother_handle = obj.mother_handle || ''
  }
  return obj
}
