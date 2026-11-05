// Shared plain fixtures for the CustomerDrawer test files (split from CustomerDrawer.test.tsx); no mocks, no tests.
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */

export const phasesWithCustomer = [
  { value: 'interesse', label: 'Interesse', color: '#1B60A9', isCustomer: false, isDefault: true },
  { value: 'vaste_klant', label: 'Vaste klant', color: '#16A34A', isCustomer: true, isDefault: false },
]

// Builds the useCustomerPhases return value (a fresh object per call, like the inline mock factory it replaces).
export const customerPhasesValue = () => ({
  phases: phasesWithCustomer,
  phaseMeta: (v?: string | null) => phasesWithCustomer.find(p => p.value === v)
    ?? { value: v ?? '', label: v ?? '', color: '#9CA3AF', isCustomer: false, isDefault: false },
  defaultPhase: 'interesse',
  // Explicit `: boolean` return type — without it TS 5.5+ infers a narrowing type
  // predicate from the `=== 'vaste_klant'` check, which then rejects the plain
  // `() => false` passed to mockReturnValueOnce in CustomerDrawer.test.tsx (not a type predicate).
  isCustomerPhase: (v?: string | null): boolean => v === 'vaste_klant',
  loading: false,
})
