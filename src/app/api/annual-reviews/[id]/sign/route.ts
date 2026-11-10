import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { audit, getIp } from '@/lib/audit'

// POST body: { role: 'HOD' | 'DA', signatureUrl, name, remarks }
// HOD signs first → status='HOD Signed', hodSignedAt
// DA signs next   → status='Completed', daSignedAt
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const body = await req.json()
    const role = body.role
    const signatureUrl = body.signatureUrl
    const name = body.name || user.fullName
    const remarks = body.remarks || null

    if (!['HOD', 'DA'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (!signatureUrl) {
      return NextResponse.json({ error: 'signatureUrl is required' }, { status: 400 })
    }

    const review = await db.annualReview.findUnique({ where: { id } })
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

    const data: any = {}
    if (role === 'HOD') {
      data.hodName = name
      data.hodSignatureUrl = signatureUrl
      data.hodSignedAt = new Date()
      data.status = 'HOD Signed'
    } else {
      // DA role
      if (review.status !== 'HOD Signed' && review.status !== 'DA Signed') {
        return NextResponse.json({ error: 'HOD must sign before DA' }, { status: 400 })
      }
      data.daName = name
      data.daSignatureUrl = signatureUrl
      data.daSignedAt = new Date()
      data.status = 'Completed'
    }
    if (remarks) data.comments = (review.comments || '') + `\n[${role} remarks]: ${remarks}`

    const updated = await db.annualReview.update({ where: { id }, data })
    await audit(user, 'sign', { entity: 'AnnualReview', entityId: id, details: `${role} signed annual review ${review.period}`, ipAddress: getIp(req) })
    return NextResponse.json({ review: updated })
  } catch (e: any) {
    console.error('AnnualReview sign:', e)
    return NextResponse.json({ error: 'Failed to sign review' }, { status: 500 })
  }
}
