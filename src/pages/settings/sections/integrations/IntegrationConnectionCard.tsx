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
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import Button from '@/components/ui/Button'
import SaveButton from '@/components/ui/SaveButton'
import Toggle from '@/components/ui/Toggle'
import SelectMenu from '@/components/ui/SelectMenu'
import CalloutBox from '@/components/ui/CalloutBox'
import Spinner from '@/components/ui/Spinner'
import { PageTitle, Caption, BodyText, GroupLabel, captionStyle } from '@/components/ui/typography'
import { fieldInputStyle } from '@/components/forms/fieldMetrics'
import { notifyError } from '@/lib/notify'
import { extractApiError } from '@/lib/extractApiError'
import IntegrationTestResults, { type TestOutcome } from './IntegrationTestResults'
import { FIELD_SPEC, type FieldSpecEntry } from './connectionFieldSpec'
import {
  getIntegrationSettings,
  putIntegrationSettings,
  testIntegration,
  type ConnectorId,
  type TestFailure,
} from './integrationsApi'

// A field's own dirty/value state for a secret: `undefined` = untouched (omit
// from the PUT body), a string = typed a new value, `null` = explicitly cleared.
type SecretState = string | null | undefined

// A working copy of ANY connector's settings, loosely typed on purpose: the
// FIELD_SPEC below is the single source of truth for which keys actually apply
// to the current connector, so the component reads/writes through it rather
// than re-deriving connector-specific narrowing everywhere.
interface WorkingSettings {
  two_way: boolean
  subdomain?: string | null
  base_url?: string | null
  client_id?: string | null
  environment?: 'uat' | 'live'
  has_api_key?: boolean
  has_client_secret?: boolean
  company?: string | null
  has_auth_token?: boolean
  connected_as: string | null
}

// Field-label identity from the typography atom (stijlfabriek clause) — layout only here.
const labelStyle = { ...captionStyle, marginBottom: 4, display: 'block' as const }

