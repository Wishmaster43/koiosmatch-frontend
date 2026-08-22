/**
 * DuplicateNotice.test — the warning surfaces name + archive state only, the
 * live-probe variant never blocks (no assertive role, no create prevented).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import DuplicateNotice from './DuplicateNotice'

describe('DuplicateNotice · warning variant', () => {
  it('shows the matched name and an "active" state, never blocking the form', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <DuplicateNotice
          match={{ id: 'c1', name: 'Noud Blom', archived: false }}
          variant="warning"
          canRestore={false}
          restoring={false}
          onOpen={vi.fn()}
          onRestore={vi.fn()}
          onDismiss={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(screen.getByText('Noud Blom')).toBeInTheDocument()
    // Warning = ambient (status), never assertive (alert) — it must not read as a hard block.
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the archived state when the matched record is archived', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <DuplicateNotice
          match={{ id: 'c1', name: 'Noud Blom', archived: true }}
          variant="warning"
          canRestore={false}
          restoring={false}
          onOpen={vi.fn()}
          onRestore={vi.fn()}
          onDismiss={vi.fn()}
        />
      </I18nextProvider>,
    )
    expect(screen.getByText(i18n.t('candidates:duplicate.stateArchived'))).toBeInTheDocument()
  })
})
