/**
 * IntegrationTestResults — renders POST /integrations/{connector}/test's
 * result (SM-CREDS-2, CONTRACT-CHANGELOG.md): the NEW dual `results` shape
 * (one line per credential API, tested separately) when the backend has
 * landed it, or the OLD single-outcome shape otherwise — both stay valid on
 * the wire, so this component branches on which one it received rather than
 * on the connector.
 */
import { CheckCircle2, XCircle } from 'lucide-react'
import CalloutBox from '@/components/ui/CalloutBox'
import { Caption } from '@/components/ui/typography'
import type { TestFailure, TestSuccess, DualTestResult, DualTestOutcome, TestReasonCode } from './integrationsApi'

export type TestOutcome = TestSuccess | TestFailure | DualTestResult

interface Props {
  result: TestOutcome
  t: (key: string | string[], opts?: Record<string, unknown>) => string
}

// One dual-result line: ok/failed icon (house lucide pair, colour via §4
// success/danger tokens — never ad-hoc hex), the API's own title, and either
// the connected-as name or the translated reason + server message.
function ResultLine({ titleKey, outcome, t }: { titleKey: string; outcome: DualTestOutcome; t: Props['t'] }) {
  const Icon = outcome.ok ? CheckCircle2 : XCircle
  const color = outcome.ok ? 'var(--color-success)' : 'var(--color-danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
      <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
      <div>
        <Caption style={{ fontWeight: 600, color: 'var(--text)' }}>{t(titleKey)}</Caption>
        <Caption as="p" style={{ margin: 0 }}>
          {outcome.ok
            ? (outcome.connected_as ? t('integrations.connection.testOk', { name: outcome.connected_as }) : t('integrations.connection.testOk', { name: '' }).trim())
            : `${t([`integrations.reason.${outcome.reason_code as TestReasonCode}`, 'integrations.connection.testFailed'])}${outcome.message ? ` — ${outcome.message}` : ''}`}
        </Caption>
      </div>
    </div>
  )
}

// Dual shape ('results' present) → two ResultLines; legacy shape → the single
// CalloutBox exactly as the card rendered before SM-CREDS-2.
export default function IntegrationTestResults({ result, t }: Props) {
  if ('results' in result) {
    return (
      <div style={{ marginBottom: 12 }}>
        <ResultLine titleKey="integrations.connection.tokenApiTitle" outcome={result.results.token_api} t={t} />
        <ResultLine titleKey="integrations.connection.companyApiTitle" outcome={result.results.company_api} t={t} />
        {result.correlation_id && (
          <Caption>{t('integrations.connection.correlation', { id: result.correlation_id })}</Caption>
        )}
      </div>
    )
  }

  if (result.ok === true) {
    return <CalloutBox variant="success">{t('integrations.connection.testOk', { name: result.connected_as })}</CalloutBox>
  }

  return (
    <CalloutBox variant="danger" title={t([`integrations.reason.${result.reason_code}`, 'integrations.connection.testFailed'])}>
      <p style={{ margin: 0 }}>{result.message}</p>
      <Caption>{t('integrations.connection.correlation', { id: result.correlation_id })}</Caption>
    </CalloutBox>
  )
}
