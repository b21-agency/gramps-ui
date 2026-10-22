import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentUser } from '@/components/user-menu'
import { useChangePasswordMutation, useUpdateUserMutation } from '@/api/enhanced/settings'
import { rtkErrorMessage } from '@/features/tools/use-task'
import type { UserInfo } from '@/lib/types'
import { Field, SettingsBlock } from './parts'
import { AccessTokensBlock, DeveloperBlock, UsernameBlock } from './profile-extra'

export function ProfileSection() {
  return (
    <div className="space-y-10">
      <AccountForm />
      <UsernameBlock />
      <PasswordForm />
      <AccessTokensBlock />
      <DeveloperBlock />
    </div>
  )
}

function AccountForm() {
  const { t } = useTranslation('settings')
  const { data: me, isLoading } = useCurrentUser()
  return (
    <SettingsBlock title={t('profile.title')} description={t('profile.description')}>
      {isLoading || !me ? (
        <div className="max-w-md space-y-3">
          <Skeleton className="h-9" />
          <Skeleton className="h-9" />
        </div>
      ) : (
        <AccountFields key={`${me.full_name}|${me.email}`} me={me} />
      )}
    </SettingsBlock>
  )
}

function AccountFields({ me }: { me: UserInfo }) {
  const { t } = useTranslation('settings')
  const [fullName, setFullName] = useState(me.full_name ?? '')
  const [email, setEmail] = useState(me.email ?? '')
  const [updateUser, { isLoading: saving }] = useUpdateUserMutation()
  const dirty = fullName !== (me.full_name ?? '') || email !== (me.email ?? '')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty) return
    try {
      const body: { full_name?: string; email?: string } = {}
      if (fullName !== (me.full_name ?? '')) body.full_name = fullName.trim()
      if (email !== (me.email ?? '')) body.email = email.trim()
      await updateUser({ name: '-', body }).unwrap()
      toast.success(t('profile.saved'))
    } catch (err) {
      toast.error(t('profile.saveFailed'), { description: rtkErrorMessage(err) })
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-md gap-4">
      <div className="text-sm text-muted-foreground">
        {t('profile.signedInAs')} <span className="font-medium text-foreground">{me.name}</span>
        {' · '}
        {t(`common:role.${me.role}`)}
      </div>
      <Field id="profile-name" label={t('profile.fullName')}>
        <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
      </Field>
      <Field id="profile-email" label={t('profile.email')} hint={t('profile.emailHint')}>
        <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </Field>
      <div>
        <Button type="submit" disabled={!dirty || saving}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? t('common:actions.saving') : t('profile.save')}
        </Button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const { t } = useTranslation('settings')
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [changePassword, { isLoading: saving }] = useChangePasswordMutation()
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && newPw !== confirm
  const tooShort = newPw.length > 0 && newPw.length < 8
  const canSubmit = oldPw && newPw && newPw === confirm && !tooShort && !saving

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await changePassword({ old_password: oldPw, new_password: newPw }).unwrap()
      setOldPw('')
      setNewPw('')
      setConfirm('')
      toast.success(t('password.changed'))
    } catch (err) {
      setError((err as { status?: unknown })?.status === 403 ? t('password.wrongOld') : rtkErrorMessage(err))
    }
  }

  return (
    <SettingsBlock title={t('password.title')} description={t('password.description')}>
      <form onSubmit={onSubmit} className="grid max-w-md gap-4">
        {/* hidden username helps password managers */}
        <input type="text" autoComplete="username" className="hidden" readOnly tabIndex={-1} aria-hidden />
        <Field id="pw-old" label={t('password.current')}>
          <Input
            id="pw-old"
            type="password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            autoComplete="current-password"
            aria-invalid={!!error}
          />
        </Field>
        <Field id="pw-new" label={t('password.new')} hint={tooShort ? t('password.tooShort') : t('password.hint')}>
          <Input
            id="pw-new"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            autoComplete="new-password"
            aria-invalid={tooShort}
          />
        </Field>
        <Field id="pw-confirm" label={t('password.confirm')} hint={mismatch ? t('password.mismatch') : undefined}>
          <Input
            id="pw-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={mismatch}
          />
        </Field>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" variant="outline" disabled={!canSubmit}>
            {saving && <Loader2 className="animate-spin" />}
            {t('password.submit')}
          </Button>
        </div>
      </form>
    </SettingsBlock>
  )
}
