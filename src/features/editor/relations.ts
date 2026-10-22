// Linking people into families (add parent / partner / child / sibling).
import { store } from '@/store'
import { objectsApi } from '@/api/enhanced/objects'
import { unwrapApi } from '@/api/enhanced/editor'
import { classOf, emptyObject, fetchWritable, putObject, type AnyObj, type Transaction } from './lib'

export type Relation = 'father' | 'mother' | 'parent' | 'partner' | 'child' | 'sibling'

function childRef(h: string) {
  return { _class: 'ChildRef', ref: h, frel: 'Birth', mrel: 'Birth', private: false, citation_list: [], note_list: [] }
}

async function createFamily(fields: AnyObj): Promise<Transaction> {
  const fam = { ...emptyObject('family'), type: 'Unknown', ...fields }
  return unwrapApi(
    store.dispatch(objectsApi.endpoints.createObject.initiate({ kind: 'family', body: { ...fam, _class: classOf.family } })),
  ).then((tx) => [...tx] as Transaction) // mutable copy (RTK results are frozen)
}

/** Add an existing child to an existing family. */
export async function addChildToFamily(familyHandle: string, childHandle: string): Promise<Transaction> {
  const fam = await fetchWritable('family', familyHandle)
  if ((fam.child_ref_list ?? []).some((c: AnyObj) => c.ref === childHandle)) return []
  if (fam.father_handle === childHandle || fam.mother_handle === childHandle) throw new Error('self')
  fam.child_ref_list = [...(fam.child_ref_list ?? []), childRef(childHandle)]
  return putObject('family', fam)
}

/** Slot for a person of this gender ("father_handle" for men, "mother_handle" for women, else the free one). */
function slotFor(gender: number, fam?: AnyObj): 'father_handle' | 'mother_handle' {
  if (gender === 1) return 'father_handle'
  if (gender === 0) return 'mother_handle'
  if (fam && !fam.father_handle) return 'father_handle'
  if (fam && !fam.mother_handle) return 'mother_handle'
  return 'father_handle'
}

/** Make `parentHandle` a parent of `childHandle` (fills the free slot of the main parent family, or creates one). */
export async function addParent(childHandle: string, parentHandle: string): Promise<Transaction> {
  if (childHandle === parentHandle) throw new Error('self')
  const [child, parent] = await Promise.all([fetchWritable('person', childHandle), fetchWritable('person', parentHandle)])
  const famHandle: string | undefined = child.parent_family_list?.[0]
  if (famHandle) {
    const fam = await fetchWritable('family', famHandle)
    const slot = slotFor(parent.gender, fam)
    if (!fam[slot]) {
      fam[slot] = parentHandle
      return putObject('family', fam)
    }
  }
  return createFamily({ [slotFor(parent.gender)]: parentHandle, child_ref_list: [childRef(childHandle)] })
}

/** New family with both partners, placed by gender. */
export async function addPartner(personHandle: string, partnerHandle: string): Promise<Transaction> {
  if (personHandle === partnerHandle) throw new Error('self')
  const [a, b] = await Promise.all([fetchWritable('person', personHandle), fetchWritable('person', partnerHandle)])
  let father = a.handle
  let mother = b.handle
  if (a.gender === 0 || b.gender === 1) {
    father = b.handle
    mother = a.handle
  }
  return createFamily({ father_handle: father, mother_handle: mother })
}

/** Child of a person: into the given family, or a new single-parent family. */
export async function addChild(parentHandle: string, childHandle: string, familyHandle?: string): Promise<Transaction> {
  if (parentHandle === childHandle) throw new Error('self')
  if (familyHandle) return addChildToFamily(familyHandle, childHandle)
  const parent = await fetchWritable('person', parentHandle)
  return createFamily({ [slotFor(parent.gender)]: parentHandle, child_ref_list: [childRef(childHandle)] })
}

/** Sibling: child of the person's main parent family, or a new family with both as children. */
export async function addSibling(personHandle: string, siblingHandle: string): Promise<Transaction> {
  if (personHandle === siblingHandle) throw new Error('self')
  const person = await fetchWritable('person', personHandle)
  const famHandle: string | undefined = person.parent_family_list?.[0]
  if (famHandle) return addChildToFamily(famHandle, siblingHandle)
  return createFamily({ child_ref_list: [childRef(personHandle), childRef(siblingHandle)] })
}

/** Add an event reference to a person or family. */
export async function addEventRef(kind: 'person' | 'family', handle: string, eventHandle: string, role: string) {
  const obj = await fetchWritable(kind, handle)
  obj.event_ref_list = [
    ...(obj.event_ref_list ?? []),
    { _class: 'EventRef', ref: eventHandle, role, private: false, citation_list: [], note_list: [], attribute_list: [] },
  ]
  return putObject(kind, obj)
}

/** Add a media reference to a person (or other object with media_list). */
export async function addMediaRef(kind: 'person' | 'family' | 'event' | 'place' | 'source' | 'citation', handle: string, mediaHandle: string) {
  const obj = await fetchWritable(kind, handle)
  if ((obj.media_list ?? []).some((m: AnyObj) => m.ref === mediaHandle)) return []
  obj.media_list = [
    ...(obj.media_list ?? []),
    { _class: 'MediaRef', ref: mediaHandle, rect: [], private: false, citation_list: [], note_list: [], attribute_list: [] },
  ]
  return putObject(kind, obj)
}
