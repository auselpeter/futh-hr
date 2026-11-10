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
import {
  DoorOpen, Plus, Search, Loader2, Check, X, Ban, Clock, FileCheck2, Printer, Download, RotateCcw,
} from 'lucide-react'
import { initials, formatDate, formatNaira } from '@/lib/formatters'
import { toast } from 'sonner'
import FileUpload from './FileUpload'
import StaffSearch from './StaffSearch'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, signatureBox, htmlEscape, row } from '@/lib/print'

const statusColor: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Submitted: 'bg-blue-100 text-blue-700',
  'HOD Acknowledged': 'bg-amber-100 text-amber-700',
  'DFA Approved': 'bg-violet-100 text-violet-700',
  Accepted: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Withdrawn: 'bg-slate-200 text-slate-700',
  Completed: 'bg-emerald-100 text-emerald-700',
}

type TabKey = 'all' | 'pending_my_approval' | 'mine' | 'approved' | 'rejected'

type Props = {
  user: any
  onNavigate?: (v: any) => void
}

export default function Resignations({ user }: Props) {
  const [tab, setTab] = useState<TabKey>('all')
  const [items, setItems] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab })
      const [rRes, stRes] = await Promise.all([
        fetch(`/api/resignations?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
      ])
      const rData = await rRes.json()
      const stData = await stRes.json()
      let list = rData.resignations || []
      if (statusFilter !== 'all') list = list.filter((r: any) => r.status === statusFilter)
      if (search) {
        const q = search.toLowerCase()
        list = list.filter((r: any) =>
          (r.refNumber || '').toLowerCase().includes(q) ||
          (r.staff?.fullName || '').toLowerCase().includes(q) ||
          (r.staff?.staffId || '').toLowerCase().includes(q) ||
          (r.reason || '').toLowerCase().includes(q)
        )
      }
      setItems(list)
      setStaff(stData.staff || [])
    } catch {
      toast.error('Failed to load resignations')
    }
    setLoading(false)
  }, [tab, search, statusFilter])

  useEffect(() => { load() }, [load])

  const role = user?.activeRole || user?.role
  // STAFF role can submit resignations for themselves
  const canCreate = true

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DoorOpen className="size-6" /> Resignations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} resignation records · HOD Acknowledge → DFA → CMD Accept workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = items.map((r) => ({
                'Ref #': r.refNumber,
                'Staff': r.staff?.fullName || '',
                'Staff ID': r.staff?.staffId || '',
                'Department': r.staff?.department?.name || '',
                'Reason': r.reason || '',
                'Detailed Reason': r.detailedReason || '',
                'Resignation Date': formatDate(r.resignationDate),
                'Notice Date': formatDate(r.noticeDate),
                'Effective Date': formatDate(r.effectiveDate),
                'Last Working Date': formatDate(r.lastWorkingDate),
                'Final Salary': r.finalSalary ?? '',
                'Gratuity': r.gratuityAmount ?? '',
                'Pension Balance': r.pensionBalance ?? '',
                'Leave Encashment': r.leaveEncashment ?? '',
                'Withdrawn': r.isWithdrawn ? 'Yes' : 'No',
                'Status': r.status,
                'HOD': r.hodName || '',
                'DFA': r.dfaName || '',
                'CMD': r.cmdName || '',
                'Created At': r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
              }))
              exportToExcel('FUTH_Resignations', [{ name: 'Resignations', rows }])
              toast.success(`Exported ${rows.length} resignations`)
            }}
            disabled={!items.length}
          >
            <Download className="size-4" /> Export to Excel
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Submit Resignation
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="pending_my_approval" className="text-xs">Pending My Approval</TabsTrigger>
          <TabsTrigger value="mine" className="text-xs">My Resignations</TabsTrigger>
          <TabsTrigger value="approved" className="text-xs">Accepted</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search by ref #, staff, reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Submitted">Submitted</SelectItem>
                <SelectItem value="HOD Acknowledged">HOD Acknowledged</SelectItem>
                <SelectItem value="DFA Approved">DFA Approved</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Withdrawn">Withdrawn</SelectItem>
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
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Reason</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Effective</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No resignations</td></tr>
                  ) : items.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setDetail(r)}>
                      <td className="px-4 py-3 font-mono text-xs">{r.refNumber}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="bg-primary/15 text-primary text-[9px]">{initials(r.staff?.fullName || '?')}</AvatarFallback>
                          </Avatar>
                          <div className="leading-tight">
                            <div className="font-medium">{r.staff?.fullName || '—'}</div>
                            <div className="text-[10px] text-muted-foreground">{r.staff?.staffId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs truncate max-w-[200px]">{r.reason || '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">{formatDate(r.effectiveDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor[r.status] || 'bg-gray-100'}`}>{r.status}</span>
                        {r.isWithdrawn && <span className="ml-1 text-[10px] text-slate-500">(withdrawn)</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ResignationCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        staff={staff}
        user={user}
        onSaved={() => { setCreating(false); load() }}
      />

      <ResignationDetailSheet
        item={detail}
        user={user}
        onClose={() => setDetail(null)}
        onAction={() => { setDetail(null); load() }}
      />
    </div>
  )
}

function ResignationCreateModal({ open, onClose, staff, user, onSaved }: {
  open: boolean; onClose: () => void; staff: any[]; user: any; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const role = user?.activeRole || user?.role

  useEffect(() => {
    if (open) {
      // If STAFF, pre-select their own staff record and lock the dropdown
      const me = role === 'STAFF' ? staff.find((s) => s.userId === user.id) : null
      const today = new Date().toISOString().split('T')[0]
      setForm({
        staffId: me?.id || '',
        reason: '',
        detailedReason: '',
        resignationDate: today,
        noticeDate: today,
        effectiveDate: '',
        lastWorkingDate: '',
        finalSalary: '',
        gratuityAmount: '',
        pensionBalance: '',
        leaveEncashment: '',
        clearanceFormUrl: '',
      })
    }
  }, [open, role, staff, user.id])

  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.staffId || !form.effectiveDate || !form.reason) {
      toast.error('Staff, effective date and reason are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/resignations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to submit resignation')
      else { toast.success(`Resignation submitted: ${data.resignation?.refNumber}`); onSaved() }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Resignation</DialogTitle>
          <DialogDescription>
            {role === 'STAFF' ? 'Submit your resignation letter for acknowledgement' : 'Submit a resignation letter on behalf of a staff member'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Staff Member *</Label>
            <StaffSearch  value={form.staffId} onChange={(v) => set('staffId', v)} disabled={role === 'STAFF'} placeholder="Search staff by name, ID, department..." />
            {role === 'STAFF' && (
              <p className="text-[10px] text-muted-foreground mt-1">As a Staff member you can only submit resignations for yourself.</p>
            )}
          </div>
          <div>
            <Label>Reason *</Label>
            <Input value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Brief reason for resignation..." />
          </div>
          <div>
            <Label>Detailed Reason</Label>
            <Textarea value={form.detailedReason} onChange={(e) => set('detailedReason', e.target.value)} rows={3} placeholder="Detailed explanation / letter body..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Resignation Date</Label><Input type="date" value={form.resignationDate} onChange={(e) => set('resignationDate', e.target.value)} /></div>
            <div><Label>Notice Date</Label><Input type="date" value={form.noticeDate} onChange={(e) => set('noticeDate', e.target.value)} /></div>
            <div><Label>Effective Date *</Label><Input type="date" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} /></div>
            <div><Label>Last Working Date</Label><Input type="date" value={form.lastWorkingDate} onChange={(e) => set('lastWorkingDate', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Final Salary</Label><Input type="number" value={form.finalSalary} onChange={(e) => set('finalSalary', e.target.value)} /></div>
            <div><Label>Gratuity Amount</Label><Input type="number" value={form.gratuityAmount} onChange={(e) => set('gratuityAmount', e.target.value)} /></div>
            <div><Label>Pension Balance</Label><Input type="number" value={form.pensionBalance} onChange={(e) => set('pensionBalance', e.target.value)} /></div>
            <div><Label>Leave Encashment</Label><Input type="number" value={form.leaveEncashment} onChange={(e) => set('leaveEncashment', e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Submit Resignation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResignationDetailSheet({ item, user, onClose, onAction }: { item: any | null; user: any; onClose: () => void; onAction: () => void }) {
  const [remarks, setRemarks] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [signatureUrl, setSignatureUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [exitInterview, setExitInterview] = useState(false)
  const [exitNotes, setExitNotes] = useState('')
  const [handover, setHandover] = useState(false)
  const [assets, setAssets] = useState(false)

  useEffect(() => {
    if (item) {
      setCurrent(item)
      setRemarks(''); setRejectReason(''); setSignatureUrl('')
      setExitInterview(item.exitInterviewConducted || false)
      setExitNotes(item.exitInterviewNotes || '')
      setHandover(item.handoverCompleted || false)
      setAssets(item.assetsReturned || false)
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
  const canEditExit = isHod || isDfa || isCmd || role === 'AD' || role === 'APPRAISAL_OFFICER'
  // Owner = the user who created it OR the staff whose resignation it is
  const isOwner = current.createdById === user.id || current.staff?.userId === user.id
  const canWithdraw = isOwner && ['Submitted', 'HOD Acknowledged'].includes(current.status)

  const action = async (a: string) => {
    setSubmitting(true)
    try {
      const payload: any = { action: a, remarks }
      if (signatureUrl) payload.signatureUrl = signatureUrl
      if (a === 'reject') payload.rejectReason = rejectReason || remarks
      const res = await fetch(`/api/resignations/${current.id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Action completed'); setCurrent(data.resignation); onAction() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const saveExitDetails = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/resignations/${current.id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_exit',
          exitInterviewConducted: exitInterview,
          exitInterviewNotes: exitNotes,
          handoverCompleted: handover,
          assetsReturned: assets,
        }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Exit details updated'); setCurrent(data.resignation) }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white text-lg">Resignation {current.refNumber}</SheetTitle>
          <SheetDescription className="text-white/80">
            {current.staff?.fullName} · submitted {formatDate(current.resignationDate)}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
                const subLine = 'HUMAN RESOURCES MANAGEMENT SYSTEM · Resignation Letter'
                const html =
                  printHeader(institution, subLine, current.refNumber, 'Resignation Letter') +
                  `
                  <div class="grid" style="margin-bottom: 14px;">
                    <div class="section">
                      <h3>Staff Details</h3>
                      ${row('Name', current.staff?.fullName)}
                      ${row('Staff ID', current.staff?.staffId)}
                      ${row('Department', current.staff?.department?.name)}
                    </div>
                    <div class="section">
                      <h3>Resignation Details</h3>
                      ${row('Reason', current.reason)}
                      ${row('Resignation Date', formatDate(current.resignationDate))}
                      ${row('Notice Date', formatDate(current.noticeDate))}
                      ${row('Effective Date', formatDate(current.effectiveDate))}
                      ${row('Last Working Date', formatDate(current.lastWorkingDate))}
                    </div>
                  </div>
                  <div class="section">
                    <h3>Detailed Reason</h3>
                    <p>${htmlEscape(current.detailedReason || '—')}</p>
                  </div>
                  <div class="section">
                    <h3>Final Entitlements</h3>
                    ${row('Final Salary', current.finalSalary ? formatNaira(current.finalSalary) : '—')}
                    ${row('Gratuity', current.gratuityAmount ? formatNaira(current.gratuityAmount) : '—')}
                    ${row('Pension balance', current.pensionBalance ? formatNaira(current.pensionBalance) : '—')}
                    ${row('Leave Encashment', current.leaveEncashment ? formatNaira(current.leaveEncashment) : '—')}
                  </div>
                  <div class="section">
                    <h3>Signatures</h3>
                    <div>
                      ${signatureBox('Staff', current.staff?.fullName, current.resignationDate, null)}
                      ${signatureBox('HOD', current.hodName, current.hodSignedAt, current.hodSignatureUrl)}
                      ${signatureBox('DFA', current.dfaName, current.dfaSignedAt, current.dfaSignatureUrl)}
                      ${signatureBox('CMD', current.cmdName, current.cmdSignedAt, current.cmdSignatureUrl)}
                    </div>
                  </div>
                  `
                await printHTML(html, `Resignation ${current.refNumber}`)
              }}
            >
              <Printer className="size-4" /> Print Resignation Letter
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge className={`${statusColor[current.status] || ''} border`}>{current.status}</Badge>
            {current.isWithdrawn && <Badge variant="outline" className="text-slate-600 border-slate-200">Withdrawn</Badge>}
          </div>

          <DetailSection title="Staff Details">
            <Row label="Name" value={current.staff?.fullName} />
            <Row label="Staff ID" value={current.staff?.staffId} />
            <Row label="Department" value={current.staff?.department?.name} />
          </DetailSection>

          <DetailSection title="Resignation Details">
            <Row label="Reason" value={current.reason} />
            <Row label="Resignation Date" value={formatDate(current.resignationDate)} />
            <Row label="Notice Date" value={formatDate(current.noticeDate)} />
            <Row label="Effective Date" value={formatDate(current.effectiveDate)} />
            <Row label="Last Working Date" value={formatDate(current.lastWorkingDate)} />
            <div>
              <Label className="text-xs text-muted-foreground">Detailed Reason</Label>
              <p className="text-sm mt-1">{current.detailedReason || '—'}</p>
            </div>
          </DetailSection>

          <DetailSection title="Final Entitlements">
            <Row label="Final Salary" value={current.finalSalary ? formatNaira(current.finalSalary) : '—'} />
            <Row label="Gratuity" value={current.gratuityAmount ? formatNaira(current.gratuityAmount) : '—'} />
            <Row label="Pension Balance" value={current.pensionBalance ? formatNaira(current.pensionBalance) : '—'} />
            <Row label="Leave Encashment" value={current.leaveEncashment ? formatNaira(current.leaveEncashment) : '—'} />
          </DetailSection>

          <DetailSection title="Exit Interview & Handover">
            {canEditExit ? (
              <div className="space-y-2 rounded border p-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Exit Interview Conducted</Label>
                  <Switch checked={exitInterview} onCheckedChange={setExitInterview} />
                </div>
                <div>
                  <Label className="text-xs">Exit Interview Notes</Label>
                  <Textarea value={exitNotes} onChange={(e) => setExitNotes(e.target.value)} rows={2} placeholder="Notes from the exit interview..." />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Handover Completed</Label>
                  <Switch checked={handover} onCheckedChange={setHandover} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Assets Returned</Label>
                  <Switch checked={assets} onCheckedChange={setAssets} />
                </div>
                <Button size="sm" variant="outline" disabled={submitting} onClick={saveExitDetails}>
                  {submitting && <Loader2 className="size-3 animate-spin" />} Save Exit Details
                </Button>
              </div>
            ) : (
              <>
                <Row label="Exit Interview" value={current.exitInterviewConducted ? 'Conducted' : 'Not conducted'} />
                {current.exitInterviewNotes && <div><Label className="text-xs text-muted-foreground">Notes</Label><p className="text-sm">{current.exitInterviewNotes}</p></div>}
                <Row label="Handover Completed" value={current.handoverCompleted ? 'Yes' : 'No'} />
                <Row label="Assets Returned" value={current.assetsReturned ? 'Yes' : 'No'} />
              </>
            )}
          </DetailSection>

          <DetailSection title="Acknowledgement / Approval Workflow">
            <div className="grid grid-cols-3 gap-2">
              <ApprovalTile label="HOD" name={current.hodName} date={current.hodSignedAt} remarks={current.hodRemarks} signatureUrl={current.hodSignatureUrl} verb="Acknowledged" />
              <ApprovalTile label="DFA" name={current.dfaName} date={current.dfaSignedAt} remarks={current.dfaRemarks} signatureUrl={current.dfaSignatureUrl} verb="Approved" />
              <ApprovalTile label="CMD" name={current.cmdName} date={current.cmdSignedAt} remarks={current.cmdRemarks} signatureUrl={current.cmdSignatureUrl} verb="Accepted" />
            </div>
            {current.rejectedById && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
                <div className="font-medium text-red-700">Rejected</div>
                <div className="text-xs">By: {current.rejectedById} · {formatDate(current.rejectedAt)}</div>
                {current.rejectReason && <div className="text-xs mt-1">Reason: {current.rejectReason}</div>}
              </div>
            )}
            {current.isWithdrawn && (
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-700">Withdrawn</div>
                <div className="text-xs">By: {current.withdrawnById} · {formatDate(current.withdrawnAt)}</div>
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
                <Button size="sm" disabled={submitting} onClick={() => action('hod_acknowledge')} className="bg-amber-600 hover:bg-amber-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Acknowledge (HOD)
                </Button>
              )}
              {current.status === 'HOD Acknowledged' && isDfa && (
                <Button size="sm" disabled={submitting} onClick={() => action('dfa_approve')} className="bg-violet-600 hover:bg-violet-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} Approve as DFA
                </Button>
              )}
              {current.status === 'DFA Approved' && isCmd && (
                <Button size="sm" disabled={submitting} onClick={() => action('cmd_accept')} className="bg-green-600 hover:bg-green-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept (CMD)
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
              {canWithdraw && (
                <Button size="sm" disabled={submitting} variant="outline" onClick={() => action('withdraw')} className="border-slate-300 text-slate-700 hover:bg-slate-50">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Withdraw Resignation
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

function ApprovalTile({ label, name, date, remarks, signatureUrl, verb }: { label: string; name?: string | null; date?: string | null; remarks?: string | null; signatureUrl?: string | null; verb?: string }) {
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
          <div className="text-xs font-medium mt-1">{verb || 'Approved'}</div>
          <div className="text-[10px] font-medium mt-0.5">{name}</div>
          <div className="text-[10px] text-muted-foreground">{formatDate(date)}</div>
          {remarks && <div className="text-[10px] text-muted-foreground italic mt-1">"{remarks}"</div>}
        </>
      ) : (
        <div className="text-[10px] text-muted-foreground mt-1">Awaiting</div>
      )}
    </div>
  )
}
