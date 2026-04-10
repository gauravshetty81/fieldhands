import { useEffect, useState } from 'react'
import { api } from '../api'
import type { AuthUser } from '../api'

interface Props { user: AuthUser }

interface UserRecord {
  id:         number
  username:   string
  full_name:  string | null
  email:      string | null
  role:       string
  is_active:  boolean
  last_login: string | null
}

const ROLE_OPTIONS = ['owner','co_owner','caretaker','accountant','viewer']
const ROLE_LABELS: Record<string,string> = {
  owner:'Owner', co_owner:'Co-owner', caretaker:'Caretaker', accountant:'Accountant', viewer:'Viewer'
}
const ROLE_COLORS: Record<string,string> = {
  owner:'bg-green-100 text-green-800', co_owner:'bg-blue-100 text-blue-800',
  caretaker:'bg-yellow-100 text-yellow-800', accountant:'bg-purple-100 text-purple-800',
  viewer:'bg-gray-100 text-gray-600'
}

export default function UsersPage({ user }: Props) {
  const [users, setUsers]     = useState<UserRecord[]>([])
  const [adding, setAdding]   = useState(false)
  const [form, setForm]       = useState({ username:'', full_name:'', email:'', password:'', role:'viewer' })
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)

  const canManage = user.role === 'owner' || user.role === 'co_owner'

  const load = () => api.get('/users').then(r => setUsers(r.data))

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    setError('')
    setSaving(true)
    try {
      await api.post('/users', form)
      setAdding(false)
      setForm({ username:'', full_name:'', email:'', password:'', role:'viewer' })
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Error creating user')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return
    await api.delete(`/users/${id}`)
    load()
  }

  const handleToggle = async (u: UserRecord) => {
    await api.patch(`/users/${u.id}`, { is_active: !u.is_active })
    load()
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage who can access Fieldhands</p>
        </div>
        {canManage && (
          <button
            onClick={() => setAdding(true)}
            className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add user
          </button>
        )}
      </div>

      {/* Add user form */}
      {adding && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-700">New user</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['username','full_name','email','password'] as const).map(k => (
              <div key={k}>
                <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{k.replace('_',' ')}</label>
                <input
                  type={k === 'password' ? 'password' : 'text'}
                  value={form[k]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving}
              className="bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setAdding(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Name','Username','Role','Status','Last login',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{u.full_name || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{u.username}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}
                </td>
                <td className="px-4 py-3">
                  {canManage && u.id !== user.id && (
                    <div className="flex gap-2">
                      <button onClick={() => handleToggle(u)} className="text-xs text-gray-400 hover:text-gray-600">
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleDelete(u.id, u.full_name || u.username)} className="text-xs text-red-400 hover:text-red-600">
                        Remove
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
