'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card, CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import {
  Inbox, Send, Star, Archive, Mail as MailIcon, Plus, Search, Star as StarIcon,
  Archive as ArchiveIcon, Reply, Trash2, MailOpen, Clock,
} from 'lucide-react'
import { formatDateTime, timeAgo, initials } from '@/lib/formatters'
import { PriorityBadge } from './badges'
import MailCompose from './MailCompose'
import { toast } from 'sonner'

const FOLDERS = [
  { value: 'inbox', label: 'Inbox', icon: Inbox },
  { value: 'sent', label: 'Sent', icon: Send },
  { value: 'starred', label: 'Starred', icon: Star },
  { value: 'archived', label: 'Archived', icon: Archive },
] as const

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'starred', label: 'Starred' },
  { value: 'archived', label: 'Archived' },
] as const

type Props = {
  user: any
  title?: string
}

export default function Mail({ user, title = 'Mail' }: Props) {
  const [mail, setMail] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [folder, setFolder] = useState<string>('inbox')
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const [composing, setComposing] = useState(false)
  const [replyTo, setReplyTo] = useState<any | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ folder })
      if (folder === 'inbox') params.set('filter', filter)
      const [mailRes, userRes] = await Promise.all([
        fetch(`/api/mail?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/users', { cache: 'no-store' }),
      ])
      setMail((await mailRes.json()).mail || [])
      setUsers((await userRes.json()).users || [])
    } catch {
      toast.error('Failed to load mail')
    }
    setLoading(false)
  }, [folder, filter])

  useEffect(() => { load() }, [load])

  const openMail = async (m: any) => {
    setSelected(m)
    // Fetch full mail to mark as read
    try {
      const res = await fetch(`/api/mail/${m.id}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.mail) {
        setSelected(data.mail)
        load()
      }
    } catch {}
  }

  const updateMail = async (action: string) => {
    if (!selected) return
    try {
      const res = await fetch(`/api/mail/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        toast.error('Failed to update')
      } else {
        const data = await res.json()
        setSelected(data.mail)
        toast.success(`Mail ${action}`)
        load()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const deleteMail = async () => {
    if (!selected) return
    try {
      const res = await fetch(`/api/mail/${selected.id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to delete')
      } else {
        toast.success('Mail deleted')
        setSelected(null)
        load()
      }
    } catch {
      toast.error('Network error')
    }
  }

  const filtered = search
    ? mail.filter((m) => (m.subject || '').toLowerCase().includes(search.toLowerCase()) || (m.body || '').toLowerCase().includes(search.toLowerCase()))
    : mail

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MailIcon className="size-6" /> {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Internal messaging system</p>
        </div>
        <Button onClick={() => { setReplyTo(null); setComposing(true) }} size="sm">
          <Plus className="size-4" /> Compose
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Folder sidebar */}
        <Card>
          <CardContent className="p-2">
            <nav className="space-y-1">
              {FOLDERS.map((f) => {
                const Icon = f.icon
                const active = folder === f.value
                return (
                  <button
                    key={f.value}
                    onClick={() => { setFolder(f.value); if (f.value !== 'inbox') setFilter('all') }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  >
                    <Icon className="size-4" />
                    <span className="flex-1 text-left">{f.label}</span>
                    {f.value === 'inbox' && mail.filter((m) => !m.isRead).length > 0 && (
                      <Badge className="bg-destructive text-white text-[10px] font-bold">
                        {mail.filter((m) => !m.isRead).length}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </nav>
            {folder === 'inbox' && (
              <div className="mt-4 space-y-1 border-t pt-2">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground px-3 pb-1">Filter</div>
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={`w-full flex items-center px-3 py-1.5 rounded-md text-xs transition ${filter === f.value ? 'bg-secondary text-secondary-foreground font-medium' : 'hover:bg-muted'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mail list */}
        <Card>
          <CardContent className="p-0">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search mail..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            {loading ? (
              <div className="p-3 space-y-3">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <MailIcon className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                No messages in this folder
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)] min-h-[400px]">
                <div className="divide-y">
                  {filtered.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => openMail(m)}
                      className={`w-full flex items-start gap-3 p-3 hover:bg-muted/50 text-left transition ${!m.isRead && folder === 'inbox' ? 'bg-primary/5' : ''}`}
                    >
                      <Avatar className="size-9 mt-0.5">
                        <AvatarFallback className={`text-xs ${m.isRead ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                          {initials(folder === 'sent' ? m.to?.fullName : m.from?.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className={`text-sm truncate ${!m.isRead && folder === 'inbox' ? 'font-semibold' : 'font-medium'}`}>
                            {folder === 'sent' ? `To: ${m.to?.fullName}` : m.from?.fullName}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex-shrink-0">
                            {timeAgo(m.createdAt)}
                          </div>
                        </div>
                        <div className="text-sm truncate">{m.subject}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {m.body?.replace(/\n.*$/s, '').slice(0, 100)}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {!m.isRead && folder === 'inbox' && (
                            <span className="size-1.5 rounded-full bg-destructive" />
                          )}
                          {m.isStarred && <StarIcon className="size-3 text-amber-500 fill-amber-500" />}
                          {m.isArchived && <ArchiveIcon className="size-3 text-violet-500" />}
                          <PriorityBadge priority={m.priority} className="ml-auto" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mail detail */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto scroll-thin">
          {selected && (
            <>
              <SheetHeader className="p-6 border-b">
                <SheetTitle className="text-lg">{selected.subject}</SheetTitle>
                <SheetDescription className="text-sm">
                  <PriorityBadge priority={selected.priority} />
                </SheetDescription>
              </SheetHeader>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {initials(selected.from?.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{selected.from?.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {selected.from?.designation?.code} · {selected.from?.department?.code}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <Clock className="size-3 inline mr-1" />
                    {formatDateTime(selected.createdAt)}
                  </div>
                </div>
                <div className="bg-muted/30 rounded-md p-4 border border-border/60 text-sm whitespace-pre-wrap">
                  {selected.body}
                </div>
                {selected.parent && (
                  <div className="text-xs text-muted-foreground border-l-2 border-border pl-3">
                    In reply to: <span className="font-medium">{selected.parent.subject}</span>
                  </div>
                )}
                {selected.requisition && (
                  <div className="text-xs bg-amber-50 border border-amber-100 rounded-md p-2">
                    Linked requisition: <span className="font-mono">{selected.requisition.refNumber}</span> — {selected.requisition.subject}
                  </div>
                )}
                {selected.file && (
                  <div className="text-xs bg-violet-50 border border-violet-100 rounded-md p-2">
                    Linked file: <span className="font-mono">{selected.file.fileNumber}</span> — {selected.file.subject}
                  </div>
                )}
              </div>
              <SheetFooter className="px-6 pb-6 pt-2 border-t">
                <div className="flex flex-wrap gap-2 w-full">
                  <Button variant="outline" size="sm" onClick={() => { setReplyTo(selected); setComposing(true) }}>
                    <Reply className="size-4" /> Reply
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => updateMail(selected.isStarred ? 'unstar' : 'star')}>
                    <StarIcon className={`size-4 ${selected.isStarred ? 'fill-amber-500 text-amber-500' : ''}`} />
                    {selected.isStarred ? 'Unstar' : 'Star'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => updateMail(selected.isArchived ? 'unarchive' : 'archive')}>
                    <ArchiveIcon className="size-4" /> {selected.isArchived ? 'Unarchive' : 'Archive'}
                  </Button>
                  {!selected.isRead && (
                    <Button variant="outline" size="sm" onClick={() => updateMail('unread')}>
                      <MailOpen className="size-4" /> Mark unread
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive ml-auto" onClick={deleteMail}>
                    <Trash2 className="size-4" /> Delete
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <MailCompose
        open={composing}
        onClose={() => { setComposing(false); setReplyTo(null) }}
        users={users}
        replyTo={replyTo}
        onSent={load}
      />
    </div>
  )
}
