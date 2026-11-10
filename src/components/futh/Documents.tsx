'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  FileText, Upload, Search, Loader2, Trash2, Download, FileImage, FileSignature,
  Files, Building2, Users, FileCheck2, Eye, X,
} from 'lucide-react'
import { initials, formatDate } from '@/lib/formatters'
import { toast } from 'sonner'
import FileUpload from './FileUpload'
import StaffSearch from './StaffSearch'

// === Categories ===
type CatKey = 'staff_hardcopy' | 'committee_file' | 'institutional' | 'personal_image' | 'personal_signature' | 'other'

const CATEGORIES: { value: CatKey; label: string; icon: any; color: string; managerOnly?: boolean }[] = [
  { value: 'staff_hardcopy', label: 'Staff Hardcopy', icon: FileCheck2, color: 'bg-blue-100 text-blue-700', managerOnly: true },
  { value: 'committee_file', label: 'Committee File', icon: Users, color: 'bg-violet-100 text-violet-700', managerOnly: true },
  { value: 'institutional', label: 'Institutional', icon: Building2, color: 'bg-amber-100 text-amber-700', managerOnly: true },
  { value: 'personal_image', label: 'My Passport Photo', icon: FileImage, color: 'bg-green-100 text-green-700' },
  { value: 'personal_signature', label: 'My Signature', icon: FileSignature, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'other', label: 'Other', icon: FileText, color: 'bg-gray-100 text-gray-700', managerOnly: true },
]

const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER', 'SECRETARY', 'CMD_SECRETARY', 'AD']

type Props = { user: any }

