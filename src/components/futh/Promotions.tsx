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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  TrendingUp, Plus, Search, Loader2, Check, X, Ban, Clock, FileCheck2, Printer, Download, ArrowRight,
} from 'lucide-react'
import { initials, formatDate, formatNaira } from '@/lib/formatters'
import { toast } from 'sonner'
import FileUpload from './FileUpload'
import StaffSearch from './StaffSearch'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, signatureBox, formatDateForPrint, htmlEscape, row } from '@/lib/print'

const statusColor: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-blue-100 text-blue-700',
  'HOD Approved': 'bg-amber-100 text-amber-700',
  'DFA Approved': 'bg-violet-100 text-violet-700',
  'CMD Approved': 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-slate-200 text-slate-700',
  Completed: 'bg-emerald-100 text-emerald-700',
}

const typeLabel: Record<string, string> = {
  promotion: 'Promotion',
  upgrade: 'Upgrade',
  conversion: 'Conversion',
  redesignation: 'Redesignation',
}

type TabKey = 'all' | 'pending_my_approval' | 'mine' | 'approved' | 'rejected'

type Props = {
  user: any
  onNavigate?: (v: any) => void
}

export default function Promotions({ user }: Props) {
  const [tab, setTab] = useState<TabKey>('all')
  const [promotions, setPromotions] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [designations, setDesignations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab })
      const [prRes, stRes, depRes, desRes] = await Promise.all([
        fetch(`/api/promotions?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
        fetch('/api/designations', { cache: 'no-store' }),
      ])
      const prData = await prRes.json()
      const stData = await stRes.json()
      const depData = await depRes.json()
      const desData = await desRes.json()
      let list = prData.promotions || []
      if (statusFilter !== 'all') list = list.filter((p: any) => p.status === statusFilter)
      if (typeFilter !== 'all') list = list.filter((p: any) => p.type === typeFilter)
      if (search) {
        const q = search.toLowerCase()
        list = list.filter((p: any) =>
          (p.refNumber || '').toLowerCase().includes(q) ||
          (p.staff?.fullName || '').toLowerCase().includes(q) ||
          (p.staff?.staffId || '').toLowerCase().includes(q) ||
          (p.newPosition || '').toLowerCase().includes(q) ||
          (p.currentPosition || '').toLowerCase().includes(q)
        )
      }
      setPromotions(list)
      setStaff(stData.staff || [])
      setDepartments(depData.departments || [])
      setDesignations(desData.designations || [])
    } catch {
      toast.error('Failed to load promotions')
    }
    setLoading(false)
  }, [tab, search, statusFilter, typeFilter])

  useEffect(() => { load() }, [load])

  const role = user?.activeRole || user?.role
  const canCreate = !['STAFF', 'REGISTRY_OFFICER'].includes(role)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="size-6" /> Promotions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {promotions.length} promotion records · HOD → DFA → CMD workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = promotions.map((p) => ({
                'Ref #': p.refNumber,
                'Staff': p.staff?.fullName || '',
                'Staff ID': p.staff?.staffId || '',
                'Department': p.staff?.department?.name || '',
                'Type': typeLabel[p.type] || p.type,
                'Current Position': p.currentPosition || '',
                'Current Rank': p.currentRank || '',
                'Current Salary': p.currentSalary ?? '',
                'New Position': p.newPosition || '',
                'New Rank': p.newRank || '',
                'New Salary': p.newSalary ?? '',
                'Effective Date': formatDate(p.effectiveDate),
                'Status': p.status,
                'State': p.state,
                'HOD': p.hodName || '',
                'DFA': p.dfaName || '',
                'CMD': p.cmdName || '',
                'Reason': p.reason || '',
                'Created At': p.createdAt ? new Date(p.createdAt).toLocaleString() : '',
              }))
              exportToExcel('FUTH_Promotions', [{ name: 'Promotions', rows }])
              toast.success(`Exported ${rows.length} promotions`)
            }}
            disabled={!promotions.length}
          >
            <Download className="size-4" /> Export to Excel
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New Promotion
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="pending_my_approval" className="text-xs">Pending My Approval</TabsTrigger>
          <TabsTrigger value="mine" className="text-xs">Submitted by Me</TabsTrigger>
          <TabsTrigger value="approved" className="text-xs">Approved</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search by ref #, staff, position..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="HOD Approved">HOD Approved</SelectItem>
                <SelectItem value="DFA Approved">DFA Approved</SelectItem>
                <SelectItem value="CMD Approved">CMD Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="promotion">Promotion</SelectItem>
                <SelectItem value="upgrade">Upgrade</SelectItem>
                <SelectItem value="conversion">Conversion</SelectItem>
                <SelectItem value="redesignation">Redesignation</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b">
                    <th className="text-left px-4 py-3">Ref Number</th>
                    <th className="text-left px-4 py-3">Staff</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Type</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Position Change</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Effective</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No promotions</td></tr>
                  ) : promotions.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setDetail(p)}>
                      <td className="px-4 py-3 font-mono text-xs">{p.refNumber}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="bg-primary/15 text-primary text-[9px]">{initials(p.staff?.fullName || '?')}</AvatarFallback>
                          </Avatar>
                          <div className="leading-tight">
                            <div className="font-medium">{p.staff?.fullName || '—'}</div>
                            <div className="text-[10px] text-muted-foreground">{p.staff?.staffId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="outline" className="capitalize text-[10px]">{typeLabel[p.type] || p.type}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{p.currentPosition || '—'}</span>
                          {p.newPosition && (
                            <>
                              <ArrowRight className="size-3 text-muted-foreground" />
                              <span className="font-medium">{p.newPosition}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">{formatDate(p.effectiveDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor[p.status] || 'bg-gray-100'}`}>{p.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PromotionCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        staff={staff}
        departments={departments}
        designations={designations}
        onSaved={() => { setCreating(false); load() }}
      />

      <PromotionDetailSheet
        item={detail}
        user={user}
        onClose={() => setDetail(null)}
        onAction={() => { setDetail(null); load() }}
      />
    </div>
  )
}

function PromotionCreateModal({ open, onClose, staff, departments, designations, onSaved }: {
  open: boolean; onClose: () => void; staff: any[]; departments: any[]; designations: any[]; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        staffId: '',
        type: 'promotion',
        currentPosition: '',
        currentRank: '',
        currentSalary: '',
        newPosition: '',
        newRank: '',
        newSalary: '',
        newDepartmentId: '',
        newDesignationId: '',
        effectiveDate: '',
        reason: '',
        justification: '',
      })
    }
  }, [open])

  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }))

  // Auto-fill current position/rank/salary from staff record when staff is selected
  useEffect(() => {
    if (form.staffId) {
      const s = staff.find((x) => x.id === form.staffId)
      if (s) {
        setForm((prev: any) => ({
          ...prev,
          currentPosition: prev.currentPosition || s.position || '',
          currentRank: prev.currentRank || s.rank || '',
        }))
      }
    }
  }, [form.staffId, staff])

  const save = async () => {
    if (!form.staffId || !form.effectiveDate) {
      toast.error('Staff and effective date are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to create promotion')
      else { toast.success(`Promotion created: ${data.promotion?.refNumber}`); onSaved() }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Promotion Request</DialogTitle>
          <DialogDescription>Submit a staff promotion / upgrade / conversion / redesignation</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Staff Member *</Label>
            <StaffSearch  value={form.staffId} onChange={(v) => set('staffId', v)} placeholder="Search staff by name, ID, department..." />
          </div>
          <div>
            <Label>Type *</Label>
            <Select value={form.type} onValueChange={(v) => set('type', v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="promotion">Promotion</SelectItem>
                <SelectItem value="upgrade">Upgrade</SelectItem>
                <SelectItem value="conversion">Conversion</SelectItem>
                <SelectItem value="redesignation">Redesignation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Current Position</Label><Input value={form.currentPosition} onChange={(e) => set('currentPosition', e.target.value)} /></div>
            <div><Label>Current Rank</Label><Input value={form.currentRank} onChange={(e) => set('currentRank', e.target.value)} /></div>
            <div><Label>Current Salary</Label><Input type="number" value={form.currentSalary} onChange={(e) => set('currentSalary', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>New Position</Label><Input value={form.newPosition} onChange={(e) => set('newPosition', e.target.value)} /></div>
            <div><Label>New Rank</Label><Input value={form.newRank} onChange={(e) => set('newRank', e.target.value)} /></div>
            <div><Label>New Salary</Label><Input type="number" value={form.newSalary} onChange={(e) => set('newSalary', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>New Department (optional)</Label>
              <Select value={form.newDepartmentId} onValueChange={(v) => set('newDepartmentId', v)}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>New Designation (optional)</Label>
              <Select value={form.newDesignationId} onValueChange={(v) => set('newDesignationId', v)}>
                <SelectTrigger><SelectValue placeholder="No change" /></SelectTrigger>
                <SelectContent>
                  {designations.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Effective Date *</Label>
            <Input type="date" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} />
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Brief reason for the promotion..." />
          </div>
          <div>
            <Label>Justification</Label>
            <Textarea value={form.justification} onChange={(e) => set('justification', e.target.value)} placeholder="Detailed justification..." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Submit Promotion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PromotionDetailSheet({ item, user, onClose, onAction }: { item: any | null; user: any; onClose: () => void; onAction: () => void }) {
  const [remarks, setRemarks] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [signatureUrl, setSignatureUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [current, setCurrent] = useState<any>(null)

  useEffect(() => {
    if (item) {
      setCurrent(item)
      setRemarks(''); setRejectReason(''); setSignatureUrl('')
    }
  }, [item])

  if (!current) return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md" />
    </Sheet>
  )

  const role = user?.activeRole || user?.role
  const isHod = role === 'HOD' || role === 'HOU' || role === 'SUPER_ADMIN' || role === 'ADMIN'
  const isDfa = role === 'DFA' || role === 'SUPER_ADMIN' || role === 'ADMIN'
  const isCmd = role === 'CMD' || role === 'SUPER_ADMIN'
  const isOwner = current.createdById === user.id

  const action = async (a: string) => {
    setSubmitting(true)
    try {
      const payload: any = { action: a, remarks }
      if (signatureUrl) payload.signatureUrl = signatureUrl
      if (a === 'reject') payload.rejectReason = rejectReason || remarks
      const res = await fetch(`/api/promotions/${current.id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Action completed'); setCurrent(data.promotion); onAction() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white text-lg">Promotion {current.refNumber}</SheetTitle>
          <SheetDescription className="text-white/80">
            {current.staff?.fullName} · {typeLabel[current.type] || current.type}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
                const subLine = 'HUMAN RESOURCES MANAGEMENT SYSTEM · Promotion Letter'
                const html =
                  printHeader(institution, subLine, current.refNumber, 'Promotion Letter') +
                  `
                  <div class="grid" style="margin-bottom: 14px;">
                    <div class="section">
                      <h3>Staff Details</h3>
                      ${row('Name', current.staff?.fullName)}
                      ${row('Staff ID', current.staff?.staffId)}
                      ${row('Department', current.staff?.department?.name)}
                      ${row('Current Position', current.currentPosition)}
                      ${row('Current Rank', current.currentRank)}
                      ${row('Current Salary', current.currentSalary ? formatNaira(current.currentSalary) : '—')}
                    </div>
                    <div class="section">
                      <h3>New Position</h3>
                      ${row('New Position', current.newPosition)}
                      ${row('New Rank', current.newRank)}
                      ${row('New Salary', current.newSalary ? formatNaira(current.newSalary) : '—')}
                      ${row('Effective Date', formatDate(current.effectiveDate))}
                      ${row('Type', typeLabel[current.type] || current.type)}
                    </div>
                  </div>
                  <div class="section">
                    <h3>Reason & Justification</h3>
                    <p><strong>Reason:</strong> ${htmlEscape(current.reason || '—')}</p>
                    <p><strong>Justification:</strong> ${htmlEscape(current.justification || '—')}</p>
                  </div>
                  <div class="section">
                    <h3>Signatures</h3>
                    <div>
                      ${signatureBox('HOD', current.hodName, current.hodSignedAt, current.hodSignatureUrl)}
                      ${signatureBox('DFA', current.dfaName, current.dfaSignedAt, current.dfaSignatureUrl)}
                      ${signatureBox('CMD', current.cmdName, current.cmdSignedAt, current.cmdSignatureUrl)}
                    </div>
                  </div>
                  `
                await printHTML(html, `Promotion ${current.refNumber}`)
              }}
            >
              <Printer className="size-4" /> Print Promotion Letter
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge className={`${statusColor[current.status] || ''} border`}>{current.status}</Badge>
          </div>

          <DetailSection title="Staff Details">
            <Row label="Name" value={current.staff?.fullName} />
            <Row label="Staff ID" value={current.staff?.staffId} />
            <Row label="Department" value={current.staff?.department?.name} />
          </DetailSection>

          <DetailSection title="Position Change">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border p-3 bg-amber-50 border-amber-100">
                <div className="text-[10px] uppercase text-muted-foreground mb-1">Current</div>
                <Row label="Position" value={current.currentPosition} />
                <Row label="Rank" value={current.currentRank} />
                <Row label="Salary" value={current.currentSalary ? formatNaira(current.currentSalary) : '—'} />
              </div>
              <div className="rounded border p-3 bg-green-50 border-green-100">
                <div className="text-[10px] uppercase text-muted-foreground mb-1">New</div>
                <Row label="Position" value={current.newPosition} />
                <Row label="Rank" value={current.newRank} />
                <Row label="Salary" value={current.newSalary ? formatNaira(current.newSalary) : '—'} />
              </div>
            </div>
            <Row label="Effective Date" value={formatDate(current.effectiveDate)} />
            <Row label="Type" value={typeLabel[current.type] || current.type} />
          </DetailSection>

          <DetailSection title="Reasoning">
            <Row label="Reason" value={current.reason} />
            <div>
              <Label className="text-xs text-muted-foreground">Justification</Label>
              <p className="text-sm mt-1">{current.justification || '—'}</p>
            </div>
          </DetailSection>

          <DetailSection title="Approval Workflow">
            <div className="grid grid-cols-3 gap-2">
              <ApprovalTile label="HOD" name={current.hodName} date={current.hodSignedAt} remarks={current.hodRemarks} signatureUrl={current.hodSignatureUrl} />
              <ApprovalTile label="DFA" name={current.dfaName} date={current.dfaSignedAt} remarks={current.dfaRemarks} signatureUrl={current.dfaSignatureUrl} />
              <ApprovalTile label="CMD" name={current.cmdName} date={current.cmdSignedAt} remarks={current.cmdRemarks} signatureUrl={current.cmdSignatureUrl} />
            </div>
            {current.rejectedById && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
                <div className="font-medium text-red-700">Rejected</div>
                <div className="text-xs">By: {current.rejectedById} · {formatDate(current.rejectedAt)}</div>
                {current.rejectReason && <div className="text-xs mt-1">Reason: {current.rejectReason}</div>}
              </div>
            )}
          </DetailSection>

          {current.state !== 'approved' && current.state !== 'rejected' && current.state !== 'cancelled' && (
            <DetailSection title="Actions">
              <Input placeholder="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              <div>
                <Label className="text-xs">Signature (optional)</Label>
                <FileUpload type="signature" label="Upload signature" accept="image/*" value={signatureUrl} onChange={setSignatureUrl} previewClassName="size-16" />
              </div>
              {current.status === 'Submitted' && isHod && (
                <Button size="sm" disabled={submitting} onClick={() => action('hod_approve')} className="bg-amber-600 hover:bg-amber-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve as HOD
                </Button>
              )}
              {current.status === 'HOD Approved' && isDfa && (
                <Button size="sm" disabled={submitting} onClick={() => action('dfa_approve')} className="bg-violet-600 hover:bg-violet-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} Approve as DFA
                </Button>
              )}
              {current.status === 'DFA Approved' && isCmd && (
                <Button size="sm" disabled={submitting} onClick={() => action('cmd_approve')} className="bg-green-600 hover:bg-green-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Final Approval (CMD)
                </Button>
              )}
              {(isHod || isDfa || isCmd) && (
                <>
                  <Label className="text-xs">Reject Reason</Label>
                  <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
                  <Button size="sm" disabled={submitting} variant="destructive" onClick={() => action('reject')}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Reject
                  </Button>
                </>
              )}
              {isOwner && (
                <Button size="sm" disabled={submitting} variant="outline" onClick={() => action('cancel')}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />} Cancel
                </Button>
              )}
            </DetailSection>
          )}
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || '—'}</span>
    </div>
  )
}

function ApprovalTile({ label, name, date, remarks, signatureUrl }: { label: string; name?: string | null; date?: string | null; remarks?: string | null; signatureUrl?: string | null }) {
  const signed = !!name
  return (
    <div className={`rounded border p-3 text-center ${signed ? 'bg-green-50 border-green-200' : 'bg-muted/30'}`}>
      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
        {signed ? <Check className="size-3 text-green-600" /> : <Clock className="size-3" />}
        {label}
      </div>
      {signed ? (
        <>
          {signatureUrl && <img src={signatureUrl} alt={`${label} signature`} className="mx-auto max-h-12 mt-2 object-contain" />}
          <div className="text-xs font-medium mt-1">{name}</div>
          <div className="text-[10px] text-muted-foreground">{formatDate(date)}</div>
          {remarks && <div className="text-[10px] text-muted-foreground italic mt-1">"{remarks}"</div>}
        </>
      ) : (
        <div className="text-[10px] text-muted-foreground mt-1">Awaiting</div>
      )}
    </div>
  )
}
