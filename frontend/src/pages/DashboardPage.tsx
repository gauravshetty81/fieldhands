import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { AuthUser, DashboardData, ActivityEntry } from '../api'
import WeatherWidget from '../components/WeatherWidget'

interface Props {
  user: AuthUser
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">No recent activity</p>
  }
  return (
    <ul className="space-y-2">
      {entries.map((e, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className="text-gray-400 text-xs mt-0.5 w-14 shrink-0">{timeAgo(e.at)}</span>
          <div>
            <span className="font-medium text-gray-700">{e.by}</span>
            <span className="text-gray-500"> {e.action} </span>
            <span className="text-gray-600">{e.description}</span>
            <span className="ml-1 text-xs text-gray-400">({e.module})</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function DashboardPage({ user }: Props) {
  const [data, setData]   = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/dashboard')
      .then(r => setData(r.data))
      .catch(() => setError('Failed to load dashboard'))
  }, [])

  if (error) return <p className="text-red-500">{error}</p>
  if (!data)  return <p className="text-gray-400 py-10 text-center">Loading…</p>

  const { land, crops, financials, activity, weather, modules } = data

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome back, {user.full_name || user.username}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {land ? `${land.name} · ${land.location}, ${land.state}` : 'Fieldhands'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT: main column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Land summary card */}
          {land && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-gray-800 text-lg">{land.name}</h2>
                  <p className="text-sm text-gray-500">
                    {[land.location, land.district, land.state].filter(Boolean).join(', ')}
                  </p>
                  {land.survey_number && (
                    <p className="text-xs text-gray-400 mt-0.5">Survey No: {land.survey_number}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-700">{land.area_acres} ac</p>
                  <p className="text-xs text-gray-400">total area</p>
                </div>
              </div>

              {/* Crops */}
              {crops.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {crops.map(c => (
                    <span key={c.id} className="bg-green-50 text-green-800 text-xs px-3 py-1 rounded-full">
                      🌴 {c.name}{c.count ? ` × ${c.count}` : ''}{c.variety ? ` (${c.variety})` : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* GPS */}
              {land.gps_lat && land.gps_lng && (
                <p className="mt-3 text-xs text-gray-400">
                  📍 {land.gps_lat.toFixed(4)}°N, {land.gps_lng.toFixed(4)}°E
                </p>
              )}
            </div>
          )}

          {/* Financial snapshot */}
          {financials && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-700 mb-4">This Month</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">Income</p>
                  <p className="text-xl font-bold text-green-600">
                    ₹{financials.income_this_month.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-center border-x border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Expenses</p>
                  <p className="text-xl font-bold text-red-500">
                    ₹{financials.expenses_this_month.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-1">Net P&L</p>
                  <p className={`text-xl font-bold ${financials.net_pl >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    ₹{financials.net_pl.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                Add transactions in the Accounting module to see real data here
              </p>
            </div>
          )}

          {/* Module quick links */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-4">Modules</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {modules.map(m => (
                <Link
                  key={m.id}
                  to={m.path}
                  className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50 transition-colors"
                >
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{m.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-3">Recent Activity</h2>
            <ActivityFeed entries={activity} />
          </div>
        </div>

        {/* RIGHT: sidebar */}
        <div className="space-y-5">
          {/* Weather */}
          <WeatherWidget weather={weather} />

          {/* Quick stats */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-700">Land Overview</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Area</span>
                <span className="font-medium">{land?.area_acres ?? '—'} acres</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Crops</span>
                <span className="font-medium">{crops.length} types</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Coconut trees</span>
                <span className="font-medium">
                  {crops.find(c => c.name.toLowerCase().includes('coconut'))?.count ?? '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">State</span>
                <span className="font-medium">{land?.state ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Placeholder alerts */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h2 className="font-semibold text-amber-800 text-sm mb-2">⚠ Reminders</h2>
            <p className="text-xs text-amber-700">
              No upcoming document expirations. Add documents in the Document Vault to track renewal dates.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
