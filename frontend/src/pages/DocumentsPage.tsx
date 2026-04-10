import { useEffect, useState, useRef, FormEvent, useCallback } from 'react'
import { api } from '../api'
import type { AuthUser } from '../api'

interface Props { user: AuthUser }

interface DocRecord {
  id:                number
  document_type:     string
  title:             string | null
  original_filename: string
  file_size_bytes:   number | null
  mime_type:         string | null
  issuing_authority: string | null
  issue_date:        string | null
  expiry_date:       string | null
  days_to_expiry:    number | null
  expiry_status:     'expired' | 'expiring_soon' | null
  survey_number:     string | null
  description:       string | null
  notes:             string | null
  tags:              string[]
  cost_amount:       number | null
  cost_description:  string | null
  uploaded_by_name:  string | null
  created_at:        string | null
  analysis_status:      'pending' | 'processing' | 'done' | 'failed' | null
  ocr_text:             string | null
  translated_text:      string | null
  extracted_fields:     Record<string, string>
  analysis_error:       string | null
  analyzed_at:          string | null
  manual_transcription: string | null
}

const DOC_TYPES = [
  "Title Deed / Sale Deed",
  "RTC (Record of Rights)",
  "Katha / Khata",
  "Land Tax Receipt",
  "Survey Sketch",
  "Encumbrance Certificate (EC)",
  "Tippan",
  "Mutation Register",
  "Patta",
  "Power of Attorney",
  "Other",
]

const TYPE_COLORS: Record<string, string> = {
  "Title Deed / Sale Deed":        "bg-purple-100 text-purple-800",
  "RTC (Record of Rights)":        "bg-blue-100 text-blue-800",
  "Katha / Khata":                 "bg-indigo-100 text-indigo-800",
  "Land Tax Receipt":              "bg-green-100 text-green-700",
  "Survey Sketch":                 "bg-yellow-100 text-yellow-800",
  "Encumbrance Certificate (EC)":  "bg-orange-100 text-orange-700",
  "Tippan":                        "bg-cyan-100 text-cyan-700",
  "Mutation Register":             "bg-pink-100 text-pink-700",
  "Patta":                         "bg-teal-100 text-teal-700",
  "Power of Attorney":             "bg-red-100 text-red-700",
  "Other":                         "bg-gray-100 text-gray-600",
}

