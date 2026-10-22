import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Bold, Image as ImageIcon, ImagePlus, Images, Italic, Link2, Loader2, Star, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ObjectPicker } from '@/components/object-picker'
import { NoteHtml } from '@/components/note-html'
import { EmptyState } from '@/components/states'
import { refThumbUrl } from '@/components/portrait'
import { useCurrentUser } from '@/components/user-menu'
import { useAuth, useAccessToken } from '@/lib/auth'
import { usePref } from '@/lib/prefs'
import { useTags } from '@/lib/queries'
import { PrivateSwitch, TagsField } from '@/features/editor/fields'
import type { MediaRef, Note, Source } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AlbumHeader, albumFrame, pill } from '@/components/album-page'
import { useTitle } from '@/hooks/use-title'
import {
  ensureTag,
  createObject,
  postObjects,
  updateObject,
  newHandle,
  txnObject,
  uploadMedia,
  writableNote,
  writableSource,
} from './tagged-source'
import { BLOG_TAG, blogProse, markdownishToHtml } from './prose'
import { hasUnsupportedStyling, parseMarkdownish, toMarkdownish, type StyledTag } from './styled-text'


type Photo =
  | { key: string; kind: 'existing'; ref: MediaRef; label?: string }
  | { key: string; kind: 'new'; file: File; url: string }

interface Draft {
  title: string
  author: string
  body: string
}

const emptyMediaRef = (handle: string) => ({
  _class: 'MediaRef',
  ref: handle,
  rect: null,
  private: false,
  citation_list: [],
  note_list: [],
  attribute_list: [],
})

/**
 * Write or edit a blog post (a Source tagged "Blog" whose first note is the text).
 * Without `post` it creates a new one and navigates to it; rendered for /new_blog_post too.
 */
