import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, NotebookPen, ScanText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCreateObjectMutation } from '@/api/enhanced/objects'
import { useRunOcrMutation } from '@/api/enhanced/shared'
import { toApiError } from '@/api/enhanced/editor'
import { useAuth } from '@/lib/auth'
import { useMetadata } from '@/lib/queries'
import { Panel } from '@/components/detail/panel'
import { resolveTask, taskErrorMessage } from '@/features/tools/use-task'
import { errorMessage, patchObject } from '@/features/editor/lib'

/** UI language -> tesseract language code */
const tesseractOf: Record<string, string> = { de: 'deu', en: 'eng', fr: 'fra', it: 'ita', es: 'spa', nl: 'nld', pl: 'pol', cs: 'ces' }

/** Whether the server offers text recognition for this media object. */
export function useOcrAvailable(mime?: string) {
  const { data: meta } = useMetadata()
  return !!meta?.server?.ocr && !!mime?.startsWith('image/')
}

/**
 * Text recognition (OCR) for an image: pick the language, run it on the server
 * (`POST /media/{h}/ocr`, may be a background task) and optionally keep the text
 * as a "Transcript" note attached to the media object.
 */
export function OcrPanel({ handle, onClose, onSaved }: { handle: string; onClose: () => void; onSaved: () => void }) {
  const { t, i18n } = useTranslation(['objects', 'common'])
  const { can } = useAuth()
  const [runOcr] = useRunOcrMutation()
  const [createObject] = useCreateObjectMutation()
  const { data: meta } = useMetadata()
  const langs = (meta?.server?.ocr_languages as string[] | undefined) ?? []
  const preferred = tesseractOf[i18n.language.slice(0, 2)]
  const [lang, setLang] = useState(langs.includes(preferred) ? preferred : (langs[0] ?? ''))
  const [running, setRunning] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const names = new Intl.DisplayNames([i18n.language], { type: 'language' })
  const langName = (code: string) => {
    try {
      // tesseract codes are ISO 639-2/T; Intl understands most of them
      const n = names.of(code.split('_')[0])
      return n && n !== code ? `${n}${code.includes('_') ? ` (${code.split('_')[1]})` : ''}` : code
    } catch {
      return code
    }
  }

  const run = async () => {
    setRunning(true)
    setText(null)
    try {
      const res = await runOcr({ handle, lang }).unwrap()
      const out = await resolveTask<unknown>(res)
      const s = typeof out === 'string' ? out : ((out as { data?: string })?.data ?? '')
      setText(s.trim())
    } catch (e) {
      toast.error(t('ocr.failed'), { description: taskErrorMessage(e) })
    } finally {
      setRunning(false)
    }
  }

  const saveAsNote = async () => {
    if (!text) return
    setSaving(true)
    try {
      // both writes go through RTK mutations, which invalidate what their transactions touched
      const tx = await createObject({
        kind: 'note',
        body: { _class: 'Note', type: 'Transcript', text: { _class: 'StyledText', string: text, tags: [] } },
      })
        .unwrap()
        .catch((e) => Promise.reject(toApiError(e)))
      const noteHandle = tx.find((e) => e._class === 'Note')?.handle ?? tx[0]?.handle
      if (noteHandle) await patchObject('media', handle, (o) => (o.note_list = [...(o.note_list ?? []), noteHandle]))
      toast.success(t('ocr.saved'))
      onSaved()
    } catch (e) {
      toast.error(t('ocr.saveFailed'), { description: errorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel id="ocr" title={t('ocr.title')}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-56">
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger aria-label={t('ocr.language')} className="w-full">
              <SelectValue placeholder={t('ocr.language')} />
            </SelectTrigger>
            <SelectContent>
              {langs.map((l) => (
                <SelectItem key={l} value={l}>
                  {langName(l)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => void run()} disabled={!lang || running}>
          {running ? <Loader2 className="animate-spin" /> : <ScanText />}
          {running ? t('ocr.running') : t('ocr.run')}
        </Button>
        <Button variant="ghost" size="icon" className="ml-auto" aria-label={t('common:actions.close')} onClick={onClose}>
          <X />
        </Button>
      </div>
      {text !== null && (
        <div className="mt-4">
          {text ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-background/60 p-4 font-serif text-base leading-relaxed">{text}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">{t('ocr.empty')}</p>
          )}
          {text && can('AddObject') && can('EditObject') && (
            <Button variant="outline" className="mt-3" onClick={() => void saveAsNote()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <NotebookPen />}
              {t('ocr.saveAsNote')}
            </Button>
          )}
        </div>
      )}
    </Panel>
  )
}
