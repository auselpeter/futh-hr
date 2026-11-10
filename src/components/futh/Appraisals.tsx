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
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { ClipboardList, Plus, Search, Loader2, FileSignature, Calendar, Award, FileText, ListTodo, CheckCircle2, Printer, Download, Eye, Edit, Trash2, Upload, Check, X, Clock, AlertCircle, Send } from 'lucide-react'
import { formatDate } from '@/lib/formatters'
import { toast } from 'sonner'
import FileUpload from './FileUpload'
import StaffSearch from './StaffSearch'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, signatureBox, formatDateForPrint, htmlEscape, row } from '@/lib/print'

type TabKey = 'annual' | 'monthly' | 'quarterly' | 'assessment' | 'appraisal' | 'duties'

const statusColor: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-blue-100 text-blue-700',
  'HOD Signed': 'bg-amber-100 text-amber-700',
  'DA Signed': 'bg-violet-100 text-violet-700',
  Completed: 'bg-green-100 text-green-700',
  Acknowledged: 'bg-sky-100 text-sky-700',
  Signed: 'bg-emerald-100 text-emerald-700',
  Reviewed: 'bg-cyan-100 text-cyan-700',
}

const verdictColor: Record<string, string> = {
  Outstanding: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Excellent: 'bg-green-100 text-green-700 border-green-200',
  'Very Good': 'bg-lime-100 text-lime-700 border-lime-200',
  Good: 'bg-amber-100 text-amber-700 border-amber-200',
  Satisfactory: 'bg-orange-100 text-orange-700 border-orange-200',
  Poor: 'bg-red-100 text-red-700 border-red-200',
}

const gradeColor: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-700',
  A: 'bg-green-100 text-green-700',
  B: 'bg-amber-100 text-amber-700',
  C: 'bg-orange-100 text-orange-700',
  D: 'bg-rose-100 text-rose-700',
  F: 'bg-red-100 text-red-700',
}

type Props = {
  user: any
  onNavigate?: (v: any) => void
}

