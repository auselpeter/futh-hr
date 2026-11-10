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
  UserMinus, Plus, Search, Loader2, Check, X, Ban, Clock, FileCheck2, Printer, Download,
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
  'HOD Approved': 'bg-amber-100 text-amber-700',
  'DFA Approved': 'bg-violet-100 text-violet-700',
  'CMD Approved': 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-slate-200 text-slate-700',
  Completed: 'bg-emerald-100 text-emerald-700',
}

const typeLabel: Record<string, string> = {
  termination: 'Termination',
  dismissal: 'Dismissal',
  retirement: 'Retirement',
  'contract-end': 'Contract End',
  death: 'Death',
}

type TabKey = 'all' | 'pending_my_approval' | 'mine' | 'approved' | 'rejected'

type Props = {
  user: any
  onNavigate?: (v: any) => void
}

export default function Terminations({ user }: Props) {
  const [tab, setTab] = useState<TabKey>('all')
  const [items, setItems] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
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
      const [tRes, stRes] = await Promise.all([
        fetch(`/api/terminations?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/staff', { cache: 'no-store' }),
      ])
      const tData = await tRes.json()
      const stData = await stRes.json()
      let list = tData.terminations || []
      if (statusFilter !== 'all') list = list.filter((t: any) => t.status === statusFilter)
      if (typeFilter !== 'all') list = list.filter((t: any) => t.type === typeFilter)
      if (search) {
        const q = search.toLowerCase()
        list = list.filter((t: any) =>
          (t.refNumber || '').toLowerCase().includes(q) ||
          (t.staff?.fullName || '').toLowerCase().includes(q) ||
          (t.staff?.staffId || '').toLowerCase().includes(q) ||
          (t.reason || '').toLowerCase().includes(q)
        )
      }
      setItems(list)
      setStaff(stData.staff || [])
    } catch {
      toast.error('Failed to load terminations')
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
            <UserMinus className="size-6" /> Terminations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} termination / retirement / dismissal records · HOD → DFA → CMD workflow
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = items.map((t) => ({
                'Ref #': t.refNumber,
                'Staff': t.staff?.fullName || '',
                'Staff ID': t.staff?.staffId || '',
                'Department': t.staff?.department?.name || '',
                'Type': typeLabel[t.type] || t.type,
                'Reason': t.reason || '',
                'Notice Date': formatDate(t.noticeDate),
                'Effective Date': formatDate(t.effectiveDate),
                'Last Working Date': formatDate(t.lastWorkingDate),
                'Final Salary': t.finalSalary ?? '',
                'Gratuity': t.gratuityAmount ?? '',
                'Pension Balance': t.pensionBalance ?? '',
                'Leave Encashment': t.leaveEncashment ?? '',
                'Exit Interview': t.exitInterviewConducted ? 'Yes' : 'No',
                'Handover Completed': t.handoverCompleted ? 'Yes' : 'No',
                'Assets Returned': t.assetsReturned ? 'Yes' : 'No',
                'Status': t.status,
                'HOD': t.hodName || '',
                'DFA': t.dfaName || '',
                'CMD': t.cmdName || '',
                'Created At': t.createdAt ? new Date(t.createdAt).toLocaleString() : '',
              }))
              exportToExcel('FUTH_Terminations', [{ name: 'Terminations', rows }])
              toast.success(`Exported ${rows.length} terminations`)
            }}
            disabled={!items.length}
          >
            <Download className="size-4" /> Export to Excel
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New Termination
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
              <Input placeholder="Search by ref #, staff, reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                <SelectItem value="termination">Termination</SelectItem>
                <SelectItem value="dismissal">Dismissal</SelectItem>
                <SelectItem value="retirement">Retirement</SelectItem>
                <SelectItem value="contract-end">Contract End</SelectItem>
                <SelectItem value="death">Death</SelectItem>
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
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Reason</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Effective</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No terminations</td></tr>
                  ) : items.map((t) => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setDetail(t)}>
                      <td className="px-4 py-3 font-mono text-xs">{t.refNumber}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="bg-primary/15 text-primary text-[9px]">{initials(t.staff?.fullName || '?')}</AvatarFallback>
                          </Avatar>
                          <div className="leading-tight">
                            <div className="font-medium">{t.staff?.fullName || '—'}</div>
                            <div className="text-[10px] text-muted-foreground">{t.staff?.staffId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px]">{typeLabel[t.type] || t.type}</Badge>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs truncate max-w-[200px]">{t.reason || '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs">{formatDate(t.effectiveDate)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusColor[t.status] || 'bg-gray-100'}`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <TerminationCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        staff={staff}
        onSaved={() => { setCreating(false); load() }}
      />

      <TerminationDetailSheet
        item={detail}
        user={user}
        onClose={() => setDetail(null)}
        onAction={() => { setDetail(null); load() }}
      />
    </div>
  )
}

function TerminationCreateModal({ open, onClose, staff, onSaved }: {
  open: boolean; onClose: () => void; staff: any[]; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        staffId: '',
        type: 'termination',
        reason: '',
        detailedReason: '',
        noticeDate: '',
        effectiveDate: '',
        lastWorkingDate: '',
        finalSalary: '',
        gratuityAmount: '',
        pensionBalance: '',
        leaveEncashment: '',
        clearanceFormUrl: '',
      })
    }
  }, [open])

  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.staffId || !form.effectiveDate || !form.reason) {
      toast.error('Staff, effective date and reason are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/terminations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to create termination')
      else { toast.success(`Termination created: ${data.termination?.refNumber}`); onSaved() }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Termination Request</DialogTitle>
          <DialogDescription>Submit a termination / dismissal / retirement / contract-end / death record</DialogDescription>
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
                <SelectItem value="termination">Termination</SelectItem>
                <SelectItem value="dismissal">Dismissal</SelectItem>
                <SelectItem value="retirement">Retirement</SelectItem>
                <SelectItem value="contract-end">Contract End</SelectItem>
                <SelectItem value="death">Death</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason *</Label>
            <Input value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Short reason..." />
          </div>
          <div>
            <Label>Detailed Reason</Label>
            <Textarea value={form.detailedReason} onChange={(e) => set('detailedReason', e.target.value)} rows={3} placeholder="Detailed explanation..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
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
          <div>
            <Label className="mb-1.5 block">Clearance Form</Label>
            <FileUpload type="clearance" label="Upload clearance form" accept="image/*,application/pdf" value={form.clearanceFormUrl} onChange={(url) => set('clearanceFormUrl', url)} previewClassName="size-16" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Submit Termination
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TerminationDetailSheet({ item, user, onClose, onAction }: { item: any | null; user: any; onClose: () => void; onAction: () => void }) {
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
  const isOwner = current.createdById === user.id

  const action = async (a: string) => {
    setSubmitting(true)
    try {
      const payload: any = { action: a, remarks }
      if (signatureUrl) payload.signatureUrl = signatureUrl
      if (a === 'reject') payload.rejectReason = rejectReason || remarks
      const res = await fetch(`/api/terminations/${current.id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Action completed'); setCurrent(data.termination); onAction() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const saveExitDetails = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/terminations/${current.id}/action`, {
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
      else { toast.success('Exit details updated'); setCurrent(data.termination) }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white text-lg">Termination {current.refNumber}</SheetTitle>
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
                const subLine = 'HUMAN RESOURCES MANAGEMENT SYSTEM · Termination Letter'
                const html =
                  printHeader(institution, subLine, current.refNumber, 'Termination Letter') +
                  `
                  <div class="grid" style="margin-bottom: 14px;">
                    <div class="section">
                      <h3>Staff Details</h3>
                      ${row('Name', current.staff?.fullName)}
                      ${row('Staff ID', current.staff?.staffId)}
                      ${row('Department', current.staff?.department?.name)}
                    </div>
                    <div class="section">
                      <h3>Termination Details</h3>
                      ${row('Type', typeLabel[current.type] || current.type)}
                      ${row('Reason', current.reason)}
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
                    ${row('Pension Balance', current.pensionBalance ? formatNaira(current.pensionBalance) : '—')}
                    ${row('Leave Encashment', current.leaveEncashment ? formatNaira(current.leaveEncashment) : '—')}
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
                await printHTML(html, `Termination ${current.refNumber}`)
              }}
            >
              <Printer className="size-4" /> Print Termination Letter
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

          <DetailSection title="Termination Details">
            <Row label="Type" value={typeLabel[current.type] || current.type} />
            <Row label="Reason" value={current.reason} />
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
            {current.clearanceFormUrl && (
              <div>
                <Label className="text-xs text-muted-foreground">Clearance Form</Label>
                {current.clearanceFormUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img src={current.clearanceFormUrl} alt="clearance form" className="mt-1 max-h-32 rounded border" />
                ) : (
                  <a href={current.clearanceFormUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View clearance form</a>
                )}
              </div>
            )}
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
