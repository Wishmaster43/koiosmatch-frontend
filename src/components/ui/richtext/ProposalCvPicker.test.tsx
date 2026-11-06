/**
 * ProposalCvPicker (Y-002): picking and clearing hand the id / null to onChange; the empty state shows the hint only.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProposalCvPicker from './ProposalCvPicker'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/i18n', () => ({ LOCALE_BY_LANG: { nl: 'nl-NL', en: 'en-GB' } }))
const hook = vi.hoisted(() => ({ value: { docs: [] as unknown[], loading: false, error: false } }))
vi.mock('./useProposalCvDocuments', () => ({ useProposalCvDocuments: () => hook.value }))

describe('ProposalCvPicker', () => {
  it('hands the picked document id to onChange', async () => {
    hook.value = { docs: [{ id: 'd1', label: 'CV - Jan.pdf', uploadedAt: null }], loading: false, error: false }
    const onChange = vi.fn()
    render(<ProposalCvPicker applicationId="a1" value={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /notesAssist.proposeCv.placeholder/ }))
    await userEvent.click(await screen.findByText('CV - Jan.pdf'))
    expect(onChange).toHaveBeenCalledWith('d1')
  })

  it('clearing a chosen CV calls onChange(null)', async () => {
    hook.value = { docs: [{ id: 'd1', label: 'CV - Jan.pdf', uploadedAt: null }], loading: false, error: false }
    const onChange = vi.fn()
    render(<ProposalCvPicker applicationId="a1" value="d1" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /clear|wissen|common/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows only the none hint when no CV exists', () => {
    hook.value = { docs: [], loading: false, error: false }
    render(<ProposalCvPicker applicationId="a1" value={null} onChange={vi.fn()} />)
    expect(screen.getByText('notesAssist.proposeCv.none')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows the load error caption', () => {
    hook.value = { docs: [], loading: false, error: true }
    render(<ProposalCvPicker applicationId="a1" value={null} onChange={vi.fn()} />)
    expect(screen.getByText('notesAssist.proposeCv.loadError')).toBeTruthy()
  })
})
