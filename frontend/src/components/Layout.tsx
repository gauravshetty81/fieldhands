import { NavLink, useNavigate } from 'react-router-dom'
import type { AuthUser } from '../api'

interface LayoutProps {
  user: AuthUser
  onLogout: () => void
  children: React.ReactNode
}

const NAV = [
  { path: '/',           label: 'Dashboard',         icon: '🏡', roles: ['owner','co_owner','caretaker','accountant','viewer'] },
  { path: '/accounting', label: 'Accounting',         icon: '₹',  roles: ['owner','co_owner','accountant'] },
  { path: '/documents',  label: 'Document Vault',     icon: '🗂',  roles: ['owner','co_owner'] },
  { path: '/farm',       label: 'Farm Operations',    icon: '🌴', roles: ['owner','co_owner','caretaker'] },
  { path: '/automation', label: 'Automation',         icon: '⚙️', roles: ['owner','co_owner'] },
  { path: '/compliance', label: 'Govt & Compliance',  icon: '📋', roles: ['owner','co_owner'] },
  { path: '/analytics',  label: 'Analytics',          icon: '📊', roles: ['owner','co_owner','accountant'] },
  { path: '/roadmap',    label: 'Roadmap',            icon: '🗺',  roles: ['owner','co_owner','accountant','viewer'] },
  { path: '/settings',   label: 'Settings',           icon: '⚙',  roles: ['owner','co_owner'] },
  { path: '/users',      label: 'Users',              icon: '👥', roles: ['owner','co_owner'] },
]

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', co_owner: 'Co-owner', caretaker: 'Caretaker',
  accountant: 'Accountant', viewer: 'Viewer',
}

export default function Layout({ user, onLogout, children }: LayoutProps) {
  const navigate = useNavigate()

  const visibleNav = NAV.filter(n => n.roles.includes(user.role))

  const handleLogout = () => {
    onLogout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-green-900 text-white flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-green-700">
          <p className="text-xl font-bold tracking-wide">🌾 Fieldhands</p>
          <p className="text-xs text-green-300 mt-0.5">Udupi Farm</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-green-700 text-white font-medium'
                    : 'text-green-200 hover:bg-green-800 hover:text-white'
                }`
              }
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-green-700">
          <p className="text-sm font-medium text-white truncate">{user.full_name || user.username}</p>
          <p className="text-xs text-green-300">{ROLE_LABELS[user.role] || user.role}</p>
          <button
            onClick={handleLogout}
            className="mt-2 text-xs text-green-400 hover:text-white transition-colors"
          >
            Sign out →
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
