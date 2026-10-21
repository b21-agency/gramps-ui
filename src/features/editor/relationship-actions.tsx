import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, UserRoundPlus, UserRoundSearch, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ObjectSearchList } from '@/components/object-picker'
import { useAuth } from '@/lib/auth'
import { personName, profileName } from '@/lib/format'
import type { FamilyProfile, Person } from '@/lib/types'
import { qs } from '@/lib/api'
import { endpointsOfTx, errorMessage, invalidateAfterWrite, type Transaction } from './lib'
import { addChild, addParent, addPartner, addSibling } from './relations'

type Rel = 'father' | 'mother' | 'partner' | 'child' | 'sibling'

interface LinkTarget {
  rel: Rel
  familyHandle?: string
  label: string
}

/**
 * "Add relative" menu for a person page: add father / mother / partner / child / sibling,
 * either as a new person (opens /new_person with the relation) or by linking an existing one.
 */
export function AddRelativeMenu({ person, className }: { person: Person; className?: string }) {
  const { t } = useTranslation('editor')
  const { can } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [target, setTarget] = useState<LinkTarget | null>(null)
  const [busy, setBusy] = useState(false)
  if (!can('AddObject') || !can('EditObject')) return null

  const name = (person.profile && profileName(person.profile)) || personName(person) || person.gramps_id
  const families: FamilyProfile[] = person.profile?.families ?? []
  const famHandles = person.family_list ?? []
  const partnerOf = (fh: string) => {
    const f = families.find((x) => x.handle === fh)
    if (!f) return ''
    const other = f.father?.handle === person.handle ? f.mother : f.father
    return profileName(other as never) || ''
  }

  const newPerson = (param: string, value: string, gender?: number) =>
    navigate(`/new_person${qs({ [param]: value, gender })}`)

  const link = async (rel: Rel, other: string, familyHandle?: string) => {
    setBusy(true)
    try {
      let tx: Transaction = []
      if (rel === 'father' || rel === 'mother') tx = await addParent(person.handle, other)
      if (rel === 'partner') tx = await addPartner(person.handle, other)
      if (rel === 'child') tx = await addChild(person.handle, other, familyHandle)
      if (rel === 'sibling') tx = await addSibling(person.handle, other)
      invalidateAfterWrite(qc, ['person', 'family', ...endpointsOfTx(tx)])
      toast.success(t(`relatives.linked.${rel}`))
      setTarget(null)
    } catch (e) {
      const msg = errorMessage(e)
      toast.error(t('relatives.linkFailed'), { description: msg === 'self' ? t('relatives.self') : msg })
    } finally {
      setBusy(false)
    }
  }

  const both = ({ rel, onNew, familyHandle, label }: { rel: Rel; onNew: () => void; familyHandle?: string; label: string }) => (
    <>
      <DropdownMenuItem onSelect={onNew}>
        <UserRoundPlus /> {t('relatives.newPerson')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => setTarget({ rel, familyHandle, label })}>
        <UserRoundSearch /> {t('relatives.existingPerson')}
      </DropdownMenuItem>
    </>
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <UserPlus />
            {t('relatives.add')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {(['father', 'mother'] as const).map((rel) => (
            <DropdownMenuSub key={rel}>
              <DropdownMenuSubTrigger>{t(`relatives.${rel}`)}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {both({ rel: rel, label: t(`relatives.${rel}`), onNew: () => newPerson('parentOf', person.handle, rel === 'father' ? 1 : 0) })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t('relatives.partner')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {both({ rel: 'partner', label: t('relatives.partner'), onNew: () => newPerson('partnerOf', person.handle, person.gender === 1 ? 0 : person.gender === 0 ? 1 : undefined) })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t('relatives.child')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {famHandles.length === 0 ? (
                both({ rel: 'child', label: t('relatives.child'), onNew: () => newPerson('childOfPerson', person.handle) })
              ) : (
                <>
                  {famHandles.map((fh, i) => {
                    const p = partnerOf(fh)
                    const label = p ? t('relatives.withPartner', { name: p }) : t('relatives.withUnknown')
                    return (
                      <div key={fh}>
                        {i > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{label}</DropdownMenuLabel>
                        {both({ rel: 'child', familyHandle: fh, label: `${t('relatives.child')} · ${label}`, onNew: () => newPerson('childOf', fh) })}
                      </div>
                    )
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('relatives.withNobody')}</DropdownMenuLabel>
                  {both({ rel: 'child', label: t('relatives.child'), onNew: () => newPerson('childOfPerson', person.handle) })}
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>{t('relatives.sibling')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {both({ rel: 'sibling', label: t('relatives.sibling'), onNew: () => newPerson('siblingOf', person.handle) })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!target} onOpenChange={(o) => !o && !busy && setTarget(null)}>
        <DialogContent className="gap-3 p-0 sm:max-w-md">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>{target && t(`relatives.chooseTitle.${target.rel}`, { name })}</DialogTitle>
            <DialogDescription>{target?.label}</DialogDescription>
          </DialogHeader>
          <div className="relative border-t">
            <ObjectSearchList
              kinds={['person']}
              autoFocus
              placeholder={t('family.searchPerson')}
              onPick={(o) => target && !busy && void link(target.rel, o.handle, target.familyHandle)}
            />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                <Loader2 className="size-5 animate-spin" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
