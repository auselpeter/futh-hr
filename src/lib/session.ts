import { cookies } from 'next/headers'
import crypto from 'crypto'
import { db } from './db'

// Secret used to sign the session cookie. In production this should come from env.
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'futh-lafia-hr-system-secret-key-change-in-prod-2025'

const COOKIE_NAME = 'futh_session'
const SESSION_TTL = 60 * 60 * 24 * 7 // 7 days in seconds

export interface SessionPayload {
  userId: string
  username: string
  role: string
  exp: number // unix seconds
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input as any)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  return Buffer.from(padded + pad, 'base64').toString('utf8')
}

function sign(payload: string): string {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = sign(payload)
  if (expected.length !== signature.length) return false
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL
  const fullPayload: SessionPayload = { ...payload, exp }
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload))
  const signature = sign(payloadB64)
  return `${payloadB64}.${signature}`
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.includes('.')) return null
  const [payloadB64, signature] = token.split('.')
  if (!payloadB64 || !signature) return null
  if (!verifySignature(payloadB64, signature)) return null
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as SessionPayload
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export async function setSessionCookie(
  payload: Omit<SessionPayload, 'exp'>,
): Promise<void> {
  const token = createSessionToken(payload)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
