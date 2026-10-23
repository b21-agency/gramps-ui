// Per-tree UI configuration shared by all users of a tree (GET/PUT /api/trees/-/config).
// The classic Gramps Web UI stores flat dotted keys ("frontend.appTitle", ...) in this
// free-form blob; we read and write the same keys so both UIs stay in sync.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { skipToken } from '@reduxjs/toolkit/query'
import { useGetTreeConfigQuery, type TreeConfig } from '@/api/enhanced/trees-slice-enhanced'
import { useAuth } from './auth'

export const TREE_CONFIG = {
  appTitle: 'frontend.appTitle',
  primaryColor: 'frontend.primaryColor',
  secondaryColor: 'frontend.secondaryColor',
  homePageNote: 'frontend.homePageNote',
  homePageImage: 'frontend.homePageImage',
} as const

export type { TreeConfig }

/** The tree's UI config (cached under the `Trees` tag; saving invalidates it). */
export function useTreeConfig() {
  const { authenticated } = useAuth()
  const r = useGetTreeConfigQuery(authenticated ? { treeId: '-' } : skipToken)
  return r
}

/** Reads a string value; also accepts a nested {frontend: {...}} shape. */
export function configString(config: TreeConfig | undefined, key: string): string {
  if (!config) return ''
  const flat = config[key]
  if (typeof flat === 'string') return flat
  const [ns, k] = key.split('.')
  const nested = (config[ns] as Record<string, unknown> | undefined)?.[k]
  return typeof nested === 'string' ? nested : ''
}

// Saving: dispatch(patchTreeConfig(patch)) / usePutTreeConfigMutation from '@/api/enhanced/trees-slice-enhanced'.

/** App title: the tree's custom title, else our default app name. */
export function useAppTitle() {
  const { t } = useTranslation()
  const { data } = useTreeConfig()
  return configString(data, TREE_CONFIG.appTitle).trim() || t('appName')
}

function isHex(c: string) {
  return /^#[0-9a-f]{6}$/i.test(c)
}

function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.4 ? '#141a16' : '#f7f8f5'
}

/**
 * Applies the tree's custom colours (if any) on top of our palette: the primary colour
 * replaces moss (main actions, links), the accent colour replaces brass (highlights).
 * In dark mode both are lightened so they stay readable on the dark background.
 */
export function TreeBranding() {
  const { data } = useTreeConfig()
  const primary = configString(data, TREE_CONFIG.primaryColor).trim()
  const accent = configString(data, TREE_CONFIG.secondaryColor).trim()
  const css = [
    isHex(primary) &&
      `:root{--primary:${primary};--ring:${primary};--sidebar-primary:${primary};--primary-foreground:${readableOn(primary)};--sidebar-primary-foreground:${readableOn(primary)}}` +
        `.dark{--primary:color-mix(in oklab,${primary} 55%,white);--ring:color-mix(in oklab,${primary} 55%,white);--sidebar-primary:color-mix(in oklab,${primary} 55%,white);--primary-foreground:#0d1410;--sidebar-primary-foreground:#0d1410}`,
    isHex(accent) &&
      `:root{--brass:${accent};--brass-foreground:${readableOn(accent)}}.dark{--brass:color-mix(in oklab,${accent} 60%,white);--brass-foreground:#15120a}`,
  ]
    .filter(Boolean)
    .join('')
  useEffect(() => {
    const id = 'gw-tree-branding'
    let el = document.getElementById(id) as HTMLStyleElement | null
    if (!css) {
      el?.remove()
      return
    }
    if (!el) {
      el = document.createElement('style')
      el.id = id
      document.head.appendChild(el)
    }
    el.textContent = css
  }, [css])
  return null
}
