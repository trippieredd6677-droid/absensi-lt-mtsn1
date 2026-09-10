// Util ekspor laporan → file .xlsx ber-style (header hijau, bold, warna status).
// Pakai exceljs (dimuat on-demand biar halaman tetep cepat). Dipakai di Histori (guru) & AdminAbsensi (admin).

const ACCENT = '3A7A55'
const ACCENT_DARK = '2F6345'
const SURFACE = 'FFFFFF'
const TEXT = '1F2421'
const BORDER = 'E2E2DE'
const ROW_ALT = 'EFEFEC'

const STATUS_FILL = {
  hadir: 'E9F1EB',
  sakit: 'F7EFDD',
  izin: 'E9EEF6',
  alpa: 'F7E9E7',
}
const STATUS_COLOR = {
  hadir: '3A7A55',
  sakit: '8F6820',
  izin: '47649C',
  alpa: 'A84343',
}

/**
 * Generate laporan XLSX + trigger download.
 * @param {object} opts
 * @param {string} opts.fileName - mis. 'laporan-absensi-9-2026.xlsx'
 * @param {string} opts.title - judul laporan (baris gabung 1)
 * @param {string} opts.subtitle - mis. 'MTsN 1 Kebumen · September 2026' (baris gabung 2)
 * @param {string} [opts.owner] - nama pemilik laporan (baris gabung 3)
 * @param {string[]} opts.columns - header kolom
 * @param {Array<Array>} opts.rows - baris data
 * @param {number[]} opts.statusCols - indeks kolom (0-based) yang menampilkan status berwarna
 */
export async function exportXlsx({ fileName, title, subtitle, owner, columns, rows, statusCols = [] }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Laporan')

  const total = columns.length
  ws.columns = columns.map((h) => ({ header: h, key: h, width: h.length < 5 ? 14 : 24 }))

  const headRow = ws.getRow(1)
  const subRow = ws.getRow(2)
  const ownerRow = ws.getRow(3)

  // Judul & subjudul (merge penuh kolom)
  ws.mergeCells(1, 1, 1, total)
  ws.mergeCells(2, 1, 2, total)
  headRow.getCell(1).value = title
  subRow.getCell(1).value = subtitle
  headRow.height = 24
  subRow.height = 16

  const titleCell = headRow.getCell(1)
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: ACCENT_DARK } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }

  const subCell = subRow.getCell(1)
  subCell.font = { name: 'Calibri', size: 10, color: { argb: '5F665F' } }
  subCell.alignment = { vertical: 'middle', horizontal: 'left' }

  if (owner) {
    ws.mergeCells(3, 1, 3, total)
    ownerRow.getCell(1).value = `${owner}`
    ownerRow.height = 18
    const oCell = ownerRow.getCell(1)
    oCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: TEXT } }
    oCell.alignment = { vertical: 'middle', horizontal: 'left' }
  }

  // Header baris kolom (baris 4) — teks putih di atas background hijau
  const headerRow = ws.getRow(4)
  headerRow.values = columns
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  headerRow.height = 20

  // Data
  rows.forEach((row, idx) => {
    const r = ws.getRow(idx + 5)
    r.values = row
    r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const statusCol = statusCols.includes(colNumber - 1)
      if (statusCol) {
        const status = String(cell.value || '').toLowerCase()
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[status] || 'EFEFEC' } }
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: STATUS_COLOR[status] || '5F665F' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        if (typeof cell.value === 'string') cell.value = status.charAt(0).toUpperCase() + status.slice(1)
      } else {
        cell.font = { name: 'Calibri', size: 11, color: { argb: TEXT } }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
      }
      cell.border = { bottom: { style: 'thin', color: { argb: BORDER } } }
      if (idx % 2 === 1 && !statusCol) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_ALT } }
      }
    })
    r.height = 18
  })

  // Buffer → Blob → download
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
