import { useEffect, useState } from 'react'
import { api } from '../api'
import type { AuthUser } from '../api'

interface Props { user: AuthUser }

interface RoadmapItem {
  id:             number
  title:          string
  description:    string | null
  details:        string | null
  category:       string | null
  module:         string | null
  status:         string
  priority:       string
  priority_order: number | null
  tags:           string[]
  linked_modules: string[]
  cost_estimate:  number | null
  created_at:     string | null
  updated_at:     string | null
}

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  idea:        { label: 'Idea',        color: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400'   },
  planned:     { label: 'Planned',     color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800',dot: 'bg-yellow-500' },
  done:        { label: 'Done',        color: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  on_hold:     { label: 'On Hold',     color: 'bg-red-100 text-red-600',      dot: 'bg-red-400'    },
}

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  critical: { label: 'Critical', color: 'text-red-600 font-semibold'    },
  high:     { label: 'High',     color: 'text-orange-600 font-semibold' },
  medium:   { label: 'Medium',   color: 'text-yellow-600'               },
  low:      { label: 'Low',      color: 'text-gray-400'                 },
}

const CATEGORIES = ['Documents', 'Government', 'Automation', 'Accounting', 'Farm', 'Analytics', 'Infrastructure', 'Other']
const STATUSES   = ['idea', 'planned', 'in_progress', 'done', 'on_hold']
const PRIORITIES = ['critical', 'high', 'medium', 'low']
const MODULE_OPTIONS = [
  'documents','compliance','automation','accounting','farm','analytics','dashboard'
]

function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>{text}</span>
}

