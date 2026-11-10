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
  Receipt, Plus, Search, Loader2, Check, X, Ban, Clock, Printer, Download, FileCheck2, AlertCircle, ShieldCheck, Send, Archive, ChevronRight,
} from 'lucide-react'
import { initials, formatDate, formatNaira } from '@/lib/formatters'
import { toast } from 'sonner'
import { exportToExcel } from '@/lib/export'
import { printHTML, printHeader, htmlEscape, row, signatureBox } from '@/lib/print'

const statusColor: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Raised: 'bg-blue-100 text-blue-700',
  'Pending Audit': 'bg-amber-100 text-amber-700',
  'Audit Reviewed': 'bg-cyan-100 text-cyan-700',
  'Query Raised': 'bg-orange-100 text-orange-700',
  'Audit Approved': 'bg-teal-100 text-teal-700',
  'Payment Authorized': 'bg-violet-100 text-violet-700',
  Paid: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Cancelled: 'bg-slate-200 text-slate-700',
}

const pvTypeLabel: Record<string, string> = {
  treasury_f1: 'Treasury Form F1 (Federal Govt Payment Voucher)',
  treasury_f2: 'Treasury Form F2',
  claim_retirement: 'Claim / Retirement Form (Form 0751)',
  capital_expenditure: 'Capital Expenditure PV (TF 27)',
  schedule_transfer: 'Schedule of Transfer PV (Form 0301)',
  contract: 'Contract Payment',
  imprest: 'Imprest',
  refund: 'Refund',
  salary: 'Salary Payment',
  other: 'Other',
}

type TabKey = 'all' | 'pending_audit' | 'mine' | 'paid' | 'rejected'

type Props = { user: any }

