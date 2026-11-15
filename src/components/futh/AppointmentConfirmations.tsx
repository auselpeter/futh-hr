'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
  FileCheck2, Plus, Search, Loader2, Check, X, Ban, Clock, Printer, Download, CalendarClock, FileText, ExternalLink,
} from 'lucide-react'
import { initials, formatDate } from '@/lib/formatters'
import { toast } from 'sonner'
import FileUpload from './FileUpload'
import StaffSearch from './StaffSearch'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, signatureBox, formatDateForPrint, htmlEscape, row } from '@/lib/print'

// Status badge colours (per project spec)
const statusColor: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-amber-100 text-amber-700',
  'HOD Approved': 'bg-blue-100 text-blue-700',
  'DFA Approved': 'bg-indigo-100 text-indigo-700',
  'CMD Approved': 'bg-emerald-100 text-emerald-700',
  Completed: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-orange-100 text-orange-700',
}

const stateColor: Record<string, string> = {
  open: 'bg-sky-100 text-sky-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-800',
}

type TabKey = 'all' | 'pending_my_approval' | 'mine' | 'approved' | 'rejected'

type Props = {
  user: any
}

export default function AppointmentConfirmations({ user }: Props) {
  const [tab, setTab] = useState<TabKey>('all')
  const [confirmations, setConfirmations] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)

  // STAFF users are restricted to their own confirmations only.
  const role = user?.activeRole || user?.role
  const isStaffRole = role === 'STAFF'

  const effectiveTab: TabKey = useMemo(() => {
    if (isStaffRole) return 'mine'
    return tab
  }, [isStaffRole, tab])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab: effectiveTab })
      if (search) params.set('q', search)
      const [confRes, stRes] = await Promise.all([
        fetch(`/api/appointment-confirmations?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
      ])
      const confData = await confRes.json()
      const stData = await stRes.json()
      let list = confData.confirmations || []
      if (statusFilter !== 'all') list = list.filter((c: any) => c.status === statusFilter)
      setConfirmations(list)
      setStaff(stData.staff || [])
    } catch {
      toast.error('Failed to load appointment confirmations')
    }
    setLoading(false)
  }, [effectiveTab, search, statusFilter])

  useEffect(() => { load() }, [load])

  const canCreate =
    role === 'REGISTRY_OFFICER' ||
    role === 'PLANNING_OFFICER' ||
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'HOD' ||
    role === 'DFA' ||
    role === 'CMD'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCheck2 className="size-6" /> Appointment Confirmations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {confirmations.length} confirmation records · HOD → DFA → CMD workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = confirmations.map((c) => ({
                'Ref #': c.refNumber,
                'Staff': c.staff?.fullName || '',
                'Staff ID': c.staff?.staffId || '',
                'Department': c.staff?.department?.name || '',
                'Date of First Appointment': formatDate(c.dateOfFirstAppointment),
                'Date Hired': formatDate(c.dateHired),
                'Expected Confirmation': formatDate(c.expectedConfirmationDate),
                'Actual Confirmation': formatDate(c.actualConfirmationDate),
                'Service Years Req.': c.serviceYearsRequired ?? '',
                'Current Position': c.currentPosition || '',
                'Current Rank': c.currentRank || '',
                'Current Grade Level': c.currentGradeLevel || '',
                'New Grade Level': c.newGradeLevel || '',
                'New Step': c.newStep || '',
                'Status': c.status,
                'State': c.state,
                'HOD': c.hodName || '',
                'DFA': c.dfaName || '',
                'CMD': c.cmdName || '',
                'Justification': c.justification || '',
                'Remarks': c.remarks || '',
                'Created At': c.createdAt ? new Date(c.createdAt).toLocaleString() : '',
              }))
              exportToExcel('FUTH_Appointment_Confirmations', [{ name: 'Confirmations', rows }])
              toast.success(`Exported ${rows.length} confirmations`)
            }}
            disabled={!confirmations.length}
          >
            <Download className="size-4" /> Export to Excel
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New Confirmation
            </Button>
          )}
        </div>
      </div>

      <Tabs value={effectiveTab} onValueChange={(v) => !isStaffRole && setTab(v as TabKey)}>
        <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="all" className="text-xs" disabled={isStaffRole}>All</TabsTrigger>
          <TabsTrigger value="pending_my_approval" className="text-xs" disabled={isStaffRole}>Pending My Approval</TabsTrigger>
          <TabsTrigger value="mine" className="text-xs">Submitted by Me</TabsTrigger>
          <TabsTrigger value="approved" className="text-xs" disabled={isStaffRole}>Approved</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs" disabled={isStaffRole}>Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by ref #, staff name, staff ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
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
                    <th className="text-left px-4 py-3 hidden md:table-cell">Current Position</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Expected Confirmation</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted-foreground">No appointment confirmations</td>
                    </tr>
                  ) : confirmations.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => setDetail(c)}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{c.refNumber}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="bg-primary/15 text-primary text-[9px]">
                              {initials(c.staff?.fullName || '?')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="leading-tight">
                            <div className="font-medium">{c.staff?.fullName || '—'}</div>
                            <div className="text-[10px] text-muted-foreground">{c.staff?.staffId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">
                        {c.currentPosition || c.staff?.position || '—'}
                        {c.staff?.department?.code && (
                          <span className="text-muted-foreground"> · {c.staff.department.code}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">
                        {formatDate(c.expectedConfirmationDate)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor[c.status] || 'bg-gray-100'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        staff={staff}
        onSaved={() => { setCreating(false); load() }}
      />

      <ConfirmationDetailSheet
        item={detail}
        user={user}
        onClose={() => setDetail(null)}
        onAction={() => { setDetail(null); load() }}
      />
    </div>
  )
}

// ============================================================
// Create Modal
// ============================================================
function ConfirmationCreateModal({ open, onClose, staff, onSaved }: {
  open: boolean
  onClose: () => void
  staff: any[]
  onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        staffId: '',
        dateOfFirstAppointment: '',
        serviceYearsRequired: 2,
        justification: '',
        remarks: '',
        confirmationLetterUrl: '',
        assessmentFormUrl: '',
      })
    }
  }, [open])

  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }))

  // Auto-fill dateOfFirstAppointment from staff.dateHired if the user hasn't picked one.
  useEffect(() => {
    if (form.staffId) {
      const s = staff.find((x) => x.id === form.staffId)
      if (s && !form.dateOfFirstAppointment && s.dateHired) {
        const dh = new Date(s.dateHired)
        if (!isNaN(dh.getTime())) {
          setForm((prev: any) => ({ ...prev, dateOfFirstAppointment: dh.toISOString().slice(0, 10) }))
        }
      }
    }
  }, [form.staffId, staff, form.dateOfFirstAppointment])

  // Auto-compute expectedConfirmationDate = dateOfFirstAppointment + serviceYearsRequired
  const expectedConfirmationDate = useMemo(() => {
    if (!form.dateOfFirstAppointment) return ''
    const d = new Date(form.dateOfFirstAppointment)
    if (isNaN(d.getTime())) return ''
    const yrs = Number(form.serviceYearsRequired) || 0
    d.setFullYear(d.getFullYear() + yrs)
    return d.toISOString().slice(0, 10)
  }, [form.dateOfFirstAppointment, form.serviceYearsRequired])

  const save = async () => {
    if (!form.staffId) {
      toast.error('Please select a staff member')
      return
    }
    if (!form.dateOfFirstAppointment) {
      toast.error('Date of first appointment is required')
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        staffId: form.staffId,
        dateOfFirstAppointment: form.dateOfFirstAppointment,
        serviceYearsRequired: Number(form.serviceYearsRequired) || 2,
        justification: form.justification || undefined,
        remarks: form.remarks || undefined,
        confirmationLetterUrl: form.confirmationLetterUrl || undefined,
        assessmentFormUrl: form.assessmentFormUrl || undefined,
        expectedConfirmationDate: expectedConfirmationDate || undefined,
      }
      const res = await fetch('/api/appointment-confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to create confirmation')
      else { toast.success(`Confirmation created: ${data.confirmation?.refNumber}`); onSaved() }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Appointment Confirmation</DialogTitle>
          <DialogDescription>
            Submit a confirmation-of-appointment request for HOD → DFA → CMD approval.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Staff Member *</Label>
            <StaffSearch
              staff={staff}
              value={form.staffId}
              onChange={(v) => set('staffId', v)}
              placeholder="Search staff by name, ID, department..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date of First Appointment *</Label>
              <Input
                type="date"
                value={form.dateOfFirstAppointment}
                onChange={(e) => set('dateOfFirstAppointment', e.target.value)}
              />
            </div>
            <div>
              <Label>Service Years Required</Label>
              <Input
                type="number"
                min={0}
                value={form.serviceYearsRequired}
                onChange={(e) => set('serviceYearsRequired', e.target.value)}
              />
            </div>
          </div>
          {expectedConfirmationDate && (
            <div className="rounded border bg-muted/40 p-2 text-xs flex items-center gap-2">
              <CalendarClock className="size-3.5 text-primary" />
              <span className="text-muted-foreground">Auto-computed expected confirmation date:</span>
              <span className="font-medium">{formatDate(expectedConfirmationDate)}</span>
            </div>
          )}
          <div>
            <Label>Justification</Label>
            <Textarea
              rows={3}
              placeholder="Why this confirmation should be processed..."
              value={form.justification}
              onChange={(e) => set('justification', e.target.value)}
            />
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea
              rows={2}
              placeholder="Internal notes / context (optional)"
              value={form.remarks}
              onChange={(e) => set('remarks', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Confirmation Letter (optional)</Label>
              <FileUpload
                type="document"
                accept="image/*,.pdf,.doc,.docx"
                label="Upload letter"
                value={form.confirmationLetterUrl}
                onChange={(url: string) => set('confirmationLetterUrl', url)}
                previewClassName="size-20"
              />
            </div>
            <div>
              <Label>Assessment Form (optional)</Label>
              <FileUpload
                type="document"
                accept="image/*,.pdf,.doc,.docx"
                label="Upload form"
                value={form.assessmentFormUrl}
                onChange={(url: string) => set('assessmentFormUrl', url)}
                previewClassName="size-20"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Submit Confirmation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Detail Sheet
// ============================================================
function ConfirmationDetailSheet({ item, user, onClose, onAction }: {
  item: any | null
  user: any
  onClose: () => void
  onAction: () => void
}) {
  const [current, setCurrent] = useState<any>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      // Fetch full detail (includes staff.designation) when the sheet opens.
      setCurrent(item)
      fetch(`/api/appointment-confirmations/${item.id}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => { if (d.confirmation) setCurrent(d.confirmation) })
        .catch(() => { /* keep list-row data as fallback */ })
      setPendingAction(null)
    } else {
      setCurrent(null)
    }
  }, [item])

  if (!current) {
    return (
      <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl" />
      </Sheet>
    )
  }

  const role = user?.activeRole || user?.role
  const isHod = role === 'HOD' || role === 'HOU' || role === 'SUPER_ADMIN' || role === 'ADMIN'
  const isDfa = role === 'DFA' || role === 'SUPER_ADMIN' || role === 'ADMIN'
  const isCmd = role === 'CMD' || role === 'SUPER_ADMIN'
  const isRegistryOrAdmin =
    role === 'REGISTRY_OFFICER' || role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'CMD'
  const isOwner = current.createdById === user?.id
  const canDelete =
    (isOwner || role === 'SUPER_ADMIN' || role === 'ADMIN') &&
    ['Draft', 'Submitted', 'Rejected', 'Cancelled'].includes(current.status)

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white text-lg flex items-center gap-2 flex-wrap">
            <span>Confirmation {current.refNumber}</span>
            <Badge className={`${statusColor[current.status] || ''} border border-white/20`}>{current.status}</Badge>
            <Badge className={`${stateColor[current.state] || ''} border border-white/20 capitalize`}>{current.state}</Badge>
          </SheetTitle>
          <SheetDescription className="text-white/80">
            {current.staff?.fullName}
            {current.staff?.staffId ? ` · ${current.staff.staffId}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="p-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
                const subLine = 'HUMAN RESOURCES MANAGEMENT SYSTEM · Confirmation of Appointment'
                const html =
                  printHeader(institution, subLine, current.refNumber, 'Confirmation of Appointment') +
                  `
                  <div class="grid" style="margin-bottom: 14px;">
                    <div class="section">
                      <h3>Staff Details</h3>
                      ${row('Name', current.staff?.fullName)}
                      ${row('Staff ID', current.staff?.staffId)}
                      ${row('Department', current.staff?.department?.name)}
                      ${row('Current Position', current.currentPosition || current.staff?.position)}
                      ${row('Current Rank', current.currentRank || current.staff?.rank)}
                      ${row('Date Hired', formatDate(current.dateHired || current.staff?.dateHired))}
                      ${row('Retirement Date', formatDate(current.staff?.retirementDate))}
                    </div>
                    <div class="section">
                      <h3>Confirmation Details</h3>
                      ${row('Date of First Appointment', formatDate(current.dateOfFirstAppointment))}
                      ${row('Expected Confirmation Date', formatDate(current.expectedConfirmationDate))}
                      ${row('Actual Confirmation Date', formatDate(current.actualConfirmationDate))}
                      ${row('Service Years Required', current.serviceYearsRequired)}
                      ${row('Current Grade Level', current.currentGradeLevel)}
                      ${row('New Grade Level', current.newGradeLevel)}
                      ${row('New Step', current.newStep)}
                    </div>
                  </div>
                  <div class="section">
                    <h3>Justification & Remarks</h3>
                    <p><strong>Justification:</strong> ${htmlEscape(current.justification || '—')}</p>
                    <p><strong>Remarks:</strong> ${htmlEscape(current.remarks || '—')}</p>
                  </div>
                  <div class="section">
                    <h3>Approval Signatures</h3>
                    <div>
                      ${signatureBox('HOD', current.hodName, current.hodSignedAt, current.hodSignatureUrl)}
                      ${signatureBox('DFA', current.dfaName, current.dfaSignedAt, current.dfaSignatureUrl)}
                      ${signatureBox('CMD', current.cmdName, current.cmdSignedAt, current.cmdSignatureUrl)}
                    </div>
                  </div>
                  `
                await printHTML(html, `Confirmation ${current.refNumber}`)
              }}
            >
              <Printer className="size-4" /> Print Confirmation Letter
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={async () => {
                  if (!confirm('Delete this confirmation record? This cannot be undone.')) return
                  try {
                    const res = await fetch(`/api/appointment-confirmations/${current.id}`, { method: 'DELETE' })
                    const d = await res.json()
                    if (!res.ok) toast.error(d.error || 'Failed to delete')
                    else { toast.success('Confirmation deleted'); onAction() }
                  } catch {
                    toast.error('Network error')
                  }
                }}
              >
                <Ban className="size-4" /> Delete
              </Button>
            )}
          </div>

          <DetailSection title="Staff Details">
            <Row label="Name" value={current.staff?.fullName} />
            <Row label="Staff ID" value={current.staff?.staffId} />
            <Row label="Position" value={current.staff?.position} />
            <Row label="Rank" value={current.staff?.rank} />
            <Row label="Designation" value={current.staff?.designation?.name} />
            <Row label="Department" value={current.staff?.department?.name} />
            <Row label="Date Hired" value={formatDate(current.dateHired || current.staff?.dateHired)} />
            <Row label="Current Confirmation Date" value={formatDate(current.staff?.confirmationDate)} />
            <Row label="Retirement Date" value={formatDate(current.staff?.retirementDate)} />
          </DetailSection>

          <DetailSection title="Confirmation Details">
            <Row label="Date of First Appointment" value={formatDate(current.dateOfFirstAppointment)} />
            <Row label="Expected Confirmation Date" value={formatDate(current.expectedConfirmationDate)} />
            <Row label="Actual Confirmation Date" value={formatDate(current.actualConfirmationDate)} />
            <Row label="Service Years Required" value={current.serviceYearsRequired} />
            <Row label="Current Grade Level" value={current.currentGradeLevel} />
            <Row label="New Grade Level" value={current.newGradeLevel} />
            <Row label="New Step" value={current.newStep} />
            <Row label="Justification" value={current.justification} />
            <Row label="Remarks" value={current.remarks} />
          </DetailSection>

          <DetailSection title="Approval Timeline">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <ApprovalTile
                label="HOD"
                name={current.hodName}
                date={current.hodSignedAt}
                remarks={current.hodRemarks}
                signatureUrl={current.hodSignatureUrl}
              />
              <ApprovalTile
                label="DFA"
                name={current.dfaName}
                date={current.dfaSignedAt}
                remarks={current.dfaRemarks}
                signatureUrl={current.dfaSignatureUrl}
              />
              <ApprovalTile
                label="CMD"
                name={current.cmdName}
                date={current.cmdSignedAt}
                remarks={current.cmdRemarks}
                signatureUrl={current.cmdSignatureUrl}
              />
            </div>
            {current.rejectedById && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
                <div className="font-medium text-red-700">Rejected</div>
                <div className="text-xs">By: {current.rejectedByName || current.rejectedById} · {formatDate(current.rejectedAt)}</div>
                {current.rejectReason && (
                  <div className="text-xs mt-1">Reason: {current.rejectReason}</div>
                )}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Attached Documents">
            <DocLink label="Confirmation Letter" url={current.confirmationLetterUrl} />
            <DocLink label="Assessment Form" url={current.assessmentFormUrl} />
          </DetailSection>

          <DetailSection title="Actions">
            <div className="flex flex-wrap gap-2">
              {current.status === 'Submitted' && isHod && (
                <Button size="sm" onClick={() => setPendingAction('hod_approve')} className="bg-blue-600 hover:bg-blue-700">
                  <Check className="size-4" /> HOD Approve
                </Button>
              )}
              {current.status === 'HOD Approved' && isDfa && (
                <Button size="sm" onClick={() => setPendingAction('dfa_approve')} className="bg-indigo-600 hover:bg-indigo-700">
                  <FileCheck2 className="size-4" /> DFA Approve
                </Button>
              )}
              {current.status === 'DFA Approved' && isCmd && (
                <Button size="sm" onClick={() => setPendingAction('cmd_approve')} className="bg-emerald-600 hover:bg-emerald-700">
                  <Check className="size-4" /> CMD Approve
                </Button>
              )}
              {current.status === 'CMD Approved' && isRegistryOrAdmin && (
                <Button size="sm" onClick={() => setPendingAction('complete')} className="bg-green-600 hover:bg-green-700">
                  <Check className="size-4" /> Complete Confirmation
                </Button>
              )}
              {(isHod || isDfa || isCmd) && !['Rejected', 'Cancelled', 'Completed'].includes(current.status) && (
                <Button size="sm" variant="destructive" onClick={() => setPendingAction('reject')}>
                  <X className="size-4" /> Reject
                </Button>
              )}
              {isOwner && !['Rejected', 'Cancelled', 'Completed'].includes(current.status) && (
                <Button size="sm" variant="outline" onClick={() => setPendingAction('cancel')}>
                  <Ban className="size-4" /> Cancel
                </Button>
              )}
              {['Rejected', 'Cancelled', 'Completed'].includes(current.status) && (
                <p className="text-xs text-muted-foreground italic">No further actions available.</p>
              )}
            </div>
          </DetailSection>
        </div>

        <SheetFooter className="px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </SheetFooter>
      </SheetContent>

      <ActionModal
        action={pendingAction}
        item={current}
        onClose={() => setPendingAction(null)}
        onDone={() => { setPendingAction(null); onAction() }}
      />
    </Sheet>
  )
}

// ============================================================
// Action Modal (captures remarks + signature, and for `complete`
// also captures actualConfirmationDate, for `reject` captures
// rejectReason).
// ============================================================
function ActionModal({ action, item, onClose, onDone }: {
  action: string | null
  item: any
  onClose: () => void
  onDone: () => void
}) {
  const [remarks, setRemarks] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [signatureUrl, setSignatureUrl] = useState('')
  const [actualConfirmationDate, setActualConfirmationDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (action) {
      setRemarks('')
      setRejectReason('')
      setSignatureUrl('')
      setActualConfirmationDate(new Date().toISOString().slice(0, 10))
    }
  }, [action])

  if (!action) return null

  const titleMap: Record<string, string> = {
    hod_approve: 'Approve as HOD',
    dfa_approve: 'Approve as DFA',
    cmd_approve: 'Approve as CMD',
    complete: 'Complete Confirmation',
    reject: 'Reject Confirmation',
    cancel: 'Cancel Confirmation',
  }
  const descMap: Record<string, string> = {
    hod_approve: 'Confirm that you have reviewed this confirmation request and approve it for DFA review.',
    dfa_approve: 'Confirm DFA approval of this confirmation request, forwarding it to the CMD.',
    cmd_approve: 'Provide final CMD approval for this confirmation request.',
    complete: 'Stamp the actual confirmation date on the staff record to close out this confirmation.',
    reject: 'Send this confirmation request back to the creator with a reason.',
    cancel: 'Cancel this confirmation request. This cannot be undone.',
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      const payload: any = { action, remarks: remarks || undefined }
      if (signatureUrl) payload.signatureUrl = signatureUrl
      if (action === 'reject') payload.rejectReason = rejectReason || remarks || undefined
      if (action === 'complete') payload.actualConfirmationDate = actualConfirmationDate || undefined
      const res = await fetch(`/api/appointment-confirmations/${item.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Action failed')
      else { toast.success('Action completed'); onDone() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  return (
    <Dialog open={!!action} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titleMap[action]}</DialogTitle>
          <DialogDescription>{descMap[action]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded border bg-muted/40 p-2 text-xs">
            <div className="text-muted-foreground">Reference</div>
            <div className="font-mono font-medium">{item.refNumber}</div>
            <div className="mt-1 text-muted-foreground">Staff</div>
            <div className="font-medium">
              {item.staff?.fullName} {item.staff?.staffId ? `· ${item.staff.staffId}` : ''}
            </div>
          </div>

          {action === 'reject' && (
            <div>
              <Label>Reject Reason *</Label>
              <Textarea
                rows={3}
                placeholder="Explain why this confirmation is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          )}

          {action === 'complete' && (
            <div>
              <Label>Actual Confirmation Date *</Label>
              <Input
                type="date"
                value={actualConfirmationDate}
                onChange={(e) => setActualConfirmationDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                This date will be stamped on the staff record as their confirmation date.
              </p>
            </div>
          )}

          {action !== 'reject' && action !== 'cancel' && (
            <div>
              <Label>Remarks (optional)</Label>
              <Textarea
                rows={2}
                placeholder="Any approval notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          )}

          {action !== 'cancel' && action !== 'complete' && (
            <div>
              <Label>Signature (optional)</Label>
              <FileUpload
                type="signature"
                accept="image/*"
                label="Upload signature"
                previewClassName="h-16 w-40"
                value={signatureUrl}
                onChange={setSignatureUrl}
                compressImages={false}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={
              submitting ||
              (action === 'reject' && !rejectReason.trim()) ||
              (action === 'complete' && !actualConfirmationDate)
            }
            variant={action === 'reject' ? 'destructive' : 'default'}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {action === 'reject' && <X className="size-4" />}
            {action === 'cancel' && <Ban className="size-4" />}
            {(action === 'hod_approve' || action === 'dfa_approve' || action === 'cmd_approve' || action === 'complete') && (
              <Check className="size-4" />
            )}
            {titleMap[action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Small presentational helpers
// ============================================================
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

function ApprovalTile({ label, name, date, remarks, signatureUrl }: {
  label: string
  name?: string | null
  date?: string | null
  remarks?: string | null
  signatureUrl?: string | null
}) {
  const signed = !!name
  return (
    <div className={`rounded border p-3 text-center ${signed ? 'bg-green-50 border-green-200' : 'bg-muted/30'}`}>
      <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
        {signed ? <Check className="size-3 text-green-600" /> : <Clock className="size-3" />}
        {label}
      </div>
      {signed ? (
        <>
          {signatureUrl && (
            <img
              src={signatureUrl}
              alt={`${label} signature`}
              className="mx-auto max-h-12 mt-2 object-contain"
            />
          )}
          <div className="text-xs font-medium mt-1">{name}</div>
          <div className="text-[10px] text-muted-foreground">{formatDate(date)}</div>
          {remarks && <div className="text-[10px] text-muted-foreground italic mt-1">&ldquo;{remarks}&rdquo;</div>}
        </>
      ) : (
        <div className="text-[10px] text-muted-foreground mt-1">Awaiting</div>
      )}
    </div>
  )
}

function DocLink({ label, url }: { label: string; url?: string | null }) {
  if (!url) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-3.5" />
        <span>{label}:</span>
        <span className="italic">Not attached</span>
      </div>
    )
  }
  // If the URL is a data URL or absolute, open directly; otherwise open in a new tab.
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(url) || url.startsWith('data:image/')
  const isPdf = url.startsWith('data:application/pdf') || /\.pdf$/i.test(url)
  return (
    <div className="flex items-center gap-2 text-xs">
      <FileText className="size-3.5 text-primary" />
      <span className="text-muted-foreground">{label}:</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
      >
        {isImage ? 'View image' : isPdf ? 'View PDF' : 'Open document'}
        <ExternalLink className="size-3" />
      </a>
    </div>
  )
}
