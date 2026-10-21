import type { ObjectKind } from '@/lib/types'

/**
 * Edit entry point placed on every object page header.
 * Implemented by the editor feature; renders nothing for users without EditObject.
 */
export function EditButton(_props: { kind: ObjectKind; object: unknown; onSaved?: () => void }) {
  return null
}
