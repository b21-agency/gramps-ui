import { skipToken } from '@reduxjs/toolkit/query'
import { usePersonPortraitQuery } from '@/api/enhanced/lists'

// Rows that only know a person's handle (family partners, event participants) need that
// person's first media reference for a portrait. The `personPortrait` endpoint merges the
// requests made in the same tick into one `/people/?handles=...` call, so a screen of rows
// costs one request; each portrait is cached (and refreshed) per person.

/** First media reference of a person by handle (batched). */
export function usePersonPortrait(handle: string | undefined | null) {
  const { data } = usePersonPortraitQuery(handle ? handle : skipToken)
  return data ?? null
}
