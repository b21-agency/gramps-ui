import { lazy, Suspense, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Map as MapIcon, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { api, mediaThumbUrl } from '@/lib/api'
import { invalidateTransaction } from '@/api/enhanced/editor'
import type { TxEntry } from '@/api/enhanced/tags'
import { useAppDispatch } from '@/store'
import { useAccessToken } from '@/lib/auth'
import type { AnyObj } from '../lib'
import { DateInput } from '../date-input'
import { AddressesField } from '../address-field'
import { MediaRefsField } from '../media-field'
import { NoteTextField } from '../note-text-field'
import { MapOverlayField } from '@/features/objects/media-overlay'
import { EventCoreFields } from '../events-field'
import {
  AttributesField,
  CommonFields,
  ConfidenceSelect,
  Field,
  FormSection,
  Grid,
  RefPicker,
  RefTitle,
  RowActions,
  TextField,
  TypeCombobox,
  UrlsField,
  move,
  InlineBox,
} from '../fields'
import { useEditorSession } from '../session'
import { emptyObject } from '../lib'

const MapPicker = lazy(async () => ({ default: (await import('../map-picker')).MapPicker }))

type FormProps = { value: AnyObj; onChange: (o: AnyObj) => void }

/* ---------------- event ---------------- */

export function EventForm({ value, onChange }: FormProps) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <EventCoreFields value={value} onChange={onChange} />
      </section>
      <MediaRefsField value={value.media_list ?? []} onChange={(v) => onChange({ ...value, media_list: v })} />
      <AttributesField value={value.attribute_list ?? []} onChange={(v) => onChange({ ...value, attribute_list: v })} />
      <CommonFields value={value} onChange={onChange} />
    </div>
  )
}

/* ---------------- place ---------------- */

