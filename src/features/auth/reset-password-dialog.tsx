import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function ResetPasswordDialog({ defaultUser }: { defaultUser: string }) {
  const { t } = useTranslation('auth')
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState(defaultUser)
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState('busy')
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.trim())}/password/reset/trigger/`, { method: 'POST' })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setUser(defaultUser)
          setState('idle')
        }
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          {t('forgot')}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('reset.title')}</DialogTitle>
            <DialogDescription>{t('reset.description')}</DialogDescription>
          </DialogHeader>
          {state === 'sent' ? (
            <p className="text-sm">{t('reset.sent')}</p>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="reset-user">{t('username')}</Label>
              <Input id="reset-user" required value={user} onChange={(e) => setUser(e.target.value)} />
              {state === 'error' && <p className="text-sm text-destructive">{t('reset.error')}</p>}
            </div>
          )}
          <DialogFooter>
            {state === 'sent' ? (
              <Button type="button" onClick={() => setOpen(false)}>
                {t('common:actions.close')}
              </Button>
            ) : (
              <Button type="submit" disabled={state === 'busy'}>
                {t('reset.submit')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
