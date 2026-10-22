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
import { authInput, authSubmit } from './styles'

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
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center gap-3">
          <Logo className="size-9" />
          <span className="font-serif text-xl">{t('common:appName')}</span>
        </div>
        <div className="flex flex-1 items-center">
          {ownerToken ? (
            <FirstRunForm token={ownerToken} />
          ) : (
            <form onSubmit={submit} className="mx-auto w-full max-w-sm space-y-8 py-12">
              <div>
                <h1 className="font-serif text-5xl leading-[1] font-medium tracking-[-0.02em] text-balance sm:text-6xl">{t('title')}</h1>
                <p className="mt-4 font-serif text-xl italic text-muted-foreground">{t('subtitle')}</p>
              </div>
              <div className="space-y-5">
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
                    className={authInput}
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
                    className={authInput}
                  />
                </div>
              </div>
              {error && (
                <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className={authSubmit} disabled={busy}>
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

/** The pedigree drawn in gold on ink: generations fanning out from one person, framed like an album page. */
function LoginArt() {
  const { t } = useTranslation('auth')
  const gens = 5
  const lines: React.ReactNode[] = []
  const frames: React.ReactNode[] = []
  const W = 600
  const H = 720
  for (let g = 0; g < gens; g++) {
    const n = 2 ** g
    const y = H - 130 - g * 128
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * W
      const r = [26, 17, 11, 7, 4][g]
      frames.push(
        <g key={`d${g}-${i}`}>
          <circle cx={x} cy={y} r={r} className="fill-card stroke-brass" strokeWidth={g === 0 ? 2.5 : 1.5} strokeOpacity={g === 0 ? 1 : 0.85 - g * 0.12} />
          {g < 3 && <circle cx={x} cy={y} r={r * 0.42} className="fill-brass" fillOpacity={g === 0 ? 0.9 : 0.45} />}
        </g>,
      )
      if (g + 1 < gens) {
        const ny = y - 128
        for (const j of [2 * i, 2 * i + 1]) {
          const nx = ((j + 0.5) / (n * 2)) * W
          lines.push(<path key={`l${g}-${j}`} d={`M${x} ${y} C ${x} ${y - 72}, ${nx} ${ny + 72}, ${nx} ${ny}`} strokeOpacity={0.75 - g * 0.13} />)
        }
      }
    }
  }
  return (
    <div className="relative m-3 hidden overflow-hidden rounded-3xl bg-secondary lg:block dark:bg-card">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-x-0 top-0 h-[78%] w-full" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs>
          <radialGradient id="login-glow">
            <stop offset="0%" stopColor="var(--brass)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brass)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={W / 2} cy={H - 130} r={110} fill="url(#login-glow)" />
        <g fill="none" className="stroke-brass" strokeWidth="1.5" strokeLinecap="round">
          {lines}
        </g>
        {frames}
      </svg>
      <figure className="absolute inset-x-0 bottom-0 px-12 pb-12 xl:px-16 xl:pb-16">
        <blockquote className="max-w-lg font-serif text-3xl leading-[1.15] italic text-balance text-foreground/90 xl:text-4xl">
          {t('art.quote')}
        </blockquote>
        <figcaption className="mt-4 font-serif text-lg text-brass">{t('art.caption')}</figcaption>
      </figure>
    </div>
  )
}
