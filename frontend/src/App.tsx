import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import type { AuthUser } from './api'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'
import RoadmapPage from './pages/RoadmapPage'
import DocumentsPage from './pages/DocumentsPage'
import Layout from './components/Layout'

function PrivateRoute({ user, children }: { user: AuthUser | null; children: React.ReactNode }) {
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('fh_user')
    return stored ? JSON.parse(stored) : null
  })

  const handleLogin = (u: AuthUser) => {
    setUser(u)
    localStorage.setItem('fh_user', JSON.stringify(u))
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('fh_token')
    localStorage.removeItem('fh_user')
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
        <Route
          path="/*"
          element={
            <PrivateRoute user={user}>
              <Layout user={user!} onLogout={handleLogout}>
                <Routes>
                  <Route path="/"          element={<DashboardPage user={user!} />} />
                  <Route path="/settings"  element={<SettingsPage user={user!} />} />
                  <Route path="/users"     element={<UsersPage user={user!} />} />
                  <Route path="/roadmap"   element={<RoadmapPage user={user!} />} />
                  <Route path="/documents" element={<DocumentsPage user={user!} />} />
                  <Route path="*"          element={<ComingSoon />} />
                </Routes>
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <p className="text-4xl mb-3">🌴</p>
      <p className="text-lg font-medium">Coming soon</p>
      <p className="text-sm mt-1">This module is under development</p>
    </div>
  )
}
