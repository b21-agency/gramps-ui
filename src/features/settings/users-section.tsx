import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dices, Loader2, Pencil, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState, ErrorState, RowsSkeleton } from '@/components/states'
import { useCurrentUser } from '@/components/user-menu'
import { api, apiRaw } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { initials } from '@/lib/format'
import type { UserInfo } from '@/lib/types'
import { Field, SettingsBlock } from './parts'

type User = UserInfo & { user_id?: string }

function useRoles() {
  const { can } = useAuth()
  return can('MakeAdmin') ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4]
}

export function UsersSection() {
  const { t } = useTranslation('settings')
  const { data: me } = useCurrentUser()
  const q = useQuery({
    queryKey: ['users', 'list'],
    queryFn: async () => (await apiRaw<User[]>('/users/', { query: { page: 1, pagesize: 500 } })).data,
  })
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)

  const users = [...(q.data ?? [])].sort(
    (a, b) => b.role - a.role || (a.full_name || a.name).localeCompare(b.full_name || b.name),
  )
  // a disabled (-1) or unconfirmed (-2) account is shown, but sorted last
  users.sort((a, b) => Number(a.role < 0) - Number(b.role < 0))

  return (
    <SettingsBlock
      title={t('users.title')}
      description={t('users.description')}
      action={
        <Button onClick={() => setCreating(true)}>
          <UserPlus />
          {t('users.add')}
        </Button>
      }
    >
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <RowsSkeleton rows={4} />
      ) : !users.length ? (
        <EmptyState icon={UsersRound} title={t('users.empty')} />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {users.map((u) => {
            const self = me?.name === u.name
            return (
              <li key={u.name} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-secondary text-xs text-secondary-foreground">
                      {initials(u.full_name || u.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="truncate font-medium">{u.full_name || u.name}</span>
                      {self && <span className="text-xs text-muted-foreground">{t('users.you')}</span>}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {[u.name, u.email].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-12 sm:pl-0">
                  <Badge variant={u.role >= 4 ? 'default' : u.role < 0 ? 'destructive' : 'secondary'}>
                    {roleLabel(t, u.role)}
                  </Badge>
                  <div className="ml-auto flex gap-1 sm:ml-2">
                    <Button variant="ghost" size="icon" aria-label={t('users.edit', { name: u.name })} onClick={() => setEditing(u)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={self}
                      aria-label={t('users.delete', { name: u.name })}
                      onClick={() => setDeleting(u)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <UserDialog open={creating} onOpenChange={setCreating} />
      <UserDialog open={!!editing} user={editing ?? undefined} self={editing?.name === me?.name} onOpenChange={(o) => !o && setEditing(null)} />
      <DeleteUserDialog user={deleting} onClose={() => setDeleting(null)} />
    </SettingsBlock>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function roleLabel(t: (k: string, o?: any) => string, role: number) {
  if (role === -1) return t('users.disabled')
  if (role === -2) return t('users.unconfirmed')
  return t(`common:role.${role}`)
}

function generatePassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function UserDialog({
  open,
  onOpenChange,
  user,
  self,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  user?: User
  self?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <UserForm user={user} self={self} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function UserForm({ user, self, onDone }: { user?: User; self?: boolean; onDone: () => void }) {
  const { t } = useTranslation('settings')
  const qc = useQueryClient()
  const roles = useRoles()
  const { can } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(String(user?.role ?? 1))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isNew = !user
  const nameOk = /^[\w.@+-]+$/.test(name)
  const valid = isNew
    ? nameOk && fullName.trim() && email.trim() && password.length >= 8
    : fullName.trim() !== '' || email.trim() !== ''
  const roleLocked = !!self || (!isNew && !can('EditUserRole'))
  const roleOptions = user && !roles.includes(user.role) ? [user.role, ...roles] : roles

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      if (isNew) {
        await api(`/users/${encodeURIComponent(name)}/`, {
          method: 'POST',
          json: { full_name: fullName.trim(), email: email.trim(), password, role: Number(role) },
        })
        toast.success(t('users.created', { name }), { description: t('users.createdHint') })
      } else {
        const body: Record<string, unknown> = {}
        if (fullName !== (user.full_name ?? '')) body.full_name = fullName.trim()
        if (email !== (user.email ?? '')) body.email = email.trim()
        if (!roleLocked && Number(role) !== user.role) body.role = Number(role)
        if (Object.keys(body).length) await api(`/users/${encodeURIComponent(user.name)}/`, { method: 'PUT', json: body })
        toast.success(t('users.saved', { name: user.name }))
      }
      await qc.invalidateQueries({ queryKey: ['users'] })
      if (self) await qc.invalidateQueries({ queryKey: ['user', 'me'] })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{isNew ? t('users.addTitle') : t('users.editTitle', { name: user.full_name || user.name })}</DialogTitle>
        <DialogDescription>{isNew ? t('users.addDescription') : t('users.editDescription')}</DialogDescription>
      </DialogHeader>
      {isNew && (
        <Field
          id="user-name"
          label={t('users.username')}
          hint={name && !nameOk ? t('users.usernameInvalid') : t('users.usernameHint')}
        >
          <Input
            id="user-name"
            value={name}
            onChange={(e) => setName(e.target.value.trim())}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={!!name && !nameOk}
            autoFocus
          />
        </Field>
      )}
      <Field id="user-fullname" label={t('profile.fullName')}>
        <Input id="user-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
      </Field>
      <Field id="user-email" label={t('profile.email')}>
        <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
      </Field>
      {isNew && (
        <Field id="user-password" label={t('users.password')} hint={t('users.passwordHint')}>
          <div className="flex gap-2">
            <Input
              id="user-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              className="font-mono"
            />
            <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
              <Dices />
              {t('users.generate')}
            </Button>
          </div>
        </Field>
      )}
      <div className="grid gap-1.5">
        <span className="text-sm font-medium" id="user-role-label">
          {t('users.role')}
        </span>
        <Select value={role} onValueChange={setRole} disabled={roleLocked}>
          <SelectTrigger className="w-full" aria-labelledby="user-role-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={String(r)}>
                <span>{roleLabel(t, r)}</span>
                <span className="text-xs text-muted-foreground">{t(`users.roleHint.${r}`, { defaultValue: '' })}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {self && <p className="text-xs text-muted-foreground">{t('users.ownRole')}</p>}
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" disabled={!valid || saving}>
          {saving && <Loader2 className="animate-spin" />}
          {isNew ? t('users.create') : t('common:actions.save')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function DeleteUserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useTranslation('settings')
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const remove = async () => {
    if (!user) return
    setBusy(true)
    try {
      await api(`/users/${encodeURIComponent(user.name)}/`, { method: 'DELETE' })
      await qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(t('users.deleted', { name: user.name }))
      onClose()
    } catch (err) {
      toast.error(t('users.deleteFailed'), { description: err instanceof Error ? err.message : undefined })
    } finally {
      setBusy(false)
    }
  }
  return (
    <AlertDialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('users.deleteTitle', { name: user?.full_name || user?.name })}</AlertDialogTitle>
          <AlertDialogDescription>{t('users.deleteDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('common:actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault()
              void remove()
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {t('users.deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
