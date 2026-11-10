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
  Send, Check, Undo2, Ban, Archive, MessageSquare,
  Clock, User as UserIcon, X, FileSignature, Printer, Download, Users2,
  Pencil, Save,
} from 'lucide-react'
import { formatDateTime, initials } from '@/lib/formatters'
import { StatusBadge, PriorityBadge, TypeBadge } from './badges'
import { printHTML, registryCoverSheetHTML, signatureBox, formatDateForPrint, htmlEscape, row } from '@/lib/print'
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
  type: 'forward' | 'acknowledge' | 'return' | 'complete' | 'reject' | 'archive'
  title: string
}

export default function FileDetail({
  id, currentUser, users, designations, onClose, onUpdated,
}: Props) {
  const [file, setFile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [actionModal, setActionModal] = useState<ActionModal | null>(null)
  const [actionForm, setActionForm] = useState<any>({})
  const [acting, setActing] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const [editRefOpen, setEditRefOpen] = useState(false)
  const [editRef, setEditRef] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editVolume, setEditVolume] = useState('')
  const [editPriority, setEditPriority] = useState('Normal')
  const [savingRef, setSavingRef] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/files/${id}`, { cache: 'no-store' })
      const data = await res.json()
      setFile(data.file)
    } catch {
      toast.error('Failed to load file')
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
      setFile(null)
    }
  }, [id, load])

  if (!id) return null

  const isClosed = ['archived', 'completed'].includes(file?.state || '')
  const isHolder = file?.currentHolderId === currentUser?.id
  const isTargetDesignation =
    !file?.currentHolderId &&
    file?.targetDesignationId !== null &&
    file?.targetDesignationId === currentUser?.designationId
  const canBypass = ['SUPER_ADMIN', 'ADMIN', 'CMD'].includes(currentUser?.role)
  const isRegistry = ['SUPER_ADMIN', 'ADMIN', 'REGISTRY_OFFICER'].includes(currentUser?.role)
  const canAct = (isHolder || isTargetDesignation || canBypass) && !isClosed

  const openAction = (type: ActionModal['type'], title: string) => {
    setActionForm({ remarks: '', targetUserId: '', targetDesignationId: '', signatureUrl: '' })
    setActionModal({ type, title })
  }

  const submitAction = async () => {
    if (!file || !actionModal) return
    if (actionModal.type === 'forward' && !actionForm.targetUserId && !actionForm.targetDesignationId) {
      toast.error('Select a recipient')
      return
    }
    setActing(true)
    try {
      const body: any = {
        action: actionModal.type,
        remarks: actionForm.remarks || null,
        signatureUrl: actionForm.signatureUrl || null,
      }
      if (actionModal.type === 'forward') {
        body.targetUserId = actionForm.targetUserId || null
        body.targetDesignationId = actionForm.targetDesignationId || null
      }
      const res = await fetch(`/api/files/${file.id}/action`, {
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
    if (!file || !comment.trim()) return
    setCommenting(true)
    try {
      const res = await fetch(`/api/files/${file.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment }),
      })
      if (!res.ok) {
        toast.error('Failed to add comment')
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

  const openEditRef = () => {
    if (!file) return
    setEditRef(file.fileNumber || '')
    setEditSubject(file.subject || '')
    setEditDesc(file.description || '')
    setEditVolume(file.volume || '')
    setEditPriority(file.priority || 'Normal')
    setEditRefOpen(true)
  }

  const saveRef = async () => {
    if (!file) return
    if (!editRef.trim()) { toast.error('File reference number cannot be empty'); return }
    if (!editSubject.trim()) { toast.error('Subject cannot be empty'); return }
    setSavingRef(true)
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileNumber: editRef.trim(), subject: editSubject.trim(), description: editDesc.trim(), volume: editVolume || null, priority: editPriority }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to update file') }
      else { toast.success(`File reference number updated to ${data.file.fileNumber}`); setFile(data.file); setEditRefOpen(false); onUpdated?.() }
    } catch { toast.error('Network error') }
    setSavingRef(false)
  }

  const printCoverSheet = async () => {
    if (!file) return
    // Build the type-specific subtitle line — shows the linked entity next to the subject.
    // e.g. "Staff: Peter Ade (FUTH/001)" or "Department: Surgery" or "External: Ministry of Health" or "Committee: Tenders Board"
    let typeLabel = 'Individual'
    let typeSpecificLine = ''
    if (file.type === 'external') {
      typeLabel = 'Correspondent'
      const parts = [file.externalName, file.externalOrg].filter(Boolean)
      typeSpecificLine = parts.length ? `External / Correspondent: ${parts.join(' — ')}` : ''
    } else if (file.type === 'department' && file.department) {
      typeLabel = 'Department'
      typeSpecificLine = `Department: ${file.department.code} — ${file.department.name}`
    } else if (file.type === 'committee' && file.committee) {
      typeLabel = 'Committee'
      typeSpecificLine = `Committee: ${file.committee.code} — ${file.committee.name}`
    } else if (file.type === 'individual') {
      typeLabel = 'Individual / Personal'
      // The staff relation is included on file via fileInclude, but we need to check it
      const staffName = (file as any).staff?.fullName
      const staffId = (file as any).staff?.staffId
      typeSpecificLine = staffName ? `Staff: ${staffName}${staffId ? ` (${staffId})` : ''}` : 'Personal file'
    }

    // Map the existing routing history (file.routes) into the entries that the
    // GEN.3 REVISED cover sheet expects: TO / PAGE / DATE / SIGN
    const routes = (file.routes || []).map((r: any) => ({
      createdAt: r.createdAt,
      action: r.action,
      fromName: r.fromUser?.fullName || null,
      toName: r.toUser?.fullName || r.toDesignation?.name || null,
      signerName: r.signerName || null,
      signatureUrl: r.signatureUrl || null,
      remarks: r.remarks || null,
    }))

    const html = registryCoverSheetHTML({
      fileNumber: file.fileNumber,
      volume: (file as any).volume || null,
      subject: file.subject,
      type: file.type,
      typeLabel,
      typeSpecificLine,
      createdBy: file.createdBy?.fullName,
      createdAt: file.createdAt,
      routes,
    })
    await printHTML(html, `Registry File ${file.fileNumber}`)
  }

  return (
    <Sheet open={!!id} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto scroll-thin">
        {loading || !file ? (
          <div className="p-8 text-center text-muted-foreground">Loading file...</div>
        ) : (
          <>
            <SheetHeader className="bg-gradient-to-br from-[#14532d] to-[#15803d] text-white p-6 sticky top-0 z-10">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <SheetTitle className="text-white text-lg flex items-center gap-2">
                    <span className="font-mono">{file.fileNumber}</span>
                    {isRegistry && (
                      <button type="button" onClick={openEditRef} title="Edit file reference number" className="text-white/80 hover:text-white hover:bg-white/15 rounded p-1">
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    <TypeBadge type={file.type} className="bg-white/15 text-white border-white/30" />
                    {(file as any).volume && (
                      <span className="text-xs bg-white/15 text-white border border-white/30 px-2 py-0.5 rounded">
                        Vol. {(file as any).volume}
                      </span>
                    )}
                  </SheetTitle>
                  <SheetDescription className="text-white/85 mt-1 text-sm">
                    {file.subject}
                  </SheetDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={file.status} className="bg-white/15 text-white border-white/30" />
                  <PriorityBadge priority={file.priority} className="bg-white/15 text-white border-white/30" />
                </div>
              </div>
            </SheetHeader>

            <div className="p-6 space-y-6">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={printCoverSheet}>
                  <Printer className="size-4" /> Print Cover Sheet
                </Button>
                <Button size="sm" variant="outline" onClick={printCoverSheet}
                  title="Same as Print — choose 'Save as PDF' in the browser print dialog">
                  <Download className="size-4" /> Download PDF
                </Button>
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">Description</h3>
                <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border border-border/60">
                  {file.description}
                </p>
              </section>

              {/* External/Department/Staff/Committee info */}
              {file.type === 'external' && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-primary">External Party</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm bg-pink-50/50 border border-pink-100 rounded-md p-3">
                    <div><span className="text-muted-foreground">Name:</span> {file.externalName}</div>
                    <div><span className="text-muted-foreground">Org:</span> {file.externalOrg || '—'}</div>
                    <div><span className="text-muted-foreground">Email:</span> {file.externalEmail || '—'}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {file.externalPhone || '—'}</div>
                  </div>
                </section>
              )}
              {file.type === 'department' && file.department && (
                <section className="space-y-1 text-sm bg-blue-50/50 border border-blue-100 rounded-md p-3">
                  <span className="text-muted-foreground">Department:</span> {file.department.code} — {file.department.name}
                </section>
              )}
              {file.type === 'individual' && (
                <section className="space-y-1 text-sm bg-emerald-50/50 border border-emerald-100 rounded-md p-3">
                  <span className="text-muted-foreground">Linked Staff ID:</span> {file.staffId || '—'}
                </section>
              )}
              {file.type === 'committee' && file.committee && (
                <section className="space-y-1 text-sm bg-violet-50/50 border border-violet-100 rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <Users2 className="size-4 text-violet-600" />
                    <span className="text-muted-foreground">Committee:</span>
                    <Badge variant="outline" className="font-mono text-[11px]">{file.committee.code}</Badge>
                    <span className="font-medium">{file.committee.name}</span>
                  </div>
                  {file.committee.description && (
                    <div className="text-xs text-muted-foreground mt-1">{file.committee.description}</div>
                  )}
                </section>
              )}

              {/* Closure signatures for completed/archived files */}
              {isClosed && (file.cmdSignatureUrl || file.dfaSignatureUrl || file.hodSignatureUrl || file.registrySignatureUrl) && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                    <FileSignature className="size-4" /> Closure Signatures
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <SignatureTile label="CMD" sig={file.cmdSignatureUrl} date={file.cmdSignedAt} />
                    <SignatureTile label="DFA" sig={file.dfaSignatureUrl} date={file.dfaSignedAt} />
                    <SignatureTile label="HOD" sig={file.hodSignatureUrl} date={file.hodSignedAt} />
                    <SignatureTile label="Registry" sig={file.registrySignatureUrl} date={file.registrySignedAt} />
                  </div>
                </section>
              )}

              {/* Meta */}
              <section className="grid grid-cols-2 gap-3 text-sm">
                <MetaItem label="Created By" icon={UserIcon}>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                        {initials(file.createdBy?.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{file.createdBy?.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {file.createdBy?.designation?.code} · {file.createdBy?.department?.code}
                      </div>
                    </div>
                  </div>
                </MetaItem>
                <MetaItem label="Current Holder" icon={UserIcon}>
                  {file.currentHolder ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarFallback className="bg-amber-100 text-amber-700 text-[10px]">
                          {initials(file.currentHolder?.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{file.currentHolder?.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {file.currentHolder?.designation?.code} · {file.currentHolder?.department?.code}
                        </div>
                      </div>
                    </div>
                  ) : file.targetDesignation ? (
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">
                        {file.targetDesignation.code}
                      </div>
                      <div>
                        <div className="font-medium">{file.targetDesignation.name}</div>
                        <div className="text-xs text-muted-foreground">Routed to designation</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </MetaItem>
                <MetaItem label="Created" icon={Clock}>{formatDateTime(file.createdAt)}</MetaItem>
                <MetaItem label="Last Update" icon={Clock}>{formatDateTime(file.updatedAt)}</MetaItem>
                {file.closedAt && (
                  <MetaItem label="Closed" icon={Ban}>
                    {formatDateTime(file.closedAt)} by {file.closedBy?.fullName || 'System'}
                  </MetaItem>
                )}
              </section>

              {/* Actions */}
              {canAct && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-primary">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openAction('forward', 'Sign & Forward File')}>
                      <Send className="size-4" /> Sign & Forward
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAction('acknowledge', 'Acknowledge Receipt')}>
                      <Check className="size-4" /> Acknowledge
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAction('return', 'Return to Sender')}>
                      <Undo2 className="size-4" /> Return
                    </Button>
                    <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => openAction('complete', 'Sign & Mark Completed')}>
                      <Check className="size-4" /> Sign & Complete
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => openAction('reject', 'Reject File')}>
                      <X className="size-4" /> Reject
                    </Button>
                    {isRegistry && (
                      <Button size="sm" variant="outline" onClick={() => openAction('archive', 'Sign & Archive File')}>
                        <Archive className="size-4" /> Sign & Archive
                      </Button>
                    )}
                  </div>
                </section>
              )}

              {/* Routing history */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">Routing History ({file.routes?.length || 0})</h3>
                <div className="space-y-2">
                  {(file.routes || []).map((route: any) => {
                    const actionColor: Record<string, string> = {
                      forward: 'text-amber-600 bg-amber-50',
                      acknowledge: 'text-sky-600 bg-sky-50',
                      return: 'text-orange-600 bg-orange-50',
                      complete: 'text-green-600 bg-green-50',
                      reject: 'text-red-600 bg-red-50',
                      archive: 'text-violet-600 bg-violet-50',
                    }
                    return (
                      <div key={route.id} className="flex gap-3 items-start">
                        <div className={`size-8 rounded-full flex items-center justify-center flex-shrink-0 ${actionColor[route.action] || actionColor.forward}`}>
                          {route.action === 'forward' ? <Send className="size-3.5" /> :
                            route.action === 'acknowledge' ? <Check className="size-3.5" /> :
                            route.action === 'return' ? <Undo2 className="size-3.5" /> :
                            route.action === 'complete' ? <Check className="size-3.5" /> :
                            route.action === 'reject' ? <X className="size-3.5" /> :
                            <Archive className="size-3.5" />}
                        </div>
                        <div className="flex-1 border-l-2 border-border pl-3 pb-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-medium capitalize">{route.action}</div>
                            <div className="text-[10px] text-muted-foreground">{formatDateTime(route.createdAt)}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            From <span className="font-medium text-foreground">{route.fromUser?.fullName}</span> to{' '}
                            {route.toUser ? <span className="font-medium text-foreground">{route.toUser.fullName}</span> :
                              route.toDesignation ? <span className="font-medium text-foreground">{route.toDesignation.name}</span> :
                              <span className="text-muted-foreground">(closed)</span>}
                          </div>
                          {route.signerName && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Signed by <span className="font-medium">{route.signerName}</span>
                              {route.signerDesignation ? ` · ${route.signerDesignation}` : ''}
                              {route.signedAt ? ` · ${formatDateTime(route.signedAt)}` : ''}
                            </div>
                          )}
                          {route.signatureUrl && (
                            <img src={route.signatureUrl} alt="signature" className="mt-1 max-h-12 border bg-white rounded p-0.5" />
                          )}
                          {route.remarks && <div className="text-xs italic text-muted-foreground mt-1">"{route.remarks}"</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Comments */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                  <MessageSquare className="size-4" /> Comments ({file.comments?.length || 0})
                </h3>
                <div className="space-y-2">
                  {(file.comments || []).map((c: any) => (
                    <div key={c.id} className="bg-muted/30 rounded-md p-3 border border-border/60">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="bg-primary/15 text-primary text-[10px]">
                              {initials(c.user?.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{c.user?.fullName}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                  {(!file.comments || file.comments.length === 0) && (
                    <div className="text-xs text-muted-foreground text-center py-3">No comments yet</div>
                  )}
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

      <Dialog open={!!actionModal} onOpenChange={(o) => { if (!o) setActionModal(null) }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{actionModal?.title}</DialogTitle>
            <DialogDescription>
              File <span className="font-mono">{file?.fileNumber}</span>
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
            {/* Signature upload — shown for all actions */}
            <div className="space-y-1.5 rounded border bg-muted/40 p-3">
              <Label className="flex items-center gap-1.5">
                <FileSignature className="size-4" />
                Your Signature (optional)
              </Label>
              <FileUpload
                type="signature"
                label="Upload signature"
                accept="image/*"
                value={actionForm.signatureUrl}
                onChange={(url) => setActionForm({ ...actionForm, signatureUrl: url })}
                previewClassName="h-16 w-40"
              />
              {(actionModal?.type === 'complete' || actionModal?.type === 'archive') && (
                <p className="text-[10px] text-muted-foreground">
                  For complete/archive actions, this signature will be saved as a closure signature
                  based on your role (CMD/DFA/HOD/Registry).
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea
                value={actionForm.remarks || ''}
                onChange={(e) => setActionForm({ ...actionForm, remarks: e.target.value })}
                placeholder="Optional remarks..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button
              variant={
                actionModal?.type === 'reject' ? 'destructive' : 'default'
              }
              onClick={submitAction}
              disabled={acting}
            >
              {acting ? 'Working...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Edit File Reference Number dialog (Registry only) === */}
      <Dialog open={editRefOpen} onOpenChange={(o) => { if (!o) setEditRefOpen(false) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5" /> Edit File Reference
            </DialogTitle>
            <DialogDescription>
              Update the file reference number to match the number on the physical folder.
            </DialogDescription>
          </DialogHeader>
          {file && (
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>File Reference Number *</Label>
                <Input value={editRef} onChange={(e) => setEditRef(e.target.value)} placeholder="e.g. FUTH/REG/IND/2026/0001 or the physical folder number" className="font-mono" autoFocus />
                <p className="text-[10px] text-muted-foreground">Must be unique across all files. The current value is <code className="bg-muted px-1 rounded">{file.fileNumber}</code>.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Subject *</Label>
                <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Volume</Label>
                  <Input value={editVolume} onChange={(e) => setEditVolume(e.target.value)} placeholder="e.g. 1, 2, 3" />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Normal', 'High', 'Urgent', 'Confidential'].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRefOpen(false)} disabled={savingRef}>Cancel</Button>
            <Button onClick={saveRef} disabled={savingRef}>
              {savingRef ? <Save className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

function SignatureTile({ label, sig, date }: { label: string; sig?: string | null; date?: string | null }) {
  if (!sig && !date) {
    return (
      <div className="rounded border p-3 bg-muted/30">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="h-12 mt-1 flex items-center justify-center text-[10px] text-muted-foreground border border-dashed rounded">
          Not signed
        </div>
      </div>
    )
  }
  return (
    <div className="rounded border p-3 bg-green-50 border-green-200">
      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <span className="font-medium">{label}</span>
        {sig && <Check className="size-3 text-green-600" />}
      </div>
      {sig ? (
        <img src={sig} alt={`${label} signature`} className="mt-1 h-12 object-contain bg-white rounded p-0.5" />
      ) : (
        <div className="mt-1 h-12" />
      )}
      {date && <div className="text-[10px] text-muted-foreground mt-1">{formatDateTime(date)}</div>}
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
