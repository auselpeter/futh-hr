'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ListChecks, ClipboardCheck, Search, Plus, X, Printer, Download, Upload,
  Pencil, Trash2, Eye, Loader2, CheckCircle2, AlertTriangle,
  TrendingUp, ListTodo, ExternalLink, ChevronRight,
} from 'lucide-react'
import { formatDate } from '@/lib/formatters'
import { toast } from 'sonner'
import { printHTML, printHeader, htmlEscape, row } from '@/lib/print'
import { exportToExcel } from '@/lib/export'
import { isBefore } from 'date-fns'

// ===== Types =====
type StaffLite = {
  id: string
  staffId: string
  fullName: string
  ippisNumber: string | null
  position: string | null
  rank: string | null
  departmentId: string | null
  unitId: string | null
  department?: { id: string; name: string; code: string } | null
  unit?: { id: string; name: string; code: string } | null
}

type DutyRow = {
  id: string
  staffId: string
  title: string
  description: string | null
  type: string
  order: number
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  durationDays: number | null
  status: string
  targetScore: number
  achievedScore: number | null
  grade: string | null
  weight: number
  period: string | null
  evidenceUrl: string | null
  evidenceFileName: string | null
  evidenceNotes: string | null
  evidenceUploadedAt: string | null
  reviewedById: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  reviewRemarks: string | null
  staff?: StaffLite
  reviewer?: { id: string; fullName: string; username: string; role: string } | null
}

// ===== Constants =====
const STATUS_OPTIONS = ['Assigned', 'In Progress', 'Completed', 'Approved', 'Rejected', 'Overdue']
const TYPE_OPTIONS = ['Primary', 'Secondary', 'Routine', 'Project-based']

const statusColor: Record<string, string> = {
  Assigned: 'bg-gray-100 text-gray-700 border-gray-200',
  'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
  Completed: 'bg-amber-100 text-amber-700 border-amber-200',
  Approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
  Overdue: 'bg-red-100 text-red-700 border-red-200',
}

const gradeColor: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-700',
  A: 'bg-green-100 text-green-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-amber-100 text-amber-700',
  D: 'bg-yellow-100 text-yellow-700',
  F: 'bg-red-100 text-red-700',
}

function scoreTextClass(score: number | null | undefined): string {
  if (score == null) return 'text-gray-400'
  if (score >= 90) return 'text-emerald-700'
  if (score >= 80) return 'text-green-700'
  if (score >= 70) return 'text-blue-700'
  if (score >= 60) return 'text-amber-700'
  if (score >= 50) return 'text-yellow-700'
  return 'text-red-700'
}

function scoreBarClass(score: number | null | undefined): string {
  if (score == null) return 'bg-gray-200'
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 80) return 'bg-green-500'
  if (score >= 70) return 'bg-blue-500'
  if (score >= 60) return 'bg-amber-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function isDutyOverdue(d: DutyRow): boolean {
  if (!d.dueDate) return false
  if (['Completed', 'Approved', 'Rejected'].includes(d.status)) return false
  return isBefore(new Date(d.dueDate), new Date())
}

// ===== Main Component =====
type Props = {
  user: any
  onNavigate?: (v: any) => void
}

