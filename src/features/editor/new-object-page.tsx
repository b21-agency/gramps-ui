import { lazy, Suspense, useMemo, useState, type ComponentType } from 'react'
import { Portrait } from '@/components/portrait'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { toast } from 'sonner'
import { Lock, UserRoundPlus } from 'lucide-react'
import { PageSkeleton } from '@/components/app-shell'
import { EmptyState, ErrorState } from '@/components/states'
import { useGetObjectQuery } from '@/api/enhanced/objects'
import { useAuth } from '@/lib/auth'
import { describeObject, kindIcon, objectPath } from '@/lib/objects'
import { surnameOf } from '@/lib/format'
import type { ObjectKind } from '@/lib/types'
import { useTitle } from '@/hooks/use-title'
import { emptyName, emptyObject, errorMessage, txGrampsId, type AnyObj, type Transaction } from './lib'
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

  const relatedHandle = relHandle ?? eventOwnerHandle
  const relatedQ = useGetObjectQuery(
    relatedHandle ? { kind: eventOwner ?? relKind, handle: relatedHandle, query: { extend: 'all', profile: 'self' } } : skipToken,
  )
  const related = { ...relatedQ, data: relatedQ.data as AnyObj | undefined }

  // participants of a new event: the person/family it was started from, plus any added in the form
  const [draft, setDraft] = useState<AnyObj | null>(null)
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

  const pageTitle = relation ? t(`editor:relationTitle.${relation}`) : t('editor:newTitle', { what })
  const preview = draft ? describeObject(kind, draft).title : ''
  const Icon = kindIcon[kind]

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
      <div className="mb-8">
        <h1 className="font-serif text-[2.6rem] leading-[1] font-medium tracking-[-0.02em] text-balance sm:text-6xl">{pageTitle}</h1>
        {relationHint && (
          <p className="mt-3 flex items-center gap-2 font-serif text-xl italic text-muted-foreground">
            <UserRoundPlus className="size-5 shrink-0 text-brass" />
            {relationHint}
          </p>
        )}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <ObjectEditor
          kind={kind}
          mode="create"
          initial={initial}
          seeds={[related.data, ...(related.data?.extended?.father ? [related.data.extended.father] : []), ...(related.data?.extended?.mother ? [related.data.extended.mother] : [])].filter(Boolean) as AnyObj[]}
          onDraftChange={setDraft}
          formClassName="2xl:[&>div]:grid 2xl:[&>div]:grid-cols-2 2xl:[&>div]:items-start 2xl:[&>div]:gap-6 2xl:[&>div>section:first-child]:col-span-2"
          footer={kind === 'event' && can('EditObject') ? <div className="mt-6 rounded-3xl bg-card p-5 sm:p-6"><ParticipantsField value={participants} onChange={setParticipants} /></div> : null}
          onCancel={() => navigate(-1)}
          onSaved={afterCreate}
          footerClassName="sticky bottom-[var(--tabbar-h)] z-10 mt-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-3xl lg:px-5"
        />
        <aside className="order-first min-w-0 rounded-3xl bg-card p-5 max-xl:hidden sm:p-6 xl:sticky xl:top-[calc(var(--header-h)+1.5rem)] xl:order-none">
          <div className="text-sm text-muted-foreground">{t('editor:newPreview.title')}</div>
          <div className="mt-4 flex items-center gap-4">
            {kind === 'person' ? (
              <Portrait name={preview || '?'} sex={draft?.gender === 0 ? 'F' : draft?.gender === 1 ? 'M' : undefined} size={72} />
            ) : (
              <span className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl bg-secondary ring-1 ring-inset ring-brass/30">
                <Icon className="size-7 text-brass" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <div className={preview ? 'font-serif text-3xl leading-[1.05] font-medium [overflow-wrap:anywhere]' : 'font-serif text-2xl italic text-muted-foreground'}>
                {preview || t('editor:newPreview.untitled')}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{what}</div>
            </div>
          </div>
          {relationHint && (
            <p className="mt-5 flex items-start gap-2 rounded-2xl bg-secondary/70 px-4 py-3 text-sm">
              <UserRoundPlus className="mt-0.5 size-4 shrink-0 text-brass" />
              {relationHint}
            </p>
          )}
          <p className="mt-5 font-serif text-lg leading-snug italic text-muted-foreground">{t('editor:newPreview.hint')}</p>
          <p className="mt-3 text-xs text-muted-foreground">{t('editor:newPreview.shortcut')}</p>
        </aside>
      </div>
    </div>
  )
}
