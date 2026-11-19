/**
 * MultiSelectField with {value, label} options (lens finding on HF-MODULES-FE-B): the HelloFlex
 * inbound node's `events` passes object options (value = the HelloFlex filter name, label = the
 * catalogue event label); the static branch used to cast every option to a string and threw on
 * the object at render. Real i18n instance: the label resolves through workflows:fieldOptions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import MultiSelectField from './MultiSelectField'
import type { WorkflowField } from '@/types/workflow'

// The static option path never reads a tenant lookup; the context is stubbed with empty lists.
vi.mock('@/context/LookupsContext', () => ({
  useLookups: () => ({ statuses: [], phases: [], candidateTypes: [] }),
}))

const field = {
  key: 'events', label: 'Events', type: 'multiselect',
  options: [
    { value: 'CreateCandidate', label: 'HelloFlex candidate created' },
    { value: 'UpdateCandidate', label: 'HelloFlex candidate updated' },
  ],
} as unknown as WorkflowField
const nlLabel = (en: string) => i18n.t(`fieldOptions.${en}`, { ns: 'workflows', lng: 'nl' })

describe('MultiSelectField · {value, label} options', () => {
  beforeEach(() => i18n.changeLanguage('nl'))

  it('renders the translated label of an object option and hands onChange the option VALUE', () => {
    const onChange = vi.fn()
    render(<MultiSelectField field={field} value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('textbox'))

    const label = nlLabel('HelloFlex candidate created')
    expect(label).not.toBe('fieldOptions.HelloFlex candidate created')
    fireEvent.click(screen.getByText(label))
    expect(onChange).toHaveBeenCalledWith('events', ['CreateCandidate'])
  })

  it('appends a second event to an existing selection (the append path)', () => {
    const onChange = vi.fn()
    render(<MultiSelectField field={field} value={['CreateCandidate']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('textbox'))
    fireEvent.click(screen.getByText(nlLabel('HelloFlex candidate updated')))
    expect(onChange).toHaveBeenCalledWith('events', ['CreateCandidate', 'UpdateCandidate'])
  })

  it('shows a selected value as a chip with its translated label, never the raw filter name', () => {
    render(<MultiSelectField field={field} value={['UpdateCandidate']} onChange={vi.fn()} />)
    expect(screen.getByText(nlLabel('HelloFlex candidate updated'))).toBeInTheDocument()
    expect(screen.queryByText('UpdateCandidate')).not.toBeInTheDocument()
  })

  it('keeps plain string options working as before (value = label through fieldOptions)', () => {
    const onChange = vi.fn()
    const plain = { key: 'status', label: 'Status', type: 'multiselect', options: ['open', 'archived'] } as unknown as WorkflowField
    render(<MultiSelectField field={plain} value={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('textbox'))
    fireEvent.click(screen.getByText(i18n.t('fieldOptions.open', { ns: 'workflows', lng: 'nl' })))
    expect(onChange).toHaveBeenCalledWith('status', ['open'])
  })
})
