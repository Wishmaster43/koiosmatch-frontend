// DocumentsFilterMenu — the wrapper hands the shared menu its config and the three namespaced common labels (key echo).
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
const menuSpy = vi.fn<(props: unknown) => null>(() => null)
vi.mock('@/components/drawer/DrawerFilterMenu', () => ({ default: (props: unknown) => menuSpy(props) }))
import DocumentsFilterMenu from './DocumentsFilterMenu'

describe('DocumentsFilterMenu', () => {
  it('passes the filter config and the common filter labels to the shared menu', () => {
    const filters = [{ key: 'type', label: 'Type', options: [], selected: [], onToggle: () => {} }]
    render(<DocumentsFilterMenu filters={filters as never} />)
    expect(menuSpy).toHaveBeenCalledTimes(1)
    expect(menuSpy.mock.calls[0][0]).toEqual({
      filters, label: 'common:filters.button', title: 'common:filters.title', clearAllLabel: 'common:filters.clearAll',
    })
  })
})