function num(s: unknown) {
  const n = parseFloat(String(s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function PlaceForm({ value, onChange }: FormProps) {
  const { t, i18n } = useTranslation('editor')
  const [showMap, setShowMap] = useState(false)
  const refs: AnyObj[] = value.placeref_list ?? []
  const alt: AnyObj[] = value.alt_names ?? []
  const lat = num(value.lat)
  const lng = num(value.long)
  const latBad = value.lat && (lat === null || Math.abs(lat) > 90)
  const lngBad = value.long && (lng === null || Math.abs(lng) > 180)
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <Grid>
          <TextField
            label={t('place.name')}
            value={value.name?.value}
            autoFocus={!value.name?.value}
            onChange={(v) => onChange({ ...value, name: { _class: 'PlaceName', lang: '', ...value.name, value: v } })}
          />
          <Field label={t('place.type')}>
            <TypeCombobox category="place_types" value={value.place_type} onChange={(v) => onChange({ ...value, place_type: v })} />
          </Field>
        </Grid>
        <Field label={t('place.enclosedBy')} hint={t('place.enclosedByHint')}>
          <div className="flex flex-col gap-2">
            {refs.map((r, i) => (
              <div key={`${r.ref}-${i}`} className="flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <RefPicker
                      kind="place"
                      value={r.ref}
                      clearable={false}
                      onChange={(h) => h && onChange({ ...value, placeref_list: refs.map((x, j) => (j === i ? { ...x, ref: h } : x)) })}
                    />
                  </div>
                  <RowActions index={i} length={refs.length} onRemove={() => onChange({ ...value, placeref_list: refs.filter((_, j) => j !== i) })} />
                </div>
                <DateInput
                  label={t('place.validDate')}
                  value={r.date}
                  lang={i18n.language}
                  onChange={(d) => onChange({ ...value, placeref_list: refs.map((x, j) => (j === i ? { ...x, date: d } : x)) })}
                />
              </div>
            ))}
            {refs.length === 0 && (
              <RefPicker
                kind="place"
                value=""
                placeholder={t('place.enclosedByPlaceholder')}
                onChange={(h) => h && onChange({ ...value, placeref_list: [{ _class: 'PlaceRef', ref: h }] })}
              />
            )}
            {refs.length > 0 && (
              <AddEnclosing onAdd={(h) => onChange({ ...value, placeref_list: [...refs, { _class: 'PlaceRef', ref: h }] })} />
            )}
          </div>
        </Field>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('place.lat')} hint={latBad ? t('place.invalidCoord') : undefined}>
              <Input
                inputMode="decimal"
                value={value.lat ?? ''}
                aria-invalid={!!latBad}
                placeholder="48.2082"
                onChange={(e) => onChange({ ...value, lat: e.target.value })}
              />
            </Field>
            <Field label={t('place.long')} hint={lngBad ? t('place.invalidCoord') : undefined}>
              <Input
                inputMode="decimal"
                value={value.long ?? ''}
                aria-invalid={!!lngBad}
                placeholder="16.3738"
                onChange={(e) => onChange({ ...value, long: e.target.value })}
              />
            </Field>
          </div>
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setShowMap(!showMap)} aria-expanded={showMap}>
            <MapIcon /> {showMap ? t('place.hideMap') : t('place.pickOnMap')}
          </Button>
          {showMap && (
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
              <MapPicker
                lat={lat}
                lng={lng}
                onPick={(a, b) => onChange({ ...value, lat: a.toFixed(6), long: b.toFixed(6) })}
              />
              <p className="text-xs text-muted-foreground">{t('place.mapHint')}</p>
            </Suspense>
          )}
        </div>
      </section>

      <FormSection title={t('place.altNames')} count={alt.length} collapsible defaultOpen={alt.length > 0}>
        {alt.map((n, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <Input
                className="flex-1"
                value={n.value ?? ''}
                aria-label={t('place.name')}
                onChange={(e) => onChange({ ...value, alt_names: alt.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
              />
              <Input
                className="w-20"
                value={n.lang ?? ''}
                placeholder={t('place.lang')}
                aria-label={t('place.lang')}
                onChange={(e) => onChange({ ...value, alt_names: alt.map((x, j) => (j === i ? { ...x, lang: e.target.value } : x)) })}
              />
              <RowActions
                index={i}
                length={alt.length}
                onMove={(d) => onChange({ ...value, alt_names: move(alt, i, d) })}
                onRemove={() => onChange({ ...value, alt_names: alt.filter((_, j) => j !== i) })}
              />
            </div>
            <DateInput
              label={t('place.validDate')}
              value={n.date}
              lang={i18n.language}
              onChange={(d) => onChange({ ...value, alt_names: alt.map((x, j) => (j === i ? { ...x, date: d } : x)) })}
            />
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, alt_names: [...alt, { _class: 'PlaceName', value: '', lang: '' }] })}>
            <Plus /> {t('place.addAltName')}
          </Button>
        </div>
      </FormSection>

      <FormSection title={t('more')} collapsible defaultOpen={false}>
        <Grid>
          <TextField
            label={t('place.nameLang')}
            value={value.name?.lang}
            onChange={(v) => onChange({ ...value, name: { _class: 'PlaceName', value: '', ...value.name, lang: v } })}
          />
          <DateInput
            label={t('place.nameDate')}
            value={value.name?.date}
            lang={i18n.language}
            onChange={(d) => onChange({ ...value, name: { _class: 'PlaceName', value: '', ...value.name, date: d } })}
          />
        </Grid>
        <Grid>
          <TextField label={t('place.code')} value={value.code} onChange={(v) => onChange({ ...value, code: v })} hint={t('place.codeHint')} />
          <TextField label={t('place.title')} value={value.title} onChange={(v) => onChange({ ...value, title: v })} hint={t('place.titleHint')} />
        </Grid>
      </FormSection>
      <UrlsField value={value.urls ?? []} onChange={(v) => onChange({ ...value, urls: v })} />
      <MediaRefsField value={value.media_list ?? []} onChange={(v) => onChange({ ...value, media_list: v })} />
      <CommonFields value={value} onChange={onChange} />
    </div>
  )
}

function AddEnclosing({ onAdd }: { onAdd: (h: string) => void }) {
  const { t } = useTranslation('editor')
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <Plus /> {t('place.addEnclosing')}
      </Button>
    )
  return (
    <RefPicker
      kind="place"
      value=""
      placeholder={t('place.enclosedByPlaceholder')}
      onChange={(h) => {
        if (h) onAdd(h)
        setOpen(false)
      }}
    />
  )
}

/* ---------------- source ---------------- */

export function SourceForm({ value, onChange }: FormProps) {
  const { t } = useTranslation('editor')
  const s = useEditorSession()
  const repos: AnyObj[] = value.reporef_list ?? []
  const [newRepo, setNewRepo] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <TextField label={t('source.title')} value={value.title} onChange={(v) => onChange({ ...value, title: v })} autoFocus={!value.title} placeholder={t('source.titlePlaceholder')} />
        <Grid>
          <TextField label={t('source.author')} value={value.author} onChange={(v) => onChange({ ...value, author: v })} />
          <TextField label={t('source.abbrev')} value={value.abbrev} onChange={(v) => onChange({ ...value, abbrev: v })} />
        </Grid>
        <TextField label={t('source.pubinfo')} value={value.pubinfo} onChange={(v) => onChange({ ...value, pubinfo: v })} hint={t('source.pubinfoHint')} />
      </section>

      <FormSection title={t('source.repositories')} count={repos.length} collapsible defaultOpen={repos.length > 0}>
        {repos.map((r, i) => (
          <div key={`${r.ref}-${i}`} className="flex flex-col gap-2 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <RefTitle kind="repository" handle={r.ref} className="flex-1 text-sm font-medium" />
              <RowActions
                index={i}
                length={repos.length}
                onMove={(d) => onChange({ ...value, reporef_list: move(repos, i, d) })}
                onRemove={() => onChange({ ...value, reporef_list: repos.filter((_, j) => j !== i) })}
              />
            </div>
            <Grid>
              <TextField
                label={t('source.callNumber')}
                value={r.call_number}
                onChange={(v) => onChange({ ...value, reporef_list: repos.map((x, j) => (j === i ? { ...x, call_number: v } : x)) })}
              />
              <Field label={t('source.mediaType')}>
                <TypeCombobox
                  category="source_media_types"
                  value={r.media_type}
                  onChange={(v) => onChange({ ...value, reporef_list: repos.map((x, j) => (j === i ? { ...x, media_type: v } : x)) })}
                />
              </Field>
            </Grid>
          </div>
        ))}
        {newRepo !== null ? (
          <InlineBox
            title={t('repository.newTitle')}
            doneDisabled={!newRepo.trim()}
            onCancel={() => setNewRepo(null)}
            onDone={() => {
              const repo = emptyObject('repository')
              repo.name = newRepo.trim()
              s.create('repository', repo)
              onChange({ ...value, reporef_list: [...repos, repoRef(repo.handle)] })
              setNewRepo(null)
            }}
          >
            <Input value={newRepo} autoFocus onChange={(e) => setNewRepo(e.target.value)} placeholder={t('repository.name')} />
          </InlineBox>
        ) : (
          <RefPicker
            kind="repository"
            value=""
            placeholder={t('source.addRepository')}
            onChange={(h) => h && !repos.some((r) => r.ref === h) && onChange({ ...value, reporef_list: [...repos, repoRef(h)] })}
            onCreate={() => setNewRepo('')}
            createLabel={t('repository.createNew')}
          />
        )}
      </FormSection>
      <AttributesField category="source_attribute_types" value={value.attribute_list ?? []} onChange={(v) => onChange({ ...value, attribute_list: v })} />
      <MediaRefsField value={value.media_list ?? []} onChange={(v) => onChange({ ...value, media_list: v })} />
      <CommonFields value={value} onChange={onChange} citations={false} />
    </div>
  )
}

function repoRef(h: string) {
  return { _class: 'RepoRef', ref: h, call_number: '', media_type: 'Book', private: false, note_list: [] }
}

/* ---------------- citation ---------------- */

export function CitationForm({ value, onChange }: FormProps) {
  const { t, i18n } = useTranslation('editor')
  const s = useEditorSession()
  const [newSource, setNewSource] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <Field label={t('citation.source')}>
          {newSource !== null ? (
            <InlineBox
              title={t('source.newTitle')}
              doneDisabled={!newSource.trim()}
              onCancel={() => setNewSource(null)}
              onDone={() => {
                const src = emptyObject('source')
                src.title = newSource.trim()
                s.create('source', src)
                onChange({ ...value, source_handle: src.handle })
                setNewSource(null)
              }}
            >
              <Input value={newSource} autoFocus onChange={(e) => setNewSource(e.target.value)} placeholder={t('source.titlePlaceholder')} />
            </InlineBox>
          ) : (
            <RefPicker
              kind="source"
              value={value.source_handle}
              clearable={false}
              placeholder={t('citation.sourceSearch')}
              onChange={(h) => onChange({ ...value, source_handle: h })}
              onCreate={() => setNewSource('')}
              createLabel={t('source.createNew')}
            />
          )}
        </Field>
        <TextField label={t('citation.page')} value={value.page} onChange={(v) => onChange({ ...value, page: v })} hint={t('citation.pageHint')} />
        <Grid>
          <DateInput label={t('date')} value={value.date} onChange={(d) => onChange({ ...value, date: d })} lang={i18n.language} />
          <Field label={t('citation.confidence')}>
            <ConfidenceSelect value={value.confidence} onChange={(c) => onChange({ ...value, confidence: c })} />
          </Field>
        </Grid>
      </section>
      <AttributesField category="source_attribute_types" value={value.attribute_list ?? []} onChange={(v) => onChange({ ...value, attribute_list: v })} />
      <MediaRefsField value={value.media_list ?? []} onChange={(v) => onChange({ ...value, media_list: v })} />
      <CommonFields value={value} onChange={onChange} citations={false} />
    </div>
  )
}

