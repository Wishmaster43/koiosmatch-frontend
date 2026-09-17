/**
 * DepartmentDrawer — a department without a name falls back to a translated
 * title/aria-label, never the hardcoded English literal "Department" (D5
 * audit finding: an untranslated fallback still reaches the aria-label).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import DepartmentDrawer from './DepartmentDrawer'
import type { ReportDepartment } from '@/types/reports'

describe('DepartmentDrawer — untitled fallback', () => {
  it('renders the translated fallback title when the department has no name', () => {
    const department = { id: 'd1' } as ReportDepartment
    render(<DepartmentDrawer department={department} onClose={() => {}} />)
    // Dutch active locale — the key resolves to "Afdeling", never "Department".
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Afdeling')
  })
})
