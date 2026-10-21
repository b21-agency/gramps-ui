import { keepPreviousData, useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { api, apiRaw, type Query } from './api'
import { apiLocale } from '@/i18n'
import { endpointOf, type Metadata, type ObjectKind, type Tag } from './types'

/** Fetch one object by its Gramps ID (I0044, F0012, ...). */
export function useObjectById<T>(kind: ObjectKind, grampsId: string | undefined, query: Query = {}) {
  const endpoint = endpointOf[kind]
  const params = { gramps_id: grampsId, locale: apiLocale(), ...query }
  return useQuery({
    queryKey: [endpoint, 'id', grampsId, params],
    enabled: !!grampsId,
    queryFn: async () => {
      const list = await api<T[]>(`/${endpoint}/`, { query: params })
      if (!list.length) throw new NotFoundError()
      return list[0]
    },
  })
}

export function useObjectByHandle<T>(
  kind: ObjectKind,
  handle: string | undefined | null,
  query: Query = {},
  opts: Partial<UseQueryOptions<T>> = {},
) {
  const endpoint = endpointOf[kind]
  const params = { locale: apiLocale(), ...query }
  return useQuery<T>({
    queryKey: [endpoint, 'handle', handle, params],
    enabled: !!handle,
    queryFn: () => api<T>(`/${endpoint}/${handle}`, { query: params }),
    ...opts,
  })
}

export interface Page<T> {
  items: T[]
  total: number
}

export function useObjectList<T>(kind: ObjectKind | 'tags', query: Query, enabled = true) {
  const endpoint = kind === 'tags' ? 'tags' : endpointOf[kind]
  const params = { locale: apiLocale(), ...query }
  return useQuery<Page<T>>({
    queryKey: [endpoint, 'list', params],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const r = await apiRaw<T[]>(`/${endpoint}/`, { query: params })
      return { items: r.data, total: r.total ?? r.data.length }
    },
  })
}

export function useMetadata() {
  return useQuery({
    queryKey: ['metadata'],
    queryFn: () => api<Metadata>('/metadata/'),
    staleTime: 5 * 60_000,
  })
}

export function useTags() {
  return useQuery({
    queryKey: ['tags', 'all'],
    queryFn: () => api<Tag[]>('/tags/'),
    staleTime: 5 * 60_000,
  })
}

export class NotFoundError extends Error {
  status = 404
  constructor() {
    super('not found')
  }
}
