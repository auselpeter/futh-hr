import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const template = await db.reportTemplate.findUnique({ where: { id } })
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    if (!template.isActive) return NextResponse.json({ error: 'Template is not active' }, { status: 400 })
    return NextResponse.json({ template })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}
