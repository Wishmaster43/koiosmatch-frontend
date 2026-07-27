/**
 * ProposalSettings.test — §13: assert the REQUEST (settings POST body), never
 * only that a callback fired. Mirrors CareerSiteSettings.test.jsx's mocking shape.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import ProposalSettings from './ProposalSettings'

// Real translations (no i18n provider in this render tree, so t() would
// otherwise just echo the key) — mirrors GebruikSettings.test.jsx's pattern.
const t = (key, opts) => i18n.t(key, { ns: 'settings', ...opts })

// Route the shared settings loader: the blob is controlled per test; saves go
// through the REAL saveSettingsKeys so the api.post seam is asserted.
const blobRef = vi.hoisted(() => ({ current: {} }))
vi.mock('@/lib/settings/useAllSettings', async () => {
  const actual = await vi.importActual('@/lib/settings/useAllSettings')
  return { ...actual, useAllSettings: () => blobRef.current }
})
const postMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ data: {} })))
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(() => new Promise(() => {})), post: postMock } }))

afterEach(() => { vi.clearAllMocks(); blobRef.current = {} })

const STORED = {
  subject_template: 'Voorstel: {kandidaat} voor {vacature}',
  body_template: '<p>Hallo {contact},</p>',
  sets_phase: false,
  default_cv_variant: 'proposal',
}

describe('ProposalSettings', () => {
  it('renders the stored subject/body/variant', () => {
    blobRef.current = { application_proposal: JSON.stringify(STORED) }
    render(<ProposalSettings />)
    expect(screen.getByDisplayValue(STORED.subject_template)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getAllByRole('radio')[0]).toBeChecked() // proposal
  })

  it('toggling sets_phase POSTs the merged JSON blob immediately', async () => {
    blobRef.current = { application_proposal: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<ProposalSettings />)
    await user.click(screen.getByRole('checkbox'))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_proposal: JSON.stringify({ ...STORED, sets_phase: true }),
    })
  })

  it('picking the full CV variant POSTs the merged JSON blob', async () => {
    blobRef.current = { application_proposal: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<ProposalSettings />)
    await user.click(screen.getAllByRole('radio')[1]) // full
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_proposal: JSON.stringify({ ...STORED, default_cv_variant: 'full' }),
    })
  })

  it('saving the template POSTs the edited subject/body', async () => {
    blobRef.current = { application_proposal: JSON.stringify(STORED) }
    const user = userEvent.setup()
    render(<ProposalSettings />)
    await user.clear(screen.getByLabelText(t('proposal.subjectLabel')))
    // Avoid `{...}` in the typed string — user-event's `type` reserves braces for
    // special-key syntax; the token-substitution behaviour itself is not this test's concern.
    await user.type(screen.getByLabelText(t('proposal.subjectLabel')), 'Nieuw onderwerp')
    await user.click(screen.getByRole('button', { name: t('common.save') }))
    expect(postMock).toHaveBeenCalledWith('/settings', {
      application_proposal: JSON.stringify({ ...STORED, subject_template: 'Nieuw onderwerp' }),
    })
  })

  it('shows the honest "not sent yet" notice', () => {
    render(<ProposalSettings />)
    expect(screen.getByText(t('proposal.notSentYet'))).toBeInTheDocument()
  })
})
