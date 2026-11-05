/** Shared DATA fixtures for the AddCustomerModal suites (plain data, no mocks). */
/* eslint-disable no-restricted-syntax -- DATA: fixture colours as the API returns them, not UI styling */

// Hex values here are DATA — fixture colours as the API returns them, not UI styling.
// KLANT-FASE-1: TENANT-RENAMED phases, the is_default row is NOT first and is NOT called 'prospect'.
export const customerPhases = [
  { value: 'vaste_klant', label: 'Vaste klant', color: '#16A34A', isCustomer: true, isDefault: false },
  { value: 'interesse', label: 'Interesse', color: '#1B60A9', isCustomer: false, isDefault: true },
]

export const phaseFallbackColor = '#9CA3AF'
