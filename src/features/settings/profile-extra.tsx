// Profile blocks: user name, persistent access tokens (calendar subscription, sync devices),
// developer tools.
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarDays, Check, Copy, ExternalLink, KeyRound, Laptop, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useCurrentUser } from '@/components/user-menu'
import { api, ApiError, freshAccessToken } from '@/lib/api'
import { formatTimestamp } from '@/lib/format'
import { Field, SettingsBlock } from './parts'

const errText = (e: unknown) => (e instanceof Error ? e.message : undefined)

async function copy(text: string, ok: string, fail: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(ok)
  } catch {
    toast.error(fail)
  }
}

/* ---------------- user name ---------------- */

export function UsernameBlock() {
  const { t } = useTranslation('settings')
  const { data: me } = useCurrentUser()
  return (
    <SettingsBlock title={t('username.title')} description={t('username.description')}>
      {!me ? <Skeleton className="h-9 max-w-md" /> : <UsernameForm key={me.name} current={me.name} />}
    </SettingsBlock>
  )
}

function UsernameForm({ current }: { current: string }) {
  const { t } = useTranslation('settings')
  const qc = useQueryClient()
  const [name, setName] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = /^[\w.@+-]+$/.test(name)
  const dirty = name !== current
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || !valid) return
    setSaving(true)
    setError(null)
    try {
      await api('/users/-/', { method: 'PUT', json: { name_new: name } })
      await qc.invalidateQueries({ queryKey: ['user', 'me'] })
      await qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('username.saved'))
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? t('username.taken') : (errText(err) ?? String(err)))
    } finally {
      setSaving(false)
    }
  }
  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-start">
      <Field
        id="username-new"
        label={t('users.username')}
        hint={error ?? (name && !valid ? t('users.usernameInvalid') : t('username.hint'))}
        className="flex-1 [&>p]:aria-[invalid]:text-destructive"
      >
        <Input
          id="username-new"
          value={name}
          onChange={(e) => setName(e.target.value.trim())}
          autoCapitalize="none"
          autoComplete="username"
          spellCheck={false}
          aria-invalid={!!error || (!!name && !valid)}
        />
      </Field>
      <Button type="submit" variant="outline" disabled={!dirty || !valid || saving} className="sm:mt-[1.375rem]">
        {saving && <Loader2 className="animate-spin" />}
        {t('username.save')}
      </Button>
    </form>
  )
}

/* ---------------- access tokens ---------------- */

interface SyncToken {
  id: string
  label: string
  created_at?: string
  last_used_at?: string | null
}

const parseUtc = (v?: string | null) => (v ? new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(v) ? v : `${v}Z`) : null)

