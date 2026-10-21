import { lazy, Suspense, useMemo, useState, type ComponentType } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Lock, UserRoundPlus } from 'lucide-react'
import { Page, PageSkeleton } from '@/components/app-shell'
import { EmptyState, ErrorState } from '@/components/states'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { describeObject, objectPath } from '@/lib/objects'
import { surnameOf } from '@/lib/format'
import type { ObjectKind } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { emptyName, emptyObject, endpointsOfTx, errorMessage, invalidateAfterWrite, txGrampsId, type AnyObj, type Transaction } from './lib'
import { ObjectEditor } from './object-editor'
import { addChild, addChildToFamily, addEventRef, addParent, addPartner, addSibling } from './relations'
import { MediaUpload } from './media-upload'
import { ParticipantsField, type Participant } from './participants-field'

const BlogPostEditor = lazy(async () => ({
  default: (await import('@/features/blog/blog-post-editor')).BlogPostEditor as unknown as ComponentType<{ onCancel?: () => void }>,
}))
const TaskEditor = lazy(async () => ({
  default: (await import('@/features/tasks/task-editor')).TaskEditor as unknown as ComponentType<{ onCancel?: () => void }>,
}))

const KINDS: ObjectKind[] = ['person', 'family', 'event', 'place', 'source', 'citation', 'repository', 'note', 'media']

/** Routed at /:newKind — /new_person, /new_family, ... /new_blog_post, /new_task. */
export function NewObjectPage() {
  const { newKind = '' } = useParams()
  const { t } = useTranslation(['editor', 'common'])
  const { can } = useAuth()
  const navigate = useNavigate()
  const m = newKind.match(/^new_(\w+)$/)
  const what = m?.[1]

  if (what === 'blog_post' || what === 'task') {
    const Editor = what === 'blog_post' ? BlogPostEditor : TaskEditor
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Editor onCancel={() => navigate(-1)} />
      </Suspense>
    )
  }
  const kind = KINDS.find((k) => k === what)
  if (!kind) return <EmptyState title={t('common:error.pageNotFound')} className="py-24" />
  if (!can('AddObject') || (kind === 'family' && !can('EditObject')))
    return (
      <EmptyState icon={Lock} title={t('editor:noPermission.title')} className="py-24">
        {kind === 'family' && can('AddObject') ? t('editor:noPermission.family') : t('editor:noPermission.add')}
      </EmptyState>
    )
  if (kind === 'media') return <MediaUpload />
  return <NewObjectForm key={newKind + window.location.search} kind={kind} />
}

type RelationParam = 'childOf' | 'childOfPerson' | 'parentOf' | 'partnerOf' | 'siblingOf'
const RELATION_PARAMS: RelationParam[] = ['childOf', 'childOfPerson', 'parentOf', 'partnerOf', 'siblingOf']

