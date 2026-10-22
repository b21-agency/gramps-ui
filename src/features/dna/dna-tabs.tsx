import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useHomePerson } from '@/lib/prefs'

/** Switch between autosomal matches and Y-DNA, keeping the selected person. */
export function DnaTabs({ id }: { id?: string }) {
  const { t } = useTranslation('dna')
  const { pathname } = useLocation()
  const tabs = [
    { to: '/dna-matches', key: 'matches', active: !pathname.startsWith('/ydna') },
    { to: '/ydna', key: 'ydna', active: pathname.startsWith('/ydna') },
  ]
  return (
    <nav aria-label={t('tabs.label')} className="mb-6 flex gap-1.5">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={id ? `${tab.to}/${id}` : tab.to}
          aria-current={tab.active ? 'page' : undefined}
          className={cn(
            'flex h-11 items-center rounded-full px-5 text-sm transition-colors duration-150 active:scale-[0.97] sm:h-10',
            tab.active ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {t(`tabs.${tab.key}`)}
        </Link>
      ))}
    </nav>
  )
}

/**
 * Without a person in the URL, wide screens jump to the home person (if tested) or the first
 * person, like Gramps Web; phones keep the list as the first screen.
 */
export function useDefaultPerson(base: string, id: string | undefined, people: Array<{ gramps_id: string }> | undefined) {
  const navigate = useNavigate()
  const [home] = useHomePerson()
  useEffect(() => {
    if (id || !people?.length) return
    if (!window.matchMedia('(min-width: 1024px)').matches) return
    const target = people.find((p) => p.gramps_id === home)?.gramps_id ?? people[0].gramps_id
    navigate(`${base}/${target}`, { replace: true })
  }, [id, people, home, base, navigate])
}
