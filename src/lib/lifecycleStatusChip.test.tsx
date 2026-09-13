/**
 * lifecycleStatusChip — the shared archive/trash-wins-over-status-pill chip,
 * shared by matches/opportunities tables (see file doc).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { lifecycleStatusChip } from './lifecycleStatusChip'

const t = ((key: string) => key) as unknown as import('i18next').TFunction

describe('lifecycleStatusChip', () => {
  it('renders the trash chip when lifecycle is pending_erase', () => {
    const chip = lifecycleStatusChip({ lifecycle: 'pending_erase' }, t)
    expect(chip).not.toBeNull()
    const { getByText } = render(<>{chip}</>)
    expect(getByText('common:trash.view')).toBeTruthy()
  })
  it('renders the archived chip when archived and not trashed', () => {
    const chip = lifecycleStatusChip({ archived: true }, t)
    const { getByText } = render(<>{chip}</>)
    expect(getByText('view.archived')).toBeTruthy()
  })
  it('returns null for an active, non-archived row', () => {
    expect(lifecycleStatusChip({ archived: false }, t)).toBeNull()
  })
})
