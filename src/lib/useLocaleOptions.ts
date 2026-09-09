/**
 * useLocaleOptions — the closed locale vocabularies the company-settings form
 * offers (I18N-1 lane I3, BE 5a109b00): GET /settings/locale-options returns
 * { currencies, timezones, languages } as [{ code, label }] lists. The SETTING
 * stores the CODE (ISO-4217 / IANA / messaging-language code, 422 outside the
 * list); the label is what the picker shows. Cached for the session: the lists
 * only change with a backend release.
 */
import { useQuery } from '@tanstack/react-query'
import api, { unwrap } from '@/lib/api'

// Hand-written: the OpenAPI export documents the operation but no 2xx schema.
interface LocaleOption { code: string; label: string }
interface LocaleOptions { currencies: LocaleOption[]; timezones: LocaleOption[]; languages: LocaleOption[] }

const EMPTY: LocaleOptions = { currencies: [], timezones: [], languages: [] }

// Fetch once per session; a failed request leaves the pickers on the stored code.
export function useLocaleOptions() {
  const q = useQuery({
    queryKey: ['settings', 'locale-options'],
    queryFn: async ({ signal }) => {
      const body = unwrap<Partial<LocaleOptions>>(await api.get('/settings/locale-options', { signal }))
      return { currencies: body?.currencies ?? [], timezones: body?.timezones ?? [], languages: body?.languages ?? [] }
    },
    staleTime: Infinity,
  })
  return { options: q.data ?? EMPTY, loading: q.isLoading, error: !!q.error }
}
