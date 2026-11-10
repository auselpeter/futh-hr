// Reusable print utility — uses a hidden iframe so pop-up blockers don't interfere.
// The iframe is created off-screen, populated with a self-contained HTML document
// (inline CSS), and print() is called on its contentWindow.

const FUTH_LOGO_URL = '/futh-logo.jpeg'

const PRINT_STYLE = `
  @page { size: A4; margin: 18mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 18mm; }
  h1 { color: #14532d; margin-bottom: 0; font-size: 22px; }
  h2 { color: #15803d; margin-top: 0; font-size: 16px; }
  h3 { color: #14532d; font-size: 13px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
  .header { display: flex; gap: 16px; align-items: center; border-bottom: 3px solid #15803d; padding-bottom: 12px; margin-bottom: 20px; }
  .header img { width: 70px; height: 70px; border-radius: 8px; object-fit: cover; }
  .header h1 { font-size: 20px; }
  .header .sub { font-size: 12px; color: #666; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
  th { background: #f4f7f6; color: #14532d; font-weight: 600; }
  .signature-box { display: inline-block; width: 200px; height: 80px; border: 1px dashed #888; vertical-align: top; margin-right: 30px; margin-bottom: 12px; text-align: center; font-size: 11px; padding: 4px; box-sizing: border-box; }
  .signature-box img { max-width: 100%; max-height: 60px; object-fit: contain; }
  .label { font-weight: bold; color: #555; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .value { font-size: 12px; margin-bottom: 6px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
  .section { margin-bottom: 18px; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; background: #dcfce7; color: #14532d; border: 1px solid #86efac; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 10px; color: #888; text-align: center; }
  .row { display: flex; gap: 12px; margin-bottom: 4px; }
  .row .label { min-width: 130px; }
  @media print {
    body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`

// Fetch the logo as a data URL so it renders inside the iframe even when the iframe
// has no URL (and so we don't depend on relative paths).
let cachedLogoDataUrl: string | null = null
async function getLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl
  try {
    const res = await fetch(FUTH_LOGO_URL)
    const blob = await res.blob()
    cachedLogoDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve('')
      reader.readAsDataURL(blob)
    })
    return cachedLogoDataUrl
  } catch {
    return ''
  }
}

