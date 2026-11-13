/**
 * IntegrationConnectionCard (INTEGRATIONS-SETTINGS-1, Settings → Integrations →
 * <connector> → Connection) — the per-connector connection settings + live
 * "test connection" card. One shared component drives all three connectors
 * (shiftmanager / helloflex / werkzoeken) from a per-connector FIELD SPEC below,
 * so a new connector is a spec entry, never a forked screen.
 *
 * Secret fields (api_key / client_secret) are WRITE-ONLY on the wire: the GET
 * shape only ever reports `has_*` (booleans), never the stored value, and the
 * PUT body omits the field entirely unless the user actually typed a new value
 * or explicitly cleared it (contract: koiosmatch-api/docs/contract/
 * INTEGRATIONS-CONTRACT.md, "PUT same route").
 *
 * Types below are hand-written (CLAUDE.md §10 type-gen rule): the integrations
 * routes are not yet in src/types/api-generated.ts (backend lands them
 * alongside this lane) — replace with generated types once the spec ships them.
 *
 * SM-CREDS-2 (CONTRACT-CHANGELOG.md): Shiftmanager's `company_api` credential
 * group (company + auth_token) only renders once the GET response carries
 * `has_auth_token` — FEATURE DETECTION, so the card looks exactly as it did
 * before until the backend half lands (protocol: nothing fake ever shows).
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import CalloutBox from '@/components/ui/CalloutBox'
import Spinner from '@/components/ui/Spinner'
import { PageTitle, Caption } from '@/components/ui/typography'
import { useSmLastSync } from '@/components/shiftmanager/useSmLastSync'
import { useDateFormat } from '@/lib/datetime'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import IntegrationTestResults, { type TestOutcome } from './IntegrationTestResults'
import { FIELD_SPEC } from './connectionFieldSpec'
import IntegrationConnectionFields, { type WorkingSettings, type SecretState } from './IntegrationConnectionFields'
import IntegrationHealthBadge from './IntegrationHealthBadge'
import IntegrationWebhookBlock from './IntegrationWebhookBlock'
import { useIntegrationHealth } from './useIntegrationHealth'
import { isUuid } from '@/lib/uuid'
import {
  getIntegrationSettings,
  putIntegrationSettings,
  testIntegration,
  type ConnectorId,
  type TestFailure,
} from './integrationsApi'

// The connection tab for one connector: load-once with alive guard, dirty check,
// optimistic save with revert on failure, and the live "test connection" action.
export default function IntegrationConnectionCard({ connector }: { connector: ConnectorId }) {
  const { t } = useTranslation('settings')
  const { formatDateTime } = useDateFormat()
  // Shiftmanager only: the mirror's last sync time (no dashboard GET for other connectors).
  const smLastSync = useSmLastSync(connector === 'shiftmanager')
  // Permanent connection health (hourly BE probe + manual test), refreshed after save and test.
  const { health, webhook, refresh: refreshHealth, isError: healthUnavailable } = useIntegrationHealth(connector)
  const [settings, setSettings] = useState<WorkingSettings | null>(null)
  const [initial, setInitial] = useState<WorkingSettings | null>(null)
  const [secrets, setSecrets] = useState<Record<string, SecretState>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestOutcome | null>(null)
  // Retry re-arms the ONE guarded load effect below — a separate unguarded
  // reload() let a stale connector's payload win after a fast switch (verify
  // finding, confirmed by test).
  const [loadTick, setLoadTick] = useState(0)
  // Saved-flash timer — cleared on unmount/connector switch (verify finding).
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load the connector's settings once; an alive guard drops a stale response
  // if `connector` switches (or the card unmounts) before it resolves.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setLoadError(false)
    setTestResult(null)
    setSecrets({})
    getIntegrationSettings(connector).then((s) => {
      if (!alive) return
      setSettings(s as WorkingSettings)
      setInitial(s as WorkingSettings)
    }).catch(() => {
      if (alive) setLoadError(true)
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
      if (savedTimer.current) { clearTimeout(savedTimer.current); savedTimer.current = null }
    }
  }, [connector, loadTick])

  const spec = FIELD_SPEC[connector]
  // SM-CREDS-2 feature detection: the token_api group (subdomain) only shows once
  // the GET response actually carried that key — a BE that has not landed the
  // change yet omits it, and the card renders exactly as it did before (old face).
  const hasSmCreds2 = !!initial && Object.prototype.hasOwnProperty.call(initial, 'subdomain')
  const visibleSpec = spec.filter((f) => {
    if (f.key === 'base_url') return !!initial?.base_url
    if (f.key === 'subdomain') return hasSmCreds2
    // Feature detection, not value detection: the GET carrying the flag key at
    // all (even false) proves the BE half landed, so an as-yet-empty company/
    // auth_token pair still shows and can be filled in for the first time.
    if (f.requiresFlag) return !!initial && Object.prototype.hasOwnProperty.call(initial, f.requiresFlag)
    return true
  })
  const secretKeys = visibleSpec.filter((f) => f.kind === 'secret').map((f) => f.key)
  const dirty =
    JSON.stringify(settings) !== JSON.stringify(initial) ||
    secretKeys.some((k) => secrets[k] !== undefined)

  // UX-only GUID check on the HelloFlex client id (the BE re-validates); empty is allowed.
  const clientIdValue = connector === 'helloflex' ? (settings?.client_id ?? '').trim() : ''
  const clientIdInvalid = clientIdValue !== '' && !isUuid(clientIdValue)

  // Reload after a failed load — same alive-guarded effect, new tick.
  const reload = () => setLoadTick((n) => n + 1)

  // Patch a plain (non-secret) field on the working settings object.
  const setField = (patch: Partial<WorkingSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))

  // Optimistic save with revert-on-failure; secret fields only ride along when
  // dirty (typed value or explicit null) — untouched secrets never leave the client.
  const save = async () => {
    if (!settings) return
    setSaving(true)
    const previous = initial
    // The body carries ONLY the spec's writable keys + dirty secrets — never a
    // settings spread (that PUT server-derived has_*/connected_as back, and a
    // test's connected_as made Save enable itself; verify finding, confirmed).
    const body: Record<string, unknown> = {}
    visibleSpec.forEach((f) => {
      if (f.kind === 'secret') return
      // base_url is a super-admin override: an unchanged value must never ride
      // the PUT (the BE rejects a tenant PUT that carries it, 422 prohibited).
      if (f.key === 'base_url' && settings.base_url === initial?.base_url) return
      body[f.key] = (settings as unknown as Record<string, unknown>)[f.key]
    })
    secretKeys.forEach((k) => {
      const v = secrets[k]
      if (v !== undefined) body[k] = v
    })
    try {
      const next = await putIntegrationSettings(connector, body as never)
      setSettings(next as WorkingSettings)
      setInitial(next as WorkingSettings)
      setSecrets({})
      refreshHealth()
      setSaved(true)
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setSettings(previous)
      notifyError(extractApiError(err, t('integrations.connection.saveError')))
    } finally {
      setSaving(false)
    }
  }

  // Live "test connection" — success updates the connected-as line; a 422
  // carries a reason code + server message + correlation id for support.
  const runTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testIntegration(connector)
      // Held in testResult only: writing it into settings made `dirty` true and
      // the next PUT ship a server-derived field (verify finding).
      setTestResult(result)
    } catch (err) {
      const body = (err as { response?: { data?: TestFailure } })?.response?.data
      setTestResult(body ?? { ok: false, reason_code: 'unreachable', message: t('integrations.connection.testFailed'), correlation_id: '' })
    } finally {
      setTesting(false)
      refreshHealth()
    }
  }

  // Loading state.
  if (loading) return <Caption as="p">{t('common.loadingShort')}</Caption>

  // Load-error state with retry.
  if (loadError || !settings) {
    return (
      <div style={{ maxWidth: 640 }}>
        <CalloutBox variant="danger">{t('integrations.connection.loadError')}</CalloutBox>
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={reload}>
            <RefreshCw size={14} />
            {t('common:error.retry')}
          </Button>
        </div>
      </div>
    )
  }

  // Success state: renders the connector's field spec + test/save actions.
  return (
    <div style={{ maxWidth: 640 }}>
      <PageTitle>{t('integrations.connection.title')}</PageTitle>
      <Caption as="p" style={{ marginTop: 2, marginBottom: 8 }}>{t('integrations.connection.subtitle')}</Caption>
      {/* Permanent connection status (HF-CONNECTION-STATUS-1): green / red with reason / grey, plus the check time. */}
      <IntegrationHealthBadge health={health} unavailable={healthUnavailable} onRetry={refreshHealth} />
      {/* HF-WEBHOOK-1: hidden until the BE row carries a webhook object. */}
      <IntegrationWebhookBlock webhook={webhook} />
      {/* The freshest identity wins: a passed test's connected_as over the loaded one. */}
      <Caption>
        {(() => {
          const legacyOk = testResult && 'connected_as' in testResult && testResult.ok === true
          const name = (legacyOk ? testResult.connected_as : null) ?? settings.connected_as
          return name ? t('integrations.connection.connectedAs', { name }) : t('integrations.connection.notConnected')
        })()}
      </Caption>
      {/* ONIX G-012: a saved Shiftmanager connection is "not active yet" until a sync ran. */}
      {connector === 'shiftmanager' && (settings.connected_as || settings.has_api_key || settings.has_auth_token) && (
        <Caption as="p" style={{ marginTop: 2 }}>
          {smLastSync
            ? t('integrations.connection.lastSyncedAt', { date: formatDateTime(smLastSync) })
            : t('integrations.connection.notActiveYet')}
        </Caption>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '16px 0 20px' }}>
        <IntegrationConnectionFields visibleSpec={visibleSpec} hasGroups={hasSmCreds2} settings={settings} secrets={secrets}
          setField={setField} setSecret={(k, v) => setSecrets((prev) => ({ ...prev, [k]: v }))}
          clientIdInvalid={clientIdInvalid} t={t} />
      </div>

      {/* Test-connection action: success updates the connected-as line above; failure shows the reason/message/correlation id. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Button variant="secondary" onClick={runTest} disabled={testing || dirty}>
          {testing && <Spinner size={12} />}
          {testing ? t('integrations.connection.testing') : t(hasSmCreds2 ? 'integrations.connection.testBoth' : 'integrations.connection.test')}
        </Button>
        {dirty && <Caption>{t('integrations.connection.saveBeforeTest')}</Caption>}
      </div>

      {testResult && <IntegrationTestResults result={testResult} t={t} />}

      <div style={{ marginTop: 16 }}>
        <SaveButton onClick={save} saved={saved} disabled={saving || !dirty || clientIdInvalid}>
          {t('common.save')}
        </SaveButton>
      </div>
    </div>
  )
}