export default function Documents({ user }: Props) {
  const [items, setItems] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [committees, setCommittees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState<any>(null)

  const role = user?.activeRole || user?.role || 'STAFF'
  const isManager = MANAGER_ROLES.includes(role)
  const myStaffId = user?.staffId

  // Determine which categories this user can upload
  const uploadableCategories = isManager
    ? CATEGORIES
    : CATEGORIES.filter((c) => !c.managerOnly && (c.value === 'personal_image' || c.value === 'personal_signature'))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.set('category', categoryFilter)
      if (search) params.set('q', search)
      const [docsRes, staffRes, comRes] = await Promise.all([
        fetch(`/api/documents?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
        fetch('/api/committees', { cache: 'no-store' }),
      ])
      const docsData = await docsRes.json()
      const staffData = await staffRes.json()
      const comData = await comRes.json()
      setItems(docsData.documents || [])
      setStaff(staffData.staff || [])
      setCommittees(comData.committees || [])
    } catch {
      toast.error('Failed to load documents')
    }
    setLoading(false)
  }, [categoryFilter, search])

  useEffect(() => { load() }, [load])

  const openUpload = () => {
    setForm({
      title: '',
      description: '',
      category: uploadableCategories[0]?.value || 'personal_image',
      fileUrl: '',
      fileName: '',
      fileSize: null,
      mimeType: null,
      staffId: '',
      committeeId: '',
      documentDate: '',
      tags: '',
    })
    setUploading(true)
  }

  const save = async () => {
    if (!form.title || !form.category || !form.fileUrl) {
      toast.error('Title, category and a file are required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          documentDate: form.documentDate || null,
          staffId: form.staffId || null,
          committeeId: form.committeeId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to upload')
      } else if (data.duplicate) {
        // Server detected a duplicate — show the existing document's info + link
        const existing = data.existingDocument
        const uploader = existing?.uploadedBy?.fullName || 'another user'
        const dateStr = existing?.createdAt ? new Date(existing.createdAt).toLocaleDateString() : ''
        toast.error(`File already uploaded as "${existing?.title || '—'}" by ${uploader}${dateStr ? ` on ${dateStr}` : ''}. Upload cancelled.`, { duration: 7000 })
        // Show the existing doc in the list (the toast is enough — no need to close the dialog;
        // user can adjust the title or pick a different file).
      } else {
        toast.success('Document uploaded')
        setUploading(false)
        setForm(null)
        load()
      }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const [submitting, setSubmitting] = useState(false)

  const remove = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to delete')
      else { toast.success('Document deleted'); load() }
    } catch {
      toast.error('Network error')
    }
  }

  // Group items by category for display
  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((i) => i.category === c.value),
  }))

  // Stats
  const stats = CATEGORIES.map((c) => ({
    ...c,
    count: items.filter((i) => i.category === c.value).length,
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Files className="size-6" /> Documents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isManager
              ? 'Institutional document repository — upload staff hardcopies, committee files, institutional documents.'
              : 'View documents linked to your staff record. Upload your passport photo and signature using the cards below.'}
          </p>
        </div>
        <Button onClick={openUpload} disabled={uploadableCategories.length === 0}>
          <Upload className="size-4" /> Upload Document
        </Button>
      </div>

      {/* === Stats Cards === */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
          <Card key={s.value} className="border-l-4" style={{ borderLeftColor: 'var(--primary)' }}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <s.icon className="size-4 text-primary" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="text-lg font-bold">{s.count}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* === Special Panel for STAFF: My Image & Signature === */}
      {!isManager && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileImage className="size-4 text-primary" /> My Passport Photo & Signature
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Upload your passport photo and signature image. These will be used across the system (staff directory, appraisals, print templates, official letters).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StaffImageSignatureCard
                label="My Passport Photo"
                hint="A clear passport photo of yourself (JPG/PNG, ≤2MB)"
                accept="image/*"
                category="personal_image"
                staffId={myStaffId}
                existing={items.find((i) => i.category === 'personal_image' && i.staffId === myStaffId)}
                onChanged={load}
              />
              <StaffImageSignatureCard
                label="My Signature"
                hint="A scanned image of your signature on white background (JPG/PNG, ≤2MB)"
                accept="image/*"
                category="personal_signature"
                staffId={myStaffId}
                existing={items.find((i) => i.category === 'personal_signature' && i.staffId === myStaffId)}
                onChanged={load}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* === My Documents — for STAFF users: shows ALL documents linked to their staffId === */}
      {/* This includes hardcopies uploaded by Registry/Secretary on their behalf, plus their own image/signature uploads. */}
      {/* Always rendered (even if empty) so staff can see at a glance what documents are on their file. */}
      {!isManager && myStaffId && (
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
              <Files className="size-4 text-primary" /> My Documents
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              All documents linked to your staff record — including hardcopies (NIN cards, certificates, contracts) uploaded by Registry or Secretary on your behalf, plus your own image/signature uploads. File numbers are unique per document and can be quoted when contacting Registry.
            </p>
            {(() => {
              const myDocs = items.filter((i) => i.staffId === myStaffId || i.uploadedById === user?.id)
              if (myDocs.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-md border border-dashed">
                    No documents have been uploaded to your staff record yet.
                    <br />
                    <span className="text-[11px]">Once Registry or Secretary uploads a hardcopy (NIN slip, certificate, contract) for you, or once you upload your passport photo / signature, they will appear here.</span>
                  </div>
                )
              }
              return <DocumentList items={myDocs} isManager={isManager} currentUserId={user?.id} onDelete={remove} />
            })()}
          </CardContent>
        </Card>
      )}

      {/* === Filters === */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search by file #, title, description, file name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* === Document Groups === — shown only for managers (staff already see their own docs above) */}
      {isManager && (
        loading ? (
          <Card><CardContent className="p-4"><Skeleton className="h-12" /></CardContent></Card>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No documents uploaded yet. Click "Upload Document" to add one.</CardContent></Card>
        ) : categoryFilter !== 'all' ? (
          <DocumentList items={items} isManager={isManager} currentUserId={user?.id} onDelete={remove} />
        ) : (
          grouped.filter((g) => g.items.length > 0).map((g) => (
            <div key={g.value}>
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <g.icon className="size-4" /> {g.label} <Badge variant="outline" className="text-[10px]">{g.items.length}</Badge>
              </h2>
              <DocumentList items={g.items} isManager={isManager} currentUserId={user?.id} onDelete={remove} />
            </div>
          ))
        )
      )}

      {/* === Upload Dialog === */}
      <Dialog open={uploading} onOpenChange={(o) => { if (!o) { setUploading(false); setForm(null) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              {isManager
                ? 'Upload a hardcopy, committee file, or institutional document. Choose the appropriate category.'
                : 'Upload your passport photo or signature image. These will be linked to your staff record.'}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-3 py-2">
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {uploadableCategories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2"><c.icon className="size-3.5" /> {c.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. NIN slip for Peter Ade" />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional description..." />
              </div>
              <div>
                <Label>File *</Label>
                <FileUpload
                  type="document"
                  accept={form.category === 'personal_image' || form.category === 'personal_signature' ? 'image/*' : 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'}
                  label="Upload document"
                  value={form.fileUrl}
                  onChange={(url, name, size, mime) => setForm({
                    ...form,
                    fileUrl: url,
                    fileName: name || (url ? url.split('/').pop() || '' : ''),
                    fileSize: size || null,
                    mimeType: mime || null,
                    // Auto-fill title if empty
                    title: form.title || (name || (url ? url.split('/').pop() || '' : '')),
                  })}
                  previewClassName="h-32 w-full object-contain"
                />
              </div>
              {/* Manager-only fields */}
              {isManager && (
                <>
                  {(form.category === 'staff_hardcopy' || form.category === 'personal_image' || form.category === 'personal_signature') && (
                    <div>
                      <Label>Linked Staff {form.category === 'staff_hardcopy' ? '*' : '(optional)'}</Label>
                      <StaffSearch
                        staff={staff}
                        value={form.staffId}
                        onChange={(v) => setForm({ ...form, staffId: v })}
                        allowClear={form.category !== 'staff_hardcopy'}
                        placeholder="Search staff to link this document to..."
                      />
                      {form.category === 'staff_hardcopy' && !form.staffId && (
                        <p className="text-[10px] text-amber-600 mt-1">Staff hardcopies must be linked to a specific staff record.</p>
                      )}
                    </div>
                  )}
                  {form.category === 'committee_file' && (
                    <div>
                      <Label>Linked Committee *</Label>
                      <Select value={form.committeeId} onValueChange={(v) => setForm({ ...form, committeeId: v })}>
                        <SelectTrigger><SelectValue placeholder="Select committee..." /></SelectTrigger>
                        <SelectContent>
                          {committees.filter((c) => c.isActive).map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {form.category === 'staff_hardcopy' && (
                    <div>
                      <Label>Document Date (when was the original issued?)</Label>
                      <Input type="date" value={form.documentDate} onChange={(e) => setForm({ ...form, documentDate: e.target.value })} />
                    </div>
                  )}
                  <div>
                    <Label>Tags (comma-separated)</Label>
                    <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. NIN, certificate, contract" />
                  </div>
                </>
              )}
              {!isManager && (
                <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 p-2 rounded">
                  Your upload will be linked to your staff record and visible to you and managers (Registry / Secretary / Admin).
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploading(false); setForm(null) }}>Cancel</Button>
            <Button onClick={save} disabled={submitting || !form?.title || !form?.fileUrl}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// === Document list (table-style cards) ===
function DocumentList({ items, isManager, currentUserId, onDelete }: { items: any[]; isManager: boolean; currentUserId: string; onDelete: (id: string, title: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-md border border-dashed">
        No documents in this category yet.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((d) => {
        const cat = CATEGORIES.find((c) => c.value === d.category)
        const canDelete = isManager || (d.uploadedById === currentUserId && (d.category === 'personal_image' || d.category === 'personal_signature'))
        const isImage = d.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(d.fileName || '')
        return (
          <Card key={d.id}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="size-16 shrink-0 rounded-md bg-muted/40 flex items-center justify-center overflow-hidden">
                  {isImage && d.fileUrl ? (
                    <img src={d.fileUrl} alt={d.title} className="size-full object-cover" />
                  ) : (
                    <FileText className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {d.fileNumber && (
                    <div className="text-[10px] font-mono font-semibold text-primary bg-primary/10 inline-block px-1.5 py-0.5 rounded mb-1">
                      {d.fileNumber}
                    </div>
                  )}
                  <div className="font-medium truncate" title={d.title}>{d.title}</div>
                  {d.description && <div className="text-xs text-muted-foreground line-clamp-2">{d.description}</div>}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <Badge className={`${cat?.color || ''} text-[10px]`} variant="outline">{cat?.label || d.category}</Badge>
                    {d.staff && <Badge variant="outline" className="text-[10px]">{d.staff.fullName}</Badge>}
                    {d.committee && <Badge variant="outline" className="text-[10px]">{d.committee.code}</Badge>}
                    {!d.isPublic && <Badge variant="outline" className="text-[10px] text-amber-700">Private</Badge>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Uploaded by {d.uploadedBy?.fullName || '—'} · {formatDate(d.createdAt)}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex">
                      <Button size="sm" variant="outline" className="h-7 px-2"><Eye className="size-3.5" /> View</Button>
                    </a>
                    <a href={d.fileUrl} download={d.fileName} className="inline-flex">
                      <Button size="sm" variant="outline" className="h-7 px-2"><Download className="size-3.5" /> </Button>
                    </a>
                    {canDelete && (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" onClick={() => onDelete(d.id, d.title)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// === Compact card for STAFF users to upload their image / signature inline ===
function StaffImageSignatureCard({ label, hint, accept, category, staffId, existing, onChanged }: {
  label: string
  hint: string
  accept: string
  category: 'personal_image' | 'personal_signature'
  staffId?: string | null
  existing?: any
  onChanged: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const onFileSelected = async (url: string, name?: string, size?: number, mime?: string) => {
    if (!url) return
    if (!staffId) { toast.error('Your account is not linked to a staff record.'); return }
    setUploading(true)
    setSubmitting(true)
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: existing ? `${label} — replacement` : label,
          category,
          fileUrl: url,
          fileName: name || url.split('/').pop() || '',
          fileSize: size || null,
          mimeType: mime || null,
          staffId,
          isPublic: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to upload')
      } else if (data.duplicate) {
        const existing = data.existingDocument
        const uploader = existing?.uploadedBy?.fullName || 'another user'
        const dateStr = existing?.createdAt ? new Date(existing.createdAt).toLocaleDateString() : ''
        toast.error(`This file was already uploaded as "${existing?.title || '—'}" by ${uploader}${dateStr ? ` on ${dateStr}` : ''}. Upload cancelled.`, { duration: 7000 })
      } else {
        toast.success(`${label} uploaded`)
        onChanged()
      }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
    setUploading(false)
  }

  const isImage = existing?.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(existing?.fileName || '')

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <div className="size-20 shrink-0 rounded-md bg-muted/40 flex items-center justify-center overflow-hidden border">
          {existing?.fileUrl && isImage ? (
            <img src={existing.fileUrl} alt={label} className="size-full object-cover" />
          ) : (
            <FileImage className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-[11px] text-muted-foreground mb-2">{hint}</div>
          {existing ? (
            <div className="text-xs text-muted-foreground">
              Uploaded {formatDate(existing.createdAt)}
              <div className="flex gap-1 mt-1">
                <a href={existing.fileUrl} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="h-7 px-2"><Eye className="size-3.5" /> View</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-600">No {label.toLowerCase()} uploaded yet</div>
          )}
          <div className="mt-2">
            <FileUpload
              type={category === 'personal_image' ? 'avatar' : 'signature'}
              accept={accept}
              label={existing ? 'Replace' : 'Upload'}
              value=""
              onChange={onFileSelected}
              previewClassName="hidden"
            />
            {submitting && <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Uploading...</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
