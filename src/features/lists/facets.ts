// Shared filter facets that most lists offer (same rules as the classic UI's filter panel).
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Link2, Lock, MapPin, Shapes, SlidersHorizontal, TextSearch } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import type { ObjectKind } from '@/lib/types'
import type { FilterDef } from './filters'
import { multiValues } from './filters'
import { and, rule, type Rule } from './rules'

/** "Has notes / media / sources …": each checked entry is `<Rule> ["0","greater than"]`, all must match. */
export function associationsFacet(t: TFunction<'lists'>, entries: Record<string, string>): FilterDef {
  return {
    id: 'has',
    type: 'multi',
    label: t('facets.has'),
    icon: Link2,
    options: Object.entries(entries).map(([name, key]) => ({ value: name, label: t(`facets.assoc.${key}`) })),
    toRule: (v) => {
      const rules: Rule[] = multiValues(v).map((name) => rule(name, '0', 'greater than'))
      return rules.length ? and(...rules) : null
    },
  }
}

/** Private / not private. Only offered to users who can see private records at all. */
export function privacyFacet(t: TFunction<'lists'>, privateRule: string, publicRule?: string): FilterDef {
  return {
    id: 'privacy',
    type: 'select',
    label: t('facets.privacy'),
    icon: Lock,
    options: [
      { value: 'private', label: t('facets.private') },
      { value: 'public', label: t('facets.public') },
    ],
    // without a dedicated "public" rule, invert the private rule
    toRule: (v) =>
      v === 'private' ? rule(privateRule) : publicRule ? rule(publicRule) : { function: 'and', invert: true, rules: [rule(privateRule)] },
  }
}

/** Parameterless rules ("people with children", ...), all checked ones must match. */
export function propertiesFacet(t: TFunction<'lists'>, names: string[]): FilterDef {
  return {
    id: 'props',
    type: 'multi',
    label: t('facets.properties'),
    icon: SlidersHorizontal,
    options: names.map((name) => ({ value: name, label: t(`facets.prop.${name}`) })),
    toRule: (v) => {
      const rules: Rule[] = multiValues(v).map((name) => rule(name))
      return rules.length ? and(...rules) : null
    },
  }
}

const ASSOC: Partial<Record<ObjectKind, Record<string, string>>> = {
  person: { HasNote: 'notes', HasSourceCount: 'sources', HasAddress: 'addresses', HasAssociation: 'associations' },
  family: { HasGallery: 'media', HasNote: 'notes', HasSourceCount: 'sources' },
  event: { HasGallery: 'media', HasNote: 'notes', HasSourceCount: 'sources' },
  place: { HasGallery: 'media', HasNote: 'notes', HasSourceCount: 'sources' },
  source: { HasGallery: 'media', HasNote: 'notes' },
  citation: { HasGallery: 'media', HasNote: 'notes' },
  media: { HasSourceCount: 'sources' },
}
const PRIVATE: Record<ObjectKind, [string, string?]> = {
  person: ['PeoplePrivate', 'PeoplePublic'],
  family: ['FamilyPrivate'],
  event: ['EventPrivate'],
  place: ['PlacePrivate'],
  source: ['SourcePrivate'],
  citation: ['CitationPrivate'],
  repository: ['RepoPrivate'],
  note: ['NotePrivate'],
  media: ['MediaPrivate'],
}
const PERSON_PROPS = [
  'HasAlternateName',
  'HasNickname',
  'HaveAltFamilies',
  'HaveChildren',
  'IncompleteNames',
  'NeverMarried',
  'MultipleMarriages',
  'NoBirthdate',
  'NoDeathdate',
  'PersonWithIncompleteEvent',
  'FamilyWithIncompleteEvent',
  'MissingParent',
  'Disconnected',
]

/** The classic UI's further filter sections per list (properties, associations, text fields, privacy). */
export function useExtraFacets(kind: ObjectKind): FilterDef[] {
  const { t } = useTranslation('lists')
  const { can } = useAuth()
  const viewPrivate = can('ViewPrivate')
  return useMemo(() => {
    const out: FilterDef[] = []
    if (kind === 'person') out.push(propertiesFacet(t, PERSON_PROPS))
    if (kind === 'event') {
      out.push({ id: 'desc', type: 'text', label: t('facets.description'), icon: TextSearch, toRule: (v) => rule('HasData', '', '', '', v) })
      out.push({ id: 'place', type: 'text', label: t('facets.place'), icon: MapPin, toRule: (v) => rule('HasData', '', '', v, '') })
    }
    if (kind === 'media')
      out.push({
        id: 'usedby',
        type: 'select',
        label: t('facets.subject'),
        icon: Shapes,
        options: ['Person', 'Family', 'Event', 'Place', 'Citation', 'Source'].map((v) => ({ value: v, label: t(`facets.objectType.${v}`) })),
        toRule: (v) => rule('IsReferencedByObjectType', v),
      })
    const assoc = ASSOC[kind]
    if (assoc) out.push(associationsFacet(t, assoc))
    if (viewPrivate) out.push(privacyFacet(t, ...PRIVATE[kind]))
    return out
  }, [kind, t, viewPrivate])
}