// The single secret-field UI (state line + password input + clear ghost button),
// shared by every connector's api_key/client_secret row.
function SecretField({ fieldKey, hasSecret, value, onChange, t }: {
  fieldKey: 'api_key' | 'client_id' | 'client_secret' | 'auth_token'
  hasSecret: boolean
  value: SecretState
  onChange: (v: SecretState) => void
  t: (k: string) => string
}) {
  const labelKey = fieldKey === 'client_secret' ? 'clientSecret' : fieldKey === 'auth_token' ? 'authToken' : 'apiKey'
  const inputId = `integration-secret-${fieldKey}`
  return (
    <div>
      <label htmlFor={inputId} style={labelStyle}>{t(`integrations.connection.${labelKey}`)}</label>
      {/* Pending clear is a visible, undoable intent — not a silent state flip. */}
      {value === null ? (
        <Caption style={{ color: 'var(--color-danger-text)' }}>{t('integrations.connection.secretPendingClear')}</Caption>
      ) : (
        <Caption>{hasSecret ? t('integrations.connection.secretSet') : t('integrations.connection.secretNotSet')}</Caption>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input id={inputId} type="password" autoComplete="new-password"
          value={value === null ? '' : (value ?? '')}
          placeholder={t('integrations.connection.secretPlaceholder')}
          onChange={(e) => onChange(e.target.value)}
          style={fieldInputStyle} />
        {value === null ? (
          <Button variant="ghost" onClick={() => onChange(undefined)}>{t('integrations.connection.undoClear')}</Button>
        ) : hasSecret ? (
          <Button variant="ghost" onClick={() => onChange(null)}>{t('integrations.connection.clearSecret')}</Button>
        ) : null}
      </div>
    </div>
  )
}

// Renders the visible field list, inserting a GroupLabel + optional hint once
// before a group's first field — but ONLY once SM-CREDS-2 has landed
// (`hasGroups`); before that, a grouped field (api_key today) renders plain,
// exactly as it always has, so the old-shape face never shifts by a pixel.
function renderFieldsWithGroups(
  fields: FieldSpecEntry[],
  hasGroups: boolean,
  t: (k: string) => string,
  renderField: (f: FieldSpecEntry) => ReactNode,
) {
  let lastGroupId: string | undefined
  const nodes: ReactNode[] = []
  fields.forEach((field) => {
    const groupId = hasGroups ? field.group?.id : undefined
    if (groupId && groupId !== lastGroupId) {
      nodes.push(
        <div key={`group-${groupId}`} style={{ marginTop: lastGroupId ? 4 : 0 }}>
          <GroupLabel style={{ marginBottom: 4 }}>{t(field.group!.titleKey)}</GroupLabel>
          {field.group!.hintKey && <Caption as="p" style={{ marginTop: -2, marginBottom: 6 }}>{t(field.group!.hintKey)}</Caption>}
        </div>,
      )
    }
    lastGroupId = groupId
    nodes.push(renderField(field))
  })
  return nodes
}

// The connection tab for one connector: load-once with alive guard, dirty check,
// optimistic save with revert on failure, and the live "test connection" action.
export default function IntegrationConnectionCard({ connector }: { connector: ConnectorId }) {
  const { t } = useTranslation('settings')
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
      {/* The freshest identity wins: a passed test's connected_as over the loaded one. */}
      <Caption>
        {(() => {
          const legacyOk = testResult && 'connected_as' in testResult && testResult.ok === true
          const name = (legacyOk ? testResult.connected_as : null) ?? settings.connected_as
          return name ? t('integrations.connection.connectedAs', { name }) : t('integrations.connection.notConnected')
        })()}
      </Caption>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: '16px 0 20px' }}>
        {renderFieldsWithGroups(visibleSpec, hasSmCreds2, t, (field) => {
          if (field.kind === 'toggle') {
            return (
              <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Toggle checked={!!settings.two_way} onChange={(v) => setField({ two_way: v })} ariaLabel={t('integrations.connection.twoWay')} />
                <div>
                  <BodyText>{t('integrations.connection.twoWay')}</BodyText>
                  <Caption>{t('integrations.connection.twoWayHint')}</Caption>
                </div>
              </div>
            )
          }
          if (field.kind === 'text') {
            const labelKey = field.key === 'base_url' ? 'baseUrl'
              : field.key === 'subdomain' ? 'subdomain'
                : field.key === 'company' ? 'company' : 'clientId'
            const val = (settings as unknown as Record<string, unknown>)[field.key]
            return (
              <div key={field.key}>
                <label htmlFor={`integration-${field.key}`} style={labelStyle}>{t(`integrations.connection.${labelKey}`)}</label>
                <input id={`integration-${field.key}`} value={typeof val === 'string' ? val : ''}
                  onChange={(e) => setField({ [field.key]: e.target.value } as Partial<WorkingSettings>)}
                  style={fieldInputStyle} />
                {field.key === 'subdomain' && (
                  <Caption as="p" style={{ marginTop: 4 }}>{t('integrations.connection.subdomainHint')}</Caption>
                )}
              </div>
            )
          }
          if (field.kind === 'select') {
            // Only `environment` is a select field today (helloflex uat/live).
            return (
              <div key={field.key}>
                <label id="integration-environment-label" style={labelStyle}>{t('integrations.connection.environment')}</label>
                <SelectMenu
                  aria-labelledby="integration-environment-label"
                  value={settings.environment ?? 'uat'}
                  onChange={(v) => setField({ environment: v as 'uat' | 'live' })}
                  options={[
                    { value: 'uat', label: t('integrations.connection.envUat') },
                    { value: 'live', label: t('integrations.connection.envLive') },
                  ]}
                />
              </div>
            )
          }
          // Secret field (api_key / client_secret / auth_token).
          const hasKey = field.key === 'client_secret' ? 'has_client_secret'
            : field.key === 'auth_token' ? 'has_auth_token' : 'has_api_key'
          return (
            <SecretField key={field.key}
              fieldKey={field.key as 'api_key' | 'client_secret' | 'auth_token'}
              hasSecret={!!(settings as unknown as Record<string, unknown>)[hasKey]}
              value={secrets[field.key]}
              onChange={(v) => setSecrets((prev) => ({ ...prev, [field.key]: v }))}
              t={t} />
          )
        })}
      </div>

      {/* Test-connection action: success updates the connected-as line above; failure shows the reason/message/correlation id. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Button variant="secondary" onClick={runTest} disabled={testing}>
          {testing && <Spinner size={12} />}
          {testing ? t('integrations.connection.testing') : t(hasSmCreds2 ? 'integrations.connection.testBoth' : 'integrations.connection.test')}
        </Button>
      </div>

      {testResult && <IntegrationTestResults result={testResult} t={t} />}

      <div style={{ marginTop: 16 }}>
        <SaveButton onClick={save} saved={saved} disabled={saving || !dirty}>
          {t('common.save')}
        </SaveButton>
      </div>
    </div>
  )
}
