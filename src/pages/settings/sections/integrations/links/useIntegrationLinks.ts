/**
 * useIntegrationLinks — react-query list of integration links, keyed by the full
 * param set; keeps the previous page on screen while the next one loads, and the
 * query's signal cancels a stale request (alive guard).
 */
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { listLinks } from './linksApi'
import type { ListLinksParams } from './linksApi'

// Loads one page of links for the given params.
export function useIntegrationLinks(params: ListLinksParams) {
  return useQuery({
    queryKey: ['integration-links', params],
    queryFn: ({ signal }) => listLinks(params, signal),
    placeholderData: keepPreviousData,
  })
}
