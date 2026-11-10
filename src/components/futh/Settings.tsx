'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Settings as SettingsIcon, User, Mail, Phone, Building2, Briefcase, Calendar,
  ShieldCheck, ShieldAlert, Shield, Loader2, KeyRound, AlertTriangle, CheckCircle2, Copy, Download, Lock, Eye, EyeOff,
} from 'lucide-react'
import { formatDateTime, initials } from '@/lib/formatters'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import TwoFactorSetup from './TwoFactorSetup'

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  CMD: 'Chief Medical Director',
  CMA: 'Chief Medical Admin',
  AD: 'Administrator',
  DFA: 'Director Finance & Admin',
  HOD: 'Head of Department',
  HOU: 'Head of Unit',
  APPRAISAL_OFFICER: 'Appraisal Officer',
  REGISTRY_OFFICER: 'Registry Officer',
  STAFF: 'Staff',
}

export default function Settings({ user }: { user: any }) {
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([])

  // 2FA status fields — populated from the auth/me endpoint
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(user?.twoFactorEnabled || false)
  const [twoFactorEnforced, setTwoFactorEnforced] = useState<boolean>(user?.twoFactorEnforced || false)
  const [remainingRecovery, setRemainingRecovery] = useState<number>(user?.twoFactorRecoveryCodesRemaining ?? 0)
  const [twoFactorLastUsedAt, setTwoFactorLastUsedAt] = useState<string | null>(user?.twoFactorLastUsedAt || null)

  // Re-fetch the user record after closing dialogs so the UI stays in sync.
  const refreshMe = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      const json = await res.json()
      if (json.user) {
        setTwoFactorEnabled(!!json.user.twoFactorEnabled)
        setTwoFactorEnforced(!!json.user.twoFactorEnforced)
        setRemainingRecovery(json.user.twoFactorRecoveryCodesRemaining ?? 0)
        setTwoFactorLastUsedAt(json.user.twoFactorLastUsedAt || null)
      }
    } catch {}
  }

  useEffect(() => { refreshMe() }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="size-6" /> Settings & Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">View your account details and security settings</p>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <Avatar className="size-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {initials(user?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="mt-3 font-semibold">{user?.fullName}</div>
            <div className="text-xs text-muted-foreground">@{user?.username}</div>
            <Badge className="mt-2 text-[10px]">{roleLabel[user?.role] || user?.role}</Badge>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
            <CardDescription>Your institutional profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={User} label="Full Name" value={user?.fullName} />
            <InfoRow icon={User} label="Username" value={user?.username} />
            <InfoRow icon={Mail} label="Email" value={user?.email} />
            <InfoRow icon={Phone} label="Phone" value={user?.phone || '—'} />
            <InfoRow icon={Briefcase} label="Designation" value={user?.designation ? `${user.designation.code} — ${user.designation.name}` : '—'} />
            <InfoRow icon={Building2} label="Department" value={user?.department ? `${user.department.code} — ${user.department.name}` : '—'} />
            {user?.staff && (
              <InfoRow icon={User} label="Staff ID" value={user.staff.staffId} />
            )}
            <InfoRow icon={Calendar} label="Last Login" value={formatDateTime(user?.lastLoginAt)} />
            <InfoRow icon={SettingsIcon} label="Account Status" value={user?.isActive ? 'Active' : 'Inactive'} />
          </CardContent>
        </Card>
      </div>

      {/* === Two-Factor Authentication section === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600" /> Two-Factor Authentication (2FA)
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account with time-based one-time passwords (TOTP).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {twoFactorEnabled ? (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="size-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-emerald-900">2FA is enabled</div>
                  <div className="text-sm text-emerald-800 mt-1">
                    {twoFactorLastUsedAt
                      ? <>Last used {formatDistanceToNow(new Date(twoFactorLastUsedAt), { addSuffix: true })}.</>
                      : <>Not used since enabling.</>}
                    {remainingRecovery > 0 && (
                      <> You have <strong>{remainingRecovery}</strong> recovery code{remainingRecovery === 1 ? '' : 's'} remaining.</>
                    )}
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Enabled</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRegenOpen(true)}
                  className="gap-2"
                >
                  <KeyRound className="size-4" />
                  Regenerate recovery codes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDisableOpen(true)}
                  className="gap-2"
                >
                  <ShieldAlert className="size-4" />
                  Disable 2FA
                </Button>
              </div>
            </>
          ) : twoFactorEnforced ? (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <AlertTriangle className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-amber-900">2FA is required for your account</div>
                  <div className="text-sm text-amber-800 mt-1">
                    Your role requires two-factor authentication. Please set it up to maintain account security.
                  </div>
                </div>
                <Badge className="bg-amber-100 text-amber-900 border-amber-300">Required</Badge>
              </div>
              <Button onClick={() => setTwoFactorOpen(true)} className="gap-2">
                <Shield className="size-4" />
                Set up 2FA
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <Shield className="size-5 text-slate-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold">2FA is not enabled</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    We recommend enabling two-factor authentication to protect your account
                    from unauthorized access.
                  </div>
                </div>
                <Badge variant="outline">Not enabled</Badge>
              </div>
              <Button onClick={() => setTwoFactorOpen(true)} variant="outline" className="gap-2">
                <Shield className="size-4" />
                Enable 2FA
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* === Change Password section === */}
      <ChangePasswordCard />

      {/* Setup dialog */}
      <TwoFactorSetup
        open={twoFactorOpen}
        onOpenChange={setTwoFactorOpen}
        onCompleted={refreshMe}
      />

      {/* Disable dialog */}
      <DisableTwoFactorDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        onSuccess={refreshMe}
      />

      {/* Regenerate recovery codes dialog */}
      <RegenerateRecoveryDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        newCodes={newRecoveryCodes}
        setNewCodes={setNewRecoveryCodes}
        onSuccess={refreshMe}
      />
    </div>
  )
}

function InfoRow({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="font-medium text-sm">{value || '—'}</div>
    </div>
  )
}

// === Disable 2FA dialog ===
function DisableTwoFactorDialog({
  open, onOpenChange, onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      toast.error('Enter your password to confirm')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to disable 2FA')
        return
      }
      toast.success('2FA disabled')
      setPassword('')
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setPassword('') }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" /> Disable 2FA
          </DialogTitle>
          <DialogDescription>
            This will remove two-factor authentication from your account. You will need to enter your password to confirm.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="disable-password">Confirm your password</Label>
            <Input
              id="disable-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Disable 2FA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// === Regenerate recovery codes dialog ===
function RegenerateRecoveryDialog({
  open, onOpenChange, newCodes, setNewCodes, onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  newCodes: string[]
  setNewCodes: (c: string[]) => void
  onSuccess: () => void
}) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      toast.error('Enter your password to confirm')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/regenerate-recovery-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to regenerate recovery codes')
        return
      }
      setNewCodes(data.recoveryCodes || [])
      toast.success('New recovery codes generated')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  const downloadCodes = () => {
    const text = `FUTH LAFIA HR System — Two-Factor Recovery Codes
Generated: ${new Date().toLocaleString()}

These codes can each be used exactly once to access your account if you lose
your authenticator device. Store them in a safe place.

${newCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}
`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `futh-lafia-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const close = () => {
    onOpenChange(false)
    setPassword('')
    setNewCodes([])
    setSaved(false)
    setCopied(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5" /> Regenerate recovery codes
          </DialogTitle>
          <DialogDescription>
            This will invalidate your existing recovery codes and generate new ones.
          </DialogDescription>
        </DialogHeader>
        {newCodes.length === 0 ? (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="regen-password">Confirm your password</Label>
              <Input
                id="regen-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Generate new codes
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-amber-800">
                  <strong>Save these codes!</strong> They will not be shown again, and your previous codes are now invalid.
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {newCodes.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <KeyRound className="size-3 text-muted-foreground" />
                    <span className="select-all">{c}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(newCodes.join('\n')); setCopied(true); toast.success('Codes copied'); }} className="flex-1">
                <Copy className="size-4 mr-2" /> Copy all
              </Button>
              <Button variant="outline" onClick={downloadCodes} className="flex-1">
                <Download className="size-4 mr-2" /> Download
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="confirm-regen-saved"
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="size-4"
              />
              <Label htmlFor="confirm-regen-saved" className="text-sm cursor-pointer">
                I've saved the new codes somewhere safe
              </Label>
            </div>
            <Button onClick={close} disabled={!saved} className="w-full">
              <CheckCircle2 className="size-4 mr-2" /> Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess(false)
    if (!currentPassword || !newPassword || !confirmNewPassword) { toast.error('Fill in all three password fields'); return }
    if (newPassword !== confirmNewPassword) { toast.error('New password and confirmation do not match'); return }
    if (newPassword.length < 6) { toast.error('New password must be at least 6 characters long'); return }
    if (newPassword === currentPassword) { toast.error('New password must be different from your current password'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to change password'); setLoading(false); return }
      toast.success('Password changed successfully')
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('')
      setSuccess(true); setTimeout(() => setSuccess(false), 5000)
    } catch { toast.error('Network error') }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="size-5 text-primary" /> Change Password</CardTitle>
        <CardDescription>Update your account password. If your account was created with the default password (<code className="bg-muted px-1 rounded">admin123</code>) or was reset by an admin, please change it here.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3 max-w-md">
          <div className="space-y-1.5"><Label htmlFor="cur-pw">Current Password</Label>
            <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input id="cur-pw" type={showCur ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter your current password" className="pl-9 pr-10" disabled={loading} autoFocus />
              <button type="button" onClick={() => setShowCur((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>{showCur ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="new-pw">New Password</Label>
            <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input id="new-pw" type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password (min 6 characters)" className="pl-9 pr-10" disabled={loading} />
              <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>{showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="confirm-pw">Confirm New Password</Label><Input id="confirm-pw" type={showNew ? 'text' : 'password'} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Re-enter new password" disabled={loading} /></div>
          {success && <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-50 border border-emerald-200 text-sm text-emerald-800"><CheckCircle2 className="size-4" /><span>Password changed successfully. Use your new password the next time you sign in.</span></div>}
          <div className="flex justify-end"><Button type="submit" disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <KeyRound className="size-4 mr-2" />}Change Password</Button></div>
        </form>
      </CardContent>
    </Card>
  )
}