function DetailModal({ item, onClose, onSave, canEdit }: {
  item: RoadmapItem
  onClose: () => void
  onSave: (id: number, patch: Partial<RoadmapItem>) => void
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({ ...item })
  const [saving, setSaving]   = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(item.id, {
      title: form.title, description: form.description, details: form.details,
      category: form.category, status: form.status as any, priority: form.priority as any,
      tags: form.tags, linked_modules: form.linked_modules, cost_estimate: form.cost_estimate,
    })
    setEditing(false)
    setSaving(false)
  }

  const sm = STATUS_META[form.status] || STATUS_META.idea
  const pm = PRIORITY_META[form.priority] || PRIORITY_META.medium

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex-1 pr-4">
            {editing ? (
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full text-xl font-bold text-gray-800 border-b border-green-400 outline-none pb-1"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-800">{item.title}</h2>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge text={sm.label} color={sm.color} />
              <span className={`text-xs ${pm.color}`}>{pm.label} priority</span>
              {item.category && <span className="text-xs text-gray-400">· {item.category}</span>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {canEdit && !editing && (
              <button onClick={() => setEditing(true)}
                className="text-sm text-green-700 hover:text-green-900 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-50">
                Edit
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2">×</button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Status/Priority/Category row */}
          {editing && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                  {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                  <option value="">—</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Summary</label>
            {editing ? (
              <textarea value={form.description || ''} rows={3}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">{item.description || '—'}</p>
            )}
          </div>

          {/* Details */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Details & Notes</label>
            {editing ? (
              <textarea value={form.details || ''} rows={10}
                onChange={e => setForm(f => ({ ...f, details: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-400" />
            ) : (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-4 font-sans">
                {item.details || 'No details yet.'}
              </pre>
            )}
          </div>

          {/* Linked modules + tags */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Linked Modules</label>
              {item.linked_modules.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {item.linked_modules.map(m => (
                    <span key={m} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{m}</span>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-400">None</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Tags</label>
              {item.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {item.tags.map(t => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">#{t}</span>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-400">None</p>}
            </div>
          </div>

          {/* Cost estimate */}
          {(item.cost_estimate || editing) && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Cost Estimate</label>
              {editing ? (
                <input type="number" value={form.cost_estimate ?? ''} placeholder="INR"
                  onChange={e => setForm(f => ({ ...f, cost_estimate: e.target.value ? Number(e.target.value) : null }))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-green-400" />
              ) : (
                <p className="text-sm text-gray-700">₹{item.cost_estimate?.toLocaleString('en-IN')}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {editing && (
          <div className="flex gap-2 px-6 pb-6">
            <button onClick={handleSave} disabled={saving}
              className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button onClick={() => { setEditing(false); setForm({ ...item }) }}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AddItemModal({ onClose, onAdd }: { onClose: () => void; onAdd: (item: RoadmapItem) => void }) {
  const [form, setForm] = useState({
    title: '', description: '', category: 'Other',
    priority: 'medium', status: 'idea',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleAdd = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    try {
      const { data } = await api.post('/roadmap', form)
      onAdd(data)
      onClose()
    } catch { setError('Failed to create') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800">Add roadmap item</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="e.g. Drip irrigation system" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Brief description of what this is" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
              {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={handleAdd} disabled={saving}
            className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-5 py-2 rounded-lg disabled:opacity-50">
            {saving ? 'Adding…' : 'Add item'}
          </button>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg border border-gray-200">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function RoadmapPage({ user }: Props) {
  const [items, setItems]         = useState<RoadmapItem[]>([])
  const [selected, setSelected]   = useState<RoadmapItem | null>(null)
  const [adding, setAdding]       = useState(false)
  const [filterStatus, setFilter] = useState('all')
  const [filterCat, setFilterCat] = useState('all')
  const [search, setSearch]       = useState('')

  const canEdit = user.role === 'owner' || user.role === 'co_owner'

  const load = () => api.get('/roadmap').then(r => setItems(r.data))
  useEffect(() => { load() }, [])

  const handleSave = async (id: number, patch: Partial<RoadmapItem>) => {
    const { data } = await api.patch(`/roadmap/${id}`, patch)
    setItems(prev => prev.map(i => i.id === id ? data : i))
    setSelected(data)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this item from the roadmap?')) return
    await api.delete(`/roadmap/${id}`)
    setItems(prev => prev.filter(i => i.id !== id))
    setSelected(null)
  }

  const handleAdd = (item: RoadmapItem) => setItems(prev => [item, ...prev])

  const categories: string[] = ['all', ...Array.from(new Set(items.map(i => i.category).filter((c): c is string => !!c)))]

  const filtered = items.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false
    if (filterCat !== 'all' && item.category !== filterCat) return false
    if (search && !item.title.toLowerCase().includes(search.toLowerCase()) &&
        !(item.description || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Group by priority for display
  const byPriority: Record<string, RoadmapItem[]> = {}
  for (const p of PRIORITIES) byPriority[p] = []
  for (const item of filtered) {
    (byPriority[item.priority] = byPriority[item.priority] || []).push(item)
  }

  const counts = {
    total: items.length,
    done: items.filter(i => i.status === 'done').length,
    inProgress: items.filter(i => i.status === 'in_progress').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Roadmap</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {counts.total} items · {counts.inProgress} in progress · {counts.done} done
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setAdding(true)}
            className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + Add item
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Search…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <select value={filterStatus} onChange={e => setFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="all">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
        {(filterStatus !== 'all' || filterCat !== 'all' || search) && (
          <button onClick={() => { setFilter('all'); setFilterCat('all'); setSearch('') }}
            className="text-sm text-gray-400 hover:text-gray-600">Clear filters</button>
        )}
      </div>

      {/* Items grouped by priority */}
      {PRIORITIES.map(priority => {
        const group = byPriority[priority] || []
        if (group.length === 0) return null
        const pm = PRIORITY_META[priority]
        return (
          <div key={priority}>
            <h2 className={`text-xs font-semibold uppercase tracking-widest mb-3 ${pm.color}`}>
              {pm.label} priority
            </h2>
            <div className="space-y-2">
              {group.map(item => {
                const sm = STATUS_META[item.status] || STATUS_META.idea
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 cursor-pointer hover:border-green-200 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${sm.dot}`} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 group-hover:text-green-800 transition-colors truncate">
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge text={sm.label} color={sm.color} />
                            {item.category && (
                              <span className="text-xs text-gray-400">{item.category}</span>
                            )}
                            {item.linked_modules.length > 0 && (
                              <span className="text-xs text-gray-400">
                                → {item.linked_modules.join(', ')}
                              </span>
                            )}
                            {item.tags.slice(0, 3).map(t => (
                              <span key={t} className="text-xs text-gray-300">#{t}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-300 group-hover:text-green-600 shrink-0 mt-1">
                        View →
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">📋</p>
          <p>No items match your filters</p>
        </div>
      )}

      {/* Modals */}
      {selected && (
        <DetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          canEdit={canEdit}
        />
      )}
      {adding && (
        <AddItemModal onClose={() => setAdding(false)} onAdd={handleAdd} />
      )}
    </div>
  )
}