export function AccessTokensBlock() {
  const { t, i18n } = useTranslation('settings')
  const qc = useQueryClient()
  const ics = useQuery({
    queryKey: ['access-tokens', 'anniversaries_ics'],
    queryFn: () => api<{ active: boolean }>('/users/-/access-tokens/anniversaries_ics/'),
    retry: false,
  })
  const sync = useQuery({
    queryKey: ['access-tokens', 'sync'],
    queryFn: async () => {
      try {
        return await api<SyncToken[]>('/users/-/access-tokens/sync/tokens/')
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null // server without sync tokens
        throw e
      }
    },
    retry: false,
  })
  const [created, setCreated] = useState<{ title: string; value: string; hint: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [revoke, setRevoke] = useState<{ scope: 'anniversaries_ics' | 'sync'; id?: string; label: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // the calendar feed lives at /api/anniversaries.ics?token=…
  const createIcs = async () => {
    setBusy(true)
    try {
      const r = await api<{ token: string }>('/users/-/access-tokens/anniversaries_ics/', { method: 'POST', json: {} })
      await qc.invalidateQueries({ queryKey: ['access-tokens', 'anniversaries_ics'] })
      setCreated({
        title: t('tokens.icsCreated'),
        value: `${window.location.origin}/api/anniversaries.ics?token=${encodeURIComponent(r.token)}`,
        hint: t('tokens.icsCreatedHint'),
      })
    } catch (err) {
      toast.error(t('tokens.failed'), { description: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  const doRevoke = async () => {
    if (!revoke) return
    setBusy(true)
    try {
      const base = `/users/-/access-tokens/${revoke.scope}/`
      await api(revoke.id ? `${base}tokens/${encodeURIComponent(revoke.id)}/` : base, { method: 'DELETE' })
      await qc.invalidateQueries({ queryKey: ['access-tokens'] })
      toast.success(t('tokens.revoked'))
      setRevoke(null)
    } catch (err) {
      toast.error(t('tokens.failed'), { description: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  const fmt = (v?: string | null) => {
    const d = parseUtc(v)
    return d && !Number.isNaN(d.getTime()) ? formatTimestamp(d.getTime() / 1000, i18n.language) : (v ?? '')
  }

  return (
    <SettingsBlock title={t('tokens.title')} description={t('tokens.description')}>
      <div className="grid max-w-2xl gap-6">
        {/* calendar subscription */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
          <CalendarDays className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t('tokens.ics')}</p>
            <p className="text-sm text-muted-foreground">
              {ics.isLoading ? '…' : ics.data?.active ? t('tokens.icsActive') : t('tokens.icsInactive')}
            </p>
          </div>
          {ics.isError ? (
            <Button variant="outline" onClick={() => ics.refetch()}>
              {t('common:actions.retry', { defaultValue: 'Retry' })}
            </Button>
          ) : ics.data?.active ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={createIcs}>
                {t('tokens.icsRenew')}
              </Button>
              <Button variant="ghost" onClick={() => setRevoke({ scope: 'anniversaries_ics', label: t('tokens.ics') })}>
                {t('tokens.revoke')}
              </Button>
            </div>
          ) : (
            <Button disabled={busy || ics.isLoading} onClick={createIcs}>
              {busy && <Loader2 className="animate-spin" />}
              {t('tokens.icsCreate')}
            </Button>
          )}
        </div>

        {/* sync devices */}
        {sync.data !== null && (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{t('tokens.sync')}</p>
                <p className="text-sm text-muted-foreground">{t('tokens.syncHint')}</p>
              </div>
              <Button variant="outline" onClick={() => setAdding(true)} disabled={!sync.data}>
                <Plus />
                {t('tokens.syncAdd')}
              </Button>
            </div>
            {sync.isLoading ? (
              <Skeleton className="h-12" />
            ) : sync.isError ? (
              <p className="text-sm text-destructive">{t('tokens.loadFailed')}</p>
            ) : !sync.data?.length ? (
              <p className="text-sm text-muted-foreground">{t('tokens.syncNone')}</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {sync.data.map((tok) => (
                  <li key={tok.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Laptop className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{tok.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('tokens.created', { date: fmt(tok.created_at) })} ·{' '}
                        {tok.last_used_at ? t('tokens.lastUsed', { date: fmt(tok.last_used_at) }) : t('tokens.neverUsed')}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setRevoke({ scope: 'sync', id: tok.id, label: tok.label })}>
                      {t('tokens.revoke')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <AddSyncDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={(token) => setCreated({ title: t('tokens.created_title'), value: token, hint: t('tokens.createdHint') })}
      />

      <Dialog open={!!created} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false} onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{created?.title}</DialogTitle>
            <DialogDescription>{created?.hint}</DialogDescription>
          </DialogHeader>
          <code className="block rounded-lg border bg-muted p-3 text-xs break-all select-all">{created?.value}</code>
          <DialogFooter>
            <Button variant="outline" onClick={() => created && void copy(created.value, t('tokens.copied'), t('tokens.copyFailed'))}>
              <Copy />
              {t('tokens.copy')}
            </Button>
            <Button onClick={() => setCreated(null)}>{t('common:actions.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revoke} onOpenChange={(o) => !o && setRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tokens.revokeTitle', { name: revoke?.label })}</AlertDialogTitle>
            <AlertDialogDescription>{t('tokens.revokeDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('common:actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                void doRevoke()
              }}
            >
              {busy && <Loader2 className="animate-spin" />}
              {t('tokens.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsBlock>
  )
}

function AddSyncDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: (token: string) => void
}) {
  const { t } = useTranslation('settings')
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    setBusy(true)
    try {
      const r = await api<{ token: string }>('/users/-/access-tokens/sync/tokens/', { method: 'POST', json: { label: label.trim() } })
      await qc.invalidateQueries({ queryKey: ['access-tokens', 'sync'] })
      setLabel('')
      onOpenChange(false)
      onCreated(r.token)
    } catch (err) {
      toast.error(t('tokens.failed'), { description: errText(err) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('tokens.syncAdd')}</DialogTitle>
            <DialogDescription>{t('tokens.syncAddHint')}</DialogDescription>
          </DialogHeader>
          <Field id="sync-label" label={t('tokens.deviceName')}>
            <Input id="sync-label" value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} autoFocus />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={!label.trim() || busy}>
              {busy && <Loader2 className="animate-spin" />}
              {t('tokens.add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------- developer tools ---------------- */

export function DeveloperBlock() {
  const { t } = useTranslation('settings')
  const [copied, setCopied] = useState(false)
  const copyToken = async () => {
    const token = await freshAccessToken()
    if (!token) return toast.error(t('dev.noToken'))
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('tokens.copyFailed'))
    }
  }
  return (
    <SettingsBlock title={t('dev.title')} description={t('dev.description')}>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copyToken}>
          {copied ? <Check /> : <KeyRound />}
          {t('dev.copyToken')}
        </Button>
        <Button variant="ghost" asChild>
          <a href="/api/swagger-ui/" target="_blank" rel="noreferrer">
            <ExternalLink />
            {t('dev.swagger')}
          </a>
        </Button>
      </div>
    </SettingsBlock>
  )
}