export default function Duties({ user }: Props) {
  const role = user?.activeRole || user?.role
  const isStaff = role === 'STAFF'
  const canReview = ['HOD', 'HOU', 'APPRAISAL_OFFICER', 'SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA'].includes(role)
  const canDelete = ['SUPER_ADMIN', 'ADMIN', 'HOD', 'HOU', 'APPRAISAL_OFFICER'].includes(role)

  const [tab, setTab] = useState<'duties' | 'pending'>('duties')
  const [departments, setDepartments] = useState<any[]>([])
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<StaffLite[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<StaffLite | null>(null)
  const [duties, setDuties] = useState<DutyRow[]>([])
  const [loadingDuties, setLoadingDuties] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [reviewDuty, setReviewDuty] = useState<DutyRow | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [pendingDuties, setPendingDuties] = useState<DutyRow[]>([])
  const [loadingPending, setLoadingPending] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ===== Load departments =====
  useEffect(() => {
    fetch('/api/departments', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []))
      .catch(() => {})
  }, [])

  // ===== For STAFF users, auto-select their own staff record =====
  useEffect(() => {
    if (isStaff && user?.staffId && !selectedStaff) {
      fetch(`/api/staff/${user.staffId}`, { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : Promise.reject(r.status))
        .then((d) => {
          if (d?.staff) setSelectedStaff(d.staff as StaffLite)
        })
        .catch(() => {})
    }
  }, [isStaff, user, selectedStaff])

  // ===== Staff search (debounced) =====
  useEffect(() => {
    if (isStaff) return
    if (!search || search.length < 1) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    setSearchLoading(true)
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        if (search) params.set('q', search)
        if (deptFilter !== 'all') params.set('departmentId', deptFilter)
        const res = await fetch(`/api/staff?${params.toString()}`, { cache: 'no-store' })
        const data = await res.json()
        const list: StaffLite[] = (data.staff || []).slice(0, 50)
        setSearchResults(list)
        setSearchOpen(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [search, deptFilter, isStaff])

  // Close dropdown on outside click
  useEffect(() => {
    if (!searchOpen) return
    const onDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [searchOpen])

  // ===== Load duties for the selected staff =====
  const loadDuties = useCallback(async () => {
    if (!selectedStaff) {
      setDuties([])
      return
    }
    setLoadingDuties(true)
    try {
      const res = await fetch(`/api/duties?staffId=${selectedStaff.id}`, { cache: 'no-store' })
      const data = await res.json()
      // Sort by order asc
      const list = (data.duties || []) as DutyRow[]
      list.sort((a, b) => a.order - b.order)
      setDuties(list)
    } catch {
      setDuties([])
    } finally {
      setLoadingDuties(false)
    }
  }, [selectedStaff])

  useEffect(() => {
    if (tab === 'duties') loadDuties()
  }, [tab, loadDuties])

  // ===== Pending review duties =====
  const loadPending = useCallback(async () => {
    if (!canReview) return
    setLoadingPending(true)
    try {
      const res = await fetch('/api/duties?reviewed=pending', { cache: 'no-store' })
      const data = await res.json()
      setPendingDuties(data.duties || [])
    } catch {
      setPendingDuties([])
    } finally {
      setLoadingPending(false)
    }
  }, [canReview])

  useEffect(() => {
    if (tab === 'pending' && canReview) loadPending()
  }, [tab, canReview, loadPending])

  // ===== Mark overdue sweep on mount (best-effort) =====
  useEffect(() => {
    fetch('/api/duties/mark-overdue', { method: 'POST' }).catch(() => {})
  }, [])

  // ===== Update a duty (inline edit) =====
  const updateDuty = useCallback(async (id: string, patch: any) => {
    try {
      const res = await fetch(`/api/duties/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to update')
        return null
      }
      setDuties((prev) => prev.map((d) => (d.id === id ? { ...d, ...(data.duty || {}) } : d)))
      return data.duty
    } catch {
      toast.error('Network error')
      return null
    }
  }, [])

  const handleDelete = async (duty: DutyRow) => {
    if (!confirm(`Delete duty "${duty.title}"?`)) return
    try {
      const res = await fetch(`/api/duties/${duty.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete')
        return
      }
      toast.success('Duty deleted')
      setDuties((prev) => prev.filter((d) => d.id !== duty.id))
    } catch {
      toast.error('Network error')
    }
  }

  const handleUploadEvidence = async (duty: DutyRow, file: File, notes?: string) => {
    setUploadingFor(duty.id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (notes) fd.append('notes', notes)
      const res = await fetch(`/api/duties/${duty.id}/upload-evidence`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Upload failed')
        return
      }
      toast.success('Evidence uploaded — duty marked Completed')
      setDuties((prev) => prev.map((d) => (d.id === duty.id ? { ...d, ...(data.duty || {}) } : d)))
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingFor(null)
    }
  }

  const autoScoreUnscored = async () => {
    const unscored = duties.filter((d) => d.achievedScore == null)
    if (!unscored.length) {
      toast.info('No unscored duties')
      return
    }
    let ok = 0
    for (const d of unscored) {
      const newScore = Math.min(100, Math.max(50, Math.round((d.targetScore || 100) * 0.85)))
      const u = await updateDuty(d.id, { achievedScore: newScore })
      if (u) ok++
    }
    toast.success(`Auto-scored ${ok} unscored duties`)
  }

  const autoScoreAll = async () => {
    if (!duties.length) {
      toast.info('No duties')
      return
    }
    let ok = 0
    for (const d of duties) {
      const newScore = Math.min(100, Math.max(50, Math.round((d.targetScore || 100) * 0.85)))
      const u = await updateDuty(d.id, { achievedScore: newScore })
      if (u) ok++
    }
    toast.success(`Auto-scored ${ok} duties`)
  }

  const clearSelection = () => {
    if (isStaff) return
    setSelectedStaff(null)
    setSearch('')
    setSearchResults([])
    setSearchOpen(false)
    setDuties([])
  }

  // ===== Stats =====
  const total = duties.length
  const scoredCount = duties.filter((d) => d.achievedScore != null).length
  const unscoredCount = total - scoredCount
  const avg = scoredCount > 0
    ? duties.filter((d) => d.achievedScore != null).reduce((s, d) => s + (d.achievedScore || 0), 0) / scoredCount
    : 0

  // ===== Print =====
  const handlePrint = async () => {
    if (!selectedStaff) {
      toast.info('Select a staff member first')
      return
    }
    const institution = 'Federal University Teaching Hospital, Lafia'
    const subLine = 'HR & Performance Management System · Staff Duties Report'
    const html =
      printHeader(institution, subLine, selectedStaff.staffId, 'Staff Duties Report') +
      `
      <div class="section">
        <h3>Staff</h3>
        ${row('Name', selectedStaff.fullName)}
        ${row('Staff ID', selectedStaff.staffId)}
        ${row('Department', selectedStaff.department?.name || '—')}
        ${row('Unit', selectedStaff.unit?.name || '—')}
        ${row('IPPIS Number', selectedStaff.ippisNumber || '—')}
      </div>
      <div class="section">
        <h3>Performance Summary</h3>
        ${row('Total Duties', total)}
        ${row('Scored', scoredCount)}
        ${row('Unscored', unscoredCount)}
        ${row('Average Score', `${avg.toFixed(1)}%`)}
      </div>
      <div class="section">
        <h3>Duties</h3>
        <table>
          <thead>
            <tr><th>#</th><th>Description</th><th>Type</th><th>Start</th><th>Due</th><th>Status</th><th>Score</th><th>Grade</th></tr>
          </thead>
          <tbody>
            ${duties.map((d, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${htmlEscape(d.title)}</td>
                <td>${htmlEscape(d.type || '—')}</td>
                <td>${d.startDate ? formatDate(d.startDate) : '—'}</td>
                <td>${d.dueDate ? formatDate(d.dueDate) : '—'}</td>
                <td>${htmlEscape(d.status)}</td>
                <td>${d.achievedScore != null ? d.achievedScore : '—'}</td>
                <td>${d.grade || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      `
    await printHTML(html, `Duties — ${selectedStaff.fullName}`)
  }

  const handleExport = () => {
    if (!duties.length) {
      toast.info('No duties to export')
      return
    }
    const rows = duties.map((d, i) => ({
      '#': i + 1,
      'Title': d.title,
      'Description': d.description || '',
      'Type': d.type,
      'Order': d.order,
      'Start Date': d.startDate ? formatDate(d.startDate) : '',
      'Due Date': d.dueDate ? formatDate(d.dueDate) : '',
      'Status': d.status,
      'Target Score': d.targetScore,
      'Achieved Score': d.achievedScore ?? '',
      'Grade': d.grade || '',
      'Evidence': d.evidenceFileName || '',
      'Reviewer': d.reviewedByName || '',
      'Reviewed At': d.reviewedAt ? formatDate(d.reviewedAt) : '',
      'Review Remarks': d.reviewRemarks || '',
      'Period': d.period || '',
      'Created At': d.id ? '' : '',
    }))
    exportToExcel(`FUTH_Duties_${selectedStaff?.fullName || 'All'}`.replace(/\s+/g, '_'),
      [{ name: 'Duties', rows }])
    toast.success(`Exported ${rows.length} duties`)
  }

  const nextOrder = useMemo(() => {
    if (!duties.length) return 1
    return Math.max(...duties.map((d) => d.order || 0)) + 1
  }, [duties])

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="size-6 text-[#14532d]" /> Duties
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Federal University Teaching Hospital, Lafia · Manage staff duties, evidence uploads, and reviews
          </p>
        </div>
      </div>

      {/* Tabs — only for reviewers */}
      {canReview && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'duties' | 'pending')}>
          <TabsList>
            <TabsTrigger value="duties" className="text-xs">
              <ListChecks className="size-3.5 mr-1" /> Staff Duties
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">
              <ClipboardCheck className="size-3.5 mr-1" /> Pending My Review
              {pendingDuties.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                  {pendingDuties.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {tab === 'duties' && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b bg-muted/30">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTodo className="size-4 text-[#14532d]" /> Staff Duties — Edit & Score
              </CardTitle>
              <CardDescription className="text-xs">
                Select a staff member to view, edit, score, or add duties
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-[#14532d] text-[#14532d] hover:bg-[#14532d]/10"
              onClick={handlePrint}
              disabled={!selectedStaff}
            >
              <Printer className="size-4" /> Print
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {/* Control bar */}
            {!isStaff && (
              <div className="px-4 py-4 border-b bg-white space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Filter by Department</Label>
                    <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v); setSearch(''); }}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2 relative">
                    <Label className="text-xs">Search Staff</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      <Input
                        ref={searchRef}
                        placeholder="Type staff name, ID, or IPPIS number..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setSearchOpen(true) }}
                        onFocus={() => { if (searchResults.length) setSearchOpen(true) }}
                        className="pl-9"
                      />
                      {searchLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                      )}
                      {searchOpen && searchResults.length > 0 && (
                        <div
                          ref={dropdownRef}
                          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-white shadow-lg"
                        >
                          {searchResults.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSelectedStaff(s)
                                setSearch('')
                                setSearchResults([])
                                setSearchOpen(false)
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 border-b last:border-0 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-medium">{s.fullName}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {s.staffId} · {s.department?.name || '—'}
                                  {s.ippisNumber ? ` · IPPIS ${s.ippisNumber}` : ''}
                                </div>
                              </div>
                              <ChevronRight className="size-4 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      )}
                      {searchOpen && !searchLoading && searchResults.length === 0 && search.length > 0 && (
                        <div
                          ref={dropdownRef}
                          className="absolute z-30 mt-1 w-full rounded-md border bg-white shadow-lg p-4 text-sm text-muted-foreground"
                        >
                          No staff found matching "{search}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {(selectedStaff || search) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    className="w-full sm:w-auto"
                  >
                    <X className="size-4" /> Clear Selection
                  </Button>
                )}
              </div>
            )}

            {/* Empty state OR selected staff view */}
            {!selectedStaff ? (
              <div className="px-4 py-16 text-center">
                <ListTodo className="size-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-base font-medium text-muted-foreground">
                  Select a staff member above to view and edit their duties
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Search by name, staff ID, or IPPIS number. Filter by department first to narrow results.
                </p>
              </div>
            ) : loadingDuties ? (
              <div className="px-4 py-6 space-y-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-10" />
                <Skeleton className="h-64" />
              </div>
            ) : (
              <>
                {/* Blue staff summary card */}
                <div className="mx-4 mt-4 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-blue-900">{selectedStaff.fullName}</div>
                    <div className="text-xs text-blue-800/80 mt-0.5">
                      {selectedStaff.staffId} · {selectedStaff.department?.name || '—'}
                      {selectedStaff.ippisNumber ? ` · IPPIS ${selectedStaff.ippisNumber}` : ' · IPPIS —'}
                      {selectedStaff.unit?.name ? ` · Unit: ${selectedStaff.unit.name}` : ''}
                    </div>
                  </div>
                  <div className="rounded-md bg-blue-600/15 border border-blue-300 px-3 py-2 text-xs text-blue-900 font-medium">
                    Duties: {total} | Scored: {scoredCount} | Avg: {avg.toFixed(0)}%
                  </div>
                </div>

                {/* Performance summary bar */}
                <div className="mx-4 mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <SummaryTile icon={<ListTodo className="size-4 text-blue-600" />} label="Total" value={String(total)} />
                  <SummaryTile icon={<CheckCircle2 className="size-4 text-emerald-600" />} label="Scored" value={String(scoredCount)} />
                  <SummaryTile icon={<AlertTriangle className="size-4 text-yellow-600" />} label="Unscored" value={String(unscoredCount)} />
                  <SummaryTile icon={<TrendingUp className="size-4 text-blue-600" />} label="Avg Score" value={`${avg.toFixed(1)}%`} />
                </div>

                {/* Action buttons */}
                <div className="mx-4 mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                    onClick={autoScoreUnscored}
                    disabled={!duties.length}
                  >
                    <Pencil className="size-3.5" /> Auto Score Unsored
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-gray-400 text-gray-600 hover:bg-gray-50"
                    onClick={autoScoreAll}
                    disabled={!duties.length}
                  >
                    <Pencil className="size-3.5" /> Auto Score All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={!duties.length}
                  >
                    <Download className="size-3.5" /> Export
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus className="size-3.5" /> Add Duty
                  </Button>
                </div>

                {/* Duties table */}
                <div className="mt-4 overflow-x-auto border-t">
                  <DutiesTable
                    duties={duties}
                    role={role}
                    canDelete={canDelete}
                    canReview={canReview}
                    uploadingFor={uploadingFor}
                    onUpdate={updateDuty}
                    onDelete={handleDelete}
                    onUploadEvidence={handleUploadEvidence}
                    onReview={(d) => { setReviewDuty(d); setReviewOpen(true) }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'pending' && canReview && (
        <PendingReviewPanel
          duties={pendingDuties}
          loading={loadingPending}
          onReview={(d) => { setReviewDuty(d); setReviewOpen(true) }}
          onOpenStaff={(s) => {
            setSelectedStaff(s)
            setTab('duties')
          }}
        />
      )}

      {/* Add Duty modal */}
      <AddDutyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        staff={selectedStaff}
        nextOrder={nextOrder}
        onSaved={() => { setCreateOpen(false); loadDuties() }}
      />

      {/* Review modal */}
      <ReviewDialog
        open={reviewOpen}
        onClose={() => { setReviewOpen(false); setReviewDuty(null) }}
        duty={reviewDuty}
        onReviewed={() => {
          setReviewOpen(false)
          setReviewDuty(null)
          loadDuties()
          loadPending()
        }}
      />
    </div>
  )
}

// ===== Summary Tile =====
function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border bg-white px-3 py-2 flex items-center gap-2">
      {icon}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  )
}

// ===== Duties Table =====
function DutiesTable({
  duties, role, canDelete, canReview, uploadingFor,
  onUpdate, onDelete, onUploadEvidence, onReview,
}: {
  duties: DutyRow[]
  role: string
  canDelete: boolean
  canReview: boolean
  uploadingFor: string | null
  onUpdate: (id: string, patch: any) => Promise<any>
  onDelete: (d: DutyRow) => void
  onUploadEvidence: (d: DutyRow, file: File) => void
  onReview: (d: DutyRow) => void
}) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  if (!duties.length) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        No duties yet. Click &quot;Add Duty&quot; to create one.
      </div>
    )
  }
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-white z-10">
        <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b">
          <th className="text-left px-2 py-2 w-10">#</th>
          <th className="text-left px-2 py-2 min-w-[260px]">Description</th>
          <th className="text-left px-2 py-2 w-32">Type</th>
          <th className="text-center px-2 py-2 w-16">Order</th>
          <th className="text-left px-2 py-2 w-32">Start Date</th>
          <th className="text-left px-2 py-2 w-32">Due Date</th>
          <th className="text-left px-2 py-2 w-36">Status</th>
          <th className="text-center px-2 py-2 w-32">Score</th>
          <th className="text-center px-2 py-2 w-28">Evidence</th>
          <th className="text-right px-2 py-2 w-32">Actions</th>
        </tr>
      </thead>
      <tbody>
        {duties.map((d, idx) => {
          const overdue = isDutyOverdue(d)
          return (
            <tr key={d.id} className={`border-b last:border-0 hover:bg-muted/30 ${overdue ? 'bg-red-50/40' : ''}`}>
              <td className="px-2 py-2 text-muted-foreground">{idx + 1}</td>
              {/* DESCRIPTION (editable inline) */}
              <td className="px-2 py-2">
                <EditableTitle
                  value={d.title}
                  onCommit={(v) => onUpdate(d.id, { title: v })}
                />
                {d.description && (
                  <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{d.description}</div>
                )}
              </td>
              {/* TYPE */}
              <td className="px-2 py-2">
                <Select value={d.type || 'Primary'} onValueChange={(v) => onUpdate(d.id, { type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
              {/* ORDER */}
              <td className="px-2 py-2 text-center">
                <Input
                  type="number"
                  value={d.order || 1}
                  onChange={(e) => onUpdate(d.id, { order: Number(e.target.value) || 1 })}
                  className="h-8 w-14 text-center text-xs"
                />
              </td>
              {/* START DATE */}
              <td className="px-2 py-2">
                <input
                  type="date"
                  value={d.startDate ? new Date(d.startDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) => onUpdate(d.id, { startDate: e.target.value || null })}
                  className="h-8 w-full text-xs rounded border bg-white px-2"
                />
              </td>
              {/* DUE DATE (red if overdue) */}
              <td className="px-2 py-2">
                <input
                  type="date"
                  value={d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : ''}
                  onChange={(e) => onUpdate(d.id, { dueDate: e.target.value || null })}
                  className={`h-8 w-full text-xs rounded border bg-white px-2 ${overdue ? 'border-red-400 text-red-700 font-medium' : ''}`}
                />
                {overdue && (
                  <div className="text-[10px] text-red-700 mt-0.5 flex items-center gap-1">
                    <AlertTriangle className="size-3" /> Overdue
                  </div>
                )}
              </td>
              {/* STATUS */}
              <td className="px-2 py-2">
                <Select value={d.status} onValueChange={(v) => onUpdate(d.id, { status: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
              {/* SCORE (with vertical green progress bar) */}
              <td className="px-2 py-2">
                <div className="flex items-stretch gap-2">
                  <Input
                    type="number"
                    value={d.achievedScore != null ? d.achievedScore : ''}
                    placeholder="—"
                    onChange={(e) => {
                      const v = e.target.value
                      onUpdate(d.id, { achievedScore: v === '' ? null : Math.min(100, Math.max(0, Number(v))) })
                    }}
                    className={`h-8 w-16 text-center text-xs ${scoreTextClass(d.achievedScore)}`}
                  />
                  <div className="w-2 min-h-[32px] rounded bg-gray-100 overflow-hidden flex flex-col-reverse">
                    <div
                      className={`w-full transition-all ${scoreBarClass(d.achievedScore)}`}
                      style={{ height: `${Math.min(100, Math.max(0, d.achievedScore || 0))}%` }}
                    />
                  </div>
                  {d.grade && (
                    <Badge className={`text-[10px] h-6 px-1.5 ${gradeColor[d.grade] || ''} border`} title={`Grade: ${d.grade}`}>
                      {d.grade}
                    </Badge>
                  )}
                </div>
              </td>
              {/* EVIDENCE */}
              <td className="px-2 py-2 text-center">
                {d.evidenceUrl ? (
                  <a
                    href={d.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
                    title={d.evidenceFileName || 'View evidence'}
                  >
                    <Eye className="size-3.5" /> View
                  </a>
                ) : (
                  <>
                    <input
                      ref={(el) => { fileInputRefs.current[d.id] = el }}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.zip"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) onUploadEvidence(d, f)
                        e.target.value = ''
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      disabled={uploadingFor === d.id}
                      onClick={() => fileInputRefs.current[d.id]?.click()}
                    >
                      {uploadingFor === d.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Upload className="size-3" />
                      )}
                      Upload
                    </Button>
                  </>
                )}
              </td>
              {/* ACTIONS */}
              <td className="px-2 py-2 text-right">
                <div className="flex justify-end gap-1">
                  {canReview && d.status === 'Completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px] border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => onReview(d)}
                      title="Review this duty"
                    >
                      <ClipboardCheck className="size-3" /> Review
                    </Button>
                  )}
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); /* edit hint */ }}
                    className="inline-flex items-center justify-center h-7 w-7 rounded border text-muted-foreground hover:bg-muted cursor-default"
                    title="Inline edit (just click fields above)"
                  >
                    <Pencil className="size-3" />
                  </a>
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(d)}
                      title="Delete"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
                {d.reviewedByName && (
                  <div className="text-[10px] text-muted-foreground mt-1" title={d.reviewRemarks || ''}>
                    by {d.reviewedByName}
                  </div>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ===== Editable title (commit on blur / Enter) =====
function EditableTitle({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  const commit = () => {
    const v = draft.trim()
    if (v && v !== value) onCommit(v)
    else setDraft(value)
  }
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() } }}
      className="h-8 text-sm font-medium"
    />
  )
}

// ===== Add Duty Dialog =====
function AddDutyDialog({
  open, onClose, staff, nextOrder, onSaved,
}: {
  open: boolean
  onClose: () => void
  staff: StaffLite | null
  nextOrder: number
  onSaved: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10)
  const [form, setForm] = useState<any>({
    title: '', description: '', type: 'Primary',
    order: nextOrder, startDate: today, dueDate: in30,
    targetScore: 100, achievedScore: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        title: '', description: '', type: 'Primary',
        order: nextOrder, startDate: today, dueDate: in30,
        targetScore: 100, achievedScore: '',
      })
    }
     
  }, [open, nextOrder])

  if (!staff) return null

  const save = async () => {
    if (!form.title.trim()) { toast.error('Duty title is required'); return }
    setSaving(true)
    try {
      const payload: any = {
        staffId: staff.id,
        title: form.title.trim(),
        description: form.description || null,
        type: form.type,
        order: Number(form.order) || nextOrder,
        startDate: form.startDate || null,
        dueDate: form.dueDate || null,
        targetScore: Number(form.targetScore) || 100,
      }
      if (form.achievedScore !== '' && form.achievedScore != null) {
        payload.achievedScore = Number(form.achievedScore)
      }
      const res = await fetch('/api/duties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to create'); return }
      toast.success('Duty created')
      onSaved()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Duty for {staff.fullName}</DialogTitle>
          <DialogDescription>Create a new duty record. Status defaults to &quot;Assigned&quot;.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Q4 ICT Audit Report" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Order</Label>
              <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Target Score</Label>
              <Input type="number" value={form.targetScore} onChange={(e) => setForm({ ...form, targetScore: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Achieved Score (optional)</Label>
              <Input type="number" value={form.achievedScore} onChange={(e) => setForm({ ...form, achievedScore: e.target.value })} placeholder="—" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Duration days are auto-computed from start and due dates. Grade is auto-computed from the achieved score.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving && <Loader2 className="size-4 animate-spin" />} Create Duty
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Review Dialog =====
function ReviewDialog({
  open, onClose, duty, onReviewed,
}: {
  open: boolean
  onClose: () => void
  duty: DutyRow | null
  onReviewed: () => void
}) {
  const [score, setScore] = useState('')
  const [remarks, setRemarks] = useState('')
  const [decision, setDecision] = useState<'approve' | 'reject'>('approve')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && duty) {
      setScore(duty.achievedScore != null ? String(duty.achievedScore) : '')
      setRemarks(duty.reviewRemarks || '')
      setDecision(duty.status === 'Rejected' ? 'reject' : 'approve')
    }
  }, [open, duty])

  if (!duty) return null

  const submit = async () => {
    if (score === '' || isNaN(Number(score))) {
      toast.error('Enter a valid score 0-100')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/duties/${duty.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievedScore: Number(score),
          remarks: remarks.trim() || null,
          decision,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to review'); return }
      toast.success(`Duty ${data.duty?.status === 'Approved' ? 'approved' : 'rejected'}`)
      onReviewed()
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  const grade = (() => {
    const n = Number(score)
    if (isNaN(n)) return null
    if (n >= 90) return 'A+'
    if (n >= 80) return 'A'
    if (n >= 70) return 'B'
    if (n >= 60) return 'C'
    if (n >= 50) return 'D'
    return 'F'
  })()

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Review Duty</DialogTitle>
          <DialogDescription>
            {duty.staff?.fullName || 'Staff'} · {duty.title}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded border bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground mb-1">Duty</div>
            <div className="font-medium">{duty.title}</div>
            {duty.description && <div className="text-xs text-muted-foreground mt-1">{duty.description}</div>}
            <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              <span>Status: <Badge className={`${statusColor[duty.status] || ''} border`}>{duty.status}</Badge></span>
              <span>Target: {duty.targetScore}</span>
              <span>Due: {duty.dueDate ? formatDate(duty.dueDate) : '—'}</span>
              {duty.evidenceUrl && (
                <a href={duty.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="size-3" /> Evidence
                </a>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Achieved Score (0-100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </div>
            <div>
              <Label>Grade (auto)</Label>
              <div className="h-9 flex items-center">
                {grade ? (
                  <Badge className={`${gradeColor[grade]} border`} >{grade}</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Enter score to compute</span>
                )}
              </div>
            </div>
          </div>
          <div>
            <Label>Decision</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as 'approve' | 'reject')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Review notes (optional)" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            On submit, the duty&apos;s status will change to {decision === 'approve' ? 'Approved' : 'Rejected'},
            and the reviewer will be recorded as you.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={saving}
            className={decision === 'approve'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-rose-600 hover:bg-rose-700 text-white'}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            {decision === 'approve' ? <CheckCircle2 className="size-4" /> : <X className="size-4" />}
            {decision === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ===== Pending Review Panel =====
function PendingReviewPanel({
  duties, loading, onReview, onOpenStaff,
}: {
  duties: DutyRow[]
  loading: boolean
  onReview: (d: DutyRow) => void
  onOpenStaff: (s: StaffLite) => void
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4"><Skeleton className="h-64" /></CardContent>
      </Card>
    )
  }
  if (!duties.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-sm text-muted-foreground">
          <ClipboardCheck className="size-10 text-muted-foreground/40 mx-auto mb-2" />
          No duties awaiting your review. Duties with status &quot;Completed&quot; will appear here.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                <th className="text-left px-4 py-2">Staff</th>
                <th className="text-left px-4 py-2">Duty</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Department / Unit</th>
                <th className="text-left px-4 py-2">Due Date</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2 hidden md:table-cell">Evidence</th>
                <th className="text-right px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {duties.map((d) => {
                const overdue = isDutyOverdue(d)
                return (
                  <tr key={d.id} className={`border-b last:border-0 hover:bg-muted/40 ${overdue ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenStaff(d.staff as StaffLite)}
                        className="text-left hover:underline"
                      >
                        <div className="font-medium">{d.staff?.fullName || '—'}</div>
                        <div className="text-[11px] text-muted-foreground">{d.staff?.staffId || ''}</div>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.title}</div>
                      {d.description && <div className="text-[11px] text-muted-foreground line-clamp-1">{d.description}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                      {d.staff?.department?.name || '—'}
                      {d.staff?.unit?.name ? <div className="text-[11px]">{d.staff.unit.name}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={overdue ? 'text-red-700 font-medium' : ''}>
                        {d.dueDate ? formatDate(d.dueDate) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusColor[d.status] || ''} border`}>{d.status}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {d.evidenceUrl ? (
                        <a href={d.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1 text-xs">
                          <Eye className="size-3.5" /> View
                        </a>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => onReview(d)}
                      >
                        <ClipboardCheck className="size-3.5" /> Review
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
