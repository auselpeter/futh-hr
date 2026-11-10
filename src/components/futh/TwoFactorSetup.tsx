'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  InputOTP, InputOTPGroup, InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  Shield, Smartphone, Copy, Download, KeyRound, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

type Step = 'qr' | 'code' | 'recovery' | 'done'

type Props = {
  userId?: string          // for unauthenticated (login-flow) use; if absent, the current session user is used
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted?: () => void  // called after recovery codes are saved/dismissed
  // If `inline` is true, render without the Dialog wrapper (e.g. inside the login screen).
  inline?: boolean
}

export default function TwoFactorSetup({ userId, open, onOpenChange, onCompleted, inline }: Props) {
  const [step, setStep] = useState<Step>('qr')
  const [secret, setSecret] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [otpauthUrl, setOtpauthUrl] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  const beginSetup = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to start 2FA setup')
        return
      }
      setSecret(data.secret)
      setQrDataUrl(data.qrDataUrl)
      setOtpauthUrl(data.otpauthUrl)
      setStep('qr')
    } catch {
      toast.error('Network error — please retry')
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    if (code.length !== 6) {
      toast.error('Enter the 6-digit code from your authenticator app')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Invalid code — please try again')
        return
      }
      setRecoveryCodes(data.recoveryCodes || [])
      setStep('recovery')
      toast.success('2FA enabled! Save your recovery codes below.')
    } catch {
      toast.error('Network error — please retry')
    } finally {
      setLoading(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    toast.success('Secret copied to clipboard')
  }

  const downloadRecoveryCodes = () => {
    const text = `FUTH LAFIA HR System — Two-Factor Recovery Codes
Generated: ${new Date().toLocaleString()}
Username: ${userId || 'Current user'}

These codes can each be used exactly once to access your account if you lose
your authenticator device. Store them in a safe place.

${recoveryCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')}

WARNING: Anyone with these codes can access your account. Do not share them.
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
    toast.success('Recovery codes downloaded')
  }

  const finish = () => {
    if (!saved) {
      toast.error('Please check the box to confirm you have saved your recovery codes')
      return
    }
    setStep('done')
    toast.success('2FA setup complete!')
    onCompleted?.()
    if (!inline) onOpenChange(false)
    // Reset state for next time
    setTimeout(() => {
      setStep('qr')
      setSecret('')
      setQrDataUrl('')
      setRecoveryCodes([])
      setCode('')
      setSaved(false)
    }, 300)
  }

  // === Body content ===
  const body = (
    <div className="space-y-4">
      {step === 'qr' && (
        <>
          {!secret && !qrDataUrl ? (
            <div className="text-center py-4 space-y-3">
              <Shield className="size-12 mx-auto text-emerald-600" />
              <div>
                <div className="font-semibold">Secure your account with 2FA</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Two-factor authentication adds an extra layer of security to your account.
                  You'll need an authenticator app like Google Authenticator or Authy.
                </div>
              </div>
              <Button onClick={beginSetup} disabled={loading} className="w-full">
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Shield className="size-4 mr-2" />}
                Begin 2FA setup
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground text-center">
                <Smartphone className="size-5 mx-auto mb-1 text-muted-foreground" />
                Scan this QR code with Google Authenticator, Authy, or any other TOTP app.
              </div>
              <div className="flex justify-center bg-white p-3 rounded-lg border">
                {qrDataUrl && (
                  <img src={qrDataUrl} alt="2FA QR code" className="w-48 h-48" />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Or enter this secret manually:</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={secret}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={copySecret}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="border-t pt-3">
                <Label className="text-sm font-medium">Enter the 6-digit code from your app</Label>
                <div className="flex items-center justify-center mt-2">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(v) => setCode(v)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button onClick={verifyCode} disabled={loading || code.length !== 6} className="w-full mt-3">
                  {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Verify and enable 2FA
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {step === 'recovery' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="size-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-amber-900">Save these recovery codes!</div>
              <div className="text-amber-800 mt-1">
                Each code can be used exactly once to access your account if you lose
                your authenticator device. These will <strong>not</strong> be shown again.
              </div>
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <KeyRound className="size-3 text-muted-foreground" />
                  <span className="select-all">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <Button onClick={downloadRecoveryCodes} variant="outline" className="w-full">
            <Download className="size-4 mr-2" />
            Download as .txt
          </Button>
          <div className="flex items-center gap-2">
            <Checkbox
              id="confirm-saved"
              checked={saved}
              onCheckedChange={(c) => setSaved(Boolean(c))}
            />
            <Label htmlFor="confirm-saved" className="text-sm cursor-pointer">
              I've saved these codes somewhere safe
            </Label>
          </div>
          <Button onClick={finish} disabled={!saved} className="w-full">
            <CheckCircle2 className="size-4 mr-2" />
            Continue
          </Button>
        </div>
      )}

      {step === 'done' && (
        <div className="text-center py-6 space-y-3">
          <CheckCircle2 className="size-12 mx-auto text-emerald-600" />
          <div>
            <div className="font-semibold text-lg">2FA enabled successfully</div>
            <div className="text-sm text-muted-foreground mt-1">
              Your account is now protected with two-factor authentication.
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (inline) {
    return <div className="space-y-4">{body}</div>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="size-5 text-emerald-600" />
            Two-Factor Authentication Setup
          </DialogTitle>
          <DialogDescription>
            Secure your account with time-based one-time passwords (TOTP).
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}