function NewObjectForm({ kind }: { kind: ObjectKind }) {
  const { t } = useTranslation(['editor', 'common'])
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { can } = useAuth()
  const [params] = useSearchParams()
  const what = t(`common:object.${kind}`)
  useTitle(t('editor:newTitle', { what }))

  // relation for new people (?childOf=<family>, ?parentOf=<person>, ...)
  const relation = kind === 'person' ? RELATION_PARAMS.find((p) => params.get(p)) : undefined
  const relHandle = relation ? params.get(relation)! : null
  const relKind: ObjectKind = relation === 'childOf' ? 'family' : 'person'
  const eventOwner = kind === 'event' ? (params.get('person') ? 'person' : params.get('family') ? 'family' : null) : null
  const eventOwnerHandle = eventOwner ? params.get(eventOwner)! : null

  const related = useQuery({
    queryKey: ['editor', 'related', relKind, relHandle ?? eventOwnerHandle],
    enabled: !!(relHandle || eventOwnerHandle),
    queryFn: () =>
      api<AnyObj>(`/${(eventOwner ?? relKind) === 'family' ? 'families' : 'people'}/${relHandle ?? eventOwnerHandle}`, {
        query: { extend: 'all', profile: 'self' },
      }),
  })

  // participants of a new event: the person/family it was started from, plus any added in the form
  const [participants, setParticipants] = useState<Participant[]>(() =>
    eventOwner && eventOwnerHandle
      ? [{ kind: eventOwner, handle: eventOwnerHandle, role: params.get('role') ?? (eventOwner === 'family' ? 'Family' : 'Primary') }]
      : [],
  )

  const initial = useMemo(() => {
    const o = emptyObject(kind)
    const r = related.data
    if (kind === 'person') {
      const g = params.get('gender')
      if (g && ['0', '1', '2', '3'].includes(g)) o.gender = Number(g)
      let surname = params.get('surname') ?? ''
      if (!surname && r) {
        if (relation === 'childOf') surname = surnameOf(r.extended?.father?.primary_name) || surnameOf(r.extended?.mother?.primary_name)
        else if (relation === 'childOfPerson' || relation === 'siblingOf') surname = surnameOf(r.primary_name)
        else if (relation === 'parentOf' && o.gender === 1) surname = surnameOf(r.primary_name)
      }
      o.primary_name = { ...emptyName(), first_name: params.get('given') ?? '' }
      o.primary_name.surname_list[0].surname = surname
    }
    if (kind === 'family') {
      o.father_handle = params.get('father') ?? ''
      o.mother_handle = params.get('mother') ?? ''
      const child = params.get('child')
      if (child) o.child_ref_list = [{ _class: 'ChildRef', ref: child, frel: 'Birth', mrel: 'Birth', private: false, citation_list: [], note_list: [] }]
      o.type = 'Unknown'
    }
    if (kind === 'event') {
      o.type = params.get('type') ?? (eventOwner === 'family' ? 'Marriage' : 'Birth')
      if (params.get('place')) o.place = params.get('place')
    }
    if (kind === 'citation' && params.get('source')) o.source_handle = params.get('source')
    if (kind === 'place' && params.get('parent')) o.placeref_list = [{ _class: 'PlaceRef', ref: params.get('parent') }]
    if (kind === 'note' && params.get('type')) o.type = params.get('type')
    return o
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, related.data])

  if ((relHandle || eventOwnerHandle) && related.isLoading) return <PageSkeleton />
  if ((relHandle || eventOwnerHandle) && related.isError) return <ErrorState error={related.error} onRetry={() => related.refetch()} />
  if (relation && !can('EditObject'))
    return (
      <EmptyState icon={Lock} title={t('editor:noPermission.title')} className="py-24">
        {t('editor:noPermission.family')}
      </EmptyState>
    )

  const relTitle = related.data ? describeObject(eventOwner ?? relKind, related.data).title : ''

  const afterCreate = async (tx: Transaction, obj: AnyObj) => {
    const extra: Transaction = []
    try {
      if (relation && relHandle) {
        if (relation === 'childOf') extra.push(...(await addChildToFamily(relHandle, obj.handle)))
        if (relation === 'childOfPerson') extra.push(...(await addChild(relHandle, obj.handle)))
        if (relation === 'parentOf') extra.push(...(await addParent(relHandle, obj.handle)))
        if (relation === 'partnerOf') extra.push(...(await addPartner(relHandle, obj.handle)))
        if (relation === 'siblingOf') extra.push(...(await addSibling(relHandle, obj.handle)))
      }
      if (kind === 'event') for (const p of participants) extra.push(...(await addEventRef(p.kind, p.handle, obj.handle, p.role || 'Primary')))
    } catch (e) {
      toast.error(t('editor:linkFailed'), { description: errorMessage(e) })
    }
    invalidateAfterWrite(qc, ['person', 'family', ...endpointsOfTx(extra)])
    const id = txGrampsId(tx, obj.handle)
    toast.success(t('editor:created', { what }))
    if (id) navigate(objectPath(kind, id), { replace: true })
    else navigate(-1)
  }

  const relationHint = relation
    ? t(`editor:relationHint.${relation}`, { name: relTitle })
    : eventOwner
      ? t('editor:relationHint.eventOf', { name: relTitle })
      : null

  return (
    <Page title={relation ? t(`editor:relationTitle.${relation}`) : t('editor:newTitle', { what })}>
      <div className="mx-auto max-w-2xl">
        <ObjectEditor
          kind={kind}
          mode="create"
          initial={initial}
          seeds={[related.data, ...(related.data?.extended?.father ? [related.data.extended.father] : []), ...(related.data?.extended?.mother ? [related.data.extended.mother] : [])].filter(Boolean) as AnyObj[]}
          header={
            relationHint ? (
              <p className="mb-6 flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm">
                <UserRoundPlus className="size-4 shrink-0 text-primary" />
                {relationHint}
              </p>
            ) : null
          }
          footer={kind === 'event' && can('EditObject') ? <div className="mt-6"><ParticipantsField value={participants} onChange={setParticipants} /></div> : null}
          onCancel={() => navigate(-1)}
          onSaved={afterCreate}
          footerClassName="sticky bottom-[var(--tabbar-h)] mt-8 -mx-4 px-4 sm:-mx-6 sm:px-6"
        />
      </div>
    </Page>
  )
}
