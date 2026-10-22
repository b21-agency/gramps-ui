import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronRight, Loader2, UserRoundPlus, UserRoundSearch, UserPlus } from 'lucide-react'
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
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { ObjectSearchList } from '@/components/object-picker'
import { ActionSheet } from '@/components/action-sheet'
import { drawerCommand } from '@/components/adaptive-popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { personName, profileName } from '@/lib/format'
import type { FamilyProfile, Person } from '@/lib/types'
import { qs } from '@/lib/api'
import { errorMessage } from './lib'
import { addChild, addChildToFamily, addParent, addPartner, addSibling } from './relations'

type Rel = 'father' | 'mother' | 'partner' | 'child' | 'sibling' | 'familyChild'

interface LinkTarget {
  rel: Rel
  familyHandle?: string
  label: string
}

interface RelEntry extends LinkTarget {
  key: string
  onNew: () => void
}

/**
 * "Add relative" menu for a person page: add father / mother / partner / child / sibling,
 * either as a new person (opens /new_person with the relation) or by linking an existing one.
 */
export function AddRelativeMenu({ person, className }: { person: Person; className?: string }) {
  const { t } = useTranslation('editor')
  const { can } = useAuth()
  const navigate = useNavigate()
  const [target, setTarget] = useState<LinkTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [choice, setChoice] = useState<RelEntry | null>(null)
  // picker chosen in the dropdown: opened once the menu has closed, so the dialog gets the focus
  const pendingTarget = useRef<LinkTarget | null>(null)
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
      // the relation helpers write through RTK mutations, which refresh the touched objects
      if (rel === 'father' || rel === 'mother') await addParent(person.handle, other)
      if (rel === 'partner') await addPartner(person.handle, other)
      if (rel === 'child') await addChild(person.handle, other, familyHandle)
      if (rel === 'sibling') await addSibling(person.handle, other)
      if (rel === 'familyChild') await addChildToFamily(other, person.handle)
      toast.success(t(`relatives.linked.${rel}`))
      setTarget(null)
    } catch (e) {
      const msg = errorMessage(e)
      toast.error(t('relatives.linkFailed'), { description: msg === 'self' ? t(rel === 'familyChild' ? 'relatives.alreadyParent' : 'relatives.self') : msg })
    } finally {
      setBusy(false)
    }
  }

  const both = ({ rel, onNew, familyHandle, label }: { rel: Rel; onNew: () => void; familyHandle?: string; label: string }) => (
    <>
      <DropdownMenuItem onSelect={onNew}>
        <UserRoundPlus /> {t('relatives.newPerson')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => (pendingTarget.current = { rel, familyHandle, label })}>
        <UserRoundSearch /> {t('relatives.existingPerson')}
      </DropdownMenuItem>
    </>
  )

  const picker = (
    <div className="relative border-t">
      <ObjectSearchList
        kinds={target?.rel === 'familyChild' ? ['family'] : ['person']}
        autoFocus
        placeholder={target?.rel === 'familyChild' ? t('participants.searchHint') : t('family.searchPerson')}
        onPick={(o) => target && !busy && void link(target.rel, o.handle, target.familyHandle)}
      />
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
    </div>
  )

  if (isMobile) {
    // phones: relation first, then "new or existing" — no nested menus
    const childEntries: RelEntry[] = famHandles.length
      ? [
          ...famHandles.map((fh) => {
            const p = partnerOf(fh)
            const label = `${t('relatives.child')} · ${p ? t('relatives.withPartner', { name: p }) : t('relatives.withUnknown')}`
            return { key: `child-${fh}`, rel: 'child' as const, familyHandle: fh, label, onNew: () => newPerson('childOf', fh) }
          }),
          { key: 'child-none', rel: 'child', label: `${t('relatives.child')} · ${t('relatives.withNobody')}`, onNew: () => newPerson('childOfPerson', person.handle) },
        ]
      : [{ key: 'child', rel: 'child', label: t('relatives.child'), onNew: () => newPerson('childOfPerson', person.handle) }]
    const entries: RelEntry[][] = [
      [
        { key: 'father', rel: 'father', label: t('relatives.father'), onNew: () => newPerson('parentOf', person.handle, 1) },
        { key: 'mother', rel: 'mother', label: t('relatives.mother'), onNew: () => newPerson('parentOf', person.handle, 0) },
      ],
      [{ key: 'familyChild', rel: 'familyChild', label: t('relatives.existingFamily'), onNew: () => setTarget({ rel: 'familyChild', label: t('relatives.existingFamily') }) }],
      [
        { key: 'partner', rel: 'partner', label: t('relatives.partner'), onNew: () => newPerson('partnerOf', person.handle, person.gender === 1 ? 0 : person.gender === 0 ? 1 : undefined) },
        ...childEntries,
        { key: 'sibling', rel: 'sibling', label: t('relatives.sibling'), onNew: () => newPerson('siblingOf', person.handle) },
      ],
    ]
    return (
      <>
        <Button variant="outline" size="sm" className={className} onClick={() => setSheetOpen(true)}>
          <UserPlus />
          {t('relatives.add')}
        </Button>
        <ActionSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={t('relatives.add')}
          groups={entries.map((g) => g.map((e) => ({ key: e.key, label: e.label, hint: <ChevronRight className="size-4" />, onSelect: () => (e.rel === 'familyChild' ? e.onNew() : setChoice(e)) })))}
        />
        <ActionSheet
          open={!!choice}
          onOpenChange={(o) => !o && setChoice(null)}
          title={choice?.label ?? ''}
          groups={
            choice
              ? [
                  [
                    { key: 'new', icon: <UserRoundPlus />, label: t('relatives.newPerson'), onSelect: choice.onNew },
                    {
                      key: 'existing',
                      icon: <UserRoundSearch />,
                      label: t('relatives.existingPerson'),
                      onSelect: () => setTarget({ rel: choice.rel, familyHandle: choice.familyHandle, label: choice.label }),
                    },
                  ],
                ]
              : []
          }
        />
        <Drawer open={!!target} onOpenChange={(o) => !o && !busy && setTarget(null)}>
          <DrawerContent className="h-[88dvh] max-h-[88dvh] pb-safe">
            <DrawerHeader className="pb-2 text-left">
              <DrawerTitle className="font-serif text-xl font-medium">{target && t(`relatives.chooseTitle.${target.rel}`, { name })}</DrawerTitle>
              <DrawerDescription>{target?.label}</DrawerDescription>
            </DrawerHeader>
            <div className={cn('flex min-h-0 flex-1 flex-col px-2 [&>div]:flex [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col [&>div]:border-t-0', drawerCommand)}>{picker}</div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <UserPlus />
            {t('relatives.add')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          onCloseAutoFocus={(e) => {
            if (!pendingTarget.current) return
            e.preventDefault()
            setTarget(pendingTarget.current)
            pendingTarget.current = null
          }}
        >
          {(['father', 'mother'] as const).map((rel) => (
            <DropdownMenuSub key={rel}>
              <DropdownMenuSubTrigger>{t(`relatives.${rel}`)}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {both({ rel: rel, label: t(`relatives.${rel}`), onNew: () => newPerson('parentOf', person.handle, rel === 'father' ? 1 : 0) })}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          <DropdownMenuItem onSelect={() => (pendingTarget.current = { rel: 'familyChild', label: t('relatives.existingFamily') })}>
            {t('relatives.existingFamily')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
          {picker}
        </DialogContent>
      </Dialog>
    </>
  )
}
