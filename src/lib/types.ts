// Shapes returned by the Gramps Web API. Only the fields the UI uses are typed.

export type Handle = string

export interface DateVal {
  _class?: 'Date'
  calendar: number
  modifier: number
  quality: number
  dateval: [number, number, number, boolean] | [number, number, number, boolean, number, number, number, boolean]
  sortval: number
  newyear: number
  text: string
  year?: number
}

export interface TypedValue {
  _class?: string
  string: string
  value?: number
}

export interface Surname {
  surname: string
  prefix: string
  primary: boolean
  connector: string
  origintype?: TypedValue | string
}

export interface Name {
  _class?: 'Name'
  first_name: string
  call: string
  nick: string
  title: string
  suffix: string
  surname_list: Surname[]
  type: TypedValue | string
  date?: DateVal
  citation_list?: Handle[]
  note_list?: Handle[]
  private?: boolean
}

export interface MediaRef {
  ref: Handle
  rect: [number, number, number, number] | null
  private?: boolean
  attribute_list?: Attribute[]
  citation_list?: Handle[]
  note_list?: Handle[]
}

export interface EventRef {
  ref: Handle
  role: TypedValue | string
  private?: boolean
  attribute_list?: Attribute[]
  note_list?: Handle[]
  citation_list?: Handle[]
}

export interface ChildRef {
  ref: Handle
  frel: TypedValue | string
  mrel: TypedValue | string
  private?: boolean
}

export interface PersonRef {
  ref: Handle
  rel: string
  private?: boolean
  citation_list?: Handle[]
  note_list?: Handle[]
}

export interface Attribute {
  type: TypedValue | string
  value: string
  private?: boolean
  citation_list?: Handle[]
  note_list?: Handle[]
}

export interface Url {
  path: string
  desc: string
  type: TypedValue | string
  private?: boolean
}

export interface Address {
  street: string
  locality: string
  city: string
  county: string
  state: string
  country: string
  postal: string
  phone: string
  date?: DateVal
  private?: boolean
}

interface Base {
  handle: Handle
  gramps_id: string
  change: number
  private: boolean
  tag_list: Handle[]
  note_list?: Handle[]
  citation_list?: Handle[]
  media_list?: MediaRef[]
  backlinks?: Record<string, Handle[]>
  extended?: Extended
}

export interface Extended {
  citations?: Citation[]
  events?: GEvent[]
  families?: Family[]
  media?: Media[]
  notes?: Note[]
  parent_families?: Family[]
  primary_parent_family?: Family
  people?: Person[]
  tags?: Tag[]
  father?: Person
  mother?: Person
  children?: Person[]
  place?: Place
  source?: Source
  repositories?: Repository[]
  backlinks?: Record<string, Array<Record<string, unknown>>>
}

/* ---------- profile (?profile=all) ---------- */

export interface EventProfile {
  type: string
  date: string
  place: string
  place_name: string
  summary: string
  role?: string
  age?: string
  citations?: number
  confidence?: number
  description?: string
  span?: string
}

export interface PersonProfile {
  handle: Handle
  gramps_id: string
  name_display: string
  name_given: string
  name_surname: string
  name_suffix: string
  sex: 'M' | 'F' | 'U' | 'X' | string
  birth: EventProfile | Record<string, never>
  death: EventProfile | Record<string, never>
  events?: EventProfile[]
  families?: FamilyProfile[]
  primary_parent_family?: FamilyProfile | Record<string, never>
  other_parent_families?: FamilyProfile[]
  references?: Record<string, unknown>
  addresses?: unknown[]
}

export interface FamilyProfile {
  handle: Handle
  gramps_id: string
  family_surname?: string
  relationship: string
  father?: PersonProfile | Record<string, never>
  mother?: PersonProfile | Record<string, never>
  children?: PersonProfile[]
  divorce?: EventProfile | Record<string, never>
  marriage?: EventProfile | Record<string, never>
  events?: EventProfile[]
}

/* ---------- primary objects ---------- */

