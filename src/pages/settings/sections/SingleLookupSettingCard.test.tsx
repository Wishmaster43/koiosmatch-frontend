/**
 * SingleLookupSettingCard.test.tsx — the shared title/subtitle/picker card
 * behind CustomerConversionSettings and VacancyDefaultStatusSettings: it must
 * show the caller-supplied labels and call onPick with the picked option's value.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SingleLookupSettingCard from './SingleLookupSettingCard'

// SettingsLoadBanner reads the shared settings-load state; keep it "loaded" and silent.
vi.mock('@/lib/settings/useAllSettings', () => ({
  useSettingsLoadState: () => ({ state: 'loaded', retry: () => {} }),
}))

describe('SingleLookupSettingCard', () => {
  it('renders the caller-supplied title and subtitle', () => {
    render(
      <SingleLookupSettingCard
        title="Conversion status" subtitle="Applied on conversion"
        options={[{ value: 'active', label: 'Active' }]}
        value="none" onPick={vi.fn()} loaded noneLabel="None"
      />,
    )
    expect(screen.getByText('Conversion status')).toBeInTheDocument()
    expect(screen.getByText('Applied on conversion')).toBeInTheDocument()
  })

  it('calls onPick with the picked option value', async () => {
    const onPick = vi.fn()
    const user = userEvent.setup()
    render(
      <SingleLookupSettingCard
        title="t" subtitle="s"
        options={[{ value: 'active', label: 'Active' }]}
        value="none" onPick={onPick} loaded noneLabel="None"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'None' }))
    await user.click(screen.getByRole('button', { name: 'Active' }))
    expect(onPick).toHaveBeenCalledWith('active')
  })

  it('disables the picker when loaded is false', () => {
    render(
      <SingleLookupSettingCard
        title="t" subtitle="s"
        options={[]} value="none" onPick={vi.fn()} loaded={false} noneLabel="None"
      />,
    )
    expect(screen.getByRole('button', { name: 'None' })).toBeDisabled()
  })
})
