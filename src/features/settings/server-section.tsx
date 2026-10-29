import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/states'
import { useDeleteConfigMutation, useGetConfigsQuery, usePutConfigMutation } from '@/api/enhanced/metadata-slice-enhanced'
import { rtkErrorMessage } from '@/features/tools/use-task'
import { cn } from '@/lib/utils'
import { Field, SettingsBlock } from './parts'

/**
 * Server settings (admins only): values saved here are stored in the user database and take
 * precedence over the server configuration (environment / config file); an empty field falls
 * back to it. The API only knows what was saved here, so configured defaults cannot be shown.
 */
export function ServerSection() {
  const q = useGetConfigsQuery()
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!q.data)
    return (
      <div className="grid gap-6">
        <Skeleton className="h-96 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    )
  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <EmailBlock saved={q.data} />
      <AddressBlock saved={q.data} />
    </div>
  )
}

type Saved = Record<string, string | null>

interface ConfigField {
  key: string
  type?: 'text' | 'email' | 'url' | 'password'
  placeholder?: string
  inputMode?: 'numeric'
  pattern?: string
  autoComplete?: string
  className?: string
}

const emailFields: ConfigField[] = [
  { key: 'EMAIL_HOST', placeholder: 'smtp.example.com', autoComplete: 'off', className: 'sm:col-span-4' },
  { key: 'EMAIL_PORT', placeholder: '465', inputMode: 'numeric', pattern: '[0-9]{1,5}', autoComplete: 'off', className: 'sm:col-span-2' },
  { key: 'EMAIL_HOST_USER', autoComplete: 'off', className: 'sm:col-span-3' },
  { key: 'EMAIL_HOST_PASSWORD', type: 'password', autoComplete: 'new-password', className: 'sm:col-span-3' },
  { key: 'DEFAULT_FROM_EMAIL', placeholder: 'noreply@example.com', autoComplete: 'off', className: 'sm:col-span-6' },
]

const addressFields: ConfigField[] = [
  { key: 'BASE_URL', type: 'url', placeholder: 'https://family.example.com', autoComplete: 'off', className: 'sm:col-span-6' },
  { key: 'FRONTEND_URL', type: 'url', placeholder: 'https://family.example.com', autoComplete: 'off', className: 'sm:col-span-6' },
]

function EmailBlock({ saved }: { saved: Saved }) {
  const { t } = useTranslation('settings')
  return (
    <SettingsBlock title={t('server.email.title')} description={t('server.email.description')}>
      <ConfigForm fields={emailFields} saved={saved} />
      <p className="max-w-prose text-xs text-muted-foreground">{t('server.email.encryption')}</p>
    </SettingsBlock>
  )
}

function AddressBlock({ saved }: { saved: Saved }) {
  const { t } = useTranslation('settings')
  return (
    <SettingsBlock title={t('server.address.title')} description={t('server.address.description')}>
      <ConfigForm fields={addressFields} saved={saved} />
    </SettingsBlock>
  )
}

/**
 * Edits a group of config keys. Changed values are saved, cleared ones deleted (the server
 * configuration applies again). Passwords are write-only: the saved one is never shown, typing
 * replaces it, and it is removed with its own button.
 */
function ConfigForm({ fields, saved }: { fields: ConfigField[]; saved: Saved }) {
  const { t } = useTranslation('settings')
  const initial = () => Object.fromEntries(fields.map((f) => [f.key, f.type === 'password' ? '' : (saved[f.key] ?? '')]))
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [putConfig] = usePutConfigMutation()
  const [deleteConfig] = useDeleteConfigMutation()
  const [saving, setSaving] = useState(false)

  const changes = fields.flatMap((f) => {
    const next = values[f.key].trim()
    if (f.type === 'password') return next ? [{ key: f.key, value: next }] : []
    return next !== (saved[f.key] ?? '') ? [{ key: f.key, value: next }] : []
  })

  const run = async (list: Array<{ key: string; value: string }>, success: string) => {
    setSaving(true)
    try {
      for (const { key, value } of list) {
        if (value) await putConfig({ key, configValueArgs: { value } }).unwrap()
        else await deleteConfig({ key }).unwrap()
      }
      toast.success(success)
      // passwords are not echoed back; clear what was typed once it is stored
      setValues((v) => ({ ...v, ...Object.fromEntries(fields.filter((f) => f.type === 'password').map((f) => [f.key, ''])) }))
    } catch (err) {
      toast.error(t('server.saveFailed'), { description: rtkErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (changes.length) void run(changes, t('server.saved'))
  }

  return (
    <form onSubmit={submit} className="grid max-w-2xl gap-4">
      <div className="grid gap-4 sm:grid-cols-6">
        {fields.map((f) => {
          const id = `config-${f.key}`
          const stored = saved[f.key] != null && saved[f.key] !== ''
          const secret = f.type === 'password'
          const hint = secret && stored ? t('server.passwordSaved') : t(`server.hints.${f.key}`, { defaultValue: '' })
          return (
            <Field key={f.key} id={id} label={t(`server.fields.${f.key}`)} hint={hint || undefined} className={cn('content-start', f.className)}>
              <div className="flex gap-2">
                <Input
                  id={id}
                  type={f.type ?? 'text'}
                  value={values[f.key]}
                  placeholder={secret && stored ? '••••••••' : f.placeholder}
                  inputMode={f.inputMode}
                  pattern={f.pattern}
                  autoComplete={f.autoComplete}
                  spellCheck={false}
                  className={cn('min-w-0 flex-1', f.inputMode === 'numeric' && 'tabular-nums')}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
                {secret && stored && (
                  <Button type="button" variant="outline" disabled={saving} onClick={() => void run([{ key: f.key, value: '' }], t('server.passwordRemoved'))}>
                    {t('server.remove')}
                  </Button>
                )}
              </div>
            </Field>
          )
        })}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !changes.length}>
          {saving && <Loader2 className="animate-spin" />}
          {t('common:actions.save')}
        </Button>
        {changes.length > 0 && (
          <Button type="button" variant="outline" disabled={saving} onClick={() => setValues(initial)}>
            {t('common:actions.cancel')}
          </Button>
        )}
      </div>
    </form>
  )
}
