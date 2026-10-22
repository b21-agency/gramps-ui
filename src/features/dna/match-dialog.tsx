import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { useDnaParseQuery } from '@/api/enhanced/dna'
import { toApiError } from '@/api/enhanced/editor'
import { toast } from 'sonner'
import { FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ObjectPicker } from '@/components/object-picker'
import { useDebounced } from '@/components/command-search'
import { errorMessage } from '@/features/editor/lib'
import { cn } from '@/lib/utils'
import { addDnaMatch, normChromosome, normSide, updateDnaMatchData, type DnaMatch, type DnaSegment } from './data'

export interface PersonValue {
  handle: string
  title: string
}

/** Textarea for pasted data; a text file can be dropped on it or chosen. */
export function RawDataField({
  id,
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  const { t } = useTranslation('dna')
  const [over, setOver] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const readFile = (f?: File) => {
    if (!f) return
    void f.text().then((txt) => onChange(value ? `${value}\n${txt}` : txt))
  }
  return (
    <div className="grid gap-1.5">
      <Textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('edit.pastePlaceholder')}
        className={cn('max-h-64 font-mono text-xs', over && 'ring-2 ring-ring')}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (e.dataTransfer.files.length) readFile(e.dataTransfer.files[0])
          else {
            const txt = e.dataTransfer.getData('text')
            if (txt) onChange(value ? `${value}\n${txt}` : txt)
          }
        }}
      />
      <div>
        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={() => file.current?.click()}>
          <FileUp />
          {t('edit.chooseFile')}
        </Button>
        <input
          ref={file}
          type="file"
          accept=".csv,.txt,text/*"
          className="hidden"
          onChange={(e) => {
            readFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

/** Live preview of how the server parses the pasted segment data. */
function useParsed(raw: string) {
  const d = useDebounced(raw.trim(), 300)
  const q = useDnaParseQuery(d ? d : skipToken)
  // only the parse of the current text (never a stale preview)
  return { ...q, data: q.currentData as DnaSegment[] | undefined, error: q.error && toApiError(q.error) }
}

function Preview({ raw }: { raw: string }) {
  const { t } = useTranslation('dna')
  const q = useParsed(raw)
  if (!raw.trim()) return <p className="text-sm text-muted-foreground">{t('edit.previewEmpty')}</p>
  if (q.isFetching && !q.data) return <Loader2 className="size-4 animate-spin text-muted-foreground" />
  if (q.isError) return <p className="text-sm text-destructive">{errorMessage(q.error)}</p>
  const segs = q.data ?? []
  if (!segs.length) return <p className="text-sm text-destructive">{t('edit.previewNone')}</p>
  const total = segs.reduce((s, x) => s + (Number(x.cM) || 0), 0)
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {t('edit.previewSummary', { count: segs.length, cm: total.toLocaleString(undefined, { maximumFractionDigits: 1 }) })}
      </p>
      <div className="max-h-48 overflow-auto rounded-lg border">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-2 py-1 font-medium">{t('chromosome')}</th>
              <th className="px-2 py-1 text-right font-medium">{t('start')}</th>
              <th className="px-2 py-1 text-right font-medium">{t('stop')}</th>
              <th className="px-2 py-1 text-right font-medium">cM</th>
              <th className="px-2 py-1 text-right font-medium">SNPs</th>
              <th className="px-2 py-1 font-medium">{t('sideLabel')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {segs.map((s, i) => (
              <tr key={i}>
                <td className="px-2 py-1">{normChromosome(s.chromosome)}</td>
                <td className="px-2 py-1 text-right">{Number(s.start).toLocaleString()}</td>
                <td className="px-2 py-1 text-right">{Number(s.stop).toLocaleString()}</td>
                <td className="px-2 py-1 text-right">{s.cM}</td>
                <td className="px-2 py-1 text-right">{s.SNPs ? Number(s.SNPs).toLocaleString() : '—'}</td>
                <td className="px-2 py-1">{t(`side.${normSide(s.side)}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Add a DNA match (two people + raw segment data) or edit the raw data of one. */
export function MatchDialog({
  open,
  onOpenChange,
  source,
  match,
  matchName,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** first person (preselected when adding, fixed when editing) */
  source?: PersonValue
  /** editing this match when given */
  match?: DnaMatch
  matchName?: string
}) {
  const { t } = useTranslation(['dna', 'common'])
  const [first, setFirst] = useState<PersonValue | null>(source ?? null)
  const [second, setSecond] = useState<PersonValue | null>(null)
  const [raw, setRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const parsed = useParsed(raw)

  useEffect(() => {
    if (!open) return
    setFirst(source ?? null)
    setSecond(null)
    setRaw(match?.raw_data?.[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const editing = !!match
  const parsedOk = !!parsed.data?.length && raw.trim() !== ''
  const samePerson = !!first && !!second && first.handle === second.handle
  const valid = parsedOk && (editing || (!!first && !!second && !samePerson))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    try {
      if (editing && source) await updateDnaMatchData(source.handle, match, raw.trim())
      else if (first && second) await addDnaMatch(first.handle, second.handle, raw.trim())
      toast.success(editing ? t('edit.saved') : t('edit.added'))
      onOpenChange(false)
    } catch (err) {
      toast.error(t('edit.failed'), { description: errorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{editing ? t('edit.editTitle', { name: matchName ?? '' }) : t('edit.addTitle')}</DialogTitle>
            <DialogDescription>{t('edit.description')}</DialogDescription>
          </DialogHeader>
          {!editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>{t('edit.firstPerson')}</Label>
                <ObjectPicker
                  kinds={['person']}
                  value={first}
                  onChange={(o) => setFirst({ handle: o.handle, title: o.title })}
                  placeholder={t('edit.choosePerson')}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('edit.secondPerson')}</Label>
                <ObjectPicker
                  kinds={['person']}
                  value={second}
                  onChange={(o) => setSecond({ handle: o.handle, title: o.title })}
                  placeholder={t('edit.choosePerson')}
                />
                {samePerson && <p className="text-xs text-destructive">{t('edit.samePerson')}</p>}
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="dna-raw">{t('edit.rawData')}</Label>
            <RawDataField id="dna-raw" value={raw} onChange={setRaw} />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">{t('edit.preview')}</span>
            <Preview raw={raw} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving && <Loader2 className="animate-spin" />}
              {editing ? t('common:actions.save') : t('edit.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
