/**
 * FilterValueControl · inline enum options with an i18n instance (HF-MOVED-TO-PICKER-1): the FE's own
 * fieldOptions.<value> copy wins over the BE label when the key exists, and a resolved tenant-lookup
 * source beats inline options. Kept apart from FilterValueControl.test.tsx, which stays instance-less.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FilterValueControl from './FilterValueControl'

// A key-echo t plus an `exists` that knows exactly one fieldOptions key.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => `T:${k}`,
    i18n: { exists: (k: string) => k === 'fieldOptions.sent', language: 'nl' },
  }),
}))
vi.mock('@/context/LookupsContext', () => ({
  useLookupsOptional: () => ({
    statuses: [{ value: 'available', label: 'Beschikbaar', color: '#000' }],
    phases: [], candidateTypes: [], funnelTypes: [],
  }),
}))

const options = [{ value: 'sent', label: 'BE sent' }, { value: 'signed', label: 'BE signed' }]

describe('FilterValueControl · inline options with i18n', () => {
  it('the FE key wins for a value that has one; the BE label stays for the others', async () => {
    render(<FilterValueControl operator="=" value="" onChange={vi.fn()} ariaLabel="value" options={options} />)
    fireEvent.click(screen.getByRole('button', { name: /value/ }))
    expect(await screen.findByText('T:fieldOptions.sent')).toBeInTheDocument()
    expect(screen.getByText('BE signed')).toBeInTheDocument()
    expect(screen.queryByText('BE sent')).toBeNull()
  })

  it('a resolved tenant-lookup source beats inline options', async () => {
    render(<FilterValueControl operator="=" value="" onChange={vi.fn()} ariaLabel="value" source="candidate_statuses" options={options} />)
    fireEvent.click(screen.getByRole('button', { name: /value/ }))
    expect(await screen.findByText('Beschikbaar')).toBeInTheDocument()
    expect(screen.queryByText('BE signed')).toBeNull()
  })
})
