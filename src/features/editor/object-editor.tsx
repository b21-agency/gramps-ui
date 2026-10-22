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
  /** Extra content above the form (e.g. relation hint on new pages). */
  header?: ReactNode
  /** Extra content below the form, inside the editor session (e.g. participants of a new event). */
  footer?: ReactNode
  saveLabel?: string
  /** Classes for the scrolling body / sticky footer. */
  bodyClassName?: string
  footerClassName?: string
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
  header,
  footer,
  saveLabel,
  bodyClassName,
  footerClassName,
}: ObjectEditorProps) {
  const { t } = useTranslation(['editor', 'common'])
  const session = useEditorSession()
  const [base] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirty = draft !== base || session.dirty
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  const save = async () => {
    const problem = validateObject(kind, draft)
    if (problem) {
      setError(t(problem))
      return
    }
    setError(null)
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
        <ObjectForm kind={kind} value={draft} onChange={setDraft} />
        {footer}
      </div>
      <div className={cn('flex flex-col gap-2 border-t bg-background/95 py-3 backdrop-blur', footerClassName)}>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-end gap-2 max-md:[&>button]:h-11 max-md:[&>button]:flex-1 max-md:[&>button]:text-base">
          {onCancel && (
            <Button type="button" variant="ghost" className="max-md:bg-muted" onClick={onCancel} disabled={saving}>
              {t('common:actions.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={saving || (mode === 'edit' && !dirty)}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? t('common:actions.saving') : (saveLabel ?? (mode === 'create' ? t('create') : t('saveChanges')))}
          </Button>
        </div>
      </div>
    </form>
  )
}
