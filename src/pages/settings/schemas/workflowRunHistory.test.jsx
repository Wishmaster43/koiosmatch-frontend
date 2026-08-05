/**
 * workflowRunHistory schema (WF-RUN-PRUNE-1) — rendered via the generic SchemaSection,
 * this is the ONE place a tenant sets `workflow_run_retention_days`, the exact key the
 * backend's RunRetentionSettings::TENANT_KEY reads (App\Workflow\RunRetentionSettings.php).
 * Asserts the real POST /settings request (route + body), not just that a callback fired —
 * §13: a mutation test proves nothing about the seam until it checks the request itself.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import api from '@/lib/api'
import SchemaSection from '../components/SchemaSection'
import workflowRunHistory from './workflowRunHistory'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

// Resolve the active locale's own copy so assertions never guess/hardcode a language.
const st = (key) => i18n.t(key, { ns: 'settings' })

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({})
})

describe('workflowRunHistory · defaults to the platform ceiling when unset', () => {
  it('pre-fills 31 days when the tenant has never saved a value', async () => {
    render(<SchemaSection schema={workflowRunHistory} />)
    await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(31))
  })

  it('the field is bounded to the backend ceiling (1..31) in the control itself', async () => {
    render(<SchemaSection schema={workflowRunHistory} />)
    const input = await screen.findByRole('spinbutton')
    expect(input).toHaveAttribute('min', '1')
    expect(input).toHaveAttribute('max', '31')
  })
})

describe('workflowRunHistory · save persists the exact backend key', () => {
  it('POSTs /settings with workflow_run_retention_days set to the edited value', async () => {
    render(<SchemaSection schema={workflowRunHistory} />)
    const input = await screen.findByRole('spinbutton')
    fireEvent.change(input, { target: { value: '10' } })

    const saveBtn = await waitFor(() => {
      const btn = screen.getByRole('button', { name: st('common.save') })
      expect(btn).toBeEnabled()
      return btn
    })
    fireEvent.click(saveBtn)

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe('/settings')
    // settingsApi stringifies every value on the way out (POST body is all strings).
    expect(body.workflow_run_retention_days).toBe('10')
  })

  it('loads a previously saved value back from GET /settings', async () => {
    api.get.mockResolvedValue({ data: { workflow_run_retention_days: '7' } })
    render(<SchemaSection schema={workflowRunHistory} />)
    await waitFor(() => expect(screen.getByRole('spinbutton')).toHaveValue(7))
  })
})
