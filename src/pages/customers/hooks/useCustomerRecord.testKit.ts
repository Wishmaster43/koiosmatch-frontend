/** useCustomerRecord · shared Customer fixture builder (plain data, used by the split test files). */
import type { Customer } from '@/types/customer'

// Minimal Customer fixture — only the fields the mutations under test read/write.
export const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: 1, name: 'Test customer', initials: 'TC', debtorNumber: '', status: 'prospect',
  statusLabel: 'Prospect', statusColor: 'slate', owner: '', ownerId: null, ownerInitials: '', ownerColor: null,
  city: '', email: '', phone: '', lat: null, lng: null, distanceKm: null, industry: '', website: '', employeeCount: '',
  description: '',
  hideCompanyName: false, hasCareerPage: false, showInVacancies: false, excludeFromSourcing: false,
  costCenter: '', billingEmail: '', tags: [], archived: false, locations: [], departments: [], contacts: [],
  notes: [], locationsCount: 0, departmentsCount: 0, contactsCount: 0, openVacanciesCount: 0,
  activeMatchesCount: 0, created: '', logo: null, koiosAiAdvice: null, customFields: {},
  ...overrides,
} as Customer)

