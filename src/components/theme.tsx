import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'
/** "default" = the tree's own colour (Administration → Customization) or gold. */
export type Accent = 'default' | 'neutral' | 'gold' | 'moss' | 'blue' | 'rose'
export const ACCENTS: Array<{ id: Accent; swatch: string }> = [
  { id: 'default', swatch: 'var(--primary)' },
  { id: 'neutral', swatch: '#71717a' },
  { id: 'gold', swatch: '#d2ad62' },
  { id: 'moss', swatch: '#5f8a6c' },
  { id: 'blue', swatch: '#4f7aa8' },
  { id: 'rose', swatch: '#c06a80' },
]

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  accent: Accent
  setAccent: (a: Accent) => void
}>({
  theme: 'dark',
  setTheme: () => {},
  accent: 'default',
  setAccent: () => {},
})

function read<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => read('gw.theme', 'dark'))
  const [accent, setAccentState] = useState<Accent>(() => read('gw.accent', 'default'))

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131416' : '#f7f7f5')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    if (accent === 'default') root.removeAttribute('data-accent')
    else root.setAttribute('data-accent', accent)
  }, [accent])

  const setTheme = (t: Theme) => {
    write('gw.theme', t)
    setThemeState(t)
  }
  const setAccent = (a: Accent) => {
    write('gw.accent', a)
    setAccentState(a)
  }
  return <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