export default function Appraisals({ user }: Props) {
  const [tab, setTab] = useState<TabKey>('annual')
  const [staff, setStaff] = useState<any[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [staffFilter, setStaffFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [detail, setDetail] = useState<any | null>(null)

  // Only HOD, HOU, APPRAISAL_OFFICER, SUPER_ADMIN, and ADMIN can assign/create duties.
  // STAFF can only view their duties and upload evidence of completion.
  const role = user?.activeRole || user?.role || 'STAFF'
  const designationCode = user?.designation?.code || ''
  const canManageDuties =
    ['SUPER_ADMIN', 'ADMIN', 'HOD', 'HOU', 'APPRAISAL_OFFICER'].includes(role) ||
    designationCode === 'PLANNING_OFFICER'
  // For the duties tab specifically: only managers can create; staff can only view + upload evidence
  const canCreateForTab = (t: TabKey): boolean => {
    if (t === 'duties') return canManageDuties
    // Other tabs (annual/monthly/quarterly/assessment/appraisal) — appraisal officers + admins + HOD
    return ['SUPER_ADMIN', 'ADMIN', 'HOD', 'HOU', 'APPRAISAL_OFFICER'].includes(role)
  }

  // Load staff list once
  useEffect(() => {
    fetch('/api/staff', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setStaff(d.staff || []))
      .catch(() => toast.error('Failed to load staff'))
      .finally(() => setLoadingStaff(false))
  }, [])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (staffFilter !== 'all') params.set('staffId', staffFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      let endpoint = '/api/annual-reviews'
      if (tab === 'monthly') endpoint = '/api/monthly-appraisals'
      else if (tab === 'quarterly') endpoint = '/api/quarterly-reviews'
      else if (tab === 'assessment') endpoint = '/api/assessments'
      else if (tab === 'appraisal') endpoint = '/api/appraisals'
      else if (tab === 'duties') endpoint = '/api/duties'
      const res = await fetch(`${endpoint}?${params.toString()}`, { cache: 'no-store' })
      const data = await res.json()
      const key =
        tab === 'annual' ? 'reviews' :
        tab === 'monthly' ? 'appraisals' :
        tab === 'quarterly' ? 'reviews' :
        tab === 'assessment' ? 'assessments' :
        tab === 'appraisal' ? 'appraisals' : 'duties'
      let list = data[key] || []
      if (search) {
        const q = search.toLowerCase()
        list = list.filter((it: any) =>
          (it.staff?.fullName || '').toLowerCase().includes(q) ||
          (it.period || '').toLowerCase().includes(q) ||
          (it.title || '').toLowerCase().includes(q)
        )
      }
      setItems(list)
    } catch {
      toast.error('Failed to load records')
      setItems([])
    }
    setLoading(false)
  }, [tab, staffFilter, statusFilter, search])

  useEffect(() => { loadItems() }, [loadItems])

  const statuses = (t: TabKey): string[] => {
    if (t === 'annual') return ['Draft', 'Submitted', 'HOD Signed', 'DA Signed', 'Completed']
    if (t === 'monthly') return ['Draft', 'Submitted', 'Acknowledged', 'Signed']
    if (t === 'quarterly') return ['Draft', 'Submitted', 'Completed']
    if (t === 'assessment') return ['Draft', 'Submitted', 'Reviewed']
    if (t === 'appraisal') return ['Draft', 'Submitted', 'Reviewed']
    return []
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="size-6" /> Appraisals & Reviews
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Annual reviews, monthly/quarterly appraisals, assessments, duties
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="annual" className="text-xs"><Award className="size-3.5 mr-1" />Annual Reviews</TabsTrigger>
          <TabsTrigger value="monthly" className="text-xs"><Calendar className="size-3.5 mr-1" />Monthly</TabsTrigger>
          <TabsTrigger value="quarterly" className="text-xs"><FileText className="size-3.5 mr-1" />Quarterly</TabsTrigger>
          <TabsTrigger value="assessment" className="text-xs"><ListTodo className="size-3.5 mr-1" />Assessments</TabsTrigger>
          <TabsTrigger value="appraisal" className="text-xs"><Award className="size-3.5 mr-1" />Appraisals</TabsTrigger>
          <TabsTrigger value="duties" className="text-xs"><CheckCircle2 className="size-3.5 mr-1" />Duties</TabsTrigger>
        </TabsList>

        <Card className="mt-3">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search by staff, period..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <StaffSearch
                staff={staff}
                value={staffFilter === 'all' ? '' : staffFilter}
                onChange={(v) => setStaffFilter(v || 'all')}
                allowClear
                placeholder="All Staff"
                className="w-64"
              />
              {tab !== 'duties' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statuses(tab).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const rows = items.map((it: any) => ({
                    'Staff': it.staff?.fullName || '',
                    'Period': it.period,
                    ...(tab === 'annual' ? {
                      'Assessment Score': it.assessmentScore,
                      'Monthly Score': it.monthlyScore,
                      'Quarterly Score': it.quarterlyScore,
                      'Appraisal Score': it.appraisalScore,
                      'Duty Score': it.dutyScore,
                      'Overall Score': it.overallScore,
                      'Verdict': it.verdict,
                    } : tab === 'monthly' ? {
                      'Score': it.score,
                      'Grade': it.grade,
                    } : tab === 'quarterly' ? {
                      'Average Score': it.averageScore,
                      'Grade': it.grade,
                    } : tab === 'assessment' ? {
                      'Knowledge': it.knowledgeScore,
                      'Skills': it.skillsScore,
                      'Attitude': it.attitudeScore,
                      'Communication': it.communicationScore,
                      'Total': it.totalScore,
                      'Grade': it.grade,
                    } : tab === 'appraisal' ? {
                      'Performance': it.performanceScore,
                      'Achievement': it.achievementScore,
                      'Competency': it.competencyScore,
                      'Total': it.totalScore,
                      'Grade': it.grade,
                    } : {
                      'Title': it.title,
                      'Target': it.targetScore,
                      'Achieved': it.achievedScore,
                      'Grade': it.grade,
                    }),
                    'Status': it.status,
                    'Created At': it.createdAt ? new Date(it.createdAt).toLocaleString() : '',
                  }))
                  const sheetName = tab === 'annual' ? 'Annual Reviews'
                    : tab === 'monthly' ? 'Monthly Appraisals'
                    : tab === 'quarterly' ? 'Quarterly Reviews'
                    : tab === 'assessment' ? 'Assessments'
                    : tab === 'appraisal' ? 'Appraisals' : 'Duties'
                  exportToExcel(`FUTH_${sheetName.replace(/\s+/g, '_')}`, [{ name: sheetName, rows }])
                  toast.success(`Exported ${rows.length} ${sheetName}`)
                }}
                disabled={!items.length}
              >
                <Download className="size-4" /> Export to Excel
              </Button>
              <Button size="sm" onClick={() => { setEditing(null); setCreating(true) }} disabled={!canCreateForTab(tab)}>
                <Plus className="size-4" /> {tabLabel(tab)}
              </Button>
              {tab === 'duties' && !canManageDuties && (
                <span className="text-xs text-muted-foreground ml-2">
                  You can view your duties and upload evidence of completion. Only HOD, HOU, or Appraisal Officer can assign duties.
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <TabsContent value="annual" className="mt-3"><ListPanel tab={tab} items={items} loading={loading || loadingStaff} onRowClick={(r) => setDetail(r)} /></TabsContent>
        <TabsContent value="monthly" className="mt-3"><ListPanel tab={tab} items={items} loading={loading || loadingStaff} onRowClick={(r) => setDetail(r)} /></TabsContent>
        <TabsContent value="quarterly" className="mt-3"><ListPanel tab={tab} items={items} loading={loading || loadingStaff} onRowClick={(r) => setDetail(r)} /></TabsContent>
        <TabsContent value="assessment" className="mt-3"><ListPanel tab={tab} items={items} loading={loading || loadingStaff} onRowClick={(r) => setDetail(r)} /></TabsContent>
        <TabsContent value="appraisal" className="mt-3"><ListPanel tab={tab} items={items} loading={loading || loadingStaff} onRowClick={(r) => setDetail(r)} /></TabsContent>
        <TabsContent value="duties" className="mt-3"><ListPanel tab={tab} items={items} loading={loading || loadingStaff} onRowClick={(r) => setDetail(r)} /></TabsContent>
      </Tabs>

      {/* Create/Edit modal */}
      <CreateModal
        tab={tab}
        open={creating}
        onClose={() => setCreating(false)}
        staff={staff}
        onSaved={() => { setCreating(false); loadItems() }}
      />

      {/* Detail Sheet */}
      <DetailSheet
        tab={tab}
        item={detail}
        onClose={() => setDetail(null)}
        user={user}
        onAction={loadItems}
      />
    </div>
  )
}

function tabLabel(t: TabKey): string {
  if (t === 'annual') return 'New Annual Review'
  if (t === 'monthly') return 'New Monthly Appraisal'
  if (t === 'quarterly') return 'New Quarterly Review'
  if (t === 'assessment') return 'New Assessment'
  if (t === 'appraisal') return 'New Appraisal'
  return 'New Duty'
}

function ListPanel({ tab, items, loading, onRowClick }: { tab: TabKey; items: any[]; loading: boolean; onRowClick: (r: any) => void }) {
  if (loading) return <Card><CardContent className="p-4"><Skeleton className="h-12" /></CardContent></Card>
  if (!items.length) return <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No records yet. Click the create button to add one.</CardContent></Card>

  if (tab === 'duties') {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground border-b bg-muted/30">
                  <th className="text-center px-2 py-3 w-8">#</th>
                  <th className="text-left px-3 py-3">Description</th>
                  <th className="text-left px-3 py-3">Type</th>
                  <th className="text-center px-3 py-3">Order</th>
                  <th className="text-center px-3 py-3 hidden md:table-cell">Start</th>
                  <th className="text-center px-3 py-3 hidden md:table-cell">Due</th>
                  <th className="text-center px-3 py-3">Status</th>
                  <th className="text-center px-3 py-3">Score</th>
                  <th className="text-center px-3 py-3">Grade</th>
                  <th className="text-left px-3 py-3 hidden lg:table-cell">Rating</th>
                  <th className="text-center px-2 py-3">Evidence</th>
                  <th className="text-center px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d: any, i: number) => {
                  const isOverdue = d.dueDate && new Date(d.dueDate) < new Date() && !['Completed', 'Approved'].includes(d.status)
                  const status = isOverdue ? 'Overdue' : d.status
                  return (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="text-center px-2 py-3 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium cursor-pointer" onClick={() => onRowClick(d)}>{d.title}</div>
                        {d.description && <div className="text-xs text-muted-foreground line-clamp-1">{d.description}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="text-[10px]">{d.type || 'Primary'}</Badge>
                      </td>
                      <td className="text-center px-3 py-3 text-muted-foreground">{d.order || 1}</td>
                      <td className="text-center px-3 py-3 hidden md:table-cell text-xs">{d.startDate ? formatDate(d.startDate) : '—'}</td>
                      <td className="text-center px-3 py-3 hidden md:table-cell text-xs">
                        {d.dueDate ? (
                          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{formatDate(d.dueDate)}</span>
                        ) : '—'}
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          status === 'Overdue' ? 'bg-red-100 text-red-700' :
                          status === 'Completed' ? 'bg-green-100 text-green-700' :
                          status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                          status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                          status === 'Rejected' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>{status}</span>
                      </td>
                      <td className="text-center px-3 py-3">
                        {d.achievedScore != null ? (
                          <span className="font-mono font-semibold text-green-600">{d.achievedScore}</span>
                        ) : '—'}
                      </td>
                      <td className="text-center px-3 py-3">
                        {d.grade ? <Badge className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          d.grade === 'A+' ? 'bg-emerald-500 text-white' :
                          d.grade === 'A' ? 'bg-green-500 text-white' :
                          d.grade === 'B' ? 'bg-blue-500 text-white' :
                          d.grade === 'C' ? 'bg-amber-500 text-white' :
                          d.grade === 'D' ? 'bg-orange-500 text-white' :
                          'bg-red-500 text-white'
                        }`}>{d.grade}</Badge> : '—'}
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell text-xs">
                        {d.rating ? <span className={`font-medium ${
                          d.rating === 'Outstanding' ? 'text-emerald-600' :
                          d.rating === 'Excellent' ? 'text-green-600' :
                          d.rating === 'Very Good' ? 'text-lime-600' :
                          d.rating === 'Good' ? 'text-amber-600' :
                          d.rating === 'Satisfactory' ? 'text-orange-600' :
                          'text-red-600'
                        }`}>{d.rating}</span> : '—'}
                      </td>
                      <td className="text-center px-2 py-3">
                        {d.evidenceUrl ? (
                          <a href={d.evidenceUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs">View</a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-center px-2 py-3">
                        <button onClick={() => onRowClick(d)} className="text-blue-500 hover:bg-blue-50 rounded p-1" title="View">
                          <Eye className="size-3.5" />
                        </button>
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

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted-foreground border-b">
                <th className="text-left px-4 py-3">Staff</th>
                <th className="text-left px-4 py-3">Period</th>
                {tab === 'annual' && <th className="text-center px-4 py-3">Overall</th>}
                {tab === 'monthly' && <th className="text-center px-4 py-3">Score</th>}
                {tab === 'quarterly' && <th className="text-center px-4 py-3">Avg Score</th>}
                {tab === 'assessment' && <th className="text-center px-4 py-3">Total</th>}
                {tab === 'appraisal' && <th className="text-center px-4 py-3">Total</th>}
                <th className="text-center px-4 py-3">Grade / Verdict</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r: any) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => onRowClick(r)}>
                  <td className="px-4 py-3 font-medium">{r.staff?.fullName || '—'}</td>
                  <td className="px-4 py-3">{r.period}</td>
                  {tab === 'annual' && <td className="px-4 py-3 text-center">{r.overallScore?.toFixed?.(1) ?? '—'}</td>}
                  {tab === 'monthly' && <td className="px-4 py-3 text-center">{r.score?.toFixed?.(1) ?? '—'}</td>}
                  {tab === 'quarterly' && <td className="px-4 py-3 text-center">{r.averageScore?.toFixed?.(1) ?? '—'}</td>}
                  {tab === 'assessment' && <td className="px-4 py-3 text-center">{r.totalScore?.toFixed?.(1) ?? '—'}</td>}
                  {tab === 'appraisal' && <td className="px-4 py-3 text-center">{r.totalScore?.toFixed?.(1) ?? '—'}</td>}
                  <td className="px-4 py-3 text-center">
                    {r.verdict ? <Badge className={`${verdictColor[r.verdict] || ''} border`}>{r.verdict}</Badge> :
                      r.grade ? <Badge className={`${gradeColor[r.grade] || ''} border`}>{r.grade}</Badge> : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor[r.status] || 'bg-gray-100 text-gray-700'}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function CreateModal({ tab, open, onClose, staff, onSaved }: { tab: TabKey; open: boolean; onClose: () => void; staff: any[]; onSaved: () => void }) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const base: any = { staffId: '', period: '', status: 'Draft' }
      if (tab === 'annual') {
        Object.assign(base, { assessmentScore: 0, monthlyScore: 0, quarterlyScore: 0, appraisalScore: 0, dutyScore: 0, comments: '' })
      } else if (tab === 'monthly') {
        Object.assign(base, { month: new Date().getMonth() + 1, year: new Date().getFullYear(), score: 0, achievements: '', challenges: '', recommendations: '', comments: '' })
      } else if (tab === 'quarterly') {
        Object.assign(base, { quarter: 1, year: new Date().getFullYear(), summary: '', comments: '' })
      } else if (tab === 'assessment') {
        Object.assign(base, { knowledgeScore: 0, skillsScore: 0, attitudeScore: 0, communicationScore: 0, remarks: '' })
      } else if (tab === 'appraisal') {
        Object.assign(base, { performanceScore: 0, achievementScore: 0, competencyScore: 0, remarks: '' })
      } else {
        Object.assign(base, { title: '', description: '', weight: 1, targetScore: 100, achievedScore: '', period: new Date().toISOString().slice(0, 7), type: 'Primary', order: 1, startDate: '', dueDate: '', status: 'Assigned' })
      }
      setForm(base)
    }
  }, [open, tab])

  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.staffId) { toast.error('Select a staff member'); return }
    let endpoint = '/api/annual-reviews'
    if (tab === 'monthly') endpoint = '/api/monthly-appraisals'
    else if (tab === 'quarterly') endpoint = '/api/quarterly-reviews'
    else if (tab === 'assessment') endpoint = '/api/assessments'
    else if (tab === 'appraisal') endpoint = '/api/appraisals'
    else if (tab === 'duties') endpoint = '/api/duties'

    let payload: any = { ...form }
    if (tab === 'monthly' || tab === 'quarterly') {
      payload.period = tab === 'monthly' ? `${form.year}-${String(form.month).padStart(2, '0')}` : `${form.year}-Q${form.quarter}`
    }
    if (tab !== 'duties' && tab !== 'annual' && tab !== 'monthly' && tab !== 'quarterly') {
      payload.period = form.period || String(new Date().getFullYear())
    }

    setSaving(true)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to create')
      else { toast.success('Created'); onSaved() }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tabLabel(tab)}</DialogTitle>
          <DialogDescription>Fill in the details below. Auto-calculated fields will be computed on submit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Staff Member *</Label>
            <StaffSearch  value={form.staffId} onChange={(v) => set('staffId', v)} placeholder="Search staff by name, ID, department..." />
          </div>

          {tab === 'annual' && (
            <>
              <Field label="Period (e.g. 2025)"><Input value={form.period || ''} onChange={(e) => set('period', e.target.value)} /></Field>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <NumField label="Assessment Score" value={form.assessmentScore} onChange={(v) => set('assessmentScore', v)} />
                <NumField label="Monthly Score" value={form.monthlyScore} onChange={(v) => set('monthlyScore', v)} />
                <NumField label="Quarterly Score" value={form.quarterlyScore} onChange={(v) => set('quarterlyScore', v)} />
                <NumField label="Appraisal Score" value={form.appraisalScore} onChange={(v) => set('appraisalScore', v)} />
                <NumField label="Duty Score" value={form.dutyScore} onChange={(v) => set('dutyScore', v)} />
              </div>
              <Field label="Comments"><Textarea value={form.comments || ''} onChange={(e) => set('comments', e.target.value)} /></Field>
            </>
          )}

          {tab === 'monthly' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Month (1-12)"><Input type="number" min={1} max={12} value={form.month || ''} onChange={(e) => set('month', Number(e.target.value))} /></Field>
                <Field label="Year"><Input type="number" value={form.year || ''} onChange={(e) => set('year', Number(e.target.value))} /></Field>
              </div>
              <NumField label="Score (0-100)" value={form.score} onChange={(v) => set('score', v)} />
              <Field label="Achievements"><Textarea value={form.achievements || ''} onChange={(e) => set('achievements', e.target.value)} /></Field>
              <Field label="Challenges"><Textarea value={form.challenges || ''} onChange={(e) => set('challenges', e.target.value)} /></Field>
              <Field label="Recommendations"><Textarea value={form.recommendations || ''} onChange={(e) => set('recommendations', e.target.value)} /></Field>
              <Field label="Comments"><Textarea value={form.comments || ''} onChange={(e) => set('comments', e.target.value)} /></Field>
            </>
          )}

          {tab === 'quarterly' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quarter (1-4)"><Input type="number" min={1} max={4} value={form.quarter || ''} onChange={(e) => set('quarter', Number(e.target.value))} /></Field>
                <Field label="Year"><Input type="number" value={form.year || ''} onChange={(e) => set('year', Number(e.target.value))} /></Field>
              </div>
              <Field label="Summary"><Textarea value={form.summary || ''} onChange={(e) => set('summary', e.target.value)} /></Field>
              <Field label="Comments"><Textarea value={form.comments || ''} onChange={(e) => set('comments', e.target.value)} /></Field>
              <p className="text-xs text-muted-foreground">Average score is auto-computed from monthly appraisals of the same quarter.</p>
            </>
          )}

          {tab === 'assessment' && (
            <>
              <Field label="Period (e.g. 2025)"><Input value={form.period || ''} onChange={(e) => set('period', e.target.value)} /></Field>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumField label="Knowledge" value={form.knowledgeScore} onChange={(v) => set('knowledgeScore', v)} />
                <NumField label="Skills" value={form.skillsScore} onChange={(v) => set('skillsScore', v)} />
                <NumField label="Attitude" value={form.attitudeScore} onChange={(v) => set('attitudeScore', v)} />
                <NumField label="Communication" value={form.communicationScore} onChange={(v) => set('communicationScore', v)} />
              </div>
              <Field label="Remarks"><Textarea value={form.remarks || ''} onChange={(e) => set('remarks', e.target.value)} /></Field>
            </>
          )}

          {tab === 'appraisal' && (
            <>
              <Field label="Period (e.g. 2025)"><Input value={form.period || ''} onChange={(e) => set('period', e.target.value)} /></Field>
              <div className="grid grid-cols-3 gap-3">
                <NumField label="Performance" value={form.performanceScore} onChange={(v) => set('performanceScore', v)} />
                <NumField label="Achievement" value={form.achievementScore} onChange={(v) => set('achievementScore', v)} />
                <NumField label="Competency" value={form.competencyScore} onChange={(v) => set('competencyScore', v)} />
              </div>
              <Field label="Remarks"><Textarea value={form.remarks || ''} onChange={(e) => set('remarks', e.target.value)} /></Field>
            </>
          )}

          {tab === 'duties' && (
            <>
              <Field label="Duty Title *"><Input value={form.title || ''} onChange={(e) => set('title', e.target.value)} /></Field>
              <Field label="Description"><Textarea value={form.description || ''} onChange={(e) => set('description', e.target.value)} rows={2} /></Field>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type || 'Primary'} onValueChange={(v) => set('type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Primary">Primary</SelectItem>
                      <SelectItem value="Secondary">Secondary</SelectItem>
                      <SelectItem value="Routine">Routine</SelectItem>
                      <SelectItem value="Project-based">Project-based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumField label="Order" value={form.order || 1} onChange={(v) => set('order', v)} />
                <div>
                  <Label>Start Date</Label>
                  <Input type="date" value={form.startDate || ''} onChange={(e) => set('startDate', e.target.value)} />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input type="date" value={form.dueDate || ''} onChange={(e) => set('dueDate', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumField label="Target Score" value={form.targetScore} onChange={(v) => set('targetScore', v)} />
                <Field label="Achieved Score"><Input type="number" value={form.achievedScore ?? ''} onChange={(e) => set('achievedScore', e.target.value === '' ? null : Number(e.target.value))} /></Field>
                <NumField label="Weight" value={form.weight} onChange={(v) => set('weight', v)} />
                <Field label="Period"><Input value={form.period || new Date().toISOString().slice(0, 7)} onChange={(e) => set('period', e.target.value)} placeholder="YYYY-MM" /></Field>
              </div>
              <p className="text-xs text-muted-foreground">Duration days auto-calculated from start + due date. Staff must upload evidence when completing the task. Status auto-changes to "Overdue" if past due date.</p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />} Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailSheet({ tab, item, onClose, user, onAction }: { tab: TabKey; item: any | null; onClose: () => void; user: any; onAction: () => void }) {
  const [hodSig, setHodSig] = useState('')
  const [daSig, setDaSig] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  // Duty-only state
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [achievedScore, setAchievedScore] = useState<number | ''>('')
  const [scoreNotes, setScoreNotes] = useState('')
  const [reviewRemarks, setReviewRemarks] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<any>({})

  useEffect(() => {
    if (item) {
      setCurrent(item)
      setHodSig(''); setDaSig(''); setRemarks('')
      setEvidenceUrl(''); setEvidenceNotes(''); setAchievedScore(''); setScoreNotes(''); setReviewRemarks('')
      if (item.achievedScore != null) setAchievedScore(Number(item.achievedScore))
    }
  }, [item])

  if (!current) return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md" />
    </Sheet>
  )

  // Role / permission check for duties
  const dutyRole = user?.activeRole || user?.role || 'STAFF'
  const dutyDesignationCode = user?.designation?.code || ''
  const canManageDuties =
    ['SUPER_ADMIN', 'ADMIN', 'HOD', 'HOU', 'APPRAISAL_OFFICER'].includes(dutyRole) ||
    dutyDesignationCode === 'PLANNING_OFFICER'

  const patch = async (endpoint: string, payload: any) => {
    setSubmitting(true)
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Updated'); setCurrent(data[(tab === 'monthly' || tab === 'appraisal') ? 'appraisal' : tab === 'assessment' ? 'assessment' : tab === 'annual' ? 'review' : tab === 'quarterly' ? 'review' : 'duty'] || data); onAction() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const signAnnual = async (role: 'HOD' | 'DA') => {
    const sig = role === 'HOD' ? hodSig : daSig
    if (!sig) { toast.error('Upload a signature first'); return }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/annual-reviews/${current.id}/sign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, signatureUrl: sig, name: user.fullName, remarks }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to sign')
      else { toast.success(`${role} signed`); setCurrent(data.review); onAction() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  // Duty-specific helpers
  const patchDuty = async (payload: any) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/duties/${current.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Duty updated'); setCurrent(data.duty || data); onAction() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const deleteDuty = async () => {
    if (!confirm(`Delete duty "${current.title}"? This cannot be undone.`)) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/duties/${current.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to delete')
      else { toast.success('Duty deleted'); onAction(); onClose() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const saveEdit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/duties/${current.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Duty updated'); setCurrent(data.duty); onAction(); setEditOpen(false) }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const openEdit = () => {
    setEditForm({
      title: current.title || '',
      description: current.description || '',
      type: current.type || 'Primary',
      order: current.order || 1,
      weight: current.weight ?? 1,
      targetScore: current.targetScore ?? 100,
      period: current.period || '',
      startDate: current.startDate ? new Date(current.startDate).toISOString().slice(0, 10) : '',
      dueDate: current.dueDate ? new Date(current.dueDate).toISOString().slice(0, 10) : '',
    })
    setEditOpen(true)
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white text-lg">{tabLabel(tab).replace('New ', '')}</SheetTitle>
          <SheetDescription className="text-white/80">
            {current.staff?.fullName || ''} · Period: {current.period}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 space-y-4">
          {/* Print / Export buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
                const subLine = 'HUMAN RESOURCES MANAGEMENT SYSTEM · Annual Performance Review'
                const html =
                  printHeader(institution, subLine, `${current.staff?.fullName || ''} — ${current.period}`, 'Annual Review') +
                  `
                  <div class="grid" style="margin-bottom: 14px;">
                    <div class="section">
                      <h3>Staff Details</h3>
                      ${row('Name', current.staff?.fullName)}
                      ${row('Staff ID', current.staff?.staffId)}
                      ${row('Position', current.staff?.position)}
                      ${row('Department', current.staff?.department?.name)}
                    </div>
                    <div class="section">
                      <h3>Review Details</h3>
                      ${row('Period', current.period)}
                      ${row('Status', current.status)}
                      ${row('Verdict', current.verdict)}
                      ${row('Overall Score', current.overallScore?.toFixed?.(1) ?? '—')}
                    </div>
                  </div>
                  <div class="section">
                    <h3>Sub-Scores</h3>
                    <table>
                      <thead><tr><th>Assessment</th><th>Monthly</th><th>Quarterly</th><th>Appraisal</th><th>Duty</th><th>Overall</th></tr></thead>
                      <tbody><tr>
                        <td>${current.assessmentScore ?? '—'}</td>
                        <td>${current.monthlyScore ?? '—'}</td>
                        <td>${current.quarterlyScore ?? '—'}</td>
                        <td>${current.appraisalScore ?? '—'}</td>
                        <td>${current.dutyScore ?? '—'}</td>
                        <td><strong>${current.overallScore?.toFixed?.(1) ?? '—'}</strong></td>
                      </tr></tbody>
                    </table>
                  </div>
                  ${current.comments ? `<div class="section"><h3>Comments</h3><p>${htmlEscape(current.comments)}</p></div>` : ''}
                  <div class="section">
                    <h3>Signatures</h3>
                    <div>
                      ${signatureBox('HOD Signature', current.hodName, current.hodSignedAt, current.hodSignatureUrl)}
                      ${signatureBox('DA Signature', current.daName, current.daSignedAt, current.daSignatureUrl)}
                    </div>
                  </div>
                  `
                await printHTML(html, `Annual Review ${current.staff?.fullName || ''} ${current.period}`)
              }}
            >
              <Printer className="size-4" /> Print Annual Review
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const rows = [{
                  'Staff': current.staff?.fullName,
                  'Staff ID': current.staff?.staffId,
                  'Period': current.period,
                  'Assessment Score': current.assessmentScore,
                  'Monthly Score': current.monthlyScore,
                  'Quarterly Score': current.quarterlyScore,
                  'Appraisal Score': current.appraisalScore,
                  'Duty Score': current.dutyScore,
                  'Overall Score': current.overallScore,
                  'Verdict': current.verdict,
                  'Status': current.status,
                  'HOD Name': current.hodName,
                  'HOD Signed At': current.hodSignedAt,
                  'DA Name': current.daName,
                  'DA Signed At': current.daSignedAt,
                }]
                exportToExcel(`FUTH_Annual_Review_${current.staff?.fullName || ''}_${current.period}`.replace(/\s+/g, '_'), [{ name: 'Annual Review', rows }])
                toast.success('Annual review exported')
              }}
            >
              <Download className="size-4" /> Export
            </Button>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge className={`${statusColor[current.status] || ''} border`}>{current.status}</Badge>
            {tab === 'annual' && current.verdict && <Badge className={`${verdictColor[current.verdict] || ''} border`}>{current.verdict}</Badge>}
            {(current.grade) && <Badge className={`${gradeColor[current.grade] || ''} border`}>{current.grade}</Badge>}
          </div>

          {tab === 'annual' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <ScoreTile label="Assessment" value={current.assessmentScore} />
                <ScoreTile label="Monthly" value={current.monthlyScore} />
                <ScoreTile label="Quarterly" value={current.quarterlyScore} />
                <ScoreTile label="Appraisal" value={current.appraisalScore} />
                <ScoreTile label="Duty" value={current.dutyScore} />
                <ScoreTile label="Overall" value={current.overallScore} highlight />
              </div>
              {current.comments && <div><Label>Comments</Label><p className="text-sm mt-1">{current.comments}</p></div>}

              {/* Signature workflow */}
              <div className="border-t pt-4 space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2"><FileSignature className="size-4" /> Signature Workflow</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded border p-3">
                    <div className="text-xs font-medium mb-2">HOD Signature</div>
                    {current.hodSignatureUrl ? (
                       
                      <img src={current.hodSignatureUrl} alt="HOD signature" className="h-16 object-contain" />
                    ) : (
                      <div className="h-16 flex items-center justify-center text-xs text-muted-foreground">Awaiting HOD</div>
                    )}
                    {current.hodName && <div className="text-xs mt-1">{current.hodName} · {formatDate(current.hodSignedAt)}</div>}
                  </div>
                  <div className="rounded border p-3">
                    <div className="text-xs font-medium mb-2">DA Signature</div>
                    {current.daSignatureUrl ? (
                       
                      <img src={current.daSignatureUrl} alt="DA signature" className="h-16 object-contain" />
                    ) : (
                      <div className="h-16 flex items-center justify-center text-xs text-muted-foreground">Awaiting DA</div>
                    )}
                    {current.daName && <div className="text-xs mt-1">{current.daName} · {formatDate(current.daSignedAt)}</div>}
                  </div>
                </div>

                {current.status === 'Draft' && (
                  <Button size="sm" disabled={submitting} onClick={() => patch(`/api/annual-reviews/${current.id}`, { status: 'Submitted' })}>
                    Submit for signature
                  </Button>
                )}

                {current.status === 'Submitted' && (
                  <div className="space-y-2 rounded border p-3 bg-muted/40">
                    <div className="text-xs font-medium">HOD action</div>
                    <FileUpload type="signature" label="Upload HOD signature" value={hodSig} onChange={setHodSig} previewClassName="h-16 w-32" />
                    <Input placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    <Button size="sm" disabled={submitting} onClick={() => signAnnual('HOD')}>
                      {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileSignature className="size-4" />}
                      Sign as HOD
                    </Button>
                  </div>
                )}

                {current.status === 'HOD Signed' && (
                  <div className="space-y-2 rounded border p-3 bg-muted/40">
                    <div className="text-xs font-medium">DA action (final)</div>
                    <FileUpload type="signature" label="Upload DA signature" value={daSig} onChange={setDaSig} previewClassName="h-16 w-32" />
                    <Input placeholder="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    <Button size="sm" disabled={submitting} onClick={() => signAnnual('DA')}>
                      {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Sign as DA & Complete
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'monthly' && (
            <>
              <ScoreTile label="Score" value={current.score} highlight />
              {current.grade && <Badge className={`${gradeColor[current.grade]} border`}>Grade: {current.grade}</Badge>}
              <Section label="Achievements">{current.achievements || '—'}</Section>
              <Section label="Challenges">{current.challenges || '—'}</Section>
              <Section label="Recommendations">{current.recommendations || '—'}</Section>
              <Section label="Comments">{current.comments || '—'}</Section>
              {current.status === 'Draft' && (
                <Button size="sm" disabled={submitting} onClick={() => patch(`/api/monthly-appraisals/${current.id}`, { status: 'Submitted' })}>Submit</Button>
              )}
              {current.hodSignedAt && <p className="text-xs text-muted-foreground">HOD signed by {current.hodName} on {formatDate(current.hodSignedAt)}</p>}
            </>
          )}

          {tab === 'quarterly' && (
            <>
              <ScoreTile label="Average Score (from monthly)" value={current.averageScore} highlight />
              {current.grade && <Badge className={`${gradeColor[current.grade]} border`}>Grade: {current.grade}</Badge>}
              <Section label="Summary">{current.summary || '—'}</Section>
              <Section label="Comments">{current.comments || '—'}</Section>
              {current.status === 'Draft' && (
                <Button size="sm" disabled={submitting} onClick={() => patch(`/api/quarterly-reviews/${current.id}`, { status: 'Submitted' })}>Submit</Button>
              )}
            </>
          )}

          {tab === 'assessment' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <ScoreTile label="Knowledge" value={current.knowledgeScore} />
                <ScoreTile label="Skills" value={current.skillsScore} />
                <ScoreTile label="Attitude" value={current.attitudeScore} />
                <ScoreTile label="Communication" value={current.communicationScore} />
                <ScoreTile label="Total" value={current.totalScore} highlight />
              </div>
              {current.grade && <Badge className={`${gradeColor[current.grade]} border`}>Grade: {current.grade}</Badge>}
              <Section label="Remarks">{current.remarks || '—'}</Section>
              {current.status === 'Draft' && (
                <Button size="sm" disabled={submitting} onClick={() => patch(`/api/assessments/${current.id}`, { status: 'Submitted' })}>Submit</Button>
              )}
            </>
          )}

          {tab === 'appraisal' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <ScoreTile label="Performance" value={current.performanceScore} />
                <ScoreTile label="Achievement" value={current.achievementScore} />
                <ScoreTile label="Competency" value={current.competencyScore} />
                <ScoreTile label="Total" value={current.totalScore} highlight />
              </div>
              {current.grade && <Badge className={`${gradeColor[current.grade]} border`}>Grade: {current.grade}</Badge>}
              <Section label="Remarks">{current.remarks || '—'}</Section>
              {current.status === 'Draft' && (
                <Button size="sm" disabled={submitting} onClick={() => patch(`/api/appraisals/${current.id}`, { status: 'Submitted' })}>Submit</Button>
              )}
            </>
          )}

          {tab === 'duties' && (
            <>
              <Section label="Title">{current.title}</Section>
              <Section label="Description">{current.description || '—'}</Section>
              <div className="grid grid-cols-2 gap-2">
                <ScoreTile label="Target" value={current.targetScore} />
                <ScoreTile label="Achieved" value={current.achievedScore} highlight />
                <ScoreTile label="Weight" value={current.weight} />
                <div className="rounded border p-2 text-center">
                  <div className="text-xs text-muted-foreground">Grade</div>
                  {current.grade ? <Badge className={`size-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    current.grade === 'A+' ? 'bg-emerald-500 text-white' :
                    current.grade === 'A' ? 'bg-green-500 text-white' :
                    current.grade === 'B' ? 'bg-blue-500 text-white' :
                    current.grade === 'C' ? 'bg-amber-500 text-white' :
                    current.grade === 'D' ? 'bg-orange-500 text-white' :
                    'bg-red-500 text-white'
                  }`}>{current.grade}</Badge> : <span>—</span>}
                </div>
              </div>
              {current.rating && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rating:</span>
                  <Badge className={`${
                    current.rating === 'Outstanding' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    current.rating === 'Excellent' ? 'bg-green-100 text-green-700 border-green-200' :
                    current.rating === 'Very Good' ? 'bg-lime-100 text-lime-700 border-lime-200' :
                    current.rating === 'Good' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    current.rating === 'Satisfactory' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                    'bg-red-100 text-red-700 border-red-200'
                  } border`}>{current.rating}</Badge>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><Label className="text-xs">Type</Label><p>{current.type || 'Primary'}</p></div>
                <div><Label className="text-xs">Order</Label><p>{current.order || 1}</p></div>
                <div><Label className="text-xs">Start Date</Label><p>{current.startDate ? formatDate(current.startDate) : '—'}</p></div>
                <div><Label className="text-xs">Due Date</Label><p className={current.dueDate && new Date(current.dueDate) < new Date() && !['Completed','Approved'].includes(current.status) ? 'text-red-600 font-medium' : ''}>{current.dueDate ? formatDate(current.dueDate) : '—'}</p></div>
                <div><Label className="text-xs">Duration (days)</Label><p>{current.durationDays || '—'}</p></div>
                <div><Label className="text-xs">Completed At</Label><p>{current.completedAt ? formatDate(current.completedAt) : '—'}</p></div>
              </div>
              <Section label="Status">
                <Badge className={`${
                  (current.dueDate && new Date(current.dueDate) < new Date() && !['Completed','Approved'].includes(current.status)) ? 'bg-red-100 text-red-700' :
                  current.status === 'Completed' ? 'bg-green-100 text-green-700' :
                  current.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                  current.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                } border`}>{(current.dueDate && new Date(current.dueDate) < new Date() && !['Completed','Approved'].includes(current.status)) ? 'Overdue' : current.status}</Badge>
              </Section>
              <Section label="Period">{current.period || '—'}</Section>
              {/* Evidence of completion */}
              {current.evidenceUrl && (
                <div>
                  <Label className="text-xs">Evidence of Completion</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <a href={current.evidenceUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm flex items-center gap-1">
                      <FileText className="size-3.5" /> {current.evidenceFileName || 'View evidence'}
                    </a>
                    <span className="text-xs text-muted-foreground">Uploaded {current.evidenceUploadedAt ? formatDate(current.evidenceUploadedAt) : ''}</span>
                  </div>
                  {current.evidenceNotes && <p className="text-xs text-muted-foreground mt-1">{current.evidenceNotes}</p>}
                </div>
              )}
              {/* Review status */}
              {current.reviewedByName && (
                <div>
                  <Label className="text-xs">Reviewed By</Label>
                  <p className="text-sm">{current.reviewedByName} — {current.reviewedAt ? formatDate(current.reviewedAt) : ''}</p>
                  {current.reviewRemarks && <p className="text-xs text-muted-foreground mt-1">{current.reviewRemarks}</p>}
                </div>
              )}

              {/* === DUTY ACTIONS === */}
              {current.status !== 'Approved' && current.status !== 'Rejected' && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="size-4" /> Duty Actions</h3>

                  {/* Workflow status indicator */}
                  <div className="flex items-center gap-1 text-xs p-2 bg-slate-50 rounded-md flex-wrap">
                    <span className={current.status === 'Assigned' ? 'font-bold text-blue-600' : 'text-slate-400'}>Assigned</span>
                    <span className="text-slate-300">→</span>
                    <span className={current.status === 'In Progress' ? 'font-bold text-blue-600' : 'text-slate-400'}>In Progress</span>
                    <span className="text-slate-300">→</span>
                    <span className={current.status === 'Completed' ? 'font-bold text-blue-600' : 'text-slate-400'}>Completed</span>
                    <span className="text-slate-300">→</span>
                    <span className={current.status === 'Approved' ? 'font-bold text-emerald-600' : 'text-slate-400'}>Approved</span>
                  </div>

                  {/* Status transitions (manager only) */}
                  {canManageDuties && (
                    <div className="flex flex-wrap gap-2">
                      {current.status === 'Assigned' && (
                        <Button size="sm" disabled={submitting} onClick={() => patchDuty({ status: 'In Progress' })} className="bg-blue-600 hover:bg-blue-700">
                          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />} Mark In Progress
                        </Button>
                      )}
                      {(current.status === 'Assigned' || current.status === 'In Progress') && (
                        <Button size="sm" disabled={submitting} onClick={() => patchDuty({ status: 'Completed', completedAt: new Date().toISOString() })} className="bg-green-600 hover:bg-green-700">
                          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Mark Completed
                        </Button>
                      )}
                      {current.status === 'Completed' && (
                        <Button size="sm" disabled={submitting} onClick={() => patchDuty({ status: 'Approved', reviewedByName: user?.fullName || 'Reviewer', reviewedAt: new Date().toISOString(), reviewRemarks: reviewRemarks || 'Approved' })} className="bg-emerald-600 hover:bg-emerald-700">
                          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve Duty
                        </Button>
                      )}
                      {(current.status === 'Assigned' || current.status === 'In Progress' || current.status === 'Completed') && (
                        <Button size="sm" disabled={submitting} onClick={() => patchDuty({ status: 'Rejected', reviewedByName: user?.fullName || 'Reviewer', reviewedAt: new Date().toISOString(), reviewRemarks: reviewRemarks || 'Rejected' })} variant="destructive">
                          {submitting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Reject
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Review remarks (manager only — used when Approve / Reject) */}
                  {canManageDuties && (current.status === 'Completed' || current.status === 'In Progress' || current.status === 'Assigned') && (
                    <div className="space-y-1">
                      <Label className="text-xs">Review Remarks (used by Approve / Reject)</Label>
                      <Textarea value={reviewRemarks} onChange={(e) => setReviewRemarks(e.target.value)} rows={2} placeholder="Optional remarks for approval or rejection..." />
                    </div>
                  )}

                  {/* Record achievement score (manager only) */}
                  {canManageDuties && current.status !== 'Rejected' && (
                    <div className="rounded border p-3 bg-muted/40 space-y-2">
                      <div className="text-xs font-medium">Record Achievement Score</div>
                      <p className="text-[11px] text-muted-foreground">Grade and Rating are auto-computed (A+ ≥90, A ≥80, B ≥70, C ≥60, D ≥50, F &lt;50).</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="number" min={0} max={100} step={0.1} placeholder="Achieved Score (0-100)" value={achievedScore} onChange={(e) => setAchievedScore(e.target.value === '' ? '' : Number(e.target.value))} />
                        <Input placeholder="Score Notes (optional)" value={scoreNotes} onChange={(e) => setScoreNotes(e.target.value)} />
                      </div>
                      <Button size="sm" disabled={submitting || achievedScore === ''} onClick={() => patchDuty({ achievedScore: achievedScore === '' ? null : Number(achievedScore), scoreNotes: scoreNotes || null })}>
                        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Save Score
                      </Button>
                    </div>
                  )}

                  {/* Upload Evidence of Completion (both manager and staff) */}
                  {current.status !== 'Approved' && (
                    <div className="rounded border p-3 bg-muted/40 space-y-2">
                      <div className="text-xs font-medium flex items-center gap-1"><Upload className="size-3.5" /> Evidence of Completion</div>
                      <p className="text-[11px] text-muted-foreground">
                        {canManageDuties
                          ? 'Upload evidence to mark this duty as Completed. Available to managers and the assigned staff.'
                          : 'As the assigned staff, upload evidence of completion. The duty will be marked as Completed and forwarded for review.'}
                      </p>
                      <FileUpload type="evidence" accept="image/*,application/pdf" label="Upload evidence file" value={evidenceUrl} onChange={setEvidenceUrl} previewClassName="h-24 w-full object-contain" />
                      <Textarea value={evidenceNotes} onChange={(e) => setEvidenceNotes(e.target.value)} rows={2} placeholder="Notes about the completion (optional)..." />
                      <Button size="sm" disabled={submitting || !evidenceUrl} onClick={() => patchDuty({ evidenceUrl, evidenceFileName: evidenceUrl?.split('/').pop() || null, evidenceNotes: evidenceNotes || null })} className="bg-blue-600 hover:bg-blue-700">
                        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Submit Evidence
                      </Button>
                    </div>
                  )}

                  {/* Edit + Delete (manager only) */}
                  {canManageDuties && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button size="sm" variant="outline" disabled={submitting} onClick={openEdit}>
                        <Edit className="size-4" /> Edit Duty
                      </Button>
                      <Button size="sm" variant="destructive" disabled={submitting} onClick={deleteDuty}>
                        <Trash2 className="size-4" /> Delete Duty
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Already Approved / Rejected — only show Edit + Delete for managers */}
              {(current.status === 'Approved' || current.status === 'Rejected') && canManageDuties && (
                <div className="border-t pt-4 space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="size-4" /> Duty Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={submitting} onClick={openEdit}>
                      <Edit className="size-4" /> Edit Duty
                    </Button>
                    <Button size="sm" variant="destructive" disabled={submitting} onClick={deleteDuty}>
                      <Trash2 className="size-4" /> Delete Duty
                    </Button>
                  </div>
                </div>
              )}

              {/* Edit Duty Dialog */}
              <Dialog open={editOpen} onOpenChange={(o) => { if (!o) setEditOpen(false) }}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Duty</DialogTitle>
                    <DialogDescription>Update the duty details. Status, achieved score, and evidence are managed via the action buttons above.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <Label>Duty Title *</Label>
                      <Input value={editForm.title || ''} onChange={(e) => setEditForm((f: any) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea value={editForm.description || ''} onChange={(e) => setEditForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label>Type</Label>
                        <Select value={editForm.type || 'Primary'} onValueChange={(v) => setEditForm((f: any) => ({ ...f, type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Primary">Primary</SelectItem>
                            <SelectItem value="Secondary">Secondary</SelectItem>
                            <SelectItem value="Routine">Routine</SelectItem>
                            <SelectItem value="Project-based">Project-based</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Order</Label>
                        <Input type="number" value={editForm.order || 1} onChange={(e) => setEditForm((f: any) => ({ ...f, order: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <Label>Start Date</Label>
                        <Input type="date" value={editForm.startDate || ''} onChange={(e) => setEditForm((f: any) => ({ ...f, startDate: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Due Date</Label>
                        <Input type="date" value={editForm.dueDate || ''} onChange={(e) => setEditForm((f: any) => ({ ...f, dueDate: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Target Score</Label>
                        <Input type="number" value={editForm.targetScore ?? 100} onChange={(e) => setEditForm((f: any) => ({ ...f, targetScore: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <Label>Weight</Label>
                        <Input type="number" step={0.1} value={editForm.weight ?? 1} onChange={(e) => setEditForm((f: any) => ({ ...f, weight: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <Label>Period</Label>
                        <Input value={editForm.period || ''} onChange={(e) => setEditForm((f: any) => ({ ...f, period: e.target.value }))} placeholder="YYYY-MM" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button onClick={saveEdit} disabled={submitting}>{submitting && <Loader2 className="size-4 animate-spin" />} Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <p className="text-sm mt-1">{children}</p>
    </div>
  )
}

function ScoreTile({ label, value, highlight }: { label: string; value?: number | null; highlight?: boolean }) {
  return (
    <div className={`rounded border p-3 text-center ${highlight ? 'bg-primary/10 border-primary' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value !== null && value !== undefined ? Number(value).toFixed(1) : '—'}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value?: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <Input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </Field>
  )
}
