import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useCurrentUser } from '@/components/user-menu'
import { decodeJwt, tokens } from '@/lib/api'
import { Field } from './parts'

/** True if the current access token came straight from a password sign-in (not a refresh). */
export function hasFreshToken() {
  const c = decodeJwt(tokens.access) as { fresh?: boolean; exp?: number } | null
  return !!c?.fresh && (c.exp ?? 0) * 1000 - Date.now() > 60_000
}

/**
 * Some actions (deleting all data, linking accounts) need a token from a fresh sign-in.
 * This asks for the password again and replaces the stored tokens.
 */
export function ReloginDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const { t } = useTranslation('settings')
  const { data: me } = useCurrentUser()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!me || !password) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: me.name, password }),
      })
      if (!res.ok) {
        setError(res.status === 429 ? t('auth:errors.rate_limited') : t('relogin.wrong'))
        return
      }
      const data = await res.json()
      tokens.set(data.access_token, data.refresh_token)
      setPassword('')
      onOpenChange(false)
      onDone()
    } catch {
      setError(t('common:error.network'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setPassword('')
          setError(null)
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('relogin.title')}</DialogTitle>
            <DialogDescription>{t('relogin.description')}</DialogDescription>
          </DialogHeader>
          <input type="text" autoComplete="username" value={me?.name ?? ''} readOnly className="hidden" tabIndex={-1} aria-hidden />
          <Field id="relogin-pw" label={t('password.current')}>
            <Input
              id="relogin-pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!error}
              autoFocus
            />
          </Field>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={!password || busy}>
              {busy && <Loader2 className="animate-spin" />}
              {t('relogin.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
