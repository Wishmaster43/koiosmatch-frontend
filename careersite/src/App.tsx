import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TenantLayout } from './theme'
import { HomePage } from './pages/HomePage'
import { VacancyListPage } from './pages/VacancyListPage'
import { VacancyDetailPage } from './pages/VacancyDetailPage'
import { NotFoundPage } from './pages/NotFoundPage'

// Route map — "/" is a tenant-less notice; every real page lives under "/:tenant",
// wrapped by TenantLayout so the branded header + theme apply to both child routes.
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:tenant" element={<TenantLayout />}>
          <Route index element={<Navigate to="vacatures" replace />} />
          <Route path="vacatures" element={<VacancyListPage />} />
          <Route path="vacatures/:ref" element={<VacancyDetailPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
