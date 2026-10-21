import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
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
import { Newspaper, ListChecks } from 'lucide-react'

const kinds: ObjectKind[] = ['person', 'family', 'event', 'place', 'source', 'citation', 'repository', 'note', 'media']

export function AddMenu() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const navigate = useNavigate()
  if (!can('AddObject')) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('actions.add')}>
          <Plus />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {kinds.map((k) => {
          const Icon = kindIcon[k]
          if (k === 'family' && !can('EditObject')) return null
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
