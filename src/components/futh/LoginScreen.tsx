'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  InputOTP, InputOTPGroup, InputOTPSlot,
} from '@/components/ui/input-otp'
import { toast } from 'sonner'
import {
  Loader2, ShieldCheck, Lock, User, Eye, EyeOff, Smartphone, KeyRound, AlertTriangle, ArrowLeft, Mail, Phone, Send,
} from 'lucide-react'
import TwoFactorSetup from './TwoFactorSetup'

type Props = {
  onLogin: (user: any) => void
}

type Stage = 'credentials' | '2fa-verify' | '2fa-setup-required'

export default function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  const [stage, setStage] = useState<Stage>('credentials')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [twoFactorEnforced, setTwoFactorEnforced] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [useRecoveryCode, setUseRecoveryCode] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  // === Stage 1: credentials submit ===
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      toast.error('Enter your username and password')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.toLowerCase(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Login failed')
        setLoading(false)
        return
      }

      // Check for 2FA challenge responses
      if (data.twoFactorRequired) {
        setPendingUserId(data.userId)
        setTwoFactorEnforced(!!data.twoFactorEnforced)
        setStage('2fa-verify')
        setLoading(false)
        return
      }
      if (data.twoFactorSetupRequired) {
        setPendingUserId(data.userId)
        setStage('2fa-setup-required')
        setLoading(false)
        return
      }

      // Normal successful login
      toast.success(`Welcome back, ${data.user.fullName}`)
      onLogin(data.user)
    } catch {
      toast.error('Network error — please retry')
      setLoading(false)
    }
  }

  // === Stage 2: 2FA code verification ===
  const verifyTwoFactor = async () => {
    if (!pendingUserId) return
    if (!useRecoveryCode && twoFactorCode.length !== 6) {
      toast.error('Enter the 6-digit code from your authenticator app')
      return
    }
    if (useRecoveryCode && !recoveryCode.trim()) {
      toast.error('Enter a 10-character recovery code')
      return
    }
    setLoading(true)
    try {
      const code = useRecoveryCode ? recoveryCode.trim() : twoFactorCode
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId: pendingUserId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Invalid code — please try again')
        setLoading(false)
        return
      }
      if (data.usedRecoveryCode && data.remainingRecoveryCodes !== undefined) {
        toast.success(`Login successful. You have ${data.remainingRecoveryCodes} recovery code(s) remaining.`)
      } else {
        toast.success(`Welcome back, ${data.user.fullName}`)
      }
      onLogin(data.user)
    } catch {
      toast.error('Network error — please retry')
      setLoading(false)
    }
  }

  const resetToCredentials = () => {
    setStage('credentials')
    setPendingUserId(null)
    setTwoFactorCode('')
    setRecoveryCode('')
    setUseRecoveryCode(false)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left panel — branding */}
      <div className="lg:flex-1 bg-gradient-to-br from-[#14532d] via-[#15803d] to-[#166534] text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="futh-logo futh-logo-lg"><img src="/futh-logo.jpeg" alt="FUTH LAFIA logo" /></div>
          <div>
            <div className="text-lg font-bold tracking-wide">FUTH LAFIA</div>
            <div className="text-xs text-white/80">FEDERAL UNIVERSITY TEACHING HOSPITAL</div>
          </div>
        </div>
        <div className="relative z-10 max-w-lg mt-12 lg:mt-0">
          <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight">
            HUMAN RESOURCES MANAGEMENT SYSTEM
          </h1>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur p-4 rounded-lg">
              <div className="text-2xl font-bold">9</div>
              <div className="text-xs text-white/80">Designations</div>
            </div>
            <div className="bg-white/10 backdrop-blur p-4 rounded-lg">
              <div className="text-2xl font-bold">14</div>
              <div className="text-xs text-white/80">Departments</div>
            </div>
            <div className="bg-white/10 backdrop-blur p-4 rounded-lg">
              <div className="text-2xl font-bold">12+</div>
              <div className="text-xs text-white/80">Staff Records</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-xs text-white/70 mt-8">
          © {new Date().getFullYear()} FEDERAL UNIVERSITY TEACHING HOSPITAL. All rights reserved.
        </div>
      </div>

      {/* Right panel — login form / 2FA verification / 2FA setup */}
      <div className="lg:flex-1 flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-md">
          <Card className="border-border/80 shadow-xl">
            {stage === 'credentials' && (
              <>
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-5 text-primary" />
                    <CardTitle className="text-2xl">Sign in to your account</CardTitle>
                  </div>
                  <CardDescription>
                    Use your institutional credentials to continue.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username or IPPIS Number</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="IPPIS number or username"
                          className="pl-9"
                          autoFocus
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="pl-9 pr-10"
                          disabled={loading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Signing in...
                        </>
                      ) : (
                        'Sign in'
                      )}
                    </Button>
                    <div className="text-center text-xs">
                      <button type="button" onClick={() => setShowForgot(true)} className="text-muted-foreground hover:text-primary">Forgot password?</button>
                    </div>
                  </form>

                  <div className="mt-6 text-center">
                    <a
                      href="https://futhlafia.gov.ng"
                      className="text-xs text-muted-foreground hover:text-primary transition"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Need help signing in? Contact IT support.
                    </a>
                  </div>
                </CardContent>
              </>
            )}

            {stage === '2fa-verify' && (
              <>
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Smartphone className="size-5 text-primary" />
                    <CardTitle className="text-2xl">Two-factor authentication</CardTitle>
                  </div>
                  <CardDescription>
                    Enter the 6-digit code from your authenticator app to continue.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!useRecoveryCode ? (
                    <div className="space-y-3">
                      <Label>6-digit code</Label>
                      <div className="flex items-center justify-center">
                        <InputOTP
                          maxLength={6}
                          value={twoFactorCode}
                          onChange={(v) => setTwoFactorCode(v)}
                          autoFocus
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
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="recovery-code">Recovery code</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          id="recovery-code"
                          value={recoveryCode}
                          onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                          placeholder="Enter a 10-char recovery code"
                          className="pl-9 font-mono"
                          autoFocus
                          disabled={loading}
                        />
                      </div>
                    </div>
                  )}
                  <Button onClick={verifyTwoFactor} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                    Verify and sign in
                  </Button>
                  <button
                    type="button"
                    onClick={() => setUseRecoveryCode((v) => !v)}
                    className="w-full text-xs text-muted-foreground hover:text-primary text-center"
                  >
                    {useRecoveryCode ? '← Use authenticator code instead' : 'Use a recovery code instead →'}
                  </button>
                  <button
                    type="button"
                    onClick={resetToCredentials}
                    className="w-full text-xs text-muted-foreground hover:text-foreground text-center flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="size-3" /> Back to login
                  </button>
                </CardContent>
              </>
            )}

            {stage === '2fa-setup-required' && (
              <>
                <CardHeader className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="size-5 text-amber-600" />
                    <CardTitle className="text-2xl">2FA setup required</CardTitle>
                  </div>
                  <CardDescription>
                    Two-factor authentication is required for your account. Please set it up now.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    Your role requires two-factor authentication. Set up 2FA below to complete your login.
                    After setup completes, you will be logged in automatically.
                  </div>
                  {pendingUserId && (
                    <TwoFactorSetup
                      inline
                      open={true}
                      onOpenChange={() => {}}
                      userId={pendingUserId}
                      onCompleted={async () => {
                        // After 2FA setup completes, set the session cookie
                        // by calling the verify endpoint with the same code.
                        // But the TwoFactorSetup component already enabled 2FA
                        // and showed the recovery codes — at this point we just
                        // re-login the user by issuing a session cookie directly.
                        try {
                          // Use the /verify endpoint with the recovery code? We don't have one.
                          // The simplest path: redirect to login again. The user just set up
                          // 2FA, so on next login attempt the system will challenge them with 2FA.
                          toast.success('2FA setup complete! Please sign in again with your credentials.')
                          resetToCredentials()
                        } catch (e: any) {
                          toast.error('Failed to auto-login. Please sign in again.')
                          resetToCredentials()
                        }
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={resetToCredentials}
                    className="w-full text-xs text-muted-foreground hover:text-foreground text-center flex items-center justify-center gap-1"
                  >
                    <ArrowLeft className="size-3" /> Back to login
                  </button>
                </CardContent>
              </>
            )}
          </Card>

          {showForgot && (
            <ForgotPasswordDialog onClose={() => setShowForgot(false)} />
          )}
        </div>
      </div>
    </div>
  )
}

function ForgotPasswordDialog({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username) { toast.error('Enter your IPPIS number or username'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/password-resets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernameQuery: username, contactEmail: contactEmail || null, contactPhone: contactPhone || null, note: note || null }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to submit request'); setLoading(false); return }
      toast.success('Your password reset request has been submitted. An administrator will reset your password to admin123. Log in and change it from your Profile.')
      onClose()
    } catch { toast.error('Network error') }
    setLoading(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2"><KeyRound className="size-5 text-primary" /><h2 className="text-lg font-semibold">Forgot Password?</h2></div>
        <p className="text-xs text-muted-foreground mb-4">Submit a reset request. An administrator will reset your password to <code className="bg-muted px-1 rounded">admin123</code>. You will then log in and change it from your Profile.</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1"><Label htmlFor="forgot-username">IPPIS Number or Username *</Label><Input id="forgot-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your IPPIS number or username" autoFocus disabled={loading} /></div>
          <div className="space-y-1"><Label htmlFor="forgot-email">Contact Email (optional)</Label><Input id="forgot-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="So admin can reach you" disabled={loading} /></div>
          <div className="space-y-1"><Label htmlFor="forgot-phone">Contact Phone (optional)</Label><Input id="forgot-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="So admin can reach you" disabled={loading} /></div>
          <div className="space-y-1"><Label htmlFor="forgot-note">Note (optional)</Label><Input id="forgot-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any additional info..." disabled={loading} /></div>
          <div className="flex gap-2 pt-2"><Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">Cancel</Button><Button type="submit" disabled={loading} className="flex-1">{loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}Submit Request</Button></div>
        </form>
      </div>
    </div>
  )
}
