import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login } from '@/lib/api'
import { authInput, authSubmit } from './styles'

/**
 * A fresh server without any user hands out a one-time token for creating the first
 * owner (POST /token/create_owner/; 405 once users exist). Returns that token or null.
 */
export function useOwnerSetupToken() {
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    // once a server is known to have users there is no first run any more; skip the probe
    // (it also counts against the 1/s token rate limit)
    try {
      if (localStorage.getItem('gw.hasUsers')) return
    } catch {
      /* storage unavailable */
    }
    fetch('/api/token/create_owner/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then((r) => {
        if (r.status === 405) {
          try {
            localStorage.setItem('gw.hasUsers', '1')
          } catch {
            /* storage unavailable */
          }
        }
        return r.ok ? r.json() : null
      })
      .then((d) => alive && d?.access_token && setToken(d.access_token))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return token
}

export function FirstRunForm({ token }: { token: string }) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameOk = /^[\w.@+-]+$/.test(name)
  const valid = nameOk && fullName.trim() && email.trim() && password.length >= 8 && password === confirm

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(name)}/create_owner/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim(), full_name: fullName.trim(), password }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message || body?.message || res.statusText)
      }
      await new Promise((r) => setTimeout(r, 1100)) // token endpoint allows one call per second
      await login(name, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, props: Record<string, unknown> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => set(e.target.value)} className={authInput} required {...props} />
    </div>
  )

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-sm space-y-8 py-12">
      <div>
        <h1 className="font-serif text-5xl leading-[1] font-medium tracking-[-0.02em] text-balance sm:text-6xl">{t('firstRun.title')}</h1>
        <p className="mt-4 font-serif text-xl italic text-muted-foreground">{t('firstRun.subtitle')}</p>
      </div>
      <div className="space-y-4">
        {field('fr-user', t('username'), name, (v) => setName(v.trim()), { autoComplete: 'username', autoCapitalize: 'none', autoFocus: true, 'aria-invalid': !!name && !nameOk })}
        {field('fr-name', t('firstRun.fullName'), fullName, setFullName, { autoComplete: 'name' })}
        {field('fr-email', t('firstRun.email'), email, setEmail, { type: 'email', autoComplete: 'email' })}
        {field('fr-pw', t('password'), password, setPassword, { type: 'password', autoComplete: 'new-password', minLength: 8 })}
        {field('fr-pw2', t('firstRun.confirm'), confirm, setConfirm, { type: 'password', autoComplete: 'new-password', 'aria-invalid': !!confirm && confirm !== password })}
        <p className="text-xs text-muted-foreground">{t('firstRun.hint')}</p>
      </div>
      {error && (
        <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className={authSubmit} disabled={!valid || busy}>
        {busy && <Loader2 className="animate-spin" />}
        {t('firstRun.submit')}
      </Button>
    </form>
  )
}
