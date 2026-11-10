import { db } from './db'

// Generate a unique ref number for a Requisition.
// Format: FUTH/REQ/{TYPE_CODE}/{YEAR}/{SEQ:04d}
//   - TYPE_CODE: SVC | EXP | OTH
export async function generateRequisitionRefNumber(type: string): Promise<string> {
  const typeCode =
    type === 'service' ? 'SVC' : type === 'expense' ? 'EXP' : 'OTH'
  const year = new Date().getFullYear()
  const prefix = `FUTH/REQ/${typeCode}/${year}/`

  // Find the highest existing seq for this prefix
  const existing = await db.requisition.findMany({
    where: { refNumber: { startsWith: prefix } },
    select: { refNumber: true },
  })
  let maxSeq = 0
  for (const r of existing) {
    const parts = r.refNumber.split('/')
    const seq = parseInt(parts[parts.length - 1] || '0', 10)
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  }
  const nextSeq = maxSeq + 1
  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}

// Generate a unique file number for a RegistryFile.
// Format: FUTH/REG/{TYPE_CODE}/{YEAR}/{SEQ:04d}
//   - TYPE_CODE: IND | DEP | EXT | COM
export async function generateFileNumber(type: string): Promise<string> {
  const typeCode =
    type === 'individual' ? 'IND' : type === 'department' ? 'DEP' : type === 'committee' ? 'COM' : 'EXT'
  const year = new Date().getFullYear()
  const prefix = `FUTH/REG/${typeCode}/${year}/`

  const existing = await db.registryFile.findMany({
    where: { fileNumber: { startsWith: prefix } },
    select: { fileNumber: true },
  })
  let maxSeq = 0
  for (const r of existing) {
    const parts = r.fileNumber.split('/')
    const seq = parseInt(parts[parts.length - 1] || '0', 10)
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  }
  const nextSeq = maxSeq + 1
  return `${prefix}${String(nextSeq).padStart(4, '0')}`
}
