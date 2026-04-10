import { useEffect, useState, FormEvent } from 'react'
import { api } from '../api'
import type { AuthUser, LandProfile } from '../api'

interface Props { user: AuthUser }

export default function SettingsPage({ user }: Props) {
  const [profile, setProfile] = useState<LandProfile | null>(null)
  const [form, setForm]       = useState<Partial<LandProfile>>({})
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const canEdit = user.role === 'owner' || user.role === 'co_owner'

  useEffect(() => {
    api.get('/settings/land').then(r => {
      setProfile(r.data)
      setForm(r.data)
    })
  }, [])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch('/settings/land', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof LandProfile, label: string, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={(form[key] as string | number) ?? ''}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        disabled={!canEdit}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  )

  if (!profile) return <p className="text-gray-400">Loading…</p>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Land Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Edit the profile for your farm</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {field('name',          'Farm Name')}
          {field('area_acres',    'Area (acres)', 'number')}
          {field('location',      'Village / Location')}
          {field('district',      'District')}
          {field('state',         'State')}
          {field('survey_number', 'Survey Number')}
          {field('gps_lat',       'GPS Latitude', 'number')}
          {field('gps_lng',       'GPS Longitude', 'number')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes ?? ''}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            disabled={!canEdit}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {canEdit && (
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <p className="text-sm text-green-600">✓ Saved</p>}
          </div>
        )}
      </form>
    </div>
  )
}
