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
import {
  ArrowLeftRight, Plus, Search, Loader2, Check, X, Ban, Clock, FileCheck2, Printer, Download, ArrowRight,
} from 'lucide-react'
import { initials, formatDate } from '@/lib/formatters'
import { toast } from 'sonner'
import StaffSearch from './StaffSearch'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, signatureBox, htmlEscape, row } from '@/lib/print'

const statusColor: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-blue-100 text-blue-700',
  'Planning Reviewed': 'bg-cyan-100 text-cyan-700',
  'HOD Approved': 'bg-amber-100 text-amber-700',
  'DFA Approved': 'bg-violet-100 text-violet-700',
  'CMD Approved': 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-slate-200 text-slate-700',
  Completed: 'bg-emerald-100 text-emerald-700',
}

const typeLabel: Record<string, string> = {
  posting: 'Posting',
  transfer: 'Transfer',
  redeployment: 'Redeployment',
  secondment: 'Secondment',
}

type TabKey = 'all' | 'pending_my_approval' | 'mine' | 'approved' | 'rejected'

type Props = { user: any }

export default function PostingTransfer({ user }: Props) {
  const [tab, setTab] = useState<TabKey>('all')
  const [items, setItems] = useState<any[]>([])
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
      const [pRes, stRes, dRes, desRes] = await Promise.all([
        fetch(`/api/posting-transfer?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
        fetch('/api/departments', { cache: 'no-store' }),
        fetch('/api/designations', { cache: 'no-store' }),
      ])
      const pData = await pRes.json()
      const stData = await stRes.json()
      const dData = await dRes.json()
      const desData = await desRes.json()
      let list = pData.postings || []
      if (statusFilter !== 'all') list = list.filter((p: any) => p.status === statusFilter)
      if (typeFilter !== 'all') list = list.filter((p: any) => p.type === typeFilter)
      if (search) {
        const q = search.toLowerCase()
        list = list.filter((p: any) =>
          (p.refNumber || '').toLowerCase().includes(q) ||
          (p.staff?.fullName || '').toLowerCase().includes(q) ||
          (p.staff?.staffId || '').toLowerCase().includes(q) ||
          (p.reason || '').toLowerCase().includes(q)
        )
      }
      setItems(list)
      setStaff(stData.staff || [])
      setDepartments(dData.departments || [])
      setDesignations(desData.designations || [])
    } catch {
      toast.error('Failed to load postings/transfers')
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
            <ArrowLeftRight className="size-6" /> Posting &amp; Transfer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} postings/transfers · Planning → HOD → DFA → CMD workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!items.length}
            onClick={() => {
              const rows = items.map((p) => ({
                'Ref #': p.refNumber,
                Staff: p.staff?.fullName || '',
                'Staff ID': p.staff?.staffId || '',
                Type: typeLabel[p.type] || p.type,
                'From Dept': p.staff?.department?.name || p.fromDepartment?.name || '',
                'To Dept': p.toDepartment?.name || '',
                'From Position': p.fromPosition || '',
                'To Position': p.toPosition || '',
                'Effective Date': formatDate(p.effectiveDate),
                'Report Deadline': formatDate(p.reportDeadline),
                'Handover Date': formatDate(p.handoverDate),
                Reason: p.reason || '',
                'Planning Reviewed': p.planningReviewedAt ? formatDate(p.planningReviewedAt) : '',
                'HOD': p.hodName || '',
                'DFA': p.dfaName || '',
                'CMD': p.cmdName || '',
                Status: p.status,
                Created: p.createdAt ? new Date(p.createdAt).toLocaleString() : '',
              }))
              exportToExcel('FUTH_Postings', [{ name: 'Postings', rows }])
              toast.success(`Exported ${rows.length} postings`)
            }}
          >
            <Download className="size-4" /> Export
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New Posting
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
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search by ref #, staff, reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Submitted">Submitted</SelectItem>
              <SelectItem value="Planning Reviewed">Planning Reviewed</SelectItem>
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
              <SelectItem value="posting">Posting</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="redeployment">Redeployment</SelectItem>
              <SelectItem value="secondment">Secondment</SelectItem>
            </SelectContent>
          </Select>
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
                    <th className="text-left px-4 py-3 hidden lg:table-cell">From → To</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Effective</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No postings/transfers</td></tr>
                  ) : items.map((p) => (
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
                        <Badge variant="outline" className="text-[10px]">{typeLabel[p.type] || p.type}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs">
                        {p.staff?.department?.name || p.fromPosition || '—'}
                        <ArrowRight className="inline size-3 mx-1 text-muted-foreground" />
                        {p.toDepartment?.name || p.toPosition || '—'}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">{formatDate(p.effectiveDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor[p.status] || 'bg-gray-100'}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PostingCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        staff={staff}
        departments={departments}
        designations={designations}
        onSaved={() => { setCreating(false); load() }}
      />

      <PostingDetailSheet
        item={detail}
        user={user}
        onClose={() => setDetail(null)}
        onAction={() => { setDetail(null); load() }}
      />
    </div>
  )
}

function PostingCreateModal({ open, onClose, staff, departments, designations, onSaved }: {
  open: boolean; onClose: () => void; staff: any[]; departments: any[]; designations: any[]; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        staffId: '',
        type: 'posting',
        fromDepartmentId: 'none',
        fromUnitId: 'none',
        fromPosition: '',
        fromDesignationId: 'none',
        toDepartmentId: 'none',
        toUnitId: 'none',
        toPosition: '',
        toDesignationId: 'none',
        reason: '',
        detailedReason: '',
        effectiveDate: '',
        reportDeadline: '',
        handoverDate: '',
      })
    }
  }, [open])

  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.staffId || !form.reason || !form.effectiveDate) {
      toast.error('Staff, reason and effective date are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        fromDepartmentId: form.fromDepartmentId === 'none' ? null : form.fromDepartmentId,
        fromDesignationId: form.fromDesignationId === 'none' ? null : form.fromDesignationId,
        toDepartmentId: form.toDepartmentId === 'none' ? null : form.toDepartmentId,
        toDesignationId: form.toDesignationId === 'none' ? null : form.toDesignationId,
        reportDeadline: form.reportDeadline || null,
        handoverDate: form.handoverDate || null,
      }
      const res = await fetch('/api/posting-transfer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to create posting')
      else { toast.success(`Posting created: ${data.posting?.refNumber}`); onSaved() }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Posting / Transfer</DialogTitle>
          <DialogDescription>Submit a posting, transfer, redeployment or secondment request</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Staff Member *</Label>
              <StaffSearch  value={form.staffId} onChange={(v) => set('staffId', v)} placeholder="Search staff by name, ID, department..." />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="posting">Posting</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="redeployment">Redeployment</SelectItem>
                  <SelectItem value="secondment">Secondment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From Department</Label>
              <Select value={form.fromDepartmentId} onValueChange={(v) => set('fromDepartmentId', v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Designation</Label>
              <Select value={form.fromDesignationId} onValueChange={(v) => set('fromDesignationId', v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {designations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>From Position</Label>
            <Input value={form.fromPosition} onChange={(e) => set('fromPosition', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>To Department</Label>
              <Select value={form.toDepartmentId} onValueChange={(v) => set('toDepartmentId', v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Designation</Label>
              <Select value={form.toDesignationId} onValueChange={(v) => set('toDesignationId', v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {designations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>To Position</Label>
            <Input value={form.toPosition} onChange={(e) => set('toPosition', e.target.value)} />
          </div>
          <div>
            <Label>Reason *</Label>
            <Input value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Short reason..." />
          </div>
          <div>
            <Label>Detailed Reason</Label>
            <Textarea value={form.detailedReason} onChange={(e) => set('detailedReason', e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Effective Date *</Label><Input type="date" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} /></div>
            <div><Label>Report Deadline</Label><Input type="date" value={form.reportDeadline} onChange={(e) => set('reportDeadline', e.target.value)} /></div>
            <div><Label>Handover Date</Label><Input type="date" value={form.handoverDate} onChange={(e) => set('handoverDate', e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Submit Posting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PostingDetailSheet({ item, user, onClose, onAction }: { item: any | null; user: any; onClose: () => void; onAction: () => void }) {
  const [remarks, setRemarks] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [current, setCurrent] = useState<any>(null)

  useEffect(() => {
    if (item) {
      setCurrent(item)
      setRemarks(''); setRejectReason('')
    }
  }, [item])

  if (!current) return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md" />
    </Sheet>
  )

  const role = user?.activeRole || user?.role
  const isPlanning = ['SUPER_ADMIN', 'ADMIN', 'CMA', 'AD', 'HOD'].includes(role)
  const isHod = ['HOD', 'HOU', 'SUPER_ADMIN', 'ADMIN'].includes(role)
  const isDfa = ['DFA', 'SUPER_ADMIN', 'ADMIN'].includes(role)
  const isCmd = role === 'CMD' || role === 'SUPER_ADMIN'
  const isOwner = current.createdById === user.id

  const action = async (a: string) => {
    setSubmitting(true)
    try {
      const payload: any = { action: a, remarks }
      if (a === 'reject') payload.rejectReason = rejectReason || remarks
      const res = await fetch(`/api/posting-transfer/${current.id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Action completed'); setCurrent(data.posting); onAction() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white text-lg">Posting {current.refNumber}</SheetTitle>
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
                const subLine = 'HUMAN RESOURCES MANAGEMENT SYSTEM · Posting Letter'
                const html =
                  printHeader(institution, subLine, current.refNumber, 'Posting / Transfer Letter') +
                  `
                  <div class="grid" style="margin-bottom: 14px;">
                    <div class="section">
                      <h3>Staff Details</h3>
                      ${row('Name', current.staff?.fullName)}
                      ${row('Staff ID', current.staff?.staffId)}
                      ${row('Current Department', current.staff?.department?.name || current.fromDepartment?.name)}
                    </div>
                    <div class="section">
                      <h3>Posting Details</h3>
                      ${row('Type', typeLabel[current.type] || current.type)}
                      ${row('Effective Date', formatDate(current.effectiveDate))}
                      ${row('Report Deadline', formatDate(current.reportDeadline))}
                      ${row('Handover Date', formatDate(current.handoverDate))}
                    </div>
                  </div>
                  <div class="section">
                    <h3>From</h3>
                    ${row('Department', current.staff?.department?.name || current.fromDepartment?.name)}
                    ${row('Position', current.fromPosition)}
                    ${row('Designation', current.fromDesignation?.name)}
                  </div>
                  <div class="section">
                    <h3>To</h3>
                    ${row('Department', current.toDepartment?.name)}
                    ${row('Position', current.toPosition)}
                    ${row('Designation', current.toDesignation?.name)}
                  </div>
                  <div class="section">
                    <h3>Reason</h3>
                    <p>${htmlEscape(current.reason || '—')}</p>
                    ${current.detailedReason ? `<p style="margin-top:6px;">${htmlEscape(current.detailedReason)}</p>` : ''}
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
                await printHTML(html, `Posting ${current.refNumber}`)
              }}
            >
              <Printer className="size-4" /> Print Posting Letter
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge className={`${statusColor[current.status] || ''} border`}>{current.status}</Badge>
          </div>

          <Section title="Staff Details">
            <Row label="Name" value={current.staff?.fullName} />
            <Row label="Staff ID" value={current.staff?.staffId} />
          </Section>

          <Section title="Posting Details">
            <Row label="Type" value={typeLabel[current.type] || current.type} />
            <Row label="Effective Date" value={formatDate(current.effectiveDate)} />
            <Row label="Report Deadline" value={formatDate(current.reportDeadline)} />
            <Row label="Handover Date" value={formatDate(current.handoverDate)} />
            <Row label="Reason" value={current.reason} />
            {current.detailedReason && (
              <div><Label className="text-xs text-muted-foreground">Detailed Reason</Label><p className="text-sm">{current.detailedReason}</p></div>
            )}
          </Section>

          <Section title="From → To">
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded p-3">
                <div className="text-xs text-muted-foreground uppercase mb-2">From</div>
                <Row label="Department" value={current.staff?.department?.name || current.fromDepartment?.name || '—'} />
                <Row label="Position" value={current.fromPosition || '—'} />
                <Row label="Designation" value={current.fromDesignation?.name || '—'} />
              </div>
              <div className="border rounded p-3">
                <div className="text-xs text-muted-foreground uppercase mb-2">To</div>
                <Row label="Department" value={current.toDepartment?.name || '—'} />
                <Row label="Position" value={current.toPosition || '—'} />
                <Row label="Designation" value={current.toDesignation?.name || '—'} />
              </div>
            </div>
          </Section>

          <Section title="Approval Workflow">
            <div className="grid grid-cols-4 gap-2">
              <ApprovalTile label="Planning" name={current.planningReviewedAt ? 'Reviewed' : null} date={current.planningReviewedAt} />
              <ApprovalTile label="HOD" name={current.hodName} date={current.hodSignedAt} signatureUrl={current.hodSignatureUrl} />
              <ApprovalTile label="DFA" name={current.dfaName} date={current.dfaSignedAt} signatureUrl={current.dfaSignatureUrl} />
              <ApprovalTile label="CMD" name={current.cmdName} date={current.cmdSignedAt} signatureUrl={current.cmdSignatureUrl} />
            </div>
            {current.rejectedById && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
                <div className="font-medium text-red-700">Rejected</div>
                {current.rejectReason && <div className="text-xs mt-1">{current.rejectReason}</div>}
              </div>
            )}
            {current.planningRemarks && (
              <div className="rounded border p-3 text-sm">
                <div className="font-medium">Planning Remarks</div>
                <div className="text-xs mt-1">{current.planningRemarks}</div>
              </div>
            )}
          </Section>

          {current.state !== 'approved' && current.state !== 'rejected' && current.state !== 'cancelled' && (
            <Section title="Actions">
              <Input placeholder="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              {current.status === 'Submitted' && isPlanning && (
                <Button size="sm" disabled={submitting} onClick={() => action('planning_review')} className="bg-cyan-600 hover:bg-cyan-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Planning Review
                </Button>
              )}
              {current.status === 'Planning Reviewed' && isHod && (
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
              {(isPlanning || isHod || isDfa || isCmd) && (
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
            </Section>
          )}
        </div>
        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

function ApprovalTile({ label, name, date, signatureUrl }: { label: string; name?: string | null; date?: string | null; signatureUrl?: string | null }) {
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
        </>
      ) : (
        <div className="text-[10px] text-muted-foreground mt-1">Awaiting</div>
      )}
    </div>
  )
}
