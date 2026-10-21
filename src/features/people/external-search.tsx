import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Earth, Eye, EyeOff, Lock, Plus, Search, Settings2, ShieldUser, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveMenu } from '@/components/responsive-menu'
import { usePref } from '@/lib/prefs'
import type { EventProfile, PersonProfile } from '@/lib/types'

/** Values a search URL template can use as {{key}}. */
interface SearchData {
  name_given: string
  name_surname: string
  name_middle: string
  place_name: string
  birth_year: string
  death_year: string
}

type Access = 'free' | 'registration' | 'subscription'

// same engines and URL templates as the classic Gramps Web "External Search"
const ENGINES: Array<{ key: string; name: string; url: string; access: Access }> = [
  { key: 'compgen', name: 'CompGen', access: 'free', url: 'https://meta.genealogy.net/search?lastname={{name_surname}}&placename={{place_name}}' },
  {
    key: 'familySearch',
    name: 'FamilySearch',
    access: 'registration',
    url: 'https://familysearch.org/search/record/results?q.birthLikeDate.from={{birth_year}}&q.birthLikeDate.to={{birth_year}}&q.deathLikeDate.from={{death_year}}&q.deathLikeDate.to={{death_year}}&q.givenName={{name_given}}&q.surname={{name_surname}}',
  },
  {
    key: 'ancestry',
    name: 'Ancestry',
    access: 'subscription',
    url: 'https://www.ancestry.com/search?name={{name_given}}_{{name_surname}}&birth={{birth_year}}_{{place_name}}&death={{death_year}}&searchMode=advanced',
  },
  {
    key: 'myheritage',
    name: 'MyHeritage',
    access: 'subscription',
    url: 'https://www.myheritage.com/research?formId=master&formMode=1&action=query&qname=Name+fn.{{name_given}}+ln.{{name_surname}}&qevents-event1=Event+et.birth+ey.{{birth_year}}+ep.{{place_name}}&qevents-any/1event_2=Event+et.death+ey.{{death_year}}&qevents=List',
  },
  { key: 'geneanet', name: 'Geneanet', access: 'subscription', url: 'https://en.geneanet.org/fonds/individus/?size=10&nom={{name_surname}}&prenom={{name_given}}' },
  {
    key: 'wikitree',
    name: 'WikiTree',
    access: 'free',
    url: 'https://plus.wikitree.com/function/WTWebProfileSearch/Profiles.htm?Query={{name_given}}+{{name_surname}}&MaxProfiles=500&SortOrder=Default&PageSize=10',
  },
  {
    key: 'findagrave',
    name: 'Find A Grave',
    access: 'free',
    url: 'https://www.findagrave.com/memorial/search?firstname={{name_given}}&middlename={{name_middle}}&lastname={{name_surname}}&birthyear={{birth_year}}&birthyearfilter=&deathyear={{death_year}}&deathyearfilter=',
  },
  { key: 'google', name: 'Google', access: 'free', url: 'https://www.google.com/search?q=%22{{name_given}}+{{name_surname}}%22+{{birth_year}}+{{death_year}}' },
]

const PLACEHOLDERS = ['name_given', 'name_surname', 'name_middle', 'place_name', 'birth_year', 'death_year'].map((k) => `{{${k}}}`).join(', ')

interface Prefs {
  hidden: Record<string, boolean>
  custom: Array<{ key: string; name: string; url: string }>
}

const accessIcon = { free: Earth, registration: ShieldUser, subscription: Lock }

function fill(template: string, data: SearchData) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => encodeURIComponent(data[k as keyof SearchData] ?? ''))
}

function searchData(profile: PersonProfile): SearchData {
  const year = (d?: string) => d?.match(/^\d{4}/)?.[0] ?? ''
  const birth = profile.birth as EventProfile | undefined
  const death = profile.death as EventProfile | undefined
  return {
    name_given: profile.name_given ?? '',
    name_surname: profile.name_surname ?? '',
    name_middle: profile.name_given?.split(' ')[1] ?? '',
    place_name: birth?.place_name || birth?.place || death?.place_name || death?.place || '',
    birth_year: year(birth?.date),
    death_year: year(death?.date),
  }
}