export async function printHTML(html: string, title: string) {
  const logoUrl = await getLogoDataUrl()
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>${PRINT_STYLE}</style>
</head>
<body>
${html.replace(/src="\/futh-logo\.jpeg"/g, `src="${logoUrl}"`)}
<div class="footer">
  Printed on ${new Date().toLocaleString()} · FUTH LAFIA HR · HUMAN RESOURCES MANAGEMENT SYSTEM
</div>
</body>
</html>`

  // Create a hidden iframe off-screen, write the document into it, and print.
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('tabindex', '-1')
  document.body.appendChild(iframe)

  const docEl = iframe.contentDocument || iframe.contentWindow?.document
  if (!docEl) {
    document.body.removeChild(iframe)
    alert('Unable to create print frame. Please try again.')
    return
  }
  docEl.open()
  docEl.write(doc)
  docEl.close()

  // Give the iframe a tick to render (and images to load) before printing.
  setTimeout(() => {
    try {
      iframe.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('Print failed', e)
      alert('Print failed. Please try again.')
    }
    // Remove the iframe after the print dialog has had time to spawn.
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }, 2000)
  }, 400)
}

export function printHeader(institution: string, subLine: string, refNumber: string, docTitle: string): string {
  return `
  <div class="header">
    <img src="${FUTH_LOGO_URL}" alt="FUTH logo" />
    <div style="flex: 1;">
      <h1>${institution}</h1>
      <div class="sub">${subLine}</div>
    </div>
    <div style="text-align: right;">
      <div class="label">Reference</div>
      <div style="font-family: monospace; font-size: 13px; font-weight: bold; color: #14532d;">${refNumber}</div>
    </div>
  </div>
  <h2>${docTitle}</h2>
  `
}

/**
 * Build a FUTH LAFIA registry file cover sheet that matches the physical
 * "GEN. 3 REVISED" registry folder used at the hospital. The layout is:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ [logo] FEDERAL UNIVERSITY TEACHING HOSPITAL           │
 *   │        Nasarawa State                                       │
 *   │        ───────────────────── REGISTRY ───────────────       │
 *   │                                          FILE NO. | VOLUME │
 *   │  ─────────────────────────────────────────────────────────  │
 *   │  SUBJECT: <subject line>                                    │
 *   │  ─────────────────────────────────────────────────────────  │
 *   │  ┌─────┬──────┬──────┬──────┬─────┬──────┬──────┬──────┐    │
 *   │  │ TO  │ PAGE │ DATE │ SIGN │ TO  │ PAGE │ DATE │ SIGN │    │
 *   │  ├─────┼──────┼──────┼──────┼─────┼──────┼──────┼──────┤    │
 *   │  │ ... │ ...  │ ...  │ ...  │ ... │ ...  │ ...  │ ...  │    │
 *   │  └─────┴──────┴──────┴──────┴─────┴──────┴──────┴──────┘    │
 *   │  (routing table — 4 columns repeated 4x = 16 entries)       │
 *   │                                                             │
 *   │  FILE NO. | VOLUME         (footer copy for shelf label)     │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * This is rendered for ALL file types (individual, department, external,
 * committee) — the cover sheet structure is identical; only the file
 * number prefix (IND/DEP/EXT/COM) differs and the SUBJECT line carries
 * the type-specific context (staff name, department name, external
 * party name, committee name).
 */
export function registryCoverSheetHTML(opts: {
  fileNumber: string
  volume?: string | null
  subject: string
  type: string // individual | department | external | committee
  typeLabel: string // Individual | Department | Correspondent | Committee
  typeSpecificLine?: string // e.g. "Staff: Peter Ade (FUTH/001)" or "Department: Surgery" or "External: Ministry of Health" or "Committee: Tenders Board"
  createdBy?: string | null
  createdAt?: string | null
  routes?: Array<{
    createdAt: string
    action: string
    fromName?: string | null
    toName?: string | null
    signerName?: string | null
    signatureUrl?: string | null
    remarks?: string | null
  }>
}): string {
  const { fileNumber, volume, subject, type, typeLabel, typeSpecificLine, createdBy, createdAt, routes } = opts

  // Build routing entries. Each row of the physical GEN.3 REVISED form has
  // 4 columns (TO, PAGE, DATE, SIGN) repeated 4 times across the page = 16 entries per row group.
  // We use the actual routing history to populate the entries. If there are
  // fewer routes than slots, the remaining slots are left blank (so the form
  // can be printed and the rest filled by hand as the file moves).
  const NUM_COLUMNS = 4 // TO | PAGE | DATE | SIGN
  const NUM_GROUPS = 4 // 4 groups of 4 columns = 16 entries per page

  // Pad routes to fill at least NUM_GROUPS slots (so the table always has at
  // least 4 rows visible). Use the actual routes first, then blank rows.
  const routeEntries: any[] = (routes || []).map((r) => ({
    to: r.toName || '—',
    page: r.action || '',
    date: r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB') : '',
    sign: r.signerName || (r.signatureUrl ? '☑' : ''),
  }))
  while (routeEntries.length < NUM_GROUPS) {
    routeEntries.push({ to: '', page: '', date: '', sign: '' })
  }

  // Build 4-column groups of entries. Each group of 4 entries = 1 row.
  // We render 4 such groups across the page = 16 entries total.
  const buildGroupRow = (startIndex: number) => {
    const cells = []
    for (let i = 0; i < NUM_COLUMNS; i++) {
      const entry = routeEntries[startIndex + i] || { to: '', page: '', date: '', sign: '' }
      cells.push(`
        <td style="width: 25%; vertical-align: top; padding: 0;">
          <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">
            <tr>
              <td style="border: 1px solid #888; padding: 6px 4px; font-size: 11px; min-height: 28px; height: 32px;">
                ${htmlEscape(entry.to)}
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #888; border-top: none; padding: 6px 4px; font-size: 11px; height: 32px;">
                ${htmlEscape(entry.page)}
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #888; border-top: none; padding: 6px 4px; font-size: 11px; height: 32px;">
                ${htmlEscape(entry.date)}
              </td>
            </tr>
            <tr>
              <td style="border: 1px solid #888; border-top: none; padding: 6px 4px; font-size: 11px; height: 32px;">
                ${entry.sign && entry.sign.startsWith('data:') || entry.sign === '☑'
                  ? '<span style="font-size: 14px;">✓</span>'
                  : htmlEscape(entry.sign)}
              </td>
            </tr>
          </table>
        </td>
      `)
    }
    return cells.join('')
  }

  // Header row: TO | PAGE | DATE | SIGN repeated 4 times
  const headerCells = []
  for (let g = 0; g < NUM_GROUPS; g++) {
    headerCells.push(`
      <td style="width: 25%; padding: 0; border: 1px solid #888;">
        <table style="width: 100%; border-collapse: collapse; margin: 0;">
          <tr>
            <td style="border: none; border-right: 1px solid #888; padding: 4px; text-align: center; font-weight: bold; font-size: 11px; background: #f4f7f6; color: #14532d;">TO</td>
            <td style="border: none; border-right: 1px solid #888; padding: 4px; text-align: center; font-weight: bold; font-size: 11px; background: #f4f7f6; color: #14532d;">PAGE</td>
            <td style="border: none; border-right: 1px solid #888; padding: 4px; text-align: center; font-weight: bold; font-size: 11px; background: #f4f7f6; color: #14532d;">DATE</td>
            <td style="border: none; padding: 4px; text-align: center; font-weight: bold; font-size: 11px; background: #f4f7f6; color: #14532d;">SIGN</td>
          </tr>
        </table>
      </td>
    `)
  }

  // Build 4 rows (one per group of 4 entries) — each row spans 4 column-groups
  const rowsHtml = []
  for (let row = 0; row < 4; row++) {
    const startIndex = row * NUM_COLUMNS
    rowsHtml.push(`<tr>${buildGroupRow(startIndex)}</tr>`)
  }

  return `
  <div class="registry-cover">
    <style>
      .registry-cover {
        font-family: 'Times New Roman', Times, serif;
        color: #000;
        max-width: 100%;
        margin: 0 auto;
        padding: 0;
      }
      .rc-header {
        display: flex;
        gap: 16px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 2px solid #000;
      }
      .rc-header .logo {
        width: 90px;
        height: 90px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #14532d;
      }
      .rc-header .institution {
        flex: 1;
        text-align: center;
      }
      .rc-header .institution h1 {
        font-size: 18px;
        font-weight: bold;
        margin: 0;
        letter-spacing: 0.04em;
        color: #000;
      }
      .rc-header .institution .state {
        font-size: 12px;
        margin-top: 2px;
        color: #333;
      }
      .rc-header .institution .registry-label {
        margin-top: 8px;
        font-size: 13px;
        font-weight: bold;
        letter-spacing: 0.4em;
        color: #000;
      }
      .rc-header .institution .form-code {
        margin-top: 2px;
        font-size: 10px;
        font-style: italic;
        color: #555;
      }
      .rc-header .file-id {
        text-align: right;
        min-width: 180px;
      }
      .rc-header .file-id .field {
        margin-bottom: 8px;
      }
      .rc-header .file-id .field-label {
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #555;
      }
      .rc-header .file-id .field-value {
        font-size: 13px;
        font-weight: bold;
        font-family: monospace;
        color: #14532d;
        border-bottom: 1px solid #888;
        padding: 2px 4px;
        min-width: 140px;
        display: inline-block;
        text-align: left;
      }
      .rc-subject {
        margin: 14px 0;
        padding: 10px 12px;
        border: 1px solid #888;
        background: #fafafa;
      }
      .rc-subject .subject-label {
        font-size: 11px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #555;
        margin-bottom: 4px;
      }
      .rc-subject .subject-text {
        font-size: 14px;
        font-weight: bold;
        color: #000;
      }
      .rc-subject .type-line {
        margin-top: 6px;
        font-size: 11px;
        color: #444;
        font-style: italic;
      }
      .rc-subject .meta-line {
        margin-top: 4px;
        font-size: 10px;
        color: #888;
      }
      .rc-routing-title {
        margin: 18px 0 6px 0;
        font-size: 12px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #555;
      }
      .rc-routing-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
      }
      .rc-routing-table > tbody > tr > td {
        padding: 0;
        vertical-align: top;
        border: 1px solid #888;
      }
      .rc-footer {
        margin-top: 24px;
        padding-top: 12px;
        border-top: 2px solid #000;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .rc-footer .field-label {
        font-size: 10px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #555;
      }
      .rc-footer .field-value {
        font-size: 13px;
        font-weight: bold;
        font-family: monospace;
        color: #14532d;
        border-bottom: 1px solid #888;
        padding: 2px 4px;
        min-width: 140px;
        display: inline-block;
      }
      .rc-footer .footer-block {
        display: flex;
        gap: 24px;
      }
      .rc-watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 80px;
        font-weight: bold;
        color: rgba(21, 128, 61, 0.05);
        z-index: 0;
        pointer-events: none;
        text-align: center;
        letter-spacing: 0.1em;
      }
      .rc-content { position: relative; z-index: 1; }
    </style>
    <div class="rc-content">
      <div class="rc-header">
        <img src="${FUTH_LOGO_URL}" alt="FUTH logo" class="logo" />
        <div class="institution">
          <h1>FEDERAL UNIVERSITY TEACHING HOSPITAL</h1>
          <div class="state">Nasarawa State</div>
          <div class="registry-label">REGISTRY</div>
          <div class="form-code">(GEN. 3 REVISED)</div>
        </div>
        <div class="file-id">
          <div class="field">
            <div class="field-label">File No.</div>
            <div class="field-value">${htmlEscape(fileNumber)}</div>
          </div>
          <div class="field">
            <div class="field-label">Volume</div>
            <div class="field-value">${htmlEscape(volume || '&nbsp;')}</div>
          </div>
        </div>
      </div>

      <div class="rc-subject">
        <div class="subject-label">Subject</div>
        <div class="subject-text">${htmlEscape(subject)}</div>
        ${typeSpecificLine ? `<div class="type-line">${htmlEscape(typeSpecificLine)}</div>` : ''}
        <div class="meta-line">
          File Type: ${htmlEscape(typeLabel)} · Created by ${htmlEscape(createdBy || '—')}${createdAt ? ` on ${new Date(createdAt).toLocaleDateString('en-GB')}` : ''}
        </div>
      </div>

      <div class="rc-routing-title">Routing — File Movement Log</div>
      <table class="rc-routing-table">
        <thead>
          <tr>${headerCells.join('')}</tr>
        </thead>
        <tbody>
          ${rowsHtml.join('')}
        </tbody>
      </table>

      <div class="rc-footer">
        <div class="footer-block">
          <div class="field">
            <div class="field-label">File No.</div>
            <div class="field-value">${htmlEscape(fileNumber)}</div>
          </div>
          <div class="field">
            <div class="field-label">Volume</div>
            <div class="field-value">${htmlEscape(volume || '&nbsp;')}</div>
          </div>
        </div>
        <div style="font-size: 9px; color: #888; font-style: italic;">
          GEN. 3 REVISED — FUTH LAFIA Registry File Cover
        </div>
      </div>
    </div>
  </div>
  `
}

export function signatureBox(label: string, name?: string | null, date?: string | null, signatureUrl?: string | null): string {
  const dateStr = date ? formatDateForPrint(date) : ''
  const imgOrPlaceholder = signatureUrl
    ? `<img src="${signatureUrl}" alt="${label} signature" />`
    : `<div style="margin-top: 28px; color: #999;">Signature</div>`
  return `<div class="signature-box">
    <div class="label">${label}</div>
    ${imgOrPlaceholder}
    <div style="border-top: 1px solid #888; padding-top: 4px; margin-top: 6px;">
      <div style="font-size: 10px; font-weight: 600;">${name || '&nbsp;'}</div>
      <div style="font-size: 9px; color: #888;">${dateStr || '&nbsp;'}</div>
    </div>
  </div>`
}

export function formatDateForPrint(d: string | Date | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' }) +
    ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function htmlEscape(s: any): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function row(label: string, value: any): string {
  return `<div class="row"><div class="label">${htmlEscape(label)}</div><div class="value">${value === null || value === undefined || value === '' ? '—' : htmlEscape(value)}</div></div>`
}
