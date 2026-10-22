import { api } from '../index'

// DNA pages (src/features/dna): people with DNA matches / Y-DNA data, a person's matches and
// haplogroup, and the live preview of pasted segment data. Matches and haplogroups are tagged
// with the person (and notes / relations) so saving a match refreshes them.

type Raw = Record<string, unknown> & { handle: string }

export const DNA_RULES = JSON.stringify({ rules: [{ name: 'HasAssociationType', values: ['DNA'] }] })
export const YDNA_RULES = JSON.stringify({ rules: [{ name: 'HasAttribute', values: ['Y-DNA', '*'], regex: true }] })

const DNA_PERSON_KEYS = 'handle,gramps_id,profile,person_ref_list,media_list'
const YDNA_PERSON_KEYS = 'handle,gramps_id,profile,media_list'

export const dnaApi = api.injectEndpoints({
  overrideExisting: 'throw',
  endpoints: (build) => ({
    /** People with at least one "DNA" association (`kind: 'dna'`) or a "Y-DNA" attribute (`'ydna'`). */
    dnaPeople: build.query<Raw[], { kind: 'dna' | 'ydna'; locale: string }>({
      query: ({ kind, locale }) => ({
        url: '/api/people/',
        params: {
          rules: kind === 'dna' ? DNA_RULES : YDNA_RULES,
          keys: kind === 'dna' ? DNA_PERSON_KEYS : YDNA_PERSON_KEYS,
          profile: 'self',
          sort: 'name',
          locale,
        },
      }),
      providesTags: (res) => [{ type: 'People', id: 'LIST' }, ...(res ?? []).map((p) => ({ type: 'People' as const, id: p.handle }))],
    }),

    /** GET /people/{h}/dna/matches (with raw segment data). */
    dnaMatches: build.query<Raw[], { handle: string; locale: string }>({
      query: ({ handle, locale }) => ({ url: `/api/people/${handle}/dna/matches`, params: { locale, raw: 1 } }),
      providesTags: (_r, _e, { handle }) => [{ type: 'People', id: handle }, { type: 'Notes', id: 'LIST' }, 'Relations'],
    }),

    /** GET /people/{h}/ydna: haplogroup lineage computed by yclade. */
    ydna: build.query<Record<string, unknown>, { handle: string; locale: string }>({
      query: ({ handle, locale }) => ({ url: `/api/people/${handle}/ydna`, params: { locale, raw: 1 } }),
      providesTags: (_r, _e, { handle }) => [{ type: 'People', id: handle }],
    }),

    /** Server-side parse of pasted match data (POST /parsers/dna-match), as a cached query for the live preview. */
    dnaParse: build.query<Array<Record<string, unknown>>, string>({
      query: (text) => ({ url: '/api/parsers/dna-match', method: 'POST', body: { string: text } }),
      keepUnusedDataFor: 120,
    }),
  }),
})

export const { useDnaPeopleQuery, useDnaMatchesQuery, useYdnaQuery, useDnaParseQuery } = dnaApi
