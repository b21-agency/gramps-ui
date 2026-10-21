import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ListChecks, Newspaper, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth'
import { kindIcon } from '@/lib/objects'
import type { ObjectKind } from '@/lib/types'
import { useIsMobile } from '@/hooks/use-mobile'
import { ActionSheet } from './action-sheet'

const kinds: ObjectKind[] = ['person', 'family', 'event', 'place', 'source', 'citation', 'repository', 'note', 'media']

export function AddMenu() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  if (!can('AddObject')) return null
  const visible = kinds.filter((k) => k !== 'family' || can('EditObject'))
  const trigger = (
    <Button variant="ghost" size="icon" aria-label={t('actions.add')} onClick={isMobile ? () => setOpen(true) : undefined}>
      <Plus />
    </Button>
  )

  if (isMobile)
    return (
      <>
        {trigger}
        <ActionSheet
          open={open}
          onOpenChange={setOpen}
          title={t('actions.add')}
          groups={[
            visible.map((k) => {
              const Icon = kindIcon[k]
              return { key: k, icon: <Icon />, label: t(`object.${k}`), onSelect: () => navigate(`/new_${k}`) }
            }),
            [
              { key: 'blog', icon: <Newspaper />, label: t('nav.blog'), onSelect: () => navigate('/new_blog_post') },
              { key: 'task', icon: <ListChecks />, label: t('nav.tasks'), onSelect: () => navigate('/new_task') },
            ],
          ]}
        />
      </>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {visible.map((k) => {
          const Icon = kindIcon[k]
          return (
            <DropdownMenuItem key={k} onSelect={() => navigate(`/new_${k}`)}>
              <Icon />
              {t(`object.${k}`)}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/new_blog_post')}>
          <Newspaper />
          {t('nav.blog')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/new_task')}>
          <ListChecks />
          {t('nav.tasks')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
