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
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'
import UserSearch from './UserSearch'

const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent', 'Critical']

type Props = {
  open: boolean
  onClose: () => void
  users: any[]
  replyTo?: any | null
  onSent: () => void
}

export default function MailCompose({ open, onClose, users, replyTo, onSent }: Props) {
  const [form, setForm] = useState<any>({
    toId: '',
    subject: replyTo ? `Re: ${replyTo.subject?.replace(/^Re:\s*/, '')}` : '',
    body: replyTo ? `\n\n---\nOn ${new Date(replyTo.createdAt).toLocaleString()}, ${replyTo.from?.fullName || ''} wrote:\n${replyTo.body || ''}` : '',
    priority: 'Normal',
  })
  const [saving, setSaving] = useState(false)

  // Re-init when opening / replyTo changes
  const [lastReplyId, setLastReplyId] = useState<string | null>(null)
  if (open && replyTo && replyTo.id !== lastReplyId) {
    setLastReplyId(replyTo.id)
    setForm({
      toId: replyTo.fromId || '',
      subject: `Re: ${replyTo.subject?.replace(/^Re:\s*/, '')}`,
      body: `\n\n---\nOn ${new Date(replyTo.createdAt).toLocaleString()}, ${replyTo.from?.fullName || ''} wrote:\n${replyTo.body || ''}`,
      priority: 'Normal',
    })
  }
  if (open && !replyTo && lastReplyId !== null) {
    setLastReplyId(null)
    if (form.subject.startsWith('Re:')) {
      setForm({ toId: '', subject: '', body: '', priority: 'Normal' })
    }
  }

  const submit = async () => {
    if (!form.toId) { toast.error('Select a recipient'); return }
    if (!form.subject || !form.body) { toast.error('Subject and body are required'); return }
    setSaving(true)
    try {
      const body: any = {
        subject: form.subject,
        body: form.body,
        toId: form.toId,
        priority: form.priority,
      }
      if (replyTo) body.parentId = replyTo.id
      const res = await fetch('/api/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to send mail')
      } else {
        toast.success(`Mail sent to ${data.mail.to?.fullName}`)
        setForm({ toId: '', subject: '', body: '', priority: 'Normal' })
        onClose()
        onSent()
      }
    } catch {
      toast.error('Network error')
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5" /> Compose Message
          </DialogTitle>
          <DialogDescription>
            Send an internal mail message
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>To *</Label>
            <UserSearch
              users={users}
              value={form.toId}
              onChange={(v) => setForm({ ...form, toId: v })}
              placeholder="Search recipient by name, role, designation..."
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Subject *</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Subject"
              />
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
            <Label>Message *</Label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Type your message..."
              rows={8}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <><Loader2 className="size-4 animate-spin" /> Sending...</> : <><Send className="size-4" /> Send</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