export default function PaymentVouchers({ user }: Props) {
  const [tab, setTab] = useState<TabKey>('all')
  const [items, setItems] = useState<any[]>([])
  const [requisitions, setRequisitions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tab })
      const [pvRes, reqRes] = await Promise.all([
        fetch(`/api/payment-vouchers?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/requisitions?tab=all', { cache: 'no-store' }),
      ])
      const pvData = await pvRes.json()
      const reqData = await reqRes.json()
      let list = pvData.paymentVouchers || []
      if (statusFilter !== 'all') list = list.filter((p: any) => p.status === statusFilter)
      if (search) {
        const q = search.toLowerCase()
        list = list.filter((p: any) =>
          (p.refNumber || '').toLowerCase().includes(q) ||
          (p.payeeName || '').toLowerCase().includes(q) ||
          (p.voucherNumber || '').toLowerCase().includes(q)
        )
      }
      setItems(list)
      setRequisitions(reqData.requisitions || [])
    } catch {
      toast.error('Failed to load payment vouchers')
    }
    setLoading(false)
  }, [tab, search, statusFilter])

  useEffect(() => { load() }, [load])

  const role = user?.activeRole || user?.role
  const designationCode = user?.designation?.code || ''
  const canCreate =
    ['SUPER_ADMIN', 'ADMIN', 'DFA', 'CMD', 'AD', 'HOD', 'DESK_OFFICER', 'AUDIT_OFFICER', 'CPO'].includes(role) ||
    ['DESK_OFFICER', 'AUDIT_OFFICER', 'CPO'].includes(designationCode)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="size-6" /> Payment Vouchers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} vouchers · DFA → Desk Officer → Audit workflow
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
                'PV Type': pvTypeLabel[p.pvType] || p.pvType,
                Payee: p.payeeName,
                'Voucher #': p.voucherNumber || '',
                Amount: (p.amountNaira || 0) + (p.amountKobo || 0) / 100,
                'Raised At': p.raisedAt ? formatDate(p.raisedAt) : '',
                'Desk Officer': p.deskOfficerName || '',
                'Audit Officer': p.auditOfficerName || '',
                'Paying Officer': p.payingOfficerName || '',
                'DFA Approved': p.dfaApprovedPV ? 'Yes' : 'No',
                'CMD Approved': p.cmdApprovedPV ? 'Yes' : 'No',
                'Payment Authorized': p.paymentAuthorizedAt ? formatDate(p.paymentAuthorizedAt) : '',
                'Paid At': p.paidAt ? formatDate(p.paidAt) : '',
                Status: p.status,
                Created: p.createdAt ? new Date(p.createdAt).toLocaleString() : '',
              }))
              exportToExcel('FUTH_PaymentVouchers', [{ name: 'Payment Vouchers', rows }])
              toast.success(`Exported ${rows.length} payment vouchers`)
            }}
          >
            <Download className="size-4" /> Export
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New PV
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="w-full flex flex-wrap h-auto justify-start gap-1">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="pending_audit" className="text-xs">Pending Audit</TabsTrigger>
          <TabsTrigger value="mine" className="text-xs">Mine</TabsTrigger>
          <TabsTrigger value="paid" className="text-xs">Paid</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search by ref #, payee..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Raised">Raised</SelectItem>
              <SelectItem value="Pending Audit">Pending Audit</SelectItem>
              <SelectItem value="Audit Reviewed">Audit Reviewed</SelectItem>
              <SelectItem value="Audit Approved">Audit Approved (Cleared)</SelectItem>
              <SelectItem value="Query Raised">Query Raised</SelectItem>
              <SelectItem value="Payment Authorized">Payment Authorized (→CPO)</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
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
                    <th className="text-left px-4 py-3">Payee</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Type</th>
                    <th className="text-right px-4 py-3">Amount</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No payment vouchers</td></tr>
                  ) : items.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => setDetail(p)}>
                      <td className="px-4 py-3 font-mono text-xs">{p.refNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.payeeName}</div>
                        <div className="text-[10px] text-muted-foreground">{p.voucherNumber || 'No voucher #'}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge variant="outline" className="text-[10px]">{pvTypeLabel[p.pvType] || p.pvType}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {formatNaira((p.amountNaira || 0) + (p.amountKobo || 0) / 100)}
                      </td>
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

      <PVCreateModal
        open={creating}
        onClose={() => setCreating(false)}
        requisitions={requisitions}
        onSaved={() => { setCreating(false); load() }}
      />

      <PVDetailSheet
        item={detail}
        user={user}
        onClose={() => setDetail(null)}
        onAction={() => { setDetail(null); load() }}
      />
    </div>
  )
}

function PVCreateModal({ open, onClose, requisitions, onSaved }: {
  open: boolean; onClose: () => void; requisitions: any[]; onSaved: () => void
}) {
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({
        requisitionId: 'none',
        pvType: 'treasury_f1',
        voteNumber: '',
        subHead: '',
        voucherNumber: '',
        classificationCode: '',
        departmentalNumber: '',
        payeeName: '',
        payeeAddress: '',
        payeePhone: '',
        payeeAccountNumber: '',
        payeeBankName: '',
        chequeNumber: '',
        amountNaira: '',
        amountKobo: '',
        amountInWords: '',
        lineItems: '',
        payableAt: '',
        paymentStation: '',
      })
    }
  }, [open])

  const set = (k: string, v: any) => setForm((prev: any) => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.payeeName || !form.amountNaira) {
      toast.error('Payee name and amount are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        requisitionId: form.requisitionId === 'none' ? null : form.requisitionId,
        amountNaira: Number(form.amountNaira) || 0,
        amountKobo: Number(form.amountKobo) || 0,
      }
      const res = await fetch('/api/payment-vouchers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to create PV')
      else { toast.success(`Payment Voucher created: ${data.paymentVoucher?.refNumber}`); onSaved() }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Payment Voucher</DialogTitle>
          <DialogDescription>Create a payment voucher — DFA → Desk Officer → Audit workflow</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Linked Requisition</Label>
            <Select value={form.requisitionId} onValueChange={(v) => set('requisitionId', v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {requisitions.map((r) => <SelectItem key={r.id} value={r.id}>{r.refNumber} — {r.subject}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>PV Type</Label>
              <Select value={form.pvType} onValueChange={(v) => set('pvType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="treasury_f1">Treasury Form F1 (Federal Govt Payment Voucher)</SelectItem>
                  <SelectItem value="treasury_f2">Treasury Form F2</SelectItem>
                  <SelectItem value="claim_retirement">Claim / Retirement Form (Form 0751)</SelectItem>
                  <SelectItem value="capital_expenditure">Capital Expenditure PV (TF 27)</SelectItem>
                  <SelectItem value="schedule_transfer">Schedule of Transfer PV (Form 0301)</SelectItem>
                  <SelectItem value="contract">Contract Payment</SelectItem>
                  <SelectItem value="imprest">Imprest</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="salary">Salary Payment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Voucher Number</Label><Input value={form.voucherNumber} onChange={(e) => set('voucherNumber', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Vote Number</Label><Input value={form.voteNumber} onChange={(e) => set('voteNumber', e.target.value)} /></div>
            <div><Label>Sub Head</Label><Input value={form.subHead} onChange={(e) => set('subHead', e.target.value)} /></div>
            <div><Label>Classification Code</Label><Input value={form.classificationCode} onChange={(e) => set('classificationCode', e.target.value)} /></div>
          </div>
          <div>
            <Label>Payee Name *</Label>
            <Input value={form.payeeName} onChange={(e) => set('payeeName', e.target.value)} placeholder="Contractor / Vendor / Staff name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Payee Address</Label><Input value={form.payeeAddress} onChange={(e) => set('payeeAddress', e.target.value)} /></div>
            <div><Label>Payee Phone</Label><Input value={form.payeePhone} onChange={(e) => set('payeePhone', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Payee Account Number</Label><Input value={form.payeeAccountNumber} onChange={(e) => set('payeeAccountNumber', e.target.value)} placeholder="e.g. 0123456789" /></div>
            <div><Label>Payee Bank Name</Label><Input value={form.payeeBankName} onChange={(e) => set('payeeBankName', e.target.value)} placeholder="e.g. Zenith Bank" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount Naira *</Label><Input type="number" value={form.amountNaira} onChange={(e) => set('amountNaira', e.target.value)} /></div>
            <div><Label>Amount Kobo</Label><Input type="number" value={form.amountKobo} onChange={(e) => set('amountKobo', e.target.value)} /></div>
          </div>
          <div>
            <Label>Amount in Words</Label>
            <Textarea value={form.amountInWords} onChange={(e) => set('amountInWords', e.target.value)} rows={2} placeholder="e.g. Twenty-eight million, five hundred thousand naira only" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Payable At</Label><Input value={form.payableAt} onChange={(e) => set('payableAt', e.target.value)} /></div>
            <div><Label>Payment Station</Label><Input value={form.paymentStation} onChange={(e) => set('paymentStation', e.target.value)} /></div>
          </div>
          <div><Label>Cheque Number</Label><Input value={form.chequeNumber} onChange={(e) => set('chequeNumber', e.target.value)} /></div>
          <div>
            <Label>Line Items (description / breakdown)</Label>
            <Textarea value={form.lineItems} onChange={(e) => set('lineItems', e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />} Create Payment Voucher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PVDetailSheet({ item, user, onClose, onAction }: { item: any | null; user: any; onClose: () => void; onAction: () => void }) {
  const [remarks, setRemarks] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [chequeNumber, setChequeNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  const [commentBody, setCommentBody] = useState('')

  useEffect(() => {
    if (item) {
      setCurrent(item)
      setRemarks(''); setRejectReason(''); setChequeNumber(''); setCommentBody('')
    }
  }, [item])

  if (!current) return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md" />
    </Sheet>
  )

  const role = user?.activeRole || user?.role
  const designationCode = user?.designation?.code || ''
  const isSuper = ['SUPER_ADMIN', 'ADMIN'].includes(role)
  const isDfa = role === 'DFA' || isSuper
  // DFA can act as Desk Officer / Audit Officer / CPO when those specialized roles aren't staffed.
  const isDesk = role === 'DESK_OFFICER' || designationCode === 'DESK_OFFICER' || isSuper || isDfa
  const isAudit = role === 'AUDIT_OFFICER' || designationCode === 'AUDIT_OFFICER' || isSuper || isDfa
  const isCpo = role === 'CPO' || designationCode === 'CPO' || isSuper || isDfa
  const isOwner = current.createdById === user.id
  const amount = (current.amountNaira || 0) + (current.amountKobo || 0) / 100

  const action = async (a: string) => {
    setSubmitting(true)
    try {
      const payload: any = { action: a, remarks }
      if (a === 'reject') payload.rejectReason = rejectReason || remarks
      if (a === 'initiator_respond') payload.responseText = remarks
      if (a === 'mark_paid') payload.chequeNumber = chequeNumber
      const res = await fetch(`/api/payment-vouchers/${current.id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed')
      else { toast.success('Action completed'); setCurrent(data.paymentVoucher); onAction() }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  const addComment = async () => {
    if (!commentBody) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/payment-vouchers/${current.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Failed to add comment')
      else {
        toast.success('Comment added')
        setCommentBody('')
        const d = await fetch(`/api/payment-vouchers/${current.id}`, { cache: 'no-store' }).then((r) => r.json())
        if (d.paymentVoucher) setCurrent(d.paymentVoucher)
      }
    } catch {
      toast.error('Network error')
    }
    setSubmitting(false)
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6">
          <SheetTitle className="text-white text-lg">Payment Voucher {current.refNumber}</SheetTitle>
          <SheetDescription className="text-white/80">
            {current.payeeName} · {pvTypeLabel[current.pvType] || current.pvType} · {formatNaira(amount)}
          </SheetDescription>
        </SheetHeader>
        <div className="p-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
                let html = ''
                const lines = current.lineItems ? JSON.parse(current.lineItems) : []
                const amtN = current.amountNaira || 0
                const amtK = current.amountKobo || 0
                const totalStr = `₦${amtN.toLocaleString()}.${String(amtK).padStart(2, '0')}`

                if (current.pvType === 'claim_retirement') {
                  // Claim/Retirement Form (Form 0751)
                  html = `
                  <div class="header">
                    <img src="/futh-logo.jpeg" alt="FUTH logo" style="width:70px;height:70px;border-radius:8px;object-fit:cover;" />
                    <div style="flex:1;">
                      <h1>${institution}</h1>
                      <div class="sub">P.M.B. 007, Lafia, Nasarawa State</div>
                    </div>
                    <div style="text-align:right;">
                      <div class="label">Form No.</div>
                      <div style="font-family:monospace;font-weight:bold;color:#14532d;">0751</div>
                    </div>
                  </div>
                  <h2 style="text-align:center;border-bottom:2px solid #15803d;padding-bottom:8px;">CLAIM / RETIREMENT FORM</h2>
                  <div class="grid" style="margin-bottom:14px;">
                    <div class="section">
                      <h3>Claimant Details</h3>
                      ${row('Name of Claimant', current.payeeName)}
                      ${row('Department', current.payeeAddress || '—')}
                      ${row('Purpose', current.voucherNumber || '—')}
                      ${row('Vote Number', current.voteNumber || '—')}
                    </div>
                    <div class="section">
                      <h3>Voucher Info</h3>
                      ${row('PV Ref', current.refNumber)}
                      ${row('Classification Code', current.classificationCode || '—')}
                      ${row('Date', new Date(current.createdAt).toLocaleDateString('en-GB'))}
                    </div>
                  </div>
                  <div class="section">
                    <h3>Financial Breakdown</h3>
                    <table>
                      <thead><tr><th>S/N</th><th>Company / Source of Claim</th><th>Receipt No.</th><th>A/C Code</th><th>Amount (₦)</th></tr></thead>
                      <tbody>
                        ${lines.map((l:any,i:number) => `<tr><td>${i+1}</td><td>${htmlEscape(l.description||'')}</td><td>${l.date||'—'}</td><td>${current.classificationCode||'—'}</td><td style="text-align:right;">${(l.amountN||0).toLocaleString()}</td></tr>`).join('')}
                        <tr><td colspan="4" style="text-align:right;font-weight:bold;">Total Spent:</td><td style="text-align:right;font-weight:bold;">${totalStr}</td></tr>
                      </tbody>
                    </table>
                    ${row('Balance (to refund/refundable)', current.amountInWords || '—')}
                  </div>
                  <div class="section">
                    <h3>Signatures</h3>
                    <div>
                      ${signatureBox('Signature of Claimant', current.payeeName, current.raisedAt, current.deskOfficerSignatureUrl)}
                      ${signatureBox('Signature of DFA', user?.fullName, current.dfaApprovedAt, null)}
                      ${signatureBox('CMD\'s Approval', current.auditOfficerName, current.auditApprovedAt, current.auditSignatureUrl)}
                    </div>
                  </div>
                  `
                } else if (current.pvType === 'capital_expenditure') {
                  // Capital Expenditure Payment Voucher (TF 27)
                  html = `
                  <div class="header">
                    <img src="/futh-logo.jpeg" alt="FUTH logo" style="width:70px;height:70px;border-radius:8px;object-fit:cover;" />
                    <div style="flex:1;">
                      <h1>${institution}</h1>
                      <div class="sub">CAPITAL BUDGET ONLY</div>
                    </div>
                    <div style="text-align:right;">
                      <div class="label">Form No.</div>
                      <div style="font-family:monospace;font-weight:bold;color:#14532d;">TF 27</div>
                    </div>
                  </div>
                  <h2 style="text-align:center;border-bottom:2px solid #15803d;padding-bottom:8px;">FEDERAL GOVERNMENT OF NIGERIA<br/>CAPITAL EXPENDITURE PAYMENT VOUCHER</h2>
                  <div style="display:flex;gap:12px;margin:10px 0;">
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>VO:</strong> ${current.voteNumber||'—'}</div>
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>S/Head:</strong> ${current.subHead||'—'}</div>
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>Voucher No:</strong> ${current.voucherNumber||'—'}</div>
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>Classification:</strong> ${current.classificationCode||'—'}</div>
                  </div>
                  <div class="grid" style="margin-bottom:10px;">
                    <div class="section">
                      <h3>Payee</h3>
                      <div style="font-weight:bold;font-size:13px;">${htmlEscape(current.payeeName)}</div>
                      <div style="font-size:11px;">${htmlEscape(current.payeeAddress||'')}</div>
                      ${current.chequeNumber ? row('Cheque No.', current.chequeNumber) : ''}
                    </div>
                    <div class="section">
                      <h3>Amount</h3>
                      <div style="font-size:18px;font-weight:bold;color:#14532d;">${totalStr}</div>
                      ${row('Amount in Words', current.amountInWords||'—')}
                      ${row('Payable At', current.payableAt||'—')}
                    </div>
                  </div>
                  <div class="section">
                    <h3>Detailed Description of Service or Article</h3>
                    <table>
                      <thead><tr><th>Date</th><th>Description</th><th>Rate</th><th>Amount (₦)</th></tr></thead>
                      <tbody>
                        ${lines.map((l:any) => `<tr><td>${l.date||'—'}</td><td>${htmlEscape(l.description||'')}</td><td style="text-align:right;">₦${(l.rate||0).toLocaleString()}</td><td style="text-align:right;">₦${(l.amountN||0).toLocaleString()}</td></tr>`).join('')}
                        <tr><td colspan="3" style="text-align:right;font-weight:bold;">Total ₦:</td><td style="text-align:right;font-weight:bold;">${totalStr}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="section">
                    <h3>Certification & Signatures</h3>
                    <div>
                      ${signatureBox('Checking Officer', '—', null, null)}
                      ${signatureBox('Officer Controlling Expenditure', current.oceName, current.oceSignedAt, current.oceSignatureUrl)}
                      ${signatureBox('Financial Authority', current.payingOfficerName, current.paymentAuthorizedAt, current.payingOfficerSignatureUrl)}
                    </div>
                    <div style="margin-top:10px;font-size:11px;">
                      <strong>Receipt:</strong> Received this ______ day of ____________ 20____ in payment of the above account, the sum of ${totalStr}.
                    </div>
                    <div style="margin-top:6px;">
                      ${signatureBox('Payee Signature', current.payeeName, current.paidAt, null)}
                      ${signatureBox('Witness to Mark', '—', null, null)}
                    </div>
                  </div>
                  `
                } else if (current.pvType === 'schedule_transfer') {
                  // Schedule of Transfer Payment Vouchers
                  html = `
                  <div class="header">
                    <img src="/futh-logo.jpeg" alt="FUTH logo" style="width:70px;height:70px;border-radius:8px;object-fit:cover;" />
                    <div style="flex:1;">
                      <h1>${institution}</h1>
                    </div>
                    <div style="text-align:right;">
                      <div class="label">Serial No.</div>
                      <div style="font-family:monospace;font-weight:bold;">${current.voucherNumber||current.refNumber}</div>
                    </div>
                  </div>
                  <h2 style="text-align:center;border-bottom:2px solid #15803d;padding-bottom:8px;">SCHEDULE OF TRANSFER PAYMENT VOUCHERS</h2>
                  <div style="display:flex;justify-content:space-between;margin:10px 0;font-size:11px;">
                    <div><strong>State:</strong> Nasarawa &nbsp; <strong>Date:</strong> ${new Date(current.createdAt).toLocaleDateString('en-GB')}</div>
                    <div><strong>SEC. TREASURY:</strong> Abuja &nbsp; <strong>Form:</strong> 0301</div>
                  </div>
                  <div class="section">
                    <h3>Voucher Schedule</h3>
                    <table>
                      <thead><tr><th>Dept. No.</th><th>Payee</th><th>Amount (₦)</th><th>Paying Station</th></tr></thead>
                      <tbody>
                        <tr><td>${current.departmentalNumber||'—'}</td><td>${htmlEscape(current.payeeName)}</td><td style="text-align:right;">${totalStr}</td><td>${current.paymentStation||'—'}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="section">
                    <h3>Signatures</h3>
                    <div>
                      ${signatureBox('Sub-Treasurer, Abuja', '—', null, null)}
                      ${signatureBox('Accountant General / Fed. Pay Officer', current.payingOfficerName, current.paidAt, current.payingOfficerSignatureUrl)}
                    </div>
                  </div>
                  `
                } else {
                  // Treasury Form F1 (default) — "FEDERAL GOVERNMENT OF NIGERIA PAYMENT VOUCHER"
                  html = `
                  <div class="header">
                    <img src="/futh-logo.jpeg" alt="FUTH logo" style="width:70px;height:70px;border-radius:8px;object-fit:cover;" />
                    <div style="flex:1;">
                      <h1>${institution}</h1>
                    </div>
                    <div style="text-align:right;">
                      <div class="label">Form No.</div>
                      <div style="font-family:monospace;font-weight:bold;color:#14532d;">TF 1</div>
                      <div class="label" style="margin-top:4px;">ORIGINAL</div>
                    </div>
                  </div>
                  <h2 style="text-align:center;border-bottom:2px solid #15803d;padding-bottom:8px;">FEDERAL GOVERNMENT OF NIGERIA<br/>PAYMENT VOUCHER</h2>
                  <div style="display:flex;gap:12px;margin:10px 0;">
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>Vote (VO):</strong> ${current.voteNumber||'—'}</div>
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>Sub-Head:</strong> ${current.subHead||'—'}</div>
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>Voucher No:</strong> ${current.voucherNumber||'—'}</div>
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>Classification Code:</strong> ${current.classificationCode||'—'}</div>
                  </div>
                  <div style="display:flex;gap:12px;margin:6px 0;">
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>Dept. No:</strong> ${current.departmentalNumber||'—'}</div>
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>Date:</strong> ${new Date(current.createdAt).toLocaleDateString('en-GB')}</div>
                    <div style="border:1px solid #ccc;padding:4px 8px;font-size:11px;"><strong>Amount:</strong> ${totalStr}</div>
                  </div>
                  <div class="grid" style="margin-bottom:10px;">
                    <div class="section">
                      <h3>Payee</h3>
                      <div style="font-weight:bold;font-size:13px;">${htmlEscape(current.payeeName)}</div>
                      <div style="font-size:11px;">${htmlEscape(current.payeeAddress||'')}</div>
                      <div style="font-size:11px;">${htmlEscape(current.payeePhone||'')}</div>
                      <div style="font-size:11px;"><strong>Account No:</strong> ${current.payeeAccountNumber || '—'} &nbsp; <strong>Bank:</strong> ${current.payeeBankName || '—'}</div>
                    </div>
                    <div class="section">
                      <h3>Amount Payable</h3>
                      <div style="font-size:18px;font-weight:bold;color:#14532d;">${totalStr}</div>
                      ${row('Amount in Words', current.amountInWords||'—')}
                      ${row('Payable At', current.payableAt||'—')}
                    </div>
                  </div>
                  <div class="section">
                    <h3>Detailed Description of Service / Work</h3>
                    <table>
                      <thead><tr><th>Date</th><th>Detailed Description of Service/Work</th><th>Rate</th><th>Amount ₦</th><th>K</th></tr></thead>
                      <tbody>
                        ${lines.map((l:any) => `<tr><td>${l.date||'—'}</td><td>${htmlEscape(l.description||'')}</td><td style="text-align:right;">${(l.rate||0).toLocaleString()}</td><td style="text-align:right;">${(l.amountN||0).toLocaleString()}</td><td style="text-align:right;">${l.amountK||0}</td></tr>`).join('')}
                        <tr style="font-weight:bold;border-top:2px solid #15803d;"><td colspan="3" style="text-align:right;">Total:</td><td style="text-align:right;">${amtN.toLocaleString()}</td><td style="text-align:right;">${String(amtK).padStart(2,'0')}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="section">
                    <h3>Insert Amount in Words</h3>
                    <p style="font-style:italic;border:1px dashed #888;padding:6px;">${current.amountInWords||'—'}</p>
                  </div>
                  <div class="section">
                    <h3>Signatures & Certification</h3>
                    <div>
                      ${signatureBox('Payee Signature', current.payeeName, current.paidAt, null)}
                      ${signatureBox('Paying Officer', current.payingOfficerName, current.paymentAuthorizedAt, current.payingOfficerSignatureUrl)}
                      ${signatureBox('Officer Controlling Expenditure', current.oceName, current.oceSignedAt, current.oceSignatureUrl)}
                    </div>
                    <div style="margin-top:10px;font-size:10px;border:1px solid #ccc;padding:6px;">
                      <strong>CERTIFICATE:</strong> I certify that the above amount is correct and was incurred under the above vote;
                      that the services have been duly performed; that the necessary stores/materials have been received;
                      that the regulation/contract is fair and reasonable; that the amount of expenditure is ${totalStr} Kobo
                      may be paid under the Classification quoted above.
                    </div>
                    <div style="margin-top:6px;">
                      ${signatureBox('Desk Officer', current.deskOfficerName, current.raisedAt, current.deskOfficerSignatureUrl)}
                      ${signatureBox('Audit Officer', current.auditOfficerName, current.auditApprovedAt, current.auditSignatureUrl)}
                    </div>
                    <div style="margin-top:10px;font-size:10px;">
                      <strong>RECEIPT:</strong> Received from the Federal Government of Nigeria the sum of ${totalStr}
                      in full settlement of the Account.
                    </div>
                    <div style="margin-top:4px;">
                      ${signatureBox('Received by', current.payeeName, current.paidAt, null)}
                    </div>
                  </div>
                  `
                }
                await printHTML(html, `PV ${current.refNumber}`)
              }}
            >
              <Printer className="size-4" /> Print Payment Voucher
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge className={`${statusColor[current.status] || ''} border`}>{current.status}</Badge>
          </div>

          <Section title="Voucher Details">
            <Row label="Type" value={pvTypeLabel[current.pvType] || current.pvType} />
            <Row label="Voucher #" value={current.voucherNumber} />
            <Row label="Vote #" value={current.voteNumber} />
            <Row label="Sub Head" value={current.subHead} />
            <Row label="Classification" value={current.classificationCode} />
            <Row label="Departmental #" value={current.departmentalNumber} />
            {current.requisition && (
              <Row label="Requisition" value={current.requisition.refNumber} />
            )}
          </Section>

          <Section title="Payee">
            <Row label="Name" value={current.payeeName} />
            <Row label="Address" value={current.payeeAddress} />
            <Row label="Phone" value={current.payeePhone} />
            <Row label="Account Number" value={current.payeeAccountNumber} />
            <Row label="Bank Name" value={current.payeeBankName} />
          </Section>

          <Section title="Amount">
            <Row label="Amount" value={formatNaira(amount)} />
            <Row label="In Words" value={current.amountInWords} />
            <Row label="Cheque #" value={current.chequeNumber} />
            <Row label="Payable At" value={current.payableAt} />
            <Row label="Payment Station" value={current.paymentStation} />
          </Section>

          {current.lineItems && (
            <Section title="Line Items">
              <p className="text-sm whitespace-pre-wrap">{current.lineItems}</p>
            </Section>
          )}

          <Section title="Audit Workflow">
            <div className="grid grid-cols-4 gap-2">
              <ApprovalTile label="Desk Officer" name={current.deskOfficerName} date={current.raisedAt} />
              <ApprovalTile label="Audit" name={current.auditOfficerName} date={current.auditApprovedAt} />
              <ApprovalTile label="DFA" name={current.dfaApprovedPV ? 'Approved' : null} date={current.dfaApprovedAt} />
              <ApprovalTile label="Paid" name={current.paidAt ? current.payingOfficerName : null} date={current.paidAt} />
            </div>
            {current.auditComments && (
              <div className="rounded border p-3 text-sm">
                <div className="font-medium">Audit Comments</div>
                <div className="text-xs mt-1">{current.auditComments}</div>
              </div>
            )}
            {current.queryText && (
              <div className="rounded border border-orange-200 bg-orange-50 p-3 text-sm">
                <div className="font-medium text-orange-700 flex items-center gap-1"><AlertCircle className="size-4" /> Query Raised</div>
                <div className="text-xs mt-1">{current.queryText}</div>
                {current.initiatorResponse && (
                  <div className="mt-2 border-t pt-2">
                    <div className="font-medium text-orange-700">Initiator Response</div>
                    <div className="text-xs mt-1">{current.initiatorResponse}</div>
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title={`Comments (${current.comments?.length || 0})`}>
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
              {(current.comments || []).map((c: any) => (
                <div key={c.id} className="border rounded p-2 text-xs">
                  <div className="font-medium">{c.user?.fullName || 'User'} · <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span></div>
                  <div className="mt-1">{c.body}</div>
                </div>
              ))}
              {(current.comments || []).length === 0 && <div className="text-xs text-muted-foreground">No comments</div>}
            </div>
            <div className="flex gap-2">
              <Textarea value={commentBody} onChange={(e) => setCommentBody(e.target.value)} rows={2} placeholder="Add a comment..." className="flex-1" />
              <Button size="sm" onClick={addComment} disabled={submitting || !commentBody}>
                {submitting ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-4" />} Add
              </Button>
            </div>
          </Section>

          {current.state !== 'paid' && current.state !== 'archived' && current.state !== 'rejected' && current.state !== 'cancelled' && (
            <Section title="PV Workflow Actions">
              {/* Workflow status indicator */}
              <div className="flex items-center gap-1 text-xs mb-3 p-2 bg-slate-50 rounded-md">
                <span className={current.status === 'Draft' ? 'font-bold text-blue-600' : 'text-slate-400'}>Desk Officer raises</span>
                <ChevronRight className="size-3 text-slate-300" />
                <span className={current.status === 'Pending Audit' ? 'font-bold text-blue-600' : 'text-slate-400'}>Audit reviews</span>
                <ChevronRight className="size-3 text-slate-300" />
                <span className={current.status === 'Audit Approved' ? 'font-bold text-green-600' : 'text-slate-400'}>Audit clears</span>
                <ChevronRight className="size-3 text-slate-300" />
                <span className={current.status === 'Payment Authorized' ? 'font-bold text-violet-600' : 'text-slate-400'}>DFA → CPO</span>
                <ChevronRight className="size-3 text-slate-300" />
                <span className={current.status === 'Paid' ? 'font-bold text-green-600' : 'text-slate-400'}>CPO pays</span>
              </div>

              <Input placeholder="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />

              {/* Step 1: Desk Officer raises PV and forwards to Audit */}
              {current.status === 'Draft' && (isDesk || isSuper) && (
                <Button size="sm" disabled={submitting} onClick={() => action('forward_to_audit')} className="bg-blue-600 hover:bg-blue-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />} Forward to Audit
                </Button>
              )}

              {/* Step 2: Audit Officer reviews — clears for payment OR raises query */}
              {current.status === 'Pending Audit' && (isAudit || isSuper) && (
                <>
                  <Button size="sm" disabled={submitting} onClick={() => action('audit_clear')} className="bg-green-600 hover:bg-green-700">
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Clear for Payment (Forward to DFA)
                  </Button>
                  <Button size="sm" disabled={submitting} onClick={() => action('audit_query')} className="bg-orange-600 hover:bg-orange-700">
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <AlertCircle className="size-4" />} Raise Query
                  </Button>
                </>
              )}

              {/* Step 2b: Initiator responds to query */}
              {current.status === 'Query Raised' && (isOwner || isDesk || isSuper) && (
                <Button size="sm" disabled={submitting} onClick={() => action('initiator_respond')} variant="outline">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Respond to Query
                </Button>
              )}

              {/* Step 3: DFA/DDFA forwards cleared PV to CPO */}
              {current.status === 'Audit Approved' && (isDfa || isSuper) && (
                <Button size="sm" disabled={submitting} onClick={() => action('forward_to_cpo')} className="bg-violet-600 hover:bg-violet-700">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Forward to CPO for Payment
                </Button>
              )}

              {/* Step 4: CPO makes payment → marks as paid + cheque number */}
              {current.status === 'Payment Authorized' && (isCpo || isDfa || isSuper) && (
                <>
                  <Input placeholder="Cheque / Payment Reference Number" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
                  <Button size="sm" disabled={submitting} onClick={() => action('mark_paid')} className="bg-green-600 hover:bg-green-700">
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Mark as Paid
                  </Button>
                </>
              )}

              {/* Step 5: Archive after payment */}
              {current.status === 'Paid' && (isDfa || isCpo || isSuper) && (
                <Button size="sm" disabled={submitting} onClick={() => action('archive')} variant="outline">
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />} Archive PV for Future Reference
                </Button>
              )}

              {/* Reject + Cancel */}
              {(isDesk || isAudit || isDfa || isSuper) && current.status !== 'Paid' && current.status !== 'Archived' && (
                <>
                  <Label className="text-xs">Reject Reason</Label>
                  <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
                  <Button size="sm" disabled={submitting} variant="destructive" onClick={() => action('reject')}>
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Reject
                  </Button>
                </>
              )}
              {isOwner && current.status === 'Draft' && (
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
