import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/logo'
import { ApiError, login } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { ResetPasswordDialog } from './reset-password-dialog'
import { FirstRunForm, useOwnerSetupToken } from './first-run'

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { authenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ownerToken = useOwnerSetupToken()

  if (authenticated) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      const type = err instanceof ApiError ? err.message : 'failed'
      // e.g. 503 "This tree is temporarily disabled": show what the server says
      const serverMsg = err instanceof ApiError ? (err.body as { error?: { message?: string } } | undefined)?.error?.message : undefined
      setError(
        ['account_unconfirmed', 'account_disabled', 'rate_limited', 'invalid_credentials'].includes(type)
          ? t(`errors.${type}`)
          : err instanceof TypeError
            ? t('common:error.network')
            : serverMsg || t('errors.failed'),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2.5">
          <Logo className="size-8" />
          <span className="font-serif text-lg">{t('common:appName')}</span>
        </div>
        <div className="flex flex-1 items-center">
          {ownerToken ? (
            <FirstRunForm token={ownerToken} />
          ) : (
            <form onSubmit={submit} className="mx-auto w-full max-w-sm space-y-6 py-12">
              <div>
                <h1 className="text-4xl font-medium tracking-tight">{t('title')}</h1>
                <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">{t('username')}</Label>
                  <Input
                    id="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="password">{t('password')}</Label>
                    <ResetPasswordDialog defaultUser={username} />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                {t('submit')}
              </Button>
            </form>
          )}
        </div>
      </div>
      <LoginArt />
    </div>
  )
}

/** A quiet pedigree drawing: generations fanning out from one person. */
function LoginArt() {
  const gens = 5
  const lines: React.ReactNode[] = []
  const dots: React.ReactNode[] = []
  const W = 600
  const H = 720
  for (let g = 0; g < gens; g++) {
    const n = 2 ** g
    const y = H - 90 - g * 140
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W
      dots.push(<circle key={`d${g}-${i}`} cx={x} cy={y} r={Math.max(3, 11 - g * 2)} />)
      if (g + 1 < gens) {
        const ny = y - 140
        for (const j of [2 * i, 2 * i + 1]) {
          const nx = ((j + 0.5) / (n * 2)) * W
          lines.push(<path key={`l${g}-${j}`} d={`M${x} ${y} C ${x} ${y - 80}, ${nx} ${ny + 80}, ${nx} ${ny}`} />)
        }
      }
    }
  }
  return (
    <div className="relative hidden overflow-hidden bg-[#2f5440] lg:block dark:bg-[#17291f]">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g fill="none" stroke="#e8efe9" strokeOpacity="0.28" strokeWidth="1.5">
          {lines}
        </g>
        <g fill="#e8efe9" fillOpacity="0.55">{dots}</g>
      </svg>
    </div>
  )
}
