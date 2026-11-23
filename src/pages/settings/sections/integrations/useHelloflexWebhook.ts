/**
 * useHelloflexWebhook (HF-WEBHOOK-FE-1): status query + register/unregister mutations
 * for the HelloFlex inbound webhook. Only queries for the helloflex connector.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { notify } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import {
  getHelloflexWebhookStatus,
  registerHelloflexWebhook,
  unregisterHelloflexWebhook,
  type ConnectorId,
} from './integrationsApi'

const KEY = ['integrations', 'helloflex', 'webhook']

export function useHelloflexWebhook(connector: ConnectorId | undefined, onChanged?: () => void) {
  const { t } = useTranslation('settings')
  const qc = useQueryClient()
  const enabled = connector === 'helloflex'
  const query = useQuery({ queryKey: KEY, queryFn: getHelloflexWebhookStatus, enabled })

  // Refresh status and health after every attempt, so a timeout or a 409 still re-syncs.
  const settle = () => { qc.invalidateQueries({ queryKey: KEY }); onChanged?.() }
  const onError = (err: unknown) => notify('error', extractApiError(err, t('integrations.webhook.actionFailed')))
  // Register doubles as rotate: the flag only picks the toast wording.
  const registerMut = useMutation<Awaited<ReturnType<typeof registerHelloflexWebhook>>, unknown, { rotate: boolean }>({
    mutationFn: () => registerHelloflexWebhook(),
    onSuccess: (_d, vars) => notify('success', t(vars.rotate ? 'integrations.webhook.rotatedSuccess' : 'integrations.webhook.registeredSuccess')),
    onError,
    onSettled: settle,
  })
  const unregisterMut = useMutation({
    mutationFn: unregisterHelloflexWebhook,
    onSuccess: () => notify('success', t('integrations.webhook.unregisteredSuccess')),
    onError,
    onSettled: settle,
  })

  return {
    status: enabled ? (query.data ?? null) : null,
    isLoading: enabled && query.isLoading,
    register: (vars: { rotate: boolean }) => registerMut.mutate(vars),
    unregister: () => unregisterMut.mutate(),
    busy: registerMut.isPending || unregisterMut.isPending,
  }
}
