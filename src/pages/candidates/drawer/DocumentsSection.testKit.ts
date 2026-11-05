/** Shared mock-fixture DATA for the DocumentsSection suites (plain data, no mocks). */

/* eslint-disable no-restricted-syntax -- mock fixture DATA, not UI styling */
// Return value of the mocked useDocumentTypes: a fixed two-type tenant lookup.
export const documentTypesSeed = () => ({
  types: [
    { value: 'CV', label: 'CV', color: '#4F46E5' },
    { value: 'Diploma', label: 'Diploma', color: '#F59E0B' },
  ],
  labelOf: (v?: string) => v ?? '',
  colorOf: () => '#4F46E5',
})
/* eslint-enable no-restricted-syntax */