/* ---------------- repository ---------------- */

export function RepositoryForm({ value, onChange }: FormProps) {
  const { t } = useTranslation('editor')
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <TextField label={t('repository.name')} value={value.name} onChange={(v) => onChange({ ...value, name: v })} autoFocus={!value.name} />
        <Field label={t('repository.type')} className="sm:max-w-72">
          <TypeCombobox category="repository_types" value={value.type} onChange={(v) => onChange({ ...value, type: v })} />
        </Field>
      </section>
      <AddressesField value={value.address_list ?? []} onChange={(v) => onChange({ ...value, address_list: v })} />
      <UrlsField value={value.urls ?? []} onChange={(v) => onChange({ ...value, urls: v })} />
      <CommonFields value={value} onChange={onChange} citations={false} />
    </div>
  )
}

/* ---------------- note ---------------- */

export function NoteForm({ value, onChange }: FormProps) {
  const { t } = useTranslation('editor')
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <NoteTextField value={value} onChange={onChange} />
        <Grid>
          <Field label={t('note.type')}>
            <TypeCombobox category="note_types" value={value.type} onChange={(v) => onChange({ ...value, type: v })} />
          </Field>
          <label className="flex cursor-pointer items-center gap-3 self-end rounded-lg border p-2.5">
            <Switch checked={value.format === 1} onCheckedChange={(v) => onChange({ ...value, format: v ? 1 : 0 })} />
            <span className="text-sm">{t('note.preformatted')}</span>
          </label>
        </Grid>
      </section>
      <CommonFields value={value} onChange={onChange} notes={false} citations={false} />
    </div>
  )
}

