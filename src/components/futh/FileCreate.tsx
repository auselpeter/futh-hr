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
import { Loader2 } from 'lucide-react'
import StaffSearch from './StaffSearch'
import UserSearch from './UserSearch'

const TYPES = [
  { value: 'individual', label: 'Individual', code: 'IND' },
  { value: 'department', label: 'Department', code: 'DEP' },
  { value: 'external', label: 'External', code: 'EXT' },
  { value: 'committee', label: 'Committee', code: 'COM' },
]
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent', 'Critical']

type Props = {
  open: boolean
  onClose: () => void
  users: any[]
  designations: any[]
  departments: any[]
  staffList: any[]
  committees?: any[]
  onCreated: () => void
}

export default function FileCreate({
  open, onClose, users, designations, departments, staffList, committees, onCreated,
}: Props) {
  const [form, setForm] = useState<any>({
    type: 'individual',
    subject: '',
    description: '',
    priority: 'Normal',
    volume: '',
    recipientType: 'user',
    targetUserId: '',
    targetDesignationId: '',
    // individual
    staffId: '',
    // department
    departmentId: '',
    // external
    externalName: '', externalOrg: '', externalEmail: '', externalPhone: '',
    // committee
    committeeId: '',
  })
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setForm({
      type: 'individual', subject: '', description: '', priority: 'Normal', volume: '',
      recipientType: 'user', targetUserId: '', targetDesignationId: '',
      staffId: '', departmentId: '', externalName: '', externalOrg: '',
      externalEmail: '', externalPhone: '', committeeId: '',
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
    if (form.type === 'individual' && !form.staffId) {
      toast.error('Please select a staff record for individual files')
      return
    }
    if (form.type === 'department' && !form.departmentId) {
      toast.error('Please select a department')
      return
    }
    if (form.type === 'external' && !form.externalName) {
      toast.error('External files require a name')
      return
    }
    if (form.type === 'committee' && !form.committeeId) {
      toast.error('Committee files require a committee')
      return
    }
    setSaving(true)
    try {
      const body: any = {
        type: form.type,
        subject: form.subject,
        description: form.description,
        priority: form.priority,
        volume: form.volume || null,
      }
      if (form.recipientType === 'user') body.targetUserId = form.targetUserId
      if (form.recipientType === 'designation') body.targetDesignationId = form.targetDesignationId
      if (form.type === 'individual') body.staffId = form.staffId
      if (form.type === 'department') body.departmentId = form.departmentId
      if (form.type === 'committee') body.committeeId = form.committeeId
      if (form.type === 'external') {
        body.externalName = form.externalName
        body.externalOrg = form.externalOrg || null
        body.externalEmail = form.externalEmail || null
        body.externalPhone = form.externalPhone || null
      }
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create file')
      } else {
        toast.success(`File ${data.file.fileNumber} created`)
        reset()
        onClose()
        onCreated()
      }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  const typeCode = TYPES.find((t) => t.value === form.type)?.code
  const previewRef = `FUTH/REG/${typeCode}/${new Date().getFullYear()}/####`

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Registry File</DialogTitle>
          <DialogDescription>
            Create a new file for routing. File # preview:{' '}
            <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono text-secondary-foreground">
              {previewRef}
            </code>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>File Type *</Label>
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
            <div className="space-y-1.5">
              <Label>Volume</Label>
              <Input
                value={form.volume}
                onChange={(e) => setForm({ ...form, volume: e.target.value })}
                placeholder="e.g. 1, 2, 3 (optional)"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Brief subject"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed description of the file..."
              rows={4}
            />
          </div>

          {/* Type-specific fields */}
          {form.type === 'individual' && (
            <div className="space-y-1.5">
              <Label>Linked Staff</Label>
              <StaffSearch
                staff={staffList}
                value={form.staffId || ''}
                onChange={(v) => setForm({ ...form, staffId: v })}
                placeholder="Search staff by name, ID, department... (optional)"
              />
              <p className="text-[10px] text-muted-foreground">Leave empty if the file is not tied to a specific staff member.</p>
            </div>
          )}
          {form.type === 'department' && (
            <div className="space-y-1.5">
              <Label>Department *</Label>
              <Select value={form.departmentId || 'none'} onValueChange={(v) => setForm({ ...form, departmentId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select department..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.type === 'committee' && (
            <div className="space-y-1.5">
              <Label>Committee *</Label>
              <Select value={form.committeeId || 'none'} onValueChange={(v) => setForm({ ...form, committeeId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select committee..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {(committees || []).filter((c) => c.isActive).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {form.type === 'external' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>External Name *</Label>
                <Input value={form.externalName} onChange={(e) => setForm({ ...form, externalName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Organization</Label>
                <Input value={form.externalOrg} onChange={(e) => setForm({ ...form, externalOrg: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.externalEmail} onChange={(e) => setForm({ ...form, externalEmail: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.externalPhone} onChange={(e) => setForm({ ...form, externalPhone: e.target.value })} />
              </div>
            </div>
          )}

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
                placeholder="Search recipient by name, role, designation..."
              />
            ) : (
              <Select value={form.targetDesignationId} onValueChange={(v) => setForm({ ...form, targetDesignationId: v })}>
                <SelectTrigger><SelectValue placeholder="Select designation..." /></SelectTrigger>
                <SelectContent>
                  {designations.filter((d) => d.isActive && d.code !== 'STF').map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin" /> Creating...</> : 'Create File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
