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
  Plane, Plus, Search, Loader2, Check, X, Ban, Clock, FileCheck2, Printer, Download,
  Send, ArrowLeftRight, CheckCircle2, ChevronRight,
} from 'lucide-react'
import { initials, formatDate } from '@/lib/formatters'
import { toast } from 'sonner'
import FileUpload from './FileUpload'
import StaffSearch from './StaffSearch'
import UserSearch from './UserSearch'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, signatureBox, formatDateForPrint, htmlEscape, row } from '@/lib/print'

const statusColor: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  'HOU Approved': 'bg-blue-100 text-blue-700',
  'HOD Approved': 'bg-cyan-100 text-cyan-700',
  'HOD Approved': 'bg-blue-100 text-blue-700',
  'Registry Received': 'bg-violet-100 text-violet-700',
  'Forwarded to DFA': 'bg-indigo-100 text-indigo-700',
  'Forwarded to CMD': 'bg-indigo-100 text-indigo-700',
  'Forwarded to AD': 'bg-indigo-100 text-indigo-700',
  'Forwarded': 'bg-indigo-100 text-indigo-700',
  Completed: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-200 text-gray-700',
}

const stageColor: Record<string, string> = {
  Submitted: 'bg-amber-100 text-amber-700',
  'HOU Review': 'bg-blue-100 text-blue-700',
  'HOD Review': 'bg-cyan-100 text-cyan-700',
  Registry: 'bg-violet-100 text-violet-700',
  Forwarded: 'bg-indigo-100 text-indigo-700',
  Completed: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-200 text-gray-700',
}

type TabKey = 'all' | 'pending_my_approval' | 'mine' | 'approved' | 'rejected'

type Props = {
  user: any
  onNavigate?: (v: any) => void
}

function daysBetween(start: Date, end: Date): number {
  if (!start || !end) return 0
  const ms = end.getTime() - start.getTime()
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1)
}