function fileIcon(mime: string | null) {
  if (!mime) return '📄'
  if (mime === 'application/pdf') return '📋'
  if (mime.startsWith('image/')) return '🖼'
  return '📄'
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Upload Panel ──────────────────────────────────────────────────────────────

function UploadPanel({ onUploaded, onClose, surveyDefault }: {
  onUploaded: (doc: DocRecord) => void
  onClose: () => void
  surveyDefault: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]     = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [form, setForm]     = useState({
    document_type: 'Title Deed / Sale Deed',
    title: '', issuing_authority: '', issue_date: '', expiry_date: '',
    survey_number: surveyDefault, description: '', notes: '', tags: '',
    cost_amount: '', cost_description: '',
  })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) { setError('Please select a file'); return }
    setSaving(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v) })
      const { data } = await api.post('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onUploaded(data)
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-800">Upload Document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragging ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300'
            }`}
          >
            {file ? (
              <div>
                <p className="text-2xl mb-1">{fileIcon(file.type)}</p>
                <p className="font-medium text-gray-800 text-sm">{file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null) }}
                  className="mt-2 text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
            ) : (
              <div>
                <p className="text-3xl mb-2">📁</p>
                <p className="text-sm text-gray-600">Drop PDF or image here, or <span className="text-green-700 font-medium">browse</span></p>
                <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, WEBP — max 50 MB</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff"
              className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>

          {/* Document type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Document Type *</label>
            <select value={form.document_type} onChange={set('document_type')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title / Label</label>
            <input value={form.title} onChange={set('title')} placeholder='e.g. "2019 Title Deed — original"'
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          {/* Issuing authority + survey number */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Issuing Authority</label>
              <input value={form.issuing_authority} onChange={set('issuing_authority')}
                placeholder="e.g. Sub-Registrar, Udupi"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Survey Number</label>
              <input value={form.survey_number} onChange={set('survey_number')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          </div>

          {/* Issue date + expiry date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date</label>
              <input type="date" value={form.issue_date} onChange={set('issue_date')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expiry / Renewal Date</label>
              <input type="date" value={form.expiry_date} onChange={set('expiry_date')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              <p className="text-xs text-gray-400 mt-0.5">Alert shown 90 days before</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2}
              placeholder="Brief description of this document"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
            <input value={form.tags} onChange={set('tags')} placeholder="original, certified-copy, urgent (comma separated)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          {/* Cost section */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Cost to Obtain (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (INR)</label>
                <input type="number" value={form.cost_amount} onChange={set('cost_amount')} placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">What for?</label>
                <input value={form.cost_description} onChange={set('cost_description')}
                  placeholder="e.g. Advocate fee, Agent charge"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2}
              placeholder="Any additional notes for reference"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-2 pb-6">
            <button type="submit" disabled={saving}
              className="flex-1 bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50 transition-colors">
              {saving ? 'Uploading…' : 'Upload Document'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Analyze Confirm Dialog ────────────────────────────────────────────────────

function AnalyzeConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-gray-800 mb-3">Analyze this document locally?</h3>
        <ul className="text-sm text-gray-600 space-y-1.5 mb-5">
          <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Uses ~2 GB RAM for 30–90 seconds</li>
          <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Extracts text and translates Kannada to English</li>
          <li className="flex items-start gap-2"><span className="text-green-600 mt-0.5">•</span> Nothing leaves your computer</li>
        </ul>
        <div className="flex gap-3">
          <button onClick={onConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
            Start Analysis
          </button>
          <button onClick={onCancel}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ doc: initialDoc, onClose, onDelete, onDocUpdate, canEdit }: {
  doc: DocRecord
  onClose: () => void
  onDelete: (id: number) => void
  onDocUpdate: (doc: DocRecord) => void
  canEdit: boolean
}) {
  const [doc, setDoc] = useState(initialDoc)
  const [showConfirm, setShowConfirm] = useState(false)
  const [analysisTab, setAnalysisTab] = useState<'fields' | 'translated' | 'ocr'>('fields')
  const [editingType, setEditingType] = useState(false)
  const [newDocType, setNewDocType] = useState(initialDoc.document_type)
  const [transcription, setTranscription] = useState(initialDoc.manual_transcription || '')
  const [savingTranscription, setSavingTranscription] = useState(false)
  const [transcriptionSaved, setTranscriptionSaved] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // On open, fetch fresh analysis status from server
  useEffect(() => {
    api.get(`/documents/${initialDoc.id}/analysis`).then(({ data }) => {
      const updated = { ...initialDoc, ...data }
      setDoc(updated)
      onDocUpdate(updated)
    }).catch(() => {})
  }, [initialDoc.id])

  // Poll while processing
  useEffect(() => {
    if (doc.analysis_status === 'processing') {
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await api.get(`/documents/${doc.id}/analysis`)
          if (data.analysis_status !== 'processing') {
            const updated = { ...doc, ...data }
            setDoc(updated)
            onDocUpdate(updated)
            clearInterval(pollRef.current!)
          }
        } catch { /* ignore */ }
      }, 3000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [doc.analysis_status, doc.id])

  const handleDownload = () => {
    window.open(`/api/documents/${doc.id}/download`, '_blank')
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.title || doc.original_filename}"? This cannot be undone.`)) return
    await api.delete(`/documents/${doc.id}`)
    onDelete(doc.id)
    onClose()
  }

  const handleSaveTranscription = async () => {
    setSavingTranscription(true)
    try {
      const { data } = await api.patch(`/documents/${doc.id}/transcription`, { text: transcription })
      const updated = { ...doc, manual_transcription: data.manual_transcription }
      setDoc(updated)
      onDocUpdate(updated)
      setTranscriptionSaved(true)
      setTimeout(() => setTranscriptionSaved(false), 2000)
    } catch { alert('Failed to save transcription') }
    finally { setSavingTranscription(false) }
  }

  const handleSaveDocType = async () => {
    if (newDocType === doc.document_type) { setEditingType(false); return }
    try {
      const { data } = await api.patch(`/documents/${doc.id}`, { document_type: newDocType })
      const updated = { ...doc, ...data }
      setDoc(updated)
      onDocUpdate(updated)
      setEditingType(false)
    } catch { alert('Failed to update document type') }
  }

  const handleStartAnalysis = async () => {
    setShowConfirm(false)
    try {
      await api.post(`/documents/${doc.id}/analyze`)
      const updated = { ...doc, analysis_status: 'processing' as const }
      setDoc(updated)
      onDocUpdate(updated)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to start analysis')
    }
  }

  const typeColor = TYPE_COLORS[doc.document_type] || TYPE_COLORS['Other']

  return (
    <>
      {showConfirm && (
        <AnalyzeConfirmDialog onConfirm={handleStartAnalysis} onCancel={() => setShowConfirm(false)} />
      )}
      <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 pt-12" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{fileIcon(doc.mime_type)}</span>
                {editingType ? (
                  <div className="flex items-center gap-1">
                    <select value={newDocType} onChange={e => setNewDocType(e.target.value)} autoFocus
                      className="text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400">
                      {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={handleSaveDocType} className="text-xs text-white bg-blue-600 hover:bg-blue-500 px-2 py-0.5 rounded">Save</button>
                    <button onClick={() => { setEditingType(false); setNewDocType(doc.document_type) }} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor} ${canEdit ? 'cursor-pointer hover:opacity-75' : ''}`}
                    onClick={() => canEdit && setEditingType(true)}
                    title={canEdit ? 'Click to change document type' : undefined}>
                    {doc.document_type}
                  </span>
                )}
                {doc.expiry_status === 'expired' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Expired</span>
                )}
                {doc.expiry_status === 'expiring_soon' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    Expires in {doc.days_to_expiry}d
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-800">{doc.title || doc.original_filename}</h2>
              {doc.title && <p className="text-xs text-gray-400 mt-0.5">{doc.original_filename}</p>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4">×</button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-6 space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {doc.issuing_authority && (
                <div><p className="text-xs text-gray-400">Issuing Authority</p><p className="font-medium text-gray-800">{doc.issuing_authority}</p></div>
              )}
              {doc.survey_number && (
                <div><p className="text-xs text-gray-400">Survey Number</p><p className="font-medium text-gray-800">{doc.survey_number}</p></div>
              )}
              {doc.issue_date && (
                <div><p className="text-xs text-gray-400">Issue Date</p><p className="font-medium text-gray-800">{doc.issue_date}</p></div>
              )}
              {doc.expiry_date && (
                <div><p className="text-xs text-gray-400">Expiry Date</p><p className="font-medium text-gray-800">{doc.expiry_date}</p></div>
              )}
              {doc.file_size_bytes && (
                <div><p className="text-xs text-gray-400">File Size</p><p className="font-medium text-gray-800">{formatSize(doc.file_size_bytes)}</p></div>
              )}
              {doc.uploaded_by_name && (
                <div><p className="text-xs text-gray-400">Uploaded By</p><p className="font-medium text-gray-800">{doc.uploaded_by_name}</p></div>
              )}
            </div>

            {doc.description && (
              <div><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-700">{doc.description}</p></div>
            )}
            {doc.notes && (
              <div><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-sm text-gray-700">{doc.notes}</p></div>
            )}

            {doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {doc.tags.map(t => (
                  <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">#{t}</span>
                ))}
              </div>
            )}

            {doc.cost_amount && (
              <div className="bg-amber-50 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-amber-700">{doc.cost_description || 'Procurement cost'}</span>
                <span className="font-semibold text-amber-800">₹{doc.cost_amount.toLocaleString('en-IN')}</span>
              </div>
            )}

            {/* ── Manual transcription ── */}
            {canEdit && (
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Manual Transcription</p>
                  <a
                    href="https://support.apple.com/guide/mac-help/write-in-another-language-on-mac-mchlp1406/26/mac/26"
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline"
                    title="How to type Kannada on Mac"
                  >
                    How to type Kannada ↗
                  </a>
                </div>
                <textarea
                  value={transcription}
                  onChange={e => setTranscription(e.target.value)}
                  rows={4}
                  placeholder="Type what the document says here — this will be used for translation and search instead of OCR output…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                />
                <button
                  onClick={handleSaveTranscription}
                  disabled={savingTranscription}
                  className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {savingTranscription ? 'Saving…' : transcriptionSaved ? '✓ Saved' : 'Save Transcription'}
                </button>
              </div>
            )}

            {/* ── Analysis section ── */}
            <div className="border-t border-gray-100 pt-4">
              {!doc.analysis_status && canEdit && (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="w-full py-2.5 rounded-lg border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  <span>🔍</span> Analyze Document (OCR + Translate)
                </button>
              )}

              {doc.analysis_status === 'processing' && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Analyzing…</p>
                    <p className="text-xs text-blue-600">Extracting text and translating Kannada. This may take 30–90 seconds.</p>
                  </div>
                </div>
              )}

              {doc.analysis_status === 'failed' && (
                <div className="bg-red-50 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-red-700">Analysis failed</p>
                  {doc.analysis_error && <p className="text-xs text-red-500 mt-0.5">{doc.analysis_error}</p>}
                  {canEdit && (
                    <button onClick={() => setShowConfirm(true)}
                      className="mt-2 text-xs text-red-600 underline hover:no-underline">
                      Try again
                    </button>
                  )}
                </div>
              )}

              {doc.analysis_status === 'done' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Analysis Results</p>
                    <div className="flex items-center gap-2">
                      {doc.analyzed_at && (
                        <p className="text-xs text-gray-400">{new Date(doc.analyzed_at).toLocaleDateString()}</p>
                      )}
                      {canEdit && (
                        <button onClick={() => setShowConfirm(true)}
                          className="text-xs text-gray-400 hover:text-blue-600 underline">
                          Re-analyze
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Tabs */}
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                    <button onClick={() => setAnalysisTab('fields')}
                      className={`flex-1 py-2 text-center transition-colors ${analysisTab === 'fields' ? 'bg-blue-600 text-white font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
                      Extracted Fields
                    </button>
                    <button onClick={() => setAnalysisTab('translated')}
                      className={`flex-1 py-2 text-center transition-colors ${analysisTab === 'translated' ? 'bg-blue-600 text-white font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
                      Translation
                    </button>
                    <button onClick={() => setAnalysisTab('ocr')}
                      className={`flex-1 py-2 text-center transition-colors ${analysisTab === 'ocr' ? 'bg-blue-600 text-white font-medium' : 'text-gray-500 hover:bg-gray-50'}`}>
                      Raw Text
                    </button>
                  </div>

                  {analysisTab === 'fields' && (
                    Object.keys(doc.extracted_fields || {}).length > 0 ? (
                      <div className="bg-gray-50 border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                        {Object.entries(doc.extracted_fields).map(([label, value]) => (
                          <div key={label} className="flex gap-3 px-3 py-2">
                            <span className="text-xs text-gray-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
                            <span className="text-xs text-gray-800 font-medium flex-1">{value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-6 text-center">
                        <p className="text-xs text-gray-400">No structured fields could be extracted.</p>
                        <p className="text-xs text-gray-300 mt-1">
                          {['Title Deed / Sale Deed', 'Survey Sketch', 'Power of Attorney', 'Tippan', 'Other'].includes(doc.document_type)
                            ? 'This document type does not have a template — see Translation tab.'
                            : 'Try re-analyzing the document, or check the Raw Text tab.'}
                        </p>
                      </div>
                    )
                  )}

                  {(analysisTab === 'translated' || analysisTab === 'ocr') && (
                    <div className="relative">
                      <pre className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto font-sans leading-relaxed">
                        {analysisTab === 'translated' ? (doc.translated_text || '(no translation)') : (doc.ocr_text || '(no text extracted)')}
                      </pre>
                      <button
                        onClick={() => {
                          const text = analysisTab === 'translated' ? doc.translated_text : doc.ocr_text
                          if (text) navigator.clipboard.writeText(text)
                        }}
                        className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button onClick={handleDownload}
              className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
              ⬇ Download
            </button>
            {canEdit && (
              <button onClick={handleDelete}
                className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm hover:bg-red-50">
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DocumentsPage({ user }: Props) {
  const [docs, setDocs]         = useState<DocRecord[]>([])
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected]  = useState<DocRecord | null>(null)
  const [search, setSearch]      = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expiryFilter, setExpiryFilter] = useState('all')
  const [surveyDefault, setSurveyDefault] = useState('')

  const canEdit = user.role === 'owner' || user.role === 'co_owner'

  const load = (q = search, t = typeFilter, e = expiryFilter) => {
    const params: Record<string, string> = {}
    if (q) params.q = q
    if (t !== 'all') params.document_type = t
    if (e !== 'all') params.expiry_status = e
    api.get('/documents', { params }).then(r => setDocs(r.data))
  }

  useEffect(() => {
    load()
    // Pre-fill survey number from land profile
    api.get('/settings/land').then(r => setSurveyDefault(r.data.survey_number || ''))
  }, [])

  useEffect(() => { load(search, typeFilter, expiryFilter) }, [search, typeFilter, expiryFilter])

  const handleUploaded = (doc: DocRecord) => {
    setDocs(prev => [doc, ...prev])
  }

  const handleDelete = (id: number) => {
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  const handleDocUpdate = useCallback((updated: DocRecord) => {
    setDocs(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d))
    setSelected(updated)
  }, [])

  const expiringSoon = docs.filter(d => d.expiry_status === 'expiring_soon' || d.expiry_status === 'expired')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Document Vault</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {docs.length} document{docs.length !== 1 ? 's' : ''} stored
            {expiringSoon.length > 0 && (
              <span className="ml-2 text-amber-600 font-medium">· {expiringSoon.length} need attention</span>
            )}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setUploading(true)}
            className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>⬆</span> Upload Document
          </button>
        )}
      </div>

      {/* Expiry alerts banner */}
      {expiringSoon.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">⚠ Documents needing attention</p>
          <div className="space-y-1">
            {expiringSoon.map(d => (
              <div key={d.id} className="flex items-center justify-between">
                <button onClick={() => setSelected(d)} className="text-sm text-amber-700 hover:underline text-left">
                  {d.title || d.original_filename} — {d.document_type}
                </button>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  d.expiry_status === 'expired'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {d.expiry_status === 'expired' ? 'Expired' : `${d.days_to_expiry}d left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Search documents…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="all">All types</option>
          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={expiryFilter} onChange={e => setExpiryFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="all">All statuses</option>
          <option value="expiring_soon">Expiring soon</option>
          <option value="expired">Expired</option>
        </select>
        {(search || typeFilter !== 'all' || expiryFilter !== 'all') && (
          <button onClick={() => { setSearch(''); setTypeFilter('all'); setExpiryFilter('all') }}
            className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
        )}
      </div>

      {/* Documents list */}
      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center text-gray-400">
          <p className="text-4xl mb-3">🗂</p>
          <p className="font-medium">No documents yet</p>
          <p className="text-sm mt-1">Upload your first land document to get started</p>
          {canEdit && (
            <button onClick={() => setUploading(true)}
              className="mt-4 bg-green-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-600">
              Upload Document
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Document', 'Type', 'Issued by', 'Issue Date', 'Expiry', 'Size', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map(doc => {
                const typeColor = TYPE_COLORS[doc.document_type] || TYPE_COLORS['Other']
                return (
                  <tr
                    key={doc.id}
                    onClick={() => setSelected(doc)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{fileIcon(doc.mime_type)}</span>
                        <div>
                          <p className="font-medium text-gray-800 truncate max-w-48">
                            {doc.title || doc.original_filename}
                          </p>
                          {doc.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {doc.tags.slice(0, 2).map(t => (
                                <span key={t} className="text-xs text-gray-400">#{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${typeColor}`}>
                        {doc.document_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-32 truncate">
                      {doc.issuing_authority || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {doc.issue_date || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {doc.expiry_date ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          doc.expiry_status === 'expired'      ? 'bg-red-100 text-red-700' :
                          doc.expiry_status === 'expiring_soon'? 'bg-amber-100 text-amber-700' :
                          'text-gray-400'
                        }`}>
                          {doc.expiry_status === 'expired'       ? '⚠ Expired' :
                           doc.expiry_status === 'expiring_soon' ? `⚠ ${doc.days_to_expiry}d` :
                           doc.expiry_date}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatSize(doc.file_size_bytes)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {doc.analysis_status === 'done' && (
                          <span title="Analyzed" className="text-xs text-blue-500">🔍</span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); window.open(`/api/documents/${doc.id}/download`, '_blank') }}
                          className="text-xs text-green-700 hover:text-green-900 px-2 py-1 rounded border border-green-200 hover:bg-green-50"
                        >
                          ⬇
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panels / Modals */}
      {uploading && (
        <UploadPanel
          onUploaded={handleUploaded}
          onClose={() => setUploading(false)}
          surveyDefault={surveyDefault}
        />
      )}
      {selected && (
        <DetailModal
          doc={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          onDocUpdate={handleDocUpdate}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
