import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExperienceList } from './ExperienceList'
import { strings } from '@/strings'
import type { ExperienceEntry } from '@/types'

// Thin controlled-state wrapper mirroring how ApplyForm itself owns `entries` —
// lets the test drive the real add/edit/remove flow while observing onChange.
function Harness({ onEntriesChange }: { onEntriesChange: (entries: ExperienceEntry[]) => void }) {
  const [entries, setEntries] = useState<ExperienceEntry[]>([])
  const handleChange = (next: ExperienceEntry[]) => {
    setEntries(next)
    onEntriesChange(next)
  }
  return <ExperienceList entries={entries} onChange={handleChange} />
}

describe('ExperienceList', () => {
  it('empty state renders only the add button, no cards', () => {
    render(<Harness onEntriesChange={() => {}} />)
    expect(screen.queryByText(strings.apply.experience.removeLabel)).toBeNull()
    expect(screen.getByRole('button', { name: strings.apply.experience.addButton })).toBeTruthy()
  })

  it('blocks adding an entry without a company name', async () => {
    const user = userEvent.setup()
    render(<Harness onEntriesChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: strings.apply.experience.addButton }))
    await user.click(screen.getByRole('button', { name: strings.apply.experience.saveButton }))

    expect(await screen.findByText(strings.apply.experience.companyRequired)).toBeTruthy()
  })

  it('adding two entries then removing the first leaves exactly the second entry at index 0', async () => {
    const user = userEvent.setup()
    const onEntriesChange = vi.fn()
    render(<Harness onEntriesChange={onEntriesChange} />)

    await user.click(screen.getByRole('button', { name: strings.apply.experience.addButton }))
    await user.type(screen.getByLabelText(strings.apply.experience.company), 'Bedrijf A')
    await user.click(screen.getByRole('button', { name: strings.apply.experience.saveButton }))

    await user.click(screen.getByRole('button', { name: strings.apply.experience.addButton }))
    await user.type(screen.getByLabelText(strings.apply.experience.company), 'Bedrijf B')
    await user.click(screen.getByRole('button', { name: strings.apply.experience.saveButton }))

    const removeButtons = screen.getAllByRole('button', { name: strings.apply.experience.removeLabel })
    expect(removeButtons).toHaveLength(2)
    await user.click(removeButtons[0])

    const lastCall = onEntriesChange.mock.calls.at(-1)?.[0] as ExperienceEntry[]
    expect(lastCall).toHaveLength(1)
    expect(lastCall[0].company).toBe('Bedrijf B')
  })
})