export default function Leaves({ user }: Props) {
  const [tab, setTab] = useState<TabKey>('all')
  const [leaves, setLeaves] = useState<any[]>([])
  const [leaveTypes, setLeaveTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab })
      if (search) params.set('q', search)
      const [lvRes, ltRes] = await Promise.all([
        fetch(`/api/leaves?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/leave-types', { cache: 'no-store' }),
      ])
      const lvData = await lvRes.json()
      const ltData = await ltRes.json()
      let list = lvData.leaves || []
      if (statusFilter !== 'all') list = list.filter((l: any) => l.status === statusFilter)
      setLeaves(list)
      setLeaveTypes(ltData.leaveTypes || [])
    } catch {
      toast.error('Failed to load leaves')
    }
    setLoading(false)
  }, [tab, search, statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plane className="size-6" /> Leave Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {leaves.length} leave applications · {leaveTypes.length} leave types
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = leaves.map((l) => ({
                'Ref #': l.refNumber,
                'Staff': l.staff?.fullName || '',
                'Staff ID': l.staff?.staffId || '',
                'Leave Type': l.leaveType?.name || '',
                'Start Date': formatDate(l.startDate),
                'End Date': formatDate(l.endDate),
                'Days Requested': l.daysRequested,
                'Days Approved': l.daysApproved ?? '',
                'Current Stage': l.currentStage || '',
                'Current Holder': l.currentHolder?.fullName || '',
                'Status': l.status,
                'State': l.state,
                'Reason': l.reason,
                'Phone': l.phone || '',
                'HOU Name': l.houName || '',
                'HOD Name': l.hodName || '',
                'Registry Name': l.registryName || '',
                'DFA Name': l.dfaName || '',
                'CMD Name': l.cmdName || '',
                'Created At': l.createdAt ? new Date(l.createdAt).toLocaleString() : '',
              }))
              exportToExcel('FUTH_Leaves', [{ name: 'Leaves', rows }])
              toast.success(`Exported ${rows.length} leaves`)
            }}
            disabled={!leaves.length}
          >
            <Download className="size-4" /> Export to Excel
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Apply for Leave
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="pending_my_approval" className="text-xs">Pending My Action</TabsTrigger>
          <TabsTrigger value="mine" className="text-xs">Applied By Me</TabsTrigger>
          <TabsTrigger value="approved" className="text-xs">Completed</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search by ref #, staff, leave type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="HOU Approved">HOU Approved</SelectItem>
                <SelectItem value="HOD Approved">HOD Approved</SelectItem>
                <SelectItem value="Registry Received">Registry Received</SelectItem>
                <SelectItem value="Forwarded">Forwarded</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
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
                    <th className="text-left px-4 py-3 hidden md:table-cell">Leave Type</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Start</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">End</th>
                    <th className="text-center px-4 py-3">Days</th>
                    <th className="text-center px-4 py-3">Stage</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Current Holder</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">No leave applications</td></tr>
                  ) : leaves.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setDetail(l)}>
                      <td className="px-4 py-3 font-mono text-xs">{l.refNumber}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="bg-primary/15 text-primary text-[9px]">{initials(l.staff?.fullName || '?')}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{l.staff?.fullName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">{l.leaveType?.name || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">{formatDate(l.startDate)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">{formatDate(l.endDate)}</td>
                      <td className="px-4 py-3 text-center">{l.daysApproved || l.daysRequested}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${stageColor[l.currentStage] || 'bg-gray-100'}`}>{l.currentStage || l.status}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">
                        {l.currentHolder ? (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3 text-amber-500" />
                            {l.currentHolder.fullName}
                            <span className="text-muted-foreground">({l.currentHolder.role.replace('_', ' ')})</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{formatDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply modal */}
      <ApplyModal
        open={creating}
        onClose={() => setCreating(false)}
        leaveTypes={leaveTypes}
        user={user}
        onSaved={() => { setCreating(false); load() }}
      />

      {/* Detail sheet */}
      <LeaveDetailSheet
        item={detail}
        user={user}
        onClose={() => setDetail(null)}
        onAction={() => { setDetail(null); load() }}
      />
    </div>
  )
}

function ApplyModal({ open, onClose, leaveTypes, user, onSaved }: { open: boolean; onClose: () => void; leaveTypes: any[]; user: any; onSaved: () => void }) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        staffId: user?.staffId || '',
        leaveTypeId: '',
        startDate: '',
        endDate: '',
        reason: '',
        address: '',
        phone: '',
        certificateUrl: '',
      })
    }
  }, [open, user])

  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }))

  const days = form.startDate && form.endDate ? daysBetween(new Date(form.startDate), new Date(form.endDate)) : 0
  const selectedType = leaveTypes.find((t) => t.id === form.leaveTypeId)

  const save = async () => {
    if (!form.staffId || !form.leaveTypeId || !form.startDate || !form.endDate || !form.reason) {
      toast.error('Staff, leave type, dates and reason are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to apply')
      else { toast.success(`Leave applied: ${data.leave?.refNumber}. Routed to ${data.leave?.currentStage || 'HOU Review'}.`); onSaved() }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
          <DialogDescription>Submit a leave application — will be auto-routed to Head of Unit → Head of Department → Registry</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Staff Member *</Label>
            <StaffSearch value={form.staffId} onChange={(v) => set('staffId', v)} placeholder="Search staff by name, ID, department..." />
          </div>
          <div>
            <Label>Leave Type *</Label>
            <Select value={form.leaveTypeId} onValueChange={(v) => set('leaveTypeId', v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {leaveTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.defaultDays} days){t.requiresCertificate ? ' · Certificate required' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></div>
            <div><Label>End Date *</Label><Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></div>
          </div>
          {days > 0 && <p className="text-xs text-muted-foreground">Total days: <Badge variant="outline">{days}</Badge></p>}
          <div>
            <Label>Reason *</Label>
            <Textarea value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Brief description of leave reason..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Address while on leave</Label><Input value={form.address} onChange={(e) => set('address', e.target.value)} /></div>
            <div><Label>Phone (reachable)</Label><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          </div>
          {selectedType?.requiresCertificate && (
            <div>
              <Label className="mb-1.5 block">Certificate (required for {selectedType.name})</Label>
              <FileUpload type="certificate" label="Upload certificate" accept="image/*,application/pdf" value={form.certificateUrl} onChange={(url) => set('certificateUrl', url)} previewClassName="size-16" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Submit Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LeaveDetailSheet({ item, user, onClose, onAction }: { item: any | null; user: any; onClose: () => void; onAction: () => void }) {
  const [remarks, setRemarks] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [daysApproved, setDaysApproved] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [forwardTargetId, setForwardTargetId] = useState('')

  useEffect(() => {
    if (item) {
      setCurrent(item)
      setRemarks(''); setRejectReason('')
      setDaysApproved(item.daysRequested || 0)
      setForwardTargetId('')
    }
  }, [item])

  if (!current) return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md" />
    </Sheet>
  )

  const role = user?.activeRole || user?.role || 'STAFF'
  const isSuper = ['SUPER_ADMIN', 'ADMIN'].includes(role)
  const isHOU = role === 'HOU' || isSuper
  const isHOD = role === 'HOD' || isSuper
  const isRegistry = role === 'REGISTRY_OFFICER' || isSuper
  const isOwner = current.createdBy === user.id
  const isCurrentHolder = current.currentHolderId === user.id

  const action = async (a: string, extra?: any) => {
    setSubmitting(true)
    try {
      const payload: any = { action: a, remarks, ...extra }
      if (a === 'reject') payload.rejectReason = rejectReason || remarks
      const res = await fetch(`/api/leaves/${current.id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Action completed'); setCurrent(data.leave); onAction() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const stage = current.currentStage || 'Submitted'
  const isActive = !['Completed', 'Rejected', 'Cancelled'].includes(stage)

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white text-lg">Leave Application {current.refNumber}</SheetTitle>
          <SheetDescription className="text-white/80">
            {current.staff?.fullName} · {current.leaveType?.name}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 space-y-4">
          {/* Print button */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
                const subLine = 'HUMAN RESOURCES MANAGEMENT SYSTEM · Leave Application'
                const html =
                  printHeader(institution, subLine, current.refNumber, 'Leave Application') +
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
                      <h3>Leave Details</h3>
                      ${row('Leave Type', current.leaveType?.name)}
                      ${row('Start Date', formatDate(current.startDate))}
                      ${row('End Date', formatDate(current.endDate))}
                      ${row('Days Requested', current.daysRequested)}
                      ${row('Days Approved', current.daysApproved ?? '—')}
                      ${row('Status', current.status)}
                      ${row('Current Stage', current.currentStage)}
                      ${row('Current Holder', current.currentHolder?.fullName)}
                    </div>
                  </div>
                  <div class="section">
                    <h3>Reason</h3>
                    <p>${htmlEscape(current.reason)}</p>
                  </div>
                  <div class="section">
                    <h3>Contact While on Leave</h3>
                    ${row('Address', current.address)}
                    ${row('Phone', current.phone)}
                  </div>
                  ${current.certificateUrl ? `<div class="section"><h3>Certificate</h3><img src="${current.certificateUrl}" style="max-width:300px; max-height:200px;"/></div>` : ''}
                  <div class="section">
                    <h3>Routing Trail</h3>
                    <table>
                      <thead><tr><th>Date</th><th>Stage</th><th>From</th><th>To</th><th>Action</th><th>Remarks</th></tr></thead>
                      <tbody>
                        ${(current.routes || []).map((r: any) => `<tr>
                          <td>${formatDate(r.createdAt)}</td>
                          <td>${r.stage}</td>
                          <td>${r.fromUser?.fullName || '—'}</td>
                          <td>${r.toUser?.fullName || '—'}</td>
                          <td>${r.action}</td>
                          <td>${htmlEscape(r.remarks || '')}</td>
                        </tr>`).join('')}
                      </tbody>
                    </table>
                  </div>
                  <div class="section">
                    <h3>Signatures</h3>
                    <div>
                      ${signatureBox('Staff', current.staff?.fullName, current.createdAt, null)}
                      ${signatureBox('HOU', current.houName, current.houSignedAt, null)}
                      ${signatureBox('HOD', current.hodName, current.hodSignedAt, null)}
                      ${signatureBox('Registry', current.registryName, current.registryReceivedAt, null)}
                      ${signatureBox('DFA', current.dfaName, current.dfaSignedAt, null)}
                      ${signatureBox('CMD', current.cmdName, current.cmdSignedAt, null)}
                    </div>
                  </div>
                  `
                await printHTML(html, `Leave ${current.refNumber}`)
              }}
            >
              <Printer className="size-4" /> Print Leave Application
            </Button>
          </div>

          {/* Current status + stage */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={`${stageColor[stage] || ''} border`}>{stage}</Badge>
            <Badge variant="outline">{current.status}</Badge>
            {current.currentHolder && (
              <span className="text-sm flex items-center gap-1">
                <Clock className="size-3.5 text-amber-500" />
                Currently with: <strong>{current.currentHolder.fullName}</strong> ({current.currentHolder.role.replace('_', ' ')})
              </span>
            )}
          </div>

          {/* Leave details */}
          <Section title="Leave Details">
            <Row label="Leave Type" value={current.leaveType?.name} />
            <Row label="Start Date" value={formatDate(current.startDate)} />
            <Row label="End Date" value={formatDate(current.endDate)} />
            <Row label="Days Requested" value={current.daysRequested} />
            <Row label="Days Approved" value={current.daysApproved ?? '—'} />
            <Row label="Reason" value={current.reason} />
            <Row label="Address on leave" value={current.address} />
            <Row label="Reachable Phone" value={current.phone} />
            {current.certificateUrl && (
              <div>
                <Label className="text-xs">Certificate</Label>
                <img src={current.certificateUrl} alt="certificate" className="mt-1 max-h-32 rounded border" />
              </div>
            )}
          </Section>

          {/* Routing Trail */}
          <Section title={`Routing Trail (${current.routes?.length || 0})`}>
            {(current.routes || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No routing records yet.</p>
            ) : (
              <div className="space-y-2">
                {(current.routes || []).map((r: any, i: number) => (
                  <div key={r.id} className="flex items-start gap-3 text-xs border-l-2 border-primary/30 pl-3 pb-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="size-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px]">
                        {i + 1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{r.stage}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{r.action.replace(/_/g, ' ')}</Badge>
                      </div>
                      <div className="text-muted-foreground mt-1">
                        <strong>{r.fromUser?.fullName || '—'}</strong> → <strong>{r.toUser?.fullName || '—'}</strong>
                      </div>
                      {r.remarks && <div className="text-muted-foreground italic mt-0.5">"{r.remarks}"</div>}
                      <div className="text-[10px] text-muted-foreground mt-0.5">{formatDate(r.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Action section */}
          {isActive && (
            <Section title="Actions">
              <Input placeholder="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

              {/* Stage: HOU Review → HOU approves */}
              {stage === 'HOU Review' && isHOU && (
                <Button size="sm" disabled={submitting} onClick={() => action('hou_approve')} className="bg-blue-600 hover:bg-blue-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve as Head of Unit
                </Button>
              )}

              {/* Stage: HOD Review → HOD approves → routes to Registry */}
              {stage === 'HOD Review' && isHOD && (
                <Button size="sm" disabled={submitting} onClick={() => action('hod_approve')} className="bg-cyan-600 hover:bg-cyan-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve as Head of Department
                </Button>
              )}

              {/* Stage: Registry → Registry forwards to whoever they choose */}
              {stage === 'Registry' && isRegistry && (
                <div className="space-y-2 rounded border border-violet-200 bg-violet-50 p-3">
                  <div className="text-xs font-medium text-violet-700">Registry — Forward to:</div>
                  <p className="text-[11px] text-muted-foreground">Select who to forward this leave to (DFA, CMD, AD, etc.). They will review and return it to you.</p>
                  <UserSearch
                    users={[]}
                    value={forwardTargetId}
                    onChange={setForwardTargetId}
                    filter={(u) => !['STAFF', 'REGISTRY_OFFICER'].includes(u.role)}
                    placeholder="Search user to forward to (DFA, CMD, AD, etc.)..."
                  />
                  <Button
                    size="sm"
                    disabled={submitting || !forwardTargetId}
                    onClick={() => action('forward', { targetUserId: forwardTargetId })}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Forward to Selected User
                  </Button>
                  <div className="border-t pt-2 mt-2">
                    <Label className="text-xs">Days Approved (optional)</Label>
                    <Input type="number" value={daysApproved} onChange={(e) => setDaysApproved(Number(e.target.value))} className="mt-1" />
                    <Button
                      size="sm"
                      disabled={submitting}
                      onClick={() => action('complete', { daysApproved })}
                      className="bg-green-600 hover:bg-green-700 mt-2"
                    >
                      {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Complete & Close
                    </Button>
                  </div>
                </div>
              )}

              {/* Stage: Forwarded → Forwarded approver returns to Registry */}
              {stage === 'Forwarded' && isCurrentHolder && (
                <Button size="sm" disabled={submitting} onClick={() => action('return_to_registry')} className="bg-indigo-600 hover:bg-indigo-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />} Return to Registry
                </Button>
              )}

              {/* Reject — available to any current holder */}
              {isCurrentHolder && (
                <>
                  <Label className="text-xs">Reject Reason</Label>
                  <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
                  <Button size="sm" disabled={submitting} variant="destructive" onClick={() => action('reject')}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Reject
                  </Button>
                </>
              )}

              {/* Cancel — available to creator */}
              {isOwner && (
                <Button size="sm" disabled={submitting} variant="outline" onClick={() => action('cancel')}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />} Cancel Application
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