export function BlogPostEditor({
  post,
  onCancel,
  onSaved,
}: {
  post?: Source & { extended?: { notes?: Note[] } }
  onCancel?: () => void
  onSaved?: (grampsId: string) => void
}) {
  const { t } = useTranslation('blog')
  const { can } = useAuth()
  const navigate = useNavigate()
  const { data: me } = useCurrentUser()
  useAccessToken()
  useTitle(post ? t('editor.editTitle') : t('editor.newTitle'))

  const note = useMemo(() => {
    const first = post?.note_list?.[0]
    return post?.extended?.notes?.find((n) => n.handle === first)
  }, [post])
  const initialBody = useMemo(
    () => (note ? toMarkdownish(note.text as { string: string; tags?: StyledTag[] }) : ''),
    [note],
  )

  const [draft, setDraft] = usePref<Draft | null>('blogDraft', null)
  const [restored] = useState(() => !post && !!draft && !!(draft.title || draft.body))
  const [title, setTitle] = useState(post?.title ?? (restored ? draft!.title : ''))
  const [author, setAuthor] = useState(post?.author ?? (restored ? draft!.author : ''))
  const [body, setBody] = useState(post ? initialBody : restored ? draft!.body : '')
  const [photos, setPhotos] = useState<Photo[]>(() =>
    (post?.media_list ?? []).map((ref, i) => ({ key: `e${i}-${ref.ref}`, kind: 'existing' as const, ref })),
  )
  const [extraTags, setExtraTags] = useState<string[]>(post?.tag_list ?? [])
  const [isPrivate, setIsPrivate] = useState(!!post?.private)
  const allTags = useTags().data
  const blogTagHandle = allTags?.find((x) => x.name === BLOG_TAG)?.handle
  const [tab, setTab] = useState('write')
  const [saving, setSaving] = useState(false)
  const [titleError, setTitleError] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // default author: the signed-in user
  useEffect(() => {
    if (!post && !author && me) setAuthor(me.full_name || me.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])

  // autosave drafts of new posts (text only)
  useEffect(() => {
    if (post) return
    const id = window.setTimeout(() => setDraft(title || body ? { title, author, body } : null), 400)
    return () => window.clearTimeout(id)
  }, [post, title, author, body, setDraft])

  // revoke object URLs of new photos on unmount
  const photosRef = useRef(photos)
  photosRef.current = photos
  useEffect(
    () => () => photosRef.current.forEach((p) => p.kind === 'new' && URL.revokeObjectURL(p.url)),
    [],
  )

  if (!can(post ? 'EditObject' : 'AddObject'))
    return <EmptyState title={t('editor.noPermission')} className="py-24" />

  const wrap = (before: string, after = before, placeholder = '') => {
    const el = textRef.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    const sel = body.slice(a, b) || placeholder
    const next = body.slice(0, a) + before + sel + after + body.slice(b)
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(a + before.length, a + before.length + sel.length)
    })
  }

  const addLink = () => {
    const url = window.prompt(t('editor.linkPrompt'), 'https://')
    if (!url || url === 'https://') return
    wrap('[', `](${url.trim()})`, t('editor.link'))
  }

  const insertImage = (handle: string) => {
    const el = textRef.current
    const at = el ? el.selectionStart : body.length
    const token = `![image](gramps://Media/handle/${handle})`
    const pre = body.slice(0, at)
    const glue = pre && !pre.endsWith('\n') ? '\n\n' : ''
    setBody(pre + glue + token + '\n\n' + body.slice(at).replace(/^\n+/, ''))
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const next: Photo[] = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((file) => ({ key: newHandle(), kind: 'new', file, url: URL.createObjectURL(file) }))
    setPhotos((p) => [...p, ...next])
  }

  const removePhoto = (key: string) =>
    setPhotos((ps) => {
      const p = ps.find((x) => x.key === key)
      if (p?.kind === 'new') URL.revokeObjectURL(p.url)
      return ps.filter((x) => x.key !== key)
    })

  const makeCover = (key: string) =>
    setPhotos((ps) => {
      const p = ps.find((x) => x.key === key)
      return p ? [p, ...ps.filter((x) => x.key !== key)] : ps
    })

  const save = async () => {
    if (!title.trim()) {
      setTitleError(true)
      toast.error(t('editor.titleRequired'))
      return
    }
    setSaving(true)
    try {
      const text = parseMarkdownish(body.trim())
      const blogTag = await ensureTag(BLOG_TAG)
      const tagList = [blogTag, ...extraTags.filter((h) => h !== blogTag)]
      const media_list = []
      for (const p of photos) {
        if (p.kind === 'existing') media_list.push({ ...emptyMediaRef(p.ref.ref), ...p.ref, _class: 'MediaRef' })
        else {
          const m = await uploadMedia(p.file, title.trim())
          media_list.push(emptyMediaRef(m.handle))
        }
      }
      let grampsId: string
      if (!post) {
        const n = newHandle()
        const s = newHandle()
        const txn = await postObjects([
          { _class: 'Note', handle: n, text: { _class: 'StyledText', ...text }, type: 'General', private: isPrivate, tag_list: tagList },
          {
            _class: 'Source',
            handle: s,
            title: title.trim(),
            author: author.trim(),
            pubinfo: '',
            abbrev: '',
            note_list: [n],
            tag_list: tagList,
            media_list,
            attribute_list: [],
            reporef_list: [],
            private: isPrivate,
          },
        ])
        grampsId = txnObject<Source>(txn, 'Source', s)!.gramps_id
        setDraft(null)
      } else {
        const noteList = [...(post.note_list ?? [])]
        if (note) {
          const bodyChanged = body.trim() !== initialBody.trim()
          if (bodyChanged || !!note.private !== isPrivate)
            await updateObject('note', note.handle, {
              ...writableNote(note, bodyChanged ? text : (note.text as typeof text)),
              private: isPrivate,
            })
        } else if (body.trim()) {
          const n = newHandle()
          await createObject('note', {
            _class: 'Note',
            handle: n,
            text: { _class: 'StyledText', ...text },
            type: 'General',
            private: isPrivate,
            tag_list: tagList,
          })
          noteList.unshift(n)
        }
        await updateObject(
          'source',
          post.handle,
          writableSource(post, {
            title: title.trim(),
            author: author.trim(),
            note_list: noteList,
            tag_list: tagList,
            private: isPrivate,
            media_list: media_list as unknown as MediaRef[],
          }),
        )
        grampsId = post.gramps_id
      }
      // every write above went through an RTK mutation and invalidated what it touched
      toast.success(post ? t('editor.saved') : t('editor.published'))
      if (onSaved) onSaved(grampsId)
      else navigate(`/blog/${grampsId}`)
    } catch (e) {
      toast.error(t('editor.failed', { message: (e as Error).message }))
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    if (onCancel) onCancel()
    else navigate(-1)
  }

  const styled = !!note && hasUnsupportedStyling(note.text.tags as StyledTag[])

  return (
    <div className={albumFrame}>
      <AlbumHeader title={post ? t('editor.editTitle') : t('editor.newTitle')} description={post?.title} />

      {restored && (
        <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl bg-brass/10 px-5 py-3 text-sm">
          <span className="flex-1">{t('editor.draftRestored')}</span>
          <Button
            variant="ghost"
            className="h-11 rounded-full sm:h-9"
            onClick={() => {
              setTitle('')
              setBody('')
              setDraft(null)
            }}
          >
            {t('editor.discardDraft')}
          </Button>
        </div>
      )}

      <form
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <section className="min-w-0 space-y-6 rounded-3xl bg-card p-5 sm:p-8">
        <div className="space-y-2">
          <Label htmlFor="post-title" className="text-muted-foreground">{t('editor.titleLabel')}</Label>
          <Input
            id="post-title"
            value={title}
            aria-invalid={titleError || undefined}
            onChange={(e) => {
              setTitle(e.target.value)
              setTitleError(false)
            }}
            placeholder={t('editor.titlePlaceholder')}
            className="h-auto rounded-2xl bg-background/40 px-4 py-3 font-serif text-3xl font-medium leading-tight tracking-[-0.01em] md:text-4xl dark:bg-background/40"
            autoFocus={!post}
          />
        </div>


        <div className="space-y-2">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="post-body" className="mr-auto text-muted-foreground">
                {t('editor.bodyLabel')}
              </Label>
              {tab === 'write' && (
                <div className="flex items-center gap-0.5">
                  <ToolbarButton label={t('editor.bold')} onClick={() => wrap('**', '**', t('editor.bold'))}>
                    <Bold />
                  </ToolbarButton>
                  <ToolbarButton label={t('editor.italic')} onClick={() => wrap('*', '*', t('editor.italic'))}>
                    <Italic />
                  </ToolbarButton>
                  <ToolbarButton label={t('editor.link')} onClick={addLink}>
                    <Link2 />
                  </ToolbarButton>
                  <ObjectPicker
                    kinds={['media']}
                    placeholder={t('editor.pickMediaPlaceholder')}
                    onChange={(o) => insertImage(o.handle)}
                    trigger={
                      <Button type="button" variant="ghost" size="icon-sm" className="max-md:size-11" aria-label={t('editor.insertImage')} title={t('editor.insertImage')}>
                        <ImageIcon />
                      </Button>
                    }
                  />
                </div>
              )}
              <TabsList className="max-md:h-11 max-md:[&>button]:px-4">
                <TabsTrigger value="write">{t('editor.write')}</TabsTrigger>
                <TabsTrigger value="preview">{t('editor.preview')}</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="write" className="mt-2">
              <Textarea
                id="post-body"
                ref={textRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('editor.bodyPlaceholder')}
                className="min-h-[28rem] rounded-2xl bg-background/40 px-4 py-3 font-serif text-[1.15rem] leading-[1.75] md:text-[1.15rem] dark:bg-background/40"
                onKeyDown={(e) => {
                  if (!(e.metaKey || e.ctrlKey)) return
                  if (e.key === 'b') {
                    e.preventDefault()
                    wrap('**', '**', t('editor.bold'))
                  } else if (e.key === 'i') {
                    e.preventDefault()
                    wrap('*', '*', t('editor.italic'))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    void save()
                  }
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">{t('editor.formattingHint')}</p>
              {styled && (
                <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                  <TriangleAlert className="mt-px size-3.5 shrink-0 text-brass" />
                  {t('editor.styledWarning')}
                </p>
              )}
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <div className="min-h-[28rem] rounded-2xl bg-background/40 px-5 py-4">
                {body.trim() ? (
                  <NoteHtml html={markdownishToHtml(body)} className={blogProse} />
                ) : (
                  <p className="text-sm text-muted-foreground">{t('editor.previewEmpty')}</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        </section>

        <div className="grid min-w-0 gap-6">
        <section className="min-w-0 space-y-4 rounded-3xl bg-card p-5 sm:p-6">
          <div>
            <h2 className="font-serif text-2xl font-medium">{t('editor.photos')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('editor.photosHint')}</p>
          </div>
          {photos.length > 0 && (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3 lg:grid-cols-2">
              {photos.map((p, i) => (
                <li key={p.key} className={cn('group relative overflow-hidden rounded-2xl bg-secondary', i === 0 && 'col-span-2 ring-2 ring-brass')}>
                  <img
                    src={p.kind === 'new' ? p.url : refThumbUrl(p.ref, 300)}
                    alt=""
                    className={cn('w-full object-cover', i === 0 ? 'aspect-[4/3]' : 'aspect-square')}
                  />
                  {i === 0 && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-brass px-2.5 py-0.5 text-xs font-semibold text-brass-foreground">
                      {t('editor.cover')}
                    </span>
                  )}
                  <div className="absolute top-1 right-1 flex gap-1">
                    {i > 0 && (
                      <ToolbarButton label={t('editor.makeCover')} onClick={() => makeCover(p.key)} overlay>
                        <Star />
                      </ToolbarButton>
                    )}
                    <ToolbarButton label={t('editor.removePhoto')} onClick={() => removePhoto(p.key)} overlay>
                      <X />
                    </ToolbarButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <Button type="button" variant="secondary" className={pill} onClick={() => fileRef.current?.click()}>
              <ImagePlus />
              {t('editor.addPhotos')}
            </Button>
            <ObjectPicker
              kinds={['media']}
              placeholder={t('editor.pickMediaPlaceholder')}
              onChange={(o) =>
                setPhotos((ps) =>
                  ps.some((p) => p.kind === 'existing' && p.ref.ref === o.handle)
                    ? ps
                    : [...ps, { key: newHandle(), kind: 'existing', ref: { ref: o.handle, rect: null }, label: o.title }],
                )
              }
              trigger={
                <Button type="button" variant="ghost" className={pill}>
                  <Images />
                  {t('editor.pickMedia')}
                </Button>
              }
            />
          </div>
        </section>

        <section className="min-w-0 space-y-5 rounded-3xl bg-card p-5 sm:p-6">
          <h2 className="font-serif text-2xl font-medium">{t('editor.details')}</h2>
          <div className="space-y-2">
            <Label htmlFor="post-author">{t('editor.authorLabel')}</Label>
            <Input id="post-author" value={author} onChange={(e) => setAuthor(e.target.value)} className="h-11 sm:h-9" />
          </div>
          <TagsField value={extraTags.filter((h) => h !== blogTagHandle)} onChange={setExtraTags} />
          <PrivateSwitch value={isPrivate} onChange={setIsPrivate} />
        </section>
        </div>

        <div className="sticky bottom-[var(--tabbar-h)] z-10 -mx-4 flex flex-wrap justify-end gap-2 bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-full sm:px-3 lg:col-span-2 max-md:flex-nowrap max-md:[&>button]:h-11 max-md:[&>button]:flex-1 max-md:[&>button]:text-base">
          <Button type="button" variant="ghost" className="rounded-full sm:h-10 sm:px-5" onClick={cancel} disabled={saving}>
            {t('editor.cancel')}
          </Button>
          <Button type="submit" className="rounded-full sm:h-10 sm:px-5" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? t('editor.publishing') : post ? t('editor.save') : t('editor.publish')}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  children,
  overlay,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  overlay?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={overlay ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          className={cn('max-md:size-11', overlay && 'size-9 rounded-full bg-background/90 shadow-sm hover:bg-background')}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
