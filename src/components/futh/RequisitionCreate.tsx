'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Loader2, Info } from 'lucide-react'
import UserSearch from './UserSearch'

const TYPES = [
  { value: 'service', label: 'Service Request', code: 'SVC' },
  { value: 'expense', label: 'Expense / Claim', code: 'EXP' },
  { value: 'other', label: 'Other', code: 'OTH' },
]

const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent', 'Critical']

type Props = {
  open: boolean
  onClose: () => void
  users: any[]
  designations: any[]
  currentUser?: any
  onCreated: () => void
}

export default function RequisitionCreate({ open, onClose, users, designations, currentUser, onCreated }: Props) {
  const [form, setForm] = useState<any>({
    type: 'service',
    subject: '',
    description: '',
    comment: '',
    amount: '',
    priority: 'Normal',
    recipientType: 'user',
    targetUserId: '',
    targetDesignationId: '',
  })
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setForm({
      type: 'service', subject: '', description: '', comment: '', amount: '',
      priority: 'Normal', recipientType: 'user', targetUserId: '', targetDesignationId: '',
    })
  }

  const submit = async () => {
    if (!form.subject || !form.description) {
      toast.error('Subject and description are required')
      return
    }
    if (form.recipientType === 'user' && !form.targetUserId) {
      toast.error('Please select a recipient')
      return
    }
    if (form.recipientType === 'designation' && !form.targetDesignationId) {
      toast.error('Please select a designation')
      return
    }
    if (form.type === 'expense' && (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0)) {
      toast.error('Please enter a valid amount for expense requisitions')
      return
    }
    setSaving(true)
    try {
      const body: any = {
        type: form.type,
        subject: form.subject,
        description: form.description,
        comment: form.comment || null,
        priority: form.priority,
      }
      if (form.type === 'expense') body.amount = Number(form.amount)
      if (form.recipientType === 'user') body.targetUserId = form.targetUserId
      if (form.recipientType === 'designation') body.targetDesignationId = form.targetDesignationId

      const res = await fetch('/api/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create')
      } else {
        toast.success(`Requisition ${data.requisition.refNumber} created`)
        reset()
        onClose()
        onCreated()
      }
    } catch (e: any) {
      toast.error('Network error')
    }
    setSaving(false)
  }

  const typeCode = TYPES.find((t) => t.value === form.type)?.code
  const previewRef = `FUTH/REQ/${typeCode}/${new Date().getFullYear()}/####`

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Requisition</DialogTitle>
          <DialogDescription>
            Submit a new requisition for routing &amp; approval. Reference preview:{' '}
            <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono text-secondary-foreground">
              {previewRef}
            </code>
          </DialogDescription>
        </DialogHeader>
        {currentUser && !['SUPER_ADMIN', 'ADMIN', 'CMD', 'CMA', 'AD', 'DFA', 'HOD', 'HOU', 'APPRAISAL_OFFICER', 'REGISTRY_OFFICER'].includes(currentUser.activeRole || currentUser.role) && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800 flex items-start gap-2">
            <Info className="size-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Note:</strong> Your requisition will be automatically routed to your Head of Unit (HOU) first,
              then to the HOD for approval. The HOD will select who to forward it to. This is per institutional
              communication policy for staff files.
            </div>
          </div>
        )}
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label} ({t.code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Brief subject — e.g. Request for ICU equipment"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Provide a detailed description..."
              rows={4}
            />
          </div>
          {form.type === 'expense' && (
            <div className="space-y-1.5">
              <Label>Amount (₦) *</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="e.g. 850000"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Comment / Note (optional)</Label>
            <Textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              placeholder="Any additional note for the recipient..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Send to *</Label>
            <Tabs
              value={form.recipientType}
              onValueChange={(v) => setForm({ ...form, recipientType: v })}
            >
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="user">Specific Staff</TabsTrigger>
                <TabsTrigger value="designation">Designation</TabsTrigger>
              </TabsList>
            </Tabs>
            {form.recipientType === 'user' ? (
              <UserSearch
                users={users}
                value={form.targetUserId}
                onChange={(v) => setForm({ ...form, targetUserId: v })}
                filter={(u) => !['SUPER_ADMIN'].includes(u.role)}
                placeholder="Search recipient by name, role, designation..."
              />
            ) : (
              <Select value={form.targetDesignationId} onValueChange={(v) => setForm({ ...form, targetDesignationId: v })}>
                <SelectTrigger><SelectValue placeholder="Select designation..." /></SelectTrigger>
                <SelectContent>
                  {designations
                    .filter((d) => d.isActive && d.code !== 'STF')
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin" /> Submitting...</> : 'Submit Requisition'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
