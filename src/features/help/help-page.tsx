import { useTranslation } from 'react-i18next'
import { BookOpen, ExternalLink, Keyboard, MessagesSquare, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setShortcutsOpen } from '@/components/keyboard-shortcuts'
import { useTitle } from '@/hooks/use-title'

// languages with a translated Gramps Web documentation
const docLangs = ['de', 'fr', 'es', 'zh', 'vi', 'tr', 'ru', 'pt', 'ja', 'da', 'fi', 'it', 'uk']

export function HelpPage() {
  const { t, i18n } = useTranslation('help')
  useTitle(t('title'))
  const lang = (i18n.resolvedLanguage ?? 'en').slice(0, 2)
  const prefix = docLangs.includes(lang) ? `${lang}/` : ''
  const links = [
    { icon: BookOpen, title: t('userDocs'), text: t('userDocsText'), href: `https://www.grampsweb.org/${prefix}user-guide` },
    { icon: ShieldCheck, title: t('adminDocs'), text: t('adminDocsText'), href: `https://www.grampsweb.org/${prefix}administration/admin` },
    { icon: MessagesSquare, title: t('forum'), text: t('forumText'), href: 'https://gramps.discourse.group/c/gramps-web' },
  ]
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 2xl:px-14">
      <header className="mb-8">
        <h1 className="font-serif text-[2.6rem] font-medium leading-[1] tracking-[-0.02em] sm:text-6xl">{t('title')}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t('description')}</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-3xl bg-card p-6 outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99]"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-brass/15 text-brass">
              <l.icon className="size-5" />
            </span>
            <span className="mt-5 flex items-center gap-2 font-serif text-2xl font-medium">
              {l.title}
              <ExternalLink className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            </span>
            <span className="mt-1.5 block text-muted-foreground">{l.text}</span>
          </a>
        ))}
        <div className="flex flex-col rounded-3xl bg-card p-6 max-md:hidden">
          <span className="flex size-12 items-center justify-center rounded-full bg-brass/15 text-brass">
            <Keyboard className="size-5" />
          </span>
          <p className="mt-5 font-serif text-2xl font-medium">{t('shortcuts.title')}</p>
          <p className="mt-1.5 text-muted-foreground">{t('shortcutsText')}</p>
          <div className="mt-5">
            <Button variant="secondary" className="h-10 rounded-full px-5" onClick={() => setShortcutsOpen(true)}>
              {t('shortcuts.open')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
