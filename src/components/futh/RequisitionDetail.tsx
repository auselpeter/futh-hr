'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Send, Check, X, Undo2, Ban, ArrowRight, MessageSquare, Eye,
  Paperclip, Clock, User as UserIcon, FileSignature, Printer, Download,
} from 'lucide-react'
import { formatNaira, formatDateTime, initials } from '@/lib/formatters'
import { StatusBadge, PriorityBadge, TypeBadge } from './badges'
import { printHTML, printHeader, signatureBox, formatDateForPrint, htmlEscape, row } from '@/lib/print'
import { toast } from 'sonner'
import FileUpload from './FileUpload'
import UserSearch from './UserSearch'

type Props = {
  id: string | null
  currentUser: any
  users: any[]
  designations: any[]
  onClose: () => void
  onUpdated: () => void
}

type ActionModal = {
  type:
    | 'forward'
    | 'approve' | 'approve_close'
    | 'reject' | 'reject_close'
    | 'return'
    | 'kiv'
    | 'discuss'
    | 'close'
  title: string
}

export default function RequisitionDetail({
  id, currentUser, users, designations, onClose, onUpdated,
}: Props) {
  const [req, setReq] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [actionModal, setActionModal] = useState<ActionModal | null>(null)
  const [actionForm, setActionForm] = useState<any>({})
  const [acting, setActing] = useState(false)
  const [commenting, setCommenting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/requisitions/${id}`, { cache: 'no-store' })
      const data = await res.json()
      setReq(data.requisition)
    } catch {
      toast.error('Failed to load requisition')
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    if (id) {
      load()
      setComment('')
      setActionModal(null)
      setActionForm({})
    } else {
      setReq(null)
    }
  }, [id, load])

  if (!id) return null

  const isClosed = req?.state === 'closed_permanently'
  const isAssignee = req?.assigneeId === currentUser?.id
  const isTargetDesignation =
    !req?.assigneeId &&
    req?.targetDesignationId !== null &&
    req?.targetDesignationId === currentUser?.designationId
  const canBypass = ['SUPER_ADMIN', 'ADMIN', 'CMD'].includes(currentUser?.role)
  const canAct = (isAssignee || isTargetDesignation || canBypass) && !isClosed

  const openAction = (type: ActionModal['type'], title: string) => {
    setActionForm({ remarks: '', targetUserId: '', targetDesignationId: '', closureNote: '', signatureUrl: '' })
    setActionModal({ type, title })
  }

  const submitAction = async () => {
    if (!req || !actionModal) return
    // For approve actions by CMD/DFA/HOD/AD, require signature
    const isApproveAction = actionModal.type === 'approve' || actionModal.type === 'approve_close'
    const needsSignature = isApproveAction && (
      currentUser?.role === 'CMD' || currentUser?.role === 'DFA' ||
      currentUser?.role === 'AD' || currentUser?.role === 'HOD' || currentUser?.role === 'HOU' ||
      currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN'
    )
    if (needsSignature && !actionForm.signatureUrl) {
      toast.error('Please upload your signature before approving')
      return
    }
    setActing(true)
    try {
      let body: any = {
        action: actionModal.type === 'close' ? 'close_permanently' : actionModal.type,
        remarks: actionForm.remarks || null,
        signatureUrl: actionForm.signatureUrl || null,
      }
      if (actionModal.type === 'forward') {
        if (!actionForm.targetUserId && !actionForm.targetDesignationId) {
          toast.error('Select a recipient')
          setActing(false)
          return
        }
        body.targetUserId = actionForm.targetUserId || null
        body.targetDesignationId = actionForm.targetDesignationId || null
      }
      if (actionModal.type === 'approve_close' || actionModal.type === 'reject_close' || actionModal.type === 'close') {
        body.closePermanently = true
        body.closureNote = actionForm.closureNote || null
        // normalize action value
        if (actionModal.type === 'approve_close') body.action = 'approve'
        if (actionModal.type === 'reject_close') body.action = 'reject'
      }
      const res = await fetch(`/api/requisitions/${req.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Action failed')
      } else {
        toast.success(`Action completed: ${actionModal?.title}`)
        setActionModal(null)
        await load()
        onUpdated()
      }
    } catch {
      toast.error('Network error')
    }
    setActing(false)
  }

  const submitComment = async () => {
    if (!req || !comment.trim()) return
    setCommenting(true)
    try {
      const res = await fetch(`/api/requisitions/${req.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to add comment')
      } else {
        setComment('')
        await load()
        toast.success('Comment added')
      }
    } catch {
      toast.error('Network error')
    }
    setCommenting(false)
  }

  const printCoverSheet = async () => {
    if (!req) return
    const institution = 'FEDERAL UNIVERSITY TEACHING HOSPITAL'
    const subLine = 'HUMAN RESOURCES MANAGEMENT SYSTEM · Requisition Cover Sheet'
    const html =
      printHeader(institution, subLine, req.refNumber, `Requisition · ${req.type.toUpperCase()}`) +
      `
      <div class="grid" style="margin-bottom: 14px;">
        <div class="section">
          <h3>Requisition Details</h3>
          ${row('Type', req.type)}
          ${row('Priority', req.priority)}
          ${row('Status', req.status)}
          ${row('Amount', req.amount != null ? formatNaira(req.amount) : '—')}
          ${row('Subject', req.subject)}
        </div>
        <div class="section">
          <h3>People</h3>
          ${row('Created By', req.createdBy?.fullName)}
          ${row('Created At', formatDateForPrint(req.createdAt))}
          ${row('Current Assignee', req.assignee?.fullName || (req.targetDesignation?.name || '—'))}
          ${row('Last Update', formatDateForPrint(req.updatedAt))}
          ${req.closedAt ? row('Closed At', formatDateForPrint(req.closedAt)) : ''}
        </div>
      </div>
      <div class="section">
        <h3>Description</h3>
        <p>${htmlEscape(req.description)}</p>
        ${req.comment ? `<p style="margin-top: 8px;"><span class="label">Comment: </span>${htmlEscape(req.comment)}</p>` : ''}
      </div>
      <div class="section">
        <h3>Routing History</h3>
        <table>
          <thead><tr><th>Date</th><th>Action</th><th>From</th><th>To</th><th>Remarks</th><th>Signer</th></tr></thead>
          <tbody>
            ${(req.routes || []).map((route: any) => `<tr>
              <td>${formatDateForPrint(route.createdAt)}</td>
              <td><span class="badge">${route.action.replace('_', ' ')}</span></td>
              <td>${htmlEscape(route.fromUser?.fullName || '—')}</td>
              <td>${htmlEscape(route.toUser?.fullName || route.toDesignation?.name || '—')}</td>
              <td>${htmlEscape(route.remarks || '')}</td>
              <td>${htmlEscape(route.signerName || '—')}${route.signatureUrl ? '<br/><img src="' + route.signatureUrl + '" style="max-width:80px; max-height:30px;"/>' : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="section">
        <h3>Signatures</h3>
        <div>
          ${signatureBox('HOD', req.hodName, req.hodSignedAt, req.hodSignatureUrl)}
          ${signatureBox('CMD', req.cmdName, req.cmdSignedAt, req.cmdSignatureUrl)}
          ${signatureBox('DFA', req.dfaName, req.dfaSignedAt, req.dfaSignatureUrl)}
          ${signatureBox('DA (Dept. Admin)', req.daName, req.daSignedAt, req.daSignatureUrl)}
        </div>
      </div>
      `
    await printHTML(html, `Requisition ${req.refNumber}`)
  }

  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto scroll-thin">
        {loading || !req ? (
          <div className="p-8 text-center text-muted-foreground">Loading requisition...</div>
        ) : (
          <>
            <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6 sticky top-0 z-10">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <SheetTitle className="text-white text-lg flex items-center gap-2">
                    <span className="font-mono">{req.refNumber}</span>
                    <TypeBadge type={req.type} className="bg-white/15 text-white border-white/30" />
                  </SheetTitle>
                  <SheetDescription className="text-white/85 mt-1 text-sm">
                    {req.subject}
                  </SheetDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={req.status} className="bg-white/15 text-white border-white/30" />
                  <PriorityBadge priority={req.priority} className="bg-white/15 text-white border-white/30" />
                </div>
              </div>
            </SheetHeader>

            <div className="p-6 space-y-6">
              {/* Print / Export buttons */}
              <div className="flex gap-2 print:hidden">
                <Button size="sm" variant="outline" onClick={printCoverSheet}>
                  <Printer className="size-4" /> Print Cover Sheet
                </Button>
                <Button size="sm" variant="outline" onClick={printCoverSheet}
                  title="Same as Print — choose 'Save as PDF' in the browser print dialog">
                  <Download className="size-4" /> Download PDF
                </Button>
              </div>

              {/* Signature workflow status */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <FileSignature className="size-4" /> Signature Workflow
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <SignatureTile label="HOD" name={req.hodName} date={req.hodSignedAt} sig={req.hodSignatureUrl} remarks={req.hodRemarks} />
                  <SignatureTile label="CMD" name={req.cmdName} date={req.cmdSignedAt} sig={req.cmdSignatureUrl} remarks={req.cmdRemarks} />
                  {req.type === 'expense' && (
                    <SignatureTile label="DFA" name={req.dfaName} date={req.dfaSignedAt} sig={req.dfaSignatureUrl} remarks={req.dfaRemarks} />
                  )}
                  {req.type === 'service' && (
                    <SignatureTile label="DA (Dept. Admin)" name={req.daName} date={req.daSignedAt} sig={req.daSignatureUrl} remarks={req.daRemarks} />
                  )}
                </div>
                {req.status === 'Awaiting DFA Signature' && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                    Awaiting DFA signature for final approval.
                  </div>
                )}
                {req.status === 'Awaiting DA Signature' && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                    Awaiting DA (Departmental Administrator) signature for final approval.
                  </div>
                )}
              </section>

              {/* Description */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">Description</h3>
                <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border border-border/60">
                  {req.description}
                </p>
                {req.comment && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Comment</div>
                    <p className="text-sm italic bg-amber-50 border-l-2 border-amber-300 rounded-r p-2">
                      {req.comment}
                    </p>
                  </div>
                )}
                {req.type === 'expense' && req.amount != null && (
                  <div className="mt-2">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Amount</div>
                    <div className="text-2xl font-bold text-amber-700 font-mono">
                      {formatNaira(req.amount)}
                    </div>
                  </div>
                )}
              </section>

              {/* Meta */}
              <section className="grid grid-cols-2 gap-3 text-sm">
                <MetaItem label="Created By" icon={UserIcon}>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                        {initials(req.createdBy?.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{req.createdBy?.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {req.createdBy?.designation?.code} · {req.createdBy?.department?.code}
                      </div>
                    </div>
                  </div>
                </MetaItem>
                <MetaItem label="Current Assignee" icon={UserIcon}>
                  {req.assignee ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarFallback className="bg-amber-100 text-amber-700 text-[10px]">
                          {initials(req.assignee?.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{req.assignee?.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {req.assignee?.designation?.code} · {req.assignee?.department?.code}
                        </div>
                      </div>
                    </div>
                  ) : req.targetDesignation ? (
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">
                        {req.targetDesignation.code}
                      </div>
                      <div>
                        <div className="font-medium">{req.targetDesignation.name}</div>
                        <div className="text-xs text-muted-foreground">Routed to designation</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </MetaItem>
                <MetaItem label="Created" icon={Clock}>
                  {formatDateTime(req.createdAt)}
                </MetaItem>
                <MetaItem label="Last Update" icon={Clock}>
                  {formatDateTime(req.updatedAt)}
                </MetaItem>
                {req.closedAt && (
                  <MetaItem label="Closed" icon={Ban}>
                    {formatDateTime(req.closedAt)} by {req.closedBy?.fullName || 'System'}
                  </MetaItem>
                )}
                {req.closureNote && (
                  <MetaItem label="Closure Note" icon={MessageSquare}>
                    <p className="text-xs italic">{req.closureNote}</p>
                  </MetaItem>
                )}
              </section>

              {/* Action buttons */}
              {canAct && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-primary">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="default" onClick={() => openAction('forward', 'Forward Requisition')}>
                      <Send className="size-4" /> Forward
                    </Button>
                    <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => openAction('approve', 'Approve & Forward to Sender')}>
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button size="sm" variant="default" className="bg-green-700 hover:bg-green-800" onClick={() => openAction('approve_close', 'Approve & Close Permanently')}>
                      <Check className="size-4" /> Approve & Close
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openAction('reject', 'Reject & Forward to Sender')}>
                      <X className="size-4" /> Reject
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openAction('reject_close', 'Reject & Close Permanently')}>
                      <X className="size-4" /> Reject & Close
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAction('return', 'Return to Sender')}>
                      <Undo2 className="size-4" /> Return
                    </Button>
                    <Button size="sm" variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50" onClick={() => openAction('kiv', 'Keep in View (KIV)')}>
                      <Eye className="size-4" /> KIV
                    </Button>
                    <Button size="sm" variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-50" onClick={() => openAction('discuss', 'Discuss — Invite Initiator to Explain')}>
                      <MessageSquare className="size-4" /> Discuss
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAction('close', 'Close Permanently')}>
                      <Ban className="size-4" /> Close Permanently
                    </Button>
                  </div>
                </section>
              )}

              {/* Routing history */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <ArrowRight className="size-4" /> Routing History ({req.routes?.length || 0})
                </h3>
                <div className="space-y-2">
                  {(req.routes || []).map((route: any) => {
                    const actionColor: Record<string, string> = {
                      submit: 'text-blue-600 bg-blue-50',
                      forward: 'text-amber-600 bg-amber-50',
                      approve: 'text-green-600 bg-green-50',
                      reject: 'text-red-600 bg-red-50',
                      return: 'text-orange-600 bg-orange-50',
                      close_permanently: 'text-gray-600 bg-gray-100',
                    }
                    return (
                      <div key={route.id} className="flex gap-3 items-start">
                        <div className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${actionColor[route.action] || actionColor.submit}`}>
                          {route.action === 'submit' ? <Send className="size-3.5" /> :
                            route.action === 'approve' ? <Check className="size-3.5" /> :
                            route.action === 'reject' ? <X className="size-3.5" /> :
                            route.action === 'return' ? <Undo2 className="size-3.5" /> :
                            route.action === 'close_permanently' ? <Ban className="size-3.5" /> :
                            <ArrowRight className="size-3.5" />}
                        </div>
                        <div className="flex-1 border-l-2 border-border pl-3 pb-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium capitalize">
                              {route.action.replace('_', ' ')}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatDateTime(route.createdAt)}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            From <span className="font-medium text-foreground">{route.fromUser?.fullName}</span> to{' '}
                            {route.toUser ? (
                              <span className="font-medium text-foreground">{route.toUser.fullName}</span>
                            ) : route.toDesignation ? (
                              <span className="font-medium text-foreground">{route.toDesignation.name}</span>
                            ) : (
                              <span className="text-muted-foreground">(closed)</span>
                            )}
                          </div>
                          {route.signerName && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Signed by: <span className="font-medium">{route.signerName}</span>
                              {route.signerDesignation ? ` · ${route.signerDesignation}` : ''}
                              {route.signedAt ? ` · ${formatDateTime(route.signedAt)}` : ''}
                            </div>
                          )}
                          {route.signatureUrl && (
                            <img src={route.signatureUrl} alt="signature" className="mt-1 max-h-12 border bg-white rounded p-0.5" />
                          )}
                          {route.remarks && (
                            <div className="text-xs italic text-muted-foreground mt-1">
                              "{route.remarks}"
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Comments */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <MessageSquare className="size-4" /> Comments ({req.comments?.length || 0})
                </h3>
                <div className="space-y-2">
                  {(req.comments || []).map((c: any) => (
                    <div key={c.id} className="bg-muted/30 rounded-md p-3 border border-border/60">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                              {initials(c.user?.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{c.user?.fullName}</span>
                          {c.user?.designation && (
                            <Badge variant="outline" className="text-[10px]">{c.user.designation.code}</Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                  {!req.comments || req.comments.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-3">No comments yet</div>
                  ) : null}
                </div>
                <div className="space-y-2 pt-1">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                  />
                  <Button size="sm" variant="outline" onClick={submitComment} disabled={commenting || !comment.trim()}>
                    {commenting ? 'Adding...' : 'Add Comment'}
                  </Button>
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>

      {/* Action modal */}
      <Dialog open={!!actionModal} onOpenChange={(o) => { if (!o) setActionModal(null) }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{actionModal?.title}</DialogTitle>
            <DialogDescription>
              Requisition <span className="font-mono">{req?.refNumber}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {actionModal?.type === 'forward' && (
              <div className="space-y-3">
                <div>
                  <Label>Forward to (Staff)</Label>
                  <UserSearch
                    users={users}
                    value={actionForm.targetUserId || ''}
                    onChange={(v) => setActionForm({ ...actionForm, targetUserId: v, targetDesignationId: '' })}
                    allowClear
                    placeholder="Search staff to forward to... (optional)"
                  />
                </div>
                <div className="text-center text-xs text-muted-foreground">— or —</div>
                <div>
                  <Label>Forward to (Designation)</Label>
                  <Select
                    value={actionForm.targetDesignationId || 'none'}
                    onValueChange={(v) => setActionForm({ ...actionForm, targetDesignationId: v === 'none' ? '' : v, targetUserId: '' })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {designations.filter((d) => d.isActive && d.code !== 'STF').map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {(actionModal?.type === 'approve' || actionModal?.type === 'approve_close' ||
              actionModal?.type === 'reject' || actionModal?.type === 'reject_close') && (
              <div className="space-y-1.5 rounded border bg-muted/40 p-3">
                <Label className="flex items-center gap-1.5">
                  <FileSignature className="size-4" />
                  Your Signature (required for CMD/DFA/HOD/AD approve)
                </Label>
                <FileUpload
                  type="signature"
                  label="Upload signature"
                  accept="image/*"
                  value={actionForm.signatureUrl}
                  onChange={(url) => setActionForm({ ...actionForm, signatureUrl: url })}
                  previewClassName="h-16 w-40"
                />
              </div>
            )}
            {(actionModal?.type === 'approve_close' || actionModal?.type === 'reject_close' || actionModal?.type === 'close') && (
              <div className="space-y-1.5">
                <Label>Closure Note</Label>
                <Textarea
                  value={actionForm.closureNote || ''}
                  onChange={(e) => setActionForm({ ...actionForm, closureNote: e.target.value })}
                  placeholder="Optional note for the closure record..."
                  rows={2}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea
                value={actionForm.remarks || ''}
                onChange={(e) => setActionForm({ ...actionForm, remarks: e.target.value })}
                placeholder="Optional remarks on this action..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button
              variant={
                actionModal?.type === 'reject' || actionModal?.type === 'reject_close' ? 'destructive' : 'default'
              }
              onClick={submitAction}
              disabled={acting}
            >
              {acting ? 'Working...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

function SignatureTile({
  label, name, date, sig, remarks,
}: {
  label: string
  name?: string | null
  date?: string | null
  sig?: string | null
  remarks?: string | null
}) {
  const signed = !!name
  return (
    <div className={`rounded border p-3 ${signed ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-border'}`}>
      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <span className="font-medium">{label}</span>
        {signed ? <Check className="size-3 text-green-600" /> : <Clock className="size-3" />}
      </div>
      {sig ? (
        <img src={sig} alt={`${label} signature`} className="mt-1 h-12 object-contain bg-white rounded p-0.5" />
      ) : (
        <div className="mt-1 h-12 flex items-center justify-center text-[10px] text-muted-foreground border border-dashed rounded">
          {signed ? 'Signature on file' : 'Awaiting signature'}
        </div>
      )}
      {signed && (
        <div className="mt-1">
          <div className="text-[11px] font-medium">{name}</div>
          <div className="text-[10px] text-muted-foreground">{date ? formatDateTime(date) : ''}</div>
          {remarks && <div className="text-[10px] text-muted-foreground italic mt-0.5">"{remarks}"</div>}
        </div>
      )}
    </div>
  )
}

function MetaItem({
  label, icon: Icon, children,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Icon className="size-3" />
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
