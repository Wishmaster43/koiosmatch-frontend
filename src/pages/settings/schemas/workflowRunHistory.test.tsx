/**
 * workflowRunHistory schema (WF-RUN-PRUNE-1) — rendered via the generic SchemaSection,
 * this is the ONE place a tenant sets `workflow_run_retention_days`, the exact key the
 * backend's RunRetentionSettings::TENANT_KEY reads (App\Workflow\RunRetentionSettings.php).
 * Asserts the real POST /settings request (route + body), not just that a callback fired —
 * §13: a mutation test proves nothing about the seam until it checks the request itself.
 * The field is the house NumberInput (a text field with locale grouping); its 1..31
 * bound is enforced on blur and SAID in a notice, never silently corrected.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import SchemaSection from '../components/SchemaSection'
import type { Schema } from '../components/SchemaSection'
import workflowRunHistoryRaw from './workflowRunHistory'
import { WINDOW_UNIT_OPTIONS } from '../components/windowUnitOptions'

// ./workflowRunHistory.js is plain untyped JS (not on this migration's list); cast once
// to the real Schema type SchemaSection itself declares.
const workflowRunHistory = workflowRunHistoryRaw as unknown as Schema

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
// SchemaSection gates its Save button on settings.update (X-29/AF:orphans-4-2, 713175d3):
// these tests exercise the editor path, so the mocked viewer holds that permission.
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key: string) => i18n.t(key, { ns: 'settings' })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({ data: {} } as Awaited<ReturnType<typeof api.get>>)
  vi.mocked(api.post).mockResolvedValue({} as Awaited<ReturnType<typeof api.post>>)
})

describe('workflowRunHistory · defaults to the platform ceiling when unset', () => {
  it('pre-fills 31 days when the tenant has never saved a value', async () => {
    render(<SchemaSection schema={workflowRunHistory} />)
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('31'))
  })

  it('clamps to the backend ceiling (1..31) on blur and says so', async () => {
    render(<SchemaSection schema={workflowRunHistory} />)
    const input = await screen.findByRole('textbox')
    await waitFor(() => expect(input).toHaveValue('31'))
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '60' } })
    fireEvent.blur(input)
    expect(input).toHaveValue('31')
    expect(screen.getByRole('status')).toHaveTextContent(i18n.t('field.maxNotice', { ns: 'common', max: '31' }))
  })
})

describe('workflowRunHistory · save persists the exact backend key', () => {
  it('POSTs /settings with workflow_run_retention_days set to the edited value', async () => {
    render(<SchemaSection schema={workflowRunHistory} />)
    const input = await screen.findByRole('textbox')
    fireEvent.change(input, { target: { value: '10' } })

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: st('common.save') })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = vi.mocked(api.post).mock.calls[0] as [string, Record<string, string>]
    expect(url).toBe('/settings')
    // settingsApi stringifies every value on the way out (POST body is all strings).
    expect(body.workflow_run_retention_days).toBe('10')
  })

  it('loads a previously saved value back from GET /settings', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { workflow_run_retention_days: '7' } } as Awaited<ReturnType<typeof api.get>>)
    render(<SchemaSection schema={workflowRunHistory} />)
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('7'))
  })
})

// O23 UNIT-NAAST-BEDRAG-1: the amount carries an inline unit companion, one row.
describe('workflowRunHistory · unit companion', () => {
  it('field shape carries workflow_run_retention_days_unit, unitOf the amount, default days', () => {
    expect(workflowRunHistory.fields).toEqual([
      { key: 'workflow_run_retention_days', type: 'number', default: 31, min: 1, max: 31 },
      { key: 'workflow_run_retention_days_unit', type: 'select', unitOf: 'workflow_run_retention_days', default: 'days',
        options: WINDOW_UNIT_OPTIONS, labelKey: 'settings.retention.workflow_run_retention_days_unit.label' },
    ])
  })

  it('renders the amount and its unit picker in a single row', async () => {
    render(<SchemaSection schema={workflowRunHistory} />)
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('31'))
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(screen.getByRole('button', { name: st('settings.retention.workflow_run_retention_days_unit.label') })).toBeInTheDocument()
  })
})
