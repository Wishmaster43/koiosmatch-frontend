/**
 * CustomerStatusReasonModal — KLANT-BLACKLIST-PROMPT-1: Save stays disabled while
 * needReason is true and no reason is picked, and enables once a reason lands (or
 * when the tenant setting makes the reason optional). No `react-i18next` mock —
 * neither this component nor FloatingPanel imports the real i18n bootstrap, so
 * `t()` falls back to the raw key (mirrors CandidateStatusModals.test.tsx).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CustomerStatusReasonModal from './CustomerStatusReasonModal'

const reasons = [{ value: 'Fraude', label: 'Fraude' }]

describe('CustomerStatusReasonModal · Save gating', () => {
  it('disables Save while needReason is true and no reason is picked', () => {
    render(<CustomerStatusReasonModal state={{ target: 'bl', reason: '', reasonKey: null, needReason: true }}
      onChangeReason={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} reasons={reasons} />)
    expect(screen.getByRole('button', { name: 'common:save' })).toBeDisabled()
  })

  it('enables Save once a reason is picked', () => {
    render(<CustomerStatusReasonModal state={{ target: 'bl', reason: 'Fraude', reasonKey: null, needReason: true }}
      onChangeReason={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} reasons={reasons} />)
    expect(screen.getByRole('button', { name: 'common:save' })).not.toBeDisabled()
  })

  it('enables Save with an empty reason when the tenant setting makes it optional', () => {
    render(<CustomerStatusReasonModal state={{ target: 'bl', reason: '', reasonKey: null, needReason: false }}
      onChangeReason={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} reasons={reasons} />)
    expect(screen.getByRole('button', { name: 'common:save' })).not.toBeDisabled()
  })

  // §6: the picker is a button, so its accessible name must come from the label via aria-labelledby.
  it('names the reason picker by its label', () => {
    render(<CustomerStatusReasonModal state={{ target: 'bl', reason: '', reasonKey: null, needReason: true }}
      onChangeReason={() => {}} onCancel={() => {}} onConfirm={() => {}} reasons={[]} />)
    expect(screen.getByRole('button', { name: /blacklistReasonLabel|Reden/ })).toBeInTheDocument()
  })
})

// BLACKLIST-EMPTY-1: a required reason with no configured reasons is a dead end — the
// prompt says so and links to Settings; while the lookup is still loading it stays quiet.
describe('CustomerStatusReasonModal · no reasons configured', () => {
  it('shows the notice + settings link and keeps Save disabled once the lookup answered empty', () => {
    render(<CustomerStatusReasonModal state={{ target: 'bl', reason: '', reasonKey: null, needReason: true }}
      onChangeReason={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} reasons={[]} reasonsLoaded />)
    expect(screen.getByText('drawer.blacklistReasonNone')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'drawer.blacklistReasonSetup' })).toHaveAttribute('href', '#settings/customers/customer_blacklist_reasons')
    expect(screen.getByRole('button', { name: 'common:save' })).toBeDisabled()
  })

  it('stays quiet while the lookup has not answered yet', () => {
    render(<CustomerStatusReasonModal state={{ target: 'bl', reason: '', reasonKey: null, needReason: true }}
      onChangeReason={vi.fn()} onCancel={vi.fn()} onConfirm={vi.fn()} reasons={[]} reasonsLoaded={false} />)
    expect(screen.queryByText('drawer.blacklistReasonNone')).toBeNull()
  })
})

