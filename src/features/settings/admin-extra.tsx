// Administration blocks: usage/quotas, media file status, researcher, customization
// (tree config), verify the data, danger zone.
import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  CircleAlert,
  CircleCheck,
  Download,
  FileCheck2,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ObjectPicker } from '@/components/object-picker'
import { ErrorState } from '@/components/states'
import { useGetTreeQuery } from '@/api/trees-api-slice.gen'
import { useGetMetadataResearcherQuery, usePutMetadataResearcherMutation } from '@/api/metadata-api-slice.gen'
import { useReplaceTreeConfigMutation, useUpdateTreeConfigMutation } from '@/api/enhanced/shared'
import { useDeleteAllObjectsMutation, useMigrateTreeMutation, useVerifyTreeMutation } from '@/api/enhanced/settings'
import { TASK_TAGS } from '@/api/enhanced/tools'
import { apiLocale } from '@/i18n'
import { useAuth } from '@/lib/auth'
import { useMetadata, useObjectByHandle, useObjectList } from '@/lib/queries'
import { objectPath, normalizeKind } from '@/lib/objects'
import { TREE_CONFIG, configString, useTreeConfig, type TreeConfig } from '@/lib/tree-config'
import { formatBytes, isAbort, rtkErrorMessage, unwrapWith, useTask } from '@/features/tools/use-task'
import { TaskStatusLine, taskErrorText } from '@/features/tools/task-status'
import { Field, SettingsBlock } from './parts'
import { ReloginDialog, hasFreshToken } from './relogin-dialog'
import { cn } from '@/lib/utils'

const errText = (e: unknown) => rtkErrorMessage(e)

/* ---------------- usage & quotas ---------------- */

interface TreeUsage {
  usage_people?: number | null
  quota_people?: number | null
  usage_media?: number | null
  quota_media?: number | null
  usage_ai?: number | null
  quota_ai?: number | null
}