/* ---------------- media ---------------- */

export function MediaForm({ value, onChange }: FormProps) {
  const { t, i18n } = useTranslation('editor')
  useAccessToken()
  const dispatch = useAppDispatch()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const replace = async (file: File) => {
    setBusy(true)
    try {
      // binary body: raw fetch, then invalidate what the transaction touched
      const tx = await api<Array<TxEntry & { new: AnyObj }>>(`/media/${value.handle}/file`, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      })
      const n = tx.find((e) => e.new?.handle === value.handle)?.new
      if (n) onChange({ ...value, path: n.path, mime: n.mime, checksum: n.checksum })
      dispatch(invalidateTransaction(tx))
      toast.success(t('media.replaced'))
    } catch (e) {
      toast.error(t('media.replaceFailed'), { description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  const isImage = String(value.mime ?? '').startsWith('image/')
  return (
    <div className="flex flex-col gap-6">
      {value.gramps_id && (
        <section className="flex items-center gap-4">
          <div className="size-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
            {isImage && <img src={`${mediaThumbUrl(value.handle, 200, { square: true })}${value.checksum ? `&checksum=${value.checksum}` : ''}`} alt="" className="size-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate text-muted-foreground">{value.path}</p>
            <p className="text-xs text-muted-foreground">{value.mime}</p>
            <input
              ref={input}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void replace(f)
                e.target.value = ''
              }}
            />
            <Button type="button" variant="outline" size="sm" className="mt-2" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <Loader2 className="animate-spin" /> : <Upload />} {t('media.replaceFile')}
            </Button>
          </div>
        </section>
      )}
      <section className="flex flex-col gap-4">
        <TextField label={t('media.desc')} value={value.desc} onChange={(v) => onChange({ ...value, desc: v })} autoFocus={!value.desc} />
        <DateInput label={t('date')} value={value.date} onChange={(d) => onChange({ ...value, date: d })} lang={i18n.language} />
      </section>
      <AttributesField value={value.attribute_list ?? []} onChange={(v) => onChange({ ...value, attribute_list: v })} />
      {isImage && value.gramps_id && <MapOverlayField value={value} onChange={onChange} />}
      <CommonFields value={value} onChange={onChange} />
    </div>
  )
}
