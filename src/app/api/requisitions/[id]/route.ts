import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { requisitionInclude } from '@/lib/prisma-helpers'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const requisition = await db.requisition.findUnique({
      where: { id },
      include: requisitionInclude,
    })
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 })
    }
    return NextResponse.json({ requisition })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch requisition' }, { status: 500 })
  }
}
