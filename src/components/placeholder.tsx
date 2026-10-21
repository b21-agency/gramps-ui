import { Page } from './app-shell'

/** Temporary stand-in while a feature is being built. */
export function Placeholder({ name }: { name: string }) {
  return (
    <Page title={name}>
      <p className="text-muted-foreground">Coming soon.</p>
    </Page>
  )
}
