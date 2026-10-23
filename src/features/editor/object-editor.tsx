import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ObjectKind } from '@/lib/types'
import { cn } from '@/lib/utils'
import { EditorSessionProvider, useEditorSession } from './session'
import { errorMessage, type AnyObj, type Transaction } from './lib'
import { ObjectForm, finalizeObject, validateObject } from './forms'

export interface ObjectEditorProps {
  kind: ObjectKind
  mode: 'create' | 'edit'
  initial: AnyObj
  seeds?: AnyObj[]
  onSaved: (tx: Transaction, obj: AnyObj) => void | Promise<void>
  onCancel?: () => void
  onDirtyChange?: (dirty: boolean) => void
  /** Called with every change of the draft (e.g. for a live preview next to the form). */
  onDraftChange?: (draft: AnyObj) => void
  /** Extra content above the form (e.g. relation hint on new pages). */
  header?: ReactNode
  /** Extra content below the form, inside the editor session (e.g. participants of a new event). */
  footer?: ReactNode
  saveLabel?: string
  /** Classes for the scrolling body / sticky footer. */
  bodyClassName?: string
  footerClassName?: string
  /** Classes for the wrapper around the form fields (e.g. a multi-column layout). */
  formClassName?: string
}

/** Form + save/cancel footer for one object, with its own editor session. */
export function ObjectEditor(props: ObjectEditorProps) {
  return (
    <EditorSessionProvider seeds={props.seeds}>
      <EditorInner {...props} />
    </EditorSessionProvider>
  )
}

function EditorInner({
  kind,
  mode,
  initial,
  onSaved,
  onCancel,
  onDirtyChange,
  onDraftChange,
  header,
  footer,
  saveLabel,
  bodyClassName,
  footerClassName,
  formClassName,
}: ObjectEditorProps) {
  const { t } = useTranslation(['editor', 'common'])
  const session = useEditorSession()
  const [base] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = draft !== base || session.dirty
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])
  useEffect(() => onDraftChange?.(draft), [draft, onDraftChange])
  // validation and "finish the open entry" messages go away as soon as their cause does
  const [problem, setProblem] = useState<string | null>(null)
  const [boxHint, setBoxHint] = useState<HTMLElement | null>(null)
  // (the session re-renders us when a box closes; a closed box is no longer connected)
  const message =
    (boxHint?.isConnected && session.openBoxes > 0 ? t('openBox') : null) ??
    (problem && validateObject(kind, draft) === problem ? t(problem) : null) ??
    error

  const save = async () => {
    // a half-filled inline box (new citation, note, place ...) would silently be dropped
    const box = session.openBox()
    setBoxHint(box ?? null)
    if (box) {
      box.scrollIntoView({ block: 'center', behavior: 'smooth' })
      box.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true })
      return
    }
    const invalid = validateObject(kind, draft)
    setProblem(invalid)
    setError(null)
    if (invalid) return
    setSaving(true)
    try {
      const obj = finalizeObject(kind, draft, session)
      // session.save writes through RTK mutations: the touched objects refresh on their own
      const tx = await session.save(kind, obj, mode)
      await onSaved(tx, obj)
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
      toast.error(t('saveFailed'), { description: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          void save()
        }
      }}
    >
      <div className={cn('flex-1', bodyClassName)}>
        {header}
        {/* the forms' first (unnamed) section becomes a panel like the named ones */}
        <div className={cn('pointer-coarse:[&_[data-slot=button][data-size=sm]]:h-11 [&>div]:gap-4 [&>div>section:first-child]:rounded-3xl [&>div>section:first-child]:bg-card [&>div>section:first-child]:p-5 sm:[&>div>section:first-child]:p-6', formClassName)}>
          <ObjectForm kind={kind} value={draft} onChange={setDraft} />
        </div>
        {footer}
      </div>
      <div className={cn('flex flex-col gap-2 bg-background/90 py-3 backdrop-blur-xl', footerClassName)}>
        {message && (
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-end gap-2 [&>button]:h-11 [&>button]:rounded-full [&>button]:px-5 max-md:[&>button]:flex-1 max-md:[&>button]:text-base">
          {onCancel && (
            <Button type="button" variant="ghost" className="max-md:bg-secondary" onClick={onCancel} disabled={saving}>
              {t('common:actions.cancel')}
            </Button>
          )}
          <Button
            type="submit"
            className="font-semibold shadow-[0_10px_30px_-12px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-transform duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100"
            disabled={saving || (mode === 'edit' && !dirty)}
          >
            {saving && <Loader2 className="animate-spin" />}
            {saving ? t('common:actions.saving') : (saveLabel ?? (mode === 'create' ? t('create') : t('saveChanges')))}
          </Button>
        </div>
      </div>
    </form>
  )
}
