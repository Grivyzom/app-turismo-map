import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import TwoFactorPage from './pages/TwoFactorPage'
import DashboardPage from './pages/DashboardPage'
import AuditLogPage from './pages/AuditLogPage'
import MapPage from './pages/MapPage'
import CompanyPage from './pages/CompanyPage'
import SettingsPage from './pages/SettingsPage'
import RatingShowcasePage from './pages/RatingShowcasePage'
import AdminLayout from './components/AdminLayout'
import { Toaster } from './components/ui/Toast'
import 'react-tooltip/dist/react-tooltip.css'


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Verificando sesión...</p>
      </div>
    )
  }
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth()
  if (isLoading) return null
  return token ? <Navigate to="/" replace /> : <>{children}</>
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" offset={{ top: 80, right: 24 }} />
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/verify-2fa" element={<PublicRoute><TwoFactorPage /></PublicRoute>} />
        <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/mapa" element={<MapPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/empresas" element={<CompanyPage />} />
          <Route path="/audit-log" element={<AuditLogPage />} />
          <Route path="/ratings" element={<RatingShowcasePage />} />
          <Route path="/configuracion" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

