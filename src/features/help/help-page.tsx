import { useTranslation } from 'react-i18next'
import { BookOpen, ExternalLink, Keyboard, MessagesSquare, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Page } from '@/components/app-shell'
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
    <Page title={t('title')} description={t('description')}>
      <div className="grid max-w-3xl gap-3">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
          >
            <l.icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                {l.title}
                <ExternalLink className="size-3.5 text-muted-foreground" />
              </span>
              <span className="block text-sm text-muted-foreground">{l.text}</span>
            </span>
          </a>
        ))}
        <div className="flex items-start gap-4 rounded-xl border bg-card p-4 max-md:hidden">
          <Keyboard className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t('shortcuts.title')}</p>
            <p className="text-sm text-muted-foreground">{t('shortcutsText')}</p>
          </div>
          <Button variant="outline" onClick={() => setShortcutsOpen(true)}>
            {t('shortcuts.open')}
          </Button>
        </div>
      </div>
    </Page>
  )
}
