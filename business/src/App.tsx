import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { canAccess } from './lib/catalog'
import BusinessLayout from './components/BusinessLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CreateEventPage from './pages/CreateEventPage'
import LocationPage from './pages/LocationPage'
import UpdatesPage from './pages/UpdatesPage'
import ZonesPage from './pages/ZonesPage'

function Protected({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/ingresar" replace />
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  return token ? <Navigate to="/" replace /> : <>{children}</>
}

// Bloquea secciones no permitidas para el rol actual.
function RoleGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  return canAccess(user, pathname) ? <>{children}</> : <Navigate to="/" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/ingresar" element={<PublicOnly><LoginPage /></PublicOnly>} />
      {/* Alias heredados de la app Expo */}
      <Route path="/login" element={<Navigate to="/ingresar" replace />} />
      <Route path="/register" element={<Navigate to="/ingresar?modo=registro" replace />} />
      <Route element={<Protected><BusinessLayout /></Protected>}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/eventos/nuevo" element={<RoleGate><CreateEventPage /></RoleGate>} />
        <Route path="/create-event" element={<Navigate to="/eventos/nuevo" replace />} />
        <Route path="/novedades" element={<RoleGate><UpdatesPage /></RoleGate>} />
        <Route path="/updates" element={<Navigate to="/novedades" replace />} />
        <Route path="/ubicacion" element={<RoleGate><LocationPage /></RoleGate>} />
        <Route path="/geolocalizar" element={<Navigate to="/ubicacion" replace />} />
        <Route path="/zonas" element={<RoleGate><ZonesPage /></RoleGate>} />
        <Route path="/delimitar-zonas" element={<Navigate to="/zonas" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