export function UsageBlock() {
  const { t, i18n } = useTranslation('settings')
  const q = useGetTreeQuery({ treeId: '-' })
  const d = q.data as TreeUsage | undefined
  const rows: Array<[string, number | null | undefined, number | null | undefined, (n: number) => string]> = d
    ? [
        [t('usage.people'), d.usage_people, d.quota_people, (n) => n.toLocaleString(i18n.language)],
        [t('usage.media'), d.usage_media, d.quota_media, (n) => formatBytes(n, i18n.language)],
        ...('usage_ai' in d
          ? [[t('usage.ai'), d.usage_ai, d.quota_ai, (n: number) => n.toLocaleString(i18n.language)] as [string, number | null | undefined, number | null | undefined, (n: number) => string]]
          : []),
      ]
    : []
  return (
    <SettingsBlock title={t('usage.title')} description={t('usage.description')}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-6" />
      ) : !d ? (
        <Skeleton className="h-16 max-w-xl" />
      ) : (
        <dl className="grid max-w-xl gap-4">
          {rows.map(([label, used, quota, fmt]) => {
            const pct = used != null && quota ? Math.min(1, used / quota) : null
            return (
              <div key={label} className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <dt>{label}</dt>
                  <dd className="tabular-nums text-muted-foreground">
                    {used == null ? t('usage.unknown') : fmt(used)}
                    {' / '}
                    {quota ? fmt(quota) : t('usage.unlimited')}
                    {pct != null && ` · ${Math.round(pct * 100)} %`}
                  </dd>
                </div>
                {pct != null && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full', pct > 0.9 ? 'bg-destructive' : 'bg-primary')}
                      style={{ width: `${Math.max(2, pct * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </dl>
      )}
    </SettingsBlock>
  )
}

/* ---------------- media file status ---------------- */

type MediaCheck = Array<{ checksum?: string; gramps_id: string }>
const MEDIA_CHECK = { keys: 'checksum,gramps_id', sort: 'gramps_id' }

export function MediaStatusBlock() {
  const { t } = useTranslation('settings')
  const { data: meta } = useMetadata()
  const allQ = useObjectList<MediaCheck[number]>('media', MEDIA_CHECK)
  const missingQ = useObjectList<MediaCheck[number]>('media', { ...MEDIA_CHECK, filemissing: 1 }, !!meta?.object_counts.media)
  const all = { ...allQ, data: allQ.data?.items }
  const missing = { ...missingQ, data: missingQ.data?.items }
  const noChecksum = (all.data ?? []).filter((m) => !m.checksum)
  return (
    <SettingsBlock title={t('mediaStatus.title')} description={t('mediaStatus.description')}>
      {all.isError ? (
        <ErrorState error={all.error} onRetry={() => all.refetch()} className="py-6" />
      ) : !all.data ? (
        <Skeleton className="h-12 max-w-md" />
      ) : (
        <ul className="grid max-w-xl gap-2 text-sm">
          <li className="text-muted-foreground">{t('mediaStatus.total', { count: all.data.length })}</li>
          <StatusRow ok={!noChecksum.length} label={t('mediaStatus.noChecksum', { count: noChecksum.length })} ids={noChecksum} />
          {!!meta?.object_counts.media &&
            (missing.data ? (
              <StatusRow ok={!missing.data.length} label={t('mediaStatus.missingFile', { count: missing.data.length })} ids={missing.data} />
            ) : missing.isError ? null : (
              <li>
                <Skeleton className="h-5 w-56" />
              </li>
            ))}
        </ul>
      )}
    </SettingsBlock>
  )
}

function StatusRow({ ok, label, ids }: { ok: boolean; label: string; ids: MediaCheck }) {
  return (
    <li className="flex flex-wrap items-start gap-2">
      {ok ? <CircleCheck className="mt-0.5 size-4 text-primary" /> : <CircleAlert className="mt-0.5 size-4 text-destructive" />}
      <span className="min-w-0 flex-1">
        {label}
        {!ok && (
          <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
            {ids.map((m) => (
              <Link key={m.gramps_id} to={`/media/${m.gramps_id}`} className="tabular-nums text-primary underline-offset-4 hover:underline">
                {m.gramps_id}
              </Link>
            ))}
          </span>
        )}
      </span>
    </li>
  )
}

/* ---------------- researcher ---------------- */

const researcherFields = ['name', 'email', 'phone', 'addr', 'locality', 'city', 'state', 'county', 'country', 'postal'] as const

export function ResearcherBlock({ readOnly }: { readOnly?: boolean }) {
  const { t } = useTranslation('settings')
  const { can } = useAuth()
  const q = useGetMetadataResearcherQuery()
  const [editing, setEditing] = useState(false)
  const r = (q.data ?? {}) as Record<string, string>
  const address = ['addr', 'locality', 'city', 'county', 'state', 'country', 'postal']
    .map((k) => r[k])
    .filter(Boolean)
    .join(', ')
  const editable = !readOnly && can('EditTree')
  return (
    <SettingsBlock
      title={t('researcher.title')}
      description={t('researcher.description')}
      action={
        editable &&
        !editing &&
        q.data && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            {t('common:actions.edit')}
          </Button>
        )
      }
    >
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-6" />
      ) : !q.data ? (
        <Skeleton className="h-20 max-w-md" />
      ) : editing ? (
        <ResearcherForm initial={r} onDone={() => setEditing(false)} />
      ) : (
        <dl className="grid max-w-xl gap-y-1.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{t('researcher.name')}</dt>
          <dd>{r.name || '–'}</dd>
          <dt className="text-muted-foreground">{t('researcher.email')}</dt>
          <dd>{r.email ? <a className="text-primary hover:underline" href={`mailto:${r.email}`}>{r.email}</a> : '–'}</dd>
          <dt className="text-muted-foreground">{t('researcher.phone')}</dt>
          <dd>{r.phone ? <a className="text-primary hover:underline" href={`tel:${r.phone}`}>{r.phone}</a> : '–'}</dd>
          {address && (
            <>
              <dt className="text-muted-foreground">{t('researcher.address')}</dt>
              <dd>{address}</dd>
            </>
          )}
        </dl>
      )}
    </SettingsBlock>
  )
}

function ResearcherForm({ initial, onDone }: { initial: Record<string, string>; onDone: () => void }) {
  const { t } = useTranslation('settings')
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(researcherFields.map((k) => [k, initial[k] ?? ''])),
  )
  const [saveResearcher, { isLoading: saving }] = usePutMetadataResearcherMutation()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await saveResearcher({ researcherUpdate: values }).unwrap()
      toast.success(t('researcher.saved'))
      onDone()
    } catch (err) {
      toast.error(t('researcher.saveFailed'), { description: errText(err) })
    }
  }
  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {researcherFields.map((k) => (
          <Field key={k} id={`researcher-${k}`} label={t(`researcher.${k}`)} className={k === 'addr' ? 'sm:col-span-2' : undefined}>
            <Input
              id={`researcher-${k}`}
              type={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
              value={values[k]}
              onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {t('common:actions.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('common:actions.cancel')}
        </Button>
      </div>
    </form>
  )
}

/* ---------------- customization (tree config) ---------------- */

export function CustomizationBlock() {
  const { t } = useTranslation('settings')
  const q = useTreeConfig()
  return (
    <SettingsBlock title={t('custom.title')} description={t('custom.description')}>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-6" />
      ) : !q.data ? (
        <Skeleton className="h-40 max-w-xl" />
      ) : (
        <div className="grid max-w-2xl gap-8">
          <ColorsForm key={`${configString(q.data, TREE_CONFIG.primaryColor)}|${configString(q.data, TREE_CONFIG.secondaryColor)}`} config={q.data} />
          <AppTitleForm key={configString(q.data, TREE_CONFIG.appTitle)} config={q.data} />
          <HomePageObject kind="note" configKey={TREE_CONFIG.homePageNote} config={q.data} />
          <HomePageObject kind="media" configKey={TREE_CONFIG.homePageImage} config={q.data} />
          <ConfigImportExport config={q.data} />
        </div>
      )}
    </SettingsBlock>
  )
}

function useSaveConfig() {
  const { t } = useTranslation('settings')
  const [update, { isLoading: saving }] = useUpdateTreeConfigMutation()
  const save = async (patch: TreeConfig, success = t('custom.saved')) => {
    try {
      await update(patch).unwrap()
      toast.success(success)
      return true
    } catch (err) {
      toast.error(t('custom.saveFailed'), { description: errText(err) })
      return false
    }
  }
  return { save, saving }
}

const hex6 = (c: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : fallback)

function ColorsForm({ config }: { config: TreeConfig }) {
  const { t } = useTranslation('settings')
  const savedPrimary = configString(config, TREE_CONFIG.primaryColor)
  const savedAccent = configString(config, TREE_CONFIG.secondaryColor)
  const [primary, setPrimary] = useState(hex6(savedPrimary, '#3e6a4e'))
  const [accent, setAccent] = useState(hex6(savedAccent, '#a9833a'))
  const { save, saving } = useSaveConfig()
  const custom = !!(savedPrimary || savedAccent)
  return (
    <div className="grid gap-3">
      <h3 className="font-sans text-base font-medium">{t('custom.colors')}</h3>
      <p className="-mt-2 text-sm text-muted-foreground">{t('custom.colorsHint')}</p>
      <div className="flex flex-wrap gap-6">
        {(
          [
            ['primary', primary, setPrimary],
            ['accent', accent, setAccent],
          ] as const
        ).map(([k, v, set]) => (
          <label key={k} className="flex items-center gap-3 text-sm">
            <span className="relative size-9 overflow-hidden rounded-full border" style={{ background: v }}>
              <input type="color" value={v} onChange={(e) => set(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            </span>
            <span>
              <span className="block font-medium">{t(`custom.${k}`)}</span>
              <span className="block font-mono text-xs text-muted-foreground">{v}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => void save({ [TREE_CONFIG.primaryColor]: primary, [TREE_CONFIG.secondaryColor]: accent })}
        >
          {saving && <Loader2 className="animate-spin" />}
          {t('custom.saveColors')}
        </Button>
        {custom && (
          <Button
            variant="ghost"
            disabled={saving}
            onClick={() =>
              void save({ [TREE_CONFIG.primaryColor]: '', [TREE_CONFIG.secondaryColor]: '' }, t('custom.colorsReset')).then(
                (ok) => {
                  if (ok) {
                    setPrimary('#3e6a4e')
                    setAccent('#a9833a')
                  }
                },
              )
            }
          >
            <RotateCcw />
            {t('custom.resetColors')}
          </Button>
        )}
      </div>
    </div>
  )
}

function AppTitleForm({ config }: { config: TreeConfig }) {
  const { t } = useTranslation('settings')
  const saved = configString(config, TREE_CONFIG.appTitle)
  const [title, setTitle] = useState(saved)
  const { save, saving } = useSaveConfig()
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void save({ [TREE_CONFIG.appTitle]: title.trim() })
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <Field id="app-title" label={t('custom.appTitle')} hint={t('custom.appTitleHint')} className="flex-1">
        <Input id="app-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('common:appName')} />
      </Field>
      <Button type="submit" variant="outline" disabled={saving || title.trim() === saved} className="sm:mb-5">
        {saving && <Loader2 className="animate-spin" />}
        {t('common:actions.save')}
      </Button>
    </form>
  )
}

function HomePageObject({ kind, configKey, config }: { kind: 'note' | 'media'; configKey: string; config: TreeConfig }) {
  const { t } = useTranslation('settings')
  const handle = configString(config, configKey)
  const { save, saving } = useSaveConfig()
  const obj = useObjectByHandle<{ gramps_id: string; desc?: string; text?: { string: string } }>(kind, handle || null)
  const label = kind === 'note' ? t('custom.homeNote') : t('custom.homeImage')
  const title = obj.data ? (kind === 'note' ? obj.data.text?.string?.slice(0, 80) : obj.data.desc) : ''
  return (
    <div className="grid gap-2">
      <h3 className="font-sans text-base font-medium">{label}</h3>
      <p className="-mt-1 text-sm text-muted-foreground">{kind === 'note' ? t('custom.homeNoteHint') : t('custom.homeImageHint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {handle && (
          <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl bg-secondary px-3 py-1.5 text-sm">
            {obj.data ? (
              <Link to={objectPath(kind, obj.data.gramps_id)} className="min-w-0 truncate hover:underline">
                <span className="tabular-nums text-muted-foreground">{obj.data.gramps_id}</span> {title}
              </Link>
            ) : obj.isError ? (
              <span className="text-destructive">{t('custom.notFound')}</span>
            ) : (
              <Skeleton className="h-4 w-32" />
            )}
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label={t('custom.remove')}
              disabled={saving}
              onClick={() => void save({ [configKey]: '' })}
            >
              <X className="size-4" />
            </button>
          </span>
        )}
        <ObjectPicker
          kinds={[kind]}
          onChange={(o) => void save({ [configKey]: o.handle })}
          trigger={
            <Button variant="outline" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {handle ? t('custom.choose') : t('custom.chooseFirst')}
            </Button>
          }
        />
      </div>
    </div>
  )
}

function ConfigImportExport({ config }: { config: TreeConfig }) {
  const { t } = useTranslation('settings')
  const [replace] = useReplaceTreeConfigMutation()
  const fileRef = useRef<HTMLInputElement>(null)
  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grampsweb-tree-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  const importConfig = async (file: File) => {
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      data = null
    }
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.keys(data).length) {
      toast.error(t('custom.importInvalid'))
      return
    }
    try {
      await replace(data as TreeConfig).unwrap()
      toast.success(t('custom.imported'))
    } catch (err) {
      toast.error(t('custom.saveFailed'), { description: errText(err) })
    }
  }
  return (
    <div className="grid gap-2">
      <h3 className="font-sans text-base font-medium">{t('custom.transfer')}</h3>
      <p className="-mt-1 text-sm text-muted-foreground">{t('custom.transferHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportConfig}>
          <Download />
          {t('custom.export')}
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload />
          {t('custom.import')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void importConfig(f)
          }}
        />
      </div>
    </div>
  )
}

/* ---------------- verify the data ---------------- */

const verifyInts = [
  ['oldage', 90],
  ['hwdif', 30],
  ['cspace', 8],
  ['cbspan', 25],
  ['yngmar', 17],
  ['oldmar', 50],
  ['oldmom', 48],
  ['yngmom', 17],
  ['yngdad', 18],
  ['olddad', 65],
  ['wedder', 3],
  ['mxchildmom', 12],
  ['mxchilddad', 15],
  ['lngwdw', 30],
  ['oldunm', 99],
] as const

interface VerifyIssue {
  message: string
  object_type: string
  object_id: string
  name?: string
  severity: 'error' | 'warning' | string
}

export function VerifyBlock() {
  const { t } = useTranslation('settings')
  const task = useTask<VerifyIssue[] | string>()
  const [verify] = useVerifyTreeMutation()
  const [opts, setOpts] = useState<Record<string, number>>(() => Object.fromEntries(verifyInts))
  const [estimate, setEstimate] = useState(false)
  const [invdate, setInvdate] = useState(true)
  const [showOptions, setShowOptions] = useState(false)
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all')
  const run = () =>
    task
      .start((signal) => unwrapWith(signal, verify({ locale: apiLocale(), ...opts, estimate_age: estimate, invdate })))
      .catch((e) => {
        if (!isAbort(e)) toast.error(taskErrorText(t, e))
      })
  const raw = task.phase === 'success' ? task.result : null
  const issues: VerifyIssue[] | null = raw == null ? null : Array.isArray(raw) ? raw : (() => {
    try {
      const p = JSON.parse(String(raw))
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  })()
  const shown = (issues ?? []).filter((i) => filter === 'all' || i.severity === filter)
  const errors = (issues ?? []).filter((i) => i.severity === 'error').length
  return (
    <SettingsBlock title={t('verify.title')} description={t('verify.description')}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={run} disabled={task.running}>
            {task.running ? <Loader2 className="animate-spin" /> : <FileCheck2 />}
            {t('verify.run')}
          </Button>
          <Button variant="ghost" onClick={() => setShowOptions((s) => !s)} aria-expanded={showOptions}>
            {showOptions ? t('verify.hideOptions') : t('verify.showOptions')}
          </Button>
        </div>
        {showOptions && (
          <div className="grid gap-4 rounded-2xl bg-secondary/50 p-4">
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {verifyInts.map(([k]) => (
                <label key={k} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">{t(`verify.opt.${k}`)}</span>
                  <Input
                    type="number"
                    min={0}
                    className="h-8 w-20 shrink-0 tabular-nums"
                    value={opts[k]}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!Number.isNaN(v)) setOpts((o) => ({ ...o, [k]: v }))
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <label className="flex items-center gap-2">
                <Switch checked={estimate} onCheckedChange={setEstimate} />
                {t('verify.opt.estimate_age')}
              </label>
              <label className="flex items-center gap-2">
                <Switch checked={invdate} onCheckedChange={setInvdate} />
                {t('verify.opt.invdate')}
              </label>
            </div>
          </div>
        )}
        {task.phase !== 'success' && (
          <TaskStatusLine phase={task.phase} progress={task.progress} error={task.error} runningLabel={t('verify.running')} />
        )}
        {issues && !issues.length && (
          <p className="flex items-center gap-2 text-sm text-primary">
            <CircleCheck className="size-4" />
            {t('verify.clean')}
          </p>
        )}
        {issues && !!issues.length && (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="mr-2">{t('verify.summary', { errors, warnings: issues.length - errors })}</span>
              {(['all', 'error', 'warning'] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} onClick={() => setFilter(f)}>
                  {t(`verify.filter.${f}`)}
                </Button>
              ))}
            </div>
            <ul className="max-h-[32rem] divide-y divide-border/60 overflow-auto rounded-2xl bg-secondary/40">
              {shown.map((i, n) => {
                const kind = normalizeKind(i.object_type.toLowerCase())
                return (
                  <li key={`${i.object_id}-${n}`} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    {i.severity === 'error' ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-label={t('verify.error')} />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brass" aria-label={t('verify.warning')} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block">{i.message}</span>
                      {kind ? (
                        <Link to={objectPath(kind, i.object_id)} className="block truncate text-muted-foreground hover:text-foreground hover:underline">
                          <span className="tabular-nums">{i.object_id}</span> · {i.name || i.object_id}
                        </Link>
                      ) : (
                        <span className="block truncate text-muted-foreground">
                          {i.object_id} · {i.name}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </SettingsBlock>
  )
}

/* ---------------- danger zone ---------------- */

const namespaces = ['people', 'families', 'events', 'places', 'sources', 'citations', 'repositories', 'notes', 'media'] as const
const nsKind: Record<(typeof namespaces)[number], string> = {
  people: 'person',
  families: 'family',
  events: 'event',
  places: 'place',
  sources: 'source',
  citations: 'citation',
  repositories: 'repository',
  notes: 'note',
  media: 'media',
}

export function DangerZoneBlock() {
  const { t } = useTranslation('settings')
  const { data: meta } = useMetadata()
  const task = useTask({ invalidates: TASK_TAGS.deleteAll })
  const [deleteAll] = useDeleteAllObjectsMutation()
  const [relogin, setRelogin] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([...namespaces])
  const [confirmText, setConfirmText] = useState('')
  const word = t('danger.confirmWord')
  const openDialog = () => {
    setSelected([...namespaces])
    setConfirmText('')
    if (hasFreshToken()) setOpen(true)
    else setRelogin(true)
  }
  const run = () => {
    setOpen(false)
    const all = selected.length === namespaces.length
    task
      .start((signal) => unwrapWith(signal, deleteAll({ namespaces: all ? undefined : selected })))
      .then(() => toast.success(t('danger.done')))
      .catch((e) => {
        if (!isAbort(e)) toast.error(taskErrorText(t, e))
      })
  }
  return (
    <SettingsBlock title={t('danger.title')} description={t('danger.description')}>
      <div className="grid max-w-2xl gap-3 rounded-2xl bg-destructive/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t('danger.deleteAll')}</p>
            <p className="text-sm text-muted-foreground">{t('danger.deleteAllHint')}</p>
          </div>
          <Button variant="destructive" onClick={openDialog} disabled={task.running}>
            {task.running ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {t('danger.deleteAllAction')}
          </Button>
        </div>
        <TaskStatusLine phase={task.phase} progress={task.progress} error={task.error} runningLabel={t('danger.running')} successLabel={t('danger.done')} />
      </div>
      <ReloginDialog open={relogin} onOpenChange={setRelogin} onDone={() => setOpen(true)} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('danger.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('danger.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {namespaces.map((ns) => (
              <label key={ns} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(ns)}
                  onCheckedChange={(c) => setSelected((s) => (c ? [...s, ns] : s.filter((x) => x !== ns)))}
                />
                <span className="flex-1">{t(`common:objects.${nsKind[ns]}`)}</span>
                <span className="tabular-nums text-muted-foreground">{(meta?.object_counts[ns] ?? 0).toLocaleString()}</span>
              </label>
            ))}
          </div>
          <Field id="danger-confirm" label={t('danger.typeToConfirm', { word })}>
            <Input id="danger-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="destructive" disabled={!selected.length || confirmText.trim().toLowerCase() !== word.toLowerCase()} onClick={run}>
              <Trash2 />
              {t('danger.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsBlock>
  )
}

/* ---------------- search index status ---------------- */

export function SearchIndexStatus() {
  const { t } = useTranslation('settings')
  const { data: meta } = useMetadata()
  if (!meta) return null
  const count = meta.search?.sifts?.count
  const total = Object.values(meta.object_counts).reduce((a, b) => a + (b ?? 0), 0)
  const ok = total === 0 || (count ?? 0) / total > 0.98
  return (
    <p className={cn('flex items-center gap-2 text-sm', ok ? 'text-muted-foreground' : 'text-destructive')}>
      {ok ? <CircleCheck className="size-4 text-primary" /> : <CircleAlert className="size-4" />}
      {t('admin.indexStatus', { count: count ?? 0, total })}
      {!ok && ` · ${t('admin.indexStale')}`}
    </p>
  )
}

/* ---------------- database schema upgrade ---------------- */

/** True when the tree's database schema is older than the server needs. */
export function useSchemaOutdated() {
  const { data: meta } = useMetadata()
  const db = meta?.database as { schema?: string; actual_schema?: number | string } | undefined
  if (!db?.actual_schema || !db.schema) return false
  return parseInt(String(db.actual_schema), 10) < parseInt(db.schema.split('.')[0], 10)
}

export function UpgradeBlock() {
  const { t } = useTranslation('settings')
  const outdated = useSchemaOutdated()
  const task = useTask({ invalidates: TASK_TAGS.migrate })
  const [migrate] = useMigrateTreeMutation()
  if (!outdated && task.phase === 'idle') return null
  const run = () =>
    task
      .start((signal) => unwrapWith(signal, migrate()))
      .catch((e) => {
        if (!isAbort(e)) toast.error(taskErrorText(t, e))
      })
  return (
    <SettingsBlock title={t('upgrade.title')} description={t('upgrade.description')}>
      <div className="grid max-w-md gap-3">
        <Button onClick={run} disabled={task.running || !outdated}>
          {task.running && <Loader2 className="animate-spin" />}
          {t('upgrade.run')}
        </Button>
        <TaskStatusLine phase={task.phase} progress={task.progress} error={task.error} runningLabel={t('upgrade.running')} successLabel={t('upgrade.done')} />
      </div>
    </SettingsBlock>
  )
}
