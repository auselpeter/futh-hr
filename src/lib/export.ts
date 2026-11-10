// Excel export helpers — uses SheetJS (xlsx).
// Triggers a browser download via Blob + URL.createObjectURL.

import * as XLSX from 'xlsx'

type Sheet = { name: string; rows: any[] }

/**
 * Generate a multi-sheet .xlsx workbook and trigger download.
 * `rows` is an array of plain objects (column keys become headers).
 */
export function exportToExcel(filename: string, sheets: Sheet[]): void {
  if (!sheets.length) return
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{}])
    // Set reasonable column widths
    const cols = sheet.rows.length
      ? Object.keys(sheet.rows[0]).map((k) => ({
          wch: Math.min(Math.max(k.length + 2, (sheet.rows[0][k] || '').toString().length + 2, 10), 50),
        }))
      : [{ wch: 10 }]
    ;(ws as any)['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)) // Excel sheet names max 31 chars
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

/**
 * Single-sheet convenience helper.
 */
export function downloadJSONasExcel(filename: string, data: any[], sheetName = 'Sheet1'): void {
  exportToExcel(filename, [{ name: sheetName, rows: data }])
}