/** "Search elsewhere": genealogy sites prefilled with name, years and place; sites can be hidden and custom ones added. */
export function ExternalSearch({ profile }: { profile: PersonProfile }) {
  const { t } = useTranslation('person')
  const [prefs, setPrefs] = usePref<Prefs>('externalSearch', { hidden: {}, custom: [] })
  const [manage, setManage] = useState(false)
  const data = searchData(profile)
  const all = [...ENGINES, ...prefs.custom.map((c) => ({ ...c, access: undefined as Access | undefined }))]
  const open = (url: string) => window.open(fill(url, data), '_blank', 'noopener,noreferrer')
  const visible = all.filter((e) => !prefs.hidden[e.key])
  return (
    <>
      <ResponsiveMenu
        title={t('externalSearch.title')}
        label={t('externalSearch.label')}
        className="w-60"
        trigger={
          <Button size="sm" variant="ghost">
            <Search />
            {t('actions.externalSearch')}
          </Button>
        }
        groups={[
          visible.map((e) => {
            const Icon = e.access ? accessIcon[e.access] : Search
            return {
              key: e.key,
              icon: <Icon />,
              label: e.name,
              hint: e.access && e.access !== 'free' ? t(`externalSearch.access.${e.access}`) : undefined,
              onSelect: () => open(e.url),
            }
          }),
          [{ key: 'manage', icon: <Settings2 />, label: t('externalSearch.manage'), onSelect: () => setManage(true) }],
        ]}
      />
      <Dialog open={manage} onOpenChange={setManage}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('externalSearch.manage')}</DialogTitle>
            <DialogDescription>{t('externalSearch.manageHint')}</DialogDescription>
          </DialogHeader>
          <ul className="-mx-2 max-h-[50dvh] divide-y overflow-y-auto">
            {all.map((e) => {
              const hidden = !!prefs.hidden[e.key]
              const custom = !e.access
              const Icon = e.access ? accessIcon[e.access] : Search
              return (
                <li key={e.key} className="flex items-center gap-3 px-2 py-1.5">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className={hidden ? 'flex-1 text-muted-foreground line-through' : 'flex-1'}>{e.name}</span>
                  {custom ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('externalSearch.remove', { name: e.name })}
                      onClick={() => setPrefs((p) => ({ ...p, custom: p.custom.filter((c) => c.key !== e.key) }))}
                    >
                      <Trash2 />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-pressed={!hidden}
                      aria-label={hidden ? t('externalSearch.show', { name: e.name }) : t('externalSearch.hide', { name: e.name })}
                      onClick={() => setPrefs((p) => ({ ...p, hidden: { ...p.hidden, [e.key]: !hidden } }))}
                    >
                      {hidden ? <EyeOff /> : <Eye />}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          <AddEngine onAdd={(name, url) => setPrefs((p) => ({ ...p, custom: [...p.custom, { key: `custom_${Date.now().toString(36)}`, name, url }] }))} />
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(['free', 'registration', 'subscription'] as const).map((a) => {
              const Icon = accessIcon[a]
              return (
                <span key={a} className="inline-flex items-center gap-1">
                  <Icon className="size-3.5" /> {t(`externalSearch.access.${a}`)}
                </span>
              )
            })}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

function AddEngine({ onAdd }: { onAdd: (name: string, url: string) => void }) {
  const { t } = useTranslation('person')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const valid = name.trim() && /^https?:\/\//i.test(url.trim())
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onAdd(name.trim(), url.trim())
        setName('')
        setUrl('')
      }}
    >
      <span className="text-sm font-medium">{t('externalSearch.addTitle')}</span>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('externalSearch.namePlaceholder')} aria-label={t('externalSearch.namePlaceholder')} />
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/search?q={{name_given}}+{{name_surname}}" aria-label="URL" />
      <p className="text-xs text-muted-foreground">{t('externalSearch.placeholders', { list: PLACEHOLDERS })}</p>
      <Button type="submit" size="sm" variant="outline" className="self-end" disabled={!valid}>
        <Plus /> {t('externalSearch.add')}
      </Button>
    </form>
  )
}