export interface Person extends Base {
  gender: 0 | 1 | 2 | 3 // 0 female, 1 male, 2 unknown, 3 other
  media_list: MediaRef[]
  primary_name: Name
  alternate_names: Name[]
  event_ref_list: EventRef[]
  family_list: Handle[]
  parent_family_list: Handle[]
  birth_ref_index: number
  death_ref_index: number
  person_ref_list: PersonRef[]
  address_list: Address[]
  attribute_list: Attribute[]
  urls: Url[]
  lds_ord_list?: unknown[]
  profile?: PersonProfile
}

export interface Family extends Base {
  father_handle: Handle | null
  mother_handle: Handle | null
  child_ref_list: ChildRef[]
  event_ref_list: EventRef[]
  type: TypedValue | string
  attribute_list: Attribute[]
  profile?: FamilyProfile
}

export interface GEvent extends Base {
  type: TypedValue | string
  date: DateVal
  description: string
  place: Handle
  attribute_list: Attribute[]
  profile?: EventProfile & { participants?: { people?: Array<{ role: string; person: PersonProfile }>; families?: Array<{ role: string; family: FamilyProfile }> } }
}

export interface PlaceName {
  value: string
  lang: string
  date?: DateVal
}
export interface PlaceRef {
  ref: Handle
  date?: DateVal
}

export interface Place extends Base {
  title: string
  name: PlaceName
  alt_names: PlaceName[]
  lat: string
  long: string
  place_type: TypedValue | string
  placeref_list: PlaceRef[]
  code: string
  alt_loc?: unknown[]
  urls: Url[]
  profile?: {
    gramps_id: string
    name: string
    type: string
    lat?: number
    long?: number
    parent_places?: Array<{ gramps_id: string; handle: Handle; name: string; type: string }>
    alternate_names?: string[]
    alternate_place_names?: Array<{ value: string; date_str?: string }>
    summary?: string
  }
}

export interface Source extends Base {
  title: string
  author: string
  pubinfo: string
  abbrev: string
  reporef_list: Array<{ ref: Handle; call_number: string; media_type: TypedValue | string; note_list: Handle[] }>
  attribute_list: Attribute[]
}

export interface Citation extends Base {
  source_handle: Handle
  page: string
  date: DateVal
  confidence: number
  attribute_list: Attribute[]
  profile?: { source?: { title: string; author: string; gramps_id: string }; date?: string; page?: string }
}

export interface Repository extends Base {
  name: string
  type: TypedValue | string
  address_list: Address[]
  urls: Url[]
}

export interface StyledText {
  string: string
  tags: unknown[]
}

export interface Note extends Base {
  text: StyledText
  format: number
  type: TypedValue | string
  formatted?: { html?: string }
}

export interface Media extends Base {
  path: string
  mime: string
  desc: string
  checksum: string
  date: DateVal
  attribute_list: Attribute[]
  profile?: Record<string, unknown>
}

export interface Tag {
  handle: Handle
  name: string
  color: string
  priority: number
  change: number
}

export type ObjectKind =
  | 'person'
  | 'family'
  | 'event'
  | 'place'
  | 'source'
  | 'citation'
  | 'repository'
  | 'note'
  | 'media'

export const endpointOf: Record<ObjectKind, string> = {
  person: 'people',
  family: 'families',
  event: 'events',
  place: 'places',
  source: 'sources',
  citation: 'citations',
  repository: 'repositories',
  note: 'notes',
  media: 'media',
}

export interface SearchHit {
  handle: Handle
  object_type: ObjectKind
  object: Person & Family & GEvent & Place & Source & Citation & Repository & Note & Media
  rank: number
  score: number
}

export interface Metadata {
  database: { id: string; name: string; type: string }
  default_person: Handle | null
  gramps: { version: string }
  gramps_webapi: { version: string; schema: string }
  locale: { lang: string; language: string; description: string }
  object_counts: Record<string, number>
  researcher: Record<string, string>
  search: { sifts?: { count: number } }
  server?: Record<string, unknown>
}

export interface UserInfo {
  name: string
  email: string
  full_name: string
  role: number
  tree?: string
}
